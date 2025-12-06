/**
 * Integration tests for MCP Server
 *
 * Note: These tests are simplified. Full integration tests require
 * the MCP server to be fully implemented and running.
 */

const path = require('node:path');

describe('MCP Server Integration', () => {
  describe('Server Module', () => {
    test('MCP server file exists', () => {
      const serverPath = path.join(__dirname, '../../lib/mcp-server/index.js');
      const fs = require('node:fs');
      expect(fs.existsSync(serverPath)).toBe(true);
    });

    test('Required tool modules exist', () => {
      const fs = require('node:fs');
      const toolsDir = path.join(__dirname, '../../lib/mcp-server/tools');

      const requiredTools = [
        'requirements.js',
        'kanban.js',
        'validation.js',
        'git.js',
        'agent.js',
        'rules.js'
      ];

      requiredTools.forEach((tool) => {
        const toolPath = path.join(toolsDir, tool);
        expect(fs.existsSync(toolPath)).toBe(true);
      });
    });

    test('Sync manager module exists', () => {
      const fs = require('node:fs');
      const syncPath = path.join(
        __dirname,
        '../../lib/mcp-server/sync/manager.js'
      );
      expect(fs.existsSync(syncPath)).toBe(true);
    });
  });

  describe('Tool Managers', () => {
    test('RequirementsManager can be imported', () => {
      const RequirementsManager = require('../../lib/mcp-server/tools/requirements');
      expect(RequirementsManager).toBeDefined();
      expect(typeof RequirementsManager).toBe('function');
    });

    test('KanbanManager can be imported', () => {
      const KanbanManager = require('../../lib/mcp-server/tools/kanban');
      expect(KanbanManager).toBeDefined();
      expect(typeof KanbanManager).toBe('function');
    });

    test('ValidationManager can be imported', () => {
      const ValidationManager = require('../../lib/mcp-server/tools/validation');
      expect(ValidationManager).toBeDefined();
      expect(typeof ValidationManager).toBe('function');
    });

    test('GitManager can be imported', () => {
      const GitManager = require('../../lib/mcp-server/tools/git');
      expect(GitManager).toBeDefined();
      expect(typeof GitManager).toBe('function');
    });

    test('AgentManager can be imported', () => {
      const AgentManager = require('../../lib/mcp-server/tools/agent');
      expect(AgentManager).toBeDefined();
      expect(typeof AgentManager).toBe('function');
    });

    test('RulesManager can be imported', () => {
      const RulesManager = require('../../lib/mcp-server/tools/rules');
      expect(RulesManager).toBeDefined();
      expect(typeof RulesManager).toBe('function');
    });
  });

  describe('Sync Module', () => {
    test('SyncManager can be imported', () => {
      const SyncManager = require('../../lib/mcp-server/sync/manager');
      expect(SyncManager).toBeDefined();
      expect(typeof SyncManager).toBe('function');
    });

    test('REST backend can be imported', () => {
      const RestBackend = require('../../lib/mcp-server/sync/backends/rest');
      expect(RestBackend).toBeDefined();
      expect(typeof RestBackend).toBe('function');
    });
  });

  describe('Tool Manager Instantiation', () => {
    test('RequirementsManager can be instantiated', () => {
      const RequirementsManager = require('../../lib/mcp-server/tools/requirements');
      const manager = new RequirementsManager('/test/project');
      expect(manager).toBeDefined();
      expect(manager.projectRoot).toBe('/test/project');
    });

    test('KanbanManager can be instantiated', () => {
      const KanbanManager = require('../../lib/mcp-server/tools/kanban');
      const manager = new KanbanManager('/test/project');
      expect(manager).toBeDefined();
      expect(manager.projectRoot).toBe('/test/project');
    });

    test('SyncManager can be instantiated', () => {
      const SyncManager = require('../../lib/mcp-server/sync/manager');
      const manager = new SyncManager({ enabled: false });
      expect(manager).toBeDefined();
      expect(manager.config).toBeDefined();
    });
  });
});

/**
 * Note: Full server startup and JSON-RPC protocol tests are skipped
 * because they require:
 * 1. Complete MCP server implementation
 * 2. Real project with requirements and kanban files
 * 3. MCP SDK properly configured
 *
 * These tests should be run manually or in a dedicated E2E test environment.
 */
