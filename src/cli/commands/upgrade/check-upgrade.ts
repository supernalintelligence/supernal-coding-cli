/**
 * Upgrade Detection and Recommendation System
 * Checks for newer versions of supernal-code and provides upgrade paths
 */

import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import semver from 'semver';

interface CheckOptions {
  force?: boolean;
  silent?: boolean;
}

interface UpgradeOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

interface CheckResult {
  checked: boolean;
  currentVersion: string;
  latestVersion?: string;
  isOutdated?: boolean;
  isDevelopment?: boolean;
  installationMethod?: string;
  upgradeCommand?: string;
  needsUpgrade?: boolean;
  reason?: string;
  error?: string;
}

interface UpgradeResult {
  success: boolean;
  message?: string;
  error?: string;
  oldVersion?: string;
  newVersion?: string;
  command?: string;
  commands?: string[];
}

interface CacheData {
  timestamp: number;
  checkedAt: string;
  currentVersion?: string;
  latestVersion?: string;
  checked?: boolean;
}

class UpgradeChecker {
  private _currentVersion: string | null = null;
  private _installationMethod: string | null = null;
  readonly checkIntervalHours: number;
  readonly lastCheckFile: string;
  readonly packageName: string;

  constructor() {
    this.packageName = 'supernal-coding';
    this.lastCheckFile = path.join(
      process.cwd(),
      '.supernal-coding',
      'last-upgrade-check.json'
    );
    this.checkIntervalHours = 24; // Check once per day
  }

  get currentVersion(): string {
    if (!this._currentVersion) {
      this._currentVersion = this.getCurrentVersion();
    }
    return this._currentVersion;
  }

