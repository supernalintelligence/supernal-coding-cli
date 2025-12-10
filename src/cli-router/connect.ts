import { Command } from 'commander';
import chalk from 'chalk';

const pluginRegistry = require('../plugins/registry');

interface ConnectOptions {
  project?: string;
  status?: string;
  assignee?: string;
  limit?: string;
  jql?: string;
  domain?: string;
  email?: string;
  token?: string;
  type?: string;
  local?: boolean;
  jira?: boolean;
}

interface Plugin {
  id: string;
  name: string;
  description?: string;
  commands: {
    auth?: {
      login?: (args: string[], options: ConnectOptions) => Promise<{ success: boolean }>;
      logout?: (args: string[], options: ConnectOptions) => Promise<{ success: boolean }>;
      status?: () => Promise<{ connected: boolean; domain?: string }>;
    };
    [key: string]: any;
  };
  capabilities?: {
    browse?: boolean;
    import?: boolean;
    export?: boolean;
    sync?: boolean;
  };
}

interface PluginInfo {
  id: string;
  name: string;
  description?: string;
}

const program = new Command('connect')
  .description('Connect to and interact with external services')
  .argument('[plugin]', 'Plugin name (jira, google, etc.) or "status"')
  .argument('[command]', 'Command to run')
  .argument('[args...]', 'Command arguments')
  .option('-p, --project <key>', 'Project key (for applicable commands)')
  .option('-s, --status <status>', 'Status filter')
  .option('-a, --assignee <user>', 'Assignee filter')
  .option('-n, --limit <number>', 'Result limit')
  .option('--jql <query>', 'Custom JQL query (Jira)')
  .option('-d, --domain <domain>', 'Service domain')
  .option('-e, --email <email>', 'Email address')
  .option('-t, --token <token>', 'API token')
  .option('--type <type>', 'Issue type')
  .option('--local', 'Prefer local changes in sync conflicts')
  .option('--jira', 'Prefer Jira changes in sync conflicts')
  .action(handleConnect);

async function handleConnect(
  pluginName: string | undefined,
  command: string | undefined,
  args: string[],
  options: ConnectOptions
): Promise<void> {
  try {
    pluginRegistry.discover();
    
    if (!pluginName || pluginName === 'list') {
      return listPlugins();
    }
    
    if (pluginName === 'status') {
      return showAllStatuses();
    }
    
    const plugin: Plugin | null = pluginRegistry.get(pluginName);
    if (!plugin) {
      console.error(chalk.red(`Unknown plugin: ${pluginName}`));
      console.log(chalk.gray('Available plugins: ' + pluginRegistry.ids().join(', ')));
      console.log(chalk.gray('\nRun: sc connect list'));
      process.exitCode = 1;
      return;
    }
    
    if (!command) {
      return printPluginHelp(plugin);
    }
    
    await routeToPlugin(plugin, command, args, options);
  } catch (error) {
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exitCode = 1;
  }
}

function listPlugins(): void {
  const plugins: PluginInfo[] = pluginRegistry.list();
  
  console.log(chalk.bold('\nAvailable Integrations\n'));
  
  if (plugins.length === 0) {
    console.log(chalk.gray('  No plugins found'));
    return;
  }
  
  for (const plugin of plugins) {
    console.log(
      chalk.cyan(plugin.id.padEnd(12)) +
      chalk.white(plugin.name.padEnd(20)) +
      chalk.gray(plugin.description || '')
    );
  }
  
  console.log(chalk.gray('\nRun: sc connect <plugin> --help for plugin commands'));
  console.log(chalk.gray('Run: sc connect status to check all connections\n'));
}

