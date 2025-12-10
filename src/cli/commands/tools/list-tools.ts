import { Command } from 'commander';

interface ListToolsOptions {
  category?: string;
  installed?: boolean;
}

const listTools = new Command('list-tools')
  .description('List available tools and their status')
  .option('-c, --category <category>', 'Filter by category')
  .option('--installed', 'Show only installed tools')
  .action((options: ListToolsOptions) => {
    console.log('List-tools command not yet implemented');
    console.log('Options:', options);
  });

export default listTools;
module.exports = listTools;
