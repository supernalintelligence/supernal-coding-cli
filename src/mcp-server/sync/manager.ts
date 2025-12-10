/**
 * Synchronization Manager
 *
 * Handles bidirectional sync between Supernal Coding and higher-level systems.
 * Supports multiple sync backends (REST API, GraphQL, WebSocket, etc.)
 *
 * @module sync/manager
 */

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

/** Sync backend type */
export type SyncBackendType = 'rest' | 'graphql' | 'websocket' | 'custom';

/** Conflict resolution strategy */
export type ConflictResolution = 'manual' | 'local' | 'remote' | 'latest';

/** Sync configuration */
export interface SyncConfig {
  enabled?: boolean;
  backend?: SyncBackendType;
  endpoint?: string | null;
  apiKey?: string | null;
  syncInterval?: number;
  autoSync?: boolean;
  conflictResolution?: ConflictResolution;
  customBackend?: SyncBackend | null;
}

/** Internal resolved config */
interface ResolvedSyncConfig {
  enabled: boolean;
  backend: SyncBackendType;
  endpoint: string | null;
  apiKey: string | null;
  syncInterval: number;
  autoSync: boolean;
  conflictResolution: ConflictResolution;
  customBackend: SyncBackend | null;
}

/** A change to be synced */
export interface SyncChange {
  id: string;
  type: string;
  hash?: string;
  timestamp?: Date | string;
  data?: unknown;
  [key: string]: unknown;
}

/** A detected conflict */
export interface SyncConflict {
  id: string;
  local: SyncChange;
  remote: SyncChange;
  type: 'modification' | 'deletion' | 'creation';
}

/** Sync state */
export interface SyncState {
  inProgress: boolean;
  lastPush: Date | null;
  lastPull: Date | null;
  conflicts: SyncConflict[];
  pendingChanges: SyncChange[];
}

/** Push result */
export interface PushResult {
  success: boolean;
  pushed: number | string[];
  message?: string;
  [key: string]: unknown;
}

/** Pull result */
export interface PullResult {
  success: boolean;
  pulled: number;
  message?: string;
  applied?: number;
  failed?: number;
  details?: {
    applied: SyncChange[];
    failed: Array<{ change: SyncChange; reason?: string; error?: string }>;
  };
}

/** Sync result */
export interface SyncResult {
  success: boolean;
  pull: PullResult;
  push: PushResult;
  timestamp: Date;
}

/** Sync status */
export interface SyncStatus {
  enabled: boolean;
  backend: SyncBackendType;
  endpoint: string | null;
  autoSync: boolean;
  lastSync: Date | null;
  state: SyncState & {
    backendStatus: unknown;
  };
}

/** Backend interface */
export interface SyncBackend {
  initialize(): Promise<void>;
  push(changes: SyncChange[], force?: boolean): Promise<PushResult>;
  pull(): Promise<SyncChange[]>;
  getStatus(): Promise<unknown>;
  cleanup?(): Promise<void>;
}

/**
 * Sync Manager for higher-level system integration
 */
class SyncManager extends EventEmitter {
  protected backend: SyncBackend | null;
  protected config: ResolvedSyncConfig;
  protected lastSync: Date | null;
  protected syncState: SyncState;
  protected syncTimer: NodeJS.Timeout | null;

  constructor(config: SyncConfig = {}) {
    super();

    this.config = {
      enabled: config.enabled ?? false,
      backend: config.backend ?? 'rest',
      endpoint: config.endpoint ?? null,
      apiKey: config.apiKey ?? null,
      syncInterval: config.syncInterval ?? 60000,
      autoSync: config.autoSync ?? false,
      conflictResolution: config.conflictResolution ?? 'manual',
      customBackend: config.customBackend ?? null,
    };

    this.backend = null;
    this.syncTimer = null;
    this.lastSync = null;
    this.syncState = {
      inProgress: false,
      lastPush: null,
      lastPull: null,
      conflicts: [],
      pendingChanges: []
    };
  }

