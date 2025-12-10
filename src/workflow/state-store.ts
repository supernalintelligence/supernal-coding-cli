// @ts-nocheck
const fs = require('node:fs').promises;
const path = require('node:path');
const yaml = require('yaml');
const { WorkflowState } = require('./state');

/**
 * StateStore - Persist and load workflow state
 */
class StateStore {
  backupDir: any;
  projectRoot: any;
  stateDir: any;
  stateFile: any;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(projectRoot, '.supernal');
    this.stateFile = path.join(this.stateDir, 'workflow-state.yaml');
    this.backupDir = path.join(this.stateDir, 'state-backups');
  }

  /**
   * Load state from file
   * @returns {Promise<WorkflowState>}
   */
  async load() {
    try {
      const content = await fs.readFile(this.stateFile, 'utf8');
      const data = yaml.parse(content);
      return WorkflowState.fromJSON(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - return empty state
        return new WorkflowState();
      }
      throw new Error(`Failed to load workflow state: ${error.message}`);
    }
  }

  /**
   * Save state to file
   * @param {WorkflowState} state
   */
  async save(state) {
    try {
      // Ensure directory exists
      await fs.mkdir(this.stateDir, { recursive: true });

      // Serialize and write
      const content = yaml.stringify(state.toJSON(), {
        defaultStringType: 'QUOTE_DOUBLE'
      });

      await fs.writeFile(this.stateFile, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save workflow state: ${error.message}`);
    }
  }

  /**
   * Create state backup
   * @returns {Promise<string>} Backup ID (timestamp)
   */
  async backup() {
    try {
      // Ensure state file exists
      await fs.access(this.stateFile);

      // Create backup directory
      await fs.mkdir(this.backupDir, { recursive: true });

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `state-${timestamp}.yaml`);

      // Copy current state to backup
      await fs.copyFile(this.stateFile, backupFile);

      return timestamp;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('No state file to backup');
      }
      throw new Error(`Failed to create state backup: ${error.message}`);
    }
  }

  /**
   * Restore from backup
   * @param {string} backupId - Timestamp ID of backup
   */
  async restore(backupId) {
    try {
      const backupFile = path.join(this.backupDir, `state-${backupId}.yaml`);

      // Check backup exists
      await fs.access(backupFile);

      // Copy backup to current state
      await fs.copyFile(backupFile, this.stateFile);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Backup ${backupId} not found`);
      }
      throw new Error(`Failed to restore state backup: ${error.message}`);
    }
  }

  /**
   * List available backups
   * @returns {Promise<Array<string>>} Array of backup IDs
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      return files
        .filter((f) => f.startsWith('state-') && f.endsWith('.yaml'))
        .map((f) => f.replace('state-', '').replace('.yaml', ''))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  /**
   * Validate state structure
   * @param {Object} state
   * @returns {boolean}
   */
  validate(state) {
    if (!state) return false;

    // Required fields
    const required = ['workflow', 'currentPhase', 'startedAt'];
    for (const field of required) {
      if (!state[field]) return false;
    }

    // phaseHistory must be array
    if (state.phaseHistory && !Array.isArray(state.phaseHistory)) {
      return false;
    }

    return true;
  }

  /**
   * Check if state file exists
   * @returns {Promise<boolean>}
   */
  async exists() {
    try {
      await fs.access(this.stateFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete state file
   */
  async delete() {
    try {
      await fs.unlink(this.stateFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to delete state file: ${error.message}`);
      }
    }
  }
}

module.exports = { StateStore };
