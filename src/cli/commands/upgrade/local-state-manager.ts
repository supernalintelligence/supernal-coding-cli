#!/usr/bin/env node
// @ts-nocheck

// local-state-manager.js - Manage local .sc folder and state tracking
// Part of REQ-053: Enhanced Local Repository Sync Check with State Management

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { execSync } = require('node:child_process');

class LocalStateManager {
  configManager: any;
  projectRoot: any;
  scFolderPath: any;
  stateFilePath: any;
  verbose: any;
  versionFilePath: any;
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
    this.scFolderPath = path.join(this.projectRoot, '.supernal-coding');
    this.stateFilePath = path.join(this.scFolderPath, 'state.json');
    this.versionFilePath = path.join(
      this.scFolderPath,
      'last-sync-version.txt'
    );

    // Config is now handled by the main config system, not local files
    this.configManager = options.configManager || null;
  }

  /**
   * Initialize .supernal-coding folder structure and gitignore management
   */
  async initializeScFolder() {
    try {
      await fs.ensureDir(this.scFolderPath);

      // Create initial state if it doesn't exist
      if (!(await fs.pathExists(this.stateFilePath))) {
        const initialState = {
          initialized: new Date().toISOString(),
          lastSyncCheck: null,
          lastSyncVersion: null,
          syncHistory: [],
          repoType: await this.detectRepoType()
        };
        await fs.writeJson(this.stateFilePath, initialState, { spaces: 2 });
      }

      // Ensure .gitignore excludes the entire .supernal-coding folder
      await this.ensureGitIgnore();

      if (this.verbose) {
        console.log(
          chalk.green(
            `✅ .supernal-coding folder initialized at ${this.scFolderPath}`
          )
        );
      }

      return true;
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to initialize .supernal-coding folder: ${error.message}`
        )
      );
      return false;
    }
  }

  /**
   * Ensure .gitignore properly excludes .supernal-coding folder
   */
  async ensureGitIgnore() {
    try {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      const _ignoreEntry = '.supernal-coding/';

      // Read existing .gitignore or create empty content
      let gitignoreContent = '';
      if (await fs.pathExists(gitignorePath)) {
        gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      }

      // Check if .supernal-coding is already ignored
      if (!gitignoreContent.includes('.supernal-coding')) {
        // Add .supernal-coding to .gitignore
        const newContent =
          gitignoreContent.trim() +
          '\n\n# Supernal Coding local state (auto-managed)\n.supernal-coding/\n';
        await fs.writeFile(gitignorePath, newContent);

        if (this.verbose) {
          console.log(chalk.green('✅ Added .supernal-coding/ to .gitignore'));
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.error(
          chalk.yellow(`⚠️  Could not update .gitignore: ${error.message}`)
        );
      }
    }
  }

  /**
   * Detect what type of repository this is
   */
  async detectRepoType() {
    const indicators = [
      { file: 'supernal-code-package/package.json', type: 'supernal-source' },
      { file: 'package.json', type: 'npm-project' },
      { file: '.git', type: 'git-repo' },
      { file: 'node_modules', type: 'node-project' }
    ];

    for (const indicator of indicators) {
      if (await fs.pathExists(path.join(this.projectRoot, indicator.file))) {
        return indicator.type;
      }
    }

    return 'unknown';
  }

  /**
   * Get current state
   */
  async getState() {
    try {
      if (!(await fs.pathExists(this.stateFilePath))) {
        await this.initializeScFolder();
      }
      return await fs.readJson(this.stateFilePath);
    } catch (error) {
      if (this.verbose) {
        console.error(
          chalk.yellow(`⚠️  Could not read state: ${error.message}`)
        );
      }
      return null;
    }
  }

  /**
   * Update state
   */
  async updateState(updates) {
    try {
      const currentState = (await this.getState()) || {};
      const newState = {
        ...currentState,
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      await fs.writeJson(this.stateFilePath, newState, { spaces: 2 });
      return newState;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to update state: ${error.message}`));
      return null;
    }
  }

  /**
   * Record a sync check
   */
  async recordSyncCheck(result) {
    try {
      const state = await this.getState();
      if (!state) return false;

      const syncRecord = {
        timestamp: new Date().toISOString(),
        globalVersion: result.globalVersion,
        localVersion: result.localVersion,
        isInSync: result.isInSync,
        issues: result.issues || []
      };

      // Keep last 10 sync checks
      const syncHistory = state.syncHistory || [];
      syncHistory.unshift(syncRecord);
      if (syncHistory.length > 10) {
        syncHistory.splice(10);
      }

      await this.updateState({
        lastSyncCheck: syncRecord.timestamp,
        lastSyncVersion: result.globalVersion,
        syncHistory
      });

      // Update version file for quick access
      if (result.globalVersion) {
        await fs.writeFile(this.versionFilePath, result.globalVersion);
      }

      return true;
    } catch (error) {
      console.error(
        chalk.red(`❌ Failed to record sync check: ${error.message}`)
      );
      return false;
    }
  }

  /**
   * Get last known sync version (quick read)
   */
  async getLastSyncVersion() {
    try {
      if (await fs.pathExists(this.versionFilePath)) {
        return (await fs.readFile(this.versionFilePath, 'utf8')).trim();
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get sync configuration from main config system
   */
  async getConfig() {
    // Default sync configuration
    const defaultConfig = {
      syncCheckEnabled: true,
      autoSyncOnVersionMismatch: false,
      criticalFiles: ['archive/', 'package.json', 'supernal-code-package/'],
      ignoredPaths: ['node_modules/', '.git/', 'dist/', 'build/']
    };

    // TODO: Integrate with main YAML config system when available
    // For now, return defaults
    return defaultConfig;
  }

  /**
   * Check if .supernal-coding folder should be committed
   */
  shouldCommitScFolder() {
    // .supernal-coding folder contains only local state and should NEVER be committed
    // All configuration is handled by the main YAML config system
    return {
      commitFolder: false,
      commitState: false,
      commitVersion: false,
      commitLogs: false,
      gitignorePattern: '.supernal-coding/',
      reason:
        'All files contain local state only - configuration is handled by main config system'
    };
  }

  /**
   * Check if this repo can do sync checks
   */
  async canDoSyncCheck() {
    const state = await this.getState();
    if (!state) return { canSync: false, reason: 'No .sc state found' };

    const config = await this.getConfig();
    if (!config.syncCheckEnabled) {
      return { canSync: false, reason: 'Sync checking disabled in config' };
    }

    // Check if we can detect a meaningful local version
    const localVersion = await this.detectLocalVersion();
    if (!localVersion) {
      return {
        canSync: false,
        reason: 'Cannot detect local version for comparison'
      };
    }

    return { canSync: true, localVersion, repoType: state.repoType };
  }

  /**
   * Detect local version based on repo type
   */
  async detectLocalVersion() {
    const state = await this.getState();
    if (!state) return null;

    // First, check if we have a synced version from previous sync operation
    if (state.lastSyncVersion) {
      return state.lastSyncVersion;
    }

    switch (state.repoType) {
      case 'supernal-source':
        // Source repo - use package.json version
        try {
          const packagePath = path.join(this.projectRoot, 'package.json');
          const packageJson = await fs.readJson(packagePath);
          return packageJson.version;
        } catch (_error) {
          return null;
        }

      case 'npm-project':
        // Regular npm project - check if sc is installed as dependency
        try {
          const packagePath = path.join(this.projectRoot, 'package.json');
          const packageJson = await fs.readJson(packagePath);
          return (
            packageJson.dependencies?.['@supernal/sc'] ||
            packageJson.devDependencies?.['@supernal/sc'] ||
            packageJson.dependencies?.['supernal-code'] ||
            'project-local'
          );
        } catch (_error) {
          return 'project-local';
        }

      default:
        // For other repos, we can still check against global version
        return 'repo-local';
    }
  }

  /**
   * Show detailed state information
   */
  async showStateInfo() {
    console.log(chalk.blue.bold('📊 Local Supernal Coding State Information'));
    console.log(chalk.blue('='.repeat(50)));

    const state = await this.getState();
    if (!state) {
      console.log(
        chalk.red('❌ No .supernal-coding state found. Run: sc sync init')
      );
      return;
    }

    console.log('');
    console.log(chalk.blue('📁 Repository Information:'));
    console.log(`   Type:           ${chalk.cyan(state.repoType)}`);
    console.log(
      `   Initialized:    ${chalk.cyan(new Date(state.initialized).toLocaleString())}`
    );
    console.log(
      `   Last Updated:   ${chalk.cyan(state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : 'Never')}`
    );

    const localVersion = await this.detectLocalVersion();
    console.log(`   Local Version:  ${chalk.cyan(localVersion || 'Unknown')}`);

    console.log('');
    console.log(chalk.blue('🔄 Sync History:'));
    if (state.syncHistory && state.syncHistory.length > 0) {
      state.syncHistory.slice(0, 5).forEach((record, index) => {
        const status = record.isInSync
          ? chalk.green('✅ In Sync')
          : chalk.red('❌ Out of Sync');
        console.log(
          `   ${index + 1}. ${new Date(record.timestamp).toLocaleString()} - ${status}`
        );
        console.log(
          `      Global: ${record.globalVersion || 'Unknown'}, Local: ${record.localVersion || 'Unknown'}`
        );
        if (record.issues && record.issues.length > 0) {
          console.log(`      Issues: ${record.issues.length}`);
        }
      });
    } else {
      console.log('   No sync history recorded yet');
    }

    const config = await this.getConfig();
    console.log('');
    console.log(chalk.blue('⚙️  Configuration:'));
    console.log(
      `   Sync Enabled:   ${config.syncCheckEnabled ? chalk.green('Yes') : chalk.red('No')}`
    );
    console.log(
      `   Auto Sync:      ${config.autoSyncOnVersionMismatch ? chalk.green('Yes') : chalk.red('No')}`
    );
    console.log(`   Critical Files: ${config.criticalFiles.length} defined`);
    console.log(chalk.gray('   (Configuration managed by main config system)'));

    const canSync = await this.canDoSyncCheck();
    console.log('');
    console.log(chalk.blue('🎯 Sync Capability:'));
    if (canSync.canSync) {
      console.log(
        `   Status:         ${chalk.green('✅ Can perform sync checks')}`
      );
    } else {
      console.log(`   Status:         ${chalk.red('❌ Cannot sync')}`);
      console.log(`   Reason:         ${chalk.yellow(canSync.reason)}`);
    }

    console.log('');
  }
}

module.exports = { LocalStateManager };

// CLI usage
if (require.main === module) {
  const action = process.argv[2] || 'info';
  const verbose = process.argv.includes('--verbose');

  const manager = new LocalStateManager({ verbose });

  (async () => {
    try {
      switch (action) {
        case 'init':
          await manager.initializeScFolder();
          break;
        case 'info':
          await manager.showStateInfo();
          break;
        case 'config': {
          const config = await manager.getConfig();
          console.log(JSON.stringify(config, null, 2));
          break;
        }
        default:
          console.log(
            'Usage: node local-state-manager.js [init|info|config] [--verbose]'
          );
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  })();
}
