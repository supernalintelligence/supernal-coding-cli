// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');

/**
 * WipManager
 *
 * Manages work-in-progress files via WIP registry.
 * Tracks untracked files until ready to commit.
 *
 * Registry: .supernal/wip-registry.yaml
 */
class WipManager {
  categories: any;
  projectRoot: any;
  registryPath: any;
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.registryPath = path.join(
      projectRoot,
      '.supernal',
      'wip-registry.yaml'
    );
    this.categories = ['experiments', 'drafts', 'scratch', 'notes', 'archive'];
  }

  /**
   * Register a file in WIP registry
   * @param {string} filePath - Path to file
   * @param {object} options - { feature, requirement, reason, autoCleanup, notes, userid }
   */
  async register(filePath, options) {
    // Validate file exists
    const fullPath = path.resolve(this.projectRoot, filePath);
    if (!(await fs.pathExists(fullPath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Load registry
    const registry = await this.loadRegistry();

    // Check if already registered
    const existing = registry.files.find((f) => f.path === filePath);
    if (existing) {
      // If existing has userid and new registration has different userid, throw specific error
      if (
        existing.userid &&
        options.userid &&
        existing.userid !== options.userid
      ) {
        throw new Error(
          `File already WIP-tracked by @${existing.userid}. Contact them before registering.`
        );
      }
      throw new Error(`File already WIP-tracked: ${filePath}`);
    }

    // Get file stats
    const stats = await fs.stat(fullPath);

    // Auto-detect userid if not provided
    const userid = options.userid || (await this.getUserid());

    // Create entry
    const entry = {
      path: filePath,
      feature: options.feature,
      requirement: options.requirement,
      reason: options.reason || 'Work in progress',
      registered: new Date().toISOString(),
      last_modified: stats.mtime.toISOString(),
      auto_cleanup: options.autoCleanup !== false,
      userid: userid
    };

    if (options.notes) {
      entry.notes = options.notes;
    }

    // Add to registry
    registry.files.push(entry);
    await this.saveRegistry(registry);

    // Add comment to file if requested
    if (options.addComment) {
      await this.addWipComment(fullPath, entry);
    }

    return entry;
  }

  /**
   * Unregister a file from WIP registry
   * @param {string} filePath - Path to file
   * @param {object} options - { quiet }
   */
  async unregister(filePath, options = {}) {
    const registry = await this.loadRegistry();
    const initialCount = registry.files.length;

    // Remove file from registry
    registry.files = registry.files.filter((f) => f.path !== filePath);

    if (registry.files.length === initialCount) {
      if (!options.quiet) {
        return {
          removed: false,
          message: `File not in WIP registry: ${filePath}`
        };
      }
      return { removed: false };
    }

    await this.saveRegistry(registry);

    // Remove WIP comment from file if it exists
    const fullPath = path.resolve(this.projectRoot, filePath);
    if (await fs.pathExists(fullPath)) {
      await this.removeWipComment(fullPath);
    }

    return { removed: true, path: filePath };
  }

  /**
   * List WIP-tracked files
   * @param {object} options - { olderThan, pathsOnly, userid, me, unassigned }
   */
  async list(options = {}) {
    const registry = await this.loadRegistry();
    let files = registry.files;

    // Filter by userid if requested
    if (options.userid) {
      files = files.filter((f) => f.userid === options.userid);
    }

    // Filter by current user if --me flag
    if (options.me) {
      const currentUser = await this.getUserid();
      files = files.filter((f) => f.userid === currentUser);
    }

    // Filter unassigned files
    if (options.unassigned) {
      files = files.filter((f) => !f.userid || f.userid === 'unknown');
    }

    // Filter by age if requested
    if (options.olderThan) {
      const days = parseInt(options.olderThan, 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      files = files.filter((f) => {
        const lastModified = new Date(f.last_modified);
        return lastModified < cutoffDate;
      });
    }

    // Return paths only if requested
    if (options.pathsOnly) {
      return files.map((f) => f.path);
    }

    return files;
  }

  /**
   * Get WIP registry status including untracked files
   * @returns {object} Status information
   */
  async status() {
    const registry = await this.loadRegistry();
    const now = new Date();
    const warnDays = registry.config?.warn_after_days || 3;

    // Auto-cleanup: Remove files that don't exist or are now committed
    let cleaned = 0;
    const stillExists = [];

    for (const entry of registry.files) {
      const fullPath = path.resolve(this.projectRoot, entry.path);
      const exists = await fs.pathExists(fullPath);

      if (!exists) {
        // File deleted, auto-remove from registry
        cleaned++;
        continue;
      }

      // Check if file is now committed (tracked by git)
      try {
        const { execSync } = require('node:child_process');
        execSync(`git ls-files --error-unmatch "${entry.path}"`, {
          cwd: this.projectRoot,
          stdio: 'ignore'
        });
        // File is tracked, auto-remove from registry
        cleaned++;
      } catch (_error) {
        // File is not tracked, keep it
        stillExists.push(entry);
      }
    }

    // Save cleaned registry if changed
    if (cleaned > 0) {
      registry.files = stillExists;
      await this.saveRegistry(registry);
    }

    // Get pre-staged files (after cleanup)
    const active = stillExists.filter((f) => {
      const age = (now - new Date(f.last_modified)) / (1000 * 60 * 60 * 24);
      return age <= warnDays;
    });

    const old = stillExists.filter((f) => {
      const age = (now - new Date(f.last_modified)) / (1000 * 60 * 60 * 24);
      return age > warnDays;
    });

    // Get untracked files (not committed, staged, or pre-staged)
    const { execSync } = require('node:child_process');

    try {
      // Get all untracked files (not in git at all)
      const untrackedRaw = execSync(
        'git ls-files --others --exclude-standard',
        {
          cwd: this.projectRoot,
          encoding: 'utf8'
        }
      ).trim();

      const allUntracked = untrackedRaw ? untrackedRaw.split('\n') : [];

      // Filter out files that are WIP-tracked
      const wipTrackedPaths = stillExists.map((f) => f.path);
      const trulyUntracked = allUntracked.filter(
        (f) => !wipTrackedPaths.includes(f)
      );

      return {
        total: stillExists.length,
        active: active.length,
        old: old.length,
        cleaned,
        untracked: trulyUntracked.length,
        untrackedFiles: trulyUntracked,
        oldFiles: old.map((f) => ({
          path: f.path,
          feature: f.feature,
          age: Math.floor(
            (now - new Date(f.last_modified)) / (1000 * 60 * 60 * 24)
          )
        })),
        warnDays
      };
    } catch (_error) {
      // If not in a git repo or git command fails
      return {
        total: registry.files.length,
        active: active.length,
        old: old.length,
        untracked: 0,
        untrackedFiles: [],
        oldFiles: old.map((f) => ({
          path: f.path,
          feature: f.feature,
          age: Math.floor(
            (now - new Date(f.last_modified)) / (1000 * 60 * 60 * 24)
          )
        })),
        warnDays
      };
    }
  }

  /**
   * Update last_modified timestamp (touch)
   * @param {string} filePath - Path to file
   */
  async touch(filePath) {
    const registry = await this.loadRegistry();
    const file = registry.files.find((f) => f.path === filePath);

    if (!file) {
      throw new Error(`File not in WIP registry: ${filePath}`);
    }

    // Update last_modified
    file.last_modified = new Date().toISOString();
    await this.saveRegistry(registry);

    return file;
  }

  /**
   * Cleanup old files
   * @param {object} options - { olderThan, dryRun, force }
   */
  async cleanup(options = {}) {
    const oldFiles = await this.list({ olderThan: options.olderThan || '7d' });

    if (oldFiles.length === 0) {
      return { cleaned: 0, message: 'No old files to clean up' };
    }

    const results = [];

    for (const file of oldFiles) {
      if (options.dryRun) {
        results.push({ path: file.path, action: 'would-delete' });
        continue;
      }

      // For now, just unregister (don't delete file)
      // User can choose to delete manually
      const _result = await this.unregister(file.path, { quiet: true });
      results.push({ path: file.path, action: 'unregistered' });
    }

    return {
      cleaned: results.length,
      results
    };
  }

  /**
   * Add WIP comment to file
   */
  async addWipComment(filePath, entry) {
    const ext = path.extname(filePath);
    let comment;

    // Generate comment based on file type
    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      comment = `// WIP-REGISTRY: ${entry.feature || 'WIP'}\n// Feature: ${entry.feature || 'N/A'}\n// Requirement: ${entry.requirement || 'N/A'}\n// Registered: ${entry.registered}\n\n`;
    } else if (['.md', '.html'].includes(ext)) {
      comment = `<!-- WIP-REGISTRY: ${entry.feature || 'WIP'} -->\n<!-- Feature: ${entry.feature || 'N/A'} -->\n<!-- Requirement: ${entry.requirement || 'N/A'} -->\n<!-- Registered: ${entry.registered} -->\n\n`;
    } else if (['.py'].includes(ext)) {
      comment = `# WIP-REGISTRY: ${entry.feature || 'WIP'}\n# Feature: ${entry.feature || 'N/A'}\n# Requirement: ${entry.requirement || 'N/A'}\n# Registered: ${entry.registered}\n\n`;
    } else {
      // Skip for unknown file types
      return;
    }

    // Prepend comment to file
    const content = await fs.readFile(filePath, 'utf8');
    await fs.writeFile(filePath, comment + content);
  }

  /**
   * Remove WIP comment from file
   */
  async removeWipComment(filePath) {
    if (!(await fs.pathExists(filePath))) {
      return;
    }

    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    // Remove lines containing WIP-REGISTRY markers
    const filtered = lines.filter((line) => {
      return (
        !line.includes('WIP-REGISTRY:') &&
        !line.includes('Feature:') &&
        !line.includes('Registered:')
      );
    });

    // Remove leading empty lines
    while (filtered.length > 0 && filtered[0].trim() === '') {
      filtered.shift();
    }

    await fs.writeFile(filePath, filtered.join('\n'));
  }

  /**
   * Load registry from disk
   */
  async loadRegistry() {
    if (!(await fs.pathExists(this.registryPath))) {
      // Create default registry
      return {
        files: [],
        config: {
          auto_cleanup_after_days: 7,
          warn_after_days: 3,
          check_on_commit: true,
          allow_unregistered_files: false
        }
      };
    }

    const content = await fs.readFile(this.registryPath, 'utf8');
    return yaml.load(content);
  }

  /**
   * Save registry to disk
   */
  async saveRegistry(registry) {
    const content = yaml.dump(registry, { indent: 2 });

    await fs.ensureDir(path.dirname(this.registryPath));
    await fs.writeFile(this.registryPath, content);
  }

  /**
   * Get all untracked files from git
   */
  async getUntrackedFiles() {
    const { execSync } = require('node:child_process');
    try {
      const output = execSync('git ls-files --others --exclude-standard', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      return output
        .trim()
        .split('\n')
        .filter((f) => f);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Check for untracked files not in WIP registry
   */
  async checkUntracked() {
    const untracked = await this.getUntrackedFiles();
    const wipTracked = await this.list({ pathsOnly: true });

    const notWipTracked = untracked.filter(
      (file) => !wipTracked.includes(file)
    );

    return {
      untracked: untracked.length,
      wipTracked: wipTracked.length,
      notWipTracked: notWipTracked.length,
      files: notWipTracked
    };
  }

  /**
   * Get current userid from git config or environment
   * @returns {Promise<string>} The userid
   */
  async getUserid() {
    const { execSync } = require('node:child_process');

    try {
      // Try github username first (preferred)
      try {
        const github = execSync('git config user.github', {
          encoding: 'utf8',
          cwd: this.projectRoot,
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        if (github) return github;
      } catch (_error) {
        // Fall through to next option
      }

      // Try git name
      try {
        const name = execSync('git config user.name', {
          encoding: 'utf8',
          cwd: this.projectRoot,
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        if (name) return name;
      } catch (_error) {
        // Fall through to next option
      }

      // Fallback to system user
      return process.env.USER || 'unknown';
    } catch (_error) {
      return 'unknown';
    }
  }

  /**
   * List files by specific user
   * @param {string} userid - User to filter by
   * @returns {Promise<Array>} Files for that user
   */
  async listByUser(userid) {
    return this.list({ userid });
  }

  /**
   * Get statistics by user
   * @returns {Promise<object>} Statistics object
   */
  async getStatsByUser() {
    const registry = await this.loadRegistry();
    const stats = {};
    const now = new Date();
    const warnDays = registry.config?.warn_after_days || 3;

    for (const file of registry.files) {
      const user = file.userid || 'Unassigned';
      if (!stats[user]) {
        stats[user] = { total: 0, old: 0 };
      }

      stats[user].total++;

      // Check if old
      const age = (now - new Date(file.last_modified)) / (1000 * 60 * 60 * 24);
      if (age > warnDays) {
        stats[user].old++;
      }
    }

    return stats;
  }

  /**
   * Reassign file to different user
   * @param {string} filePath - Path to file
   * @param {string} newUserid - New userid
   * @returns {Promise<object>} Updated entry
   */
  async reassign(filePath, newUserid) {
    const registry = await this.loadRegistry();
    const file = registry.files.find((f) => f.path === filePath);

    if (!file) {
      throw new Error(`File not in WIP registry: ${filePath}`);
    }

    const oldUserid = file.userid;
    file.userid = newUserid;
    file.last_modified = new Date().toISOString();

    await this.saveRegistry(registry);

    return {
      path: filePath,
      oldUserid,
      newUserid,
      reassigned: true
    };
  }
}

module.exports = WipManager;
