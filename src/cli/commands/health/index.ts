import chalk from 'chalk';

const FeatureHealthCheck = require('./FeatureHealthCheck');

/** Health check options */
interface HealthCheckOptions {
  quiet?: boolean;
  exitCode?: boolean;
  verbose?: boolean;
}

/** Health check results */
interface HealthCheckResults {
  errors: unknown[];
  summary: string;
  [key: string]: unknown;
}

/**
 * Health command handler
 * Provides system health checks for various components
 */
async function handleHealthCommand(
  category: string | undefined,
  _args: unknown,
  options: HealthCheckOptions
): Promise<void> {
  try {
    switch (category) {
      case 'features': {
        const checker = new FeatureHealthCheck();
        const results: HealthCheckResults = await checker.check(options);
        checker.display(results, options);

        // Exit with status code if there are errors (for CI/CD)
        if (options.exitCode && results.errors.length > 0) {
          process.exit(1);
        }
        break;
      }

      case 'all': {
        console.log(chalk.blue('🏥 System Health Check\n'));

        // Run all health checks
        console.log(chalk.yellow('📦 Features:'));
        const featureChecker = new FeatureHealthCheck();
        const featureResults: HealthCheckResults = await featureChecker.check({ quiet: false });
        console.log(chalk.gray(`   ${featureResults.summary}\n`));

        // Add other health checks here as they're implemented
        // - Requirements health
        // - Traceability health
        // - Git hooks health

        break;
      }

      default: {
        console.log(chalk.yellow('Available health checks:'));
        console.log(
          chalk.white(
            '  sc health features  - Check feature documentation compliance'
          )
        );
        console.log(
          chalk.white('  sc health all       - Run all health checks')
        );
        console.log();
        console.log(chalk.gray('Options:'));
        console.log(chalk.gray('  --quiet             - Show only summary'));
        console.log(
          chalk.gray(
            '  --exit-code         - Exit with error code if issues found'
          )
        );
        break;
      }
    }
  } catch (error) {
    console.error(chalk.red(`❌ Health check failed: ${(error as Error).message}`));
    if (options.verbose) {
      console.error((error as Error).stack);
    }
    throw error;
  }
}

export { handleHealthCommand };
module.exports = { handleHealthCommand };
