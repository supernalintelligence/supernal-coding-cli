#!/usr/bin/env node
// @ts-nocheck

const fs = require('fs-extra');
const path = require('node:path');
const crypto = require('node:crypto');
const chalk = require('chalk');
const { findGitRoot } = require('../../utils/git-utils');
const { getConfig } = require('../../../scripts/config-loader');

/**
 * Rule Change Detection System
 * REQ-065: Active Rules Reporting System with Automatic PR Submission
 *
 * Detects changes to cursor rules and other rule files, maintaining
 * checksums and timestamps to identify new or modified rules.
 */

class RuleChangeDetector {
  changes: any;
  config: any;
  currentState: any;
  gitRoot: any;
  previousState: any;
  projectRoot: any;
  stateFile: any;
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.gitRoot = findGitRoot(this.projectRoot);
    this.config = null;
    // Use process-specific state file in test environments to prevent race conditions
    // but allow override via options for test consistency
    const stateFileName =
      options.stateFileName ||
      (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID
        ? `rules-state-${process.pid}.json` // Removed Date.now() for consistency
        : 'rules-state.json');
    this.stateFile = path.join(
      this.projectRoot,
      '.supernal-coding',
      stateFileName
    );
    this.previousState = {};
    this.currentState = {};
    this.changes = [];
  }

  /**
   * Load configuration from YAML
   */
  async loadConfig() {
    try {
      const { loadProjectConfig } = require('../../utils/config-loader');
      this.config = loadProjectConfig(this.projectRoot) || {};
    } catch (_error) {
      // Fallback to default configuration
      this.config = {
        rules: {
          reporting: {
            enabled: true,
            consent_mode: 'ask_every_time',
            interrupt_commands: true,
            bypass_flag_enabled: true,
            detection_patterns: [
              '**/*.mdc',
              '**/rules/**/*',
              '**/workflow-rules/**/*'
            ],
            ignore_patterns: [
              '**/node_modules/**',
              '**/.git/**',
              '**/dist/**',
              '**/build/**'
            ]
          }
        }
      };
    }
  }

  /**
   * Load previous state from disk
   */
  async loadPreviousState() {
    try {
      if (await fs.pathExists(this.stateFile)) {
        this.previousState = await fs.readJson(this.stateFile);
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `Warning: Could not load previous rules state: ${error.message}`
        )
      );
      this.previousState = {};
    }
  }

  /**
   * Save current state to disk
   */
  async saveCurrentState() {
    try {
      await fs.ensureDir(path.dirname(this.stateFile));
      await fs.writeJson(this.stateFile, this.currentState, { spaces: 2 });
    } catch (error) {
      console.warn(
        chalk.yellow(`Warning: Could not save rules state: ${error.message}`)
      );
    }
  }

  /**
   * Calculate file hash for change detection
   */
  async calculateFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const hash = await this.calculateFileHash(filePath);

      return {
        path: filePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        hash: hash,
        type: this.classifyRuleFile(filePath)
      };
    } catch (_error) {
      return null;
    }
  }

  /**
   * Classify rule file type
   */
  classifyRuleFile(filePath) {
    const relativePath = path.relative(
      this.gitRoot || this.projectRoot,
      filePath
    );

    if (relativePath.includes('.cursor/rules')) return 'cursor';
    if (relativePath.includes('workflow-rules')) return 'workflow';
    if (
      relativePath.includes('git/hooks') ||
      relativePath.includes('.git/hooks')
    )
      return 'git';
    if (
      relativePath.includes('config') &&
      (filePath.endsWith('.yaml') ||
        filePath.endsWith('.yml') ||
        filePath.endsWith('.json') ||
        filePath.endsWith('.toml'))
    )
      return 'config';

    return 'custom';
  }

  /**
   * Scan for rule files based on patterns
   */
  async scanRuleFiles() {
    const glob = require('glob');
    const patterns = this.config.rules?.reporting?.detection_patterns || [
      '**/*.mdc',
      '**/rules/**/*',
      '**/workflow-rules/**/*',
      '**/.cursor/rules/**/*',
      '**/supernal.yaml'
    ];

    const ignorePatterns = this.config.rules?.reporting?.ignore_patterns || [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**'
    ];

    const allFiles = [];
    const searchRoot = this.gitRoot || this.projectRoot;

    for (const pattern of patterns) {
      try {
        const files = glob.sync(pattern, {
          cwd: searchRoot,
          absolute: true,
          ignore: ignorePatterns,
          nodir: true
        });
        allFiles.push(...files);
      } catch (error) {
        console.warn(
          chalk.yellow(
            `Warning: Error scanning pattern ${pattern}: ${error.message}`
          )
        );
      }
    }

    // Remove duplicates and filter existing files
    const uniqueFiles = [...new Set(allFiles)];
    const existingFiles = [];

    for (const file of uniqueFiles) {
      if (await fs.pathExists(file)) {
        existingFiles.push(file);
      }
    }

    return existingFiles;
  }

  /**
   * Build current state from file system
   */
  async buildCurrentState() {
    const ruleFiles = await this.scanRuleFiles();
    const currentState = {
      timestamp: new Date().toISOString(),
      files: {}
    };

    for (const filePath of ruleFiles) {
      const metadata = await this.getFileMetadata(filePath);
      if (metadata) {
        const relativePath = path.relative(
          this.gitRoot || this.projectRoot,
          filePath
        );
        currentState.files[relativePath] = metadata;
      }
    }

    this.currentState = currentState;
    return currentState;
  }

  /**
   * Compare states and detect changes
   */
  detectChanges() {
    const changes = [];
    const previousFiles = this.previousState.files || {};
    const currentFiles = this.currentState.files || {};

    // Check for new files
    for (const [relativePath, currentFile] of Object.entries(currentFiles)) {
      if (!previousFiles[relativePath]) {
        changes.push({
          type: 'added',
          path: relativePath,
          file: currentFile,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check for modified files
    for (const [relativePath, currentFile] of Object.entries(currentFiles)) {
      const previousFile = previousFiles[relativePath];
      if (previousFile && previousFile.hash !== currentFile.hash) {
        changes.push({
          type: 'modified',
          path: relativePath,
          file: currentFile,
          previousFile: previousFile,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check for deleted files
    for (const [relativePath, previousFile] of Object.entries(previousFiles)) {
      if (!currentFiles[relativePath]) {
        changes.push({
          type: 'deleted',
          path: relativePath,
          file: previousFile,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.changes = changes;
    return changes;
  }

  /**
   * Check for rule changes (main entry point)
   */
  async checkForChanges() {
    await this.loadConfig();

    // Skip if rules reporting is disabled
    if (!this.config.rules?.reporting?.enabled) {
      return { hasChanges: false, changes: [] };
    }

    await this.loadPreviousState();
    await this.buildCurrentState();

    const changes = this.detectChanges();

    // Save current state for next run
    await this.saveCurrentState();

    return {
      hasChanges: changes.length > 0,
      changes: changes,
      config: this.config.rules.reporting
    };
  }

  /**
   * Get summary of changes for user display
   */
  getChangesSummary(changes) {
    const summary = {
      added: changes.filter((c) => c.type === 'added'),
      modified: changes.filter((c) => c.type === 'modified'),
      deleted: changes.filter((c) => c.type === 'deleted')
    };

    const counts = {
      added: summary.added.length,
      modified: summary.modified.length,
      deleted: summary.deleted.length,
      total: changes.length
    };

    return { summary, counts };
  }

  /**
   * Format changes for display
   */
  formatChangesForDisplay(changes) {
    const { summary, counts } = this.getChangesSummary(changes);

    let output = chalk.bold.blue('🔍 Rule Changes Detected:\n');

    if (counts.added > 0) {
      output += chalk.green(`\n  ✨ Added (${counts.added}):\n`);
      summary.added.forEach((change) => {
        output += chalk.green(
          `    + ${change.path} (${change.file.type} rule)\n`
        );
      });
    }

    if (counts.modified > 0) {
      output += chalk.yellow(`\n  📝 Modified (${counts.modified}):\n`);
      summary.modified.forEach((change) => {
        output += chalk.yellow(
          `    ~ ${change.path} (${change.file.type} rule)\n`
        );
      });
    }

    if (counts.deleted > 0) {
      output += chalk.red(`\n  🗑️  Deleted (${counts.deleted}):\n`);
      summary.deleted.forEach((change) => {
        output += chalk.red(
          `    - ${change.path} (${change.file.type} rule)\n`
        );
      });
    }

    return output;
  }
}

module.exports = RuleChangeDetector;
