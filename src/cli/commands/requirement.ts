/**
 * Requirement Command Handler - Simplified
 */

import chalk from 'chalk';
const RequirementManager = require('./requirement/RequirementManager');
const SearchManager = require('./requirement/SearchManager');
const ValidationManager = require('./requirement/ValidationManager');
const TestManager = require('./requirement/TestManager');
const GitManager = require('./requirement/GitManager');

interface RequirementOptions {
  feature?: string;
  featurePath?: string;
  category?: string;
  epic?: string;
  status?: string;
  format?: string;
  verbose?: boolean;
  force?: boolean;
  [key: string]: unknown;
}

interface CreatedRequirement {
  id: string;
  filePath: string;
}

async function handleRequirementCommand(
  action: string | undefined,
  args: string[],
  options: RequirementOptions
): Promise<void> {
  const requirementManager = new RequirementManager();
  const searchManager = new SearchManager(requirementManager);
  const validationManager = new ValidationManager(requirementManager);
  const testManager = new TestManager(requirementManager);
  const gitManager = new GitManager(requirementManager);

  if (!action) {
    action = 'list';
  }

  switch (action) {
    case 'new':
    case 'create': {
      const title = args[0];
      if (!title) {
        throw new Error('Title is required for new requirement');
      }

      if (options.feature && !options.featurePath) {
        options.featurePath = options.feature;
        delete options.feature;
      }

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

      await searchManager.checkForSimilarRequirements(title, options);

      const requirement: CreatedRequirement = await requirementManager.createRequirement(
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

export { handleRequirementCommand };
module.exports = {
  handleRequirementCommand
};
