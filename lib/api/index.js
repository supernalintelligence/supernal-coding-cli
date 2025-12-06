/**
 * Supernal Coding Programmatic API
 *
 * Provides a clean JavaScript/Node.js API for programmatic access
 * to all Supernal Coding functionality, independent of MCP or CLI.
 *
 * Can be used by:
 * - External systems integrating with Supernal Coding
 * - Custom dashboards and UIs
 * - Automation scripts
 * - CI/CD pipelines
 * - Testing frameworks
 *
 * @module api
 */

const RequirementsManager = require('../mcp-server/tools/requirements');
const KanbanManager = require('../mcp-server/tools/kanban');
const SyncManager = require('../mcp-server/sync/manager');
const { getConfig } = require('../scripts/config-loader');
const _path = require('node:path');

/**
 * Main API class for Supernal Coding
 */
class SupernalCodingAPI {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.config = null;

    // Initialize managers
    this.requirements = new RequirementsManager(this.projectRoot);
    this.kanban = new KanbanManager(this.projectRoot);
    this.sync = null;

    // Load configuration
    this.loadConfig();
  }

  /**
   * Load project configuration
   */
  loadConfig() {
    try {
      this.config = getConfig(this.projectRoot);
      this.config.load();

      // Initialize sync if configured
      if (this.config.sync?.enabled) {
        this.sync = new SyncManager(this.config.sync);
      }
    } catch (error) {
      console.warn('Configuration not loaded:', error.message);
      this.config = { sync: { enabled: false } };
    }
  }

  /**
   * Initialize the API (async setup)
   */
  async initialize() {
    if (this.sync) {
      await this.sync.initialize();
    }
  }

  // ==================== Requirements API ====================

  /**
   * List all requirements with optional filtering
   * @param {Object} filters - Filtering options
   * @param {string} filters.status - Filter by status
   * @param {string} filters.epic - Filter by epic
   * @param {string} filters.priority - Filter by priority
   * @param {string} filters.category - Filter by category
   * @returns {Promise<Array>} Array of requirements
   */
  async listRequirements(filters = {}) {
    return await this.requirements.list(filters);
  }

  /**
   * Read a specific requirement
   * @param {string} id - Requirement ID (e.g., REQ-037)
   * @returns {Promise<Object>} Requirement object with full content
   */
  async readRequirement(id) {
    return await this.requirements.read(id);
  }

  /**
   * Validate a requirement
   * @param {string} id - Requirement ID
   * @returns {Promise<Object>} Validation results
   */
  async validateRequirement(id) {
    return await this.requirements.validate(id);
  }

  /**
   * Create a new requirement
   * @param {Object} data - Requirement data
   * @param {string} data.title - Requirement title
   * @param {string} data.epic - Epic name
   * @param {string} data.priority - Priority level
   * @param {string} data.category - Category
   * @returns {Promise<Object>} Created requirement
   */
  async createRequirement(data) {
    return await this.requirements.create(data);
  }

  // ==================== Kanban API ====================

  /**
   * List tasks from kanban boards
   * @param {string} board - Specific board name (optional)
   * @returns {Promise<Object|Array>} Tasks by board or single board
   */
  async listKanbanTasks(board = null) {
    return await this.kanban.list(board);
  }

  /**
   * Move a task to a different board
   * @param {string} taskId - Task identifier
   * @param {string} toBoard - Target board name
   * @returns {Promise<Object>} Move result
   */
  async moveKanbanTask(taskId, toBoard) {
    return await this.kanban.move(taskId, toBoard);
  }

  /**
   * Get all kanban boards with their tasks
   * @returns {Promise<Object>} All boards and tasks
   */
  async getAllKanbanBoards() {
    return await this.kanban.getAllBoards();
  }

  // ==================== Sync API ====================

  /**
   * Get synchronization status
   * @returns {Promise<Object>} Sync status
   */
  async getSyncStatus() {
    if (!this.sync) {
      return {
        enabled: false,
        message: 'Synchronization is not configured'
      };
    }
    return await this.sync.getStatus();
  }

  /**
   * Push local changes to remote system
   * @param {boolean} force - Force push, overwrite conflicts
   * @returns {Promise<Object>} Push result
   */
  async pushChanges(force = false) {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    return await this.sync.push(force);
  }

  /**
   * Pull remote changes to local system
   * @param {boolean} force - Force pull, overwrite local
   * @returns {Promise<Object>} Pull result
   */
  async pullChanges(force = false) {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    return await this.sync.pull(force);
  }

  /**
   * Perform bidirectional sync (pull then push)
   * @returns {Promise<Object>} Sync result
   */
  async synchronize() {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    return await this.sync.sync();
  }

  /**
   * Add a change to pending sync queue
   * @param {Object} change - Change object
   */
  queueChange(change) {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    this.sync.addPendingChange(change);
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync() {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    this.sync.startAutoSync();
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync() {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    this.sync.stopAutoSync();
  }

  // ==================== Event Handlers ====================

  /**
   * Register event listener for sync events
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (this.sync) {
      this.sync.on(event, handler);
    }
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    if (this.sync) {
      this.sync.off(event, handler);
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Get current configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get project root directory
   * @returns {string} Project root path
   */
  getProjectRoot() {
    return this.projectRoot;
  }

  /**
   * Check if sync is enabled
   * @returns {boolean} True if sync is configured and enabled
   */
  isSyncEnabled() {
    return !!this.sync && this.config.sync?.enabled;
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup() {
    if (this.sync) {
      await this.sync.cleanup();
    }
  }
}

// Export API class and convenience factory
module.exports = SupernalCodingAPI;

/**
 * Factory function for creating API instance
 * @param {Object} options - Configuration options
 * @returns {SupernalCodingAPI} Initialized API instance
 */
module.exports.createAPI = async function createAPI(options) {
  const api = new SupernalCodingAPI(options);
  await api.initialize();
  return api;
};

/**
 * Express/HTTP middleware for exposing API as REST endpoints
 * @param {SupernalCodingAPI} api - API instance
 * @returns {Function} Express middleware
 */
module.exports.createHTTPMiddleware = function createHTTPMiddleware(api) {
  return async function supernalCodingMiddleware(req, res, next) {
    // Add API to request object
    req.supernalCoding = api;

    // Add convenience methods
    req.supernalCoding.sendJSON = (data) => {
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    };

    req.supernalCoding.sendError = (error, status = 500) => {
      res.status(status).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    };

    next();
  };
};
