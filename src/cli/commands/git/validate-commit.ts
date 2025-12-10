#!/usr/bin/env node
// @ts-nocheck

/**
 * Git Commit Validation Script
 * Part of REQ-037: Comprehensive Auto-CSV Workflow System
 *
 * Validates:
 * - .mdc files have proper frontmatter
 * - Requirement files are complete
 * - No uncommitted .cursor rules
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const chalk = require('chalk');

class CommitValidator {
  validationFailed: any;
  constructor() {
    this.validationFailed = false;
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    console.log(colors[type](message));
  }

  checkMdcFrontmatter(filePath) {
    this.log(`  📝 Checking rule file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      this.log(`    ❌ File not found: ${filePath}`, 'error');
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Check if file starts with frontmatter
    if (!content.startsWith('---\n')) {
      this.log(`    ❌ Missing frontmatter in ${filePath}`, 'error');
      this.log(`    Required format:`, 'warning');
      this.log(`    ---`, 'warning');
      this.log(
        `    description: Clear description of what the rule enforces`,
        'warning'
      );
      this.log(`    globs: path/to/files/*.ext, other/path/**/*`, 'warning');
      this.log(`    alwaysApply: true/false`, 'warning');
      this.log(`    ---`, 'warning');
      return false;
    }

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      this.log(`    ❌ Invalid frontmatter format in ${filePath}`, 'error');
      return false;
    }

    const frontmatter = frontmatterMatch[1];

    // Check required fields
    const requiredFields = ['description:', 'globs:', 'alwaysApply:'];
    const missingFields = requiredFields.filter(
      (field) => !frontmatter.includes(field)
    );

    if (missingFields.length > 0) {
      this.log(
        `    ❌ Missing required fields in ${filePath}: ${missingFields.join(', ')}`,
        'error'
      );
      return false;
    }

    // Validate alwaysApply value
    const alwaysApplyMatch = frontmatter.match(/alwaysApply:\s*(true|false)/);
    if (!alwaysApplyMatch) {
      this.log(
        `    ❌ Invalid 'alwaysApply' value in ${filePath} (must be true or false)`,
        'error'
      );
      return false;
    }

    this.log(`    ✅ ${filePath} frontmatter valid`, 'success');
    return true;
  }

  checkRequirementFile(filePath) {
    this.log(`  📋 Checking requirement file: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      this.log(`    ❌ File not found: ${filePath}`, 'error');
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Check for placeholder content (WARNING ONLY - not blocking)
    const placeholders = [
      /\[.*\]/g,
      /to be defined/gi,
      /to be added/gi,
      /placeholder/gi,
      /TODO:/gi,
      /FIXME:/gi
    ];

    let hasPlaceholders = false;
    for (const placeholder of placeholders) {
      if (placeholder.test(content)) {
        hasPlaceholders = true;
        break;
      }
    }

    if (hasPlaceholders) {
      this.log(`    ⚠️ Placeholder content detected in ${filePath}`, 'warning');
      this.log(
        `    Consider completing the requirement before committing`,
        'warning'
      );
      const reqId = path.basename(filePath).match(/req-(\d{3})/)?.[1];
      if (reqId) {
        this.log(`    Recommended: sc req validate ${reqId}`, 'warning');
      }
      this.log(`    This is a warning - commit will proceed`, 'warning');
    }

    this.log(`    ✅ ${filePath} appears complete`, 'success');
    return true;
  }

  checkUncommittedCursorRules() {
    this.log(`  🎯 Checking for uncommitted .cursor rules`);

    try {
      // Check for untracked files in .cursor directory
      const untrackedFiles = execSync(
        'git ls-files --others --exclude-standard .cursor/',
        { encoding: 'utf8' }
      ).trim();

      if (untrackedFiles) {
        this.log(
          `    ❌ Uncommitted files detected in .cursor directory:`,
          'error'
        );
        untrackedFiles.split('\n').forEach((file) => {
          this.log(`      - ${file}`, 'error');
        });
        this.log(`    Please add these files to your commit:`, 'warning');
        this.log(`    git add .cursor/`, 'warning');
        return false;
      }

      // Check for modified but unstaged files in .cursor directory
      const modifiedFiles = execSync('git diff --name-only .cursor/', {
        encoding: 'utf8'
      }).trim();

      if (modifiedFiles) {
        this.log(
          `    ❌ Modified but unstaged files in .cursor directory:`,
          'error'
        );
        modifiedFiles.split('\n').forEach((file) => {
          this.log(`      - ${file}`, 'error');
        });
        this.log(`    Please stage these files:`, 'warning');
        this.log(`    git add .cursor/`, 'warning');
        return false;
      }

      this.log(`    ✅ No uncommitted .cursor rules detected`, 'success');
      return true;
    } catch (_error) {
      // If .cursor directory doesn't exist or git command fails, it's not an error
      this.log(
        `    ✅ No .cursor directory or no uncommitted rules`,
        'success'
      );
      return true;
    }
  }

  getStagedFiles() {
    try {
      return execSync('git diff --cached --name-only --diff-filter=ACM', {
        encoding: 'utf8'
      })
        .trim()
        .split('\n')
        .filter((f) => f);
    } catch (_error) {
      return [];
    }
  }

  validateCommitMessage() {
    this.log('📝 Validating commit message format...');

    try {
      // Get the commit message (if available from COMMIT_EDITMSG)
      const commitMsgFile = '.git/COMMIT_EDITMSG';
      if (fs.existsSync(commitMsgFile)) {
        const commitMsg = fs
          .readFileSync(commitMsgFile, 'utf8')
          .trim()
          .split('\n')[0];

        // Conventional commit format: type(scope): description
        const conventionalCommitRegex =
          /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .+/;

        if (!conventionalCommitRegex.test(commitMsg)) {
          this.log(
            `    ⚠️ Commit message doesn't follow conventional format`,
            'warning'
          );
          this.log(`    Current: ${commitMsg}`, 'warning');
          this.log(`    Expected: type(scope): description`, 'warning');
          this.log(`    Examples:`, 'warning');
          this.log(
            `      feat(REQ-037): add commit validation system`,
            'warning'
          );
          this.log(`      fix(auth): resolve login timeout issue`, 'warning');
          this.log(`      docs: update installation guide`, 'warning');
          // Don't fail - just warn
        } else {
          this.log(
            `    ✅ Commit message follows conventional format`,
            'success'
          );
        }
      } else {
        this.log(`    ℹ️ No commit message available for validation`, 'info');
      }
    } catch (error) {
      this.log(
        `    ℹ️ Unable to validate commit message: ${error.message}`,
        'info'
      );
    }
  }

  validateCommitSize() {
    this.log('📏 Checking commit size...');

    const stagedFiles = this.getStagedFiles();

    if (stagedFiles.length > 50) {
      this.log(
        `    ⚠️ Large commit detected: ${stagedFiles.length} files changed`,
        'warning'
      );
      this.log(
        `    Consider splitting into smaller, focused commits`,
        'warning'
      );
      this.log(
        `    Large commits make reviews difficult and increase merge conflicts`,
        'warning'
      );
      // Don't fail - just warn
    } else if (stagedFiles.length > 20) {
      this.log(
        `    ⚠️ Medium-sized commit: ${stagedFiles.length} files changed`,
        'warning'
      );
      this.log(
        `    Consider if this could be split into logical chunks`,
        'warning'
      );
    } else {
      this.log(
        `    ✅ Reasonable commit size: ${stagedFiles.length} files`,
        'success'
      );
    }
  }

  validate() {
    this.log('🔍 Supernal Coding Commit Validation');

    const stagedFiles = this.getStagedFiles();

    if (stagedFiles.length === 0) {
      this.log('  ✅ No staged files to validate', 'success');
      return true;
    }

    // Validate .mdc files
    this.log('📝 Validating .mdc rule files...');
    const mdcFiles = stagedFiles.filter((file) => file.endsWith('.mdc'));

    if (mdcFiles.length > 0) {
      for (const file of mdcFiles) {
        if (!this.checkMdcFrontmatter(file)) {
          this.validationFailed = true;
        }
      }
    } else {
      this.log('  ✅ No .mdc files to validate', 'success');
    }

    // Validate requirement files
    this.log('\n📋 Validating requirement files...');
    const reqFiles = stagedFiles.filter(
      (file) => file.includes('requirements/') && file.endsWith('.md')
    );

    if (reqFiles.length > 0) {
      for (const file of reqFiles) {
        if (!this.checkRequirementFile(file)) {
          this.validationFailed = true;
        }
      }
    } else {
      this.log('  ✅ No requirement files to validate', 'success');
    }

    // Check for uncommitted .cursor rules
    this.log('\n🎯 Checking .cursor directory...');
    if (!this.checkUncommittedCursorRules()) {
      this.validationFailed = true;
    }

    // Validate commit message format (warning only)
    this.log('');
    this.validateCommitMessage();

    // Validate commit size (warning only)
    this.log('');
    this.validateCommitSize();

    // Final result
    this.log('\n📊 Validation Summary');
    if (this.validationFailed) {
      this.log('❌ Commit validation FAILED', 'error');
      this.log('🔧 Fix the issues above before committing', 'warning');
      return false;
    } else {
      this.log('✅ All validations PASSED', 'success');
      this.log('🚀 Commit ready to proceed', 'success');
      return true;
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new CommitValidator();
  const success = validator.validate();
  process.exit(success ? 0 : 1);
}

module.exports = CommitValidator;
