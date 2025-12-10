import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';

interface TestOptions {
  quick?: boolean;
  requirement?: string;
  quiet?: boolean;
  verbose?: boolean;
  e2e?: boolean;
  noBail?: boolean;
  help?: boolean;
  h?: boolean;
}

interface TestRunner {
  type: 'testme' | 'npm';
  path?: string;
  script?: string;
}

interface TestResult {
  success: boolean;
  error?: Error;
}

class TestRunnerClass {
  protected projectRoot: string;
  protected testmeScript: string;
  protected packageJson: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.testmeScript = path.join(projectRoot, 'TESTME.sh');
    this.packageJson = path.join(projectRoot, 'package.json');
  }

  findTestRunner(): TestRunner | null {
    if (fs.existsSync(this.testmeScript)) {
      return {
        type: 'testme',
        path: this.testmeScript
      };
    }

    if (fs.existsSync(this.packageJson)) {
      const pkg = JSON.parse(fs.readFileSync(this.packageJson, 'utf8'));
      if (pkg.scripts && pkg.scripts.test) {
        return {
          type: 'npm',
          script: pkg.scripts.test
        };
      }
    }

    return null;
  }

  run(options: TestOptions = {}): TestResult {
    const runner = this.findTestRunner();

    if (!runner) {
      console.error(chalk.red('❌ No test runner found'));
      console.error(chalk.gray('Expected:'));
      console.error(chalk.gray('  - TESTME.sh script'));
      console.error(chalk.gray('  - package.json with "test" script'));
      process.exit(1);
    }

    let command: string;
    let commandDescription: string;

    if (runner.type === 'testme') {
      commandDescription = 'Running TESTME.sh';
      command = this.buildTestmeCommand(options);
    } else {
      commandDescription = 'Running npm test';
      command = this.buildNpmCommand(options);
    }

    if (!options.quiet) {
      console.log(chalk.blue(`🧪 ${commandDescription}...`));
      if (options.verbose) {
        console.log(chalk.gray(`   Command: ${command}`));
      }
    }

    try {
      execSync(command, {
        cwd: this.projectRoot,
        stdio: options.quiet ? 'pipe' : 'inherit',
        env: {
          ...process.env,
          SC_QUICK_TESTS: options.quick ? 'true' : 'false',
          SC_TEST_REQUIREMENT: options.requirement || '',
        }
      });

      if (!options.quiet) {
        console.log(chalk.green('✅ Tests passed'));
      }
      return { success: true };
    } catch (error) {
      if (!options.quiet) {
        console.error(chalk.red('❌ Tests failed'));
      }
      return { success: false, error: error as Error };
    }
  }

  buildTestmeCommand(options: TestOptions): string {
    const parts = ['bash', this.testmeScript];

    if (options.quick) {
      parts.push('unit');
    }

    if (options.requirement) {
      parts.push('specific', options.requirement);
    }

    if (options.verbose) {
      parts.push('--verbose');
    }

    if (options.noBail) {
      parts.push('--no-bail');
    }

    if (options.e2e) {
      parts.push('--e2e');
    }

    return parts.join(' ');
  }

  buildNpmCommand(options: TestOptions): string {
    const parts = ['npm', 'test'];

    if (options.quick || options.requirement) {
      const npmArgs: string[] = [];

      if (options.quick) {
        npmArgs.push('--testPathPattern=unit');
      }

      if (options.requirement) {
        const reqNum = options.requirement.replace(/^REQ-/i, '');
        npmArgs.push(`--testPathPattern=req-${reqNum}`);
      }

      if (npmArgs.length > 0) {
        parts.push('--');
        parts.push(...npmArgs);
      }
    }

    return parts.join(' ');
  }

  showHelp(): void {
    console.log(chalk.bold('sc test - Test execution wrapper'));
    console.log('');
    console.log(chalk.cyan('Usage:'));
    console.log('  sc test [options]');
    console.log('');
    console.log(chalk.cyan('Behavior:'));
    console.log('  1. Check for TESTME.sh → run it');
    console.log('  2. Else check package.json for test script → npm test');
    console.log('  3. Else error: no test runner found');
    console.log('');
    console.log(chalk.cyan('Options:'));
    console.log('  --quick                Fast tests only (unit tests)');
    console.log('  --requirement REQ-XXX  Run tests for specific requirement');
    console.log('  --e2e                 Include end-to-end tests');
    console.log('  --no-bail             Continue testing after failures');
    console.log('  --quiet               Minimal output');
    console.log('  --verbose             Verbose output');
    console.log('  --help, -h            Show this help message');
    console.log('');
    console.log(chalk.cyan('Examples:'));
    console.log('  sc test                          # Run all tests');
    console.log('  sc test --quick                  # Run unit tests only');
    console.log('  sc test --requirement REQ-042    # Run REQ-042 tests');
    console.log('  sc test --e2e --verbose          # Run all tests including E2E');
    console.log('');
    console.log(chalk.cyan('TESTME.sh Integration:'));
    console.log('  If TESTME.sh exists, sc test will use it with these mappings:');
    console.log('    --quick        → TESTME.sh unit');
    console.log('    --requirement  → TESTME.sh specific REQ-XXX');
    console.log('    --e2e          → TESTME.sh --e2e');
  }
}

async function handleTestCommand(args: string[] = [], options: TestOptions = {}): Promise<void> {
  if (options.help || options.h || args.includes('--help') || args.includes('-h')) {
    const runner = new TestRunnerClass();
    runner.showHelp();
    return;
  }

  const parsedOptions: TestOptions = { ...options };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--quick') parsedOptions.quick = true;
    if (arg === '--requirement' && args[i + 1]) {
      parsedOptions.requirement = args[i + 1];
      i++;
    }
    if (arg === '--e2e') parsedOptions.e2e = true;
    if (arg === '--no-bail') parsedOptions.noBail = true;
    if (arg === '--quiet') parsedOptions.quiet = true;
    if (arg === '--verbose') parsedOptions.verbose = true;
  }

  const runner = new TestRunnerClass();
  const result = runner.run(parsedOptions);

  if (!result.success) {
    process.exit(1);
  }
}

export {
  TestRunnerClass as TestRunner,
  handleTestCommand
};

module.exports = {
  TestRunner: TestRunnerClass,
  handleTestCommand
};

if (require.main === module) {
  const args = process.argv.slice(2);
  handleTestCommand(args).catch((error) => {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    process.exit(1);
  });
}
