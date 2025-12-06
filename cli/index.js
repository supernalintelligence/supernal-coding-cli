#!/usr/bin/env node

/**
 * Supernal Coding CLI Entry Point
 * Main command router for sc commands
 */

const { Command } = require('commander');
const _path = require('node:path');
const _fs = require('node:fs').promises;

// Import command modules
const workflowCommands = require('./commands/workflow');
const configCommands = require('./commands/config');
const templateCommands = require('./commands/template');
const multiRepoCommands = require('./commands/multi-repo');
const _referenceCommand = require('./reference');
const complianceCommand = require('./compliance');
const resourceCommand = require('./resource');
const jiraCommand = require('./jira');

// Import utilities
const { findProjectRoot } = require('./utils/project-finder');
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

// Register resource command (integrations)
program.addCommand(resourceCommand.program);

// Register Jira command
program.addCommand(jiraCommand.program);

// Global error handler
program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error.code === 'commander.helpDisplayed') {
      process.exit(0);
    }
    console.error(formatError(error));
    process.exit(1);
  }
}

main();

module.exports = program;
