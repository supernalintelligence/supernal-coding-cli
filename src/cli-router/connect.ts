// @ts-nocheck
/**
 * Connect CLI Command
 * 
 * Unified entry point for all external integrations.
 * Auto-discovers plugins from lib/plugins/ directory.
 * 
 * Usage:
 *   sc connect                     # List available plugins
 *   sc connect status              # Show all connection statuses
 *   sc connect <plugin> <command>  # Run plugin command
 * 
 * Examples:
 *   sc connect jira auth login
 *   sc connect jira list
 *   sc connect google auth login
 *   sc connect google list /
 */

const { Command } = require('commander');
const chalk = require('chalk');
const pluginRegistry = require('../plugins/registry');

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

/**
 * Main handler for connect command (can be called directly from program.js)
 */
async function handleConnect(pluginName, command, args, options) {
  try {
    // Discover all plugins
    pluginRegistry.discover();
    
    // No plugin specified - list available
    if (!pluginName || pluginName === 'list') {
      return listPlugins();
    }
    
    // Status command - show all connection statuses
    if (pluginName === 'status') {
      return showAllStatuses();
    }
    
    // Get specific plugin
    const plugin = pluginRegistry.get(pluginName);
    if (!plugin) {
      console.error(chalk.red(`Unknown plugin: ${pluginName}`));
      console.log(chalk.gray('Available plugins: ' + pluginRegistry.ids().join(', ')));
      console.log(chalk.gray('\nRun: sc connect list'));
      process.exitCode = 1;
      return;
    }
    
    // No command - show plugin help
    if (!command) {
      return printPluginHelp(plugin);
    }
    
    // Route to plugin command
    await routeToPlugin(plugin, command, args, options);
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exitCode = 1;
  }
}

/**
 * List all available plugins
 */
function listPlugins() {
  const plugins = pluginRegistry.list();
  
  console.log(chalk.bold('\n📦 Available Integrations\n'));
  
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

/**
 * Show connection status for all plugins
 */
async function showAllStatuses() {
  const plugins = pluginRegistry.list();
  
  console.log(chalk.bold('\n🔌 Connection Status\n'));
  
  for (const pluginInfo of plugins) {
    const plugin = pluginRegistry.get(pluginInfo.id);
    
    // Try to get status if plugin has auth commands
    if (plugin.commands?.auth?.status) {
      try {
        // Capture original console.log to suppress plugin output
        const originalLog = console.log;
        let status = null;
        
        console.log = () => {}; // Suppress
        status = await plugin.commands.auth.status();
        console.log = originalLog; // Restore
        
        if (status?.connected) {
          console.log(
            chalk.green('● ') +
            chalk.white(pluginInfo.name.padEnd(18)) +
            chalk.green('Connected') +
            (status.domain ? chalk.gray(` (${status.domain})`) : '')
          );
        } else {
          console.log(
            chalk.gray('○ ') +
            chalk.white(pluginInfo.name.padEnd(18)) +
            chalk.gray('Not connected')
          );
        }
      } catch {
        console.log(
          chalk.gray('○ ') +
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

/**
 * Route command to plugin handler
 */
async function routeToPlugin(plugin, command, args, options) {
  // Handle nested auth commands (e.g., "auth login")
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
  
  // Handle direct commands
  const handler = plugin.commands[command];
  
  if (typeof handler === 'function') {
    const result = await handler(args, options);
    if (result && !result.success) {
      process.exitCode = 1;
    }
    return;
  }
  
  // Unknown command
  console.error(chalk.red(`Unknown command: ${command}`));
  printPluginHelp(plugin);
  process.exitCode = 1;
}

/**
 * Print help for a specific plugin
 */
function printPluginHelp(plugin) {
  console.log(`
${chalk.bold(plugin.name)} Integration

${chalk.gray(plugin.description)}

${chalk.cyan('Usage:')}
  sc connect ${plugin.id} <command> [args] [options]

${chalk.cyan('Commands:')}
`);

  // Auth commands
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

  // Other commands
  const otherCommands = Object.keys(plugin.commands).filter(c => c !== 'auth');
  if (otherCommands.length > 0) {
    console.log(chalk.white('\n  Commands:'));
    for (const cmd of otherCommands) {
      const handler = plugin.commands[cmd];
      const desc = handler.description || cmd;
      console.log(chalk.gray(`    ${cmd.padEnd(14)} `) + desc);
    }
  }

  // Capabilities
  if (plugin.capabilities) {
    console.log(chalk.white('\n  Capabilities:'));
    const caps = [];
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

// Add help text
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

module.exports = { program, handleConnect };

