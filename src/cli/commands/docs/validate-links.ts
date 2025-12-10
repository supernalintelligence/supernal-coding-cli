#!/usr/bin/env node
// @ts-nocheck

/**
 * Markdown Link Validator and Fixer
 *
 * Validates and fixes broken relative markdown links across documentation.
 * Features:
 * - Finds broken relative links
 * - Searches for moved files
 * - Auto-updates referencing documents
 * - Handles file reorganizations
 *
 * Usage:
 *   sc docs links                      # Check all links
 *   sc docs links --fix                # Fix broken links
 *   sc docs links --dry-run            # Show what would be fixed
 *   sc docs links --file <path>        # Check specific file
 *   sc docs links --full-report        # Write full report to file
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

class LinkChecker {
  brokenLinks: any;
  fileCache: any;
  fixedLinks: any;
  linkPattern: any;
  options: any;
  projectRoot: any;
  constructor(options = {}) {
    this.options = options;
    this.projectRoot = process.cwd();
    this.brokenLinks = [];
    this.fixedLinks = [];
    this.fileCache = new Map(); // Cache for file locations
    this.linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  }

  /**
   * Main execution function
   */
  async run() {
    console.log('🔗 Markdown Link Validator\n');

    if (this.options.file) {
      await this.checkFile(this.options.file);
    } else {
      await this.checkAllFiles();
    }

    // Build file index for categorization (even if not fixing)
    if (this.brokenLinks.length > 0) {
      await this.buildFileIndex();
    }

    this.generateReport();

    // Write full report to file if requested
    if (this.options.fullReport && this.brokenLinks.length > 0) {
      await this.writeFullReport();
    }

    if (this.options.fix && this.brokenLinks.length > 0) {
      await this.fixBrokenLinks();
    }

    return {
      total: this.brokenLinks.length,
      fixed: this.fixedLinks.length,
      brokenLinks: this.brokenLinks,
      fixedLinks: this.fixedLinks,
    };
  }

  /**
   * Check all markdown files in project
   */
  async checkAllFiles() {
    // Check all markdown files in the entire project
    const files = this.findMarkdownFiles(this.projectRoot);

    console.log(`📁 Found ${files.length} markdown files to check\n`);

    for (const file of files) {
      await this.checkFile(file);
    }
  }

  /**
   * Find all markdown files recursively
   */
  findMarkdownFiles(dir) {
    const files = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules, .git, archive, deprecated, temp, build artifacts, and submodules
        if (
          ![
            'node_modules',
            '.git',
            'archive',
            'deprecated',
            'temp',
            'dist',
            'build',
            'public',
            '.next',
            'out',
            'hydra-config',
          ].includes(item)
        ) {
          files.push(...this.findMarkdownFiles(fullPath));
        }
      } else if (item.endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if a position is inside a code block
   */
  isInCodeBlock(content, position) {
    // Get content up to this position
    const beforeMatch = content.substring(0, position);

    // Count code fence markers (```)
    const codeFences = beforeMatch.match(/```/g);

    // If odd number of fences, we're inside a code block
    if (codeFences && codeFences.length % 2 === 1) {
      return true;
    }

    // Check if inside inline code (backticks)
    // Get a reasonable window around the match position
    const windowStart = Math.max(0, position - 200);
    const windowEnd = Math.min(content.length, position + 200);
    const window = content.substring(windowStart, windowEnd);
    const posInWindow = position - windowStart;

    // Find all backticks in the window
    const backtickPositions = [];
    for (let i = 0; i < window.length; i++) {
      if (window[i] === '`') {
        backtickPositions.push(i);
      }
    }

    // Check if we're between a pair of backticks
    let _beforeCount = 0;
    let _afterCount = 0;
    let lastBeforePos = -1;
    let firstAfterPos = -1;

    for (const pos of backtickPositions) {
      if (pos < posInWindow) {
        _beforeCount++;
        lastBeforePos = pos;
      } else if (pos > posInWindow) {
        if (firstAfterPos === -1) {
          firstAfterPos = pos;
        }
        _afterCount++;
      }
    }

    // If there's a backtick immediately before and after, we're in inline code
    if (lastBeforePos !== -1 && firstAfterPos !== -1) {
      const textBetween = window.substring(lastBeforePos + 1, firstAfterPos);
      const matchInBetween =
        posInWindow > lastBeforePos && posInWindow < firstAfterPos;

      // Check if the match is actually between these backticks
      // and there's no newline (inline code doesn't span lines)
      if (matchInBetween && !textBetween.includes('\n')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check links in a single file
   */
  async checkFile(filePath) {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);

    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const fileDir = path.dirname(absolutePath);

    // Find all markdown links
    const links = [...content.matchAll(this.linkPattern)];

    for (const match of links) {
      const [fullMatch, linkText, linkPath] = match;

      // Skip links inside code blocks or inline code
      if (this.isInCodeBlock(content, match.index)) {
        continue;
      }

      // Also check if the entire match is wrapped in backticks (inline code)
      const beforeChar = match.index > 0 ? content[match.index - 1] : '';
      const afterChar =
        match.index + fullMatch.length < content.length
          ? content[match.index + fullMatch.length]
          : '';
      if (beforeChar === '`' && afterChar === '`') {
        continue; // Skip inline code like `[text](link)`
      }

      // Skip external links (http, https, mailto, etc.)
      if (this.isExternalLink(linkPath)) {
        continue;
      }

      // Skip anchor links (#heading)
      if (linkPath.startsWith('#')) {
        continue;
      }

      // Check if link is broken
      const targetPath = this.resolveLink(linkPath, fileDir);

      // Accept if target exists (file or directory)
      if (!fs.existsSync(targetPath)) {
        this.brokenLinks.push({
          sourceFile: absolutePath,
          relativePath: path.relative(this.projectRoot, absolutePath),
          linkText,
          linkPath,
          targetPath,
          fullMatch,
        });
      } else {
        // Check if it's a directory without index.md (warn but don't break)
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
          const hasIndex =
            fs.existsSync(path.join(targetPath, 'index.md')) ||
            fs.existsSync(path.join(targetPath, 'README.md'));
          if (!hasIndex && !linkPath.endsWith('/')) {
            // Directory link without index - not broken but could be clearer
            // Don't add to brokenLinks, just note it
          }
        }
      }
    }
  }

  /**
   * Check if link is external
   */
  isExternalLink(linkPath) {
    return (
      linkPath.startsWith('http://') ||
      linkPath.startsWith('https://') ||
      linkPath.startsWith('mailto:') ||
      linkPath.startsWith('ftp://') ||
      linkPath.startsWith('//') // Protocol-relative URLs
    );
  }

  /**
   * Resolve relative link to absolute path
   * Handles Docusaurus-style extensionless links (./page instead of ./page.md)
   */
  resolveLink(linkPath, sourceDir) {
    // Handle anchor fragments
    const [pathPart] = linkPath.split('#');

    // Resolve relative to source file directory
    const resolved = path.resolve(sourceDir, pathPart);

    // If file doesn't exist, try adding .md extension (Docusaurus convention)
    if (!fs.existsSync(resolved)) {
      // Try with .md extension
      const withExtension = `${resolved}.md`;
      if (fs.existsSync(withExtension)) {
        return withExtension;
      }

      // Try treating as directory with index.md
      const asIndexMd = path.join(resolved, 'index.md');
      if (fs.existsSync(asIndexMd)) {
        return asIndexMd;
      }
    }

    return resolved;
  }

  /**
   * Fix broken links
   */
  async fixBrokenLinks() {
    console.log(
      `\n🔧 Attempting to fix ${this.brokenLinks.length} broken links...\n`
    );

    // Build file index for quick lookups
    await this.buildFileIndex();

    for (const brokenLink of this.brokenLinks) {
      const newPath = await this.findCorrectPath(brokenLink);

      if (newPath) {
        await this.updateLink(brokenLink, newPath);
      }
    }

    if (this.fixedLinks.length > 0) {
      console.log(`\n✅ Fixed ${this.fixedLinks.length} links`);

      // Generate git commit suggestion
      if (!this.options.dryRun) {
        this.generateGitCommitSuggestion();
      }
    }

    const stillBroken = this.brokenLinks.length - this.fixedLinks.length;
    if (stillBroken > 0) {
      console.log(
        `\n⚠️  ${stillBroken} links could not be automatically fixed`
      );
      this.summarizeUnfixableLinks();
    }
  }

  /**
   * Summarize links that couldn't be fixed
   */
  summarizeUnfixableLinks() {
    console.log(`\n${'='.repeat(70)}`);
    console.log('📊 BROKEN LINKS BY CATEGORY');
    console.log(`${'='.repeat(70)}\n`);

    const unfixable = this.brokenLinks.filter(
      (broken) =>
        !this.fixedLinks.some(
          (fixed) =>
            fixed.sourceFile === broken.sourceFile &&
            fixed.linkPath === broken.linkPath
        )
    );

    // Categorize broken links
    const categories = {
      deprecated: [],
      archived: [],
      missing: [],
    };

    for (const link of unfixable) {
      const targetLower = link.targetPath.toLowerCase();

      if (targetLower.includes('/deprecated/')) {
        categories.deprecated.push(link);
      } else if (targetLower.includes('/archive/')) {
        categories.archived.push(link);
      } else {
        categories.missing.push(link);
      }
    }

    // Show deprecated links
    if (categories.deprecated.length > 0) {
      console.log(
        `📁 Links to DEPRECATED files (${categories.deprecated.length}):`
      );
      console.log(
        '   These files are deprecated and should not be referenced.\n'
      );

      const files = new Set(categories.deprecated.map((l) => l.relativePath));
      for (const file of files) {
        const count = categories.deprecated.filter(
          (l) => l.relativePath === file
        ).length;
        console.log(`   ${file} (${count} link${count > 1 ? 's' : ''})`);
      }

      console.log('\n   💡 Recommended Action:');
      console.log(
        '      1. Review each file and remove or update deprecated references'
      );
      console.log('      2. Add deprecation notices if keeping the links\n');
    }

    // Show archived links
    if (categories.archived.length > 0) {
      console.log(
        `📦 Links to ARCHIVED files (${categories.archived.length}):`
      );
      console.log('   These files are archived and probably outdated.\n');

      const files = new Set(categories.archived.map((l) => l.relativePath));
      for (const file of files) {
        const count = categories.archived.filter(
          (l) => l.relativePath === file
        ).length;
        console.log(`   ${file} (${count} link${count > 1 ? 's' : ''})`);
      }

      console.log('\n   💡 Recommended Action:');
      console.log('      1. Review and remove references to archived content');
      console.log('      2. Point to replacement documentation if available\n');
    }

    // Show missing files
    if (categories.missing.length > 0) {
      console.log(`❓ Links to MISSING files (${categories.missing.length}):`);
      console.log("   These files don't exist anywhere in the project.\n");

      // Group by target file
      const byTarget = new Map();
      for (const link of categories.missing) {
        const target = path.basename(link.linkPath.split('#')[0]);
        if (!byTarget.has(target)) {
          byTarget.set(target, { sources: new Set() });
        }
        byTarget.get(target).sources.add(link.relativePath);
      }

      // Show up to 15 missing files
      let shown = 0;
      for (const [target, data] of byTarget) {
        if (shown >= 15) break;
        console.log(`   "${target}"`);
        const sources = Array.from(data.sources);
        for (const source of sources.slice(0, 3)) {
          console.log(`      → ${source}`);
        }
        if (sources.length > 3) {
          console.log(`      ... and ${sources.length - 3} more files`);
        }
        console.log('');
        shown++;
      }

      if (byTarget.size > 15) {
        console.log(`   ... and ${byTarget.size - 15} more missing files\n`);
      }

      console.log('   💡 Recommended Action:');
      console.log('      1. Remove stale references');
      console.log("      2. Create missing files if they're actually needed");
      console.log('      3. Update links to point to correct locations\n');
    }

    console.log(`${'='.repeat(70)}\n`);

    console.log('💡 Manual Review Required:');
    console.log('   These links need human judgment to fix properly.');
    console.log('   Review each file and decide whether to:');
    console.log('   - Remove the broken link');
    console.log('   - Add a deprecation/archive notice');
    console.log('   - Point to replacement content\n');
  }

  /**
   * Write full report to file
   */
  async writeFullReport() {
    const reportPath = path.join(
      this.projectRoot,
      '.supernal',
      'reports',
      'BROKEN_LINKS_REPORT.md'
    );

    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    let report = '# Broken Links Report\n\n';
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Total**: ${this.brokenLinks.length}\n\n`;

    // Group by source file
    const byFile = new Map();
    for (const link of this.brokenLinks) {
      if (!byFile.has(link.relativePath)) {
        byFile.set(link.relativePath, []);
      }
      byFile.get(link.relativePath).push(link);
    }

    // Sort files alphabetically
    const sortedFiles = Array.from(byFile.keys()).sort();

    for (const file of sortedFiles) {
      const links = byFile.get(file);
      // Create relative path from report to source file
      const relPath = path.relative(
        reportDir,
        path.join(this.projectRoot, file)
      );
      report += `## [${file}](${relPath})\n\n`;

      for (const link of links) {
        report += `- \`${link.linkPath}\`\n`;
      }

      report += '\n';
    }

    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(
      `\n📄 Full report written to: ${path.relative(this.projectRoot, reportPath)}\n`
    );
  }

  /**
   * Generate git commit suggestion for fixed files
   */
  generateGitCommitSuggestion() {
    console.log('\n📝 Git Commit Suggestion:');
    console.log('========================\n');

    // Get unique files that were modified
    const modifiedFiles = [
      ...new Set(this.fixedLinks.map((link) => link.relativePath)),
    ];

    console.log(
      `Fixed broken links in ${modifiedFiles.length} file${modifiedFiles.length > 1 ? 's' : ''}:\n`
    );

    // Generate git add commands
    console.log('# Stage the fixed files:');
    for (const file of modifiedFiles) {
      console.log(`git add "${file}"`);
    }

    console.log('\n# Or stage all at once:');
    console.log(`git add ${modifiedFiles.map((f) => `"${f}"`).join(' ')}`);

    // Generate commit message
    const linkCount = this.fixedLinks.length;
    const fileCount = modifiedFiles.length;

    console.log('\n# Commit with message:');
    console.log(`git commit -m "docs: fix ${linkCount} broken markdown link${linkCount > 1 ? 's' : ''} across ${fileCount} file${fileCount > 1 ? 's' : ''}

- Validated and fixed broken relative links
- Updated paths to reflect current file locations
- Fixed via sc validate-links --fix"`);

    console.log('\n');
  }

  /**
   * Build index of all files in project
   */
  async buildFileIndex() {
    console.log('📇 Building file index...');

    // Index all markdown files in the project
    const files = this.findMarkdownFiles(this.projectRoot).filter(
      (f) =>
        !f.includes('BROKEN_LINKS_REPORT.md') && !f.includes('node_modules')
    );

    for (const file of files) {
      const basename = path.basename(file);
      const relativePath = path.relative(this.projectRoot, file);

      if (!this.fileCache.has(basename)) {
        this.fileCache.set(basename, []);
      }

      this.fileCache.get(basename).push({
        absolute: file,
        relative: relativePath,
      });
    }

    console.log(`   Found ${files.length} files in index\n`);
  }

  /**
   * Find correct path for moved file
   */
  async findCorrectPath(brokenLink) {
    // Extract filename from link path, handling extensionless links
    const targetFilename = path.basename(brokenLink.linkPath.split('#')[0]);

    // Try exact match first
    let candidates = this.fileCache.get(targetFilename) || [];

    // If no match and no extension, try adding .md (Docusaurus convention)
    if (candidates.length === 0 && !path.extname(targetFilename)) {
      const withExtension = `${targetFilename}.md`;
      candidates = this.fileCache.get(withExtension) || [];
    }

    // NEW: Try case-insensitive match (INDEX.md vs index.md)
    if (candidates.length === 0) {
      const lowerTarget = targetFilename.toLowerCase();
      for (const [filename, files] of this.fileCache.entries()) {
        if (filename.toLowerCase() === lowerTarget) {
          candidates = files;
          break;
        }
      }
    }

    // Try prefix matching for abbreviated filenames with similarity scoring
    // e.g., "comp-fda-001-csv.md" should match "comp-fda-001-computer-system-validation.md"
    // e.g., "req-020-medical-csv" should match "req-infra-020-medical-csv-compliance-system.md"
    if (candidates.length === 0) {
      const baseWithoutExt = path.parse(targetFilename).name;
      const parts = baseWithoutExt.split('-');

      // Try intelligent matching based on filename structure
      if (parts.length >= 3) {
        let bestMatch = null;
        let bestScore = 0;

        for (const [filename, files] of this.fileCache.entries()) {
          const candidateBase = path.parse(filename).name;
          const candidateParts = candidateBase.split('-');

          let score = 0;

          // Special handling for requirements: req-020-X → req-infra-020-X
          if (parts[0] === 'req' && candidateParts[0] === 'req') {
            const sourceNum = parts.find((p) => /^\d+$/.test(p));
            const candidateNum = candidateParts.find((p) => /^\d+$/.test(p));

            // Must have matching number
            if (sourceNum !== candidateNum) continue;

            // Get parts after the number
            const sourceNumIdx = parts.indexOf(sourceNum);
            const candidateNumIdx = candidateParts.indexOf(candidateNum);
            const sourceRest = parts.slice(sourceNumIdx + 1);
            const candidateRest = candidateParts.slice(candidateNumIdx + 1);

            // Check how many parts match after the number
            let matchingParts = 0;
            for (let i = 0; i < sourceRest.length; i++) {
              if (candidateRest[i] === sourceRest[i]) {
                matchingParts++;
              } else {
                break;
              }
            }

            // Score based on matching parts after number
            if (matchingParts > 0) {
              score = matchingParts / sourceRest.length;
            }
          } else {
            // Standard prefix matching for comp-*, feat-*, etc.
            const prefix = parts.slice(0, 3).join('-');
            if (candidateBase.startsWith(`${prefix}-`)) {
              let matchingParts = 0;
              for (let i = 0; i < parts.length; i++) {
                if (
                  i < candidateParts.length &&
                  parts[i] === candidateParts[i]
                ) {
                  matchingParts++;
                } else {
                  break;
                }
              }
              score = matchingParts / parts.length;
            }
          }

          // Keep best match
          if (score > bestScore) {
            bestScore = score;
            bestMatch = files;
          }
        }

        // Use best match if score is decent (>50% similarity)
        if (bestScore > 0.5 && bestMatch) {
          candidates = bestMatch;
        }
      }
    }

    // Also try matching by path pattern, not just filename
    if (candidates.length === 0) {
      // Extract path segments from broken link
      const linkSegments = brokenLink.linkPath
        .split('/')
        .filter((s) => s && s !== '.');

      // Search for files matching the path pattern
      for (const [filename, files] of this.fileCache.entries()) {
        if (
          filename === targetFilename ||
          filename === `${targetFilename}.md`
        ) {
          candidates = files;
          break;
        }

        // Match if the link path segments appear in the candidate path
        for (const file of files) {
          const fileSegments = file.relative.split('/');
          const matchesPattern = linkSegments.every(
            (seg) =>
              fileSegments.includes(seg) || fileSegments.includes(`${seg}.md`)
          );

          if (matchesPattern && !candidates.includes(file)) {
            candidates.push(file);
          }
        }
      }
    }

    // 4. Try git log to find renames
    if (candidates.length === 0) {
      const gitRename = this.findGitRename(targetFilename);
      if (gitRename) {
        const gitFiles = this.fileCache.get(path.basename(gitRename));
        if (gitFiles && gitFiles.length > 0) {
          candidates = gitFiles;
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    if (candidates.length === 1) {
      // Only one candidate - use it
      return candidates[0].absolute;
    }

    // Multiple candidates - use heuristics to pick best match
    return this.chooseBestCandidate(brokenLink, candidates);
  }

  /**
   * Choose best candidate when multiple files match
   */
  chooseBestCandidate(brokenLink, candidates) {
    const sourceDir = path.dirname(brokenLink.sourceFile);
    const originalPath = brokenLink.linkPath;

    // Calculate similarity scores
    const scored = candidates.map((candidate) => {
      let score = 0;

      // Prefer files in similar directory structure
      const relativeDist = this.calculatePathDistance(
        sourceDir,
        candidate.absolute
      );
      score += 10 / (relativeDist + 1);

      // Prefer paths that match original path segments
      const originalSegments = originalPath
        .split('/')
        .filter((s) => s && s !== '..');
      const candidateSegments = candidate.relative.split('/');

      for (const segment of originalSegments) {
        if (candidateSegments.includes(segment)) {
          score += 5;
        }
      }

      return { candidate, score };
    });

    // Sort by score and return best match
    scored.sort((a, b) => b.score - a.score);
    return scored[0].candidate.absolute;
  }

  /**
   * Calculate path distance between two paths
   */
  calculatePathDistance(path1, path2) {
    const rel = path.relative(path1, path2);
    const segments = rel.split(path.sep);
    return segments.filter((s) => s === '..').length;
  }

  /**
   * Update link in source file
   */
  async updateLink(brokenLink, newTargetPath) {
    const sourceFile = brokenLink.sourceFile;
    const sourceDir = path.dirname(sourceFile);

    // Calculate new relative path from source file to target
    let newRelativePath = path.relative(sourceDir, newTargetPath);

    // Ensure forward slashes for markdown (cross-platform compatibility)
    newRelativePath = newRelativePath.split(path.sep).join('/');

    // Ensure relative paths start with ./ or ../
    if (
      !newRelativePath.startsWith('../') &&
      !newRelativePath.startsWith('./')
    ) {
      newRelativePath = `./${newRelativePath}`;
    }

    // Preserve anchor if present
    const anchorMatch = brokenLink.linkPath.match(/#(.+)$/);
    if (anchorMatch) {
      newRelativePath += `#${anchorMatch[1]}`;
    }

    if (this.options.dryRun) {
      console.log(`🔸 Would fix in ${brokenLink.relativePath}:`);
      console.log(`   FROM: ${brokenLink.linkPath}`);
      console.log(`   TO:   ${newRelativePath}`);
      this.fixedLinks.push({
        ...brokenLink,
        newPath: newRelativePath,
      });
      return;
    }

    // Read file content
    let content = fs.readFileSync(sourceFile, 'utf8');

    // Replace the broken link
    const newMatch = `[${brokenLink.linkText}](${newRelativePath})`;
    content = content.replace(brokenLink.fullMatch, newMatch);

    // Write updated content
    fs.writeFileSync(sourceFile, content, 'utf8');

    console.log(`✅ Fixed in ${brokenLink.relativePath}:`);
    console.log(`   FROM: ${brokenLink.linkPath}`);
    console.log(`   TO:   ${newRelativePath}`);

    this.fixedLinks.push({
      ...brokenLink,
      newPath: newRelativePath,
    });
  }

  /**
   * Generate report of findings
   */
  generateReport() {
    console.log('\n📊 LINK VALIDATION REPORT');
    console.log('=========================\n');

    if (this.brokenLinks.length === 0) {
      console.log('✅ No broken links found! All links are valid.\n');
      return;
    }

    console.log(`Found ${this.brokenLinks.length} broken links:\n`);

    // Show full report path if there are broken links
    const reportPath = path.join(
      this.projectRoot,
      '.supernal',
      'reports',
      'BROKEN_LINKS_REPORT.md'
    );
    console.log(`💡 Run with --full-report to write complete list to:`);
    console.log(`   ${path.relative(this.projectRoot, reportPath)}\n`);

    // Show categorized summary
    this.showCategorizedBreakdown();
  }

  /**
   * Find renamed files via git log
   */
  findGitRename(oldFilename) {
    try {
      const { execSync } = require('node:child_process');
      const result = execSync(
        `git log --follow --name-status --diff-filter=R --pretty=format:"" -- "*/${oldFilename}" 2>/dev/null | grep -E "^R" | head -1`,
        {
          cwd: this.projectRoot,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        }
      ).trim();

      if (result) {
        // Format: R100	old/path/file.md	new/path/file.md
        const parts = result.split(/\s+/);
        if (parts.length >= 3) {
          return parts[2]; // Return new path
        }
      }
    } catch (_err) {
      // Git not available or no renames found
    }
    return null;
  }

  /**
   * Show categorized breakdown of broken links
   */
  showCategorizedBreakdown() {
    // Categorize broken links
    const categories = {
      deprecated: [],
      archived: [],
      missing: [],
      multipleCandidates: [],
      canAutoFix: [],
    };

    for (const link of this.brokenLinks) {
      const targetLower = link.targetPath.toLowerCase();
      const linkPath = link.linkPath.split('#')[0];
      let targetFilename = path.basename(linkPath);

      // Try to add .md if no extension
      if (!path.extname(targetFilename)) {
        targetFilename += '.md';
      }

      if (targetLower.includes('/deprecated/')) {
        categories.deprecated.push(link);
      } else if (targetLower.includes('/archive/')) {
        categories.archived.push(link);
      } else {
        const candidates = this.fileCache.get(targetFilename) || [];
        if (candidates.length > 1) {
          // Multiple candidates found - ambiguous
          categories.multipleCandidates.push({ link, candidates });
        } else if (candidates.length === 1) {
          // Single candidate - can auto-fix
          categories.canAutoFix.push(link);
        } else {
          // No candidates - truly missing
          categories.missing.push(link);
        }
      }
    }

    console.log('='.repeat(70));
    console.log('📊 BROKEN LINKS BY CATEGORY');
    console.log(`${'='.repeat(70)}\n`);

    // Show multiple candidates first (new category)
    if (categories.multipleCandidates.length > 0) {
      console.log(
        `🔀 Links with MULTIPLE CANDIDATES (${categories.multipleCandidates.length}):`
      );
      console.log('   These files exist in multiple locations.\n');

      // Group by target filename
      const byTarget = new Map();
      for (const { link, candidates } of categories.multipleCandidates) {
        const target = path.basename(link.linkPath.split('#')[0]);
        if (!byTarget.has(target)) {
          byTarget.set(target, {
            sources: new Set(),
            candidatePaths: new Set(),
          });
        }
        byTarget.get(target).sources.add(link.relativePath);
        candidates.forEach((c) =>
          byTarget.get(target).candidatePaths.add(c.relative)
        );
      }

      // Show up to 10 ambiguous files
      let shown = 0;
      for (const [target, data] of byTarget) {
        if (shown >= 10) break;
        console.log(
          `   "${target}" (${data.candidatePaths.size} copies found):`
        );
        const paths = Array.from(data.candidatePaths);
        for (const candPath of paths.slice(0, 4)) {
          console.log(`      ✓ ${candPath}`);
        }
        if (paths.length > 4) {
          console.log(`      ... and ${paths.length - 4} more`);
        }
        console.log(`      Referenced by:`);
        const sources = Array.from(data.sources);
        for (const source of sources.slice(0, 2)) {
          console.log(`      → ${source}`);
        }
        if (sources.length > 2) {
          console.log(`      ... and ${sources.length - 2} more files`);
        }
        console.log('');
        shown++;
      }

      if (byTarget.size > 10) {
        console.log(`   ... and ${byTarget.size - 10} more ambiguous files\n`);
      }

      console.log('   💡 Recommended Action:');
      console.log(
        '      1. Consolidate duplicates - keep one canonical version'
      );
      console.log('      2. Update references to use the canonical path');
      console.log('      3. Move duplicates to archive/\n');
    }

    // Show deprecated links
    if (categories.deprecated.length > 0) {
      console.log(
        `📁 Links to DEPRECATED files (${categories.deprecated.length}):`
      );
      console.log(
        '   These files are deprecated and should not be referenced.\n'
      );

      const files = new Set(categories.deprecated.map((l) => l.relativePath));
      for (const file of files) {
        const count = categories.deprecated.filter(
          (l) => l.relativePath === file
        ).length;
        console.log(`   ${file} (${count} link${count > 1 ? 's' : ''})`);
      }

      console.log('\n   💡 Recommended Action:');
      console.log(
        '      1. Review each file and remove or update deprecated references'
      );
      console.log('      2. Add deprecation notices if keeping the links\n');
    }

    // Show archived links
    if (categories.archived.length > 0) {
      console.log(
        `📦 Links to ARCHIVED files (${categories.archived.length}):`
      );
      console.log('   These files are archived and probably outdated.\n');

      const files = new Set(categories.archived.map((l) => l.relativePath));
      for (const file of files) {
        const count = categories.archived.filter(
          (l) => l.relativePath === file
        ).length;
        console.log(`   ${file} (${count} link${count > 1 ? 's' : ''})`);
      }

      console.log('\n   💡 Recommended Action:');
      console.log('      1. Review and remove references to archived content');
      console.log('      2. Point to replacement documentation if available\n');
    }

    // Show missing files
    if (categories.missing.length > 0) {
      console.log(`❓ Links to MISSING files (${categories.missing.length}):`);
      console.log("   These files don't exist anywhere in the project.\n");

      // Group by target file
      const byTarget = new Map();
      for (const link of categories.missing) {
        const target = path.basename(link.linkPath.split('#')[0]);
        if (!byTarget.has(target)) {
          byTarget.set(target, { sources: new Set() });
        }
        byTarget.get(target).sources.add(link.relativePath);
      }

      // Show up to 15 missing files
      let shown = 0;
      for (const [target, data] of byTarget) {
        if (shown >= 15) break;
        console.log(`   "${target}"`);
        const sources = Array.from(data.sources);
        for (const source of sources.slice(0, 3)) {
          console.log(`      → ${source}`);
        }
        if (sources.length > 3) {
          console.log(`      ... and ${sources.length - 3} more files`);
        }
        console.log('');
        shown++;
      }

      if (byTarget.size > 15) {
        console.log(`   ... and ${byTarget.size - 15} more missing files\n`);
      }

      console.log('   💡 Recommended Action:');
      console.log('      1. Remove stale references');
      console.log("      2. Create missing files if they're actually needed");
      console.log('      3. Update links to point to correct locations\n');
    }

    // Show auto-fixable links
    if (categories.canAutoFix.length > 0) {
      console.log(
        `✅ Links that CAN be auto-fixed (${categories.canAutoFix.length}):`
      );
      console.log('   These files exist but have wrong relative paths.\n');

      const files = new Set(categories.canAutoFix.map((l) => l.relativePath));
      for (const file of Array.from(files).slice(0, 10)) {
        const count = categories.canAutoFix.filter(
          (l) => l.relativePath === file
        ).length;
        console.log(`   ${file} (${count} link${count > 1 ? 's' : ''})`);
      }

      if (files.size > 10) {
        console.log(`   ... and ${files.size - 10} more files\n`);
      } else {
        console.log('');
      }

      console.log('   💡 Command to auto-fix these:');
      console.log('      sc docs links --fix\n');
      console.log('   💡 Preview changes first:');
      console.log('      sc docs links --fix --dry-run\n');
    }

    console.log(`${'='.repeat(70)}\n`);

    console.log('💡 Manual Review Required:');
    console.log(
      '   Links to deprecated/archived/missing files need human judgment.'
    );
    console.log('   Review each file and decide whether to:');
    console.log('   - Remove the broken link');
    console.log('   - Add a deprecation/archive notice');
    console.log('   - Point to replacement content\n');
  }

  /**
   * Parse path@version reference
   */
  parseReference(ref) {
    if (typeof ref === 'object' && ref.ref) {
      ref = ref.ref;
    }

    if (typeof ref !== 'string') {
      return { path: null, version: null };
    }

    const atIndex = ref.lastIndexOf('@');
    if (atIndex === -1) {
      return { path: ref, version: null };
    }

    const refPath = ref.substring(0, atIndex);
    const version = ref.substring(atIndex + 1);

    return { path: refPath, version };
  }

  /**
   * Validate a single reference
   */
  async validateReference(ref, docDir) {
    const { path: refPath, version: expectedVersion } =
      this.parseReference(ref);

    if (!refPath) {
      return { valid: false, error: 'Invalid reference format' };
    }

    // Check file exists
    const absolutePath = path.resolve(docDir, refPath);
    if (!fs.existsSync(absolutePath)) {
      return {
        valid: false,
        error: 'File not found',
        path: refPath,
      };
    }

    // Check version if specified
    if (expectedVersion) {
      try {
        const content = fs.readFileSync(absolutePath, 'utf8');
        const fm = this.parseFrontmatter(content);

        if (!fm.version) {
          return {
            valid: false,
            warning: 'Target file has no version',
            path: refPath,
            expected: expectedVersion,
          };
        }

        if (fm.version !== expectedVersion) {
          return {
            valid: false,
            warning: 'Version mismatch',
            path: refPath,
            expected: expectedVersion,
            current: fm.version,
            severity: this.calculateVersionSeverity(
              expectedVersion,
              fm.version
            ),
          };
        }
      } catch (error) {
        return {
          valid: false,
          error: 'Failed to read target file',
          path: refPath,
          details: error.message,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Parse frontmatter from content
   */
  parseFrontmatter(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return {};

    const yaml = match[1];
    const fm = {};

    // Simple YAML parser for our needs
    const lines = yaml.split('\n');
    let _currentKey = null;
    let currentArray = null;

    for (const line of lines) {
      if (line.trim().startsWith('-')) {
        // Array item
        if (currentArray) {
          const value = line.trim().substring(1).trim();
          currentArray.push(value);
        }
      } else if (line.includes(':')) {
        // Key-value pair
        const colonIndex = line.indexOf(':');
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        if (value === '') {
          // Start of array
          _currentKey = key;
          currentArray = [];
          fm[key] = currentArray;
        } else {
          // Simple value
          fm[key] = value;
          _currentKey = null;
          currentArray = null;
        }
      }
    }

    return fm;
  }

  /**
   * Calculate version severity
   */
  calculateVersionSeverity(expected, current) {
    const parseVersion = (v) => {
      const parts = v.split('.').map(Number);
      return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0,
      };
    };

    const exp = parseVersion(expected);
    const cur = parseVersion(current);

    if (cur.major > exp.major) return 'major_upgrade';
    if (cur.major < exp.major) return 'major_downgrade';
    if (cur.minor > exp.minor) return 'minor_upgrade';
    if (cur.minor < exp.minor) return 'minor_downgrade';
    if (cur.patch > exp.patch) return 'patch_upgrade';
    if (cur.patch < exp.patch) return 'patch_downgrade';
    return 'match';
  }

  /**
   * Get document layer for dependency direction checking
   */
  getDocumentLayer(filePath) {
    if (filePath.includes('/compliance/')) return 'compliance';
    if (filePath.includes('/requirements/')) return 'requirements';
    if (filePath.includes('/architecture/')) return 'architecture';
    if (filePath.includes('/guides/') || filePath.includes('/docs/'))
      return 'guides';
    return null;
  }

  /**
   * Check dependency direction
   */
  checkDependencyDirection(sourceFile, dependencies) {
    const DOCUMENT_LAYERS = {
      compliance: 0,
      requirements: 1,
      architecture: 2,
      guides: 3,
    };

    const sourceLayer = this.getDocumentLayer(sourceFile);
    if (!sourceLayer) return [];

    const errors = [];

    for (const dep of dependencies) {
      const { path: depPath } = this.parseReference(dep);
      if (!depPath) continue;

      const absolutePath = path.resolve(path.dirname(sourceFile), depPath);
      const targetLayer = this.getDocumentLayer(absolutePath);

      if (!targetLayer) continue;

      const sourceLevel = DOCUMENT_LAYERS[sourceLayer];
      const targetLevel = DOCUMENT_LAYERS[targetLayer];

      // Check if violating dependency direction (lower can't depend on higher)
      if (sourceLevel < targetLevel) {
        errors.push({
          type: 'invalid_dependency_direction',
          source: sourceFile,
          target: depPath,
          sourceLayer,
          targetLayer,
          message: `${sourceLayer} should not depend on ${targetLayer}`,
          suggestion:
            'Use "implements_requirements" or "references" field instead',
        });
      }
    }

    return errors;
  }

  /**
   * Check frontmatter references
   */
  async checkFrontmatterReferences(filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const fm = this.parseFrontmatter(content);
    const fileDir = path.dirname(filePath);

    const referenceFields = [
      'dependencies',
      'compliance_requirements',
      'architecture',
      'related',
      'implements_requirements',
      'created_from_template',
    ];

    for (const field of referenceFields) {
      let refs = fm[field];
      if (!refs) continue;

      // Handle single reference
      if (typeof refs === 'string') {
        refs = [refs];
      }

      if (!Array.isArray(refs)) continue;

      for (const ref of refs) {
        const result = await this.validateReference(ref, fileDir);

        if (!result.valid) {
          this.brokenLinks.push({
            file: filePath,
            field: field,
            reference: ref,
            ...result,
          });
        }
      }

      // Check dependency direction for dependency fields
      if (['dependencies', 'compliance_requirements'].includes(field)) {
        const directionErrors = this.checkDependencyDirection(filePath, refs);
        for (const error of directionErrors) {
          this.brokenLinks.push({
            file: filePath,
            field: field,
            ...error,
          });
        }
      }
    }
  }
}

// Export for programmatic use
module.exports = LinkChecker;

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);

  const options = {
    fix: args.includes('--fix'),
    dryRun: args.includes('--dry-run'),
    fullReport: args.includes('--full-report'),
    file: null,
  };

  // Parse --file option
  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1 && args[fileIndex + 1]) {
    options.file = args[fileIndex + 1];
  }

  const checker = new LinkChecker(options);
  checker
    .run()
    .then((results) => {
      if (results.total > 0 && !options.fix) {
        process.exit(1); // Exit with error if broken links found
      }
      if (options.fix && results.total > results.fixed) {
        process.exit(1); // Exit with error if some links couldn't be fixed
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

// Export helper functions for testing
module.exports = LinkChecker;
module.exports.parseReference = LinkChecker.prototype.parseReference;
module.exports.validateReference = LinkChecker.prototype.validateReference;
module.exports.calculateVersionSeverity =
  LinkChecker.prototype.calculateVersionSeverity;
module.exports.checkDependencyDirection =
  LinkChecker.prototype.checkDependencyDirection;
