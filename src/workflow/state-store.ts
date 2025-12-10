import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { WorkflowState } from './state';

interface StateData {
  workflow: string;
  currentPhase: string;
  startedAt: string;
  phaseHistory?: unknown[];
  [key: string]: unknown;
}

/**
 * StateStore - Persist and load workflow state
 */
class StateStore {
  protected projectRoot: string;
  protected stateDir: string;
  protected stateFile: string;
  protected backupDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(projectRoot, '.supernal');
    this.stateFile = path.join(this.stateDir, 'workflow-state.yaml');
    this.backupDir = path.join(this.stateDir, 'state-backups');
  }

  async load(): Promise<WorkflowState> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf8');
      const data = yaml.parse(content);
      return WorkflowState.fromJSON(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new WorkflowState();
      }
      throw new Error(`Failed to load workflow state: ${(error as Error).message}`);
    }
  }

  async save(state: WorkflowState): Promise<void> {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });

      const content = yaml.stringify(state.toJSON(), {
        defaultStringType: 'QUOTE_DOUBLE'
      });

      await fs.writeFile(this.stateFile, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save workflow state: ${(error as Error).message}`);
    }
  }

  async backup(): Promise<string> {
    try {
      await fs.access(this.stateFile);

      await fs.mkdir(this.backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `state-${timestamp}.yaml`);

      await fs.copyFile(this.stateFile, backupFile);

      return timestamp;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('No state file to backup');
      }
      throw new Error(`Failed to create state backup: ${(error as Error).message}`);
    }
  }

  async restore(backupId: string): Promise<void> {
    try {
      const backupFile = path.join(this.backupDir, `state-${backupId}.yaml`);

      await fs.access(backupFile);

      await fs.copyFile(backupFile, this.stateFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Backup ${backupId} not found`);
      }
      throw new Error(`Failed to restore state backup: ${(error as Error).message}`);
    }
  }

  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      return files
        .filter((f) => f.startsWith('state-') && f.endsWith('.yaml'))
        .map((f) => f.replace('state-', '').replace('.yaml', ''))
        .sort()
        .reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to list backups: ${(error as Error).message}`);
    }
  }

  validate(state: StateData | null): boolean {
    if (!state) return false;

    const required: Array<keyof StateData> = ['workflow', 'currentPhase', 'startedAt'];
    for (const field of required) {
      if (!state[field]) return false;
    }

    if (state.phaseHistory && !Array.isArray(state.phaseHistory)) {
      return false;
    }

    return true;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.stateFile);
      return true;
    } catch {
      return false;
    }
  }

  async delete(): Promise<void> {
    try {
      await fs.unlink(this.stateFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to delete state file: ${(error as Error).message}`);
      }
    }
  }
}

export { StateStore };
module.exports = { StateStore };
