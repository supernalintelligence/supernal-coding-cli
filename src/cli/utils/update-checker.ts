import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';

interface UpdateInfo {
  updateAvailable: boolean;
  type?: string;
  currentVersion?: string;
  latestVersion?: string;
  updateCommand?: string;
  error?: string;
}

class UpdateChecker {
  protected packageJsonPath: string | null;
  protected currentVersion: string;
  protected isLocalDev: boolean;

  constructor() {
    this.packageJsonPath = this.findPackageJson();
    this.currentVersion = this.getCurrentVersion();
    this.isLocalDev = this.isLocalDevelopment();
  }

  findPackageJson(): string | null {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
      const packagePath = path.join(dir, 'package.json');
      if (fs.existsSync(packagePath)) {
        return packagePath;
      }
      dir = path.dirname(dir);
    }
    return null;
  }

  getCurrentVersion(): string {
    if (!this.packageJsonPath) return '0.0.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      return pkg.version || '0.0.0';
    } catch (_error) {
      return '0.0.0';
    }
  }

  isLocalDevelopment(): boolean {
    try {
      const gitDir = path.join(process.cwd(), '.git');
      if (fs.existsSync(gitDir)) {
        const packagePath = path.join(
          process.cwd(),
          'supernal-code-package',
          'package.json'
        );
        return fs.existsSync(packagePath);
      }
      return false;
    } catch (_error) {
      return false;
    }
  }

  getLatestGitCommit(): string {
    try {
      const commit = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: 'pipe'
      }).trim();
      return commit.substring(0, 8);
    } catch (_error) {
      return 'unknown';
    }
  }

  getInstalledCommit(): string {
    try {
      const scPath = execSync('which sc', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      const realPath = fs.realpathSync(scPath);
      const packageDir = path.dirname(path.dirname(realPath));

      const commit = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        cwd: packageDir,
        stdio: 'pipe'
      }).trim();
      return commit.substring(0, 8);
    } catch (_error) {
      return 'unknown';
    }
  }

  checkForUpdates(): UpdateInfo {
    if (!this.isLocalDev) {
      return this.checkNpmUpdates();
    } else {
      return this.checkGitUpdates();
    }
  }

  checkGitUpdates(): UpdateInfo {
    try {
      const latestCommit = this.getLatestGitCommit();
      const installedCommit = this.getInstalledCommit();

      if (
        latestCommit !== installedCommit &&
        latestCommit !== 'unknown' &&
        installedCommit !== 'unknown'
      ) {
        return {
          updateAvailable: true,
          type: 'git',
          currentVersion: `${this.currentVersion} (${installedCommit})`,
          latestVersion: `${this.currentVersion} (${latestCommit})`,
          updateCommand: 'npm link (from supernal-code-package directory)'
        };
      }

      return { updateAvailable: false };
    } catch (error) {
      return { updateAvailable: false, error: (error as Error).message };
    }
  }

  checkNpmUpdates(): UpdateInfo {
    return { updateAvailable: false };
  }

  displayUpdateNotice(updateInfo: UpdateInfo): void {
    if (!updateInfo.updateAvailable) return;

    console.log(chalk.yellow('\n⚠️  UPDATE AVAILABLE'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white(`Current: ${updateInfo.currentVersion}`));
    console.log(chalk.green(`Latest:  ${updateInfo.latestVersion}`));
    console.log(chalk.gray(`Update:  ${updateInfo.updateCommand}`));
    console.log(chalk.gray('─'.repeat(50)));

    if (updateInfo.type === 'git') {
      console.log(chalk.cyan('💡 Run the following to update:'));
      console.log(chalk.white('   cd supernal-code-package && npm link'));
    }
    console.log('');
  }

  async checkAndNotify(): Promise<void> {
    try {
      const updateInfo = this.checkForUpdates();
      this.displayUpdateNotice(updateInfo);
    } catch (_error) {
      // Silently fail
    }
  }
}

export default UpdateChecker;
module.exports = UpdateChecker;
