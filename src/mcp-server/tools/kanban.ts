/**
 * Kanban Manager for MCP Server
 *
 * Handles kanban board operations via MCP tools
 */

import fs from 'fs-extra';
import path from 'node:path';

interface TaskMeta {
  [key: string]: string;
}

interface Task {
  id: string;
  title: string;
  board: string;
  path: string;
  preview: string;
  [key: string]: unknown;
}

interface TaskLocation {
  board: string;
  path: string;
  file: string;
}

interface MoveResult {
  success: boolean;
  taskId: string;
  from: string;
  to: string;
  newPath: string;
}

type BoardName = 'BRAINSTORM' | 'PLANNING' | 'TODO' | 'DOING' | 'BLOCKED' | 'DONE' | 'HANDOFFS';

class KanbanManager {
  protected projectRoot: string;
  protected kanbanDir: string;
  protected boards: BoardName[];

  constructor(projectRoot: string) {
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

  async list(board: string | null = null): Promise<Record<string, Task[]> | Task[]> {
    const boards = board ? [board] : this.boards;
    const tasks: Record<string, Task[]> = {};

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

  async getAllBoards(): Promise<Record<string, Task[]>> {
    return await this.list() as Record<string, Task[]>;
  }

  async move(taskId: string, toBoard: BoardName): Promise<MoveResult> {
    if (!this.boards.includes(toBoard)) {
      throw new Error(`Invalid board: ${toBoard}`);
    }

    const currentLocation = await this.findTask(taskId);
    if (!currentLocation) {
      throw new Error(`Task ${taskId} not found`);
    }

    const { board: fromBoard, path: taskPath } = currentLocation;
    const fileName = path.basename(taskPath);
    const newPath = path.join(this.kanbanDir, toBoard, fileName);

    await fs.move(taskPath, newPath);

    return {
      success: true,
      taskId,
      from: fromBoard,
      to: toBoard,
      newPath
    };
  }

  async findTask(taskId: string): Promise<TaskLocation | null> {
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

  async parseTask(taskPath: string, board: string): Promise<Task> {
    const fileName = path.basename(taskPath, '.md');
    const content = await fs.readFile(taskPath, 'utf8');

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : fileName;

    const metaMatch = content.match(/^---\n([\s\S]+?)\n---/);
    const meta: TaskMeta = metaMatch ? this.parseMetadata(metaMatch[1]) : {};

    return {
      id: fileName,
      title,
      board,
      path: taskPath,
      ...meta,
      preview: content.substring(0, 200)
    };
  }

  parseMetadata(metaString: string): TaskMeta {
    const meta: TaskMeta = {};
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

export default KanbanManager;
module.exports = KanbanManager;
