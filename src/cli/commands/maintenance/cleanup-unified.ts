// @ts-nocheck
const fs = require('node:fs').promises;
const path = require('node:path');
const yaml = require('js-yaml');
const chalk = require('chalk');

/**
 * Unified Cleanup Command
 * Consolidates doc and folder cleanup with staging queue support
 *
 * Usage:
 *   sc cleanup              - Run all cleanup checks
 *   sc cleanup docs         - Documentation cleanup only
 *   sc cleanup folders      - Folder structure cleanup only
 *   sc cleanup status       - Show cleanup queue status
 *   sc cleanup process-queue - Process staged items interactively
 */

class UnifiedCleanup {
  config: any;
  issues: any;
  manifest: any;
  projectRoot: any;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.config = null;
    this.issues = {
      rootViolations: [],
      namingViolations: [],
      structureViolations: [],
      orphaned: [],
      brokenLinks: [],
      folderIssues: []
    };
    this.manifest = [];
  }

  async loadConfig() {
    const configPath = path.join(this.projectRoot, 'supernal.yaml');
    const content = await fs.readFile(configPath, 'utf8');
    this.config = yaml.load(content);

    if (!this.config.documentation) {
      throw new Error('supernal.yaml missing documentation section');
    }

    return this.config;
  }

  async ensureCleanupQueue() {
    const config = await this.loadConfig();
    const queueDir = path.join(
      this.projectRoot,
      config.documentation.cleanup_queue_dir
    );
    const toProcessDir = path.join(
      this.projectRoot,
      config.documentation.cleanup_subdirs.to_process
    );
    const autoStagedDir = path.join(
      this.projectRoot,
      config.documentation.cleanup_subdirs.auto_staged
    );

    await fs.mkdir(toProcessDir, { recursive: true });
    await fs.mkdir(autoStagedDir, { recursive: true });

    // Create .gitignore in cleanup-queue to avoid accidentally committing
    const gitignorePath = path.join(queueDir, '.gitignore');
    const gitignoreContent = `# Cleanup queue is for local staging only
*
!.gitignore
`;
    await fs.writeFile(gitignorePath, gitignoreContent, 'utf8');

    return { queueDir, toProcessDir, autoStagedDir };
  }

  async loadManifest() {
    const config = await this.loadConfig();
    const manifestPath = path.join(
      this.projectRoot,
      config.documentation.cleanup_subdirs.manifest
    );

    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      this.manifest = JSON.parse(content);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.manifest = [];
    }

    return this.manifest;
  }

  async saveManifest() {
    const config = await this.loadConfig();
    const manifestPath = path.join(
      this.projectRoot,
      config.documentation.cleanup_subdirs.manifest
    );

    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(
      manifestPath,
      JSON.stringify(this.manifest, null, 2),
      'utf8'
    );
  }

  async scan(options = {}) {
    const mode = options.mode || 'all'; // 'all', 'docs', 'folders'

    console.log(
      chalk.blue(`🔍 Scanning ${mode === 'all' ? 'repository' : mode}...`)
    );
    console.log('');

    const config = await this.loadConfig();
    const docConfig = config.documentation;

    // Documentation checks
    if (mode === 'all' || mode === 'docs') {
      if (!options.skipDocs) {
        await this.scanRootDirectory(docConfig);
      }

      if (options.validateNaming) {
        await this.scanFileNaming(config);
      }

      if (options.checkLinks) {
        await this.scanBrokenLinks(docConfig);
      }

      if (options.findOrphans) {
        await this.scanOrphaned(docConfig);
      }
    }

    // Folder structure checks
    if (mode === 'all' || mode === 'folders') {
      if (!options.skipStructure) {
        await this.validateStructure(docConfig);
      }

      await this.scanFolderIssues(docConfig);
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

  async scanFolderIssues(_docConfig) {
    // Scan for common folder structure issues
    const problematicPatterns = [
      {
        pattern: /^temp_/,
        location: '/',
        suggestion: 'cleanup-queue/to-process'
      },
      { pattern: /^old_/, location: '/', suggestion: 'archive' },
      {
        pattern: /^backup_/,
        location: '/',
        suggestion: 'cleanup-queue/to-process'
      },
      {
        pattern: /^test_.*_\d+$/,
        location: '/',
        suggestion: 'test-repos or cleanup-queue'
      },
      {
        pattern: /^draft/,
        location: '/docs',
        suggestion: 'cleanup-queue/to-process'
      }
    ];

    const scanDirectory = async (dir, relativePath = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules')
            continue;

          const fullPath = path.join(dir, entry.name);
          const relPath = path.join(relativePath, entry.name);

          if (entry.isDirectory()) {
            // Check against patterns
            for (const {
              pattern,
              location,
              suggestion
            } of problematicPatterns) {
              if (
                pattern.test(entry.name) &&
                relativePath === location.substring(1)
              ) {
                this.issues.folderIssues.push({
                  folder: relPath,
                  reason: `Matches pattern ${pattern}`,
                  suggestion: suggestion,
                  type: 'folder_naming'
                });
              }
            }

            // Recurse (limited depth)
            if (relPath.split(path.sep).length < 3) {
              await scanDirectory(fullPath, relPath);
            }
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    };

    await scanDirectory(this.projectRoot);
  }

  suggestLocation(filename, docConfig) {
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
    const reqDir = path.join(this.projectRoot, config.project.requirements_dir);

    try {
      const files = await this.findMarkdownFiles(reqDir);

      for (const file of files) {
        const relativePath = path.relative(this.projectRoot, file);
        const filename = path.basename(file);

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

      for (const file of allDocs) {
        const content = await fs.readFile(file, 'utf8');
        allContent.push({ file, content });
      }

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

        const isLeaf =
          doc.file.includes('/versions/') ||
          doc.file.includes('/archive/') ||
          doc.file.includes('/sessions/');

        if (!referenced && !isLeaf) {
          this.issues.orphaned.push({
            file: path.relative(this.projectRoot, doc.file),
            suggestion: 'Consider archiving or staging for review',
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
      docConfig.kanban_dir,
      docConfig.cleanup_queue_dir
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
    console.log(chalk.bold('📊 Cleanup Report'));
    console.log('');

    let totalIssues = 0;

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

    if (this.issues.folderIssues.length > 0) {
      totalIssues += this.issues.folderIssues.length;
      console.log(chalk.yellow('⚠️  Folders needing attention:'));
      this.issues.folderIssues.forEach((issue) => {
        console.log(
          `  ${chalk.yellow(issue.folder)} → ${chalk.green(issue.suggestion)}`
        );
        console.log(chalk.gray(`     Reason: ${issue.reason}`));
      });
      console.log('');
    }

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

    if (this.issues.structureViolations.length > 0) {
      totalIssues += this.issues.structureViolations.length;
      console.log(chalk.yellow('⚠️  Missing directories:'));
      this.issues.structureViolations.forEach((issue) => {
        console.log(`  ${chalk.gray(issue.directory)}`);
      });
      console.log('');
    }

    if (this.issues.brokenLinks.length > 0) {
      totalIssues += this.issues.brokenLinks.length;
      console.log(chalk.red('🔗 Broken links:'));
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

    if (this.issues.orphaned.length > 0) {
      totalIssues += this.issues.orphaned.length;
      console.log(chalk.yellow('⚠️  Orphaned files:'));
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

    if (totalIssues === 0) {
      console.log(chalk.green('✅ No issues found!'));
    } else {
      console.log(chalk.bold('Summary:'));
      console.log(`  ${this.issues.rootViolations.length} root violations`);
      console.log(`  ${this.issues.folderIssues.length} folder issues`);
      console.log(`  ${this.issues.namingViolations.length} naming violations`);
      console.log(
        `  ${this.issues.structureViolations.length} missing directories`
      );
      console.log(`  ${this.issues.brokenLinks.length} broken links`);
      console.log(`  ${this.issues.orphaned.length} orphaned files`);
      console.log('');
      console.log(chalk.gray('Options:'));
      console.log(chalk.gray('  --auto-fix      : Apply fixes automatically'));
      console.log(
        chalk.gray(
          '  --auto-stage    : Move problematic files to cleanup-queue'
        )
      );
      console.log(chalk.gray('  --interactive   : Review each change'));
    }

    return totalIssues;
  }

  async autoStage() {
    console.log(chalk.blue('📦 Staging files for manual review...'));
    console.log('');

    const { toProcessDir } = await this.ensureCleanupQueue();
    let staged = 0;

    await this.loadManifest();

    for (const issue of this.issues.rootViolations) {
      const source = path.join(this.projectRoot, issue.file.substring(1));
      const filename = path.basename(issue.file);
      const target = path.join(toProcessDir, filename);

      try {
        await fs.rename(source, target);

        this.manifest.push({
          id: `${Date.now()}-${staged}`,
          timestamp: new Date().toISOString(),
          original_path: issue.file,
          staged_path: path.relative(this.projectRoot, target),
          suggested_path: issue.suggestion,
          type: issue.type,
          status: 'staged'
        });

        console.log(chalk.green(`✓ Staged ${issue.file}`));
        staged++;
      } catch (error) {
        console.log(
          chalk.red(`✗ Failed to stage ${issue.file}: ${error.message}`)
        );
      }
    }

    await this.saveManifest();

    console.log('');
    console.log(
      chalk.green(`✅ Staged ${staged} items in cleanup-queue/to-process/`)
    );
    console.log(chalk.gray('   Run "sc cleanup process-queue" to review'));
  }

  async autoFix() {
    console.log(chalk.blue('🔧 Auto-fixing issues...'));
    console.log('');

    let fixed = 0;
    const movedFiles = [];
    const createdDirs = [];

    // Move root violations
    for (const issue of this.issues.rootViolations) {
      const source = path.join(this.projectRoot, issue.file.substring(1));
      const target = path.join(this.projectRoot, issue.suggestion);

      await fs.mkdir(path.dirname(target), { recursive: true });

      await fs.rename(source, target);
      console.log(chalk.green(`✓ Moved ${issue.file} → ${issue.suggestion}`));
      movedFiles.push(issue.suggestion);
      fixed++;
    }

    // Create missing directories
    for (const issue of this.issues.structureViolations) {
      const dir = path.join(this.projectRoot, issue.directory);
      await fs.mkdir(dir, { recursive: true });
      console.log(chalk.green(`✓ Created ${issue.directory}`));
      createdDirs.push(issue.directory);
      fixed++;
    }

    console.log('');
    console.log(chalk.green(`✅ Fixed ${fixed} issues`));
    console.log(
      chalk.yellow(
        '⚠️  Naming violations and broken links require manual review'
      )
    );

    // Suggest commit command (simple pattern, matches date-validate, kanban/priority)
    if (movedFiles.length > 0 || createdDirs.length > 0) {
      console.log('');
      console.log(chalk.blue('📝 Suggested commit:'));
      
      const allFiles = [...movedFiles, ...createdDirs.map(d => `${d}/.gitkeep`)];
      const filesArg = allFiles.length <= 5 
        ? allFiles.join(' ')
        : `${allFiles.slice(0, 3).join(' ')} # ... and ${allFiles.length - 3} more`;
      
      const commitMsg = movedFiles.length > 0
        ? `refactor: Organize ${movedFiles.length} file(s) via sc cleanup`
        : `chore: Create ${createdDirs.length} missing directories`;
      
      console.log(chalk.cyan(`git add ${filesArg}`));
      console.log(chalk.cyan(`git commit -m "${commitMsg}"`));
    }
  }

  async showQueueStatus() {
    await this.loadManifest();

    console.log('');
    console.log(chalk.bold('📋 Cleanup Queue Status'));
    console.log('');

    if (this.manifest.length === 0) {
      console.log(chalk.green('✅ Queue is empty'));
      return;
    }

    const staged = this.manifest.filter((item) => item.status === 'staged');
    const processed = this.manifest.filter(
      (item) => item.status === 'processed'
    );

    console.log(chalk.cyan(`Total items: ${this.manifest.length}`));
    console.log(chalk.yellow(`  Staged (awaiting review): ${staged.length}`));
    console.log(chalk.green(`  Processed: ${processed.length}`));
    console.log('');

    if (staged.length > 0) {
      console.log(chalk.bold('Staged items:'));
      staged.slice(0, 10).forEach((item) => {
        console.log(chalk.gray(`  ${item.original_path}`));
        console.log(chalk.gray(`    → Suggested: ${item.suggested_path}`));
      });

      if (staged.length > 10) {
        console.log(chalk.gray(`  ... and ${staged.length - 10} more`));
      }

      console.log('');
      console.log(
        chalk.gray('Run "sc cleanup process-queue" to review and process')
      );
    }
  }
}

async function handler(action, options = {}) {
  const projectRoot = process.cwd();
  const cleanup = new UnifiedCleanup(projectRoot);

  // Handle subcommands
  if (action === 'status') {
    await cleanup.showQueueStatus();
    return;
  }

  if (action === 'process-queue') {
    console.log(chalk.yellow('⚠️  Interactive queue processing coming soon'));
    console.log(
      chalk.gray('   For now, check cleanup-queue/to-process/ manually')
    );
    return;
  }

  // Determine mode based on action
  let mode = 'all';
  if (action === 'docs') {
    mode = 'docs';
  } else if (action === 'folders') {
    mode = 'folders';
  }

  // Set options based on flags
  if (options.all) {
    options.validateNaming = true;
    options.checkLinks = true;
    options.findOrphans = true;
  }

  try {
    // Ensure cleanup queue structure exists
    await cleanup.ensureCleanupQueue();

    // Run scan
    await cleanup.scan({ ...options, mode });
    const issueCount = cleanup.printReport();

    // Handle auto-stage
    if (options.autoStage && !options.dryRun && issueCount > 0) {
      console.log('');
      await cleanup.autoStage();
    }

    // Handle auto-fix
    if (options.autoFix && !options.dryRun && issueCount > 0) {
      console.log('');
      await cleanup.autoFix();
    }

    if (options.interactive) {
      console.log(chalk.yellow('\n⚠️  Interactive mode not yet implemented'));
      console.log(chalk.gray('Use --auto-stage or --auto-fix for now'));
    }

    // Exit with non-zero if issues found (for git hooks)
    if (issueCount > 0 && !options.autoFix && !options.autoStage) {
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
module.exports.UnifiedCleanup = UnifiedCleanup;
