#!/usr/bin/env node
// @ts-nocheck

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const chalk = require('chalk');

class UpdateChecker {
  currentVersion: any;
  isLocalDev: any;
  packageJsonPath: any;
  constructor() {
    this.packageJsonPath = this.findPackageJson();
    this.currentVersion = this.getCurrentVersion();
    this.isLocalDev = this.isLocalDevelopment();
  }

  findPackageJson() {
    // Start from the CLI directory and work up
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

  getCurrentVersion() {
    if (!this.packageJsonPath) return '0.0.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      return pkg.version || '0.0.0';
    } catch (_error) {
      return '0.0.0';
    }
  }

  isLocalDevelopment() {
    // Check if we're in a git repository with supernal-code development
    try {
      const gitDir = path.join(process.cwd(), '.git');
      if (fs.existsSync(gitDir)) {
        // Check if this is the supernal-code repo
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

  getLatestGitCommit() {
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

  getInstalledCommit() {
    try {
      // For npm link installations, check the symlink target
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

  checkForUpdates() {
    if (!this.isLocalDev) {
      // For published packages, check npm registry (future implementation)
      return this.checkNpmUpdates();
    } else {
      // For local development, check git commits
      return this.checkGitUpdates();
    }
  }

  checkGitUpdates() {
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
      return { updateAvailable: false, error: error.message };
    }
  }

  checkNpmUpdates() {
    // Future: Check npm registry for published package updates
    // For now, return no updates available
    return { updateAvailable: false };
  }

  displayUpdateNotice(updateInfo) {
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
    console.log(''); // Empty line for spacing
  }

  async checkAndNotify() {
    try {
      const updateInfo = this.checkForUpdates();
      this.displayUpdateNotice(updateInfo);
    } catch (_error) {
      // Silently fail - don't interrupt the user's workflow
      // console.error('Update check failed:', error.message);
    }
  }
}

module.exports = UpdateChecker;
