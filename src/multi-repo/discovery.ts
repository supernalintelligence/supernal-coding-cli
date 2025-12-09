const fs = require('node:fs').promises;
const path = require('node:path');
const { ConfigLoader } = require('../config');

/**
 * RepoDiscovery - Discover and manage multi-repo structures
 */
class RepoDiscovery {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.discovered = new Map();
  }

  /**
   * Discover all repos starting from root
   * @param {string} rootPath - Root directory to scan
   * @param {Object} options
   * @param {number} options.maxDepth - Maximum directory depth
   * @param {Array<string>} options.exclude - Directories to exclude
   * @returns {Promise<Array<Object>>} Discovered repos
   */
  async discover(rootPath, options = {}) {
    const {
      maxDepth = 10,
      exclude = ['node_modules', '.git', 'dist', 'build']
    } = options;

    this.discovered.clear();

    await this.scanDirectory(rootPath, 0, maxDepth, exclude);

    return Array.from(this.discovered.values());
  }

  /**
   * Scan directory recursively for .supernal directories
   * @private
   */
  async scanDirectory(dirPath, currentDepth, maxDepth, exclude) {
    if (currentDepth > maxDepth) return;

    try {
      // Check if this directory is a repo
      if (await this.isValidRepo(dirPath)) {
        await this.addRepo(dirPath);
      }

      // Scan subdirectories
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (exclude.includes(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.supernal') continue;

        const subPath = path.join(dirPath, entry.name);
        await this.scanDirectory(subPath, currentDepth + 1, maxDepth, exclude);
      }
    } catch (error) {
      // Skip directories we can't read
      if (error.code !== 'EACCES' && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if path is a valid repo
   * @param {string} repoPath
   * @returns {Promise<boolean>}
   */
  async isValidRepo(repoPath) {
    try {
      const supernalPath = path.join(repoPath, '.supernal');
      const stat = await fs.stat(supernalPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Add discovered repo
   * @private
   */
  async addRepo(repoPath) {
    try {
      // Generate repo ID from path
      const repoId = this.generateRepoId(repoPath);

      // Load repo config
      const configFile = path.join(repoPath, '.supernal', 'project.yaml');
      let config = null;
      let workflow = null;
      let currentPhase = null;

      try {
        config = await this.configLoader.load(configFile);
        workflow = config.workflow?.name || config.workflow?.defaults || null;

        // Try to load workflow state
        const stateFile = path.join(
          repoPath,
          '.supernal',
          'workflow-state.yaml'
        );
        try {
          const stateContent = await fs.readFile(stateFile, 'utf8');
          const yaml = require('yaml');
          const state = yaml.parse(stateContent);
          currentPhase = state.currentPhase || null;
        } catch {
          // No state file - that's ok
        }
      } catch {
        // No config or invalid - still add repo
      }

      const repo = {
        id: repoId,
        path: repoPath,
        config,
        workflow,
        currentPhase,
        hasConfig: config !== null
      };

      this.discovered.set(repoId, repo);
    } catch (_error) {
      // Skip repos we can't process
    }
  }

  /**
   * Generate repo ID from path
   * @private
   */
  generateRepoId(repoPath) {
    // Use relative path from cwd or absolute path
    const cwd = process.cwd();
    let id = repoPath;

    if (repoPath.startsWith(cwd)) {
      id = repoPath.slice(cwd.length + 1);
    }

    // Replace path separators with dashes
    return id.replace(/[/\\]/g, '-').replace(/^-+|-+$/g, '') || 'root';
  }

  /**
   * List all discovered repos
   * @returns {Array<Object>}
   */
  listRepos() {
    return Array.from(this.discovered.values());
  }

  /**
   * Get specific repo by ID
   * @param {string} repoId
   * @returns {Object|null}
   */
  getRepo(repoId) {
    return this.discovered.get(repoId) || null;
  }

  /**
   * Get repo by path
   * @param {string} repoPath
   * @returns {Object|null}
   */
  getRepoByPath(repoPath) {
    for (const repo of this.discovered.values()) {
      if (repo.path === repoPath) {
        return repo;
      }
    }
    return null;
  }

  /**
   * Get repos by workflow
   * @param {string} workflowName
   * @returns {Array<Object>}
   */
  getReposByWorkflow(workflowName) {
    return this.listRepos().filter((r) => r.workflow === workflowName);
  }

  /**
   * Get repos by phase
   * @param {string} phaseId
   * @returns {Array<Object>}
   */
  getReposByPhase(phaseId) {
    return this.listRepos().filter((r) => r.currentPhase === phaseId);
  }

  /**
   * Get repos with config
   * @returns {Array<Object>}
   */
  getConfiguredRepos() {
    return this.listRepos().filter((r) => r.hasConfig);
  }

  /**
   * Get repos without config
   * @returns {Array<Object>}
   */
  getUnconfiguredRepos() {
    return this.listRepos().filter((r) => !r.hasConfig);
  }

  /**
   * Get repo count
   * @returns {number}
   */
  getRepoCount() {
    return this.discovered.size;
  }

  /**
   * Clear discovered repos
   */
  clear() {
    this.discovered.clear();
  }
}

module.exports = { RepoDiscovery };
