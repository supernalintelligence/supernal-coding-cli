#!/usr/bin/env node
// @ts-nocheck

const chalk = require('chalk');
const ReferenceManager = require('../../../kanban/ReferenceManager');
const { getConfig } = require('../../../scripts/config-loader');

/**
 * Kanban Command Handler
 * Modern reference-based Kanban system
 */
class KanbanCommandHandler {
  projectRoot: any;
  referenceManager: any;
  constructor() {
    this.projectRoot = this.findProjectRoot();
    const config = getConfig(this.projectRoot);
    config.load();
    this.referenceManager = new ReferenceManager(this.projectRoot);
  }

  /**
   * Find the project root by looking for the main config file
   */
  findProjectRoot() {
    const fs = require('fs-extra');
    const path = require('node:path');
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      const configPath = path.join(currentDir, 'supernal.yaml');
      if (fs.existsSync(configPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    return process.cwd();
  }

  /**
   * Handle kanban command with action and arguments
   */
  async handleCommand(action, ...args) {
    try {
      if (!action) {
        await this.listBoards();
        return;
      }

      switch (action) {
        case 'create-board':
        case 'new-board': {
          if (args.length < 2) {
            console.error(chalk.red('❌ Board ID and name are required'));
            console.log(
              chalk.blue(
                'Usage: sc kanban create-board demo-backend "Demo Backend"'
              )
            );
            process.exit(1);
          }
          const boardId = args[0];
          const boardName = args[1];
          const options = this.parseOptions(args.slice(2));
          await this.referenceManager.createBoard(
            boardId,
            boardName,
            options.type || 'project',
            options
          );
          break;
        }

        case 'list-boards':
        case 'boards': {
          await this.listBoards();
          break;
        }

        case 'show-board':
        case 'show': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Board ID is required'));
            console.log(chalk.blue('Usage: sc kanban show demo-backend'));
            process.exit(1);
          }
          await this.showBoard(args[0]);
          break;
        }

        case 'add':
        case 'add-item': {
          if (args.length < 3) {
            console.error(
              chalk.red('❌ Item type, item ID, and board ID are required')
            );
            console.log(
              chalk.blue(
                'Usage: sc kanban add requirement REQ-AUTH-001 demo-backend --column=planning'
              )
            );
            process.exit(1);
          }
          const itemType = args[0];
          const itemId = args[1];
          const boardId = args[2];
          const options = this.parseOptions(args.slice(3));
          await this.referenceManager.addReference(
            itemType,
            itemId,
            boardId,
            options.column || 'planning',
            options
          );
          break;
        }

        case 'remove':
        case 'remove-item': {
          if (args.length < 3) {
            console.error(
              chalk.red('❌ Item type, item ID, and board ID are required')
            );
            console.log(
              chalk.blue(
                'Usage: sc kanban remove requirement REQ-AUTH-001 demo-backend'
              )
            );
            process.exit(1);
          }
          const rmItemType = args[0];
          const rmItemId = args[1];
          const rmBoardId = args[2];
          const rmOptions = this.parseOptions(args.slice(3));
          await this.referenceManager.removeReference(
            rmItemType,
            rmItemId,
            rmBoardId,
            rmOptions.column || null
          );
          break;
        }

        case 'move': {
          if (args.length < 4) {
            console.error(
              chalk.red(
                '❌ Item ID, board ID, from column, and to column are required'
              )
            );
            console.log(
              chalk.blue(
                'Usage: sc kanban move REQ-AUTH-001 demo-backend planning in-progress'
              )
            );
            process.exit(1);
          }
          const moveItemId = args[0];
          const moveBoardId = args[1];
          const fromColumn = args[2];
          const toColumn = args[3];
          await this.referenceManager.moveReference(
            moveItemId,
            moveBoardId,
            fromColumn,
            toColumn
          );
          break;
        }

        case 'references':
        case 'where': {
          if (args.length < 2) {
            console.error(chalk.red('❌ Item type and item ID are required'));
            console.log(
              chalk.blue('Usage: sc kanban references requirement REQ-AUTH-001')
            );
            process.exit(1);
          }
          const refItemType = args[0];
          const refItemId = args[1];
          await this.showReferences(refItemType, refItemId);
          break;
        }

        case 'validate': {
          await this.validateReferences();
          break;
        }

        case 'cleanup': {
          await this.referenceManager.cleanupOrphanedReferences();
          break;
        }

        case 'delete-board': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Board ID is required'));
            console.log(
              chalk.blue('Usage: sc kanban delete-board demo-backend')
            );
            process.exit(1);
          }
          await this.referenceManager.deleteBoard(args[0]);
          break;
        }

        case 'help':
          this.showHelp();
          break;

        default:
          console.log(chalk.red(`❌ Unknown action: "${action}"`));
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Command failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * List all boards
   */
  async listBoards() {
    const boards = await this.referenceManager.getAllBoards();

    if (boards.length === 0) {
      console.log(chalk.yellow('No boards found'));
      console.log(
        chalk.blue('Create a board with: sc kanban create-board <id> <name>')
      );
      return;
    }

    console.log(chalk.bold(`\n📋 Kanban Boards (${boards.length}):\n`));

    for (const board of boards) {
      const totalItems = board.columns.reduce(
        (sum, col) => sum + col.items.length,
        0
      );
      console.log(chalk.cyan(`  📌 ${board.boardId}: ${board.name}`));
      console.log(
        chalk.gray(`     Type: ${board.type} | Items: ${totalItems}`)
      );
      console.log(
        chalk.gray(
          `     Columns: ${board.columns.map((c) => c.name).join(', ')}`
        )
      );
      console.log();
    }
  }

  /**
   * Show board details
   */
  async showBoard(boardId) {
    const board = await this.referenceManager.getBoard(boardId);

    console.log(chalk.bold(`\n📋 Board: ${board.name} (${board.boardId})\n`));
    console.log(chalk.gray(`Type: ${board.type}`));
    console.log(chalk.gray(`Created: ${board.created}`));
    console.log(chalk.gray(`Last Updated: ${board.lastUpdated}\n`));

    for (const column of board.columns) {
      console.log(chalk.cyan(`\n  ${column.name} (${column.items.length})`));
      console.log(chalk.gray(`  ${'─'.repeat(50)}`));

      if (column.items.length === 0) {
        console.log(chalk.gray('    (empty)'));
      } else {
        for (const item of column.items) {
          const priority = item.priority || 'medium';
          const priorityIcon =
            {
              high: '🔴',
              medium: '🟡',
              low: '🟢'
            }[priority] || '⚪';

          console.log(
            chalk.white(
              `    ${priorityIcon} ${item.id} ${item.assignee ? chalk.gray(`(${item.assignee})`) : ''}`
            )
          );
        }
      }
    }
    console.log();
  }

  /**
   * Show references for an item
   */
  async showReferences(itemType, itemId) {
    const references = await this.referenceManager.getReferencingBoards(
      itemType,
      itemId
    );

    if (references.length === 0) {
      console.log(chalk.yellow(`No boards reference ${itemType} ${itemId}`));
      return;
    }

    console.log(chalk.bold(`\n📍 Boards referencing ${itemType} ${itemId}:\n`));

    for (const ref of references) {
      console.log(chalk.cyan(`  • ${ref.boardId}`));
      console.log(chalk.gray(`    Column: ${ref.columnId}`));
      console.log(chalk.gray(`    Added: ${ref.addedAt}`));
    }
    console.log();
  }

  /**
   * Validate references
   */
  async validateReferences() {
    console.log(chalk.blue('🔍 Validating board references...'));
    const issues = await this.referenceManager.validateReferences();

    if (issues.length === 0) {
      console.log(chalk.green('✅ All references are valid'));
    } else {
      console.log(chalk.yellow(`⚠️  Found ${issues.length} issues:\n`));
      for (const issue of issues) {
        console.log(
          chalk.red(
            `  • Board ${issue.board}, Column ${issue.column}: ${issue.issue}`
          )
        );
      }
    }
  }

  /**
   * Parse command options
   */
  parseOptions(args) {
    const options = {};
    for (const arg of args) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        options[key] = value || true;
      }
    }
    return options;
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(chalk.bold('\n📋 Kanban Reference System\n'));
    console.log(chalk.cyan('Board Management:'));
    console.log(
      '  create-board <id> <name> [--type=project]   Create a new board'
    );
    console.log(
      '  list-boards                                  List all boards'
    );
    console.log(
      '  show-board <id>                              Show board details'
    );
    console.log(
      '  delete-board <id>                            Delete a board\n'
    );

