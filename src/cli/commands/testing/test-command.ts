/**
 * Main test command module for SC CLI
 * Integrates test guidance, mapping, and execution functionality
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const TestGuidanceSystem = require('./test-guidance');
const TestMapperCommand = require('./test-mapper');
const { generateHelpText } = require('../../command-metadata');

interface TestOptions {
  watch?: boolean;
  coverage?: boolean;
  verbose?: boolean;
  help?: boolean;
}

class TestCommand {
  protected guidance: InstanceType<typeof TestGuidanceSystem>;
  protected mapper: InstanceType<typeof TestMapperCommand>;

  constructor() {
    this.guidance = new TestGuidanceSystem();
    this.mapper = new TestMapperCommand();
  }

  createCommand(): Command {
    const command = new Command('test');
    command
      .description('Testing guidance and execution system')
      .option('--watch', 'Watch mode')
      .option('--coverage', 'Generate coverage report')
      .option('-v, --verbose', 'Verbose output')
      .argument(
        '[action]',
        'Action to perform (guide, setup, validate, plan, run, doctor)'
      )
      .argument('[target]', 'Target for the action')
      .action(async (action: string | undefined, target: string | undefined, options: TestOptions) => {
        try {
          await this.execute(action, target, options);
        } catch (error) {
          console.error(chalk.red('❌ Test command failed:'), (error as Error).message);
          process.exit(1);
        }
      });

    return command;
  }

  async execute(action: string | undefined, target: string | undefined, options: TestOptions): Promise<void> {
    if (!action || action === 'help') {
      this.showHelp();
      return;
    }

    switch (action.toLowerCase()) {
      case 'guide':
        await this.guidance.showGuidance(target, options);
        break;
      case 'setup':
        await this.guidance.setupTesting(options);
        break;
      case 'validate':
        await this.guidance.validateTests(options);
        break;
      case 'plan':
        if (!target) {
          console.error(
            chalk.red('❌ Please provide requirement ID: sc test plan REQ-003')
          );
          process.exit(1);
        }
        await this.guidance.generateTestPlan(target, options);
        break;
      case 'run':
        await this.runTests(target, options);
        break;
      case 'doctor':
        await this.guidance.diagnoseIssues(options);
        break;
      case 'map':
        await this.mapper.execute(options);
        break;
      case 'structure':
        await this.guidance.showStructureGuidance(options);
        break;
      default:
        console.error(chalk.red(`❌ Unknown action: ${action}`));
        this.showHelp();
        process.exit(1);
    }
  }

  async runTests(type: string | undefined, options: TestOptions): Promise<void> {
    console.log(chalk.blue('🧪 Test Execution'));
    console.log(chalk.blue('='.repeat(40)));

    const testmeScript = path.join(process.cwd(), 'TESTME.sh');
    if (fs.existsSync(testmeScript)) {
      console.log(
        chalk.yellow('📋 Running tests using standardized TESTME.sh')
      );
      try {
        execSync('bash TESTME.sh', { stdio: 'inherit' });
        console.log(chalk.green('✅ Tests completed successfully'));
      } catch (_error) {
        console.error(chalk.red('❌ Tests failed'));
        process.exit(1);
      }
      return;
    }

    console.log(
      chalk.yellow('📋 TESTME.sh not found, falling back to npm test')
    );
    try {
      let command = 'npm test';
      if (type) {
        switch (type.toLowerCase()) {
          case 'unit':
            command = 'npm test -- --testPathPattern="unit"';
            break;
          case 'e2e':
            command = 'npm test -- --testPathPattern="e2e"';
            break;
          case 'integration':
            command = 'npm test -- --testPathPattern="integration"';
            break;
        }
      }

      if (options.coverage) {
        command += ' --coverage';
      }

      execSync(command, { stdio: 'inherit' });
      console.log(chalk.green('✅ Tests completed successfully'));
    } catch (_error) {
      console.error(chalk.red('❌ Tests failed'));
      process.exit(1);
    }
  }

  showHelp(): void {
    console.log(generateHelpText('test', '🧪 Supernal Test System'));
  }
}

async function handleTestCommand(options?: TestOptions): Promise<void> {
  const testCmd = new TestCommand();

  if (options?.help) {
    testCmd.showHelp();
    return;
  }

  await testCmd.execute(undefined, undefined, options || {});
}

export { handleTestCommand, TestCommand };
module.exports = { handleTestCommand };
module.exports.TestCommand = TestCommand;
