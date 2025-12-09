#!/usr/bin/env node

/**
 * Supernal Coding MCP Server
 *
 * Provides programmatic access to Supernal Coding functionality via
 * Model Context Protocol for Claude Code integration.
 *
 * @see https://modelcontextprotocol.io/
 * @see REQ-037: Auto-CSV workflow integration
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
  StdioServerTransport
} = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

// Import Supernal Coding modules
const RequirementsManager = require('./tools/requirements');
const KanbanManager = require('./tools/kanban');
const ValidationManager = require('./tools/validation');
const GitManager = require('./tools/git');
const AgentManager = require('./tools/agent');
const RulesManager = require('./tools/rules');
const SyncManager = require('./sync/manager');

/**
 * Supernal Coding MCP Server
 * Exposes tools and resources for Claude Code integration
 */
class SupernalCodingServer {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.config = null;
    this.syncManager = null;

    // Initialize managers
    this.requirements = new RequirementsManager(this.projectRoot);
    this.kanban = new KanbanManager(this.projectRoot);
    this.validation = new ValidationManager(this.projectRoot);
    this.git = new GitManager(this.projectRoot);
    this.agent = new AgentManager(this.projectRoot);
    this.rules = new RulesManager(this.projectRoot);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'supernal-coding-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );

    this.setupHandlers();
  }

  /**
   * Load project configuration
   */
  async loadConfig() {
    try {
      const { getConfig } = require('../scripts/config-loader');
      this.config = getConfig(this.projectRoot);
      this.config.load();

      // Initialize sync manager if configured
      if (this.config.sync?.enabled) {
        this.syncManager = new SyncManager(this.config.sync);
        await this.syncManager.initialize();
      }
    } catch (error) {
      console.error('Warning: Could not load configuration:', error.message);
      this.config = { sync: { enabled: false } };
    }
  }

  /**
   * Setup MCP request handlers
   */
  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Requirements tools
        {
          name: 'sc_req_list',
          description: 'List all requirements with optional filtering',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['Draft', 'In Progress', 'Review', 'Done']
              },
              epic: { type: 'string' },
              priority: {
                type: 'string',
                enum: ['Critical', 'High', 'Medium', 'Low']
              },
              category: { type: 'string' }
            }
          }
        },
        {
          name: 'sc_req_read',
          description: 'Read a specific requirement by ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Requirement ID (e.g., REQ-037)'
              }
            },
            required: ['id']
          }
        },
        {
          name: 'sc_req_validate',
          description: 'Validate requirement completeness and structure',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Requirement ID to validate' }
            },
            required: ['id']
          }
        },
        {
          name: 'sc_req_new',
          description: 'Create a new requirement',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              epic: { type: 'string' },
              priority: { type: 'string' },
              category: { type: 'string' },
              description: { type: 'string' }
            },
            required: ['title']
          }
        },

        // Kanban tools
        {
          name: 'sc_kanban_list',
          description: 'List tasks from kanban board',
          inputSchema: {
            type: 'object',
            properties: {
              board: {
                type: 'string',
                enum: [
                  'BRAINSTORM',
                  'PLANNING',
                  'TODO',
                  'DOING',
                  'BLOCKED',
                  'DONE',
                  'HANDOFFS'
                ],
                description: 'Specific board to list, or all if not specified'
              }
            }
          }
        },
        {
          name: 'sc_kanban_move',
          description: 'Move a task to a different board',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              to: {
                type: 'string',
                enum: [
                  'BRAINSTORM',
                  'PLANNING',
                  'TODO',
                  'DOING',
                  'BLOCKED',
                  'DONE',
                  'HANDOFFS'
                ]
              }
            },
            required: ['taskId', 'to']
          }
        },

        // Git tools
        {
          name: 'sc_git_status',
          description: 'Get git status with Supernal Coding context',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'sc_git_validate',
          description: 'Validate changes before commit',
          inputSchema: { type: 'object', properties: {} }
        },

        // Agent tools
        {
          name: 'sc_agent_handoff',
          description: 'Create agent handoff document',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              status: { type: 'string' },
              completed: { type: 'array', items: { type: 'string' } },
              remaining: { type: 'array', items: { type: 'string' } },
              context: { type: 'string' }
            },
            required: ['title']
          }
        },
        {
          name: 'sc_agent_status',
          description: 'Get current agent context and status',
          inputSchema: { type: 'object', properties: {} }
        },

        // Validation tools
        {
          name: 'sc_validate_all',
          description: 'Run all validation checks',
          inputSchema: {
            type: 'object',
            properties: {
              verbose: { type: 'boolean', default: false }
            }
          }
        },

        // Rules tools
        {
          name: 'sc_rules_active',
          description: 'Get currently active rules for context',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'File path to get applicable rules for'
              }
            }
          }
        },

        // Sync tools
        {
          name: 'sc_sync_status',
          description: 'Get synchronization status with higher-level systems',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'sc_sync_push',
          description: 'Push local changes to higher-level system',
          inputSchema: {
            type: 'object',
            properties: {
              force: { type: 'boolean', default: false }
            }
          }
        },
        {
          name: 'sc_sync_pull',
          description: 'Pull updates from higher-level system',
          inputSchema: {
            type: 'object',
            properties: {
              force: { type: 'boolean', default: false }
            }
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;

        switch (name) {
          // Requirements
          case 'sc_req_list':
            result = await this.requirements.list(args);
            break;
          case 'sc_req_read':
            result = await this.requirements.read(args.id);
            break;
          case 'sc_req_validate':
            result = await this.requirements.validate(args.id);
            break;
          case 'sc_req_new':
            result = await this.requirements.create(args);
            break;

          // Kanban
          case 'sc_kanban_list':
            result = await this.kanban.list(args.board);
            break;
          case 'sc_kanban_move':
            result = await this.kanban.move(args.taskId, args.to);
            break;

          // Git
          case 'sc_git_status':
            result = await this.git.status();
            break;
          case 'sc_git_validate':
            result = await this.git.validate();
            break;

          // Agent
          case 'sc_agent_handoff':
            result = await this.agent.createHandoff(args);
            break;
          case 'sc_agent_status':
            result = await this.agent.getStatus();
            break;

          // Validation
          case 'sc_validate_all':
            result = await this.validation.validateAll(args.verbose);
            break;

          // Rules
          case 'sc_rules_active':
            result = await this.rules.getActive(args.filePath);
            break;

          // Sync
          case 'sc_sync_status':
            result = await this.getSyncStatus();
            break;
          case 'sc_sync_push':
            result = await this.syncPush(args.force);
            break;
          case 'sc_sync_pull':
            result = await this.syncPull(args.force);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'requirements://list',
          name: 'All Requirements',
          description: 'Complete list of all requirements',
          mimeType: 'application/json'
        },
        {
          uri: 'kanban://boards',
          name: 'Kanban Boards',
          description: 'All kanban boards with tasks',
          mimeType: 'application/json'
        },
        {
          uri: 'rules://active',
          name: 'Active Rules',
          description: 'Currently active cursor rules',
          mimeType: 'application/json'
        },
        {
          uri: 'config://current',
          name: 'Current Configuration',
          description: 'Current project configuration',
          mimeType: 'application/json'
        },
        {
          uri: 'sync://status',
          name: 'Sync Status',
          description: 'Synchronization status with higher-level systems',
          mimeType: 'application/json'
        }
      ]
    }));

    // Read resources
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        try {
          let content;

          if (uri === 'requirements://list') {
            content = await this.requirements.list();
          } else if (uri === 'kanban://boards') {
            content = await this.kanban.getAllBoards();
          } else if (uri === 'rules://active') {
            content = await this.rules.getActive();
          } else if (uri === 'config://current') {
            content = this.config;
          } else if (uri === 'sync://status') {
            content = await this.getSyncStatus();
          } else {
            throw new Error(`Unknown resource: ${uri}`);
          }

          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(content, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new Error(`Failed to read resource ${uri}: ${error.message}`);
        }
      }
    );
  }

  /**
   * Get synchronization status
   */
  async getSyncStatus() {
    if (!this.syncManager) {
      return {
        enabled: false,
        message: 'Synchronization is not configured'
      };
    }

    return await this.syncManager.getStatus();
  }

  /**
   * Push changes to higher-level system
   */
  async syncPush(force = false) {
    if (!this.syncManager) {
      throw new Error('Synchronization is not configured');
    }

    return await this.syncManager.push(force);
  }

  /**
   * Pull updates from higher-level system
   */
  async syncPull(force = false) {
    if (!this.syncManager) {
      throw new Error('Synchronization is not configured');
    }

    return await this.syncManager.pull(force);
  }

  /**
   * Start the MCP server
   */
  async start() {
    await this.loadConfig();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Supernal Coding MCP Server running on stdio');
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new SupernalCodingServer();
  server.start().catch((error) => {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  });
}

module.exports = SupernalCodingServer;
