#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

const TemplateSyncManager = require('../template/TemplateSyncManager');

/** Sync options */
interface SyncOptions {
  dryRun?: boolean;
}

/** Check results */
interface CheckResults {
  outdated: unknown[];
}

/** Sync results */
interface SyncResults {
  errors: unknown[];
}

const program = new Command();

program.name('sc template').description('Manage template synchronization');

program
  .command('check')
  .description('Check which documents need template updates')
  .action(async () => {
    try {
      const manager = new TemplateSyncManager();
      const results: CheckResults = await manager.checkAll();

      if (results.outdated.length > 0) {
        console.log(
          chalk.yellow(
            `\n💡 Run 'sc template sync' to update outdated documents\n`
          )
        );
        process.exit(1); // Exit with error code if outdated found
      } else {
        console.log(chalk.green('\n✓ All documents are up to date!\n'));
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${(error as Error).message}\n`));
      process.exit(1);
    }
  });

program
  .command('sync [file]')
  .description('Sync document(s) with their templates')
  .option('--dry-run', 'Show what would change without modifying files')
  .action(async (file: string | undefined, options: SyncOptions) => {
    try {
      const manager = new TemplateSyncManager();
      const results: SyncResults = await manager.sync(file, { dryRun: options.dryRun });

      if (results.errors.length > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${(error as Error).message}\n`));
      process.exit(1);
    }
  });

program.parse(process.argv);

export default program;
