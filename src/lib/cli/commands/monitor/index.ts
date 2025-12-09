#!/usr/bin/env node

/**
 * Monitor Command Hub - sc monitor
 * Combines development monitoring and GitHub issue awaiting
 */

const chalk = require('chalk');

async function main(passedArgs) {
  // Handle both direct invocation and programmatic calls
  const args = passedArgs || process.argv.slice(2);
  const subcommand = args[0];

  // Route to appropriate subcommand
  switch (subcommand) {
    case 'await':
      // GitHub issue response awaiting
      const awaitModule = require('./await');
      return await awaitModule.main();

    case 'status':
    case 'watch':
    case 'setup':
    case 'check':
    case 'diagnose':
    case 'failures':
    case 'errors':
    case 'live':
    case 'follow':
    case 'ci':
    case 'workflows':
    case 'pipelines':
    case undefined:
      // Development monitoring (original monitor.js functionality)
      const devMonitor = require('../development/monitor');
      return await devMonitor(args);

    case '--help':
    case '-h':
      console.log(chalk.blue('sc monitor - Development & GitHub monitoring'));
      console.log('');
      console.log(chalk.cyan('Development Monitoring:'));
      console.log('  status                     Show overall development status (default)');
      console.log('  ci, workflows, pipelines   Quick CI/CD status check');
      console.log('  diagnose, failures, errors Analyze failed workflows');
      console.log('  watch, live, follow        Live monitoring of workflows');
      console.log('  setup                      Configure auto-monitoring');
      console.log('  check                      Quick integration check');
      console.log('');
      console.log(chalk.cyan('GitHub Issue Monitoring:'));
      console.log('  await --issue <num>        Await response on GitHub issue');
      console.log('');
      console.log(chalk.yellow('Examples:'));
      console.log('  sc monitor status          # Show dev status');
      console.log('  sc monitor diagnose        # Analyze CI failures');
      console.log('  sc monitor await --issue 22 --interval 2m --timeout 30m');
      console.log('');
      console.log(chalk.gray('Run "sc monitor <command> --help" for more details'));
      console.log('');
      return 0;

    default:
      console.log(chalk.yellow(`⚠️  Unknown subcommand: ${subcommand}`));
      console.log(chalk.gray('Run "sc monitor --help" for available commands'));
      return 1;
  }
}

// Export for use in other modules
module.exports = main;

// Run if called directly
if (require.main === module) {
  main().then(exitCode => {
    if (typeof exitCode === 'number') {
      process.exit(exitCode);
    }
  }).catch(error => {
    console.error(chalk.red('❌ Monitor error:'), error.message);
    process.exit(1);
  });
}
