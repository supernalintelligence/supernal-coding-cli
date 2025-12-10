#!/usr/bin/env node
// @ts-nocheck

// repo-sync-check.js - Check if local repository is in sync with globally installed sc package
// Part of REQ-053: Local Repository Sync Check

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { execSync } = require('node:child_process');
const { LocalStateManager } = require('./local-state-manager');

class RepoSyncChecker {
  projectRoot: any;
  stateManager: any;
  verbose: any;
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
    this.stateManager = new LocalStateManager({
      projectRoot: this.projectRoot,
      verbose: this.verbose
    });
  }

  /**
   * Check if local repository is in sync with globally installed sc package
   */
  async checkRepoSync() {
    try {
      console.log(chalk.blue('🔍 Checking local repository sync status...'));
      console.log(chalk.blue('='.repeat(50)));

      // Initialize .sc folder if needed
      await this.stateManager.initializeScFolder();

      // Check if this repo can do sync checks
      const canSync = await this.stateManager.canDoSyncCheck();
      if (!canSync.canSync) {
        console.log(chalk.yellow(`⚠️  ${canSync.reason}`));
        console.log(chalk.blue('💡 To enable sync checking: sc sync init'));
        return false;
      }

      // 1. Get global sc version
      const globalVersion = this.getGlobalScVersion();
      if (!globalVersion) {
        console.log(
          chalk.red(
            '❌ Global sc not found. Please install: npm install -g ./supernal-code-package'
          )
        );
        await this.recordSyncResult({
          globalVersion: null,
          localVersion: canSync.localVersion,
          isInSync: false,
          issues: ['Global sc not found']
        });
        return false;
      }

      // 2. Get local version (using state manager's detection)
      const localVersion = canSync.localVersion;

      // 3. Compare versions
      console.log(`📦 Global sc version: ${chalk.cyan(globalVersion)}`);
      console.log(`📂 Local repo version: ${chalk.cyan(localVersion)}`);

      if (globalVersion !== localVersion) {
        console.log(chalk.yellow('⚠️  Version mismatch detected!'));
        console.log(
          chalk.yellow('   Repository and global sc versions are not aligned.')
        );
        console.log('');

        // Show guidance for fixing version mismatch
        console.log(chalk.blue('💡 Version Mismatch Resolution:'));
        console.log('');
        console.log(chalk.yellow('   Two options to resolve this:'));
        console.log('');
        console.log(chalk.blue('   Option 1 - Update global sc package:'));
        console.log(
          `     ${chalk.cyan('sc update')}              ${chalk.gray('# Updates your global sc installation')}`
        );
        console.log(
          `     ${chalk.cyan('sc sync check')}          ${chalk.gray('# Verify the versions now match')}`
        );
        console.log('');
        console.log(
          chalk.blue('   Option 2 - Sync repository to current global sc:')
        );
        console.log(
          `     ${chalk.cyan('sc sync')}               ${chalk.gray('# Updates repository to track current global sc')}`
        );
        console.log(
          `     ${chalk.cyan('sc sync check')}          ${chalk.gray('# Verify sync is complete')}`
        );
        console.log('');
        console.log(
          chalk.gray('   💡 Use Option 1 if your global sc is outdated')
        );
        console.log(
          chalk.gray(
            '   💡 Use Option 2 if your repository tracking is outdated'
          )
        );

        console.log('');
        await this.recordSyncResult({
          globalVersion,
          localVersion,
          isInSync: false,
          issues: ['Version mismatch']
        });
        return false;
      }

      // 4. Check if critical CLI files are in sync
      const syncIssues = await this.checkFileSync();
      if (syncIssues.length > 0) {
        console.log(chalk.yellow('⚠️  File sync issues detected:'));
        syncIssues.forEach((issue) => {
          console.log(`   • ${chalk.yellow(issue)}`);
        });
        console.log('');

        // Show guidance for fixing file sync issues
        console.log(chalk.blue('💡 File Sync Resolution:'));
        console.log(
          `   ${chalk.cyan('sc update')}              ${chalk.gray('# Update global sc to latest version')}`
        );
        console.log(
          `   ${chalk.cyan('sc sync check')}          ${chalk.gray('# Verify files are now in sync')}`
        );

        console.log('');
        await this.recordSyncResult({
          globalVersion,
          localVersion,
          isInSync: false,
          issues: syncIssues
        });
        return false;
      }

      // All checks passed - repository is in sync
      console.log(
        chalk.green('✅ Repository is in sync with global sc installation!')
      );
      await this.recordSyncResult({
        globalVersion,
        localVersion,
        isInSync: true,
        issues: []
      });
      return true;
    } catch (error) {
      console.error(
        chalk.red('❌ Error checking repository sync:'),
        error.message
      );
      if (this.verbose) {
        console.error(error.stack);
      }
      await this.recordSyncResult({
        globalVersion: null,
        localVersion: null,
        isInSync: false,
        issues: [error.message]
      });
      return false;
    }
  }

  /**
   * Record sync check result in local state
   */
  async recordSyncResult(result) {
    try {
      await this.stateManager.recordSyncCheck(result);
    } catch (error) {
      if (this.verbose) {
        console.error(
          chalk.yellow(`⚠️  Could not record sync result: ${error.message}`)
        );
      }
    }
  }

  /**
   * Get the globally installed sc version
   */
  getGlobalScVersion() {
    try {
      const version = execSync('sc --version', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      return version;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get the local package.json version
   */
  getLocalPackageVersion() {
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Check if critical CLI files are in sync
   */
  async checkFileSync() {
    const issues = [];

    try {
      // Get global sc installation path
      const globalPath = this.getGlobalScPath();
      if (!globalPath) {
        issues.push('Cannot locate global sc installation');
        return issues;
      }

      // Files to check for sync
      const criticalFiles = [
        'lib/cli/index.js',
        'lib/cli/commands/upgrade/check-upgrade.js',
        'lib/cli/commands/testing/test-command.js',
        'lib/cli/commands/development/workflow-guard.js'
      ];

      for (const file of criticalFiles) {
        const localFile = path.join(
          this.projectRoot,
          'supernal-code-package',
          file
        );
        const globalFile = path.join(globalPath, file);

        if (fs.existsSync(localFile) && fs.existsSync(globalFile)) {
          const localContent = fs.readFileSync(localFile, 'utf8');
          const globalContent = fs.readFileSync(globalFile, 'utf8');

          if (localContent !== globalContent) {
            issues.push(
              `${file} differs between local and global installation`
            );
          }
        } else if (fs.existsSync(localFile) && !fs.existsSync(globalFile)) {
          issues.push(`${file} exists locally but not in global installation`);
        }
      }
    } catch (error) {
      issues.push(`File sync check failed: ${error.message}`);
    }

    return issues;
  }

  /**
   * Get the global sc installation path
   */
  getGlobalScPath() {
    try {
      const whichResult = execSync('which sc', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      // sc is usually a symlink, resolve to the actual installation
      const realPath = fs.realpathSync(whichResult);
      // Go up from bin/sc to the package root
      return path.dirname(path.dirname(realPath));
    } catch (_error) {
      return null;
    }
  }

  /**
   * Check git status for uncommitted changes that might affect sync
   */
  async checkGitStatus() {
    const issues = [];

    try {
      // Get repository type to determine relevant paths
      const state = this.stateManager
        ? await this.stateManager.getState()
        : null;
      let criticalPaths = [];

      if (state?.repoType === 'supernal-source') {
        // Only check supernal-coding specific paths in the source repo
        criticalPaths = ['archive/', 'supernal-code-package/', 'package.json'];
      } else {
        // For other repos, sync functionality doesn't depend on git status
        // Return empty - no git status issues for non-source repos
        return issues;
      }

      for (const criticalPath of criticalPaths) {
        try {
          const status = execSync(`git status --porcelain ${criticalPath}`, {
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: this.projectRoot
          }).trim();

          if (status) {
            const lines = status.split('\n').filter((line) => line.trim());
            if (lines.length > 0) {
              issues.push(
                `Uncommitted changes in ${criticalPath} (${lines.length} files)`
              );
            }
          }
        } catch (_error) {
          // Ignore errors for individual paths
        }
      }
    } catch (_error) {
      // Git not available or not a git repo
    }

    return issues;
  }

  /**
   * Show detailed sync report
   */
  async showSyncReport() {
    console.log(chalk.blue.bold('📊 Detailed Sync Report'));
    console.log(chalk.blue('='.repeat(50)));

    // Version comparison
    const globalVersion = this.getGlobalScVersion();
    const localVersion = this.getLocalPackageVersion();

    console.log('');
    console.log(chalk.blue('📦 Version Information:'));
    console.log(
      `   Global sc:     ${globalVersion ? chalk.cyan(globalVersion) : chalk.red('Not found')}`
    );
    console.log(
      `   Local repo:    ${localVersion ? chalk.cyan(localVersion) : chalk.red('Not found')}`
    );
    console.log(
      `   Status:        ${globalVersion === localVersion ? chalk.green('✅ Match') : chalk.red('❌ Mismatch')}`
    );

    // File sync status
    console.log('');
    console.log(chalk.blue('📁 File Sync Status:'));
    const syncIssues = await this.checkFileSync();
    if (syncIssues.length === 0) {
      console.log('   ✅ All critical files are in sync');
    } else {
      syncIssues.forEach((issue) => {
        console.log(`   ❌ ${issue}`);
      });
    }

    // Git status
    console.log('');
    console.log(chalk.blue('🔄 Git Status:'));
    const gitIssues = await this.checkGitStatus();
    if (gitIssues.length === 0) {
      console.log('   ✅ No uncommitted changes in critical paths');
    } else {
      gitIssues.forEach((issue) => {
        console.log(`   ⚠️  ${issue}`);
      });
    }

    console.log('');
  }

  /**
   * Show context-aware update guidance based on repository type
   */
  async showUpdateGuidance() {
    const state = this.stateManager ? await this.stateManager.getState() : null;
    const repoType = state?.repoType || 'unknown';

    console.log(chalk.blue('💡 Update Options:'));

    if (repoType === 'supernal-source') {
      console.log(
        `   ${chalk.green('✅ Source Repository - Can auto-update program:')}`
      );
      console.log(
        `     ${chalk.cyan('sc sync update')}                   ${chalk.gray('# Update global sc from local source')}`
      );
      console.log(
        `     ${chalk.cyan('sc sync update --dry-run')}         ${chalk.gray('# Preview what would happen')}`
      );
      console.log('');
      console.log(`   ${chalk.blue('📋 Manual option:')}`);
      console.log(
        `     ${chalk.cyan('npm install -g ./supernal-code-package')}`
      );
      console.log(
        `     ${chalk.cyan('sc sync check')}                   ${chalk.gray('# Verify repo is now in sync')}`
      );
    } else {
      console.log(
        '   ' +
          chalk.yellow('⚠️  Non-Source Repository - Update program manually:')
      );
      console.log(
        `     ${chalk.cyan('npm install -g supernal-code@latest')}    ${chalk.gray('# Update global sc program')}`
      );
      console.log(
        `     ${chalk.cyan('sc sync check')}                        ${chalk.gray('# Verify repo is now in sync')}`
      );
      console.log('');
      console.log(
        `   ${chalk.blue('📋 Alternative - From source repository:')}`
      );
      console.log('     1. Navigate to supernal-coding source directory');
      console.log(
        `     2. Run: ${chalk.cyan('npm install -g ./supernal-code-package')}`
      );
      console.log(
        `     3. Run: ${chalk.cyan('sc sync check')}              ${chalk.gray('# Verify update worked')}`
      );
      console.log('');
      console.log(`   ${chalk.gray('💡 To see what would happen:')}`);
      console.log(`     ${chalk.cyan('sc sync update --dry-run')}`);
    }
  }

  /**
   * Sync repository state with current global sc installation (REQ-054)
   * This ONLY updates repository state, NOT the global sc package
   */
  async syncRepository(dryRun = false) {
    // Get current global sc version
    const globalVersion = this.getGlobalScVersion();
    if (!globalVersion) {
      console.log(chalk.red('❌ No global sc installation found'));
      console.log('');
      console.log(chalk.blue('💡 Install sc globally first:'));
      console.log(
        `   ${chalk.cyan('sc update')}    ${chalk.gray('# Updates global sc package')}`
      );
      return false;
    }

    // Initialize state management if needed
    await this.stateManager.initializeScFolder();
    const currentState = await this.stateManager.getState();

    if (dryRun) {
      console.log(
        chalk.blue(
          '🔍 Dry-run mode: Showing what would happen during repository sync...'
        )
      );
      console.log('');

      // Detect repository type and what would be synced
      const repoType =
        currentState?.repoType || (await this.stateManager.detectRepoType());
      const hasGitProtection = this.stateManager.shouldCommitScFolder(repoType);

      console.log(chalk.green('✅ Repository State Synchronization'));
      console.log(`   Current global sc version: ${chalk.cyan(globalVersion)}`);
      console.log(
        `   Current repo tracked version: ${chalk.cyan(currentState?.lastSyncedVersion || 'none')}`
      );
      console.log(`   Repository type: ${chalk.cyan(repoType)}`);
      console.log('');

      console.log(chalk.blue('📝 Files that would be modified/created:'));
      console.log(
        '   • .supernal-coding/state.json          (sync tracking state)'
      );
      console.log(
        '   • .supernal-coding/last-sync-version.txt (version tracking)'
      );
      console.log(
        '   • .gitignore                           (add .supernal-coding/ exclusion)'
      );

      if (hasGitProtection) {
        console.log('');
        console.log(
          chalk.blue('🔧 Git workflow protection that would be activated:')
        );
        console.log(
          '   • Pre-commit hooks                     (workflow validation)'
        );
        console.log(
          '   • Pre-push hooks                       (dependency checking)'
        );
        console.log(
          '   • Git aliases                          (git sadd wrapper)'
        );
        console.log(
          '   • Template validation                  (requirement completeness)'
        );
      }

      if (repoType !== 'git-repo') {
        console.log('');
        console.log(
          chalk.blue('🎯 Project-specific integration that would be enabled:')
        );
        if (repoType === 'npm-project' || repoType === 'node-project') {
          console.log(
            '   • Package.json validation              (dependency checking)'
          );
          console.log(
            '   • Test integration                     (sc test command)'
          );
          console.log(
            '   • Build validation                     (pre-commit checks)'
          );
        }
        if (repoType === 'supernal-source') {
          console.log(
            '   • Source development mode              (enhanced validation)'
          );
          console.log(
            '   • Package sync monitoring              (version tracking)'
          );
          console.log(
            '   • Template validation                  (requirement system)'
          );
        }
      }

      console.log('');
      console.log(chalk.blue('⚡ Commands that would become available:'));
      console.log(
        '   • sc sync check                        (verify sync status)'
      );
      console.log(
        '   • sc sync report                       (detailed sync info)'
      );
      console.log(
        '   • sc sync info                         (local state info)'
      );
      console.log(
        '   • sc update                            (global package updates)'
      );
      if (hasGitProtection) {
        console.log(
          '   • sc guard pre-commit                  (workflow validation)'
        );
        console.log(
          '   • sc guard pre-add                     (staging protection)'
        );
        console.log(
          '   • sc git-protect install               (protection setup)'
        );
      }

      console.log('');
      console.log(
        chalk.yellow(
          '📋 Result: Repository will be fully synchronized with sc workflows'
        )
      );
      console.log('');
      console.log(chalk.gray('💡 To actually perform the sync:'));
      console.log(`     ${chalk.cyan('sc sync')}`);
      console.log('');
      console.log(chalk.gray('💡 To update the global sc package instead:'));
      console.log(
        `     ${chalk.cyan('sc update')}     ${chalk.gray('# Updates global installation')}`
      );
      return true;
    }

    console.log(
      chalk.blue('🔄 Synchronizing repository state with global sc...')
    );
    console.log('');

    try {
      // Update repository state to track current global version
      console.log(`📦 Global sc version: ${chalk.cyan(globalVersion)}`);
      console.log('📝 Updating repository sync state...');

      // Record the sync in state
      await this.stateManager.recordSyncCheck({
        globalVersion,
        localVersion: globalVersion, // Now they match
        isInSync: true,
        timestamp: new Date().toISOString(),
        syncMethod: 'repository-state-sync'
      });

      console.log(chalk.green('✅ Repository state synchronized!'));
      console.log(
        `📂 Repository now tracks global sc version: ${chalk.cyan(globalVersion)}`
      );
      console.log('');
      console.log(chalk.blue('💡 Verification:'));
      console.log(
        `   Run ${chalk.cyan('sc sync check')} to confirm sync status`
      );

      return true;
    } catch (error) {
      console.error(chalk.red('❌ Repository sync failed:'), error.message);
      console.log('');
      console.log(
        chalk.yellow('💡 This should not happen. Please report this issue.')
      );
      return false;
    }
  }
}

/**
 * Handler function for CLI
 */
async function handleSyncCommand(options = {}) {
  const checker = new RepoSyncChecker(options);
  return await checker.checkRepoSync();
}

module.exports = RepoSyncChecker;
module.exports.handleSyncCommand = handleSyncCommand;

// CLI usage
if (require.main === module) {
  const action = process.argv[2] || 'check';
  const verbose = process.argv.includes('--verbose');
  const dryRun = process.argv.includes('--dry-run');

  const checker = new RepoSyncChecker({ verbose });

  (async () => {
    try {
      switch (action) {
        case 'check':
          await checker.checkRepoSync();
          break;
        case 'report':
          await checker.showSyncReport();
          break;
        case 'sync':
          await checker.autoSync(dryRun);
          break;
        default:
          console.log(
            'Usage: node repo-sync-check.js [check|report|sync] [--verbose] [--dry-run]'
          );
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  })();
}
