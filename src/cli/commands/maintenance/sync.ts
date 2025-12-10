// @ts-nocheck
/**
 * Sync command - Synchronizes global sc installation with local repository version
 * This ensures the global `sc` command matches the version/features in the current repo
 */

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

class SyncCommand {
  projectRoot: any;
  constructor() {
    this.projectRoot = process.cwd();
  }

  createCommand() {
    const command = new Command('sync');
    command
      .description(
        'Synchronize local repository state with global sc installation'
      )
      .option('--force', 'Force synchronization')
      .option('-v, --verbose', 'Verbose output')
      .argument('[action]', 'Action to perform (check, report, update)')
      .action(async (action, options) => {
        try {
          await this.execute(action, options);
        } catch (error) {
          console.error(chalk.red('❌ Sync command failed:'), error.message);
          process.exit(1);
        }
      });

    return command;
  }

  async execute(action, options) {
    if (!action) {
      action = 'check';
    }

    switch (action.toLowerCase()) {
      case 'check':
        await this.checkSync(options);
        break;
      case 'report':
        await this.generateReport(options);
        break;
      case 'update':
        await this.updateGlobalSc(options);
        break;
      default:
        console.error(chalk.red(`❌ Unknown action: ${action}`));
        this.showHelp();
        process.exit(1);
    }
  }

  async checkSync(_options) {
    console.log(chalk.blue('🔄 Checking local repository sync status'));
    console.log(chalk.blue('='.repeat(50)));

    const issues = [];
    let localVersion = 'unknown';
    let globalVersion = 'not installed';

    // Get local supernal-code version from package.json
    const localPackageJson = path.join(
      this.projectRoot,
      'supernal-code-package/package.json'
    );
    if (fs.existsSync(localPackageJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(localPackageJson, 'utf8'));
        localVersion = pkg.version;
        console.log(chalk.cyan('Local sc version:'), localVersion);
      } catch (_error) {
        issues.push('Cannot read local supernal-code package.json');
      }
    } else {
      issues.push('Local supernal-code package not found');
    }

    // Check global sc installation
    try {
      const globalScPath = execSync('which sc', { encoding: 'utf8' }).trim();
      console.log(chalk.cyan('Global sc path:'), globalScPath);

      // Try to get global version
      try {
        globalVersion = execSync('sc --version', { encoding: 'utf8' }).trim();
        console.log(chalk.cyan('Global sc version:'), globalVersion);
      } catch (_error) {
        globalVersion = 'version check failed';
        issues.push('Global sc version check failed');
      }
    } catch (_error) {
      console.log(chalk.yellow('⚠️  Global sc command not found'));
      issues.push(
        'Global sc not installed - run "npm install -g supernal-code"'
      );
    }

    // Check if versions match
    if (
      localVersion !== 'unknown' &&
      globalVersion !== 'not installed' &&
      !globalVersion.includes(localVersion)
    ) {
      issues.push(
        `Version mismatch: local=${localVersion}, global=${globalVersion}`
      );
    }

    // Report results
    if (issues.length === 0) {
      console.log(chalk.green('✅ Repository sync status: OK'));
      console.log(
        chalk.gray('Local and global sc installations are synchronized')
      );
    } else {
      console.log(chalk.yellow(`⚠️  Found ${issues.length} sync issues:`));
      issues.forEach((issue) => {
        console.log(chalk.yellow(`  • ${issue}`));
      });
      console.log(
        chalk.gray('\nRun "sc sync update" to synchronize global installation')
      );
    }
  }

  async generateReport(options) {
    console.log(chalk.blue('📊 Generating sync report'));
    console.log(chalk.blue('='.repeat(30)));

    // Just run the check for now - it provides the same info
    await this.checkSync(options);
  }

  async updateGlobalSc(options) {
    console.log(chalk.blue('🔄 Updating global sc installation'));
    console.log(chalk.blue('='.repeat(40)));

    // Get local version
    const localPackageJson = path.join(
      this.projectRoot,
      'supernal-code-package/package.json'
    );
    if (!fs.existsSync(localPackageJson)) {
      console.error(chalk.red('❌ Local supernal-code package not found'));
      console.log(
        chalk.gray('This command must be run from a supernal-coding repository')
      );
      process.exit(1);
    }

    let localVersion;
    try {
      const pkg = JSON.parse(fs.readFileSync(localPackageJson, 'utf8'));
      localVersion = pkg.version;
      console.log(chalk.cyan('Local version:'), localVersion);
    } catch (_error) {
      console.error(chalk.red('❌ Cannot read local package.json'));
      process.exit(1);
    }

    // Install/update global sc to match local version
    try {
      console.log(
        chalk.yellow('📦 Installing/updating global supernal-code...')
      );

      if (options.force) {
        console.log(
          chalk.yellow('⚠️  Force mode: uninstalling existing global sc first')
        );
        try {
          execSync('npm uninstall -g supernal-code', { stdio: 'pipe' });
        } catch (_error) {
          // Ignore errors - package might not be installed
        }
      }

      // Install from local package
      const localPackagePath = path.join(
        this.projectRoot,
        'supernal-code-package'
      );
      console.log(chalk.gray(`Installing from: ${localPackagePath}`));

      execSync(`npm install -g "${localPackagePath}"`, { stdio: 'inherit' });

      console.log(
        chalk.green('✅ Global sc installation updated successfully')
      );

      // Verify installation
      try {
        const newVersion = execSync('sc --version', {
          encoding: 'utf8'
        }).trim();
        console.log(chalk.cyan('New global version:'), newVersion);
      } catch (_error) {
        console.log(chalk.yellow('⚠️  Could not verify new installation'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to update global sc:'), error.message);
      console.log(
        chalk.gray('You may need to run with sudo or check npm permissions')
      );
      process.exit(1);
    }
  }

  showHelp() {
    console.log(chalk.blue.bold('🔄 Global SC Sync Command'));
    console.log(chalk.blue('='.repeat(35)));
    console.log('');
    console.log(
      chalk.gray(
        'Synchronizes your global "sc" command with the local repository version.'
      )
    );
    console.log(
      chalk.gray(
        'Useful when you clone a repo and need to update your global sc installation.'
      )
    );
    console.log('');
    console.log(chalk.yellow('Available Actions:'));
    console.log('');

    const actions = [
      [
        'check',
        'Check version sync between local repo and global sc (default)'
      ],
      ['report', 'Same as check - shows version comparison'],
      ['update', 'Update global sc to match local repository version']
    ];

    actions.forEach(([action, description]) => {
      console.log(`  ${chalk.cyan(action.padEnd(10))} ${description}`);
    });

    console.log(`\n${chalk.yellow('Examples:')}`);
    console.log(
      `  ${chalk.cyan('sc sync')}                # Check if global sc matches local repo`
    );
    console.log(`  ${chalk.cyan('sc sync check')}          # Same as above`);
    console.log(
      `  ${chalk.cyan('sc sync update')}         # Install local version globally`
    );
    console.log(
      `  ${chalk.cyan('sc sync update --force')} # Force reinstall global sc`
    );

    console.log(`\n${chalk.yellow('Use Case:')}`);
    console.log(chalk.gray('  1. You clone a supernal-coding repository'));
    console.log(
      chalk.gray('  2. Your global "sc" command is outdated or missing')
    );
    console.log(
      chalk.gray(
        '  3. Run "sc sync update" to install the repo\'s version globally'
      )
    );
  }
}

// Export the command function directly
module.exports = async (action, options) => {
  const syncCmd = new SyncCommand();
  await syncCmd.execute(action, options);
};

// Export class for direct use
module.exports.SyncCommand = SyncCommand;
