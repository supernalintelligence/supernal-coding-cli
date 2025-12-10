/**
 * Research Link Checker
 * 
 * Validates links in research/awesome-list style markdown files.
 * Checks both external URLs and local file references.
 * 
 * Usage via CLI: sc research link-check [path]
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import chalk from 'chalk';

interface LinkCheckerOptions {
  timeout?: number;
  concurrency?: number;
  retries?: number;
  verbose?: boolean;
  checkExternal?: boolean;
  checkLocal?: boolean;
  includeBareUrls?: boolean;
  cacheFile?: string;
  cacheTTL?: number;
}

interface Link {
  url: string;
  text: string;
  line: number;
  file: string;
  type: string;
}

interface CheckResult {
  status: 'ok' | 'redirect' | 'broken' | 'error' | 'timeout' | 'warning' | 'skipped' | 'unknown';
  code?: number | string;
  message?: string;
  reason?: string;
  note?: string;
  tried?: string[];
}

interface CacheEntry {
  result: CheckResult;
  timestamp: number;
}

interface LinkWithResult extends Link {
  result: CheckResult;
  reason?: string;
}

interface Results {
  total: number;
  checked: number;
  valid: number;
  broken: LinkWithResult[];
  warnings: LinkWithResult[];
  skipped: LinkWithResult[];
  cached: number;
}

const LINK_PATTERNS = {
  markdown: /\[([^\]]*)\]\(([^)]+)\)/g,
  autoLink: /<(https?:\/\/[^>]+)>/g,
  bareUrl: /(?<!\()https?:\/\/[^\s<>)"']+/g
};

const SKIP_PATTERNS = [
  /^#/,
  /^mailto:/,
  /^javascript:/,
  /^data:/,
  /\{\{.*\}\}/,
  /\$\{.*\}/,
  /<.*>/,
];

const PROBLEMATIC_DOMAINS = [
  'linkedin.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'reddit.com',
];

class LinkChecker {
  protected cache: Record<string, CacheEntry>;
  protected currentFileDir: string | null;
  protected options: Required<LinkCheckerOptions>;
  protected projectRoot: string;
  protected results: Results;

  constructor(options: LinkCheckerOptions = {}) {
    this.options = {
      timeout: options.timeout || 10000,
      concurrency: options.concurrency || 5,
      retries: options.retries || 2,
      verbose: options.verbose || false,
      checkExternal: options.checkExternal !== false,
      checkLocal: options.checkLocal !== false,
      includeBareUrls: options.includeBareUrls || false,
      cacheFile: options.cacheFile || '.link-check-cache.json',
      cacheTTL: options.cacheTTL || 24 * 60 * 60 * 1000,
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
    
    this.projectRoot = this.findProjectRoot();
    this.cache = this.loadCache();
    this.currentFileDir = null;
  }

  findProjectRoot(): string {
    let dir = process.cwd();
    let maxDepth = 20;
    while (dir && dir !== path.dirname(dir) && maxDepth-- > 0) {
      if (fs.existsSync(path.join(dir, 'package.json')) || 
          fs.existsSync(path.join(dir, 'supernal.yaml'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return process.cwd() || '.';
  }

  loadCache(): Record<string, CacheEntry> {
    if (!this.projectRoot) {
      return {};
    }
    const cachePath = path.join(this.projectRoot, '.supernal', this.options.cacheFile);
    try {
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const now = Date.now();
        const valid: Record<string, CacheEntry> = {};
        for (const [url, entry] of Object.entries(data)) {
          if (now - (entry as CacheEntry).timestamp < this.options.cacheTTL) {
            valid[url] = entry as CacheEntry;
          }
        }
        return valid;
      }
    } catch (_error) {
      // Ignore cache errors
    }
    return {};
  }

  saveCache(): void {
    const cachePath = path.join(this.projectRoot, '.supernal', this.options.cacheFile);
    try {
      const dir = path.dirname(cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(cachePath, JSON.stringify(this.cache, null, 2));
    } catch (_error) {
      // Ignore cache save errors
    }
  }

  stripCodeBlocks(content: string): string {
    let stripped = content.replace(/```[\s\S]*?```/g, (match) => {
      return match.split('\n').map(() => '').join('\n');
    });
    
    stripped = stripped.replace(/`[^`]+`/g, (match) => {
      return ' '.repeat(match.length);
    });
    
    return stripped;
  }

  extractLinks(content: string, filePath: string): Link[] {
    const links: Link[] = [];
    const seenUrls = new Set<string>();
    
    const strippedContent = this.stripCodeBlocks(content);

    let match: RegExpExecArray | null;
    const markdownPattern = new RegExp(LINK_PATTERNS.markdown.source, 'g');
    while ((match = markdownPattern.exec(strippedContent)) !== null) {
      const [, text, url] = match;
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

    const autoLinkPattern = new RegExp(LINK_PATTERNS.autoLink.source, 'g');
    while ((match = autoLinkPattern.exec(strippedContent)) !== null) {
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

    if (this.options.includeBareUrls) {
      const bareUrlPattern = new RegExp(LINK_PATTERNS.bareUrl.source, 'g');
      while ((match = bareUrlPattern.exec(strippedContent)) !== null) {
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

  getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  shouldSkip(url: string): boolean {
    return SKIP_PATTERNS.some(pattern => pattern.test(url));
  }

  isProblematicDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return PROBLEMATIC_DOMAINS.some(domain => 
        urlObj.hostname.includes(domain)
      );
    } catch {
      return false;
    }
  }

  async checkUrl(url: string, retries: number = 0): Promise<CheckResult> {
    if (this.cache[url]) {
      this.results.cached++;
      return this.cache[url].result;
    }

    if (this.shouldSkip(url)) {
      return { status: 'skipped', reason: 'pattern-skip' };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return this.checkLocalFile(url);
    }

    if (!this.options.checkExternal) {
      return { status: 'skipped', reason: 'external-disabled' };
    }

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
        const result = this.interpretResponse(res.statusCode || 0, url);
        this.cacheResult(url, result);
        resolve(result);
      });

      req.on('error', async (error: NodeJS.ErrnoException) => {
        if (retries < this.options.retries && 
            (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
          const result = await this.checkUrl(url, retries + 1);
          resolve(result);
          return;
        }
        
        if (retries === 0) {
          const getResult = await this.checkUrlWithGet(url);
          resolve(getResult);
          return;
        }

        const result: CheckResult = {
          status: 'error',
          code: error.code,
          message: error.message
        };
        this.cacheResult(url, result);
        resolve(result);
      });

      req.on('timeout', () => {
        req.destroy();
        const result: CheckResult = { status: 'timeout', message: 'Request timed out' };
        this.cacheResult(url, result);
        resolve(result);
      });

      req.end();
    });
  }

  async checkUrlWithGet(url: string): Promise<CheckResult> {
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
          'Range': 'bytes=0-0'
        }
      };

      const req = protocol.request(options, (res) => {
        res.destroy();
        const result = this.interpretResponse(res.statusCode || 0, url);
        this.cacheResult(url, result);
        resolve(result);
      });

      req.on('error', (error: NodeJS.ErrnoException) => {
        const result: CheckResult = {
          status: 'error',
          code: error.code,
          message: error.message
        };
        this.cacheResult(url, result);
        resolve(result);
      });

      req.on('timeout', () => {
        req.destroy();
        const result: CheckResult = { status: 'timeout', message: 'Request timed out' };
        this.cacheResult(url, result);
        resolve(result);
      });

      req.end();
    });
  }

  interpretResponse(statusCode: number, _url: string): CheckResult {
    if (statusCode >= 200 && statusCode < 300) {
      return { status: 'ok', code: statusCode };
    }
    if (statusCode >= 300 && statusCode < 400) {
      return { status: 'redirect', code: statusCode };
    }
    if (statusCode === 403 || statusCode === 401) {
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

  cacheResult(url: string, result: CheckResult): void {
    this.cache[url] = {
      result,
      timestamp: Date.now()
    };
  }

  checkLocalFile(url: string): CheckResult {
    if (!this.options.checkLocal) {
      return { status: 'skipped', reason: 'local-disabled' };
    }

    const cleanUrl = url.split('#')[0];
    
    if (!cleanUrl) {
      return { status: 'ok', note: 'anchor-only' };
    }

    const resolvedPath = path.resolve(this.currentFileDir || this.projectRoot, cleanUrl);
    
    if (fs.existsSync(resolvedPath)) {
      return { status: 'ok' };
    }

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

  findMarkdownFiles(dirPath: string): string[] {
    const files: string[] = [];
    
    const walk = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', '.supernal', 'dist', 'build'].includes(entry.name)) {
              walk(fullPath);
            }
          } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (_error) {
        // Skip directories we can't read
      }
    };

    walk(dirPath);
    return files;
  }

  async checkFile(filePath: string): Promise<LinkWithResult[]> {
    const content = fs.readFileSync(filePath, 'utf8');
    const links = this.extractLinks(content, filePath);
    
    this.currentFileDir = path.dirname(filePath);
    
    const results: LinkWithResult[] = [];
    
    for (let i = 0; i < links.length; i += this.options.concurrency) {
      const batch = links.slice(i, i + this.options.concurrency);
      const batchResults = await Promise.all(
        batch.map(async (link) => {
          this.results.total++;
          
          if (this.shouldSkip(link.url)) {
            this.results.skipped.push({ ...link, result: { status: 'skipped' }, reason: 'pattern' });
            return { ...link, result: { status: 'skipped' } as CheckResult };
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
            this.results.skipped.push({ ...link, result, reason: result.reason });
          }
          
          return { ...link, result };
        })
      );
      results.push(...batchResults);
      
      if (this.options.verbose && i > 0 && i % 10 === 0) {
        process.stdout.write(chalk.gray(`.`));
      }
    }
    
    return results;
  }

  async run(targetPath?: string): Promise<{ success: boolean; results: Results; error?: string }> {
    const startTime = Date.now();
    
    const checkPath = targetPath || 
      path.join(this.projectRoot, 'packages', 'awesome-ai-development');
    
    const resolvedPath = path.resolve(process.cwd(), checkPath);
    
    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red(`Path not found: ${resolvedPath}`));
      return { success: false, error: 'Path not found', results: this.results };
    }

    console.log(chalk.bold('\n🔍 Research Link Checker'));
    console.log(chalk.gray(`   Path: ${resolvedPath}`));
    console.log('');

    let files: string[];
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

    for (const file of files) {
      const relPath = path.relative(this.projectRoot, file);
      if (this.options.verbose) {
        console.log(chalk.cyan(`Checking: ${relPath}`));
      }
      await this.checkFile(file);
    }

    this.saveCache();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    this.printReport(duration);

    return {
      success: this.results.broken.length === 0,
      results: this.results
    };
  }

  printReport(duration: string): void {
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

    console.log('');
    if (this.results.broken.length === 0) {
      console.log(chalk.green.bold('✅ All links valid!'));
    } else {
      console.log(chalk.red.bold(`❌ ${this.results.broken.length} broken link(s) found`));
    }
  }

  exportResults(): {
    timestamp: string;
    summary: {
      total: number;
      valid: number;
      broken: number;
      warnings: number;
      skipped: number;
      cached: number;
    };
    broken: LinkWithResult[];
    warnings: LinkWithResult[];
  } {
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

export default LinkChecker;
module.exports = LinkChecker;
