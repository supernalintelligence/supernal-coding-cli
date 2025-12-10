#!/usr/bin/env node
// @ts-nocheck

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const chalk = require('chalk');

/**
 * sc test - Test wrapper for ME.sh convention
 * 
 * Behavior:
 * 1. Check for TESTME.sh → run it
 * 2. Else check package.json for test script → npm test
 * 3. Else error: no test runner found
 * 
 * Options:
 * - --quick: fast tests only
 * - --requirement REQ-XXX: specific requirement
 * - --quiet: minimal output
 */

class TestRunner {
  packageJson: any;
  projectRoot: any;
  testmeScript: any;
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.testmeScript = path.join(projectRoot, 'TESTME.sh');
    this.packageJson = path.join(projectRoot, 'package.json');
  }

  /**
   * Find test runner (TESTME.sh or package.json test script)
   */
  findTestRunner() {
    // Priority 1: TESTME.sh
    if (fs.existsSync(this.testmeScript)) {
      return {
        type: 'testme',
        path: this.testmeScript
      };
    }

    // Priority 2: package.json test script
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

  /**
   * Run tests with appropriate runner
   */
  run(options = {}) {
    const runner = this.findTestRunner();

    if (!runner) {
      console.error(chalk.red('❌ No test runner found'));
      console.error(chalk.gray('Expected:'));
      console.error(chalk.gray('  - TESTME.sh script'));
      console.error(chalk.gray('  - package.json with "test" script'));
      process.exit(1);
    }

    // Build command based on runner type
    let command;
    let commandDescription;

    if (runner.type === 'testme') {
      commandDescription = 'Running TESTME.sh';
      command = this.buildTestmeCommand(options);
    } else {
      commandDescription = 'Running npm test';
      command = this.buildNpmCommand(options);
    }

    // Display what we're running
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
          // Pass environment variables for test configuration
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
      return { success: false, error };
    }
  }

  /**
   * Build TESTME.sh command with options
   */
  buildTestmeCommand(options) {
    const parts = ['bash', this.testmeScript];

    // Map sc test options to TESTME.sh arguments
    if (options.quick) {
      parts.push('unit'); // Run unit tests only for quick mode
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

  /**
   * Build npm test command with options
   */
  buildNpmCommand(options) {
    const parts = ['npm', 'test'];

    // Pass options through npm test -- syntax
    if (options.quick || options.requirement) {
      const npmArgs = [];

      if (options.quick) {
        // Try to run quick/unit tests if possible
        npmArgs.push('--testPathPattern=unit');
      }

      if (options.requirement) {
        // Filter by requirement ID
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

  /**
   * Show help
   */
  showHelp() {
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

/**
 * CLI handler
 */
async function handleTestCommand(args = [], options = {}) {
  // Handle help
  if (options.help || options.h || args.includes('--help') || args.includes('-h')) {
    const runner = new TestRunner();
    runner.showHelp();
    return;
  }

  // Parse options from args if not already provided
  const parsedOptions = { ...options };
  
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

  const runner = new TestRunner();
  const result = runner.run(parsedOptions);

  if (!result.success) {
    process.exit(1);
  }
}

// Export for CLI integration
module.exports = {
  TestRunner,
  handleTestCommand
};

// Handle direct execution
if (require.main === module) {
  const args = process.argv.slice(2);
  handleTestCommand(args).catch((error) => {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    process.exit(1);
  });
}
