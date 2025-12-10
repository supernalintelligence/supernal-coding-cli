#!/usr/bin/env node

import chalk from 'chalk';
const { buildProgram } = require('./program');
const UpgradeIntegration = require('./utils/upgrade-integration');

interface CachedUpdateStatus {
  needsUpdate: boolean;
  message?: string;
  upgradeCommand?: string;
}

interface CommanderError extends Error {
  code?: string;
}

async function initializeUpgradeIntegration(): Promise<void> {
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return;
  }

  try {
    const upgradeIntegration = new UpgradeIntegration();

    const cachedCheck: CachedUpdateStatus | null = upgradeIntegration.getCachedUpdateStatus();
    if (cachedCheck?.needsUpdate) {
      console.log(chalk.yellow('⚠️  UPDATE AVAILABLE'));
      console.log(chalk.yellow(`   ${cachedCheck.message}`));
      console.log(
        chalk.blue('   To update: ') + chalk.cyan(cachedCheck.upgradeCommand)
      );
      console.log();
    }

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
    timer.unref();
  } catch (_error) {
    // non-blocking
  }
}

(async () => {
  try {
    initializeUpgradeIntegration().catch(() => {});

    const program = buildProgram();
    program.parse();
  } catch (error) {
    const err = error as CommanderError;
    if (err.code === 'commander.unknownCommand') {
      console.error(
        chalk.red(
          '❌ Unknown command. Use "sc help" to see available commands.'
        )
      );
    } else if (err.code === 'commander.helpDisplayed') {
      process.exit(0);
    } else if (err.code === 'commander.version') {
      process.exit(0);
    } else {
      console.error(chalk.red('❌ Error:'), err.message);
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