async function showAllStatuses(): Promise<void> {
  const plugins: PluginInfo[] = pluginRegistry.list();
  
  console.log(chalk.bold('\nConnection Status\n'));
  
  for (const pluginInfo of plugins) {
    const plugin: Plugin = pluginRegistry.get(pluginInfo.id);
    
    if (plugin.commands?.auth?.status) {
      try {
        const originalLog = console.log;
        let status: { connected: boolean; domain?: string } | null = null;
        
        console.log = () => {};
        status = await plugin.commands.auth.status();
        console.log = originalLog;
        
        if (status?.connected) {
          console.log(
            chalk.green('* ') +
            chalk.white(pluginInfo.name.padEnd(18)) +
            chalk.green('Connected') +
            (status.domain ? chalk.gray(` (${status.domain})`) : '')
          );
        } else {
          console.log(
            chalk.gray('o ') +
            chalk.white(pluginInfo.name.padEnd(18)) +
            chalk.gray('Not connected')
          );
        }
      } catch {
        console.log(
          chalk.gray('o ') +
          chalk.white(pluginInfo.name.padEnd(15)) +
          chalk.gray('Not connected')
        );
      }
    } else {
      console.log(
        chalk.gray('? ') +
        chalk.white(pluginInfo.name.padEnd(18)) +
        chalk.gray('No auth')
      );
    }
  }
  
  console.log();
}

async function routeToPlugin(
  plugin: Plugin,
  command: string,
  args: string[],
  options: ConnectOptions
): Promise<void> {
  if (command === 'auth' && args.length > 0) {
    const authCommand = args[0];
    const handler = plugin.commands.auth?.[authCommand];
    
    if (handler) {
      const result = await handler(args.slice(1), options);
      if (result && !result.success) {
        process.exitCode = 1;
      }
      return;
    } else {
      console.error(chalk.red(`Unknown auth command: ${authCommand}`));
      console.log(chalk.gray('Available: login, logout, status'));
      process.exitCode = 1;
      return;
    }
  }
  
  const handler = plugin.commands[command];
  
  if (typeof handler === 'function') {
    const result = await handler(args, options);
    if (result && !result.success) {
      process.exitCode = 1;
    }
    return;
  }
  
  console.error(chalk.red(`Unknown command: ${command}`));
  printPluginHelp(plugin);
  process.exitCode = 1;
}

function printPluginHelp(plugin: Plugin): void {
  console.log(`
${chalk.bold(plugin.name)} Integration

${chalk.gray(plugin.description)}

${chalk.cyan('Usage:')}
  sc connect ${plugin.id} <command> [args] [options]

${chalk.cyan('Commands:')}
`);

  if (plugin.commands.auth) {
    console.log(chalk.white('  Authentication:'));
    if (plugin.commands.auth.login) {
      console.log(chalk.gray('    auth login     ') + 'Connect to ' + plugin.name);
    }
    if (plugin.commands.auth.logout) {
      console.log(chalk.gray('    auth logout    ') + 'Disconnect');
    }
    if (plugin.commands.auth.status) {
      console.log(chalk.gray('    auth status    ') + 'Check connection status');
    }
  }

  const otherCommands = Object.keys(plugin.commands).filter(c => c !== 'auth');
  if (otherCommands.length > 0) {
    console.log(chalk.white('\n  Commands:'));
    for (const cmd of otherCommands) {
      const handler = plugin.commands[cmd];
      const desc = handler.description || cmd;
      console.log(chalk.gray(`    ${cmd.padEnd(14)} `) + desc);
    }
  }

  if (plugin.capabilities) {
    console.log(chalk.white('\n  Capabilities:'));
    const caps: string[] = [];
    if (plugin.capabilities.browse) caps.push('browse');
    if (plugin.capabilities.import) caps.push('import');
    if (plugin.capabilities.export) caps.push('export');
    if (plugin.capabilities.sync) caps.push('sync');
    console.log(chalk.gray('    ' + caps.join(', ')));
  }

  console.log(chalk.cyan('\nExamples:'));
  console.log(chalk.gray(`  sc connect ${plugin.id} auth login`));
  console.log(chalk.gray(`  sc connect ${plugin.id} auth status`));
  
  if (plugin.commands.list) {
    console.log(chalk.gray(`  sc connect ${plugin.id} list`));
  }
  console.log();
}

program.addHelpText('after', `
${chalk.cyan('Plugins:')}
  Run 'sc connect list' to see all available plugins
  Run 'sc connect status' to check all connection statuses

${chalk.cyan('Examples:')}
  sc connect jira auth login           Connect to Jira
  sc connect jira list --project PROJ  List issues in a project
  sc connect jira show PROJ-123        Show issue details
  sc connect google auth login         Connect to Google
  sc connect google list /             Browse Drive root
`);

export { program, handleConnect };
module.exports = { program, handleConnect };
