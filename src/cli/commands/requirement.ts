#!/usr/bin/env node
// @ts-nocheck

/**
 * Requirement Command Handler - Simplified
 *
 * This is the routing layer between CLI and business logic.
 * Commander has already parsed all arguments and options correctly.
 */

const chalk = require('chalk');
const RequirementManager = require('./requirement/RequirementManager');
const SearchManager = require('./requirement/SearchManager');
const ValidationManager = require('./requirement/ValidationManager');
const TestManager = require('./requirement/TestManager');
const GitManager = require('./requirement/GitManager');

/**
 * Handle requirement command with pre-parsed arguments
 * @param {string} action - The action to perform (new, list, show, etc)
 * @param {string[]} args - Additional arguments (already parsed by Commander)
 * @param {object} options - Options (already parsed by Commander)
 */
async function handleRequirementCommand(action, args, options) {
  // Initialize managers
  const requirementManager = new RequirementManager();
  const searchManager = new SearchManager(requirementManager);
  const validationManager = new ValidationManager(requirementManager);
  const testManager = new TestManager(requirementManager);
  const gitManager = new GitManager(requirementManager);

  // Default action is 'list'
  if (!action) {
    action = 'list';
  }

  switch (action) {
    case 'new':
    case 'create': {
      // For 'new', first arg is the title
      const title = args[0];
      if (!title) {
        throw new Error('Title is required for new requirement');
      }

      // Normalize: --feature is legacy, prefer --feature-path
      if (options.feature && !options.featurePath) {
        options.featurePath = options.feature;
        delete options.feature;
      }

      // Validate mutually exclusive options
      if (options.featurePath && options.category) {
        throw new Error(
          'Cannot use both --feature-path and --category.\n' +
            'Use --feature-path for feature-specific requirements, or --category/--epic for centralized requirements.'
        );
      }

      if (options.featurePath && options.epic) {
        throw new Error(
          'Cannot use both --feature-path and --epic.\n' +
            'Use --feature-path for feature-specific requirements, or --epic for centralized requirements.'
        );
      }

      // Check for similar requirements before creating
      await searchManager.checkForSimilarRequirements(title, options);

      // Create the requirement
      const requirement = await requirementManager.createRequirement(
        title,
        options
      );

      console.log(
        chalk.green(`✅ Requirement ${requirement.id} created successfully!`)
      );
      console.log(chalk.blue(`📁 File: ${requirement.filePath}`));
      console.log();
      console.log(chalk.yellow('⚠️  TEMPLATE CREATED - NEEDS UPDATING:'));
      console.log('   1. Replace placeholder content with actual requirements');
      console.log('   2. Fill in Gherkin scenarios with specific test cases');
      console.log('   3. Add technical implementation details');
      console.log(
        `   4. Run: sc req validate ${requirement.id.replace('REQ-', '')} to check completeness`
      );
      console.log();
      console.log(
        chalk.blue('💡 Next steps: Edit the file above, then run validation')
      );
      break;
    }

    case 'list':
    case 'ls': {
      const status = options.status;
      const format = options.format || 'table';
      await requirementManager.listRequirements({
        status,
        format,
        verbose: options.verbose
      });
      break;
    }

    case 'show':
    case 'view': {
      const id = args[0];
      if (!id) {
        throw new Error('Requirement ID is required for show command');
      }
      await requirementManager.showRequirement(id, {
        verbose: options.verbose
      });
      break;
    }

    case 'update': {
      const id = args[0];
      if (!id) {
        throw new Error('Requirement ID is required for update command');
      }
      await requirementManager.updateRequirement(id, options);
      console.log(chalk.green(`✅ Requirement ${id} updated successfully`));
      break;
    }

    case 'delete':
    case 'remove': {
      const id = args[0];
      if (!id) {
        throw new Error('Requirement ID is required for delete command');
      }

      if (!options.force) {
        // In real implementation, would prompt for confirmation
        console.log(chalk.yellow('⚠️  Use --force to confirm deletion'));
        return;
      }

      await requirementManager.deleteRequirement(id);
      console.log(chalk.green(`✅ Requirement ${id} deleted successfully`));
      break;
    }

    case 'validate': {
      const id = args[0];
      if (!id) {
        throw new Error('Requirement ID is required for validate command');
      }
      await validationManager.validateRequirement(id);
      break;
    }

    case 'generate-tests': {
      const id = args[0];
      if (!id) {
        throw new Error(
          'Requirement ID is required for generate-tests command'
        );
      }
      await testManager.generateTests(id);
      console.log(chalk.green(`✅ Tests generated for requirement ${id}`));
      break;
    }

    case 'start-work': {
      const id = args[0];
      if (!id) {
        throw new Error('Requirement ID is required for start-work command');
      }
      await gitManager.startWork(id);
      console.log(chalk.green(`✅ Started work on requirement ${id}`));
      console.log(chalk.blue('💡 Branch created and ready for development'));
      break;
    }

    case 'search': {
      const query = args.join(' ');
      if (!query) {
        throw new Error('Search query is required');
      }
      await searchManager.searchRequirements(query, options);
      break;
    }

    default:
      throw new Error(
        `Unknown action: ${action}. Use 'sc requirement --help' for available actions.`
      );
  }
}

// CLI wrapper for backwards compatibility
async function _handleRequirementCommand_CLI(...rawArgs) {
  // This is called from old code that passes raw args
  // Parse them simply
  const action = rawArgs[0];
  const args = [];
  const options = {};

  let i = 1;
  while (i < rawArgs.length) {
    const arg = rawArgs[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        options[key] = rawArgs[i + 1];
        i += 2;
      } else {
        options[key] = true;
        i++;
      }
    } else {
      args.push(arg);
      i++;
    }
  }

  await handleRequirementCommand(action, args, options);
}

module.exports = {
  handleRequirementCommand
};
