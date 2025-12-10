#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs-extra';
import RequirementManager from './RequirementManager';

const SubRequirementManager = require('./SubRequirementManager');
const ValidationManager = require('./ValidationManager');
const SearchManager = require('./SearchManager');
const TestManager = require('./TestManager');
const GitManager = require('./GitManager');
const RequirementHelpers = require('./utils/helpers');

/** Parsed command options */
interface CommandOptions {
  content?: boolean;
  naming?: boolean;
  all?: boolean;
  [key: string]: unknown;
}

/** Validation results */
interface ValidationResults {
  content?: unknown;
  naming?: unknown;
}

/**
 * Main CLI handler for requirement commands
 * Orchestrates all the specialized managers
 */
class RequirementCommandHandler {
  protected gitManager: InstanceType<typeof GitManager>;
  protected requirementManager: RequirementManager;
  protected searchManager: InstanceType<typeof SearchManager>;
  protected subRequirementManager: InstanceType<typeof SubRequirementManager>;
  protected testManager: InstanceType<typeof TestManager>;
  protected validationManager: InstanceType<typeof ValidationManager>;

  constructor() {
    this.requirementManager = new RequirementManager();
    this.subRequirementManager = new SubRequirementManager(
      this.requirementManager
    );
    this.validationManager = new ValidationManager(this.requirementManager);
    this.searchManager = new SearchManager(this.requirementManager);
    this.testManager = new TestManager(this.requirementManager);
    this.gitManager = new GitManager(this.requirementManager);
  }