  getCurrentVersion(): string {
    try {
      // Path: upgrade/ -> commands/ -> cli/ -> lib/ -> supernal-code-package/
      const packagePath = path.join(__dirname, '../../../../package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (pkg.name === 'supernal-coding' && pkg.version) {
          // Check if we're in development mode (has .git directory at project root)
          const projectRoot = path.join(__dirname, '../../../../..');
          const gitPath = path.join(projectRoot, '.git');
          if (fs.existsSync(gitPath)) {
            return `${pkg.version}-dev`;
          }
          return pkg.version;
        }
      }

      // Fast fallback: check global npm root
      try {
        const globalRoot = execSync('npm root -g', {
          encoding: 'utf8',
          stdio: 'pipe'
        }).trim();
        const globalPkgPath = path.join(
          globalRoot,
          'supernal-coding',
          'package.json'
        );
        if (fs.existsSync(globalPkgPath)) {
          const globalPkg = JSON.parse(fs.readFileSync(globalPkgPath, 'utf8'));
          return globalPkg.version || 'unknown';
        }
      } catch (_e) {
        // Fall through to unknown
      }

      return 'unknown';
    } catch (_error) {
      return 'unknown';
    }
  }

  async getLatestVersion(): Promise<string> {
    try {
      const result = execSync('npm view supernal-coding version', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return result.trim();
    } catch (_error) {
      // If npm view fails, try alternative method
      try {
        const registryInfo = execSync('npm info supernal-coding --json', {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        const info = JSON.parse(registryInfo);
        return info.version;
      } catch (_registryError) {
        throw new Error(
          'Unable to check for updates (npm registry unavailable)'
        );
      }
    }
  }

  shouldCheckForUpdates(): boolean {
    try {
      if (!fs.existsSync(this.lastCheckFile)) {
        return true;
      }

      const lastCheck = JSON.parse(fs.readFileSync(this.lastCheckFile, 'utf8'));
      const lastCheckTime = new Date(lastCheck.timestamp);
      const now = new Date();
      const hoursSinceCheck =
        (now.getTime() - lastCheckTime.getTime()) / (1000 * 60 * 60);

      return hoursSinceCheck >= this.checkIntervalHours;
    } catch (_error) {
      return true; // If we can't read the file, check anyway
    }
  }

  async recordCheck(latestVersion: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.lastCheckFile));
      await fs.writeFile(
        this.lastCheckFile,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            currentVersion: this.currentVersion,
            latestVersion: latestVersion,
            checked: true
          },
          null,
          2
        )
      );
    } catch (_error) {
      // Silently ignore write errors
    }
  }

  getInstallationMethod(): string {
    // Return cached result if available (avoid repeated slow checks)
    if (this._installationMethod) {
      return this._installationMethod;
    }

    // First check if we're in development mode by checking if we're running
    // from a git repository with package.json (fast file-system check)
    try {
      const projectRoot = path.join(__dirname, '../../..');
      const gitPath = path.join(projectRoot, '.git');
      const packagePath = path.join(projectRoot, 'package.json');

      if (fs.existsSync(gitPath) && fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (pkg.name === 'supernal-coding') {
          this._installationMethod = 'development';
          return this._installationMethod;
        }
      }
    } catch (_error) {
      // Ignore errors in development check
    }

    // Fast global check: use `which sc` + realpath instead of slow `npm list -g`
    try {
      const scPath = execSync('which sc', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      if (scPath) {
        const realPath = fs.realpathSync(scPath);
        if (realPath.includes('supernal-coding')) {
          // Verify it's in global node_modules
          const globalRoot = execSync('npm root -g', {
            encoding: 'utf8',
            stdio: 'pipe'
          }).trim();
          if (
            realPath.includes(globalRoot) ||
            fs.existsSync(path.join(globalRoot, 'supernal-coding'))
          ) {
            this._installationMethod = 'global';
            return this._installationMethod;
          }
        }
      }
    } catch (_error) {
      // Fall through to local check
    }

    // Fast local check: check node_modules in cwd
    try {
      const localPkgPath = path.join(
        process.cwd(),
        'node_modules',
        'supernal-coding'
      );
      if (fs.existsSync(localPkgPath)) {
        this._installationMethod = 'local';
        return this._installationMethod;
      }
    } catch (_error) {
      // Fall through to unknown
    }

    this._installationMethod = 'unknown';
    return this._installationMethod;
  }

  getUpgradeCommand(): string {
    const method = this.getInstallationMethod();

    switch (method) {
      case 'global':
        return 'npm install -g supernal-coding@latest';
      case 'local':
        return 'npm install supernal-coding@latest';
      case 'development':
        return 'git pull origin main && npm install';
      default:
        return 'npm install -g supernal-coding@latest';
    }
  }

  async checkForUpgrade(options: CheckOptions = {}): Promise<CheckResult> {
    const { force = false, silent = false } = options;

    // Skip check if not forced and recently checked
    if (!force && !this.shouldCheckForUpdates()) {
      return {
        checked: false,
        reason: 'Recently checked',
        currentVersion: this.currentVersion
      };
    }

    if (!silent) {
      console.log(chalk.blue('[i] Checking for supernal-coding updates...'));
    }

    try {
      const latestVersion = await this.getLatestVersion();
      await this.recordCheck(latestVersion);

      const isOutdated =
        semver.valid(this.currentVersion) &&
        semver.valid(latestVersion) &&
        semver.lt(this.currentVersion, latestVersion);

      const isDev = this.currentVersion.includes('-dev');

      return {
        checked: true,
        currentVersion: this.currentVersion,
        latestVersion: latestVersion,
        isOutdated: isOutdated || false,
        isDevelopment: isDev,
        installationMethod: this.getInstallationMethod(),
        upgradeCommand: this.getUpgradeCommand(),
        needsUpgrade: (isOutdated || false) && !isDev
      };
    } catch (error) {
      const err = error as Error;
      if (!silent) {
        console.log(chalk.yellow(`[!] ${err.message}`));
      }
      return {
        checked: false,
        error: err.message,
        currentVersion: this.currentVersion
      };
    }
  }

  displayUpgradeNotification(checkResult: CheckResult): void {
    if (!checkResult.checked || !checkResult.needsUpgrade) {
      return;
    }

    console.log(chalk.yellow('\n[i] UPDATE AVAILABLE - Supernal Coding'));
    console.log(chalk.yellow('='.repeat(60)));
    console.log(`Current version: ${chalk.red(checkResult.currentVersion)}`);
    console.log(`Latest version:  ${chalk.green(checkResult.latestVersion)}`);
    console.log('');
    console.log(chalk.blue('[>] To upgrade:'));
    console.log(chalk.cyan(`   ${checkResult.upgradeCommand}`));
    console.log('');
    console.log(chalk.blue('[i] Or run: sc upgrade'));
    console.log('');
    console.log(
      chalk.gray('[i] To skip these checks: sc <command> --skip-upgrade-check')
    );
    console.log('');
  }

  async performSelfUpgrade(options: UpgradeOptions = {}): Promise<UpgradeResult> {
    const { dryRun = false, verbose = true } = options;

    if (verbose) {
      console.log(chalk.blue('[>] Initiating self-upgrade process...'));
    }

    const checkResult = await this.checkForUpgrade({
      force: true,
      silent: !verbose
    });

    if (!checkResult.needsUpgrade) {
      if (verbose) {
        if (checkResult.isDevelopment) {
          console.log(
            chalk.green('[OK] Development mode - use git pull to update')
          );
        } else {
          console.log(chalk.green('[OK] Already running the latest version'));
        }
      }
      return { success: true, message: 'Already up to date' };
    }

    if (checkResult.installationMethod === 'development') {
      if (verbose) {
        console.log(chalk.yellow('[!] Development mode detected'));
        console.log('To update, run:');
        console.log(chalk.cyan('   git pull origin main'));
        console.log(chalk.cyan('   npm install'));
      }
      return {
        success: false,
        message: 'Manual update required in development mode',
        commands: ['git pull origin main', 'npm install']
      };
    }

    if (dryRun) {
      if (verbose) {
        console.log(chalk.cyan('[DRY RUN] Would execute:'));
        console.log(chalk.cyan(`   ${checkResult.upgradeCommand}`));
      }
      return {
        success: true,
        message: 'Dry run completed',
        command: checkResult.upgradeCommand
      };
    }

    try {
      if (verbose) {
        console.log(
          chalk.blue(
            `[i] Upgrading from ${checkResult.currentVersion} to ${checkResult.latestVersion}...`
          )
        );
        console.log(chalk.gray(`Executing: ${checkResult.upgradeCommand}`));
      }

      execSync(checkResult.upgradeCommand!, {
        stdio: verbose ? 'inherit' : 'pipe'
      });

      if (verbose) {
        console.log(chalk.green('[OK] Upgrade completed successfully!'));
        console.log(
          chalk.blue('[>] Please restart your terminal or run: source ~/.bashrc')
        );
      }

      return {
        success: true,
        message: 'Upgrade completed successfully',
        oldVersion: checkResult.currentVersion,
        newVersion: checkResult.latestVersion
      };
    } catch (error) {
      const err = error as Error;
      if (verbose) {
        console.log(chalk.red('[X] Upgrade failed:'));
        console.log(chalk.red(`   ${err.message}`));
        console.log('');
        console.log(chalk.blue('[i] Manual upgrade:'));
        console.log(chalk.cyan(`   ${checkResult.upgradeCommand}`));
      }

      return {
        success: false,
        error: err.message,
        command: checkResult.upgradeCommand
      } as UpgradeResult;
    }
  }

  /**
   * Cache update status for fast subsequent checks
   */
  cacheUpdateStatus(status: CacheData): void {
    try {
      const dir = path.dirname(this.lastCheckFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirpSync(dir);
      }

      const cacheData: CacheData = {
        ...status,
        timestamp: Date.now(),
        checkedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.lastCheckFile, JSON.stringify(cacheData, null, 2));
    } catch (_error) {
      // Fail silently - cache is nice-to-have
    }
  }

  /**
   * Get cached update status (no network call)
   */
  getCachedUpdateStatus(): CacheData | null {
    try {
      if (!fs.existsSync(this.lastCheckFile)) {
        return null;
      }

      const cached = JSON.parse(
        fs.readFileSync(this.lastCheckFile, 'utf8')
      ) as CacheData;

      // Cache expires after 24 hours
      const age = Date.now() - cached.timestamp;
      const maxAge = this.checkIntervalHours * 60 * 60 * 1000;

      if (age > maxAge) {
        return null; // Expired
      }

      return cached;
    } catch (_error) {
      return null;
    }
  }
}

