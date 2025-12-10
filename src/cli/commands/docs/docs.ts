import chalk from 'chalk';

interface DocsOptions {
  file?: string;
  _?: string[];
  autoFix?: boolean;
  interactive?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  cleanup?: boolean;
  mergeTemplates?: boolean;
  report?: boolean;
  path?: string | null;
  links?: boolean;
  fix?: boolean;
  fullReport?: boolean;
  help?: boolean;
  build?: boolean;
  serve?: boolean;
  port?: number;
  json?: boolean;
  since?: string;
  author?: string;
  showDiff?: boolean;
  signedOnly?: boolean;
  limit?: string;
  staged?: boolean;
  quiet?: boolean;
  level?: string;
  structure?: boolean;
  template?: boolean;
  all?: boolean;
  output?: string;
}

interface CommandResult {
  success: boolean;
  errors?: string[];
}

async function handleDocsCommand(action: string | undefined, options: DocsOptions): Promise<CommandResult | void> {
  if (action === 'validate') {
    const DocsWrapper = require('../documentation/docs');
    const wrapper = new DocsWrapper();
    return await wrapper.validateDocumentation(options);
  }

  if (action === 'process') {
    const processCmd = require('./process');
    const docFile = options.file || options._?.[0];

    if (!docFile) {
      processCmd.showHelp();
      return { success: false, errors: ['No documentation file specified'] };
    }

    return await processCmd.processDocumentation(docFile, options);
  }

  if (action === 'cleanup' || options.cleanup) {
    const cleanupCmd = require('./cleanup');
    return await cleanupCmd.run({
      autoFix: options.autoFix || false,
      interactive: options.interactive || false,
      dryRun: options.dryRun || false,
      verbose: options.verbose || false
    });
  }

  if (action === 'merge-templates' || options.mergeTemplates) {
    const { mergeTemplatesCommand } = require('./merge-templates');
    return await mergeTemplatesCommand({
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      report: options.report || false,
      path: options.path || null
    });
  }

  if (action === 'links' || options.links) {
    const LinkChecker = require('./validate-links');
    const checker = new LinkChecker({
      fix: options.fix || false,
      dryRun: options.dryRun || false,
      fullReport: options.fullReport || false,
      file: options.file || null
    });
    return await checker.run();
  }

  if (action === 'generate') {
    const generateCmd = require('./generate');

    if (options.help) {
      generateCmd.showHelp();
      return { success: true };
    }

    return await generateCmd.handleDocsGenerateCommand(options);
  }

  if (action === 'build' || options.build) {
    console.log(chalk.yellow('📚 Documentation build feature coming soon...'));
    console.log(
      chalk.gray('   Will build static documentation from requirements')
    );
    return;
  }

  if (action === 'serve' || options.serve) {
    const port = options.port || 3001;
    console.log(chalk.yellow(`📖 Documentation server feature coming soon...`));
    console.log(chalk.gray(`   Will serve docs at http://localhost:${port}`));
    return;
  }

  if (action === 'history') {
    const DocumentHistory = require('../../../doc/DocumentHistory');
    const history = new DocumentHistory();
    const file = options._?.[0];
    if (!file) {
      console.log(chalk.red('Error: File path required'));
      console.log(
        chalk.gray(
          'Usage: sc docs history <file> [--json] [--since <date>] [--author <name>] [--signed-only]'
        )
      );
      return { success: false };
    }
    return await history.show(file, {
      json: options.json,
      since: options.since,
      author: options.author,
      showDiff: options.showDiff,
      signedOnly: options.signedOnly,
      limit: options.limit || '50'
    });
  }

  if (action === 'check') {
    const DocumentRegistryCheck = require('../../../doc/DocumentRegistryCheck');
    const checker = new DocumentRegistryCheck();
    return await checker.check({
      staged: options.staged !== false,
      quiet: options.quiet,
      json: options.json
    });
  }

  if (action === 'registry') {
    const DocumentRegistry = require('../../../doc/DocumentRegistry');
    const registry = new DocumentRegistry();
    const subAction = options._?.[0];
    const arg = options._?.[1];

    switch (subAction) {
      case 'list':
        return registry.list();
      case 'check':
        if (!arg) {
          console.log(chalk.red('Error: File path required'));
          return { success: false };
        }
        return registry.check(arg);
      case 'add':
        if (!arg) {
          console.log(chalk.red('Error: Pattern required'));
          return { success: false };
        }
        return registry.add(arg, options.level || 'tracked');
      case 'init':
        return registry.init();
      case 'stats':
        return registry.stats();
      default:
        console.log(chalk.cyan('Document Registry Commands:'));
        console.log(
          '  sc docs registry list              # List controlled paths'
        );
        console.log(
          '  sc docs registry check <file>      # Check if file is controlled'
        );
        console.log(
          '  sc docs registry add <pattern>     # Add pattern (--level=required|tracked)'
        );
        console.log(
          '  sc docs registry init              # Initialize default registry'
        );
        console.log('  sc docs registry stats             # Show file counts');
        return { success: true };
    }
  }

  console.log(chalk.bold('📚 Documentation Management'));
  console.log('');
  console.log(chalk.cyan('Available commands:'));
  console.log('');
  console.log(chalk.bold('  Generation:'));
  console.log('  sc docs generate [--output <dir>] [--verbose]');
  console.log('    Generate CLI reference docs from CommandRegistry');
  console.log('');
  console.log(chalk.bold('  Validation:'));
  console.log('  sc docs validate [--structure] [--template] [--all] [--fix]');
  console.log('    Validate documentation (structure, templates, or both)');
  console.log('');
  console.log(
    '  sc docs merge-templates [--dry-run] [--report] [--path <path>] [--verbose]'
  );
  console.log('    Smart merge templates preserving approval history');
  console.log('');
  console.log(
    '  sc docs links [--fix] [--dry-run] [--file <path>] [--full-report]'
  );
  console.log('    Check and fix broken markdown links');
  console.log('');
  console.log(chalk.bold('  Processing:'));
  console.log('  sc docs process <file>');
  console.log('    Extract and implement code blocks from documentation');
  console.log('');
  console.log('  sc docs cleanup [--auto-fix] [--interactive] [--dry-run]');
  console.log('    Scan and cleanup documentation structure (ADR-001)');
  console.log('');
  console.log(chalk.bold('  Serving:'));
  console.log('  sc docs build');
  console.log('    Build static documentation (coming soon)');
  console.log('');
  console.log('  sc docs serve [-p <port>]');
  console.log('    Serve documentation locally (coming soon)');
  console.log('');
  console.log(
    '  sc docs history <file> [--json] [--since <date>] [--signed-only]'
  );
  console.log('    Show change history for a document');
  console.log('');
  console.log('  sc docs check [--quiet] [--json]');
  console.log('    Check staged files against document registry');
  console.log('');
  console.log('  sc docs registry <list|check|add|init|stats>');
  console.log('    Manage document registry');
  console.log('');
  console.log(chalk.bold('Examples:'));
  console.log('  sc docs validate                   # All validations');
  console.log('  sc docs validate --structure       # Just structure checks');
  console.log('  sc docs validate --template        # Just template checks');
  console.log('  sc docs validate --fix             # Fix what can be fixed');
  console.log('  sc docs merge-templates --dry-run  # Preview template sync');
  console.log(
    '  sc docs merge-templates --report   # Generate approval report'
  );
  console.log(
    '  sc docs links                      # Check all markdown links'
  );
  console.log('  sc docs links --fix                # Auto-fix broken links');
  console.log('  sc docs links --fix --dry-run      # Preview fixes');
  console.log(
    '  sc docs links --full-report        # Write full report to file'
  );
  console.log(
    '  sc docs process docs/features/{domain}/my-feature/planning/implementation.md'
  );
  console.log('  sc docs cleanup --auto-fix         # Fix automatically');
}

export default handleDocsCommand;
module.exports = handleDocsCommand;
