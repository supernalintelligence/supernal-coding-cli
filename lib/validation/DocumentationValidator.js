#!/usr/bin/env node

/**
 * Documentation Validation System
 *
 * Validates:
 * - Duplicate generic filenames (implementation.md, plan.md, etc.)
 * - File references without full paths
 * - Broken epic/requirement references
 * - ID-filename mismatches
 */

const fs = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');

class DocumentationValidator {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.errors = [];
    this.warnings = [];

    // Generic filenames that should be renamed to something descriptive
    this.genericFilenames = [
      'notes.md',
      'draft.md',
      'temp.md',
      'scratch.md'
      // README.md is allowed - it's a common index file pattern
    ];

    // Directories to scan
    this.scanDirs = [
      'docs/features',
      'docs/planning',
      'docs/requirements',
      'docs/guides'
    ];
  }

  /**
   * Validate duplicate generic filenames
   */
  validateGenericFilenames() {
    console.log(chalk.blue('🔍 Checking for duplicate generic filenames...'));

    const filesByName = new Map();

    for (const dir of this.scanDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(dirPath)) continue;

      this.scanDirectory(dirPath, (filePath) => {
        const basename = path.basename(filePath);

        if (this.genericFilenames.includes(basename)) {
          if (!filesByName.has(basename)) {
            filesByName.set(basename, []);
          }
          filesByName.get(basename).push(filePath);
        }
      });
    }

    // Report duplicates
    for (const [filename, paths] of filesByName.entries()) {
      if (paths.length > 1) {
        this.errors.push({
          type: 'DUPLICATE_GENERIC_FILENAME',
          filename,
          count: paths.length,
          paths: paths.map((p) => path.relative(this.projectRoot, p)),
          message: `Found ${paths.length} files named "${filename}" - should have descriptive names`,
          fix: `Rename to include feature context (e.g., "real-data-integration-implementation.md")`
        });
      } else if (paths.length === 1) {
        const relPath = path.relative(this.projectRoot, paths[0]);
        // Allow README.md in certain locations
        if (
          filename === 'README.md' &&
          this.isAcceptableReadmeLocation(relPath)
        ) {
          continue;
        }

        this.warnings.push({
          type: 'GENERIC_FILENAME',
          path: relPath,
          filename,
          message: `Generic filename "${filename}" - consider renaming for clarity`,
          fix: `Rename to include feature/context (e.g., "${this.suggestDescriptiveName(relPath)}")`
        });
      }
    }
  }

  /**
   * Validate file references have full paths
   */
  validateFileReferences() {
    console.log(chalk.blue('🔍 Checking file references for full paths...'));

    for (const dir of this.scanDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(dirPath)) continue;

      this.scanDirectory(dirPath, (filePath) => {
        if (!filePath.endsWith('.md')) return;

        const content = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(this.projectRoot, filePath);

        // Check for @filename references without path
        const atReferences = content.match(/@([a-z0-9-]+\.md)/gi);
        if (atReferences) {
          for (const ref of atReferences) {
            const filename = ref.substring(1); // Remove @

            // If it doesn't contain a path separator, it's likely incomplete
            if (!filename.includes('/')) {
              this.errors.push({
                type: 'INCOMPLETE_FILE_REFERENCE',
                file: relPath,
                reference: ref,
                message: `File reference "${ref}" missing full path`,
                fix: `Use full path like "@docs/planning/epics/${filename}"`
              });
            }
          }
        }

        // Check for [text](file.md) references without path
        const mdReferences = content.match(/\[([^\]]+)\]\(([^)]+\.md)\)/gi);
        if (mdReferences) {
          for (const ref of mdReferences) {
            const match = ref.match(/\[([^\]]+)\]\(([^)]+\.md)\)/);
            if (match) {
              const linkPath = match[2];

              // If relative but not starting with ./ or ../, might be incomplete
              if (
                !linkPath.startsWith('./') &&
                !linkPath.startsWith('../') &&
                !linkPath.startsWith('docs/') &&
                !linkPath.startsWith('/')
              ) {
                this.warnings.push({
                  type: 'AMBIGUOUS_LINK',
                  file: relPath,
                  reference: ref,
                  message: `Link path "${linkPath}" might be ambiguous`,
                  fix: `Use explicit relative path (./file.md) or full path (docs/.../file.md)`
                });
              }
            }
          }
        }
      });
    }
  }

  /**
   * Validate epic/requirement references exist
   */
  /**
   * Strip code blocks, frontmatter, and historical references from content
   * to avoid false positives
   */
  stripCodeBlocks(content) {
    // Remove YAML frontmatter (---...---) more aggressively
    // Must handle multi-line YAML including arrays and block scalars
    let stripped = content;

    // Match frontmatter at start of document
    const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
    if (frontmatterMatch) {
      stripped = content.slice(frontmatterMatch[0].length);
    }

    // Remove fenced code blocks (```...```)
    stripped = stripped.replace(/```[\s\S]*?```/g, '');

    // Remove inline code (`...`)
    stripped = stripped.replace(/`[^`\n]+`/g, '');

    // Remove strikethrough text (~~...~~) - often used for deleted requirements
    stripped = stripped.replace(/~~[^~\n]+~~/g, '');

    // Remove blockquotes that mention historical/migration notes
    // These often contain references to deleted requirements
    const lines = stripped.split('\n');
    const filteredLines = [];
    let inHistoricalBlock = false;

    for (const line of lines) {
      // Check if we're entering a historical/migration note blockquote
      // Match patterns like:
      // > ⚠️ **HISTORICAL NOTE**
      // > ✅ **NEW REQUIREMENTS CREATED**
      // > **Note**: The following...deleted during REQ-075
      // > **Historical Note**:
      if (
        line.match(
          /^>\s*(?:⚠️|✅)?\s*\*{0,2}(?:HISTORICAL|MIGRATED|Migration Note|Note).*(?:deleted|migration|REQ-\d{3})/i
        )
      ) {
        inHistoricalBlock = true;
      }

      // Exit historical block when we hit a non-blockquote line or empty blockquote
      if (inHistoricalBlock && (!line.startsWith('>') || line.trim() === '>')) {
        // Stay in block if it's a blockquote line
        if (!line.startsWith('>')) {
          inHistoricalBlock = false;
        }
      }

      // Skip lines in historical blocks
      if (!inHistoricalBlock) {
        filteredLines.push(line);
      }
    }

    return filteredLines.join('\n');
  }

  validateReferences() {
    console.log(chalk.blue('🔍 Validating epic/requirement references...'));

    // Build index of existing epics and requirements
    const epicIndex = this.buildFileIndex('docs/planning/epics');
    const reqIndex = this.buildFileIndex('docs/requirements');

    // Track warnings per file to avoid duplicates
    const warningsPerFile = new Map();

    // Check references
    for (const dir of this.scanDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(dirPath)) continue;

      this.scanDirectory(dirPath, (filePath) => {
        if (!filePath.endsWith('.md')) return;

        const content = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(this.projectRoot, filePath);

        // Skip examples and guides - they contain sample REQ references
        if (
          relPath.includes('/examples/') ||
          relPath.includes('/getting-started/')
        ) {
          return;
        }

        // Strip code blocks to avoid false positives from command examples
        const strippedContent = this.stripCodeBlocks(content);

        // Check epic references
        const epicRefs = strippedContent.match(/EPIC-\d{3}/g);
        if (epicRefs) {
          const uniqueEpicRefs = [...new Set(epicRefs)];
          for (const ref of uniqueEpicRefs) {
            if (!epicIndex.has(ref)) {
              this.errors.push({
                type: 'EPIC_NOT_FOUND',
                file: relPath,
                reference: ref,
                message: `Reference to ${ref} but no epic file found`,
                fix: `Check if epic was renamed or create docs/planning/epics/epic-${ref.toLowerCase()}.md`
              });
            }
          }
        }

        // Check requirement references (deduplicate per file)
        const reqRefs = strippedContent.match(/REQ-\d{3}/g);
        if (reqRefs) {
          const uniqueReqRefs = [...new Set(reqRefs)];
          for (const ref of uniqueReqRefs) {
            if (!reqIndex.has(ref)) {
              const key = `${relPath}:${ref}`;
              if (!warningsPerFile.has(key)) {
                warningsPerFile.set(key, true);
                this.warnings.push({
                  type: 'REQUIREMENT_NOT_FOUND',
                  file: relPath,
                  reference: ref,
                  message: `Reference to ${ref} but no requirement file found`,
                  fix: `Create requirement file or verify reference is correct`
                });
              }
            }
          }
        }
      });
    }
  }

  /**
   * Validate duplicate IDs in milestones, epics, and requirements
   */
  validateDuplicateIds() {
    console.log(chalk.blue('🔍 Checking for duplicate IDs...'));

    const validateDuplicatesInDir = (dir, _idPattern, type) => {
      const dirPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(dirPath)) return;

      const idsFound = new Map(); // id -> [files]

      this.scanDirectory(dirPath, (filePath) => {
        if (!filePath.endsWith('.md')) return;

        const content = fs.readFileSync(filePath, 'utf8');
        const relPath = path.relative(this.projectRoot, filePath);

        // Extract ID from frontmatter
        const idMatch = content.match(/^id:\s*([^\n]+)$/m);
        if (idMatch) {
          const id = idMatch[1].trim().replace(/['"]/g, '');

          if (!idsFound.has(id)) {
            idsFound.set(id, []);
          }
          idsFound.get(id).push(relPath);
        }
      });

      // Report duplicates
      for (const [id, files] of idsFound.entries()) {
        if (files.length > 1) {
          this.errors.push({
            type: 'DUPLICATE_ID',
            category: type,
            id,
            files,
            message: `Duplicate ${type} ID "${id}" found in ${files.length} files`,
            fix: `Ensure each ${type} has a unique ID. Keep the canonical one and update or remove duplicates.`
          });
        }
      }
    };

    // Validate each document type
    validateDuplicatesInDir('docs/planning/roadmap', /MILE-\d{3}/, 'milestone');
    validateDuplicatesInDir('docs/planning/epics', /EPIC-\d{3}/, 'epic');
    validateDuplicatesInDir('docs/requirements', /REQ-\d{3}/, 'requirement');
  }

  /**
   * Validate ID-filename consistency
   */
  validateIdFilenameConsistency() {
    console.log(chalk.blue('🔍 Checking ID-filename consistency...'));

    const checkDir = (dir, _idPattern, _prefix) => {
      const dirPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(dirPath)) return;

      this.scanDirectory(dirPath, (filePath) => {
        if (!filePath.endsWith('.md')) return;

        const _basename = path.basename(filePath, '.md');
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract ID from frontmatter
        const idMatch = content.match(/^id:\s*([A-Z]+-\d{3})/m);
        if (!idMatch) return;

        const id = idMatch[1];
        // Lowercase the ID for comparison with filename (e.g., "EPIC-001" -> "epic-001")
        const expectedPrefix = id.toLowerCase();
        const actualFilename = path.basename(filePath);

        // Check if filename starts with the expected prefix (allowing descriptive suffixes)
        if (!actualFilename.startsWith(expectedPrefix)) {
          this.errors.push({
            type: 'ID_FILENAME_MISMATCH',
            file: path.relative(this.projectRoot, filePath),
            id,
            actual: actualFilename,
            expected: `${expectedPrefix}-*.md or ${expectedPrefix}.md`,
            message: `File "${actualFilename}" contains ID "${id}" but filename should start with "${expectedPrefix}"`,
            fix: `Rename file to start with ${expectedPrefix}`
          });
        }
      });
    };

    checkDir('docs/planning/epics', /EPIC-\d{3}/, 'epic-');
    checkDir('docs/requirements', /REQ-\d{3}/, 'req-');
  }

  /**
   * Fix ID-filename mismatches by updating frontmatter IDs to match filenames
   */
  async fixIdFilenameMismatches(dryRun = false) {
    const prefix = dryRun ? '🔍 Preview' : '🔧 Fixing';
    console.log(chalk.blue(`${prefix} ID-filename mismatches...`));

    const idMismatchErrors = this.errors.filter(
      (e) => e.type === 'ID_FILENAME_MISMATCH'
    );

    if (idMismatchErrors.length === 0) {
      console.log(chalk.green('✅ No ID-filename mismatches to fix'));
      return { fixed: 0, failed: 0 };
    }

    if (dryRun) {
      console.log(
        chalk.yellow(`\n📋 Would fix ${idMismatchErrors.length} file(s):\n`)
      );
    }

    let fixed = 0;
    let failed = 0;

    for (const error of idMismatchErrors) {
      try {
        const filePath = path.join(this.projectRoot, error.file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract the expected ID from the filename
        // Filename patterns: epic-001-... or req-086-... or req-infra-080-...
        const filename = path.basename(error.file, '.md');

        let newId;
        if (filename.startsWith('epic-')) {
          const match = filename.match(/^epic-(\d{3})/);
          if (match) {
            newId = `EPIC-${match[1]}`;
          }
        } else if (filename.startsWith('req-')) {
          // Extract first number after req- (handling req-086- or req-infra-080-)
          const match = filename.match(/^req-(?:[a-z]+-)?(\d{3})/);
          if (match) {
            newId = `REQ-${match[1]}`;
          }
        }

        if (!newId) {
          console.log(chalk.red(`❌ Could not parse filename: ${error.file}`));
          failed++;
          continue;
        }

        // Replace the ID in frontmatter
        const updatedContent = content.replace(
          /^id:\s*[A-Z]+-\d{3}/m,
          `id: ${newId}`
        );

        if (updatedContent === content) {
          console.log(chalk.yellow(`⚠️  No change made to ${error.file}`));
          failed++;
          continue;
        }

        if (dryRun) {
          // Dry run: just show what would be done
          console.log(chalk.cyan(`   ${error.file}: ${error.id} → ${newId}`));
          fixed++;
        } else {
          // Actually write the file
          fs.writeFileSync(filePath, updatedContent, 'utf8');
          console.log(
            chalk.green(`✅ Fixed ${error.file}: ${error.id} → ${newId}`)
          );
          fixed++;
        }
      } catch (err) {
        console.log(chalk.red(`❌ Error fixing ${error.file}: ${err.message}`));
        failed++;
      }
    }

    if (dryRun && fixed > 0) {
      console.log(
        chalk.yellow(
          `\n💡 Run with --fix (without --dry-run) to apply these changes`
        )
      );
    }

    return { fixed, failed };
  }

  /**
   * Helper: Build file index by ID
   */
  buildFileIndex(dir) {
    const index = new Map();
    const dirPath = path.join(this.projectRoot, dir);

    if (!fs.existsSync(dirPath)) return index;

    this.scanDirectory(dirPath, (filePath) => {
      if (!filePath.endsWith('.md')) return;

      const content = fs.readFileSync(filePath, 'utf8');
      const idMatch = content.match(/^id:\s*([A-Z]+-\d{3})/m);

      if (idMatch) {
        index.set(idMatch[1], path.relative(this.projectRoot, filePath));
      }
    });

    return index;
  }

  /**
   * Helper: Recursively scan directory
   */
  scanDirectory(dir, callback) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.scanDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }

  /**
   * Helper: Check if README.md location is acceptable
   */
  isAcceptableReadmeLocation(relPath) {
    const acceptableDirs = [
      'docs',
      'docs/features',
      'docs/planning',
      'docs/requirements',
      'docs/guides',
      'docs/reference'
    ];

    const dir = path.dirname(relPath);
    return acceptableDirs.includes(dir);
  }

  /**
   * Helper: Suggest descriptive name based on path
   */
  suggestDescriptiveName(relPath) {
    const parts = relPath.split(path.sep);
    const featureName = parts[parts.length - 2]; // Parent directory
    const currentName = path.basename(relPath, '.md');

    if (currentName === 'implementation') {
      return `${featureName}-implementation.md`;
    } else if (currentName === 'plan') {
      return `${featureName}-plan.md`;
    }

    return `${featureName}-${currentName}.md`;
  }

  /**
   * Run all validations
   */
  async validate(options = {}) {
    const { logFile = null, verbose = false } = options;

    console.log(chalk.bold('\n📋 Documentation Validation System\n'));

    this.errors = [];
    this.warnings = [];
    this.logFile = logFile;
    this.verbose = verbose;

    this.validateGenericFilenames();
    this.validateFileReferences();
    this.validateReferences();
    this.validateDuplicateIds();
    this.validateIdFilenameConsistency();

    this.printResults();

    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Print validation results
   */
  printResults() {
    const outputBuffer = [];
    const consoleOutput = [];

    const log = (message, consoleOnly = false) => {
      if (!consoleOnly) {
        outputBuffer.push(message);
      }
      consoleOutput.push(message);
    };

    log(chalk.bold('\n📊 Validation Results:\n'));

    // Print errors (compact format)
    if (this.errors.length > 0) {
      log(chalk.red.bold(`\n❌ ${this.errors.length} Error(s):\n`));

      for (const error of this.errors) {
        const fileInfo = error.file || error.paths?.[0] || '';

        // Handle DUPLICATE_ID errors with special formatting
        if (error.type === 'DUPLICATE_ID') {
          if (this.verbose) {
            log(
              chalk.red(
                `❌ DUPLICATE_ID: ${error.category} ${error.id} (${error.files.length} files)`
              )
            );
            error.files.forEach((f) => log(chalk.gray(`     - ${f}`)));
            log(chalk.yellow(`   ${error.message}`));
            log(chalk.cyan(`   Fix: ${error.fix}`));
            log('');
          } else {
            console.log(
              chalk.red(
                `❌ DUPLICATE_ID | ${error.category} ${error.id} | Found in ${error.files.length} files | ${error.message}`
              )
            );
            outputBuffer.push(
              `❌ DUPLICATE_ID: ${error.category} ${error.id} (${error.files.length} files)`
            );
            error.files.forEach((f) => outputBuffer.push(`     - ${f}`));
            outputBuffer.push(`   ${error.message}`);
            outputBuffer.push(`   Fix: ${error.fix}`);
            outputBuffer.push('');
          }
          continue;
        }

        // Compact format: ERROR_TYPE | file/path.md | Reference | Message
        const compactLine = `❌ ${error.type} | ${fileInfo}${error.reference ? ` | ${error.reference}` : ''} | ${error.message}`;

        if (this.verbose) {
          // Verbose: show full details
          log(chalk.red(`❌ ${error.type}: ${fileInfo}`));
          if (error.reference)
            log(chalk.gray(`   Reference: ${error.reference}`));
          if (error.id) {
            log(chalk.gray(`   ID: ${error.id}`));
            log(chalk.gray(`   Actual: ${error.actual}`));
            log(chalk.gray(`   Expected: ${error.expected}`));
          }
          if (error.paths && error.paths.length > 1) {
            log(chalk.gray(`   Count: ${error.count}`));
            error.paths.forEach((p) => log(chalk.gray(`     - ${p}`)));
          }
          log(chalk.yellow(`   ${error.message}`));
          log(chalk.cyan(`   Fix: ${error.fix}`));
          log('');
        } else {
          // Compact: single line per error
          console.log(chalk.red(compactLine));
          // Log full details to file
          outputBuffer.push(`❌ ${error.type}: ${fileInfo}`);
          if (error.reference)
            outputBuffer.push(`   Reference: ${error.reference}`);
          if (error.id) {
            outputBuffer.push(`   ID: ${error.id}`);
            outputBuffer.push(`   Actual: ${error.actual}`);
            outputBuffer.push(`   Expected: ${error.expected}`);
          }
          if (error.paths && error.paths.length > 1) {
            outputBuffer.push(`   Count: ${error.count}`);
            error.paths.forEach((p) => outputBuffer.push(`     - ${p}`));
          }
          outputBuffer.push(`   ${error.message}`);
          outputBuffer.push(`   Fix: ${error.fix}`);
          outputBuffer.push('');
        }
      }
    }

    // Print warnings (compact format)
    if (this.warnings.length > 0) {
      log(chalk.yellow.bold(`\n⚠️  ${this.warnings.length} Warning(s):\n`));

      // Show first 10 warnings in console, rest go to file
      const displayWarnings = this.verbose
        ? this.warnings
        : this.warnings.slice(0, 10);
      const hiddenWarnings = this.warnings.length - displayWarnings.length;

      for (const warning of displayWarnings) {
        const fileInfo = warning.path || warning.file || '';

        // Compact format: WARNING_TYPE | file/path.md | Reference | Message
        const compactLine = `⚠️  ${warning.type} | ${fileInfo}${warning.reference ? ` | ${warning.reference}` : ''} | ${warning.message}`;

        if (this.verbose) {
          // Verbose: show full details
          log(chalk.yellow(`⚠️  ${warning.type}: ${fileInfo}`));
          if (warning.reference)
            log(chalk.gray(`   Reference: ${warning.reference}`));
          log(chalk.yellow(`   ${warning.message}`));
          log(chalk.cyan(`   Fix: ${warning.fix}`));
          log('');
        } else {
          // Compact: single line per warning
          console.log(chalk.yellow(compactLine));
        }
      }

      // Log ALL warnings to file (full details)
      for (const warning of this.warnings) {
        const fileInfo = warning.path || warning.file || '';
        outputBuffer.push(`⚠️  ${warning.type}: ${fileInfo}`);
        if (warning.reference)
          outputBuffer.push(`   Reference: ${warning.reference}`);
        outputBuffer.push(`   ${warning.message}`);
        outputBuffer.push(`   Fix: ${warning.fix}`);
        outputBuffer.push('');
      }

      if (hiddenWarnings > 0) {
        console.log(
          chalk.gray(
            `\n... and ${hiddenWarnings} more warnings (see log file for full details)`
          )
        );
      }
    }

    // Summary
    log(chalk.bold(`\n${'='.repeat(60)}`));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      log(chalk.green.bold('✅ All documentation validation checks passed!'));
    } else {
      const summary = [];
      if (this.errors.length > 0) {
        summary.push(chalk.red(`${this.errors.length} error(s)`));
      }
      if (this.warnings.length > 0) {
        summary.push(chalk.yellow(`${this.warnings.length} warning(s)`));
      }
      log(chalk.bold(`📊 Summary: ${summary.join(', ')}`));
    }

    log(chalk.bold('='.repeat(60)));

    // Write to log file if specified
    if (this.logFile) {
      const fs = require('node:fs');
      const path = require('node:path');
      const logPath = path.join(this.projectRoot, this.logFile);

      // Strip ANSI color codes for file output
      const ansiStripRegex = /\x1b\[\d+m/g; // eslint-disable-line no-control-regex
      const cleanOutput = outputBuffer
        .map((line) => line.replace(ansiStripRegex, ''))
        .join('\n');

      fs.writeFileSync(logPath, cleanOutput);
      console.log(
        chalk.gray(`\n📄 Full validation log saved to: ${this.logFile}`)
      );
    }
  }
}

// CLI Interface
async function main() {
  const hasFixFlag = process.argv.includes('--fix');

  const validator = new DocumentationValidator();
  const result = await validator.validate();

  if (hasFixFlag && !result.success) {
    console.log(chalk.blue('\n🔧 Applying fixes...\n'));
    const fixResult = await validator.fixIdFilenameMismatches();

    console.log(chalk.blue('\n📊 Fix Summary:'));
    console.log(chalk.green(`   ✅ Fixed: ${fixResult.fixed}`));
    if (fixResult.failed > 0) {
      console.log(chalk.red(`   ❌ Failed: ${fixResult.failed}`));
    }

    // Re-validate
    console.log(chalk.blue('\n🔍 Re-validating...\n'));
    const finalResult = await validator.validate();

    process.exit(finalResult.success ? 0 : 1);
  }

  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = DocumentationValidator;