  /**
   * Initialize sync manager and backend
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Load appropriate backend
    switch (this.config.backend) {
      case 'rest': {
        const RestBackend = require('./backends/rest');
        this.backend = new RestBackend(this.config);
        break;
      }

      case 'graphql': {
        const GraphQLBackend = require('./backends/graphql');
        this.backend = new GraphQLBackend(this.config);
        break;
      }

      case 'websocket': {
        const WebSocketBackend = require('./backends/websocket');
        this.backend = new WebSocketBackend(this.config);
        break;
      }

      case 'custom':
        if (this.config.customBackend) {
          this.backend = this.config.customBackend;
        } else {
          throw new Error('Custom backend specified but not provided');
        }
        break;

      default:
        throw new Error(`Unknown sync backend: ${this.config.backend}`);
    }

    await this.backend!.initialize();

    // Set up auto-sync if enabled
    if (this.config.autoSync) {
      this.startAutoSync();
    }

    this.emit('initialized');
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.syncInterval);

    this.emit('autoSyncStarted');
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.emit('autoSyncStopped');
    }
  }

  /**
   * Perform bidirectional sync
   */
  async sync(): Promise<SyncResult> {
    if (this.syncState.inProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncState.inProgress = true;
    this.emit('syncStarted');

    try {
      // Pull remote changes first
      const pullResult = await this.pull();

      // Then push local changes
      const pushResult = await this.push();

      this.lastSync = new Date();
      this.emit('syncCompleted', { pull: pullResult, push: pushResult });

      return {
        success: true,
        pull: pullResult,
        push: pushResult,
        timestamp: this.lastSync
      };
    } catch (error) {
      this.emit('syncFailed', error);
      throw error;
    } finally {
      this.syncState.inProgress = false;
    }
  }

  /**
   * Push local changes to remote
   */
  async push(force = false): Promise<PushResult> {
    this.emit('pushStarted');

    try {
      // Get pending changes
      const changes = await this.getPendingChanges();

      if (changes.length === 0) {
        return {
          success: true,
          pushed: 0,
          message: 'No changes to push'
        };
      }

      // Push to backend
      const result = await this.backend!.push(changes, force);

      // Update sync state
      this.syncState.lastPush = new Date();
      const pushedIds = Array.isArray(result.pushed) ? result.pushed : [];
      this.syncState.pendingChanges = this.syncState.pendingChanges.filter(
        (change) => !pushedIds.includes(change.id)
      );

      this.emit('pushCompleted', result);
      return result;
    } catch (error) {
      this.emit('pushFailed', error);
      throw error;
    }
  }

  /**
   * Pull remote changes to local
   */
  async pull(force = false): Promise<PullResult> {
    this.emit('pullStarted');

    try {
      // Get remote changes
      const remoteChanges = await this.backend!.pull();

      if (remoteChanges.length === 0) {
        return {
          success: true,
          pulled: 0,
          message: 'No remote changes'
        };
      }

      // Detect conflicts
      const conflicts = await this.detectConflicts(remoteChanges);

      if (conflicts.length > 0 && !force) {
        this.syncState.conflicts = conflicts;
        throw new Error(
          `Conflicts detected: ${conflicts.length} items need resolution`
        );
      }

      // Apply changes
      const result = await this.applyChanges(remoteChanges, force);

      // Update sync state
      this.syncState.lastPull = new Date();
      this.syncState.conflicts = [];

      this.emit('pullCompleted', result);
      return result;
    } catch (error) {
      this.emit('pullFailed', error);
      throw error;
    }
  }

  /**
   * Get pending local changes
   */
  async getPendingChanges(): Promise<SyncChange[]> {
    // This would typically check git status, file modifications, etc.
    // For now, return cached pending changes
    return this.syncState.pendingChanges;
  }

  /**
   * Detect conflicts between local and remote changes
   */
  async detectConflicts(remoteChanges: SyncChange[]): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    for (const remoteChange of remoteChanges) {
      const localChange = this.syncState.pendingChanges.find(
        (change) => change.id === remoteChange.id
      );

      if (localChange && localChange.hash !== remoteChange.hash) {
        conflicts.push({
          id: remoteChange.id,
          local: localChange,
          remote: remoteChange,
          type: 'modification'
        });
      }
    }

    return conflicts;
  }

  /**
   * Apply remote changes to local
   */
  async applyChanges(remoteChanges: SyncChange[], force = false): Promise<PullResult> {
    const applied: SyncChange[] = [];
    const failed: Array<{ change: SyncChange; reason?: string; error?: string }> = [];

    for (const change of remoteChanges) {
      try {
        // Resolve conflicts based on strategy
        if (this.syncState.conflicts.some((c) => c.id === change.id)) {
          const resolved = await this.resolveConflict(change, force);
          if (!resolved) {
            failed.push({ change, reason: 'Conflict not resolved' });
            continue;
          }
        }

        // Apply the change
        await this.applyChange(change);
        applied.push(change);
      } catch (error) {
        failed.push({ change, error: (error as Error).message });
      }
    }

    return {
      success: failed.length === 0,
      pulled: applied.length,
      applied: applied.length,
      failed: failed.length,
      details: { applied, failed }
    };
  }

  /**
   * Resolve a conflict based on strategy
   */
  async resolveConflict(remoteChange: SyncChange, force = false): Promise<boolean> {
    if (force) {
      return true; // Force always wins
    }

    switch (this.config.conflictResolution) {
      case 'local':
        return false; // Keep local, reject remote

      case 'remote':
        return true; // Accept remote, overwrite local

      case 'latest': {
        // Compare timestamps
        const conflict = this.syncState.conflicts.find(
          (c) => c.id === remoteChange.id
        );
        if (!conflict) return true;
        const remoteTime = new Date(remoteChange.timestamp || 0).getTime();
        const localTime = new Date(conflict.local.timestamp || 0).getTime();
        return remoteTime > localTime;
      }

      default:
        // Require manual resolution
        this.emit('conflictDetected', {
          id: remoteChange.id,
          remote: remoteChange,
          local: this.syncState.conflicts.find((c) => c.id === remoteChange.id)?.local
        });
        return false;
    }
  }

  /**
   * Apply a single change to local system
   */
  async applyChange(change: SyncChange): Promise<void> {
    // This would implement the actual application of the change
    // based on the change type (requirement, kanban, etc.)
    this.emit('changeApplied', change);
  }

  /**
   * Get sync status
   */
  async getStatus(): Promise<SyncStatus> {
    return {
      enabled: this.config.enabled,
      backend: this.config.backend,
      endpoint: this.config.endpoint,
      autoSync: this.config.autoSync,
      lastSync: this.lastSync,
      state: {
        ...this.syncState,
        backendStatus: this.backend ? await this.backend.getStatus() : null
      }
    };
  }

  /**
   * Add a change to pending sync
   */
  addPendingChange(change: SyncChange): void {
    // Add hash if not present
    if (!change.hash) {
      change.hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(change))
        .digest('hex');
    }

    this.syncState.pendingChanges.push(change);
    this.emit('changeQueued', change);
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    this.stopAutoSync();

    if (this.backend?.cleanup) {
      await this.backend.cleanup();
    }

    this.emit('cleanup');
  }
}

export default SyncManager;
module.exports = SyncManager;
