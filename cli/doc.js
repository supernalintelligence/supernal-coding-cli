/**
 * Document Management CLI Commands
 *
 * Commands for managing controlled documents, viewing history,
 * and checking compliance with document registry.
 */

const { Command } = require('commander');
const chalk = require('chalk');

const doc = new Command('doc').description('Document management commands');

// ============================================================================
// sc doc history
// ============================================================================
doc
  .command('history <file>')
  .description('Show change history for a document')
  .option('--since <date>', 'Show changes since date (YYYY-MM-DD)')
  .option('--author <name>', 'Filter by author')
  .option('--show-diff', 'Include diffs in output')
  .option('--json', 'Output as JSON for dashboard integration')
  .option('--signed-only', 'Only show signed commits')
  .option('--limit <n>', 'Limit number of commits', '50')
  .action(async (file, options) => {
    const DocumentHistory = require('../lib/doc/DocumentHistory');
    const history = new DocumentHistory();
    await history.show(file, options);
  });

// ============================================================================
// sc doc check
// ============================================================================
doc
  .command('check')
  .description('Check staged files against document registry')
  .option('--staged', 'Only check staged files (default)')
  .option('--all', 'Check all modified files')
  .option('--quiet', 'Suppress output, only return exit code')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const DocumentRegistryCheck = require('../lib/doc/DocumentRegistryCheck');
    const checker = new DocumentRegistryCheck();
    const result = await checker.check(options);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      checker.displayResults(result);
    }

    if (!result.success && result.controlledFiles?.length > 0) {
      process.exit(1);
    }
  });

// ============================================================================
// sc doc registry
// ============================================================================
const registry = doc
  .command('registry')
  .description('Manage document registry');

registry
  .command('list')
  .description('List all registered document paths')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const DocumentRegistry = require('../lib/doc/DocumentRegistry');
    const reg = new DocumentRegistry();

    if (options.json) {
      const data = reg.load();
      console.log(JSON.stringify(data, null, 2));
    } else {
      // list() handles its own output
      reg.list();
    }
  });

registry
  .command('check <file>')
  .description('Check if a file is in a controlled path')
  .action(async (file) => {
    const DocumentRegistry = require('../lib/doc/DocumentRegistry');
    const reg = new DocumentRegistry();
    const result = reg.check(file);

    if (result.isControlled) {
      console.log(chalk.green(`✅ ${file}`));
      console.log(`   Level: ${result.level}`);
      console.log(
        `   Requires signed commit: ${result.requiresSigned ? 'Yes' : 'No'}`
      );
    } else {
      console.log(chalk.gray(`ℹ️  ${file} is not in a controlled path`));
    }
  });

registry
  .command('add <pattern>')
  .description('Add a path pattern to the registry')
  .option('--level <level>', 'Control level: required or tracked', 'tracked')
  .action(async (pattern, options) => {
    const DocumentRegistry = require('../lib/doc/DocumentRegistry');
    const reg = new DocumentRegistry();
    reg.add(pattern, options.level);
    console.log(chalk.green(`✅ Added ${pattern} as ${options.level}`));
  });

registry
  .command('init')
  .description('Initialize document registry with defaults')
  .action(async () => {
    const DocumentRegistry = require('../lib/doc/DocumentRegistry');
    const reg = new DocumentRegistry();
    reg.init();
    console.log(
      chalk.green(
        '✅ Document registry initialized at .supernal/document-registry.yaml'
      )
    );
  });

registry
  .command('stats')
  .description('Show document registry statistics')
  .action(async () => {
    const DocumentRegistry = require('../lib/doc/DocumentRegistry');
    const reg = new DocumentRegistry();
    const stats = reg.stats();

    console.log(chalk.bold('Document Registry Statistics'));
    console.log(`  Required paths: ${stats.requiredCount}`);
    console.log(`  Tracked paths: ${stats.trackedCount}`);
    console.log(`  Total patterns: ${stats.totalPatterns}`);
  });

module.exports = doc;
