#!/usr/bin/env node
// @ts-nocheck

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const chalk = require('chalk');

/**
 * sc build - Unified build command with docs generation and validation
 * 
 * Behavior:
 * 1. Generate CLI reference docs (if docs site detected)
 * 2. Validate required templates are installed
 * 3. Run BUILDME.sh or npm run build
 * 
 * Options:
 * - --quiet: CI mode (minimal output)
 * - --no-smoke-tests: Skip smoke tests
 * - --skip-docs: Skip docs generation
 * - --skip-validate: Skip template validation
 */

class BuildRunner {
  buildmeScript: any;
  packageJson: any;
  projectRoot: any;
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.buildmeScript = path.join(projectRoot, 'BUILDME.sh');
    this.packageJson = path.join(projectRoot, 'package.json');
  }

  /**
   * Check if this is a docs site that needs CLI docs generation
   */
  isDocsSite() {
    // Check for Next.js + docs directory pattern
    const nextConfig = path.join(this.projectRoot, 'next.config.js');
    const docsDir = path.join(this.projectRoot, 'docs');
    const supernalConfig = path.join(this.projectRoot, 'supernal.yaml');
    
    return fs.existsSync(nextConfig) && 
           fs.existsSync(docsDir) && 
           fs.existsSync(supernalConfig);
  }

  /**
   * Generate CLI reference documentation
   */
  async generateDocs(options = {}) {
    if (options.skipDocs) {
      if (!options.quiet) {
        console.log(chalk.gray('   Skipping docs generation (--skip-docs)'));
      }
      return { success: true };
    }

    if (!this.isDocsSite()) {
      if (options.verbose) {
        console.log(chalk.gray('   Not a docs site, skipping CLI docs generation'));
      }
      return { success: true };
    }

    if (!options.quiet) {
      console.log(chalk.blue('📚 Generating CLI reference docs...'));
    }

    try {
      const { DocsGenerator } = require('../docs/generate');
      const generator = new DocsGenerator({
        outputDir: path.join(this.projectRoot, 'docs', 'cli'),
        verbose: options.verbose
      });
      
      return await generator.generate();
    } catch (error) {
      if (!options.quiet) {
        console.log(chalk.yellow(`⚠️ Docs generation skipped: ${error.message}`));
      }
      // Don't fail build for docs generation issues
      return { success: true, warning: error.message };
    }
  }

  /**
   * Validate required templates are installed
   */
  validateTemplates(options = {}) {
    if (options.skipValidate) {
      if (!options.quiet) {
        console.log(chalk.gray('   Skipping template validation (--skip-validate)'));
      }
      return { success: true, warnings: [] };
    }

    if (!this.isDocsSite()) {
      return { success: true, warnings: [] };
    }

    const warnings = [];
    const requiredDirs = [
      { path: 'docs/guides', name: 'Guides', install: 'sc init --guides' },
      { path: 'docs/compliance', name: 'Compliance', install: 'sc init --compliance' },
      { path: 'docs/workflow', name: 'Workflow', install: 'sc init --workflow' }
    ];

    if (!options.quiet) {
      console.log(chalk.blue('🔍 Validating installed templates...'));
    }

    for (const dir of requiredDirs) {
      const fullPath = path.join(this.projectRoot, dir.path);
      if (!fs.existsSync(fullPath)) {
        warnings.push(`Missing ${dir.name}: Run "${dir.install}"`);
      } else if (options.verbose) {
        console.log(chalk.gray(`   ✓ ${dir.name} installed`));
      }
    }

    if (warnings.length > 0 && !options.quiet) {
      console.log(chalk.yellow('⚠️ Template warnings:'));
      for (const warn of warnings) {
        console.log(chalk.yellow(`   ${warn}`));
      }
    } else if (!options.quiet && !options.verbose) {
      console.log(chalk.green('   ✓ Templates validated'));
    }

    return { success: true, warnings };
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
   * Check if sc version needs to be published (for CI/Vercel awareness)
   */
  async checkVersionStatus(options = {}) {
    if (options.skipVersionCheck) {
      return { needsPublish: false };
    }

    try {
      const { checkPublishRequired } = require('./version-check');
      const status = await checkPublishRequired();
      
      if (status.needsPublish && !options.quiet) {
        console.log(chalk.yellow(`⚠️  Version notice: ${status.message}`));
        console.log(chalk.gray('   Run "npm publish" in supernal-code-package before deploying to Vercel'));
      }
      
      return status;
    } catch (error) {
      // Don't fail build for version check issues
      if (options.verbose) {
        console.log(chalk.gray(`   Version check skipped: ${error.message}`));
      }
      return { needsPublish: false };
    }
  }

  /**
   * Run build with appropriate runner
   * This is the main entry point that orchestrates:
   * 1. Version check (warn if unpublished)
   * 2. Docs generation (for docs sites)
   * 3. Template validation
   * 4. Actual build (BUILDME.sh or npm run build)
   */
  async run(options = {}) {
    const results = {
      versionCheck: null,
      docsGeneration: null,
      templateValidation: null,
      build: null
    };

    // Step 0: Check version status (warn only, don't block)
    results.versionCheck = await this.checkVersionStatus(options);

    // Step 1: Generate CLI docs (for docs sites)
    results.docsGeneration = await this.generateDocs(options);
    
    // Step 2: Validate templates
    results.templateValidation = this.validateTemplates(options);

    // Step 3: Find and run build
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
      results.build = { success: true };
    } catch (error) {
      if (!options.quiet) {
        console.error(chalk.red('❌ Build failed'));
      }
      results.build = { success: false, error };
    }

    return results;
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
    console.log(chalk.bold('sc build - Unified build with docs generation and validation'));
    console.log('');
    console.log(chalk.cyan('Usage:'));
    console.log('  sc build [options]');
    console.log('');
    console.log(chalk.cyan('What sc build does:'));
    console.log('  1. Generate CLI reference docs (for docs sites)');
    console.log('  2. Validate required templates are installed');
    console.log('  3. Run BUILDME.sh or npm run build');
    console.log('');
    console.log(chalk.cyan('Options:'));
    console.log('  --quiet              CI mode (minimal output)');
    console.log('  --verbose            Verbose output');
    console.log('  --skip-docs          Skip CLI docs generation');
    console.log('  --skip-validate      Skip template validation');
    console.log('  --no-colors          Disable colored output');
    console.log('  --no-smoke-tests     Skip smoke tests (BUILDME.sh only)');
    console.log('  --help, -h           Show this help message');
    console.log('');
    console.log(chalk.cyan('Examples:'));
    console.log('  sc build                    # Full build (generate + validate + build)');
    console.log('  sc build --quiet            # CI mode');
    console.log('  sc build --skip-docs        # Skip docs generation');
    console.log('  sc build --verbose          # Verbose output');
    console.log('');
    console.log(chalk.cyan('For Docs Sites (detected by next.config.js + docs/ + supernal.yaml):'));
    console.log('  - Generates CLI reference from CommandRegistry → docs/cli/');
    console.log('  - Validates guides, compliance, workflow templates installed');
    console.log('');
    console.log(chalk.cyan('In package.json (Vercel/CI integration):'));
    console.log('  {');
    console.log('    "scripts": {');
    console.log('      "prebuild": "sc build",');
    console.log('      "build": "next build"');
    console.log('    }');
    console.log('  }');
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
    if (arg === '--skip-docs') parsedOptions.skipDocs = true;
    if (arg === '--skip-validate') parsedOptions.skipValidate = true;
  }

  const runner = new BuildRunner();
  const result = await runner.run(parsedOptions);

  if (result.build && !result.build.success) {
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
