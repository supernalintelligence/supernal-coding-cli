/**
 * Resource CLI Command
 * 
 * Entry point for the `sc resource` command.
 * Routes to service-specific handlers.
 */

const { Command } = require('commander');
const { handleResourceCommand, listIntegrations } = require('../lib/cli/commands/resource');

const program = new Command('resource')
  .description('Manage external resources and integrations')
  .argument('[service]', 'Service to interact with (google, notion, confluence)')
  .argument('[action]', 'Action to perform')
  .argument('[args...]', 'Additional arguments')
  .option('--output, -o <path>', 'Output path for import')
  .option('--format, -f <format>', 'Output format (markdown)')
  .option('--sheet <name>', 'Sheet tab name for spreadsheets')
  .option('--images <mode>', 'Image handling (embed|link|skip)')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--all', 'Apply to all resources')
  .option('--stale', 'Only stale resources')
  .action(async (service, action, args, options) => {
    if (!service || service === 'list') {
      // No service specified or list command
      await listIntegrations();
      return;
    }
    
    try {
      const result = await handleResourceCommand(service, action, args, options);
      if (!result.success) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exitCode = 1;
    }
  });

// Add help text for specific services
program.addHelpText('after', `
Services:
  google      Google Workspace (Drive, Docs, Sheets)
  notion      Notion (planned)
  confluence  Confluence (planned)

Examples:
  $ sc resource google auth login           Connect to Google
  $ sc resource google list /               Browse Drive root
  $ sc resource google import 1abc...xyz    Import a document
  $ sc resource list                        List all integrations

Run 'sc resource <service> --help' for service-specific commands.
`);

module.exports = { program };

