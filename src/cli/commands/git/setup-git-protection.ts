#!/usr/bin/env node
// @ts-nocheck

// setup-git-protection.js - Setup enhanced git workflow protection
// Installs git aliases and hooks for comprehensive workflow safety

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');

class GitProtectionSetup {
  projectRoot: any;
  wrapperPath: any;
  constructor() {
    this.projectRoot = process.cwd();
    this.wrapperPath = path.join(__dirname, 'safe-git-wrapper.js');
  }

  /**
   * Install git aliases for protected commands
   */
  async installGitAliases() {
    try {
      console.log(chalk.blue('🔧 Setting up git command protection...'));

      // Create a safe-git command that wraps git add
      const aliasCommand = `node "${this.wrapperPath}"`;

      // Set git alias for intercepting git add
      execSync(`git config alias.sadd '!${aliasCommand} add'`, {
        cwd: this.projectRoot
      });

      console.log(chalk.green('✅ Git aliases installed:'));
      console.log(
        `   ${chalk.cyan('git sadd <files>')}    # Protected git add with workflow validation`
      );
      console.log(
        `   ${chalk.cyan('git add --force <files>')} # Bypass protection (emergency only)`
      );

      // Suggest shell alias for convenience
      console.log(
        chalk.yellow('\n💡 Optional: Add shell alias for convenience:')
      );
      console.log(chalk.gray('   Add to your ~/.bashrc or ~/.zshrc:'));
      console.log(chalk.cyan(`   alias gadd='git sadd'`));
      console.log(chalk.cyan(`   alias ga='git sadd'`));
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to install git aliases:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Install enhanced pre-commit hook
   */
  async installEnhancedPreCommitHook() {
    try {
      const hooksDir = path.join(this.projectRoot, '.git', 'hooks');
      const preCommitPath = path.join(hooksDir, 'pre-commit');

      // Check if using Husky
      const huskyDir = path.join(this.projectRoot, '.husky');
      const huskyPreCommit = path.join(huskyDir, '_', 'pre-commit');

      const hookContent = `#!/bin/sh
# Enhanced Supernal Coding Workflow Guard
# Prevents commits on main without proper workflow

node "${path.join(__dirname, '../development/workflow-guard.js')}" pre-commit --verbose

if [ $? -ne 0 ]; then
  echo ""
  echo "🔍 Run 'sc guard guide' for proper workflow guidance"
  exit 1
fi
`;

      if (fs.existsSync(huskyDir)) {
        // Using Husky - update the husky pre-commit hook
        console.log(chalk.blue('📝 Updating Husky pre-commit hook...'));
        fs.writeFileSync(huskyPreCommit, hookContent);
        fs.chmodSync(huskyPreCommit, '755');
        console.log(chalk.green('✅ Enhanced Husky pre-commit hook installed'));
      } else {
        // Standard git hooks
        console.log(chalk.blue('📝 Installing enhanced pre-commit hook...'));
        fs.writeFileSync(preCommitPath, hookContent);
        fs.chmodSync(preCommitPath, '755');
        console.log(chalk.green('✅ Enhanced pre-commit hook installed'));
      }
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to install pre-commit hook:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Show usage instructions
   */
  showUsageInstructions() {
    console.log(chalk.blue.bold('\n🚀 Git Protection Setup Complete!'));
    console.log(chalk.blue('='.repeat(50)));
    console.log('');

    console.log(chalk.yellow('📋 New Protected Commands:'));
    console.log(
      `   ${chalk.cyan('git sadd <files>')}           # Protected staging (recommended)`
    );
    console.log(
      `   ${chalk.cyan('git add --force <files>')}    # Emergency bypass`
    );
    console.log(
      `   ${chalk.cyan('sc guard pre-add')}           # Manual pre-add check`
    );
    console.log('');

    console.log(chalk.yellow('✅ Workflow Protection Active:'));
    console.log(
      '   • Pre-add validation prevents staging significant changes on main'
    );
    console.log(
      '   • Pre-commit validation blocks commits without requirements'
    );
    console.log('   • Automatic requirement search and suggestions');
    console.log('');

    console.log(chalk.yellow('💡 Recommended Usage:'));
    console.log('   1. Use `git sadd` instead of `git add` for safer staging');
    console.log(
      '   2. Follow requirement-driven workflow (search → create → implement)'
    );
    console.log(
      '   3. Use `sc req smart-start REQ-XXX` for automated workflow'
    );
    console.log('');

    console.log(chalk.red('🆘 Emergency Override:'));
    console.log('   • `git add --force` to bypass pre-add protection');
    console.log(
      '   • `git commit --no-verify` to bypass pre-commit protection'
    );
    console.log('   • Use with extreme caution!');
  }

  /**
   * Check current protection status
   */
  checkProtectionStatus() {
    console.log(chalk.blue('🔍 Git Protection Status:'));
    console.log(chalk.blue('='.repeat(30)));

    try {
      // Check git aliases
      const saddAlias = execSync('git config --get alias.sadd', {
        encoding: 'utf8'
      }).trim();
      console.log(chalk.green('✅ git sadd alias:'), chalk.gray(saddAlias));
    } catch (_error) {
      console.log(chalk.red('❌ git sadd alias: Not installed'));
    }

    // Check hooks
    const hooksDir = path.join(this.projectRoot, '.git', 'hooks');
    const huskyDir = path.join(this.projectRoot, '.husky');

    if (fs.existsSync(path.join(huskyDir, '_', 'pre-commit'))) {
      console.log(chalk.green('✅ Pre-commit hook: Husky managed'));
    } else if (fs.existsSync(path.join(hooksDir, 'pre-commit'))) {
      console.log(chalk.green('✅ Pre-commit hook: Standard git hooks'));
    } else {
      console.log(chalk.red('❌ Pre-commit hook: Not installed'));
    }

    console.log('');
  }

  /**
   * Uninstall protection (for emergencies)
   */
  async uninstallProtection() {
    try {
      console.log(chalk.yellow('⚠️  Removing git protection...'));

      // Remove git aliases
      try {
        execSync('git config --unset alias.sadd', { cwd: this.projectRoot });
        console.log(chalk.yellow('🗑️  Removed git sadd alias'));
      } catch (_error) {
        // Alias might not exist
      }

      console.log(chalk.red('❌ Git protection removed - use with caution!'));
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to uninstall protection:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Main execution
   */
  async execute(action = 'install') {
    try {
      switch (action) {
        case 'install':
          await this.installGitAliases();
          await this.installEnhancedPreCommitHook();
          this.showUsageInstructions();
          break;

        case 'status':
          this.checkProtectionStatus();
          break;

        case 'uninstall':
          await this.uninstallProtection();
          break;

        default:
          console.error(chalk.red(`❌ Unknown action: ${action}`));
          console.log(
            chalk.blue('Usage: setup-git-protection [install|status|uninstall]')
          );
          process.exit(1);
      }
    } catch (error) {
      console.error(
        chalk.red('❌ Git protection setup failed:'),
        error.message
      );
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const action = process.argv[2] || 'install';
  const setup = new GitProtectionSetup();
  await setup.execute(action);
}

// Execute if called directly
if (require.main === module) {
  main();
}

module.exports = { GitProtectionSetup };
