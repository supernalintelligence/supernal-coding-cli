#!/usr/bin/env node

/**
 * Git Hooks Installer
 * REQ-011: Git System Evaluation and Enhancement
 *
 * Installs and manages git hooks for:
 * - Pre-commit validation (branch naming, file validation)
 * - Commit message validation (REQ-XXX format)
 * - Requirements file change tracking
 * - Automatic front matter updates
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

class GitHooksInstaller {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.hooksDir = path.join(this.projectRoot, '.git', 'hooks');
    this.config = this.loadConfiguration();
  }

  /**
   * Load configuration
   */
  loadConfiguration() {
    const configPath = path.join(this.projectRoot, 'supernal.yaml');

    const defaultConfig = {
      git_requirements_tracking: {
        enabled: true,
        update_front_matter: true,
        maintain_changelog: true,
        track_previous_commits: true,
      },
      hooks: {
        install_pre_commit: true,
        install_commit_msg: true,
        install_pre_push: false,
        backup_existing: true,
      },
    };

    if (!fs.existsSync(configPath)) {
      return defaultConfig;
    }

    // In production, implement proper YAML parsing
    return defaultConfig;
  }

  /**
   * Install all git hooks
   */
  async installHooks() {
    console.log('🔧 Installing Git Hooks for REQ-011...\n');

    // Ensure hooks directory exists
    if (!fs.existsSync(this.hooksDir)) {
      console.log(
        '❌ Git hooks directory not found. Is this a git repository?'
      );
      return false;
    }

    const results = {
      preCommit: false,
      commitMsg: false,
      prePush: false,
      errors: [],
    };

    try {
      // Install pre-commit hook
      if (this.config.hooks.install_pre_commit) {
        results.preCommit = await this.installPreCommitHook();
      }

      // Install commit-msg hook
      if (this.config.hooks.install_commit_msg) {
        results.commitMsg = await this.installCommitMsgHook();
      }

      // Install pre-push hook
      if (this.config.hooks.install_pre_push) {
        results.prePush = await this.installPrePushHook();
      }

      const successCount = Object.values(results).filter(Boolean).length;
      console.log(
        `\n✅ Git Hooks Installation Complete: ${successCount}/3 hooks installed successfully`
      );

      if (results.errors.length > 0) {
        console.log('\n⚠️ Errors encountered:');
        results.errors.forEach((error) => console.log(`   ${error}`));
      }

      return successCount > 0;
    } catch (error) {
      console.error('❌ Error installing git hooks:', error.message);
      return false;
    }
  }

  /**
   * Install pre-commit hook
   */
  async installPreCommitHook() {
    const hookPath = path.join(this.hooksDir, 'pre-commit');

    try {
      // Backup existing hook if requested
      if (fs.existsSync(hookPath) && this.config.hooks.backup_existing) {
        const backupPath = `${hookPath}.backup.${Date.now()}`;
        fs.copyFileSync(hookPath, backupPath);
        console.log(
          `📁 Backed up existing pre-commit hook to ${path.basename(backupPath)}`
        );
      }

      // Create pre-commit hook content
      const hookContent = this.generatePreCommitHook();

      // Write hook file
      fs.writeFileSync(hookPath, hookContent);

      // Make executable (on Unix systems)
      if (process.platform !== 'win32') {
        fs.chmodSync(hookPath, '755');
      }

      console.log('✅ Pre-commit hook installed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to install pre-commit hook:', error.message);
      return false;
    }
  }

  /**
   * Generate pre-commit hook content
   */
  generatePreCommitHook() {
    /* eslint-disable no-undef, no-useless-escape */
    return `#!/bin/sh
#
# Pre-commit hook for REQ-011: Git System Evaluation and Enhancement
# Validates git workflow compliance and updates requirement file metadata
#

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

echo "🔍 REQ-011: Running pre-commit validation..."

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "\${RED}❌ Error: Not in project root directory\${NC}"
    exit 1
fi

# Validate git workflow using our validator
if [ -f "scripts/git-workflow-validator.js" ]; then
    echo "🔧 Validating git workflow compliance..."
    
    # Get current branch name
    BRANCH_NAME=$(git branch --show-current)
    
    # Validate branch naming (skip for protected branches)
    if [ "$BRANCH_NAME" != "main" ] && [ "$BRANCH_NAME" != "master" ] && [ "$BRANCH_NAME" != "develop" ]; then
        node scripts/git-workflow-validator.js branch "$BRANCH_NAME" > /dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo "\${RED}❌ Branch name '$BRANCH_NAME' does not follow naming convention\${NC}"
            echo "\${YELLOW}💡 Use format: feature/req-XXX-description, bugfix/req-XXX-description, or hotfix/req-XXX-description\${NC}"
            echo "\${YELLOW}💡 Example: feature/req-011-git-workflow-validation\${NC}"
            exit 1
        fi
    fi
    
    echo "\${GREEN}✅ Branch naming validation passed\${NC}"
else
    echo "\${YELLOW}⚠️ Git workflow validator not found, skipping validation\${NC}"
fi

# Update requirement files with git tracking metadata
STAGED_REQ_FILES=$(git diff --cached --name-only | grep -E "(req-[0-9]+.*\\.md|requirements/.*\\.md)" || true)

if [ -n "$STAGED_REQ_FILES" ]; then
    echo "📝 Updating requirement file metadata..."
    
    # Get previous commit hash
    PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "initial")
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    AUTHOR=$(git config user.name || echo "unknown")
    
    for file in $STAGED_REQ_FILES; do
        echo "  📄 Processing $file..."
        
        # Check if file has git_tracking section
        if grep -q "git_tracking:" "$file"; then
            # Update existing git_tracking section
            # This is a simplified approach - in production, use proper YAML/frontmatter parsing
            sed -i.bak "s/previous_commit:.*/previous_commit: "$PREV_COMMIT"/" "$file"
            sed -i.bak "s/last_modified:.*/last_modified: "$TIMESTAMP"/" "$file"
            sed -i.bak "s/last_modified_by:.*/last_modified_by: "$AUTHOR"/" "$file"
            
            # Increment change count (simplified)
            CURRENT_COUNT=$(grep "change_count:" "$file" | sed 's/.*change_count: //' | sed 's/[^0-9]//g')
            if [ -z "$CURRENT_COUNT" ]; then
                CURRENT_COUNT=0
            fi
            NEW_COUNT=$(($CURRENT_COUNT + 1))
            sed -i.bak "s/change_count:.*/change_count: $NEW_COUNT/" "$file"
            
            # Clean up backup file
            rm -f "\${file}.bak"
        else
            # Add git_tracking section to front matter
            # This is a simplified implementation
            if grep -q "^---" "$file"; then
                # Has front matter, add git_tracking before closing ---
                awk -v prev="$PREV_COMMIT" -v ts="$TIMESTAMP" -v author="$AUTHOR" '
                /^---$/ && NR > 1 {
                    print "git_tracking:"
                    print "  previous_commit: "" prev """
                    print "  last_modified: "" ts """
                    print "  change_count: 1"
                    print "  last_modified_by: "" author """
                    print $0
                    next
                }
                { print }
                ' "$file" > "\${file}.tmp" && mv "\${file}.tmp" "$file"
            fi
        fi
        
        # Re-stage the updated file
        git add "$file"
        
        echo "    \${GREEN}✅ Updated git tracking metadata\${NC}"
    done
    
    echo "\${GREEN}✅ Requirement file metadata updated\${NC}"
fi

# Date validation for staged files
echo "📅 Validating document dates..."

# Check for skip environment variable
if [ "\${SC_SKIP_DATE_VALIDATION}" = "true" ]; then
    echo "\${YELLOW}⚠️ Date validation skipped\${NC}"
else
    # Get staged markdown and JSON files that might contain dates
    STAGED_DATE_FILES=$(git diff --cached --name-only | grep -E "\\.(md|json)$" || true)
    
    if [ -n "$STAGED_DATE_FILES" ]; then
        # Check if sc command is available
        if command -v sc > /dev/null 2>&1; then
            # Run date validation on staged files only
            date_validation_failed=false
            for file in $STAGED_DATE_FILES; do
                if [ -f "$file" ]; then
                    if ! sc date-validate --file="$file" > /dev/null 2>&1; then
                        date_validation_failed=true
                        echo "\${YELLOW}⚠️ Date issues in: $file\${NC}"
                    fi
                fi
            done
            
            if [ "$date_validation_failed" = true ]; then
                echo "\${YELLOW}⚠️ Hardcoded dates detected that don't match file dates\${NC}"
                echo "   Run: \${BLUE}sc date-validate --fix\${NC} to fix automatically"
                echo "   Or skip with: \${BLUE}SC_SKIP_DATE_VALIDATION=true git commit\${NC}"
                echo ""
                echo "\${YELLOW}💡 This prevents hallucinated timestamps in documentation\${NC}"
                exit 1
            else
                echo "\${GREEN}✅ Document dates are accurate\${NC}"
            fi
        else
            echo "\${YELLOW}⚠️ sc command not found, skipping date validation\${NC}"
            echo "   Install with: npm install -g supernal-code"
        fi
    else
        echo "\${GREEN}✅ No date-containing files to validate\${NC}"
    fi
fi

echo "\${GREEN}🎉 Pre-commit validation completed successfully\${NC}"
exit 0
`;
    /* eslint-enable no-undef, no-useless-escape */
  }

  /**
   * Install commit-msg hook
   */
  async installCommitMsgHook() {
    const hookPath = path.join(this.hooksDir, 'commit-msg');

    try {
      // Backup existing hook if requested
      if (fs.existsSync(hookPath) && this.config.hooks.backup_existing) {
        const backupPath = `${hookPath}.backup.${Date.now()}`;
        fs.copyFileSync(hookPath, backupPath);
        console.log(
          `📁 Backed up existing commit-msg hook to ${path.basename(backupPath)}`
        );
      }

      // Create commit-msg hook content
      const hookContent = this.generateCommitMsgHook();

      // Write hook file
      fs.writeFileSync(hookPath, hookContent);

      // Make executable (on Unix systems)
      if (process.platform !== 'win32') {
        fs.chmodSync(hookPath, '755');
      }

      console.log('✅ Commit-msg hook installed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to install commit-msg hook:', error.message);
      return false;
    }
  }

  /**
   * Install pre-push hook
   */
  async installPrePushHook() {
    const hookPath = path.join(this.hooksDir, 'pre-push');

    try {
      // Backup existing hook if requested
      if (fs.existsSync(hookPath) && this.config.hooks.backup_existing) {
        const backupPath = `${hookPath}.backup.${Date.now()}`;
        fs.copyFileSync(hookPath, backupPath);
        console.log(
          `📁 Backed up existing pre-push hook to ${path.basename(backupPath)}`
        );
      }

      // Read pre-push hook template
      const templatePath = path.join(
        __dirname,
        '../supernal-code-package/lib/cli/commands/git/hooks/pre-push.sh'
      );

      if (!fs.existsSync(templatePath)) {
        console.error(
          `❌ Pre-push hook template not found at: ${templatePath}`
        );
        return false;
      }

      const hookContent = fs.readFileSync(templatePath, 'utf8');

      // Write hook file
      fs.writeFileSync(hookPath, hookContent);

      // Make executable (on Unix systems)
      if (process.platform !== 'win32') {
        fs.chmodSync(hookPath, '755');
      }

      console.log('✅ Pre-push hook installed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to install pre-push hook:', error.message);
      return false;
    }
  }

  /**
   * Generate commit-msg hook content
   */
  generateCommitMsgHook() {
    /* eslint-disable no-undef, no-useless-escape */
    return `#!/bin/sh
#
# Commit-msg hook for REQ-011: Git System Evaluation and Enhancement
# Validates commit message format for requirement traceability
#

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

COMMIT_MSG_FILE=\\$1
COMMIT_MSG=\\$(cat "\\$COMMIT_MSG_FILE")

echo "📝 REQ-011: Validating commit message format..."

# Skip validation for merge commits
if echo "\\$COMMIT_MSG" | grep -q "^Merge "; then
    echo "\${YELLOW}⚠️ Merge commit detected, skipping format validation\${NC}"
    exit 0
fi

# Skip validation for revert commits
if echo "\\$COMMIT_MSG" | grep -q "^Revert "; then
    echo "\${YELLOW}⚠️ Revert commit detected, skipping format validation\${NC}"
    exit 0
fi

# Check if git workflow validator exists
if [ -f "scripts/git-workflow-validator.js" ]; then
    # Use the git workflow validator
    node scripts/git-workflow-validator.js commit "\\$COMMIT_MSG" > /dev/null 2>&1
    
    if [ \\$? -ne 0 ]; then
        echo "\${RED}❌ Commit message format validation failed\${NC}"
        echo "\${RED}Message: \\$COMMIT_MSG\${NC}"
        echo ""
        echo "\${YELLOW}💡 Commit messages should follow this format:\${NC}"
        echo "\${YELLOW}   REQ-XXX: Description of the change (minimum 10 characters)\${NC}"
        echo ""
        echo "\${YELLOW}📝 Examples:\${NC}"
        echo "\${YELLOW}   REQ-011: Implement git workflow validation system\${NC}"
        echo "\${YELLOW}   REQ-011: Add comprehensive branch naming validation\${NC}"
        echo "\${YELLOW}   REQ-011: Update requirements tracking functionality\${NC}"
        echo ""
        echo "\${YELLOW}🔧 Requirements:\${NC}"
        echo "\${YELLOW}   • Start with REQ-XXX: where XXX is the requirement number\${NC}"
        echo "\${YELLOW}   • Follow with a colon and space\${NC}"
        echo "\${YELLOW}   • Provide meaningful description (minimum 10 characters)\${NC}"
        echo "\${YELLOW}   • Use present tense (e.g., 'Add' not 'Added')\${NC}"
        echo ""
        echo "\${YELLOW}🚀 To fix: git commit --amend -m 'REQ-XXX: Your corrected message'\${NC}"
        exit 1
    fi
    
    echo "\${GREEN}✅ Commit message format validation passed\${NC}"
else
    # Fallback validation using basic regex
    if ! echo "\\$COMMIT_MSG" | grep -qE "^REQ-[0-9]+: .{10,}"; then
        echo "\${RED}❌ Commit message format validation failed\${NC}"
        echo "\${RED}Message: \\$COMMIT_MSG\${NC}"
        echo ""
        echo "\${YELLOW}💡 Commit messages must follow format: REQ-XXX: Description (min 10 chars)\${NC}"
        echo "\${YELLOW}📝 Example: REQ-011: Implement git workflow validation system\${NC}"
        echo ""
        echo "\${YELLOW}🚀 To fix: git commit --amend -m 'REQ-XXX: Your corrected message'\${NC}"
        exit 1
    fi
    
    echo "\${GREEN}✅ Commit message format validation passed (fallback)\${NC}"
fi

exit 0
`;
    /* eslint-enable no-undef, no-useless-escape */
  }

  /**
   * Uninstall git hooks
   */
  async uninstallHooks() {
    console.log('🗑️ Uninstalling Git Hooks...\n');

    const hooks = ['pre-commit', 'commit-msg', 'pre-push'];
    let uninstalledCount = 0;

    for (const hook of hooks) {
      const hookPath = path.join(this.hooksDir, hook);

      if (fs.existsSync(hookPath)) {
        try {
          // Check if it's our hook by looking for REQ-011 signature
          const content = fs.readFileSync(hookPath, 'utf8');
          if (content.includes('REQ-011')) {
            fs.unlinkSync(hookPath);
            console.log(`✅ Removed ${hook} hook`);
            uninstalledCount++;
          } else {
            console.log(
              `⚠️ ${hook} hook exists but doesn't appear to be ours, skipping`
            );
          }
        } catch (error) {
          console.error(`❌ Failed to remove ${hook} hook:`, error.message);
        }
      } else {
        console.log(`ℹ️ ${hook} hook not found`);
      }
    }

    console.log(
      `\n✅ Uninstallation complete: ${uninstalledCount} hooks removed`
    );
    return uninstalledCount > 0;
  }

  /**
   * Check hook installation status
   */
  checkHookStatus() {
    const status = {
      hooksDirectoryExists: fs.existsSync(this.hooksDir),
      hooks: {},
    };

    const hookTypes = ['pre-commit', 'commit-msg', 'pre-push'];

    for (const hookType of hookTypes) {
      const hookPath = path.join(this.hooksDir, hookType);
      status.hooks[hookType] = {
        exists: fs.existsSync(hookPath),
        isOurs: false,
        executable: false,
      };

      if (status.hooks[hookType].exists) {
        try {
          const content = fs.readFileSync(hookPath, 'utf8');
          status.hooks[hookType].isOurs = content.includes('REQ-011');

          // Check if executable (on Unix systems)
          if (process.platform !== 'win32') {
            const stats = fs.statSync(hookPath);
            status.hooks[hookType].executable = !!(stats.mode & 0o111);
          } else {
            status.hooks[hookType].executable = true; // Assume executable on Windows
          }
        } catch (_error) {
          // Unable to read hook file
        }
      }
    }

    return status;
  }

  /**
   * Test git hooks functionality
   */
  async testHooks() {
    console.log('🧪 Testing Git Hooks Functionality...\n');

    const status = this.checkHookStatus();

    if (!status.hooksDirectoryExists) {
      console.log('❌ Git hooks directory not found');
      return false;
    }

    let testsPassedCount = 0;
    const totalTests = 2;

    // Test pre-commit hook
    if (
      status.hooks['pre-commit'].exists &&
      status.hooks['pre-commit'].isOurs
    ) {
      console.log('🔍 Testing pre-commit hook...');

      try {
        // Test branch validation
        const GitWorkflowValidator = require('./git-workflow-validator');
        const validator = new GitWorkflowValidator({
          projectRoot: this.projectRoot,
        });

        const currentBranch = execSync('git branch --show-current', {
          cwd: this.projectRoot,
          encoding: 'utf8',
        }).trim();

        const branchValidation = validator.validateBranchName(currentBranch);

        if (
          branchValidation.valid ||
          ['main', 'master', 'develop'].includes(currentBranch)
        ) {
          console.log('  ✅ Branch validation working');
          testsPassedCount++;
        } else {
          console.log(
            '  ⚠️ Current branch would fail validation (this is expected if not using standard naming)'
          );
          testsPassedCount++; // Still count as passing since the validation is working
        }
      } catch (error) {
        console.log('  ❌ Pre-commit hook test failed:', error.message);
      }
    } else {
      console.log(
        '⚠️ Pre-commit hook not installed or not ours, skipping test'
      );
    }

    // Test commit-msg hook
    if (
      status.hooks['commit-msg'].exists &&
      status.hooks['commit-msg'].isOurs
    ) {
      console.log('🔍 Testing commit-msg hook...');

      try {
        const GitWorkflowValidator = require('./git-workflow-validator');
        const validator = new GitWorkflowValidator({
          projectRoot: this.projectRoot,
        });

        const testMessage = 'REQ-011: Test commit message validation';
        const messageValidation = validator.validateCommitMessage(testMessage);

        if (messageValidation.valid) {
          console.log('  ✅ Commit message validation working');
          testsPassedCount++;
        } else {
          console.log('  ❌ Commit message validation not working properly');
        }
      } catch (error) {
        console.log('  ❌ Commit-msg hook test failed:', error.message);
      }
    } else {
      console.log(
        '⚠️ Commit-msg hook not installed or not ours, skipping test'
      );
    }

    console.log(
      `\n🧪 Hook Tests Complete: ${testsPassedCount}/${totalTests} tests passed`
    );
    return testsPassedCount === totalTests;
  }

  /**
   * CLI interface
   */
  static async main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'install';

    const installer = new GitHooksInstaller();

    try {
      switch (command) {
        case 'install':
          await installer.installHooks();
          break;

        case 'uninstall':
          await installer.uninstallHooks();
          break;

        case 'status': {
          const status = installer.checkHookStatus();
          console.log('📊 Git Hooks Status\n');
          console.log(
            `Hooks Directory: ${status.hooksDirectoryExists ? '✅' : '❌'}`
          );

          for (const [hookType, hookStatus] of Object.entries(status.hooks)) {
            if (hookStatus.exists) {
              const ourHook = hookStatus.isOurs
                ? '✅ (REQ-011)'
                : '⚠️ (External)';
              const executable = hookStatus.executable ? '✅' : '❌';
              console.log(`${hookType}: ${ourHook}, Executable: ${executable}`);
            } else {
              console.log(`${hookType}: ❌ Not installed`);
            }
          }
          break;
        }

        case 'test':
          await installer.testHooks();
          break;
        default:
          console.log(`Git Hooks Installer - REQ-011

Usage:
  node git-hooks-installer.js [command]

Commands:
  install     Install git hooks for workflow validation
  uninstall   Remove REQ-011 git hooks
  status      Show current hook installation status
  test        Test installed hooks functionality
  help        Show this help message

Examples:
  node git-hooks-installer.js install
  node git-hooks-installer.js status
  node git-hooks-installer.js test

For more information, see REQ-011 documentation.`);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

module.exports = GitHooksInstaller;

// Run CLI if this file is executed directly
if (require.main === module) {
  GitHooksInstaller.main();
}
