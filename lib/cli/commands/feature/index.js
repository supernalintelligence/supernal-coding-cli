#!/usr/bin/env node

/**
 * Feature Management Commands
 * Includes: create, validate, move
 */

const { program } = require('commander');
const { createFeature } = require('./create');
const chalk = require('chalk');

program
  .name('sc feature')
  .description('Feature management commands for Supernal Coding');

program
  .command('create')
  .description('Create a new feature from template')
  .requiredOption(
    '--id <id>',
    'Feature ID (folder name, lowercase-with-hyphens)'
  )
  .option('--title <title>', 'Human-readable title (defaults to id)')
  .option(
    '--phase <phase>',
    'Starting phase (backlog|drafting|implementing|testing|validating|complete)',
    'backlog'
  )
  .option('--epic <epic>', 'Epic name')
  .option('--priority <priority>', 'Priority level (high|medium|low)', 'medium')
  .option('--assignee <assignee>', 'GitHub username')
  .option('--minimal', 'Create minimal structure (README only)')
  .action(async (options) => {
    try {
      await createFeature(options);
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

module.exports = { program };

if (require.main === module) {
  program.parse(process.argv);
}
