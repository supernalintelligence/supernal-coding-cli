import { execSync } from 'node:child_process';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';

interface PackageUpdaterOptions {
  verbose?: boolean;
  projectRoot?: string;
}

class PackageUpdater {
  protected verbose: boolean;
  protected projectRoot: string;

  constructor(options: PackageUpdaterOptions = {}) {
    this.verbose = options.verbose || false;
    this.projectRoot = options.projectRoot || process.cwd();
  }

  getGlobalScVersion(): string | null {
    try {
      const version = execSync('sc --version', { encoding: 'utf8' }).trim();
      return version;
    } catch (_error) {
      return null;
    }
  }

  isSourceRepository(): boolean {
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

  getSourceVersion(): string | null {
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

  async checkForUpdates(): Promise<boolean> {
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
      return false;
    }
  }

  async updatePackage(dryRun: boolean = false): Promise<boolean> {
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

      const newVersion = this.getGlobalScVersion();
      console.log(`📦 New global version: ${chalk.cyan(newVersion)}`);
      console.log('');
      console.log(chalk.blue('💡 Next steps:'));
      console.log(
        `   Run ${chalk.cyan('sc sync check')} in your repositories to verify sync status`
      );

      return true;
    } catch (error) {
      console.error(chalk.red('❌ Package update failed:'), (error as Error).message);

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

export default PackageUpdater;
module.exports = PackageUpdater;
