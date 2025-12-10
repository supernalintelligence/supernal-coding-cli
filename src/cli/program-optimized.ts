import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';

interface PackageJson {
  version: string;
}

type CommandOption = [string, string];

interface CommandDefinition {
  name: string;
  alias?: string;
  description: string;
  options?: CommandOption[];
  arguments?: string[];
}

function resolvePackageJson(dir: string): PackageJson {
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
  return { version: '0.0.0' };
}

function buildProgram(): Command {
  const program = new Command();

  const commandsDir = path.join(__dirname, 'commands');
  const packageJson = resolvePackageJson(__dirname);

  const CommandRegistry = require('./command-registry');
  const registry = new CommandRegistry();
  registry.initialize();

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

  const commands: CommandDefinition[] = registry.getAllCommands();

  commands.forEach((cmd) => {
    const command = program.command(cmd.name);

    if (cmd.alias) {
      command.alias(cmd.alias);
    }

    command.description(cmd.description);

    if (cmd.options && cmd.options.length > 0) {
      cmd.options.forEach(([flags, description]) => {
        command.option(flags, description);
      });
    }

    if (cmd.arguments && cmd.arguments.length > 0) {
      cmd.arguments.forEach((arg) => {
        command.argument(arg);
      });
    }

    command.action(registry.createLazyAction(cmd.name));
  });

  program.hook('preAction', async (_thisCommand, actionCommand) => {
    const skipUpgradeCheck =
      (actionCommand.opts() as Record<string, unknown>)['skip-upgrade-check'] ||
      ['check-upgrade', 'upgrade', 'help', '--help', '-h'].includes(
        actionCommand.name()
      );

    if (!skipUpgradeCheck) {
      try {
        const UpgradeIntegration = require(
          path.join(__dirname, 'utils', 'upgrade-integration')
        );
        const integration = new UpgradeIntegration();
        await integration.performBackgroundCheck();
      } catch (error) {
        if (process.env.SC_DEBUG) {
          console.warn(
            chalk.yellow(`Warning: Auto-upgrade check failed: ${(error as Error).message}`)
          );
        }
      }
    }

    /* eslint-disable no-constant-condition */
    if (false) {
      try {
        const opts = actionCommand.opts() as Record<string, unknown>;
        const interceptor = new CommandInterceptor({
          projectRoot: process.cwd(),
          bypassFlag:
            opts.Y ||
            opts['yes-to-rules'] ||
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
        if (process.env.SC_DEBUG) {
          console.warn(
            chalk.yellow(`Warning: Rule interception failed: ${(error as Error).message}`)
          );
        }
      }
    }
    /* eslint-enable no-constant-condition */
  });

  program.exitOverride();

  return program;
}

export { buildProgram };
module.exports = { buildProgram };
