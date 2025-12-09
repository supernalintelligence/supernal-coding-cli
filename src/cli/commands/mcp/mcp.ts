#!/usr/bin/env node
/**
 * Supernal Coding MCP Server
 * Provides MCP (Model Context Protocol) server functionality for supernal-coding tools
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');
const _fs = require('fs-extra');
const _path = require('node:path');
const chalk = require('chalk');

class SupernalCodingMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'supernal-coding',
        version: '1.0.0',
        description:
          'Supernal Coding development tools and workflow automation',
      },
      {
        capabilities: {
          tools: {
            listChanged: true,
          },
          resources: {
            subscribe: true,
            listChanged: true,
          },
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // Tool: Create new requirement
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'create-requirement':
          return await this.createRequirement(args);
        case 'list-requirements':
          return await this.listRequirements(args);
        case 'validate-requirement':
          return await this.validateRequirement(args);
        case 'init-project':
          return await this.initProject(args);
        case 'git-smart-status':
          return await this.gitSmartStatus(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List available tools
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'create-requirement',
            description: 'Create a new requirement using sc req new',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Requirement title' },
                epic: { type: 'string', description: 'Epic name' },
                priority: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Priority level',
                },
              },
              required: ['title', 'epic'],
            },
          },
          {
            name: 'list-requirements',
            description: 'List all requirements',
            inputSchema: {
              type: 'object',
              properties: {
                status: { type: 'string', description: 'Filter by status' },
              },
            },
          },
          {
            name: 'validate-requirement',
            description: 'Validate a requirement',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Requirement ID (e.g., REQ-001)',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'init-project',
            description: 'Initialize supernal-coding in a project',
            inputSchema: {
              type: 'object',
              properties: {
                preset: {
                  type: 'string',
                  enum: ['standard', 'development', 'minimal'],
                  description: 'Installation preset',
                },
                overwrite: {
                  type: 'boolean',
                  description: 'Overwrite existing files',
                },
              },
            },
          },
          {
            name: 'git-smart-status',
            description: 'Get git smart status and recommendations',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Resource handlers for project files
    this.server.setRequestHandler('resources/list', async () => {
      return {
        resources: [
          {
            uri: 'file://requirements',
            name: 'Requirements',
            description: 'Project requirements',
            mimeType: 'application/json',
          },
          {
            uri: 'file://config',
            name: 'Supernal Config',
            description: 'Supernal coding configuration',
            mimeType: 'application/json',
          },
        ],
      };
    });
  }

  async createRequirement(args) {
    const { execSync } = require('node:child_process');
    try {
      const { title, epic, priority = 'medium' } = args;
      const command = `sc req new "${title}" --epic=${epic} --priority=${priority}`;
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
      });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Requirement created successfully!\n\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error creating requirement: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listRequirements(args) {
    const { execSync } = require('node:child_process');
    try {
      const statusFilter = args.status ? ` --status=${args.status}` : '';
      const command = `sc req list${statusFilter}`;
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
      });

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error listing requirements: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async validateRequirement(args) {
    const { execSync } = require('node:child_process');
    try {
      const { id } = args;
      const command = `sc req validate ${id}`;
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
      });

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error validating requirement: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async initProject(args) {
    const { execSync } = require('node:child_process');
    try {
      const { preset = 'standard', overwrite = false } = args;
      const overwriteFlag = overwrite ? ' --overwrite' : '';
      const command = `sc init --${preset}${overwriteFlag}`;
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
      });

      return {
        content: [
          {
            type: 'text',
            text: `✅ Project initialized successfully!\n\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error initializing project: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async gitSmartStatus(_args) {
    const { execSync } = require('node:child_process');
    try {
      const command = 'sc git-smart status';
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: process.cwd(),
      });

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error getting git status: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log startup (to stderr so it doesn't interfere with MCP protocol)
    console.error(chalk.green('🚀 Supernal Coding MCP Server started'));
    console.error(
      chalk.gray(
        '   Available tools: create-requirement, list-requirements, validate-requirement, init-project, git-smart-status'
      )
    );
  }
}

// Export for testing
module.exports = SupernalCodingMCPServer;

// Start server if run directly
if (require.main === module) {
  const server = new SupernalCodingMCPServer();
  server.start().catch((error) => {
    console.error(chalk.red('❌ MCP Server error:'), error);
    process.exit(1);
  });
}
