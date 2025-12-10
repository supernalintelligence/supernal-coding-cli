import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

class GitProtectionSetup {
  protected projectRoot: string;
  protected wrapperPath: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.wrapperPath = path.join(__dirname, 'safe-git-wrapper.js');
  }

  async installGitAliases(): Promise<void> {
    try {
      console.log(chalk.blue('🔧 Setting up git command protection...'));

      const aliasCommand = `node "${this.wrapperPath}"`;

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

      console.log(
        chalk.yellow('\n💡 Optional: Add shell alias for convenience:')
      );
      console.log(chalk.gray('   Add to your ~/.bashrc or ~/.zshrc:'));
      console.log(chalk.cyan(`   alias gadd='git sadd'`));
      console.log(chalk.cyan(`   alias ga='git sadd'`));
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to install git aliases:'),
        (error as Error).message
      );
      throw error;
    }
  }

  async installEnhancedPreCommitHook(): Promise<void> {
    try {
      const hooksDir = path.join(this.projectRoot, '.git', 'hooks');
      const preCommitPath = path.join(hooksDir, 'pre-commit');

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
        console.log(chalk.blue('📝 Updating Husky pre-commit hook...'));
        fs.writeFileSync(huskyPreCommit, hookContent);
        fs.chmodSync(huskyPreCommit, '755');
        console.log(chalk.green('✅ Enhanced Husky pre-commit hook installed'));
      } else {
        console.log(chalk.blue('📝 Installing enhanced pre-commit hook...'));
        fs.writeFileSync(preCommitPath, hookContent);
        fs.chmodSync(preCommitPath, '755');
        console.log(chalk.green('✅ Enhanced pre-commit hook installed'));
      }
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to install pre-commit hook:'),
        (error as Error).message
      );
      throw error;
    }
  }

  showUsageInstructions(): void {
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

  checkProtectionStatus(): void {
    console.log(chalk.blue('🔍 Git Protection Status:'));
    console.log(chalk.blue('='.repeat(30)));

    try {
      const saddAlias = execSync('git config --get alias.sadd', {
        encoding: 'utf8'
      }).trim();
      console.log(chalk.green('✅ git sadd alias:'), chalk.gray(saddAlias));
    } catch (_error) {
      console.log(chalk.red('❌ git sadd alias: Not installed'));
    }

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

  async uninstallProtection(): Promise<void> {
    try {
      console.log(chalk.yellow('⚠️  Removing git protection...'));

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
        (error as Error).message
      );
      throw error;
    }
  }

  async execute(action: string = 'install'): Promise<void> {
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
        (error as Error).message
      );
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  const action = process.argv[2] || 'install';
  const setup = new GitProtectionSetup();
  await setup.execute(action);
}

if (require.main === module) {
  main();
}

export { GitProtectionSetup };
module.exports = { GitProtectionSetup };
