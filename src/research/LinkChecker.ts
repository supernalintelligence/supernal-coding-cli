// @ts-nocheck
/**
 * Research Link Checker
 * 
 * Validates links in research/awesome-list style markdown files.
 * Checks both external URLs and local file references.
 * 
 * Usage via CLI: sc research link-check [path]
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const chalk = require('chalk');

// Link patterns in markdown
const LINK_PATTERNS = {
  // [text](url) - standard markdown links
  markdown: /\[([^\]]*)\]\(([^)]+)\)/g,
  // <url> - auto-links
  autoLink: /<(https?:\/\/[^>]+)>/g,
  // Bare URLs (optional, can be noisy)
  bareUrl: /(?<!\()https?:\/\/[^\s<>)"']+/g
};

// Common false positives to skip
const SKIP_PATTERNS = [
  /^#/,                    // Anchor links
  /^mailto:/,              // Email links
  /^javascript:/,          // JS links
  /^data:/,                // Data URIs
  /\{\{.*\}\}/,           // Template variables
  /\$\{.*\}/,             // Template literals
  /<.*>/,                  // HTML-like placeholders
];

// Domains known to block automated checks
const PROBLEMATIC_DOMAINS = [
  'linkedin.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'reddit.com',           // Often rate-limited
];

class LinkChecker {
  cache: any;
  currentFileDir: any;
  options: any;
  projectRoot: any;
  results: any;
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 10000,
      concurrency: options.concurrency || 5,
      retries: options.retries || 2,
      verbose: options.verbose || false,
      checkExternal: options.checkExternal !== false,
      checkLocal: options.checkLocal !== false,
      includeBareUrls: options.includeBareUrls || false,
      cacheFile: options.cacheFile || '.link-check-cache.json',
      cacheTTL: options.cacheTTL || 24 * 60 * 60 * 1000, // 24 hours
      ...options
    };
    
    this.results = {
      total: 0,
      checked: 0,
      valid: 0,
      broken: [],
      warnings: [],
      skipped: [],
      cached: 0
    };
    
    // Find project root first, then load cache
    this.projectRoot = this.findProjectRoot();
    this.cache = this.loadCache();
  }

  findProjectRoot() {
    let dir = process.cwd();
    // Limit traversal to avoid infinite loops
    let maxDepth = 20;
    while (dir && dir !== path.dirname(dir) && maxDepth-- > 0) {
      if (fs.existsSync(path.join(dir, 'package.json')) || 
          fs.existsSync(path.join(dir, 'supernal.yaml'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    // Fallback to cwd if nothing found
    return process.cwd() || '.';
  }

  loadCache() {
    if (!this.projectRoot) {
      return {};
    }
    const cachePath = path.join(this.projectRoot, '.supernal', this.options.cacheFile);
    try {
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        // Filter expired entries
        const now = Date.now();
        const valid = {};
        for (const [url, entry] of Object.entries(data)) {
          if (now - entry.timestamp < this.options.cacheTTL) {
            valid[url] = entry;
          }
        }
        return valid;
      }
    } catch (error) {
      // Ignore cache errors
    }
    return {};
  }

  saveCache() {
    const cachePath = path.join(this.projectRoot, '.supernal', this.options.cacheFile);
    try {
      const dir = path.dirname(cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(cachePath, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      // Ignore cache save errors
    }
  }

  /**
   * Remove code blocks and inline code from content to avoid false positives
   */
  stripCodeBlocks(content) {
    // Remove fenced code blocks (```...```)
    let stripped = content.replace(/```[\s\S]*?```/g, (match) => {
      // Replace with same number of newlines to preserve line numbers
      return match.split('\n').map(() => '').join('\n');
    });
    
    // Remove inline code (`...`)
    stripped = stripped.replace(/`[^`]+`/g, (match) => {
      // Preserve length with spaces for line number accuracy
      return ' '.repeat(match.length);
    });
    
    return stripped;
  }

  /**
   * Extract all links from a markdown file
   */
  extractLinks(content, filePath) {
    const links = [];
    const seenUrls = new Set();
    
    // Strip code blocks to avoid false positives on example links
    const strippedContent = this.stripCodeBlocks(content);

    // Standard markdown links
    let match;
    while ((match = LINK_PATTERNS.markdown.exec(strippedContent)) !== null) {
      const [fullMatch, text, url] = match;
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        links.push({
          url,
          text,
          line: this.getLineNumber(content, match.index),
          file: filePath,
          type: 'markdown'
        });
      }
    }

    // Auto-links
    LINK_PATTERNS.autoLink.lastIndex = 0;
    while ((match = LINK_PATTERNS.autoLink.exec(strippedContent)) !== null) {
      const url = match[1];
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        links.push({
          url,
          text: url,
          line: this.getLineNumber(content, match.index),
          file: filePath,
          type: 'auto'
        });
      }
    }

    // Bare URLs (optional)
    if (this.options.includeBareUrls) {
      LINK_PATTERNS.bareUrl.lastIndex = 0;
      while ((match = LINK_PATTERNS.bareUrl.exec(strippedContent)) !== null) {
        const url = match[0];
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          links.push({
            url,
            text: url,
            line: this.getLineNumber(content, match.index),
            file: filePath,
            type: 'bare'
          });
        }
      }
    }

    return links;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Check if a URL should be skipped
   */
  shouldSkip(url) {
    return SKIP_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * Check if URL is from a problematic domain
   */
  isProblematicDomain(url) {
    try {
      const urlObj = new URL(url);
      return PROBLEMATIC_DOMAINS.some(domain => 
        urlObj.hostname.includes(domain)
      );
    } catch {
      return false;
    }
  }

  /**
   * Check a single URL
   */
  async checkUrl(url, retries = 0) {
    // Check cache first
    if (this.cache[url]) {
      this.results.cached++;
      return this.cache[url].result;
    }

    // Skip certain URLs
    if (this.shouldSkip(url)) {
      return { status: 'skipped', reason: 'pattern-skip' };
    }

    // Check local files
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return this.checkLocalFile(url);
    }

    // Skip external checks if disabled
    if (!this.options.checkExternal) {
      return { status: 'skipped', reason: 'external-disabled' };
    }

    // Warn about problematic domains
    if (this.isProblematicDomain(url)) {
      return { 
        status: 'warning', 
        reason: 'problematic-domain',
        message: 'Domain may block automated checks'
      };
    }

    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (url.startsWith('https') ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        timeout: this.options.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0; +https://supernal.ai)',
          'Accept': '*/*'
        }
      };

      const req = protocol.request(options, (res) => {
        const result = this.interpretResponse(res.statusCode, url);
        this.cacheResult(url, result);
        resolve(result);
      });

      req.on('error', async (error) => {
        // Retry on certain errors
        if (retries < this.options.retries && 
            (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
          const result = await this.checkUrl(url, retries + 1);
          resolve(result);
          return;
        }
        
        // Try GET instead of HEAD (some servers don't support HEAD)
        if (retries === 0) {
          const getResult = await this.checkUrlWithGet(url);
          resolve(getResult);
          return;
        }

        const result = {
          status: 'error',
          code: error.code,
          message: error.message
        };
        this.cacheResult(url, result);
        resolve(result);
      });

      req.on('timeout', () => {
        req.destroy();
        const result = { status: 'timeout', message: 'Request timed out' };
        this.cacheResult(url, result);
        resolve(result);
      });

      req.end();
    });
  }

  /**
   * Fallback to GET request
   */
  async checkUrlWithGet(url) {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (url.startsWith('https') ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.options.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0; +https://supernal.ai)',
          'Accept': '*/*',
          'Range': 'bytes=0-0' // Request minimal data
        }
      };

      const req = protocol.request(options, (res) => {
        res.destroy(); // Don't download body
        const result = this.interpretResponse(res.statusCode, url);
        this.cacheResult(url, result);
        resolve(result);
      });

      req.on('error', (error) => {
        const result = {
          status: 'error',
          code: error.code,
          message: error.message
        };
        this.cacheResult(url, result);
        resolve(result);
      });

      req.on('timeout', () => {
        req.destroy();
        const result = { status: 'timeout', message: 'Request timed out' };
        this.cacheResult(url, result);
        resolve(result);
      });

      req.end();
    });
  }

  interpretResponse(statusCode, url) {
    if (statusCode >= 200 && statusCode < 300) {
      return { status: 'ok', code: statusCode };
    }
    if (statusCode >= 300 && statusCode < 400) {
      return { status: 'redirect', code: statusCode };
    }
    if (statusCode === 403 || statusCode === 401) {
      // These might be valid pages that require auth
      return { 
        status: 'warning', 
        code: statusCode,
        message: 'Access restricted (may still be valid)'
      };
    }
    if (statusCode === 404) {
      return { status: 'broken', code: statusCode, message: 'Not found' };
    }
    if (statusCode === 429) {
      return { 
        status: 'warning', 
        code: statusCode, 
        message: 'Rate limited'
      };
    }
    if (statusCode >= 500) {
      return { 
        status: 'warning', 
        code: statusCode, 
        message: 'Server error (may be temporary)'
      };
    }
    return { status: 'unknown', code: statusCode };
  }

  cacheResult(url, result) {
    this.cache[url] = {
      result,
      timestamp: Date.now()
    };
  }

  /**
   * Check a local file reference
   */
  checkLocalFile(url) {
    if (!this.options.checkLocal) {
      return { status: 'skipped', reason: 'local-disabled' };
    }

    // Remove anchor from URL
    const cleanUrl = url.split('#')[0];
    
    // Skip empty URLs (just anchors)
    if (!cleanUrl) {
      return { status: 'ok', note: 'anchor-only' };
    }

    // Resolve relative to current file's directory
    const resolvedPath = path.resolve(this.currentFileDir || this.projectRoot, cleanUrl);
    
    if (fs.existsSync(resolvedPath)) {
      return { status: 'ok' };
    }

    // Try relative to project root
    const rootPath = path.resolve(this.projectRoot, cleanUrl);
    if (fs.existsSync(rootPath)) {
      return { status: 'ok' };
    }

    return { 
      status: 'broken', 
      message: `File not found: ${cleanUrl}`,
      tried: [resolvedPath, rootPath]
    };
  }

  /**
   * Find all markdown files in a directory
   */
  findMarkdownFiles(dirPath) {
    const files = [];
    
    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            // Skip common non-content directories
            if (!['node_modules', '.git', '.supernal', 'dist', 'build'].includes(entry.name)) {
              walk(fullPath);
            }
          } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walk(dirPath);
    return files;
  }

  /**
   * Check all links in a file
   */
  async checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const links = this.extractLinks(content, filePath);
    
    this.currentFileDir = path.dirname(filePath);
    
    const results = [];
    
    // Process links with concurrency limit
    for (let i = 0; i < links.length; i += this.options.concurrency) {
      const batch = links.slice(i, i + this.options.concurrency);
      const batchResults = await Promise.all(
        batch.map(async (link) => {
          this.results.total++;
          
          if (this.shouldSkip(link.url)) {
            this.results.skipped.push({ ...link, reason: 'pattern' });
            return { ...link, result: { status: 'skipped' } };
          }
          
          const result = await this.checkUrl(link.url);
          this.results.checked++;
          
          if (result.status === 'ok' || result.status === 'redirect') {
            this.results.valid++;
          } else if (result.status === 'broken' || result.status === 'error') {
            this.results.broken.push({ ...link, result });
          } else if (result.status === 'warning') {
            this.results.warnings.push({ ...link, result });
          } else if (result.status === 'skipped') {
            this.results.skipped.push({ ...link, reason: result.reason });
          }
          
          return { ...link, result };
        })
      );
      results.push(...batchResults);
      
      // Progress indicator for verbose mode
      if (this.options.verbose && i > 0 && i % 10 === 0) {
        process.stdout.write(chalk.gray(`.`));
      }
    }
    
    return results;
  }

  /**
   * Run link check on path(s)
   */
  async run(targetPath) {
    const startTime = Date.now();
    
    // Default to awesome-ai-development if no path
    const checkPath = targetPath || 
      path.join(this.projectRoot, 'packages', 'awesome-ai-development');
    
    // Resolve path
    const resolvedPath = path.resolve(process.cwd(), checkPath);
    
    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red(`Path not found: ${resolvedPath}`));
      return { success: false, error: 'Path not found' };
    }

    console.log(chalk.bold('\n🔍 Research Link Checker'));
    console.log(chalk.gray(`   Path: ${resolvedPath}`));
    console.log('');

    // Get files to check
    let files;
    if (fs.statSync(resolvedPath).isDirectory()) {
      files = this.findMarkdownFiles(resolvedPath);
    } else {
      files = [resolvedPath];
    }

    if (files.length === 0) {
      console.log(chalk.yellow('No markdown files found'));
      return { success: true, results: this.results };
    }

    console.log(chalk.gray(`   Found ${files.length} markdown file(s)`));
    console.log('');

    // Process each file
    for (const file of files) {
      const relPath = path.relative(this.projectRoot, file);
      if (this.options.verbose) {
        console.log(chalk.cyan(`Checking: ${relPath}`));
      }
      await this.checkFile(file);
    }

    // Save cache
    this.saveCache();

    // Report results
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    this.printReport(duration);

    return {
      success: this.results.broken.length === 0,
      results: this.results
    };
  }

  printReport(duration) {
    console.log('');
    console.log(chalk.bold('📊 Results'));
    console.log(chalk.gray(`   Duration: ${duration}s`));
    console.log('');
    console.log(chalk.cyan(`   Total links:   ${this.results.total}`));
    console.log(chalk.green(`   Valid:         ${this.results.valid}`));
    console.log(chalk.gray(`   Cached:        ${this.results.cached}`));
    console.log(chalk.gray(`   Skipped:       ${this.results.skipped.length}`));
    
    if (this.results.warnings.length > 0) {
      console.log(chalk.yellow(`   Warnings:      ${this.results.warnings.length}`));
    }
    
    if (this.results.broken.length > 0) {
      console.log(chalk.red(`   Broken:        ${this.results.broken.length}`));
    }

    // Show warnings
    if (this.results.warnings.length > 0 && this.options.verbose) {
      console.log('');
      console.log(chalk.yellow.bold('⚠️  Warnings:'));
      for (const warning of this.results.warnings) {
        const relFile = path.relative(this.projectRoot, warning.file);
        console.log(chalk.yellow(`   ${relFile}:${warning.line}`));
        console.log(chalk.gray(`      ${warning.url}`));
        console.log(chalk.gray(`      ${warning.result.message || warning.result.code}`));
      }
    }

    // Show broken links
    if (this.results.broken.length > 0) {
      console.log('');
      console.log(chalk.red.bold('❌ Broken Links:'));
      for (const broken of this.results.broken) {
        const relFile = path.relative(this.projectRoot, broken.file);
        console.log(chalk.red(`   ${relFile}:${broken.line}`));
        console.log(chalk.white(`      [${broken.text}]`));
        console.log(chalk.gray(`      ${broken.url}`));
        if (broken.result.message) {
          console.log(chalk.gray(`      Error: ${broken.result.message}`));
        }
        if (broken.result.code) {
          console.log(chalk.gray(`      Status: ${broken.result.code}`));
        }
      }
    }

    // Summary
    console.log('');
    if (this.results.broken.length === 0) {
      console.log(chalk.green.bold('✅ All links valid!'));
    } else {
      console.log(chalk.red.bold(`❌ ${this.results.broken.length} broken link(s) found`));
    }
  }

  /**
   * Export results as JSON
   */
  exportResults() {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.total,
        valid: this.results.valid,
        broken: this.results.broken.length,
        warnings: this.results.warnings.length,
        skipped: this.results.skipped.length,
        cached: this.results.cached
      },
      broken: this.results.broken,
      warnings: this.results.warnings
    };
  }
}

module.exports = LinkChecker;

