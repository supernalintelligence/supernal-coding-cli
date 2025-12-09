#!/usr/bin/env node

const program = require('commander');
const TemplateSyncManager = require('../lib/template/TemplateSyncManager');
const chalk = require('chalk');

program.name('sc template').description('Manage template synchronization');

program
  .command('check')
  .description('Check which documents need template updates')
  .action(async () => {
    try {
      const manager = new TemplateSyncManager();
      const results = await manager.checkAll();

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
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('sync [file]')
  .description('Sync document(s) with their templates')
  .option('--dry-run', 'Show what would change without modifying files')
  .action(async (file, options) => {
    try {
      const manager = new TemplateSyncManager();
      const results = await manager.sync(file, { dryRun: options.dryRun });

      if (results.errors.length > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse(process.argv);
