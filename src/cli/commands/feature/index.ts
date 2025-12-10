/**
 * Feature Management Commands
 * Includes: create, validate, move
 */

import { Command } from 'commander';
import chalk from 'chalk';
const { createFeature } = require('./create');

interface CreateFeatureOptions {
  id: string;
  title?: string;
  phase?: string;
  epic?: string;
  priority?: string;
  assignee?: string;
  minimal?: boolean;
}

const program = new Command();

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
  .action(async (options: CreateFeatureOptions) => {
    try {
      await createFeature(options);
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${(error as Error).message}\n`));
      process.exit(1);
    }
  });

export { program };

module.exports = { program };

if (require.main === module) {
  program.parse(process.argv);
}
