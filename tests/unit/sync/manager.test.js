/**
 * Unit tests for SyncManager
 *
 * Note: These are basic tests with mocked backends.
 * Full integration tests require a real sync backend.
 */

const SyncManager = require('../../../lib/mcp-server/sync/manager');
const EventEmitter = require('node:events');

describe('SyncManager', () => {
  let syncManager;
  let _mockBackend;

  beforeEach(() => {
    // Create mock backend
    _mockBackend = {
      initialize: jest.fn().mockResolvedValue(true),
      push: jest.fn().mockResolvedValue({ success: true, pushed: 5 }),
      pull: jest.fn().mockResolvedValue([]),
      getStatus: jest.fn().mockResolvedValue({ connected: true }),
      health: jest.fn().mockResolvedValue({ healthy: true })
    };

    // Create sync manager with test configuration
    syncManager = new SyncManager({
      enabled: true,
      backend: 'rest',
      endpoint: 'http://localhost:3000',
      apiKey: 'test-api-key',
      autoSync: false,
      syncInterval: 60000,
      conflictResolution: 'manual'
    });
  });

  afterEach(() => {
    if (syncManager?.stopAutoSync) {
      syncManager.stopAutoSync();
    }
  });

  describe('Constructor', () => {
    test('initializes with configuration', () => {
      expect(syncManager).toBeDefined();
      expect(syncManager.config.enabled).toBe(true);
      expect(syncManager.config.backend).toBe('rest');
      expect(syncManager.config.conflictResolution).toBe('manual');
    });

    test('extends EventEmitter', () => {
      expect(syncManager).toBeInstanceOf(EventEmitter);
    });

    test('has default configuration values', () => {
      const defaultManager = new SyncManager();
      expect(defaultManager.config.enabled).toBe(false);
      expect(defaultManager.config.syncInterval).toBe(60000);
      expect(defaultManager.config.conflictResolution).toBe('manual');
    });
  });

  describe('getStatus()', () => {
    test('returns sync configuration', async () => {
      const status = await syncManager.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('backend');
      expect(status).toHaveProperty('autoSync');
      expect(status).toHaveProperty('state');
      expect(status.enabled).toBe(true);
    });

    test('includes sync state information', async () => {
      const status = await syncManager.getStatus();

      expect(status.state).toHaveProperty('inProgress');
      expect(status.state).toHaveProperty('lastPush');
      expect(status.state).toHaveProperty('lastPull');
      expect(status.state).toHaveProperty('conflicts');
      expect(status.state).toHaveProperty('pendingChanges');
    });
  });

  describe('addPendingChange()', () => {
    test('adds change to pending queue', () => {
      const change = {
        type: 'requirement',
        action: 'update',
        id: 'REQ-037',
        data: { status: 'Review' }
      };

      syncManager.addPendingChange(change);

      // Check directly in syncState
      expect(syncManager.syncState.pendingChanges.length).toBe(1);
      expect(syncManager.syncState.pendingChanges[0].id).toBe('REQ-037');
    });

    test('automatically adds hash to changes', () => {
      const change = {
        type: 'requirement',
        action: 'update',
        id: 'REQ-037',
        data: { status: 'Review' }
      };

      syncManager.addPendingChange(change);

      expect(syncManager.syncState.pendingChanges[0]).toHaveProperty('hash');
      expect(typeof syncManager.syncState.pendingChanges[0].hash).toBe(
        'string'
      );
    });
  });

  describe('Event handling', () => {
    test('supports on() and off() for event listeners', () => {
      const handler = jest.fn();

      syncManager.on('syncCompleted', handler);
      syncManager.emit('syncCompleted', { success: true });

      expect(handler).toHaveBeenCalledWith({ success: true });

      syncManager.off('syncCompleted', handler);
      syncManager.emit('syncCompleted', { success: true });

      // Should only be called once (before removal)
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration validation', () => {
    test('handles disabled sync', () => {
      const disabledManager = new SyncManager({ enabled: false });
      expect(disabledManager.config.enabled).toBe(false);
    });

    test('accepts different conflict resolution strategies', () => {
      const strategies = ['manual', 'local', 'remote', 'latest'];

      strategies.forEach((strategy) => {
        const manager = new SyncManager({
          enabled: true,
          conflictResolution: strategy
        });
        expect(manager.config.conflictResolution).toBe(strategy);
      });
    });
  });
});
