// @ts-nocheck
/**
 * Kanban Manager for MCP Server
 *
 * Handles kanban board operations via MCP tools
 */

const fs = require('fs-extra');
const path = require('node:path');

class KanbanManager {
  boards: any;
  kanbanDir: any;
  projectRoot: any;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.kanbanDir = path.join(projectRoot, 'supernal-coding', 'kanban');
    this.boards = [
      'BRAINSTORM',
      'PLANNING',
      'TODO',
      'DOING',
      'BLOCKED',
      'DONE',
      'HANDOFFS'
    ];
  }

  /**
   * List tasks from kanban boards
   */
  async list(board = null) {
    const boards = board ? [board] : this.boards;
    const tasks = {};

    for (const boardName of boards) {
      const boardPath = path.join(this.kanbanDir, boardName);

      if (!(await fs.pathExists(boardPath))) {
        tasks[boardName] = [];
        continue;
      }

      const files = await fs.readdir(boardPath);
      tasks[boardName] = await Promise.all(
        files
          .filter((f) => f.endsWith('.md'))
          .map((f) => this.parseTask(path.join(boardPath, f), boardName))
      );
    }

    return board ? tasks[board] : tasks;
  }

  /**
   * Get all boards with their tasks
   */
  async getAllBoards() {
    return await this.list();
  }

  /**
   * Move task to different board
   */
  async move(taskId, toBoard) {
    if (!this.boards.includes(toBoard)) {
      throw new Error(`Invalid board: ${toBoard}`);
    }

    // Find current location
    const currentLocation = await this.findTask(taskId);
    if (!currentLocation) {
      throw new Error(`Task ${taskId} not found`);
    }

    const { board: fromBoard, path: taskPath } = currentLocation;
    const fileName = path.basename(taskPath);
    const newPath = path.join(this.kanbanDir, toBoard, fileName);

    // Move file
    await fs.move(taskPath, newPath);

    return {
      success: true,
      taskId,
      from: fromBoard,
      to: toBoard,
      newPath
    };
  }

  /**
   * Find task across all boards
   */
  async findTask(taskId) {
    for (const board of this.boards) {
      const boardPath = path.join(this.kanbanDir, board);

      if (!(await fs.pathExists(boardPath))) continue;

      const files = await fs.readdir(boardPath);

      for (const file of files) {
        if (file.includes(taskId) || file.replace('.md', '') === taskId) {
          return {
            board,
            path: path.join(boardPath, file),
            file
          };
        }
      }
    }

    return null;
  }

  /**
   * Parse task markdown file
   */
  async parseTask(taskPath, board) {
    const fileName = path.basename(taskPath, '.md');
    const content = await fs.readFile(taskPath, 'utf8');

    // Extract title (first heading)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : fileName;

    // Extract metadata if present
    const metaMatch = content.match(/^---\n([\s\S]+?)\n---/);
    const meta = metaMatch ? this.parseMetadata(metaMatch[1]) : {};

    return {
      id: fileName,
      title,
      board,
      path: taskPath,
      ...meta,
      preview: content.substring(0, 200)
    };
  }

  /**
   * Parse metadata from task file
   */
  parseMetadata(metaString) {
    const meta = {};
    const lines = metaString.split('\n');

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        meta[key.trim()] = valueParts.join(':').trim();
      }
    }

    return meta;
  }
}

module.exports = KanbanManager;
