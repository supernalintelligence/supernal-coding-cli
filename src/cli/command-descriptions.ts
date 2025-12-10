interface ActionDescriptions {
  [actionName: string]: string;
}

interface CommandDescription {
  description: string;
  actions: ActionDescriptions;
}

interface CommandDescriptions {
  [commandName: string]: CommandDescription;
}

interface CommandData {
  name: string;
  description?: string;
  actions?: string[];
  actionDetails?: Array<{ name: string; description: string }>;
}

const COMMAND_DESCRIPTIONS: CommandDescriptions = {
  requirement: {
    description:
      'Create, validate, and manage software requirements with Gherkin specifications',
    actions: {
      new: 'Create a new requirement with frontmatter, Gherkin specs, and test scaffolding',
      list: 'List all requirements with optional filtering by status, epic, or priority',
      show: 'Display detailed information about a specific requirement',
      update: 'Update requirement status, priority, or other metadata',
      delete: 'Remove a requirement (use --force for permanent deletion)',
      validate:
        'Check requirement for completeness, valid frontmatter, and Gherkin syntax',
      'generate-tests':
        'Create test scaffolding (E2E, unit, fixtures) from Gherkin scenarios',
      'start-work':
        'Begin working on a requirement: creates branch, updates status to in-progress',
      search: 'Search requirements by title, content, or metadata',
      'create-sub': 'Create a sub-requirement linked to a parent requirement',
      'list-subs': 'List all sub-requirements for a parent requirement',
      'convert-to-folder':
        'Convert a single-file requirement to a folder with sub-requirements',
    },
  },

  'git-smart': {
    description:
      'Intelligent Git workflow automation with requirement traceability',
    actions: {
      branch:
        'Create a feature branch linked to a requirement (feature/req-XXX-title)',
      'check-branch': 'Verify current branch naming and requirement linkage',
      'check-context':
        'Pre-merge checks: clean working tree, tests passing, on correct branch',
      merge: 'Safe merge to main with optional push and local branch cleanup',
      deploy:
        'Deploy to staging or production with version tagging and validation',
    },
  },

  feature: {
    description:
      'Manage feature lifecycle using the feature-by-phase documentation system',
    actions: {
      create:
        'Create a new feature folder structure with README, planning/, design/, implementation/',
      validate: 'Check feature folder structure and documentation completeness',
      move: 'Move a feature between domains or rename it',
      sync: 'Synchronize feature documentation with requirement changes',
    },
  },

  wip: {
    description:
      'Track work-in-progress files to prevent untracked file accumulation',
    actions: {
      register:
        'Mark a file as work-in-progress with feature/requirement association',
      unregister: 'Remove a file from WIP tracking (after commit or discard)',
      list: 'Show all WIP-tracked files grouped by feature',
      status:
        'Check for untracked files that should be WIP-tracked or committed',
      touch: 'Update timestamp on WIP file (extend tracking)',
      cleanup: 'Remove stale WIP entries older than threshold',
      check: 'Pre-commit check: block if too many untracked files',
      stats: 'Show WIP registry statistics',
      reassign: 'Reassign WIP file to different user or feature',
    },
  },

  fbc: {
    description:
      'Feature-based commits: group commits by feature for traceability',
    actions: {
      add: 'Add a feature to the feature registry',
      list: 'List all registered features',
      show: 'Show details for a specific feature',
      commits: 'List commits associated with a feature',
      complete: 'Mark a feature as complete',
    },
  },

  validate: {
    description: 'Validate project structure, requirements, and configuration',
    actions: {},
  },

  test: {
    description: 'Run and manage tests with requirement coverage tracking',
    actions: {},
  },

  'type-check': {
    description:
      'Detect type duplications and inconsistencies across the codebase',
    actions: {},
  },

  'git-hooks': {
    description: 'Manage Git hooks for automated quality checks',
    actions: {
      install: 'Install Husky hooks for pre-commit and pre-push validation',
      'pre-commit': 'Run pre-commit checks manually',
      'pre-push': 'Run pre-push checks manually',
      safety: 'Check hook installation status',
      status: 'Show current hook configuration',
    },
  },

  docs: {
    description:
      'Documentation management: validate, sync templates, fix links',
    actions: {
      validate: 'Check documentation structure and template compliance',
      'merge-templates': 'Sync templates preserving approval history',
      links: 'Find and fix broken markdown links',
      process: 'Extract and implement code blocks from planning documents',
      cleanup: 'Clean up deprecated or misplaced documentation',
      build: 'Build static documentation (future)',
      serve: 'Serve documentation locally (future)',
    },
  },

  cli: {
    description:
      'CLI introspection: generate workflow maps, sync documentation',
    actions: {
      'workflow-map':
        'Generate visual map of CLI commands to SOP workflow phases',
      sync: 'Check and sync CLI documentation with source code changes',
      'generate-docs':
        'Generate markdown documentation pages for all CLI commands',
    },
  },

  init: {
    description: 'Initialize supernal-coding in a new or existing project',
    actions: {},
  },

  config: {
    description: 'View and modify supernal.yaml configuration',
    actions: {
      get: 'Get a configuration value',
      set: 'Set a configuration value',
      list: 'List all configuration values',
    },
  },

  rules: {
    description: 'Manage .cursor/rules for AI agent guidance',
    actions: {
      list: 'Discover and list all rules in the repository',
      'workflow-map':
        'Show rules mapped to workflow phases (--markdown, --json)',
      export: 'Export rules for sharing with other projects',
      add: 'Add a new rule file (coming soon)',
      remove: 'Remove a rule file (coming soon)',
    },
  },

  workflow: {
    description: 'Track and manage workflow state across development phases',
    actions: {},
  },

  traceability: {
    description:
      'Generate and validate requirement-to-code traceability matrices',
    actions: {
      matrix: 'Generate traceability matrix',
      validate: 'Validate traceability links',
      compliance: 'Check compliance coverage',
    },
  },

  health: {
    description: 'Check project health and configuration status',
    actions: {},
  },

  upgrade: {
    description: 'Upgrade supernal-coding to the latest version',
    actions: {},
  },

  telemetry: {
    description: 'Manage anonymous usage telemetry settings',
    actions: {
      enable: 'Enable telemetry',
      disable: 'Disable telemetry',
      status: 'Show current telemetry status',
    },
  },

  sync: {
    description: 'Synchronize project state with templates and configuration',
    actions: {},
  },

  template: {
    description:
      'Manage project templates for requirements, features, and docs',
    actions: {
      list: 'List all available templates (requirement, feature, design, etc.)',
      registry:
        'Show the template registry with template metadata and versions',
    },
  },

  'multi-repo': {
    description: 'Manage multiple repositories in a monorepo or workspace',
    actions: {},
  },

  dashboard: {
    description: 'Launch and manage the development dashboard',
    actions: {},
  },
};

