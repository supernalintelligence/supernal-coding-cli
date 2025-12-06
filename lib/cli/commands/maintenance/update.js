#!/usr/bin/env node

/**
 * Update Command - Handles self-updating the globally installed sc package
 */

const chalk = require('chalk');
const UpgradeChecker = require('../upgrade/check-upgrade');

async function handleUpdateCommand(action, options = {}) {
  const checker = new UpgradeChecker();

  try {
    if (action === 'check' || !action) {
      // Check for updates
      const result = await checker.checkForUpgrade({
        force: options.force || false,
        silent: false
      });

      if (result.checked) {
        if (result.needsUpgrade) {
          console.log(chalk.yellow('\n📦 UPDATE AVAILABLE'));
          console.log(chalk.yellow('='.repeat(60)));
          console.log(`Current version: ${chalk.red(result.currentVersion)}`);
          console.log(`Latest version:  ${chalk.green(result.latestVersion)}`);
          console.log('');
          console.log(chalk.blue('🚀 To upgrade:'));
          console.log(chalk.cyan(`   ${result.upgradeCommand}`));
          console.log('');
          console.log(chalk.blue('💡 Or run: sc update install'));
          console.log('');
        } else {
          if (result.isDevelopment) {
            console.log(
              chalk.green('✅ Development mode - use git pull to update')
            );
          } else {
            console.log(
              chalk.green('✅ You are already running the latest version')
            );
          }
        }
      }

      return { success: true, result };
    }

    if (action === 'install') {
      // Perform the actual upgrade
      console.log(chalk.blue('🔄 Starting upgrade process...'));
      const upgradeResult = await checker.performSelfUpgrade({
        dryRun: options.dryRun || false,
        verbose: true
      });

      if (upgradeResult.success) {
        console.log(chalk.green('✅ Upgrade completed successfully!'));
        console.log(
          chalk.yellow('💡 Please restart your terminal to use the new version')
        );
      } else {
        console.log(chalk.red('❌ Upgrade failed:'), upgradeResult.message);
        if (upgradeResult.commands) {
          console.log(chalk.blue('Run these commands manually:'));
          upgradeResult.commands.forEach((cmd) => {
            console.log(chalk.cyan(`   ${cmd}`));
          });
        }
      }

      return upgradeResult;
    }

    if (action === 'help' || action === '--help') {
      showHelp();
      return { success: true };
    }

    console.error(chalk.red(`❌ Unknown update action: ${action}`));
    showHelp();
    return { success: false };
  } catch (error) {
    console.error(chalk.red('❌ Update failed:'), error.message);
    return { success: false, error: error.message };
  }
}

function showHelp() {
  console.log(chalk.bold('\n🔄 Supernal Coding Update Command\n'));
  console.log('Usage: sc update [action] [options]\n');
  console.log('Actions:');
  console.log('  check      Check for available updates (default)');
  console.log('  install    Install the latest version');
  console.log('  help       Show this help message\n');
  console.log('Options:');
  console.log('  --force    Force update check (ignore cache)');
  console.log('  --dry-run  Show what would be done without executing\n');
  console.log('Examples:');
  console.log('  sc update               # Check for updates');
  console.log('  sc update check --force # Force check for updates');
  console.log('  sc update install       # Install latest version');
  console.log('');
}

module.exports = handleUpdateCommand;
