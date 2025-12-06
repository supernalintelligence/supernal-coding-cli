/**
 * Resource Command
 * 
 * Manages external resources and integrations.
 * Acts as a router to service-specific subcommands.
 * 
 * Usage: sc resource <service> <action> [args]
 * 
 * Services:
 *   - google: Google Workspace (Drive, Docs, Sheets)
 *   - (future) notion: Notion pages and databases
 *   - (future) confluence: Confluence spaces and pages
 */

const chalk = require('chalk');
const { handleGoogleCommand } = require('./google');

/**
 * Handle the resource command
 */
async function handleResourceCommand(service, action, args = [], options = {}) {
  switch (service) {
    case 'google':
    case 'gdrive':
    case 'gdocs':
      return await handleGoogleCommand(action, args, options);
      
    case 'notion':
      console.log(chalk.dim('Notion integration is planned for a future release.'));
      return { success: false };
      
    case 'confluence':
      console.log(chalk.dim('Confluence integration is planned for a future release.'));
      return { success: false };
      
    case 'list':
      // List all configured integrations
      return await listIntegrations();
      
    default:
      printResourceHelp();
      return { success: false };
  }
}

/**
 * List all configured integrations
 */
async function listIntegrations() {
  const { fileStorage } = require('../../../credentials');
  
  console.log(chalk.bold('\n📦 Configured Integrations\n'));
  
  const services = await fileStorage.list();
  
  if (services.length === 0) {
    console.log(chalk.dim('No integrations configured.'));
    console.log(chalk.dim('Run: sc resource <service> auth login'));
  } else {
    for (const service of services) {
      console.log(`  ${chalk.green('✓')} ${service}`);
    }
  }
  
  console.log();
  return { success: true, services };
}

/**
 * Print help for resource commands
 */
function printResourceHelp() {
  console.log(`
${chalk.bold('External Resource Management')}

Manage external document sources and import them as traceable iResources.

${chalk.cyan('Usage:')}
  sc resource <service> <action> [args] [options]

${chalk.cyan('Available Services:')}
  google        Google Workspace (Drive, Docs, Sheets)
  notion        Notion (planned)
  confluence    Confluence (planned)

${chalk.cyan('Common Commands:')}
  sc resource list                          List configured integrations
  sc resource <service> auth login          Connect to service
  sc resource <service> auth status         Check connection
  sc resource <service> list                Browse available documents
  sc resource <service> import <id>         Import document as iResource

${chalk.cyan('Examples:')}
  sc resource google auth login             Connect Google account
  sc resource google list /                 List root Drive folder
  sc resource google import 1abc...xyz      Import a Google Doc

${chalk.cyan('iResource Format:')}
  Imported documents include traceable metadata:
  - Source URL and ID
  - Import timestamp
  - Content checksum (SHA-256)
  - Sync status tracking

${chalk.cyan('More Help:')}
  sc resource google --help                 Google-specific commands
`);
}

module.exports = {
  handleResourceCommand,
  listIntegrations
};

