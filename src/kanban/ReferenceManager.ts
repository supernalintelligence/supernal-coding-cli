// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

/**
 * Reference Manager for Kanban System
 * Manages board references without moving requirement files
 */
class ReferenceManager {
  boardsDir: any;
  kanbanDir: any;
  projectRoot: any;
  referencesDir: any;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.kanbanDir = path.join(projectRoot, 'docs', 'kanban');
    this.boardsDir = path.join(this.kanbanDir, 'boards');
    this.referencesDir = path.join(this.kanbanDir, 'references');

    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure all necessary directories exist
   */
  async ensureDirectories() {
    await fs.ensureDir(this.boardsDir);
    await fs.ensureDir(this.referencesDir);
  }

  /**
   * Get all boards
   */
  async getAllBoards() {
    await this.ensureDirectories();
    const files = await fs.readdir(this.boardsDir);
    const boards = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const boardPath = path.join(this.boardsDir, file);
        const board = await fs.readJson(boardPath);
        boards.push(board);
      }
    }

    return boards;
  }

  /**
   * Get a specific board by ID
   */
  async getBoard(boardId) {
    const boardPath = path.join(this.boardsDir, `${boardId}.json`);
    if (!(await fs.pathExists(boardPath))) {
      throw new Error(`Board ${boardId} not found`);
    }
    return await fs.readJson(boardPath);
  }

  /**
   * Create a new board
   */
  async createBoard(boardId, name, type = 'project', options = {}) {
    const boardPath = path.join(this.boardsDir, `${boardId}.json`);

    if (await fs.pathExists(boardPath)) {
      throw new Error(`Board ${boardId} already exists`);
    }

    const board = {
      boardId,
      name,
      type, // project|sprint|team|epic|business-plan
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      metadata: options.metadata || {},
      columns: options.columns || this.getDefaultColumns(type)
    };

    await fs.writeJson(boardPath, board, { spaces: 2 });

    console.log(chalk.green(`✅ Created board: ${boardId}`));
    console.log(chalk.blue(`   Name: ${name}`));
    console.log(chalk.blue(`   Type: ${type}`));

    return board;
  }

  /**
   * Get default columns for a board type
   */
  getDefaultColumns(type) {
    const defaults = {
      project: [
        { id: 'planning', name: 'Planning', items: [] },
        { id: 'in-progress', name: 'In Progress', items: [] },
        { id: 'testing', name: 'Testing', items: [] },
        { id: 'done', name: 'Done', items: [] }
      ],
      sprint: [
        { id: 'todo', name: 'To Do', items: [] },
        { id: 'doing', name: 'Doing', items: [] },
        { id: 'done', name: 'Done', items: [] }
      ],
      team: [
        { id: 'backlog', name: 'Backlog', items: [] },
        { id: 'assigned', name: 'Assigned', items: [] },
        { id: 'in-review', name: 'In Review', items: [] },
        { id: 'completed', name: 'Completed', items: [] }
      ],
      epic: [
        {
          id: 'requirements-planning',
          name: 'Requirements Planning',
          items: []
        },
        { id: 'in-development', name: 'In Development', items: [] },
        { id: 'testing', name: 'Testing', items: [] },
        { id: 'complete', name: 'Complete', items: [] }
      ],
      'business-plan': [
        { id: 'planning', name: 'Planning', items: [] },
        { id: 'in-progress', name: 'In Progress', items: [] },
        { id: 'demo-ready', name: 'Demo Ready', items: [] },
        { id: 'validated', name: 'Validated', items: [] }
      ]
    };

    return defaults[type] || defaults.project;
  }

  /**
   * Add a reference to a board
   */
  async addReference(itemType, itemId, boardId, columnId, metadata = {}) {
    // Load board
    const board = await this.getBoard(boardId);

    // Find column
    const column = board.columns.find((col) => col.id === columnId);
    if (!column) {
      throw new Error(`Column ${columnId} not found in board ${boardId}`);
    }

    // Check if item already exists in this board
    const existingItem = column.items.find((item) => item.id === itemId);
    if (existingItem) {
      throw new Error(
        `Item ${itemId} already exists in column ${columnId} of board ${boardId}`
      );
    }

    // Add item reference
    const itemRef = {
      type: itemType, // epic|requirement|sub-requirement|task
      id: itemId,
      addedToColumn: new Date().toISOString(),
      addedBy: metadata.addedBy || 'system',
      priority: metadata.priority || 'medium',
      assignee: metadata.assignee || null,
      status: metadata.status || 'pending',
      metadata: metadata.customData || {}
    };

    column.items.push(itemRef);
    board.lastUpdated = new Date().toISOString();

    // Save board
    await this.saveBoard(board);

    // Update references index
    await this.updateReferencesIndex(
      itemType,
      itemId,
      boardId,
      columnId,
      'add'
    );

    console.log(
      chalk.green(`✅ Added ${itemType} ${itemId} to board ${boardId}`)
    );
    console.log(chalk.blue(`   Column: ${columnId}`));

    return itemRef;
  }

  /**
   * Remove a reference from a board
   */
  async removeReference(itemType, itemId, boardId, columnId = null) {
    const board = await this.getBoard(boardId);

    let removed = false;

    // If columnId is specified, only remove from that column
    if (columnId) {
      const column = board.columns.find((col) => col.id === columnId);
      if (column) {
        column.items = column.items.filter((item) => item.id !== itemId);
        removed = true;
      }
    } else {
      // Remove from all columns
      for (const column of board.columns) {
        const initialLength = column.items.length;
        column.items = column.items.filter((item) => item.id !== itemId);
        if (column.items.length < initialLength) {
          removed = true;
        }
      }
    }

    if (!removed) {
      throw new Error(`Item ${itemId} not found in board ${boardId}`);
    }

    board.lastUpdated = new Date().toISOString();
    await this.saveBoard(board);

    // Update references index
    await this.updateReferencesIndex(
      itemType,
      itemId,
      boardId,
      columnId,
      'remove'
    );

    console.log(
      chalk.green(`✅ Removed ${itemType} ${itemId} from board ${boardId}`)
    );

    return true;
  }

  /**
   * Move a reference within a board
   */
  async moveReference(itemId, boardId, fromColumnId, toColumnId) {
    const board = await this.getBoard(boardId);

    // Find item in source column
    const fromColumn = board.columns.find((col) => col.id === fromColumnId);
    if (!fromColumn) {
      throw new Error(`Source column ${fromColumnId} not found`);
    }

    const itemIndex = fromColumn.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item ${itemId} not found in column ${fromColumnId}`);
    }

    const item = fromColumn.items[itemIndex];

    // Remove from source
    fromColumn.items.splice(itemIndex, 1);

    // Find destination column
    const toColumn = board.columns.find((col) => col.id === toColumnId);
    if (!toColumn) {
      throw new Error(`Destination column ${toColumnId} not found`);
    }

    // Add to destination
    item.addedToColumn = new Date().toISOString();
    toColumn.items.push(item);

    board.lastUpdated = new Date().toISOString();
    await this.saveBoard(board);

    // Update references index
    await this.updateReferencesIndex(
      item.type,
      itemId,
      boardId,
      toColumnId,
      'move'
    );

    console.log(
      chalk.green(`✅ Moved ${item.type} ${itemId} in board ${boardId}`)
    );
    console.log(chalk.blue(`   From: ${fromColumnId} → To: ${toColumnId}`));

    return item;
  }

  /**
   * Get all boards referencing a specific item
   */
  async getReferencingBoards(itemType, itemId) {
    const refPath = path.join(
      this.referencesDir,
      `${itemType}-references.json`
    );

    if (!(await fs.pathExists(refPath))) {
      return [];
    }

    const references = await fs.readJson(refPath);
    return references[itemId] || [];
  }

  /**
   * Get all items referenced by a board
   */
  async getBoardReferences(boardId) {
    const board = await this.getBoard(boardId);
    const allItems = [];

    for (const column of board.columns) {
      for (const item of column.items) {
        allItems.push({
          ...item,
          column: column.id,
          columnName: column.name
        });
      }
    }

    return allItems;
  }

  /**
   * Update references index
   */
  async updateReferencesIndex(itemType, itemId, boardId, columnId, action) {
    const refPath = path.join(
      this.referencesDir,
      `${itemType}-references.json`
    );

    let references = {};
    if (await fs.pathExists(refPath)) {
      references = await fs.readJson(refPath);
    }

    if (!references[itemId]) {
      references[itemId] = [];
    }

    if (action === 'add') {
      references[itemId].push({
        boardId,
        columnId,
        addedAt: new Date().toISOString()
      });
    } else if (action === 'remove') {
      references[itemId] = references[itemId].filter(
        (ref) =>
          !(ref.boardId === boardId && (!columnId || ref.columnId === columnId))
      );
    } else if (action === 'move') {
      const ref = references[itemId].find((r) => r.boardId === boardId);
      if (ref) {
        ref.columnId = columnId;
        ref.updatedAt = new Date().toISOString();
      }
    }

    // Clean up empty references
    if (references[itemId].length === 0) {
      delete references[itemId];
    }

    await fs.writeJson(refPath, references, { spaces: 2 });
  }

  /**
   * Save a board
   */
  async saveBoard(board) {
    const boardPath = path.join(this.boardsDir, `${board.boardId}.json`);
    await fs.writeJson(boardPath, board, { spaces: 2 });
  }

  /**
   * Delete a board
   */
  async deleteBoard(boardId) {
    const boardPath = path.join(this.boardsDir, `${boardId}.json`);

    if (!(await fs.pathExists(boardPath))) {
      throw new Error(`Board ${boardId} not found`);
    }

    // Get all references from this board
    const board = await this.getBoard(boardId);

    // Remove all references
    for (const column of board.columns) {
      for (const item of column.items) {
        await this.updateReferencesIndex(
          item.type,
          item.id,
          boardId,
          column.id,
          'remove'
        );
      }
    }

    // Delete board file
    await fs.remove(boardPath);

    console.log(chalk.green(`✅ Deleted board: ${boardId}`));
  }

  /**
   * Validate references
   */
  async validateReferences() {
    const boards = await this.getAllBoards();
    const issues = [];

    for (const board of boards) {
      for (const column of board.columns) {
        for (const item of column.items) {
          // Check if item still exists (would need RequirementManager integration)
          // For now, just validate structure
          if (!item.id || !item.type) {
            issues.push({
              board: board.boardId,
              column: column.id,
              item: item.id,
              issue: 'Missing id or type'
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Clean up orphaned references
   */
  async cleanupOrphanedReferences() {
    const refFiles = await fs.readdir(this.referencesDir);
    let cleaned = 0;

    for (const file of refFiles) {
      if (file.endsWith('-references.json')) {
        const refPath = path.join(this.referencesDir, file);
        const references = await fs.readJson(refPath);

        for (const [itemId, refs] of Object.entries(references)) {
          // Filter out references to non-existent boards
          const validRefs = [];
          for (const ref of refs) {
            const boardPath = path.join(this.boardsDir, `${ref.boardId}.json`);
            if (await fs.pathExists(boardPath)) {
              validRefs.push(ref);
            } else {
              cleaned++;
            }
          }

          if (validRefs.length > 0) {
            references[itemId] = validRefs;
          } else {
            delete references[itemId];
          }
        }

        await fs.writeJson(refPath, references, { spaces: 2 });
      }
    }

    console.log(chalk.green(`✅ Cleaned up ${cleaned} orphaned references`));
    return cleaned;
  }
}

module.exports = ReferenceManager;
