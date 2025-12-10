/**
 * Coverage Commands
 * SC CLI commands for external coverage tool integration
 */

import chalk from 'chalk';
import { CoverageManager } from './CoverageManager';
import type {
  CoverageInitOptions,
  CoverageRunOptions,
  CoverageCheckOptions,
  CoverageReportOptions,
  CoverageStack,
  CoverageTool,
} from './types';

/**
 * Handle coverage init command
 */
async function handleCoverageInit(options: {
  stack?: string;
  tool?: string;
  minLine?: string;
  minBranch?: string;
  minFunction?: string;
  force?: boolean;
  dryRun?: boolean;
}): Promise<void> {
  const manager = new CoverageManager();

  const initOptions: CoverageInitOptions = {
    stack: (options.stack as CoverageStack) || 'auto',
    tool: (options.tool as CoverageTool) || 'auto',
    minLine: options.minLine ? parseInt(options.minLine, 10) : undefined,
    minBranch: options.minBranch ? parseInt(options.minBranch, 10) : undefined,
    minFunction: options.minFunction ? parseInt(options.minFunction, 10) : undefined,
    force: options.force,
    dryRun: options.dryRun,
  };

  await manager.init(initOptions);
}

/**
 * Handle coverage validate command
 */
async function handleCoverageValidate(options: {
  quiet?: boolean;
  json?: boolean;
}): Promise<void> {
  const manager = new CoverageManager();
  const result = await manager.validate();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
    return;
  }

  if (!options.quiet) {
    console.log(chalk.blue('🔍 Coverage Validation\n'));
  }

  // Display checks
  for (const check of result.checks) {
    const icon = check.passed ? chalk.green('✅') : chalk.red('❌');
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (!check.passed && check.suggestion) {
      console.log(chalk.gray(`   → ${check.suggestion}`));
    }
  }

  // Display warnings
  if (result.warnings.length > 0) {
    console.log();
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`⚠️  ${warning}`));
    }
  }

  // Summary
  console.log();
  if (result.valid) {
    console.log(chalk.green('✅ Coverage validation passed'));
    if (result.warnings.length > 0) {
      console.log(chalk.gray(`   (${result.warnings.length} warnings)`));
    }
  } else {
    console.log(chalk.red('❌ Coverage validation failed'));
    console.log(chalk.gray('   Fix errors above and retry'));
    process.exit(1);
  }
}

/**
 * Handle coverage run command
 */
async function handleCoverageRun(options: {
  check?: boolean;
  include?: string;
  e2e?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const manager = new CoverageManager();

  const runOptions: CoverageRunOptions = {
    check: options.check,
    include: options.include,
    e2e: options.e2e,
    quiet: options.quiet,
    verbose: options.verbose,
  };

  const result = await manager.run(runOptions);

  if (!result.success) {
    if (result.error) {
      console.error(chalk.red(`\n❌ ${result.error}`));
    }
    process.exit(1);
  }
}

/**
 * Handle coverage check command
 */
async function handleCoverageCheck(options: {
  minLine?: string;
  minBranch?: string;
  minFunction?: string;
  minStatement?: string;
  json?: boolean;
}): Promise<void> {
  const manager = new CoverageManager();

  const checkOptions: CoverageCheckOptions = {
    minLine: options.minLine ? parseInt(options.minLine, 10) : undefined,
    minBranch: options.minBranch ? parseInt(options.minBranch, 10) : undefined,
    minFunction: options.minFunction ? parseInt(options.minFunction, 10) : undefined,
    minStatement: options.minStatement ? parseInt(options.minStatement, 10) : undefined,
    json: options.json,
  };

  const result = await manager.check(checkOptions);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.passed ? 0 : 1);
}

/**
 * Handle coverage report command
 */
async function handleCoverageReport(options: {
  format?: string;
  withRequirements?: boolean;
  output?: string;
}): Promise<void> {
  // TODO: Implement report generation
  console.log(chalk.blue('📊 Coverage Report\n'));
  console.log(chalk.yellow('⚠️  Report generation not yet implemented'));
  console.log(chalk.gray('\nAvailable formats: html, lcov, json, text, compliance'));
  console.log(chalk.gray('\nFor now, check ./coverage/index.html after running sc coverage run'));
}

/**
 * Handle coverage config command
 */
async function handleCoverageConfig(options: {
  setThreshold?: string;
  enableEnforcement?: string;
  show?: boolean;
}): Promise<void> {
  // TODO: Implement config management
  if (options.show || (!options.setThreshold && !options.enableEnforcement)) {
    const manager = new CoverageManager();
    const result = await manager.validate();
    
    console.log(chalk.blue('📋 Coverage Configuration\n'));
    console.log(chalk.white(`Config file: ${result.config.path}`));
    console.log(chalk.white(`Stack: ${result.stack.detected}`));
    console.log(chalk.white(`Tool: ${result.tool.name}`));
    
    if (result.config.thresholds) {
      console.log(chalk.white('\nThresholds:'));
      console.log(chalk.gray(`  Line: ${result.config.thresholds.line}%`));
      console.log(chalk.gray(`  Branch: ${result.config.thresholds.branch}%`));
      console.log(chalk.gray(`  Function: ${result.config.thresholds.function}%`));
      console.log(chalk.gray(`  Statement: ${result.config.thresholds.statement}%`));
    }
    return;
  }

  console.log(chalk.yellow('⚠️  Config modification not yet implemented'));
  console.log(chalk.gray('\nEdit .supernal/coverage.yaml directly'));
}