  /**
   * Handle requirement command with action and arguments
   */
  async handleCommand(action: string | undefined, ...args: string[]): Promise<void> {
    try {
      // DEBUG: See what we're receiving
      console.log('DEBUG handleCommand:', { action, args });

      // Ensure args is an array
      if (!Array.isArray(args)) {
        args = [];
      }

      // If no action provided, default to list
      if (!action) {
        console.log(
          chalk.blue('🔄 No action specified, showing requirements list:\n')
        );
        action = 'list';
      }

      switch (action) {
        case 'new':
        case 'create': {
          if (args.length === 0) {
            const error = new Error('❌ Title is required for new requirement');
            console.error(chalk.red(error.message));
            throw error;
          }

          const title = args[0];
          const options = RequirementHelpers.parseOptions(args.slice(1));

          // Check for similar requirements before creating
          await this.searchManager.checkForSimilarRequirements(title, options);
          await this.requirementManager.createRequirement(title, options);
          break;
        }

        case 'list':
        case 'ls': {
          const listOptions = RequirementHelpers.parseOptions(args || []);
          await this.requirementManager.listRequirements(listOptions);
          break;
        }

        case 'show':
        case 'get': {
          if (args.length === 0) {
            const error = new Error('❌ Requirement ID is required');
            console.error(chalk.red(error.message));
            throw error;
          }

          const reqId = args[0];
          const reqFile =
            await this.requirementManager.findRequirementById(reqId);
          if (reqFile) {
            const content = await fs.readFile(reqFile, 'utf8');
            console.log(content);
          } else {
            const error = new Error(`❌ Requirement ${reqId} not found`);
            console.error(chalk.red(error.message));
            throw error;
          }
          break;
        }

        case 'update': {
          if (args.length < 1) {
            console.error(chalk.red('❌ Requirement ID is required'));
            process.exit(1);
          }

          const updateId = args[0];
          const updateOptions = RequirementHelpers.parseOptions(
            args.slice(1) || []
          );
          await this.requirementManager.updateRequirement(
            updateId,
            updateOptions
          );
          break;
        }

        case 'delete':
        case 'remove': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Requirement ID is required'));
            process.exit(1);
          }

          const deleteId = args[0];
          const deleteOptions = RequirementHelpers.parseOptions(
            args.slice(1) || []
          );
          await this.requirementManager.deleteRequirement(
            deleteId,
            deleteOptions
          );
          break;
        }

        case 'validate': {
          if (args.length === 0) {
            console.error(
              chalk.red('❌ Requirement ID is required for validation')
            );
            process.exit(1);
          }
          const validateId = args[0];
          const validateOptions: CommandOptions = RequirementHelpers.parseOptions(
            args.slice(1) || []
          );

          // Determine validation type based on options
          const validateContent =
            validateOptions.content ||
            (!validateOptions.naming && !validateOptions.all);
          const validateNaming = validateOptions.naming || validateOptions.all;

          const results: ValidationResults = {};

          // Content validation
          if (validateContent) {
            const reqFile =
              await this.requirementManager.findRequirementById(validateId);
            if (!reqFile) {
              throw new Error(`Requirement ${validateId} not found`);
            }
            results.content =
              await this.validationManager.validateRequirementContent(
                reqFile,
                validateId
              );
          }

          // Naming validation
          if (validateNaming) {
            const reqFile =
              await this.requirementManager.findRequirementById(validateId);
            if (!reqFile) {
              throw new Error(`Requirement ${validateId} not found`);
            }
            results.naming =
              await this.validationManager.validateRequirementNaming(
                reqFile,
                validateId
              );
          }

          break;
        }

        case 'validate-all': {
          const validateAllOptions = RequirementHelpers.parseOptions(
            args || []
          );
          await this.validationManager.validateAllRequirements(
            validateAllOptions
          );
          break;
        }

        case 'fix-naming': {
          const fixOptions: CommandOptions = RequirementHelpers.parseOptions(args || []);

          if (fixOptions.all) {
            await this.validationManager.fixAllNaming(fixOptions);
          } else {
            if (args.length === 0 || args[0].startsWith('--')) {
              console.error(
                chalk.red('❌ Requirement ID is required for single file fix')
              );
              process.exit(1);
            }
            const fixId = args[0];
            await this.validationManager.fixNaming(fixId, fixOptions);
          }
          break;
        }

        case 'check-duplicates': {
          const isValid = await this.requirementManager.checkDuplicates();
          if (!isValid) {
            process.exit(1);
          }
          break;
        }

        case 'generate-tests': {
          if (args.length === 0) {
            console.error(
              chalk.red('❌ Requirement ID is required for test generation')
            );
            process.exit(1);
          }
          const generateTestsId = args[0];
          await this.testManager.generateTests(generateTestsId);
          break;
        }

        case 'validate-coverage': {
          if (args.length === 0) {
            console.error(
              chalk.red('❌ Requirement ID is required for coverage validation')
            );
            process.exit(1);
          }
          const coverageId = args[0];
          await this.testManager.validateCoverage(coverageId);
          break;
        }

        case 'coverage-report':
          await this.testManager.generateCoverageReport();
          break;

        case 'start-work': {
          console.warn(
            chalk.yellow(
              '⚠️  DEPRECATED: `sc req start-work` is deprecated for multi-agent workflows.\n' +
                '   Instead use:\n' +
                '     sc git-smart branch --branch=feature/req-XXX-title\n' +
                '     sc req update XXX --status=in-progress\n'
            )
          );
          if (args.length === 0) {
            console.error(
              chalk.red('❌ Requirement ID is required for starting work')
            );
            process.exit(1);
          }
          const startWorkId = args[0];
          await this.gitManager.startWork(startWorkId);
          break;
        }

        case 'smart-start': {
          console.warn(
            chalk.yellow(
              '⚠️  DEPRECATED: `sc req smart-start` is deprecated for multi-agent workflows.\n' +
                '   Instead use:\n' +
                '     sc git-smart branch --branch=feature/req-XXX-title\n' +
                '     sc req update XXX --status=in-progress\n'
            )
          );
          if (args.length === 0) {
            console.error(
              chalk.red(
                '❌ Requirement ID is required for smart workflow start'
              )
            );
            process.exit(1);
          }
          const smartStartId = args[0];
          await this.gitManager.smartStartWork(smartStartId);
          break;
        }

        case 'search':
        case 'find':
          if (args.length === 0) {
            console.error(chalk.red('❌ Search keywords are required'));
            console.log(chalk.blue('Usage: sc req search "keywords"'));
            process.exit(1);
          }
          await this.searchManager.searchRequirements(args.join(' '));
          break;

        case 'create-sub':
        case 'new-sub': {
          if (args.length < 2) {
            console.error(
              chalk.red(
                '❌ Parent requirement ID and sub-requirement title are required'
              )
            );
            console.log(
              chalk.blue(
                'Usage: sc req create-sub REQ-AUTH-001 "Email Validation"'
              )
            );
            process.exit(1);
          }
          const parentId = args[0];
          const subTitle = args[1];
          const subOptions = RequirementHelpers.parseOptions(args.slice(2));
          await this.subRequirementManager.createSubRequirement(
            parentId,
            subTitle,
            subOptions
          );
          break;
        }

        case 'list-subs': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Parent requirement ID is required'));
            console.log(chalk.blue('Usage: sc req list-subs REQ-AUTH-001'));
            process.exit(1);
          }
          const listParentId = args[0];
          await this.subRequirementManager.listSubRequirements(listParentId);
          break;
        }

        case 'convert-to-folder': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Requirement ID is required'));
            console.log(
              chalk.blue('Usage: sc req convert-to-folder REQ-AUTH-001')
            );
            process.exit(1);
          }
          const convertId = args[0];
          const convertOptions = RequirementHelpers.parseOptions(args.slice(1));
          await this.subRequirementManager.convertToFolderStructure(
            convertId,
            convertOptions
          );
          break;
        }

        case 'help':
          await this.requirementManager.showHelp();
          break;

        default:
          console.log(chalk.red(`❌ Unknown action: "${action}"`));
          console.log(chalk.blue('Available actions:\n'));
          await this.requirementManager.showHelp();
          break;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Command failed: ${(error as Error).message}`));
      throw error; // Throw instead of exit for testability
    }
  }
}

// CLI Interface
async function handleRequirementCommand(action: string | undefined, ...args: string[]): Promise<void> {
  const handler = new RequirementCommandHandler();
  try {
    await handler.handleCommand(action, ...args);
  } catch (error) {
    // Only exit if running from CLI (not in tests)
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      process.exit(1);
    }
    throw error;
  }
}

export {
  RequirementManager,
  SubRequirementManager,
  ValidationManager,
  SearchManager,
  TestManager,
  GitManager,
  RequirementCommandHandler,
  handleRequirementCommand
};

module.exports = {
  RequirementManager,
  SubRequirementManager,
  ValidationManager,
  SearchManager,
  TestManager,
  GitManager,
  RequirementCommandHandler,
  handleRequirementCommand
};

// If called directly
if (require.main === module) {
  const [, , action, ...args] = process.argv;
  handleRequirementCommand(action, ...args);
}
