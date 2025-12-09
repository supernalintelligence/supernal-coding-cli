#!/usr/bin/env node

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const chalk = require('chalk');

/**
 * sc build - Build wrapper for ME.sh convention
 * 
 * Behavior:
 * 1. Check for BUILDME.sh → run it
 * 2. Else check package.json for build script → npm run build
 * 3. Else error: no build runner found
 * 
 * Options:
 * - --quiet: CI mode (minimal output)
 * - --no-smoke-tests: Skip smoke tests
 */

class BuildRunner {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.buildmeScript = path.join(projectRoot, 'BUILDME.sh');
    this.packageJson = path.join(projectRoot, 'package.json');
  }

  /**
   * Find build runner (BUILDME.sh or package.json build script)
   */
  findBuildRunner() {
    // Priority 1: BUILDME.sh
    if (fs.existsSync(this.buildmeScript)) {
      return {
        type: 'buildme',
        path: this.buildmeScript
      };
    }

    // Priority 2: package.json build script
    if (fs.existsSync(this.packageJson)) {
      const pkg = JSON.parse(fs.readFileSync(this.packageJson, 'utf8'));
      if (pkg.scripts && pkg.scripts.build) {
        return {
          type: 'npm',
          script: pkg.scripts.build
        };
      }
    }

    return null;
  }

  /**
   * Run build with appropriate runner
   */
  run(options = {}) {
    const runner = this.findBuildRunner();

    if (!runner) {
      console.error(chalk.red('❌ No build runner found'));
      console.error(chalk.gray('Expected:'));
      console.error(chalk.gray('  - BUILDME.sh script'));
      console.error(chalk.gray('  - package.json with "build" script'));
      process.exit(1);
    }

    // Build command based on runner type
    let command;
    let commandDescription;

    if (runner.type === 'buildme') {
      commandDescription = 'Running BUILDME.sh';
      command = this.buildBuildmeCommand(options);
    } else {
      commandDescription = 'Running npm run build';
      command = this.buildNpmCommand(options);
    }

    // Display what we're running
    if (!options.quiet) {
      console.log(chalk.blue(`🔨 ${commandDescription}...`));
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
          // Pass environment variables for build configuration
          CI: options.quiet ? 'true' : process.env.CI || 'false',
          QUIET_MODE: options.quiet ? 'true' : 'false',
        }
      });

      if (!options.quiet) {
        console.log(chalk.green('✅ Build completed successfully'));
      }
      return { success: true };
    } catch (error) {
      if (!options.quiet) {
        console.error(chalk.red('❌ Build failed'));
      }
      return { success: false, error };
    }
  }

  /**
   * Build BUILDME.sh command with options
   */
  buildBuildmeCommand(options) {
    const parts = ['bash', this.buildmeScript];

    // Map sc build options to BUILDME.sh arguments
    if (options.quiet) {
      parts.push('--quiet');
    }

    if (options.noColors) {
      parts.push('--no-colors');
    }

    if (options.noSmokeTests) {
      parts.push('--no-smoke-tests');
    }

    return parts.join(' ');
  }

  /**
   * Build npm build command with options
   */
  buildNpmCommand(options) {
    const parts = ['npm', 'run', 'build'];

    // npm run build typically doesn't take many options
    // but we can pass environment variables instead
    return parts.join(' ');
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(chalk.bold('sc build - Build execution wrapper'));
    console.log('');
    console.log(chalk.cyan('Usage:'));
    console.log('  sc build [options]');
    console.log('');
    console.log(chalk.cyan('Behavior:'));
    console.log('  1. Check for BUILDME.sh → run it');
    console.log('  2. Else check package.json for build script → npm run build');
    console.log('  3. Else error: no build runner found');
    console.log('');
    console.log(chalk.cyan('Options:'));
    console.log('  --quiet              CI mode (minimal output)');
    console.log('  --no-colors          Disable colored output');
    console.log('  --no-smoke-tests     Skip smoke tests (BUILDME.sh only)');
    console.log('  --verbose            Verbose output');
    console.log('  --help, -h           Show this help message');
    console.log('');
    console.log(chalk.cyan('Examples:'));
    console.log('  sc build                    # Run build');
    console.log('  sc build --quiet            # CI mode');
    console.log('  sc build --no-smoke-tests   # Skip smoke tests');
    console.log('  sc build --verbose          # Verbose output');
    console.log('');
    console.log(chalk.cyan('BUILDME.sh Integration:'));
    console.log('  If BUILDME.sh exists, sc build will use it with these mappings:');
    console.log('    --quiet           → BUILDME.sh --quiet');
    console.log('    --no-colors       → BUILDME.sh --no-colors');
    console.log('    --no-smoke-tests  → BUILDME.sh --no-smoke-tests');
    console.log('');
    console.log(chalk.cyan('Environment Variables:'));
    console.log('  CI=true              Set automatically with --quiet');
    console.log('  QUIET_MODE=true      Passed to BUILDME.sh with --quiet');
  }
}

/**
 * CLI handler
 */
async function handleBuildCommand(args = [], options = {}) {
  // Handle help
  if (options.help || options.h || args.includes('--help') || args.includes('-h')) {
    const runner = new BuildRunner();
    runner.showHelp();
    return;
  }

  // Parse options from args if not already provided
  const parsedOptions = { ...options };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--quiet') parsedOptions.quiet = true;
    if (arg === '--no-colors') parsedOptions.noColors = true;
    if (arg === '--no-smoke-tests') parsedOptions.noSmokeTests = true;
    if (arg === '--verbose') parsedOptions.verbose = true;
  }

  const runner = new BuildRunner();
  const result = runner.run(parsedOptions);

  if (!result.success) {
    process.exit(1);
  }
}

// Export for CLI integration
module.exports = {
  BuildRunner,
  handleBuildCommand
};

// Handle direct execution
if (require.main === module) {
  const args = process.argv.slice(2);
  handleBuildCommand(args).catch((error) => {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    process.exit(1);
  });
}
