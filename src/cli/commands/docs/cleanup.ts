// @ts-nocheck
const fs = require('node:fs').promises;
const path = require('node:path');
const yaml = require('js-yaml');
const chalk = require('chalk');

/**
 * Documentation Cleanup Command
 * Scans and validates documentation structure per ADR-001
 *
 * Uses paths from supernal.yaml (NO magic strings!)
 */

class DocsCleanup {
  config: any;
  issues: any;
  projectRoot: any;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.config = null;
    this.issues = {
      wrongLocation: [],
      orphaned: [],
      brokenLinks: [],
      rootViolations: []
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

    return this.config.documentation;
  }

  async scan() {
    console.log(chalk.blue('🔍 Scanning documentation structure...'));
    console.log('');

    const docConfig = await this.loadConfig();

    // 1. Check for root violations
    await this.scanRootDirectory(docConfig);

    // 2. Check for broken links
    await this.scanBrokenLinks(docConfig);

    // 3. Check for orphaned files
    await this.scanOrphaned(docConfig);

    // 4. Validate structure exists
    await this.validateStructure(docConfig);

    return this.issues;
  }

  async scanRootDirectory(docConfig) {
    const files = await fs.readdir(this.projectRoot);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of mdFiles) {
      if (!docConfig.root_whitelist.includes(file)) {
        this.issues.rootViolations.push({
          file: `/${file}`,
          suggestion: this.suggestLocation(file, docConfig)
        });
      }
    }
  }

  suggestLocation(filename, docConfig) {
    // Suggest proper location based on filename
    if (filename.includes('PLAN') || filename.includes('STRATEGY')) {
      return `${docConfig.planning_phases.startup}/versions/v1/${this.toKebabCase(filename)}`;
    }
    if (filename.includes('ADR') || filename.includes('DECISION')) {
      const num = filename.match(/\d+/)?.[0]?.padStart(3, '0') || '001';
      return `${docConfig.adr_dir}/${num}-${this.toKebabCase(filename)}`;
    }
    if (filename.includes('ARCHITECTURE') || filename.includes('DESIGN')) {
      return `${docConfig.architecture_dir}/${this.toKebabCase(filename)}`;
    }
    return `archive/legacy-root-docs/${filename}`;
  }

  async scanBrokenLinks(_docConfig) {
    const docsDir = path.join(this.projectRoot, 'docs');
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
              lineNumber: link.line
            });
          }
        }
      }
    }
  }

  async scanOrphaned(_docConfig) {
    // Find files with no references
    const docsDir = path.join(this.projectRoot, 'docs');
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
          suggestion: 'Consider archiving if no longer needed'
        });
      }
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
        console.log(chalk.yellow(`⚠️  Missing directory: ${dir}`));
      }
    }
  }

  async findMarkdownFiles(dir, files = []) {
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
    console.log(chalk.bold('📊 Documentation Cleanup Report'));
    console.log('');

    // Root violations
    if (this.issues.rootViolations.length > 0) {
      console.log(chalk.red('❌ Files in wrong location:'));
      this.issues.rootViolations.forEach((issue) => {
        console.log(
          `  ${chalk.yellow(issue.file)} → ${chalk.green(issue.suggestion)}`
        );
      });
      console.log('');
    }

    // Broken links
    if (this.issues.brokenLinks.length > 0) {
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
    const totalIssues =
      this.issues.rootViolations.length +
      this.issues.brokenLinks.length +
      this.issues.orphaned.length;

    if (totalIssues === 0) {
      console.log(chalk.green('✅ No documentation issues found!'));
    } else {
      console.log(chalk.bold('Summary:'));
      console.log(`  ${this.issues.rootViolations.length} files to move`);
      console.log(`  ${this.issues.brokenLinks.length} broken links to fix`);
      console.log(`  ${this.issues.orphaned.length} orphaned files`);
      console.log('');
      console.log(
        chalk.gray('Run with --auto-fix to apply changes automatically')
      );
      console.log(chalk.gray('Run with --interactive to review each change'));
    }
  }

  async autoFix() {
    console.log(chalk.blue('🔧 Auto-fixing issues...'));
    console.log('');

    // Move root violations
    for (const issue of this.issues.rootViolations) {
      const source = path.join(this.projectRoot, issue.file.substring(1));
      const target = path.join(this.projectRoot, issue.suggestion);

      // Ensure target directory exists
      await fs.mkdir(path.dirname(target), { recursive: true });

      await fs.rename(source, target);
      console.log(chalk.green(`✓ Moved ${issue.file} → ${issue.suggestion}`));
    }

    console.log('');
    console.log(chalk.green('✅ Auto-fix complete!'));
    console.log(chalk.yellow('⚠️  Broken links require manual review'));
  }
}

module.exports = {
  name: 'docs:cleanup',
  description: 'Scan and cleanup documentation structure per ADR-001',
  options: [
    {
      flags: '--auto-fix',
      description: 'Automatically fix issues (moves files)'
    },
    {
      flags: '--interactive',
      description: 'Review each change interactively'
    },
    {
      flags: '--dry-run',
      description: 'Show what would be done without making changes'
    }
  ],

  async run(options) {
    const projectRoot = process.cwd();
    const cleanup = new DocsCleanup(projectRoot);

    try {
      await cleanup.scan();
      cleanup.printReport();

      if (options.autoFix && !options.dryRun) {
        console.log('');
        await cleanup.autoFix();
      }

      if (options.interactive) {
        console.log(chalk.yellow('\n⚠️  Interactive mode not yet implemented'));
        console.log(
          chalk.gray('Use --auto-fix for now, or manually move files')
        );
      }
    } catch (error) {
      console.error(chalk.red('Error during cleanup:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
};
