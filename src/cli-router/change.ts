import { Command } from 'commander';

/** Change creation options */
interface ChangeOptions {
  type: string;
  impact: string;
  edit?: boolean;
}

const change = new Command('change').description('Manage change documents');

change
  .command('new <title>')
  .description('Create new change document')
  .option(
    '--type <type>',
    'Change type: general, security, feature, bugfix',
    'general'
  )
  .option('--impact <level>', 'Impact level: low, medium, high', 'medium')
  .option('--edit', 'Open in editor after creation')
  .action((title: string, options: ChangeOptions) => {
    const ChangeManager = require('../doc/ChangeManager');
    new ChangeManager().create(title, options);
  });

change
  .command('list')
  .description('List all change documents')
  .action(() => {
    const ChangeManager = require('../doc/ChangeManager');
    new ChangeManager().list();
  });

change
  .command('show <number>')
  .description('Show change document details')
  .action((num: string) => {
    const ChangeManager = require('../doc/ChangeManager');
    new ChangeManager().show(num);
  });

export default change;
module.exports = change;
