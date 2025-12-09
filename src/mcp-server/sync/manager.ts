/**
 * Synchronization Manager
 *
 * Handles bidirectional sync between Supernal Coding and higher-level systems.
 * Supports multiple sync backends (REST API, GraphQL, WebSocket, etc.)
 *
 * @module sync/manager
 */

const _fs = require('fs-extra');
const _path = require('node:path');
const crypto = require('node:crypto');
const EventEmitter = require('node:events');

/**
 * Sync Manager for higher-level system integration
 */
class SyncManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      enabled: config.enabled || false,
      backend: config.backend || 'rest', // 'rest', 'graphql', 'websocket', 'custom'
      endpoint: config.endpoint || null,
      apiKey: config.apiKey || null,
      syncInterval: config.syncInterval || 60000, // 1 minute
      autoSync: config.autoSync || false,
      conflictResolution: config.conflictResolution || 'manual', // 'manual', 'local', 'remote', 'latest'
      customBackend: config.customBackend || null,
      ...config
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
  async initialize() {
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

    await this.backend.initialize();

    // Set up auto-sync if enabled
    if (this.config.autoSync) {
      this.startAutoSync();
    }

    this.emit('initialized');
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync() {
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
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.emit('autoSyncStopped');
    }
  }

  /**
   * Perform bidirectional sync
   */
  async sync() {
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
  async push(force = false) {
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
      const result = await this.backend.push(changes, force);

      // Update sync state
      this.syncState.lastPush = new Date();
      this.syncState.pendingChanges = this.syncState.pendingChanges.filter(
        (change) => !result.pushed.includes(change.id)
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
  async pull(force = false) {
    this.emit('pullStarted');

    try {
      // Get remote changes
      const remoteChanges = await this.backend.pull();

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
  async getPendingChanges() {
    // This would typically check git status, file modifications, etc.
    // For now, return cached pending changes
    return this.syncState.pendingChanges;
  }

  /**
   * Detect conflicts between local and remote changes
   */
  async detectConflicts(remoteChanges) {
    const conflicts = [];

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
  async applyChanges(remoteChanges, force = false) {
    const applied = [];
    const failed = [];

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
        failed.push({ change, error: error.message });
      }
    }

    return {
      success: failed.length === 0,
      applied: applied.length,
      failed: failed.length,
      details: { applied, failed }
    };
  }

  /**
   * Resolve a conflict based on strategy
   */
  async resolveConflict(remoteChange, force = false) {
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
        return remoteChange.timestamp > conflict.local.timestamp;
      }
      default:
        // Require manual resolution
        this.emit('conflictDetected', {
          id: remoteChange.id,
          remote: remoteChange,
          local: this.syncState.conflicts.find((c) => c.id === remoteChange.id)
            .local
        });
        return false;
    }
  }

  /**
   * Apply a single change to local system
   */
  async applyChange(change) {
    // This would implement the actual application of the change
    // based on the change type (requirement, kanban, etc.)
    this.emit('changeApplied', change);
  }

  /**
   * Get sync status
   */
  async getStatus() {
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
  addPendingChange(change) {
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
  async cleanup() {
    this.stopAutoSync();

    if (this.backend?.cleanup) {
      await this.backend.cleanup();
    }

    this.emit('cleanup');
  }
}

module.exports = SyncManager;
