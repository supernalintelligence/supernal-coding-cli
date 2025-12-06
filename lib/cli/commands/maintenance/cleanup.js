const fs = require('node:fs').promises;
const path = require('node:path');
const yaml = require('js-yaml');
const chalk = require('chalk');

/**
 * Unified Cleanup Command
 * Scans and validates repository structure, documentation, and file organization
 *
 * Uses patterns from supernal.yaml (NO magic strings!)
 * Integrates:
 * - ADR-001 documentation structure
 * - REQ-VALIDATION-001 file naming validation
 * - Git hook integration
 */

class RepositoryCleanup {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.config = null;
    this.issues = {
      rootViolations: [],
      namingViolations: [],
      structureViolations: [],
      orphaned: [],
      brokenLinks: []
    };
  }

  async loadConfig() {
    const configPath = path.join(this.projectRoot, 'supernal.yaml');
    const content = await fs.readFile(configPath, 'utf8');
    this.config = yaml.load(content);

    if (!this.config.documentation) {
      throw new Error(
        'supernal.yaml missing documentation section (per ADR-001)'
      );
    }

    return this.config;
  }

  async scan(options = {}) {
    console.log(chalk.blue('🔍 Scanning repository structure...'));
    console.log('');

    const config = await this.loadConfig();
    const docConfig = config.documentation;

    // 1. Check for root violations (ADR-001)
    if (!options.skipDocs) {
      await this.scanRootDirectory(docConfig);
    }

    // 2. Check for file naming violations (REQ-VALIDATION-001)
    if (options.validateNaming) {
      await this.scanFileNaming(config);
    }

    // 3. Check for structure violations
    if (!options.skipStructure) {
      await this.validateStructure(docConfig);
    }

    // 4. Check for broken links
    if (options.checkLinks) {
      await this.scanBrokenLinks(docConfig);
    }

    // 5. Check for orphaned files
    if (options.findOrphans) {
      await this.scanOrphaned(docConfig);
    }

    return this.issues;
  }

  async scanRootDirectory(docConfig) {
    const files = await fs.readdir(this.projectRoot);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of mdFiles) {
      if (!docConfig.root_whitelist.includes(file)) {
        this.issues.rootViolations.push({
          file: `/${file}`,
          suggestion: this.suggestLocation(file, docConfig),
          type: 'root_violation'
        });
      }
    }
  }

  suggestLocation(filename, docConfig) {
    // Suggest proper location based on filename patterns from config
    if (filename.match(/plan|strategy|proposal|roadmap/i)) {
      return `${docConfig.planning_phases.startup}/versions/v1/${this.toKebabCase(filename)}`;
    }
    if (filename.match(/adr|decision/i)) {
      const num = filename.match(/\d+/)?.[0]?.padStart(3, '0') || '001';
      return `${docConfig.adr_dir}/${num}-${this.toKebabCase(filename)}`;
    }
    if (filename.match(/architecture|design|integration/i)) {
      return `${docConfig.architecture_dir}/${this.toKebabCase(filename)}`;
    }
    if (filename.match(/session|handoff/i)) {
      const date = new Date().toISOString().split('T')[0];
      return `${docConfig.sessions_dir}/${date}-${this.toKebabCase(filename)}`;
    }
    return `archive/legacy-root-docs/${filename}`;
  }

  async scanFileNaming(config) {
    // Scan docs/requirements for naming violations per REQ-VALIDATION-001
    const reqDir = path.join(this.projectRoot, config.project.requirements_dir);

    try {
      const files = await this.findMarkdownFiles(reqDir);

      for (const file of files) {
        const relativePath = path.relative(this.projectRoot, file);
        const filename = path.basename(file);

        // Check if filename follows expected pattern
        if (filename.startsWith('req-') || filename.startsWith('story-')) {
          const content = await fs.readFile(file, 'utf8');
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

          if (frontmatterMatch) {
            const frontmatter = yaml.load(frontmatterMatch[1]);
            const expectedId = this.deriveExpectedId(file, config);

            if (frontmatter.id && frontmatter.id !== expectedId) {
              this.issues.namingViolations.push({
                file: relativePath,
                actual: frontmatter.id,
                expected: expectedId,
                type: 'id_mismatch'
              });
            }
          }
        }
      }
    } catch (error) {
      // Requirements directory may not exist yet
      if (error.code !== 'ENOENT') throw error;
    }
  }

  deriveExpectedId(filePath, config) {
    const relativePath = path.relative(
      path.join(this.projectRoot, config.project.requirements_dir),
      filePath
    );
    const parts = relativePath.split(path.sep);
    const filename = parts[parts.length - 1].replace('.md', '');

    // Convert filename to expected ID format
    // e.g., req-auth-001.md -> REQ-AUTH-001
    return filename.toUpperCase().replace(/-/g, '-');
  }

  async scanBrokenLinks(_docConfig) {
    const docsDir = path.join(this.projectRoot, 'docs');

    try {
      const mdFiles = await this.findMarkdownFiles(docsDir);

      for (const file of mdFiles) {
        const content = await fs.readFile(file, 'utf8');
        const links = this.extractMarkdownLinks(content);

        for (const link of links) {
          if (link.isRelative) {
            const targetPath = path.resolve(path.dirname(file), link.url);
            try {
              await fs.access(targetPath);
            } catch {
              this.issues.brokenLinks.push({
                file: path.relative(this.projectRoot, file),
                link: link.url,
                lineNumber: link.line,
                type: 'broken_link'
              });
            }
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async scanOrphaned(_docConfig) {
    const docsDir = path.join(this.projectRoot, 'docs');

    try {
      const allDocs = await this.findMarkdownFiles(docsDir);
      const allContent = [];

      // Read all markdown content
      for (const file of allDocs) {
        const content = await fs.readFile(file, 'utf8');
        allContent.push({ file, content });
      }

      // Check each file for references
      for (const doc of allContent) {
        const filename = path.basename(doc.file);
        let referenced = false;

        for (const other of allContent) {
          if (other.file === doc.file) continue;
          if (
            other.content.includes(filename) ||
            other.content.includes(path.basename(doc.file, '.md'))
          ) {
            referenced = true;
            break;
          }
        }

        // Check if it's a "leaf" document (planning version, archive, etc.)
        const isLeaf =
          doc.file.includes('/versions/') ||
          doc.file.includes('/archive/') ||
          doc.file.includes('/sessions/');

        if (!referenced && !isLeaf) {
          this.issues.orphaned.push({
            file: path.relative(this.projectRoot, doc.file),
            suggestion: 'Consider archiving if no longer needed',
            type: 'orphaned'
          });
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async validateStructure(docConfig) {
    const requiredDirs = [
      docConfig.adr_dir,
      docConfig.planning_dir,
      docConfig.planning_phases.startup,
      docConfig.planning_phases.templates,
      docConfig.architecture_dir,
      docConfig.kanban_dir
    ];

    for (const dir of requiredDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      try {
        await fs.access(fullPath);
      } catch {
        this.issues.structureViolations.push({
          directory: dir,
          type: 'missing_directory'
        });
      }
    }
  }

  async findMarkdownFiles(dir, files = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules'
        ) {
          await this.findMarkdownFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    return files;
  }

  extractMarkdownLinks(content) {
    const links = [];
    const lines = content.split('\n');
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    lines.forEach((line, index) => {
      let match;
      while ((match = linkRegex.exec(line)) !== null) {
        const url = match[2];
        if (!url.startsWith('http') && !url.startsWith('#')) {
          links.push({
            text: match[1],
            url: url,
            line: index + 1,
            isRelative: true
          });
        }
      }
    });

    return links;
  }

  toKebabCase(str) {
    return str
      .replace(/\.md$/, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  printReport() {
    console.log('');
    console.log(chalk.bold('📊 Repository Cleanup Report'));
    console.log('');

    let totalIssues = 0;

    // Root violations
    if (this.issues.rootViolations.length > 0) {
      totalIssues += this.issues.rootViolations.length;
      console.log(chalk.red('❌ Files in wrong location:'));
      this.issues.rootViolations.forEach((issue) => {
        console.log(
          `  ${chalk.yellow(issue.file)} → ${chalk.green(issue.suggestion)}`
        );
      });
      console.log('');
    }

    // Naming violations
    if (this.issues.namingViolations.length > 0) {
      totalIssues += this.issues.namingViolations.length;
      console.log(chalk.red('❌ File naming violations:'));
      this.issues.namingViolations.slice(0, 10).forEach((issue) => {
        console.log(
          `  ${chalk.yellow(issue.file)}: ${chalk.gray(issue.actual)} → ${chalk.green(issue.expected)}`
        );
      });
      if (this.issues.namingViolations.length > 10) {
        console.log(
          chalk.gray(
            `  ... and ${this.issues.namingViolations.length - 10} more`
          )
        );
      }
      console.log('');
    }

    // Structure violations
    if (this.issues.structureViolations.length > 0) {
      totalIssues += this.issues.structureViolations.length;
      console.log(chalk.yellow('⚠️  Missing directories:'));
      this.issues.structureViolations.forEach((issue) => {
        console.log(`  ${chalk.gray(issue.directory)}`);
      });
      console.log('');
    }

    // Broken links
    if (this.issues.brokenLinks.length > 0) {
      totalIssues += this.issues.brokenLinks.length;
      console.log(chalk.red('🔗 Broken links found:'));
      this.issues.brokenLinks.slice(0, 10).forEach((issue) => {
        console.log(
          `  ${chalk.yellow(issue.file)}:${issue.lineNumber} → ${chalk.gray(issue.link)}`
        );
      });
      if (this.issues.brokenLinks.length > 10) {
        console.log(
          chalk.gray(`  ... and ${this.issues.brokenLinks.length - 10} more`)
        );
      }
      console.log('');
    }

    // Orphaned files
    if (this.issues.orphaned.length > 0) {
      totalIssues += this.issues.orphaned.length;
      console.log(chalk.yellow('⚠️  Orphaned files (no references):'));
      this.issues.orphaned.slice(0, 5).forEach((issue) => {
        console.log(`  ${chalk.gray(issue.file)} - ${issue.suggestion}`);
      });
      if (this.issues.orphaned.length > 5) {
        console.log(
          chalk.gray(`  ... and ${this.issues.orphaned.length - 5} more`)
        );
      }
      console.log('');
    }

    // Summary
    if (totalIssues === 0) {
      console.log(chalk.green('✅ No repository issues found!'));
    } else {
      console.log(chalk.bold('Summary:'));
      console.log(`  ${this.issues.rootViolations.length} root violations`);
      console.log(`  ${this.issues.namingViolations.length} naming violations`);
      console.log(
        `  ${this.issues.structureViolations.length} missing directories`
      );
      console.log(`  ${this.issues.brokenLinks.length} broken links`);
      console.log(`  ${this.issues.orphaned.length} orphaned files`);
      console.log('');
      console.log(
        chalk.gray('Run with --auto-fix to apply changes automatically')
      );
      console.log(chalk.gray('Run with --interactive to review each change'));
    }

    return totalIssues;
  }

  async autoFix() {
    console.log(chalk.blue('🔧 Auto-fixing issues...'));
    console.log('');

    let fixed = 0;

    // Move root violations
    for (const issue of this.issues.rootViolations) {
      const source = path.join(this.projectRoot, issue.file.substring(1));
      const target = path.join(this.projectRoot, issue.suggestion);

      // Ensure target directory exists
      await fs.mkdir(path.dirname(target), { recursive: true });

      await fs.rename(source, target);
      console.log(chalk.green(`✓ Moved ${issue.file} → ${issue.suggestion}`));
      fixed++;
    }

    // Create missing directories
    for (const issue of this.issues.structureViolations) {
      const dir = path.join(this.projectRoot, issue.directory);
      await fs.mkdir(dir, { recursive: true });
      console.log(chalk.green(`✓ Created ${issue.directory}`));
      fixed++;
    }

    console.log('');
    console.log(chalk.green(`✅ Fixed ${fixed} issues automatically`));
    console.log(
      chalk.yellow(
        '⚠️  Naming violations and broken links require manual review'
      )
    );
  }
}

async function handler(_action, options = {}) {
  const projectRoot = process.cwd();
  const cleanup = new RepositoryCleanup(projectRoot);

  // --all flag enables everything
  if (options.all) {
    options.validateNaming = true;
    options.checkLinks = true;
    options.findOrphans = true;
  }

  try {
    await cleanup.scan(options);
    const issueCount = cleanup.printReport();

    if (options.autoFix && !options.dryRun && issueCount > 0) {
      console.log('');
      await cleanup.autoFix();
    }

    if (options.interactive) {
      console.log(chalk.yellow('\n⚠️  Interactive mode not yet implemented'));
      console.log(chalk.gray('Use --auto-fix for now, or manually fix issues'));
    }

    // Exit with non-zero if issues found (for git hooks)
    if (issueCount > 0 && !options.autoFix) {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error during cleanup:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = handler;
module.exports.RepositoryCleanup = RepositoryCleanup;
