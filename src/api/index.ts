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

// These modules are still JS
const RequirementsManager = require('../mcp-server/tools/requirements');
const KanbanManager = require('../mcp-server/tools/kanban');
const SyncManager = require('../mcp-server/sync/manager');
const { getConfig } = require('../scripts/config-loader');

/** Options for API initialization */
export interface SupernalCodingAPIOptions {
  projectRoot?: string;
}

/** Requirement filter options */
export interface RequirementFilters {
  status?: string;
  epic?: string;
  priority?: string;
  category?: string;
}

/** Requirement creation data */
export interface RequirementData {
  title: string;
  epic?: string;
  priority?: string;
  category?: string;
  [key: string]: unknown;
}

/** Sync status result */
export interface SyncStatus {
  enabled: boolean;
  message?: string;
  pendingChanges?: number;
  lastSync?: string;
}

/** Sync result */
export interface SyncResult {
  success: boolean;
  pushed?: number;
  pulled?: number;
  conflicts?: number;
  message?: string;
}

/** Change object for sync queue */
export interface SyncChange {
  type: 'create' | 'update' | 'delete';
  entity: string;
  id: string;
  data?: unknown;
  timestamp?: string;
}

/** Configuration object */
export interface SupernalConfig {
  sync?: {
    enabled: boolean;
    [key: string]: unknown;
  };
  load?: () => void;
  [key: string]: unknown;
}

/**
 * Main API class for Supernal Coding
 */
class SupernalCodingAPI {
  protected config: SupernalConfig | null;
  protected kanban: InstanceType<typeof KanbanManager>;
  protected projectRoot: string;
  protected requirements: InstanceType<typeof RequirementsManager>;
  protected sync: InstanceType<typeof SyncManager> | null;

  constructor(options: SupernalCodingAPIOptions = {}) {
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
  loadConfig(): void {
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
  async initialize(): Promise<void> {
    if (this.sync) {
      await this.sync.initialize();
    }
  }

  // ==================== Requirements API ====================

  /**
   * List all requirements with optional filtering
   */
  async listRequirements(filters: RequirementFilters = {}): Promise<unknown[]> {
    return await this.requirements.list(filters);
  }

  /**
   * Read a specific requirement
   */
  async readRequirement(id: string): Promise<unknown> {
    return await this.requirements.read(id);
  }

  /**
   * Validate a requirement
   */
  async validateRequirement(id: string): Promise<unknown> {
    return await this.requirements.validate(id);
  }

  /**
   * Create a new requirement
   */
  async createRequirement(data: RequirementData): Promise<unknown> {
    return await this.requirements.create(data);
  }

  // ==================== Kanban API ====================

  /**
   * List tasks from kanban boards
   */
  async listKanbanTasks(board: string | null = null): Promise<unknown> {
    return await this.kanban.list(board);
  }

  /**
   * Move a task to a different board
   */
  async moveKanbanTask(taskId: string, toBoard: string): Promise<unknown> {
    return await this.kanban.move(taskId, toBoard);
  }

  /**
   * Get all kanban boards with their tasks
   */
  async getAllKanbanBoards(): Promise<unknown> {
    return await this.kanban.getAllBoards();
  }

  // ==================== Sync API ====================

  /**
   * Get synchronization status
   */
  async getSyncStatus(): Promise<SyncStatus> {
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
   */
  async pushChanges(force = false): Promise<SyncResult> {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    return await this.sync.push(force);
  }

  /**
   * Pull remote changes to local system
   */
  async pullChanges(force = false): Promise<SyncResult> {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    return await this.sync.pull(force);
  }

  /**
   * Perform bidirectional sync (pull then push)
   */
  async synchronize(): Promise<SyncResult> {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    return await this.sync.sync();
  }

  /**
   * Add a change to pending sync queue
   */
  queueChange(change: SyncChange): void {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    this.sync.addPendingChange(change);
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(): void {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    this.sync.startAutoSync();
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (!this.sync) {
      throw new Error('Synchronization is not configured');
    }
    this.sync.stopAutoSync();
  }

  // ==================== Event Handlers ====================

  /**
   * Register event listener for sync events
   */
  on(event: string, handler: (...args: unknown[]) => void): void {
    if (this.sync) {
      this.sync.on(event, handler);
    }
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: (...args: unknown[]) => void): void {
    if (this.sync) {
      this.sync.off(event, handler);
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Get current configuration
   */
  getConfig(): SupernalConfig | null {
    return this.config;
  }

  /**
   * Get project root directory
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Check if sync is enabled
   */
  isSyncEnabled(): boolean {
    return !!this.sync && this.config.sync?.enabled;
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    if (this.sync) {
      await this.sync.cleanup();
    }
  }
}

/**
 * Factory function for creating API instance
 */
export async function createAPI(options: SupernalCodingAPIOptions = {}): Promise<SupernalCodingAPI> {
  const api = new SupernalCodingAPI(options);
  await api.initialize();
  return api;
}

/** Express request with Supernal Coding API */
interface SupernalRequest {
  supernalCoding: SupernalCodingAPI & {
    sendJSON: (data: unknown) => void;
    sendError: (error: Error, status?: number) => void;
  };
}

/** Express response type */
interface ExpressResponse {
  json: (data: unknown) => void;
  status: (code: number) => ExpressResponse;
}

/** Express next function */
type NextFunction = () => void;

/**
 * Express/HTTP middleware for exposing API as REST endpoints
 */
export function createHTTPMiddleware(api: SupernalCodingAPI) {
  return async function supernalCodingMiddleware(
    req: SupernalRequest,
    res: ExpressResponse,
    next: NextFunction
  ): Promise<void> {
    // Add API to request object
    (req as SupernalRequest).supernalCoding = api as SupernalRequest['supernalCoding'];

    // Add convenience methods
    req.supernalCoding.sendJSON = (data: unknown) => {
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    };

    req.supernalCoding.sendError = (error: Error, status = 500) => {
      res.status(status).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    };

    next();
  };
}

// Export class and types
export default SupernalCodingAPI;
export { SupernalCodingAPI };

// CommonJS compatibility
module.exports = SupernalCodingAPI;
module.exports.createAPI = createAPI;
module.exports.createHTTPMiddleware = createHTTPMiddleware;
module.exports.default = SupernalCodingAPI;
