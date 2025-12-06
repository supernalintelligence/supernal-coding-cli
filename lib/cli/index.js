#!/usr/bin/env node

const chalk = require('chalk');
const { buildProgram } = require('./program');
const UpgradeIntegration = require('./utils/upgrade-integration');

async function initializeUpgradeIntegration() {
  // Skip upgrade checks during testing
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return;
  }

  try {
    const upgradeIntegration = new UpgradeIntegration();

    // Check cache FIRST (fast path - no network)
    const cachedCheck = upgradeIntegration.getCachedUpdateStatus();
    if (cachedCheck?.needsUpdate) {
      console.log(chalk.yellow('⚠️  UPDATE AVAILABLE'));
      console.log(chalk.yellow(`   ${cachedCheck.message}`));
      console.log(
        chalk.blue('   To update: ') + chalk.cyan(cachedCheck.upgradeCommand)
      );
      console.log();
    }

    // Background check for next run (fire-and-forget, don't block exit)
    // Uses unref() to allow Node to exit without waiting
    const timer = setTimeout(async () => {
      try {
        await upgradeIntegration.initializeForCommand(
          process.argv[2] || 'help'
        );
        await upgradeIntegration.checkCriticalUpdates();
      } catch (_error) {
        // Silent fail
      }
    }, 0);
    timer.unref(); // Allow Node to exit without waiting for this timer
  } catch (_error) {
    // non-blocking
  }
}

(async () => {
  try {
    // Fire off upgrade check (non-blocking due to unref())
    initializeUpgradeIntegration().catch(() => {});

    const program = buildProgram();
    program.parse();
  } catch (error) {
    if (error.code === 'commander.unknownCommand') {
      console.error(
        chalk.red(
          '❌ Unknown command. Use "sc help" to see available commands.'
        )
      );
    } else if (error.code === 'commander.helpDisplayed') {
      process.exit(0);
    } else if (error.code === 'commander.version') {
      process.exit(0);
    } else {
      console.error(chalk.red('❌ Error:'), error.message);
    }
    process.exit(1);
  }
})();

if (!process.argv.slice(2).length) {
  try {
    const program = buildProgram();
    program.outputHelp();
  } catch (_error) {
    console.log('Use "sc help" for available commands');
  }
}
