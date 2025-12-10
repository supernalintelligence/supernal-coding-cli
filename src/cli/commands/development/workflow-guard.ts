#!/usr/bin/env node
// @ts-nocheck

/**
 * Workflow Guard System
 *
 * Prevents common workflow violations and ensures proper requirement-driven development
 */

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { execSync } = require('node:child_process');

class WorkflowGuard {
  projectRoot: any;
  verbose: any;
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
  }

  /**
   * Check if currently on main branch
   */
  isOnMainBranch() {
    try {
      const branch = execSync('git branch --show-current', {
        encoding: 'utf8',
      }).trim();
      return branch === 'main' || branch === 'master';
    } catch (_error) {
      return false;
    }
  }

  /**
   * Check if commit has requirement reference
   */
  hasRequirementReference(commitMessage) {
    const reqPattern = /\b(REQ-\d+|req-\d+)\b/i;
    return reqPattern.test(commitMessage);
  }

  /**
   * Check if changes are significant (not just docs or minor fixes)
   */
  areChangesSignificant(files) {
    const significantPatterns = [
      /^cli\/commands\//,
      /^cli\/index\.js$/,
      /\.js$/,
      /\.ts$/,
      /package\.json$/,
    ];

    const minorPatterns = [
      /\.md$/,
      /README/i,
      /CHANGELOG/i,
      /\.gitignore$/,
      /\.txt$/,
    ];

    const significantFiles = files.filter((file) =>
      significantPatterns.some((pattern) => pattern.test(file))
    );

    const onlyMinorFiles = files.every((file) =>
      minorPatterns.some((pattern) => pattern.test(file))
    );

    return significantFiles.length > 0 && !onlyMinorFiles;
  }

  /**
   * Pre-commit check
   */
  async preCommitCheck() {
    console.log(chalk.blue('🔍 Workflow Guard: Pre-commit validation'));

    const issues = [];
    const warnings = [];

    // Check if on main branch
    const onMain = this.isOnMainBranch();

    // Get staged files
    const stagedFiles = this.getStagedFiles();

    // Check if changes are significant
    const significantChanges = this.areChangesSignificant(stagedFiles);

    if (this.verbose) {
      console.log(
        `Debug: onMain=${onMain}, stagedFiles=${JSON.stringify(stagedFiles)}, significantChanges=${significantChanges}`
      );
    }

    if (onMain && significantChanges) {
      issues.push({
        type: 'MAIN_BRANCH_DEVELOPMENT',
        message: 'Significant development work detected on main branch',
        suggestion:
          'Create feature branch: git checkout -b feature/req-XXX-description',
      });
    }

    // Check commit message for requirement reference
    const commitMessage = this.getCommitMessage();
    if (significantChanges && !this.hasRequirementReference(commitMessage)) {
      warnings.push({
        type: 'MISSING_REQUIREMENT_REFERENCE',
        message: 'No requirement reference found in commit message',
        suggestion:
          'Include REQ-XXX in commit message or create requirement first',
      });
    }

    // Check for new features without requirements
    const hasNewFeatures = this.detectNewFeatures(stagedFiles);
    if (hasNewFeatures && !this.hasRequirementReference(commitMessage)) {
      // Try to suggest related requirements
      const relatedReqs = await this.searchRelatedRequirements(
        stagedFiles,
        commitMessage
      );

      issues.push({
        type: 'NEW_FEATURE_WITHOUT_REQUIREMENT',
        message: 'New feature detected without requirement reference',
        suggestion:
          relatedReqs.length > 0
            ? `Search existing requirements first: ${relatedReqs.slice(0, 3).join(', ')} or create new: sc req new "Feature Name"`
            : 'Search existing requirements first: sc req search "keywords" or create new: sc req new "Feature Name"',
      });
    }

    // Run ESLint check on staged files
    const lintIssues = await this.runESLintCheck(stagedFiles);
    if (lintIssues.length > 0) {
      issues.push({
        type: 'ESLINT_ERRORS',
        message: `ESLint found ${lintIssues.length} error(s) in staged files`,
        suggestion: 'Fix ESLint errors with: npm run lint:fix',
        details: lintIssues,
      });
    }

    return { issues, warnings, onMain, significantChanges };
  }

  /**
   * Run ESLint check on staged files
   */
  async runESLintCheck(stagedFiles) {
    const jsFiles = stagedFiles.filter(
      (file) =>
        /\.(js|ts|jsx|tsx)$/.test(file) &&
        !file.includes('node_modules/') &&
        !file.includes('.git/')
    );

    if (jsFiles.length === 0) {
      return [];
    }

    try {
      const { execSync } = require('node:child_process');
      const _result = execSync(
        `npx eslint ${jsFiles.join(' ')} --format json`,
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );

      // If ESLint returns successfully, there are no errors
      return [];
    } catch (error) {
      if (error.stdout) {
        try {
          const eslintResults = JSON.parse(error.stdout);
          const issues = [];

          eslintResults.forEach((result) => {
            result.messages.forEach((message) => {
              if (message.severity === 2) {
                // Only errors, not warnings
                issues.push({
                  file: result.filePath,
                  line: message.line,
                  column: message.column,
                  rule: message.ruleId,
                  message: message.message,
                });
              }
            });
          });

          return issues;
        } catch (parseError) {
          console.warn('Failed to parse ESLint output:', parseError.message);
          return [];
        }
      }

      // If there's no stdout, assume ESLint isn't configured or available
      console.warn('ESLint check failed:', error.message);
      return [];
    }
  }

  /**
   * Get staged files for commit
   */
  getStagedFiles() {
    try {
      const output = execSync('git diff --cached --name-only', {
        encoding: 'utf8',
      });
      return output.trim().split('\n').filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get modified (unstaged) files
   */
  getModifiedFiles() {
    try {
      const output = execSync('git diff --name-only', { encoding: 'utf8' });
      return output.trim().split('\n').filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get commit message (for pre-commit hooks)
   */
  getCommitMessage() {
    try {
      // Try to read from COMMIT_EDITMSG if available
      const commitMsgFile = path.join(
        this.projectRoot,
        '.git',
        'COMMIT_EDITMSG'
      );
      if (fs.existsSync(commitMsgFile)) {
        return fs.readFileSync(commitMsgFile, 'utf8').trim();
      }
    } catch (_error) {
      // Ignore errors
    }
    return '';
  }

  /**
   * Detect if staged files indicate new features
   */
  detectNewFeatures(files) {
    const newFeatureIndicators = [
      /^cli\/commands\/[^/]+\/[^/]+\.js$/, // New command files
      /^cli\/index\.js$/, // CLI modifications
      /package\.json$/, // New dependencies
    ];

    return files.some((file) =>
      newFeatureIndicators.some((pattern) => pattern.test(file))
    );
  }

  /**
   * Display workflow guidance
   */
  showWorkflowGuidance() {
    console.log(chalk.blue.bold('📋 Proper Workflow Guide'));
    console.log(chalk.blue('='.repeat(50)));
    console.log('');

    console.log(chalk.yellow('✅ Correct Process:'));
    console.log('1. Search for existing requirements first:');
    console.log(`   ${chalk.cyan('sc req search "feature keywords"')}`);
    console.log('');
    console.log('2. Create requirement if none found:');
    console.log(
      `   ${chalk.cyan('sc req new "Feature Name" --epic=epic-name --priority=high')}`
    );
    console.log('');
    console.log('3. Start work on requirement:');
    console.log(`   ${chalk.cyan('sc req start-work REQ-XXX')}`);
    console.log('');
    console.log('4. Commit requirement to main:');
    console.log(
      `   ${chalk.cyan('sc git-smart req-commit REQ-XXX "Started work"')}`
    );
    console.log('');
    console.log('5. Create feature branch:');
    console.log(
      `   ${chalk.cyan('git checkout -b feature/req-XXX-feature-name')}`
    );
    console.log('');
    console.log('6. Implement feature on branch');
    console.log('');
    console.log('7. Merge safely:');
    console.log(`   ${chalk.cyan('sc git-smart merge')}`);
    console.log('');

    console.log(chalk.red('❌ What NOT to do:'));
    console.log('• Implement features directly on main');
    console.log('• Create requirements after implementation');
    console.log('• Skip requirement creation for new features');
    console.log('');
  }

  /**
   * Install pre-commit hook
   */
  async installPreCommitHook() {
    const hookPath = path.join(this.projectRoot, '.git', 'hooks', 'pre-commit');
    const hookContent = `#!/bin/sh
# Supernal Coding Workflow Guard

sc workflow-guard pre-commit

if [ $? -ne 0 ]; then
  echo ""
  echo "🔍 Run 'sc workflow guide' for proper workflow guidance"
  exit 1
fi
`;

    await fs.writeFile(hookPath, hookContent);
    await fs.chmod(hookPath, '755');

    console.log(chalk.green('✅ Pre-commit hook installed'));
    console.log(`   ${hookPath}`);
  }

  /**
   * Main execution
   */
  async execute(action) {
    switch (action) {
      case 'pre-commit':
        return this.runPreCommitValidation();
      case 'pre-add':
        return this.runPreAddValidation();
      case 'install-hooks':
        return this.installPreCommitHook();
      case 'guide':
        return this.showWorkflowGuidance();
      case 'check':
        return this.runWorkflowCheck();
      default:
        return this.showHelp();
    }
  }

  /**
   * Run pre-add validation (prevent staging on main without force)
   */
  async runPreAddValidation() {
    const onMain = this.isOnMainBranch();
    const filesToAdd = process.argv.slice(3); // Get files to be added

    if (!onMain) {
      // Still check for template validation on feature branches
      await this.validateTemplates(
        filesToAdd.length > 0 ? filesToAdd : this.getModifiedFiles()
      );

      if (this.verbose) {
        console.log(
          chalk.green('✅ Pre-add: On feature branch, staging allowed')
        );
      }
      return;
    }

    // Check if --force flag is present
    const hasForce =
      process.argv.includes('--force') || process.argv.includes('-f');
    if (hasForce) {
      console.log(
        chalk.yellow(
          '⚠️  Pre-add: Force flag detected, allowing staging on main'
        )
      );
      return;
    }

    // First, validate templates in requirement files
    await this.validateTemplates(
      filesToAdd.length > 0 ? filesToAdd : this.getModifiedFiles()
    );

    // Determine if changes are significant
    const significantChanges =
      filesToAdd.length === 0 ||
      this.areChangesSignificant(
        filesToAdd.length > 0 ? filesToAdd : this.getModifiedFiles()
      );

    if (significantChanges) {
      console.log(
        chalk.red('❌ STAGING BLOCKED: Significant changes on main branch')
      );
      console.log(chalk.red('='.repeat(50)));
      console.log('');
      console.log(
        chalk.yellow(
          '🚫 You are trying to stage significant changes on the main branch.'
        )
      );
      console.log(
        chalk.yellow('   This violates the proper development workflow.')
      );
      console.log('');

      // Suggest related requirements if available
      const relatedReqs = await this.searchRelatedRequirements(
        filesToAdd.length > 0 ? filesToAdd : this.getModifiedFiles(),
        ''
      );

      if (relatedReqs.length > 0) {
        console.log(chalk.blue('💡 Found potentially related requirements:'));
        relatedReqs.slice(0, 3).forEach((req) => {
          console.log(`   • ${chalk.cyan(req)}`);
        });
        console.log('');
      }

      console.log(chalk.yellow('✅ Proper workflow:'));
      console.log('1. Search existing requirements:');
      console.log(`   ${chalk.cyan('sc req search "keywords"')}`);
      console.log('2. Create/update requirement:');
      console.log(
        `   ${chalk.cyan('sc req new "Feature Name"')} or ${chalk.cyan('sc req update REQ-XXX')}`
      );
      console.log('3. Start work on requirement:');
      console.log(`   ${chalk.cyan('sc req start-work REQ-XXX')}`);
      console.log('');
      console.log(chalk.yellow('🆘 Emergency override:'));
      console.log(
        `   ${chalk.cyan('git add --force <files>')} (use with extreme caution)`
      );
      console.log('');

      process.exit(1);
    }

    // Allow minor changes (requirements, documentation)
    console.log(chalk.green('✅ Minor changes on main allowed'));
  }

  /**
   * Validate templates in requirement files
   */
  async validateTemplates(files = []) {
    try {
      const {
        TemplateValidator,
      } = require('../../../validation/TemplateValidator');
      const validator = new TemplateValidator({
        projectRoot: this.projectRoot,
        verbose: this.verbose,
      });

      // Filter for requirement files
      const reqFiles = files.filter(
        (file) =>
          file.includes('requirements') &&
          file.endsWith('.md') &&
          file.includes('req-')
      );

      if (reqFiles.length === 0) {
        return; // No requirement files to validate
      }

      if (this.verbose) {
        console.log(
          chalk.blue(
            `🔍 Validating ${reqFiles.length} requirement template(s)...`
          )
        );
      }

      const results = await validator.validateFiles(
        reqFiles.map((f) =>
          path.isAbsolute(f) ? f : path.join(this.projectRoot, f)
        )
      );

      const summary = validator.getSummary(results);

      if (summary.shouldBlock) {
        console.log(chalk.red('❌ TEMPLATE VALIDATION FAILED'));
        console.log(chalk.red('='.repeat(50)));
        console.log('');

        console.log(
          validator.formatResults(results, { verbose: this.verbose })
        );

        console.log(chalk.yellow('🔧 To fix template issues:'));
        console.log(
          `   ${chalk.cyan('sc req validate REQ-XXX')}     # Validate specific requirement`
        );
        console.log(
          `   ${chalk.cyan('sc test validate templates')}  # Validate all templates`
        );
        console.log('');
        console.log(chalk.yellow('🆘 Emergency override:'));
        console.log(
          `   ${chalk.cyan('git add --force <files>')}     # Bypass template validation`
        );
        console.log('');

        process.exit(1);
      }

      if (this.verbose && summary.warnings > 0) {
        console.log(
          chalk.yellow(`⚠️  ${summary.warnings} template warnings found`)
        );
        console.log(validator.formatResults(results, { verbose: false }));
      }
    } catch (error) {
      console.log(
        chalk.yellow(`⚠️  Template validation failed: ${error.message}`)
      );
      if (this.verbose) {
        console.error(error.stack);
      }
    }
  }

  /**
   * Validate templates in staged files
   */
  async validateStagedTemplates() {
    try {
      const {
        TemplateValidator,
      } = require('../../../validation/TemplateValidator');
      const validator = new TemplateValidator({
        projectRoot: this.projectRoot,
        verbose: this.verbose,
      });

      const results = await validator.validateStagedFiles();
      const summary = validator.getSummary(results);

      if (summary.shouldBlock) {
        console.log(chalk.red('❌ STAGED TEMPLATE VALIDATION FAILED'));
        console.log(chalk.red('='.repeat(50)));
        console.log('');

        console.log(
          validator.formatResults(results, { verbose: this.verbose })
        );

        console.log(chalk.yellow('🔧 To fix before committing:'));
        console.log(
          `   ${chalk.cyan('sc req validate REQ-XXX')}     # Validate specific requirement`
        );
        console.log(
          `   ${chalk.cyan('git restore --staged <file>')} # Unstage incomplete template`
        );
        console.log('');
        console.log(chalk.yellow('🆘 Emergency override:'));
        console.log(
          `   ${chalk.cyan('git commit --no-verify')}      # Bypass validation (not recommended)`
        );
        console.log('');

        process.exit(1);
      }
    } catch (error) {
      if (this.verbose) {
        console.log(
          chalk.yellow(
            `⚠️  Staged template validation failed: ${error.message}`
          )
        );
      }
    }
  }

  /**
   * Run pre-commit validation
   */
  async runPreCommitValidation() {
    // First validate templates in staged files
    await this.validateStagedTemplates();

    const { issues, warnings, onMain, significantChanges } =
      await this.preCommitCheck();

    if (issues.length > 0) {
      console.log(chalk.red('❌ Workflow violations detected:'));
      issues.forEach((issue) => {
        console.log(`  • ${issue.message}`);
        console.log(`    ${chalk.gray(issue.suggestion)}`);
      });
      console.log('');
      this.showWorkflowGuidance();
      process.exit(1);
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Workflow warnings:'));
      warnings.forEach((warning) => {
        console.log(`  • ${warning.message}`);
        console.log(`    ${chalk.gray(warning.suggestion)}`);
      });
      console.log('');
    }

    if (onMain && significantChanges) {
      console.log(
        chalk.blue('💡 Consider creating a feature branch for this work')
      );
    }

    return true;
  }

  /**
   * Run workflow check (can be called manually)
   */
  async runWorkflowCheck() {
    console.log(chalk.blue('🔍 Workflow Status Check'));
    console.log(chalk.blue('='.repeat(40)));

    const onMain = this.isOnMainBranch();
    console.log(
      `Current branch: ${onMain ? chalk.red('main') : chalk.green('feature branch')}`
    );

    if (onMain) {
      console.log(chalk.yellow('⚠️  You are on the main branch'));
      console.log('   Consider creating a feature branch for development work');
    }

    // Check for uncommitted changes
    try {
      execSync('git diff --quiet && git diff --cached --quiet');
      console.log(chalk.green('✅ No uncommitted changes'));
    } catch (_error) {
      console.log(chalk.yellow('⚠️  You have uncommitted changes'));
      const staged = this.getStagedFiles();
      if (staged.length > 0) {
        console.log(`   Staged files: ${staged.join(', ')}`);
      }
    }

    console.log('');
    console.log(chalk.blue('💡 Quick actions:'));
    console.log(
      `  ${chalk.cyan('sc workflow guide')}        # Show workflow guidance`
    );
    console.log(
      `  ${chalk.cyan('sc req new "Title"')}        # Create new requirement`
    );
    console.log(
      `  ${chalk.cyan('sc git-smart status')}      # Check git status`
    );
  }

  /**
   * Search for related requirements based on files and commit message
   */
  async searchRelatedRequirements(files, commitMessage) {
    try {
      const keywords = this.extractKeywords(files, commitMessage);
      if (keywords.length === 0) return [];

      const reqPattern = path.join(
        this.projectRoot,
        'supernal-coding',
        'requirements',
        '**',
        '*.md'
      );
      const { execSync } = require('node:child_process');

      // Search for requirements containing these keywords
      const searchTerms = keywords.slice(0, 3).join('|'); // Limit to top 3 keywords
      const grepCommand = `grep -l -i "${searchTerms}" ${reqPattern} 2>/dev/null || true`;

      const results = execSync(grepCommand, { encoding: 'utf8' });
      const reqFiles = results.trim().split('\n').filter(Boolean);

      // Extract requirement IDs from filenames
      const reqIds = reqFiles
        .map((file) => {
          const match = file.match(/req-(\d+)/i);
          return match ? `REQ-${match[1]}` : null;
        })
        .filter(Boolean);

      return [...new Set(reqIds)]; // Remove duplicates
    } catch (_error) {
      return [];
    }
  }

  /**
   * Extract keywords from file paths and commit message for requirement search
   */
  extractKeywords(files, commitMessage) {
    const keywords = new Set();

    // Extract from file paths
    files.forEach((file) => {
      const pathParts = file.split('/');
      pathParts.forEach((part) => {
        // Extract meaningful words (ignore common terms)
        const words = part
          .replace(/\.(js|ts|md|json)$/, '')
          .split(/[-_.]/)
          .filter(
            (word) =>
              word.length > 2 &&
              !['cli', 'commands', 'index', 'test', 'spec'].includes(
                word.toLowerCase()
              )
          );
        words.forEach((word) => keywords.add(word.toLowerCase()));
      });
    });

    // Extract from commit message
    if (commitMessage) {
      const messageWords = commitMessage
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 3 &&
            !['test', 'fix', 'add', 'update', 'remove'].includes(word)
        );
      messageWords.forEach((word) => keywords.add(word));
    }

    return Array.from(keywords).slice(0, 5); // Return top 5 keywords
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(chalk.blue.bold('🛡️  Workflow Guard'));
    console.log(chalk.blue('='.repeat(40)));
    console.log('');
    console.log('Commands:');
    console.log(
      `  ${chalk.cyan('pre-commit')}       # Validate pre-commit (used by git hook)`
    );
    console.log(
      `  ${chalk.cyan('install-hooks')}    # Install git pre-commit hook`
    );
    console.log(`  ${chalk.cyan('guide')}            # Show workflow guidance`);
    console.log(
      `  ${chalk.cyan('check')}            # Check current workflow status`
    );
    console.log('');
    console.log('Examples:');
    console.log(`  ${chalk.cyan('sc workflow-guard guide')}`);
    console.log(`  ${chalk.cyan('sc workflow-guard check')}`);
  }
}

// CLI execution
if (require.main === module) {
  const action = process.argv[2] || 'help';
  const guard = new WorkflowGuard({
    verbose: process.argv.includes('--verbose'),
  });

  guard.execute(action).catch((error) => {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  });
}

module.exports = WorkflowGuard;
