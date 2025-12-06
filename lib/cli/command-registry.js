/**
 * Command Registry for lazy loading SC CLI commands
 * This registry stores command metadata without loading the actual command modules
 * until they are needed, significantly improving CLI startup performance.
 */

const path = require('node:path');
const { getCommandForRegistry } = require('./command-metadata');

class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.commandsDir = path.join(__dirname, 'commands');
    this.scriptsDir = path.join(__dirname, '..', 'scripts');
    this.initialized = false;
  }

  /**
   * Initialize the command registry with metadata only
   * This loads no actual command modules, just their definitions
   */
  initialize() {
    if (this.initialized) return;

    // Define all commands with their metadata but no actual module loading
    this.registerCommand('validate-installation', {
      alias: 'validate',
      description: 'Validate current installation',
      options: [
        ['-v, --verbose', 'Show detailed validation information'],
        ['--requirements', 'Validate requirements files'],
        ['--tests', 'Validate test files'],
        ['--config', 'Validate configuration'],
        ['--all', 'Validate everything']
      ],
      modulePath: path.join(this.commandsDir, 'development', 'validate')
    });

    this.registerCommand('generate', {
      description: 'Generate project files and documentation',
      options: [
        ['--templates', 'Generate from templates'],
        ['--docs', 'Generate documentation'],
        ['--workflows', 'Generate workflow templates']
      ],
      modulePath: path.join(this.commandsDir, 'development', 'generate')
    });

    this.registerCommand('deploy', {
      description: 'Deploy project components',
      options: [],
      modulePath: path.join(this.commandsDir, 'deployment', 'deploy')
    });

    this.registerCommand('agent', {
      description: 'Agent workflow management',
      options: [
        ['-c, --config <file>', 'Configuration file path'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'agent', 'agent')
    });

    this.registerCommand('requirement', {
      alias: 'req',
      description: 'Requirement management system with API-like interface',
      options: [
        ['-f, --format <type>', 'Output format (json, table, csv)'],
        ['-v, --verbose', 'Verbose output'],
        ['--no-color', 'Disable colored output']
      ],
      arguments: ['[action]', '[...args]'],
      modulePath: path.join(this.commandsDir, 'requirement')
    });

    this.registerCommand('traceability', {
      alias: 'trace',
      description:
        'Traceability matrix for compliance and requirement tracking',
      options: [
        ['-f, --format <type>', 'Output format (json, html, csv)'],
        ['-o, --output <path>', 'Output file or directory'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[action]', '[...args]'],
      modulePath: path.join(this.commandsDir, 'traceability')
    });

    this.registerCommand('priority', {
      description: 'Priority management for requirements and tasks',
      options: [
        ['-f, --format <type>', 'Output format (json, table, csv)'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[action]', '[...args]'],
      modulePath: path.join(this.commandsDir, 'kanban', 'priority')
    });

    this.registerCommand('phase', {
      description: 'Development phase management and tracking',
      options: [
        ['-f, --format <type>', 'Output format (json, table, csv)'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[action]', '[...args]'],
      modulePath: path.join(this.commandsDir, 'phase')
    });

    this.registerCommand('dashboard', {
      description: 'Project dashboard for requirements and progress tracking',
      options: [
        ['-p, --port <number>', 'Port number (default: 3000)'],
        ['--open', 'Open browser automatically'],
        ['--no-browser', "Don't open browser"],
        [
          '--kill-conflicts',
          'Kill processes using conflicting ports before starting'
        ],
        ['--docs-port <port>', 'Port for documentation server (default: 3003)'],
        ['--api-port <port>', 'Port for API server (default: 3001)'],
        [
          '--dashboard-port <port>',
          'Port for dashboard server (default: 3002)'
        ],
        ['--host <host>', 'Host to bind server to (default: localhost)'],
        ['-y, --yes', 'Skip prompts and use defaults'],
        ['--force', 'Overwrite existing dashboard files'],
        ['--upgrade', 'Upgrade existing dashboard to latest template version'],
        ['--dry-run', 'Show what would change without making changes'],
        [
          '--template <type>',
          'Dashboard template type: "static" (default) or "dashboard-v2" (Next.js)'
        ],
        [
          '--disable-embedded',
          'Disable embedded dashboard in documentation (for deployments)'
        ],
        ['--github-pages', 'Deploy to GitHub Pages'],
        ['--vercel', 'Deploy to Vercel'],
        ['--output <dir>', 'Output directory (default: docs)']
      ],
      arguments: ['[action]', '[ports...]'],
      modulePath: path.join(this.commandsDir, 'dashboard')
    });

    this.registerCommand('git-smart', {
      description: 'Smart git workflow utilities',
      options: [
        ['-v, --verbose', 'Verbose output'],
        ['--dry-run', 'Show what would be done without executing']
      ],
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'git', 'git-smart')
    });

    this.registerCommand('merge-safe', {
      alias: 'merge',
      description: 'Safe merge with rebase and validation',
      options: [
        ['--no-rebase', 'Skip rebase step'],
        ['--force', 'Force merge even with conflicts'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[branch]'],
      modulePath: path.join(this.commandsDir, 'git', 'merge-safe')
    });

    this.registerCommand('fix-frontmatter', {
      description: 'Auto-fix common frontmatter issues in requirement files',
      options: [],
      modulePath: path.join(this.commandsDir, 'validation', 'fix-frontmatter')
    });

    this.registerCommand('type-check', {
      description: 'Detect and prevent TypeScript/JavaScript type duplications',
      options: [
        ['-f, --fix', 'Automatically fix detected issues'],
        ['--report', 'Generate detailed report']
      ],
      modulePath: path.join(this.commandsDir, 'type-check')
    });

    this.registerCommand('check-upgrade', {
      description: 'Check for available upgrades of supernal-code',
      options: [
        ['--force', 'Force check even if recently checked'],
        ['--json', 'Output in JSON format']
      ],
      modulePath: path.join(this.commandsDir, 'maintenance', 'check-upgrade')
    });

    this.registerCommand('upgrade', {
      description: 'Upgrade supernal-code to the latest version',
      options: [
        ['--force', 'Force upgrade without confirmation'],
        ['--beta', 'Install beta version']
      ],
      modulePath: path.join(this.commandsDir, 'maintenance', 'upgrade')
    });

    this.registerCommand('cleanup', {
      description:
        'Repository structure and documentation cleanup with staging queue',
      arguments: ['[action]'],
      options: [
        ['--auto-fix', 'Automatically fix issues'],
        ['--auto-stage', 'Move problematic files to cleanup-queue for review'],
        ['--interactive', 'Review each change interactively'],
        ['--dry-run', 'Show what would be done without making changes'],
        ['--skip-docs', 'Skip documentation structure checks'],
        ['--skip-structure', 'Skip directory structure validation'],
        [
          '--validate-naming',
          'Enable file naming validation (REQ-VALIDATION-001)'
        ],
        ['--check-links', 'Check for broken markdown links'],
        ['--find-orphans', 'Find orphaned files with no references'],
        ['--all', 'Enable all checks']
      ],
      modulePath: path.join(this.commandsDir, 'maintenance', 'cleanup-unified')
    });

    this.registerCommand('kanban', {
      description: 'Kanban task management system',
      options: [
        ['-f, --format <type>', 'Output format (json, table, csv)'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[action]', '[...args]'],
      modulePath: path.join(this.commandsDir, 'kanban', 'kanban')
    });

    // New reference-based Kanban system (can coexist with legacy)
    this.registerCommand('kanban-ref', {
      alias: 'kb',
      description: 'Reference-based Kanban board management',
      arguments: ['[action]', '[...args]'],
      modulePath: path.join(
        this.commandsDir,
        'kanban',
        'KanbanReferenceHandler'
      )
    });

    this.registerCommand('business-plan', {
      alias: 'bp',
      description: 'Business plan management and tracking',
      arguments: ['[action]', '[...args]'],
      modulePath: path.join(this.commandsDir, 'business-plan', 'index')
    });

    // DEPRECATED: 'solutions' command removed 2025-12-02
    // Replaced by: sc traceability
    // See: archive/deprecated-solutions/README.md

    this.registerCommand('workflow', {
      description: 'Project workflow management',
      options: [
        ['-t, --template <name>', 'Workflow template to use'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[action]', '[...args]'],
      modulePath: path.join(this.commandsDir, 'workflow', 'workflow')
    });

    this.registerCommand('docs', {
      description: 'Documentation management system',
      options: [
        ['--build', 'Build documentation'],
        ['--serve', 'Serve documentation locally'],
        ['-p, --port <number>', 'Port for serving (default: 3001)'],
        ['--cleanup', 'Scan and cleanup documentation structure (ADR-001)'],
        ['--auto-fix', 'Automatically fix documentation issues'],
        ['--interactive', 'Review each change interactively'],
        ['--dry-run', 'Show what would be done without making changes']
      ],
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'documentation', 'docs')
    });

    // Use centralized metadata for DRY principle
    this.registerCommandFromMetadata(
      'init',
      path.join(this.commandsDir, 'init')
    );

    this.registerCommand('suggest', {
      description: 'Instantly create GitHub issues with context',
      arguments: ['<feedback>', '[...args]'],
      modulePath: path.join(this.commandsDir, 'feedback', 'suggest')
    });

    this.registerCommand('handoff', {
      description: 'Manage agent handoffs with proper naming conventions',
      options: [
        ['-t, --type <type>', 'Handoff type'],
        ['-p, --priority <level>', 'Priority level']
      ],
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'workflow', 'handoff')
    });

    // Use centralized metadata for DRY principle
    this.registerCommandFromMetadata(
      'test',
      path.join(this.commandsDir, 'testing', 'test-command')
    );

    this.registerCommand('test-map', {
      alias: 'tmap',
      description: 'Generate comprehensive test mapping and analysis',
      options: [
        ['--output <file>', 'Output file path'],
        ['--format <type>', 'Output format (json, html, markdown)']
      ],
      modulePath: path.join(this.commandsDir, 'testing', 'test-map')
    });

    this.registerCommand('guard', {
      description: 'Development workflow guard and validation system',
      options: [
        ['--strict', 'Strict validation mode'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'workflow', 'guard')
    });

    this.registerCommand('git-protect', {
      description:
        'Install enhanced git workflow protection (prevents git add on main)',
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'git', 'git-protect')
    });

    this.registerCommand('dev', {
      description: 'Development tools and utilities',
      options: [
        ['-e, --environment <env>', 'Environment to use'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['<action>'],
      modulePath: path.join(this.commandsDir, 'development', 'dev')
    });

    this.registerCommand('rules', {
      description: 'Discover and manage repository rules',
      options: [
        ['--scan', 'Scan for rule files'],
        ['--validate', 'Validate existing rules'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'rules', 'rules')
    });

    this.registerCommand('monitor', {
      alias: 'status',
      description:
        'Monitor development status and CI/CD workflows with intelligent diagnostics',
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'development', 'monitor')
    });

    this.registerCommand('git-hooks', {
      description: 'Git hooks management and installation',
      arguments: ['<action>'],
      modulePath: path.join(this.commandsDir, 'git', 'git-hooks')
    });

    this.registerCommand('git-assess', {
      alias: 'assess',
      description: 'Comprehensive git repository assessment and analysis',
      options: [
        ['--detailed', 'Detailed analysis'],
        ['--format <type>', 'Output format (json, table, markdown)']
      ],
      modulePath: path.join(this.commandsDir, 'git', 'git-assess')
    });

    this.registerCommand('init-req-tracking', {
      alias: 'init-tracking',
      description:
        'Initialize git tracking metadata for all requirement markdown files',
      options: [
        ['--force', 'Force initialization'],
        ['-v, --verbose', 'Verbose output']
      ],
      modulePath: path.join(
        this.commandsDir,
        'git',
        'init-requirements-tracking'
      )
    });

    this.registerCommand('git-validate', {
      alias: 'git-check',
      description:
        'Validate git workflow compliance (branch naming, commit messages)',
      arguments: ['[type]', '[value]'],
      modulePath: path.join(this.commandsDir, 'git', 'git-validate')
    });

    this.registerCommand('update', {
      description: 'Update the global sc package installation',
      options: [
        ['--force', 'Force update'],
        ['--beta', 'Update to beta version']
      ],
      arguments: ['[action]'],
      modulePath: path.join(this.commandsDir, 'maintenance', 'update')
    });

    // Use centralized metadata for DRY principle
    this.registerCommandFromMetadata(
      'sync',
      path.join(this.commandsDir, 'maintenance', 'sync')
    );

    this.registerCommand('config', {
      description: 'Manage Supernal Coding configuration and privacy settings',
      options: [
        ['--global', 'Global configuration'],
        ['--local', 'Local configuration'],
        ['-v, --verbose', 'Verbose output']
      ],
      arguments: ['[category]'],
      modulePath: path.join(this.commandsDir, 'setup', 'config')
    });

    this.registerCommand('help', {
      description: 'Show comprehensive help',
      modulePath: path.join(this.commandsDir, 'help', 'help')
    });

    this.registerCommand('mcp', {
      description: 'Start the Supernal Coding MCP server',
      modulePath: path.join(this.commandsDir, 'mcp', 'mcp')
    });

    this.initialized = true;
  }

  /**
   * Register a command with its metadata
   */
  registerCommand(name, config) {
    this.commands.set(name, {
      name,
      alias: config.alias,
      description: config.description,
      options: config.options || [],
      arguments: config.arguments || [],
      modulePath: config.modulePath
    });
  }

  /**
   * Register command using centralized metadata
   */
  registerCommandFromMetadata(name, modulePath, overrides = {}) {
    const metadata = getCommandForRegistry(name);
    if (!metadata) {
      throw new Error(`No metadata found for command: ${name}`);
    }

    this.registerCommand(name, {
      description: metadata.description,
      options: metadata.options,
      arguments: metadata.arguments,
      modulePath,
      ...overrides
    });
  }

  /**
   * Get command metadata without loading the module
   */
  getCommand(name) {
    return this.commands.get(name);
  }

  /**
   * Get all registered commands
   */
  getAllCommands() {
    return Array.from(this.commands.values());
  }

  /**
   * Load and execute a command module
   */
  async loadCommand(name) {
    const command = this.getCommand(name);
    if (!command) {
      throw new Error(`Command '${name}' not found in registry`);
    }

    try {
      // Lazy load the actual command module
      const commandModule = require(command.modulePath);
      return commandModule;
    } catch (error) {
      throw new Error(`Failed to load command '${name}': ${error.message}`);
    }
  }

  /**
   * Create a lazy-loading action handler for a command
   */
  createLazyAction(commandName) {
    return async (...args) => {
      const commandModule = await this.loadCommand(commandName);

      // Extract actual arguments from Commander.js context
      // args[0] = action, args[1] = options, args[2] = command object
      let cleanArgs = [];
      let action = null;
      let options = {};

      if (args.length > 0) {
        // First argument is usually the action
        action = args[0];

        // Look for Command object to get options
        const commandObj = args.find(
          (arg) => arg?.constructor && arg.constructor.name === 'Command'
        );

        if (commandObj && typeof commandObj.opts === 'function') {
          options = commandObj.opts();
        }

        // Second argument might be options object (fallback)
        if (
          Object.keys(options).length === 0 &&
          args.length > 1 &&
          typeof args[1] === 'object' &&
          !args[1].commands
        ) {
          options = args[1];
        }

        // Extract command arguments from the command object if present
        if (commandObj?.args && Array.isArray(commandObj.args)) {
          // Skip the first arg which is the action we already have
          cleanArgs = commandObj.args
            .slice(1)
            .filter((arg) => arg !== undefined);
        }
      }

      // Handle different module export patterns
      if (typeof commandModule === 'function') {
        return await commandModule(action, options);
      } else if (
        commandModule.default &&
        typeof commandModule.default === 'function'
      ) {
        return await commandModule.default(action, options);
      } else if (
        commandModule.handler &&
        typeof commandModule.handler === 'function'
      ) {
        return await commandModule.handler(action, options);
      } else if (
        commandModule.handleRequirementCommand &&
        typeof commandModule.handleRequirementCommand === 'function'
      ) {
        return await commandModule.handleRequirementCommand(action, options);
      } else if (
        commandModule.handleTraceabilityCommand &&
        typeof commandModule.handleTraceabilityCommand === 'function'
      ) {
        return await commandModule.handleTraceabilityCommand(action, options);
      } else if (
        commandModule.handleDashboardCommand &&
        typeof commandModule.handleDashboardCommand === 'function'
      ) {
        return await commandModule.handleDashboardCommand(action, options);
      } else if (
        commandModule.handleKanbanCommand &&
        typeof commandModule.handleKanbanCommand === 'function'
      ) {
        return await commandModule.handleKanbanCommand(action, ...cleanArgs);
      } else if (
        commandModule.handleBusinessPlanCommand &&
        typeof commandModule.handleBusinessPlanCommand === 'function'
      ) {
        return await commandModule.handleBusinessPlanCommand(
          action,
          ...cleanArgs
        );
        // DEPRECATED: handleSolutionsCommand removed 2025-12-02
      } else {
        throw new Error(
          `Command module '${commandName}' does not export a valid handler function`
        );
      }
    };
  }
}

module.exports = CommandRegistry;
