/**
 * Backup Manager - Create and restore backups for safe upgrades
 * Ensures atomic updates with rollback capability
 */

import fs from 'fs-extra';
import path from 'node:path';
import archiver from 'archiver';
import extract from 'extract-zip';

interface BackupManagerOptions {
  verbose?: boolean;
}

interface BackupMetadata {
  name: string;
  created: string;
  paths: string[];
  projectRoot: string;
  scVersion: string;
}

interface BackupInfo {
  success: boolean;
  name: string;
  path: string;
  metadata: BackupMetadata;
}

interface RestoreResult {
  success: boolean;
  restored: string[];
  failed: Array<{ path: string; error: string }>;
  metadata: BackupMetadata;
}

interface BackupListItem {
  name: string;
  created: string;
  size: number;
  paths: number;
  scVersion: string;
}

interface VerifyResult {
  zipExists: boolean;
  metadataExists: boolean;
  zipReadable: boolean;
  metadataValid: boolean;
  valid?: boolean;
}

interface HistoryEntry {
  name: string;
  created?: string;
  restored?: string;
  type: 'backup' | 'restore';
  paths?: number;
}

class BackupManager {
  protected backupDir: string;
  protected projectRoot: string;
  protected scDir: string;
  protected verbose: boolean;

  constructor(projectRoot: string, options: BackupManagerOptions = {}) {
    this.projectRoot = projectRoot;
    this.scDir = path.join(projectRoot, '.supernal-coding');
    this.backupDir = path.join(this.scDir, 'backups');
    this.verbose = options.verbose || false;
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.backupDir);
  }

  async createBackup(name: string, paths: string[] = []): Promise<BackupInfo> {
    await this.initialize();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${name}-${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);
    const metadataPath = path.join(this.backupDir, `${backupName}.json`);

    if (paths.length === 0) {
      paths = this.getDefaultBackupPaths();
    }

    const metadata: BackupMetadata = {
      name: backupName,
      created: new Date().toISOString(),
      paths,
      projectRoot: this.projectRoot,
      scVersion: await this.getSCVersion(),
    };

    await this.createZipArchive(backupPath, paths);

    await fs.writeJson(metadataPath, metadata, { spaces: 2 });

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

  getDefaultBackupPaths(): string[] {
    return [
      '.cursor/rules',
      'templates',
      '.supernal-coding/config.json',
      '.supernal-coding/version.json',
      '.supernal-coding/customizations.json',
    ];
  }

  async createZipArchive(outputPath: string, paths: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

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

  async restoreBackup(backupName: string): Promise<RestoreResult> {
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);
    const metadataPath = path.join(this.backupDir, `${backupName}.json`);

    if (!(await fs.pathExists(backupPath))) {
      throw new Error(`Backup not found: ${backupName}`);
    }

    const metadata: BackupMetadata = await fs.readJson(metadataPath);

    if (this.verbose) {
      console.log(`🔄 Restoring backup: ${backupName}`);
      console.log(`   Created: ${metadata.created}`);
      console.log(`   Files: ${metadata.paths.length}`);
    }

    const tempDir = path.join(this.backupDir, `restore-temp-${Date.now()}`);
    await fs.ensureDir(tempDir);

    try {
      await extract(backupPath, { dir: tempDir });

      const restored: string[] = [];
      const failed: Array<{ path: string; error: string }> = [];

      for (const relPath of metadata.paths) {
        const sourcePath = path.join(tempDir, relPath);
        const targetPath = path.join(this.projectRoot, relPath);

        try {
          if (await fs.pathExists(sourcePath)) {
            if (await fs.pathExists(targetPath)) {
              await fs.remove(targetPath);
            }

            await fs.copy(sourcePath, targetPath);
            restored.push(relPath);
          }
        } catch (error) {
          failed.push({ path: relPath, error: (error as Error).message });
        }
      }

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
      await fs.remove(tempDir);
      throw error;
    }
  }

  async listBackups(): Promise<BackupListItem[]> {
    await this.initialize();

    const files = await fs.readdir(this.backupDir);
    const backups: BackupListItem[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const metadataPath = path.join(this.backupDir, file);
        const metadata: BackupMetadata = await fs.readJson(metadataPath);

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

    backups.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return backups;
  }

  async getLatestBackup(): Promise<BackupListItem | null> {
    const backups = await this.listBackups();
    return backups.length > 0 ? backups[0] : null;
  }

  async cleanupOldBackups(keepCount: number = 5): Promise<{ deleted: number }> {
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

  async addToHistory(metadata: BackupMetadata): Promise<void> {
    const historyFile = path.join(this.scDir, 'backup-history.json');
    let history: HistoryEntry[] = [];

    if (await fs.pathExists(historyFile)) {
      history = await fs.readJson(historyFile);
    }

    history.push({
      name: metadata.name,
      created: metadata.created,
      type: 'backup',
      paths: metadata.paths.length,
    });

    if (history.length > 50) {
      history = history.slice(-50);
    }

    await fs.writeJson(historyFile, history, { spaces: 2 });
  }

  async addRestoreToHistory(backupName: string): Promise<void> {
    const historyFile = path.join(this.scDir, 'backup-history.json');
    let history: HistoryEntry[] = [];

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

  async getHistory(): Promise<HistoryEntry[]> {
    const historyFile = path.join(this.scDir, 'backup-history.json');

    if (!(await fs.pathExists(historyFile))) {
      return [];
    }

    return await fs.readJson(historyFile);
  }

  async getSCVersion(): Promise<string> {
    try {
      const packageJson = path.join(__dirname, '../../package.json');
      const pkg = await fs.readJson(packageJson);
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }

  async verifyBackup(backupName: string): Promise<VerifyResult> {
    const backupPath = path.join(this.backupDir, `${backupName}.zip`);
    const metadataPath = path.join(this.backupDir, `${backupName}.json`);

    const checks: VerifyResult = {
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

export default BackupManager;
module.exports = BackupManager;
