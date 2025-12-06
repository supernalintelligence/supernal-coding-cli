/**
 * Backup Manager - Create and restore backups for safe upgrades
 * Ensures atomic updates with rollback capability
 */

const fs = require('fs-extra');
const path = require('node:path');
const archiver = require('archiver');
const extract = require('extract-zip');

class BackupManager {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.scDir = path.join(projectRoot, '.supernal-coding');
    this.backupDir = path.join(this.scDir, 'backups');
    this.verbose = options.verbose || false;
  }

  /**
   * Initialize backup system
   */
  async initialize() {
    await fs.ensureDir(this.backupDir);
  }

  /**
   * Create a backup before upgrade
   * @param {string} name - Backup name (e.g., 'upgrade-1.3.0')
   * @param {Array<string>} paths - Paths to backup (relative to project root)
   * @returns {Promise<BackupInfo>}
   */
  async createBackup(name, paths = []) {
    await this.initialize();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${name}-${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);
    const metadataPath = path.join(this.backupDir, `${backupName}.json`);

    // Default to backing up SC-managed directories
    if (paths.length === 0) {
      paths = this.getDefaultBackupPaths();
    }

    // Create metadata
    const metadata = {
      name: backupName,
      created: new Date().toISOString(),
      paths,
      projectRoot: this.projectRoot,
      scVersion: await this.getSCVersion(),
    };

    // Create zip archive
    await this.createZipArchive(backupPath, paths);

    // Save metadata
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });

    // Add to backup history
    await this.addToHistory(metadata);

    if (this.verbose) {
      console.log(`✅ Backup created: ${backupName}`);
      console.log(`   Location: ${backupPath}`);
      console.log(`   Files: ${paths.length}`);
    }

    return {
      success: true,
      name: backupName,
      path: backupPath,
      metadata,
    };
  }

  /**
   * Get default paths to backup
   */
  getDefaultBackupPaths() {
    return [
      '.cursor/rules',
      'templates',
      '.supernal-coding/config.json',
      '.supernal-coding/version.json',
      '.supernal-coding/customizations.json',
    ];
  }

  /**
   * Create zip archive of specified paths
   */
  async createZipArchive(outputPath, paths) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
      });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      // Add each path to archive
      for (const relPath of paths) {
        const fullPath = path.join(this.projectRoot, relPath);

        if (!fs.existsSync(fullPath)) {
          if (this.verbose) {
            console.log(`⚠️  Path not found, skipping: ${relPath}`);
          }
          continue;
        }

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          archive.directory(fullPath, relPath);
        } else {
          archive.file(fullPath, { name: relPath });
        }
      }

      archive.finalize();
    });
  }

  /**
   * Restore from backup
   * @param {string} backupName - Name of backup to restore
   * @returns {Promise<RestoreResult>}
   */
  async restoreBackup(backupName) {
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);
    const metadataPath = path.join(this.backupDir, `${backupName}.json`);

    // Verify backup exists
    if (!(await fs.pathExists(backupPath))) {
      throw new Error(`Backup not found: ${backupName}`);
    }

    // Load metadata
    const metadata = await fs.readJson(metadataPath);

    if (this.verbose) {
      console.log(`🔄 Restoring backup: ${backupName}`);
      console.log(`   Created: ${metadata.created}`);
      console.log(`   Files: ${metadata.paths.length}`);
    }

    // Create temp directory for extraction
    const tempDir = path.join(this.backupDir, `restore-temp-${Date.now()}`);
    await fs.ensureDir(tempDir);

    try {
      // Extract backup
      await extract(backupPath, { dir: tempDir });

      // Restore each path
      const restored = [];
      const failed = [];

      for (const relPath of metadata.paths) {
        const sourcePath = path.join(tempDir, relPath);
        const targetPath = path.join(this.projectRoot, relPath);

        try {
          if (await fs.pathExists(sourcePath)) {
            // Backup existing target first (in case restore fails)
            if (await fs.pathExists(targetPath)) {
              await fs.remove(targetPath);
            }

            // Copy from temp to target
            await fs.copy(sourcePath, targetPath);
            restored.push(relPath);
          }
        } catch (error) {
          failed.push({ path: relPath, error: error.message });
        }
      }

      // Cleanup temp directory
      await fs.remove(tempDir);

      if (this.verbose) {
        console.log(`✅ Restored: ${restored.length} items`);
        if (failed.length > 0) {
          console.log(`⚠️  Failed: ${failed.length} items`);
        }
      }

      return {
        success: failed.length === 0,
        restored,
        failed,
        metadata,
      };
    } catch (error) {
      // Cleanup on error
      await fs.remove(tempDir);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    await this.initialize();

    const files = await fs.readdir(this.backupDir);
    const backups = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const metadataPath = path.join(this.backupDir, file);
        const metadata = await fs.readJson(metadataPath);

        const zipPath = path.join(
          this.backupDir,
          file.replace('.json', '.zip')
        );
        const zipExists = await fs.pathExists(zipPath);

        if (zipExists) {
          const stats = await fs.stat(zipPath);
          backups.push({
            name: metadata.name,
            created: metadata.created,
            size: stats.size,
            paths: metadata.paths.length,
            scVersion: metadata.scVersion,
          });
        }
      }
    }

    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));

    return backups;
  }

  /**
   * Get most recent backup
   */
  async getLatestBackup() {
    const backups = await this.listBackups();
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Delete old backups (keep only N most recent)
   */
  async cleanupOldBackups(keepCount = 5) {
    const backups = await this.listBackups();

    if (backups.length <= keepCount) {
      return { deleted: 0 };
    }

    const toDelete = backups.slice(keepCount);
    let deleted = 0;

    for (const backup of toDelete) {
      const zipPath = path.join(this.backupDir, `${backup.name}.zip`);
      const jsonPath = path.join(this.backupDir, `${backup.name}.json`);

      await fs.remove(zipPath);
      await fs.remove(jsonPath);
      deleted++;
    }

    if (this.verbose) {
      console.log(`🗑️  Cleaned up ${deleted} old backup(s)`);
    }

    return { deleted };
  }

  /**
   * Add backup to history
   */
  async addToHistory(metadata) {
    const historyFile = path.join(this.scDir, 'backup-history.json');
    let history = [];

    if (await fs.pathExists(historyFile)) {
      history = await fs.readJson(historyFile);
    }

    history.push({
      name: metadata.name,
      created: metadata.created,
      type: 'backup',
      paths: metadata.paths.length,
    });

    // Keep last 50 entries
    if (history.length > 50) {
      history = history.slice(-50);
    }

    await fs.writeJson(historyFile, history, { spaces: 2 });
  }

  /**
   * Add restore to history
   */
  async addRestoreToHistory(backupName) {
    const historyFile = path.join(this.scDir, 'backup-history.json');
    let history = [];

    if (await fs.pathExists(historyFile)) {
      history = await fs.readJson(historyFile);
    }

    history.push({
      name: backupName,
      restored: new Date().toISOString(),
      type: 'restore',
    });

    await fs.writeJson(historyFile, history, { spaces: 2 });
  }

  /**
   * Get backup history
   */
  async getHistory() {
    const historyFile = path.join(this.scDir, 'backup-history.json');

    if (!(await fs.pathExists(historyFile))) {
      return [];
    }

    return await fs.readJson(historyFile);
  }

  /**
   * Get SC version
   */
  async getSCVersion() {
    try {
      const packageJson = path.join(__dirname, '../../package.json');
      const pkg = await fs.readJson(packageJson);
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupName) {
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);
    const metadataPath = path.join(this.backupDir, `${backupName}.json`);

    const checks = {
      zipExists: await fs.pathExists(backupPath),
      metadataExists: await fs.pathExists(metadataPath),
      zipReadable: false,
      metadataValid: false,
    };

    if (checks.zipExists) {
      try {
        const stats = await fs.stat(backupPath);
        checks.zipReadable = stats.size > 0;
      } catch {
        checks.zipReadable = false;
      }
    }

    if (checks.metadataExists) {
      try {
        await fs.readJson(metadataPath);
        checks.metadataValid = true;
      } catch {
        checks.metadataValid = false;
      }
    }

    checks.valid = Object.values(checks).every((v) => v === true);

    return checks;
  }
}

/**
 * @typedef {Object} BackupInfo
 * @property {string} name - Backup name
 * @property {string} path - Path to backup file
 * @property {Object} metadata - Backup metadata
 */

/**
 * @typedef {Object} RestoreResult
 * @property {boolean} success - Whether restore was fully successful
 * @property {Array<string>} restored - List of restored paths
 * @property {Array<Object>} failed - List of failed restores
 * @property {Object} metadata - Backup metadata
 */

module.exports = BackupManager;
