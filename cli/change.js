const { Command } = require('commander');

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
  .action((title, options) => {
    const ChangeManager = require('../lib/doc/ChangeManager');
    new ChangeManager().create(title, options);
  });

change
  .command('list')
  .description('List all change documents')
  .action(() => {
    const ChangeManager = require('../lib/doc/ChangeManager');
    new ChangeManager().list();
  });

change
  .command('show <number>')
  .description('Show change document details')
  .action((num) => {
    const ChangeManager = require('../lib/doc/ChangeManager');
    new ChangeManager().show(num);
  });

module.exports = change;
