// @ts-nocheck
/**
 * Centralized Command Metadata
 * Single source of truth for all CLI command definitions
 * Prevents duplication across command-registry.js, command classes, and tests
 */

const COMMAND_METADATA = {
  init: {
    description: 'Equip current repository with specific preset or content modules',
    actions: ['minimal', 'standard', 'full', 'development', 'interactive'],
    options: [
      // Presets (full installation)
      ['--minimal', 'Install minimal preset (just essentials)'],
      ['--standard', 'Install standard preset (recommended)'],
      ['--full', 'Install full preset (complete ecosystem)'],
      ['--development', 'Install development preset (for contributors)'],
      ['--interactive', 'Interactive setup mode'],
      // Content modules (standalone installation for docs sites)
      ['--guides', 'Install guides/tutorials to docs/guides/'],
      ['--compliance', 'Install compliance templates to docs/compliance/'],
      ['--workflow', 'Install workflow/SOPs to docs/workflow/'],
      // Options
      ['--dry-run', 'Show what would be installed without doing it'],
      ['--overwrite', 'Overwrite existing files without confirmation'],
      ['--skip-upgrade-check', 'Skip checking for package upgrades'],
      ['--merge', 'Merge with existing installation'],
      ['--yes', 'Skip confirmations and use defaults'],
      ['--name <name>', 'Project name'],
      ['--alias <alias>', 'Command alias'],
      ['-t, --template <name>', 'Template to use'],
      ['--force', 'Overwrite existing files'],
      ['-v, --verbose', 'Verbose output'],
      [
        '--framework <frameworks>',
        'Compliance frameworks (comma-separated): iso13485,fda21cfr11,gdpr,soc2'
      ]
    ],
    arguments: ['[directory]'],
    examples: [
      'sc init --standard',
      'sc init --development --dry-run',
      'sc init --interactive',
      'sc init --guides --compliance --workflow',
      'sc init --guides'
    ]
  },

  test: {
    description: 'Testing guidance and execution system',
    actions: [
      'guide',
      'setup',
      'validate',
      'plan',
      'run',
      'doctor',
      'map',
      'structure'
    ],
    actionsSummary: 'guide, setup, validate, plan, run, doctor, map, structure',
    options: [
      [
        '--framework <framework>',
        'Testing framework to use (playwright, jest, cypress)'
      ],
      ['--watch', 'Watch mode'],
      ['--coverage', 'Generate coverage report'],
      ['--fix', 'Auto-fix test issues where possible'],
      ['-v, --verbose', 'Verbose output']
    ],
    arguments: ['[action]', '[target]'],
    examples: [
      'sc test guide',
      'sc test setup --framework playwright',
      'sc test validate',
      'sc test plan REQ-003',
      'sc test run unit'
    ]
  },

  sync: {
    description:
      'Synchronize local repository state with global sc installation',
    actions: ['check', 'report', 'update'],
    actionsSummary: 'check, report, update',
    options: [
      ['--force', 'Force synchronization'],
      ['-v, --verbose', 'Verbose output']
    ],
    arguments: ['[action]'],
    examples: ['sc sync', 'sc sync check', 'sc sync update --force']
  }
};

/**
 * Get command metadata for registry registration
 */
function getCommandForRegistry(commandName) {
  const meta = COMMAND_METADATA[commandName];
  if (!meta) return null;

  return {
    description: meta.actionsSummary
      ? `${meta.description}\nActions: ${meta.actionsSummary}`
      : meta.description,
    options: meta.options,
    arguments: meta.arguments
  };
}

/**
 * Get command metadata for help text generation
 */
function getCommandHelp(commandName) {
  const meta = COMMAND_METADATA[commandName];
  if (!meta) return null;

  return {
    description: meta.description,
    actions: meta.actions,
    actionsSummary: meta.actionsSummary,
    options: meta.options,
    arguments: meta.arguments,
    examples: meta.examples
  };
}

/**
 * Generate standardized help text
 */
function generateHelpText(commandName, customTitle = null) {
  const meta = getCommandHelp(commandName);
  if (!meta) return 'Help not available for this command';

  const chalk = require('chalk');

  let help = '';
  help += chalk.blue.bold(
    customTitle || `🔧 ${commandName.toUpperCase()} Command`
  );
  help += `\n${chalk.blue('='.repeat(40))}\n\n`;

  if (meta.actionsSummary) {
    help += chalk.yellow(`Available Actions: ${meta.actionsSummary}\n\n`);
  }

  if (meta.actions && meta.actions.length > 0) {
    meta.actions.forEach((action) => {
      help += `  ${chalk.cyan(action.padEnd(20))} ${getActionDescription(commandName, action)}\n`;
    });
    help += '\n';
  }

  if (meta.options && meta.options.length > 0) {
    help += chalk.yellow('Options:\n');
    meta.options.forEach(([option, desc]) => {
      help += `  ${chalk.cyan(option.padEnd(25))} ${desc}\n`;
    });
    help += '\n';
  }

  if (meta.examples && meta.examples.length > 0) {
    help += chalk.yellow('Examples:\n');
    meta.examples.forEach((example) => {
      help += `  ${chalk.cyan(example)}\n`;
    });
  }

  return help;
}

/**
 * Get description for a specific action (can be customized per command)
 */
function getActionDescription(commandName, action) {
  const descriptions = {
    test: {
      guide: 'Show testing guidance',
      setup: 'Setup testing environment',
      validate: 'Validate test quality',
      plan: 'Generate test plan for requirement',
      run: 'Run tests (unit, e2e, integration)',
      doctor: 'Diagnose testing issues',
      map: 'Generate test mapping',
      structure: 'Show test structure guidance'
    },
    sync: {
      check: 'Check version sync between local repo and global sc (default)',
      report: 'Same as check - shows version comparison',
      update: 'Update global sc to match local repository version'
    }
  };

  return descriptions[commandName]?.[action] || `Execute ${action} action`;
}

module.exports = {
  COMMAND_METADATA,
  getCommandForRegistry,
  getCommandHelp,
  generateHelpText,
  getActionDescription
};
