const { execSync } = require('node:child_process');
const chalk = require('chalk');
const path = require('node:path');
const fs = require('node:fs');

/**
 * PackageUpdater - Handles updating the global sc package installation
 * This is separate from RepoSyncChecker which handles repository state synchronization
 */
class PackageUpdater {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.projectRoot = options.projectRoot || process.cwd();
  }

  /**
   * Get the currently installed global sc version
   */
  getGlobalScVersion() {
    try {
      const version = execSync('sc --version', { encoding: 'utf8' }).trim();
      return version;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Check if we're in the supernal-coding source repository
   */
  isSourceRepository() {
    try {
      const packagePath = path.join(
        this.projectRoot,
        'supernal-code-package',
        'package.json'
      );
      return fs.existsSync(packagePath);
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get the version from local source package
   */
  getSourceVersion() {
    try {
      const packagePath = path.join(
        this.projectRoot,
        'supernal-code-package',
        'package.json'
      );
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Check if an update is available
   */
  async checkForUpdates() {
    console.log(chalk.blue('🔍 Checking for sc package updates...'));
    console.log(chalk.blue('='.repeat(50)));

    const globalVersion = this.getGlobalScVersion();
    const isSource = this.isSourceRepository();

    console.log(
      `📦 Current global sc version: ${chalk.cyan(globalVersion || 'Not installed')}`
    );

    if (!globalVersion) {
      console.log(chalk.red('❌ sc is not globally installed'));
      console.log('');
      console.log(chalk.blue('💡 To install sc globally:'));
      if (isSource) {
        console.log(
          `   ${chalk.cyan('npm install -g ./supernal-code-package')}`
        );
      } else {
        console.log(`   ${chalk.cyan('npm install -g supernal-code@latest')}`);
      }
      return false;
    }

    if (isSource) {
      const sourceVersion = this.getSourceVersion();
      console.log(
        `📂 Local source version: ${chalk.cyan(sourceVersion || 'Unknown')}`
      );

      if (sourceVersion && sourceVersion !== globalVersion) {
        console.log(
          chalk.yellow('⚠️  Global sc is behind local source version')
        );
        console.log('');
        console.log(chalk.blue('💡 To update from source:'));
        console.log(`   ${chalk.cyan('sc update')}`);
        return true;
      } else {
        console.log(chalk.green('✅ Global sc is up to date with source'));
        return false;
      }
    } else {
      console.log(chalk.blue('📋 To check for latest official release:'));
      console.log(`   ${chalk.cyan('npm view supernal-code version')}`);
      console.log('');
      console.log(chalk.blue('💡 To update to latest release:'));
      console.log(`   ${chalk.cyan('sc update')}`);
      return false; // Can't determine without npm registry check
    }
  }

  /**
   * Update the global sc package (dry run mode)
   */
  async updatePackage(dryRun = false) {
    const isSource = this.isSourceRepository();

    if (dryRun) {
      console.log(
        chalk.blue(
          '🔍 Dry-run mode: Showing what would happen during package update...'
        )
      );
      console.log('');

      if (isSource) {
        console.log(chalk.green('✅ Source Repository Detected'));
        console.log(
          '   Action: Update global sc from local supernal-code-package/'
        );
        console.log('   Command: npm install -g ./supernal-code-package');
        console.log(
          '   Result: Global sc would be updated to match local development version'
        );
      } else {
        console.log(chalk.blue('✅ Non-Source Repository Detected'));
        console.log('   Action: Update global sc from official release');
        console.log('   Command: npm install -g supernal-code@latest');
        console.log(
          '   Result: Global sc would be updated to latest official version'
        );
      }

      console.log('');
      console.log(chalk.gray('💡 To actually perform the update:'));
      console.log(`     ${chalk.cyan('sc update')}`);
      return true;
    }

    console.log(chalk.blue('🔄 Updating global sc package...'));
    console.log('');

    try {
      if (isSource) {
        console.log('📦 Updating from local source...');
        execSync('npm install -g ./supernal-code-package', {
          stdio: this.verbose ? 'inherit' : 'pipe',
          cwd: this.projectRoot
        });
        console.log(chalk.green('✅ Global sc updated from local source!'));
      } else {
        console.log('📦 Updating from official release...');
        execSync('npm install -g supernal-code@latest', {
          stdio: this.verbose ? 'inherit' : 'pipe'
        });
        console.log(chalk.green('✅ Global sc updated from official release!'));
      }

      // Show new version
      const newVersion = this.getGlobalScVersion();
      console.log(`📦 New global version: ${chalk.cyan(newVersion)}`);
      console.log('');
      console.log(chalk.blue('💡 Next steps:'));
      console.log(
        `   Run ${chalk.cyan('sc sync check')} in your repositories to verify sync status`
      );

      return true;
    } catch (error) {
      console.error(chalk.red('❌ Package update failed:'), error.message);

      if (!isSource) {
        console.log('');
        console.log(chalk.yellow('💡 Try updating from source instead:'));
        console.log('   1. Navigate to your supernal-coding source directory');
        console.log('   2. Run: npm install -g ./supernal-code-package');
      }

      return false;
    }
  }
}

module.exports = PackageUpdater;