/**
 * Handle coverage hooks command
 */
async function handleCoverageHooks(action: string, options: {
  verbose?: boolean;
}): Promise<void> {
  console.log(chalk.blue('🔗 Coverage Hooks\n'));

  if (action === 'install') {
    console.log(chalk.yellow('⚠️  Hook installation not yet implemented'));
    console.log(chalk.gray('\nAdd to .husky/pre-push manually:'));
    console.log(chalk.gray('  sc coverage run --check'));
    return;
  }

  if (action === 'status') {
    console.log(chalk.gray('Hook status:'));
    console.log(chalk.gray('  pre-commit: disabled'));
    console.log(chalk.gray('  pre-push: not installed'));
    console.log(chalk.gray('\nRun: sc coverage hooks install'));
    return;
  }

  console.log(chalk.gray('Available actions:'));
  console.log(chalk.gray('  sc coverage hooks install  - Install pre-push coverage check'));
  console.log(chalk.gray('  sc coverage hooks status   - Show hook status'));
}

/**
 * Main coverage command handler
 */
async function handleCoverageCommand(
  action: string | undefined,
  args: string[],
  options: Record<string, unknown>
): Promise<void> {
  try {
    switch (action) {
      case 'init':
        await handleCoverageInit(options as Parameters<typeof handleCoverageInit>[0]);
        break;

      case 'validate':
        await handleCoverageValidate(options as Parameters<typeof handleCoverageValidate>[0]);
        break;

      case 'run':
        await handleCoverageRun(options as Parameters<typeof handleCoverageRun>[0]);
        break;

      case 'check':
        await handleCoverageCheck(options as Parameters<typeof handleCoverageCheck>[0]);
        break;

      case 'report':
        await handleCoverageReport(options as Parameters<typeof handleCoverageReport>[0]);
        break;

      case 'config':
        await handleCoverageConfig(options as Parameters<typeof handleCoverageConfig>[0]);
        break;

      case 'hooks':
        await handleCoverageHooks(args[0], options as Parameters<typeof handleCoverageHooks>[1]);
        break;

      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${(error as Error).message}`));
    if (options.verbose) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  }
}

/**
 * Show help for coverage command
 */
function showHelp(): void {
  console.log(chalk.blue('📊 Coverage Ecosystem Integration\n'));
  console.log(chalk.white('Configure and run external coverage tools (Vitest, Jest, Codecov)\n'));

  console.log(chalk.cyan('Commands:'));
  console.log(chalk.white('  sc coverage init           Initialize coverage configuration'));
  console.log(chalk.white('  sc coverage validate       Validate coverage setup'));
  console.log(chalk.white('  sc coverage run            Run tests with coverage'));
  console.log(chalk.white('  sc coverage check          Check coverage thresholds'));
  console.log(chalk.white('  sc coverage report         Generate coverage report'));
  console.log(chalk.white('  sc coverage config         View/modify configuration'));
  console.log(chalk.white('  sc coverage hooks          Manage git hooks'));

  console.log(chalk.cyan('\nInit options:'));
  console.log(chalk.gray('  --stack <stack>            Stack type (react-vite|nextjs|node|auto)'));
  console.log(chalk.gray('  --tool <tool>              Coverage tool (vitest|jest|c8|auto)'));
  console.log(chalk.gray('  --min-line <n>             Minimum line coverage %'));
  console.log(chalk.gray('  --min-branch <n>           Minimum branch coverage %'));
  console.log(chalk.gray('  --force                    Overwrite existing config'));
  console.log(chalk.gray('  --dry-run                  Show config without writing'));

  console.log(chalk.cyan('\nRun options:'));
  console.log(chalk.gray('  --check                    Validate thresholds after run'));
  console.log(chalk.gray('  --include <pattern>        Include only matching files'));
  console.log(chalk.gray('  --e2e                      Include E2E tests'));
  console.log(chalk.gray('  --quiet                    Minimal output'));
  console.log(chalk.gray('  --verbose                  Show detailed output'));

  console.log(chalk.cyan('\nExamples:'));
  console.log(chalk.gray('  sc coverage init --stack=react-vite'));
  console.log(chalk.gray('  sc coverage run --check'));
  console.log(chalk.gray('  sc coverage check --min-line=80'));
}

export {
  handleCoverageCommand,
  handleCoverageInit,
  handleCoverageValidate,
  handleCoverageRun,
  handleCoverageCheck,
  handleCoverageReport,
  handleCoverageConfig,
  handleCoverageHooks,
};

// Default export for CLI
export default handleCoverageCommand;