// CLI Interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checker = new UpgradeChecker();

  try {
    if (args.includes('--help')) {
      console.log(`
Supernal Coding Upgrade Checker

Usage:
  sc check-upgrade                    Check for available upgrades
  sc check-upgrade --force            Force check (ignore cache)
  sc check-upgrade --silent           Check silently (no output)
  sc check-upgrade --upgrade          Perform automatic upgrade
  sc check-upgrade --upgrade --dry-run  Show what would be upgraded
  sc check-upgrade --version          Show current version info

Options:
  --force                             Force check even if recently checked
  --silent                           Suppress output except errors
  --upgrade                          Perform automatic upgrade if available
  --dry-run                          Show upgrade command without executing
  --version                          Display version information
`);
      return;
    }

    if (args.includes('--version')) {
      console.log(`Current version: ${checker.currentVersion}`);
      console.log(`Installation method: ${checker.getInstallationMethod()}`);
      return;
    }

    if (args.includes('--upgrade')) {
      const dryRun = args.includes('--dry-run');
      const result = await checker.performSelfUpgrade({
        dryRun,
        verbose: true
      });

      if (!result.success) {
        process.exit(1);
      }
      return;
    }

    const force = args.includes('--force');
    const silent = args.includes('--silent');

    const result = await checker.checkForUpgrade({ force, silent });

    if (!silent) {
      if (result.checked) {
        if (result.needsUpgrade) {
          checker.displayUpgradeNotification(result);
        } else if (result.isDevelopment) {
          console.log(chalk.blue('[i] Running in development mode'));
        } else {
          console.log(chalk.green('[OK] Running the latest version'));
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`[X] Error: ${err.message}`));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default UpgradeChecker;