function getCommandDescription(commandName: string): string | null {
  return COMMAND_DESCRIPTIONS[commandName]?.description || null;
}

function getActionDescription(commandName: string, actionName: string): string | null {
  return COMMAND_DESCRIPTIONS[commandName]?.actions?.[actionName] || null;
}

function getActionDescriptions(commandName: string): ActionDescriptions {
  return COMMAND_DESCRIPTIONS[commandName]?.actions || {};
}

function enhanceCommandData(commands: CommandData[]): CommandData[] {
  return commands.map((cmd) => {
    const enhanced = { ...cmd };

    const betterDesc = getCommandDescription(cmd.name);
    if (betterDesc) {
      enhanced.description = betterDesc;
    }

    if (cmd.actions && cmd.actions.length > 0) {
      enhanced.actionDetails = cmd.actions.map((action) => ({
        name: action,
        description:
          getActionDescription(cmd.name, action) ||
          `Run \`sc ${cmd.name} ${action} --help\` for details`,
      }));
    }

    return enhanced;
  });
}

export {
  COMMAND_DESCRIPTIONS,
  getCommandDescription,
  getActionDescription,
  getActionDescriptions,
  enhanceCommandData,
};

module.exports = {
  COMMAND_DESCRIPTIONS,
  getCommandDescription,
  getActionDescription,
  getActionDescriptions,
  enhanceCommandData,
};
