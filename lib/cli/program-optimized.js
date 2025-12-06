#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('node:path');
const fs = require('node:fs');

function resolvePackageJson(dir) {
  const candidates = [
    path.join(dir, '..', 'package.json'),
    path.join(dir, '..', '..', 'package.json'),
    path.join(dir, '..', '..', '..', 'package.json')
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return require(p);
      }
    } catch (_) {
      // Ignore errors when trying to read package.json
    }
  }
  // Fallback to local
  return { version: '0.0.0' };
}

function buildProgram() {
  const program = new Command();

  const commandsDir = path.join(__dirname, 'commands');
  const _scriptsDir = path.join(__dirname, '..', 'scripts');
  const packageJson = resolvePackageJson(__dirname);

  // Use command registry for lazy loading
  const CommandRegistry = require('./command-registry');
  const registry = new CommandRegistry();
  registry.initialize();

  // Keep only essential modules loaded at startup
  const CommandInterceptor = require(
    path.join(commandsDir, 'rules', 'command-interceptor')
  );

  program
    .name('sc')
    .alias('supernal-coding')
    .description(
      'Comprehensive development workflow system with kanban, git safety, and project validation'
    )
    .version(packageJson.version)
    .option(
      '--skip-upgrade-check',
      'Skip automatic upgrade checking for this command'
    )
    .option('-Y, --yes-to-rules', 'Skip rule sharing prompts (bypass consent)');

  // Register all commands using the registry for lazy loading
  const commands = registry.getAllCommands();

  commands.forEach((cmd) => {
    const command = program.command(cmd.name);

    if (cmd.alias) {
      command.alias(cmd.alias);
    }

    command.description(cmd.description);

    // Add options
    if (cmd.options && cmd.options.length > 0) {
      cmd.options.forEach(([flags, description]) => {
        command.option(flags, description);
      });
    }

    // Add arguments
    if (cmd.arguments && cmd.arguments.length > 0) {
      cmd.arguments.forEach((arg) => {
        command.argument(arg);
      });
    }

    // Set lazy-loading action
    command.action(registry.createLazyAction(cmd.name));
  });

  program.hook('preAction', async (_thisCommand, actionCommand) => {
    // Auto-upgrade check (skip for upgrade-related commands and if explicitly disabled)
    const skipUpgradeCheck =
      actionCommand.opts()['skip-upgrade-check'] ||
      ['check-upgrade', 'upgrade', 'help', '--help', '-h'].includes(
        actionCommand.name()
      );

    if (!skipUpgradeCheck) {
      try {
        // Use the cached upgrade integration instead of loading the full checker
        const UpgradeIntegration = require(
          path.join(__dirname, 'utils', 'upgrade-integration')
        );
        const integration = new UpgradeIntegration();
        await integration.performBackgroundCheck();
      } catch (error) {
        // Silently ignore upgrade check failures to not block commands
        if (process.env.SC_DEBUG) {
          console.warn(
            chalk.yellow(`Warning: Auto-upgrade check failed: ${error.message}`)
          );
        }
      }
    }

    // Rule reporting interception - TEMPORARILY DISABLED
    // TODO: Fix bypass flag handling and re-enable
    /* eslint-disable no-constant-condition */
    if (false) {
      try {
        const interceptor = new CommandInterceptor({
          projectRoot: process.cwd(),
          bypassFlag:
            actionCommand.opts().Y ||
            actionCommand.opts()['yes-to-rules'] ||
            false,
          commandName: actionCommand.name()
        });

        const result = await interceptor.interceptCommand(
          actionCommand.name(),
          actionCommand.args
        );

        if (!result.shouldProceed) {
          console.log(
            chalk.red('❌ Command execution cancelled by rule interception')
          );
          process.exit(1);
        }
      } catch (error) {
        // Don't block commands if rule interception fails
        if (process.env.SC_DEBUG) {
          console.warn(
            chalk.yellow(`Warning: Rule interception failed: ${error.message}`)
          );
        }
      }
    }
    /* eslint-enable no-constant-condition */
  });

  // Error handling
  program.exitOverride();

  return program;
}

module.exports = { buildProgram };
