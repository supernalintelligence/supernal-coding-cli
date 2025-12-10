#!/usr/bin/env node

/**
 * Supernal Coding CLI Entry Point
 * Main command router for sc commands
 */

import { Command } from 'commander';

// Import command modules
const workflowCommands = require('./commands/workflow');
const configCommands = require('./commands/config');
const templateCommands = require('./commands/template');
const multiRepoCommands = require('./commands/multi-repo');
const _referenceCommand = require('./reference');
const complianceCommand = require('./compliance');
const connectCommand = require('./connect');

// Import utilities
const { formatError } = require('./utils/formatters');

const program = new Command();

program
  .name('sc')
  .description('Supernal Coding - Composable workflow system')
  .version('2.0.0');

// Register command groups
workflowCommands(program);
configCommands(program);
templateCommands(program);
multiRepoCommands(program);

// Register reference command
program.command('reference', 'Validate version-aware references').alias('ref');

// Register template sync command
program.command('template', 'Manage template synchronization');

// Register compliance command
program.addCommand(complianceCommand.program);

// Register connect command (unified integrations: jira, google, etc.)
program.addCommand(connectCommand.program);

// Global error handler
program.exitOverride();

interface CommanderError extends Error {
  code?: string;
}

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if ((error as CommanderError).code === 'commander.helpDisplayed') {
      process.exit(0);
    }
    console.error(formatError(error));
    process.exit(1);
  }
}

main();

export default program;
module.exports = program;