    console.log(chalk.cyan('Reference Management:'));
    console.log(
      '  add <type> <id> <board> --column=<col>      Add item to board'
    );
    console.log(
      '  remove <type> <id> <board> [--column=<col>] Remove item from board'
    );
    console.log(
      '  move <id> <board> <from-col> <to-col>       Move item between columns'
    );
    console.log(
      '  references <type> <id>                       Show where item is referenced\n'
    );

    console.log(chalk.cyan('Maintenance:'));
    console.log(
      '  validate                                     Validate all references'
    );
    console.log(
      '  cleanup                                      Clean up orphaned references\n'
    );

    console.log(chalk.cyan('Board Types:'));
    console.log('  project, sprint, team, epic, business-plan\n');

    console.log(chalk.cyan('Item Types:'));
    console.log('  epic, requirement, sub-requirement, task\n');

    console.log(chalk.cyan('Examples:'));
    console.log(
      chalk.gray(
        '  sc kanban create-board demo-backend "Demo Backend" --type=business-plan'
      )
    );
    console.log(
      chalk.gray(
        '  sc kanban add requirement REQ-AUTH-001 demo-backend --column=planning'
      )
    );
    console.log(
      chalk.gray(
        '  sc kanban move REQ-AUTH-001 demo-backend planning in-progress'
      )
    );
    console.log(chalk.gray('  sc kanban references requirement REQ-AUTH-001'));
    console.log();
  }
}

// CLI Interface
async function handleKanbanCommand(action, ...args) {
  const handler = new KanbanCommandHandler();
  await handler.handleCommand(action, ...args);
}

module.exports = {
  KanbanCommandHandler,
  handleKanbanCommand
};

// If called directly
if (require.main === module) {
  const [, , action, ...args] = process.argv;
  handleKanbanCommand(action, ...args);
}
