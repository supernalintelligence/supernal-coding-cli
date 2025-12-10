/**
 * FileChangeDetector - Unified base class for hash-based change detection
 *
 * Provides common functionality for:
 * - RuleChangeDetector
 * - CustomizationDetector
 * - CLI sync-check
 * - Compliance validation
 * - iResource sync status
 *
 * See README.md for usage examples.
 */

import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import { glob } from 'glob';

const HASH_ALGORITHM = 'sha256';

interface FileMetadata {
  path: string;
  relativePath: string;
  size: number;
  modified: string;
  hash: string | null;
}

interface FileState {
  files: Record<string, FileMetadata>;
  metadata?: {
    watchPatterns: string[];
    ignorePatterns: string[];
    fileCount: number;
  };
  timestamp?: string;
  detector?: string;
}

interface Change {
  type: 'added' | 'modified' | 'deleted';
  path: string;
  file: FileMetadata;
  previousFile?: FileMetadata;
  previousHash?: string | null;
  currentHash?: string | null;
  timestamp: string;
}

interface ChangeSummary {
  added: Change[];
  modified: Change[];
  deleted: Change[];
  counts: {
    added: number;
    modified: number;
    deleted: number;
    total: number;
  };
}

interface DetectionResult {
  hasChanges: boolean;
  changes: Change[];
  summary: ChangeSummary;
  previousTimestamp?: string;
  currentTimestamp?: string;
}

interface DetectOptions {
  saveState?: boolean;
}

interface FileChangeDetectorOptions {
  projectRoot?: string;
  stateFile?: string;
  watchPatterns?: string[];
  ignorePatterns?: string[];
  normalizeLineEndings?: boolean;
  name?: string;
}

interface ProofDocument {
  version: string;
  type: string;
  detector: string;
  generatedAt: string;
  projectRoot: string;
  stateFile: string;
  configuration: {
    watchPatterns: string[];
    ignorePatterns: string[];
    hashAlgorithm: string;
  };
  state: {
    timestamp: string | undefined;
    fileCount: number;
    files: Record<string, FileMetadata>;
  };
  stateHash: string | null;
}

interface VerificationResult {
  verified: boolean;
  proofTimestamp: string;
  verifiedAt: string;
  discrepancies: Array<{
    path: string;
    type: 'missing' | 'modified' | 'added';
    expected?: string | null | FileMetadata;
    actual?: string | null;
  }>;
}

class FileChangeDetector {
  protected changes: Change[];
  protected currentState: FileState | null;
  protected ignorePatterns: string[];
  protected name: string;
  protected normalizeLineEndings: boolean;
  protected previousState: FileState | null;
  public projectRoot: string;
  protected stateFile: string;
  protected watchPatterns: string[];

  constructor(options: FileChangeDetectorOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.stateFile = path.join(
      this.projectRoot,
      options.stateFile || '.supernal/change-state.json'
    );
    this.watchPatterns = options.watchPatterns || ['**/*'];
    this.ignorePatterns = options.ignorePatterns || [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**'
    ];
    this.normalizeLineEndings = options.normalizeLineEndings !== false;
    this.name = options.name || 'FileChangeDetector';

    this.previousState = null;
    this.currentState = null;
    this.changes = [];
  }

  async hashFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.hashContent(content);
    } catch (_error) {
      return null;
    }
  }

  hashContent(content: string | null): string | null {
    if (!content) return null;

    let normalized = content;
    if (this.normalizeLineEndings) {
      normalized = content.replace(/\r\n/g, '\n');
    }

    return crypto.createHash(HASH_ALGORITHM).update(normalized).digest('hex');
  }

  async hashBinaryFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash(HASH_ALGORITHM).update(content).digest('hex');
    } catch (_error) {
      return null;
    }
  }

  async loadState(): Promise<FileState> {
    try {
      if (await fs.pathExists(this.stateFile)) {
        this.previousState = await fs.readJson(this.stateFile);
        return this.previousState!;
      }
    } catch (error) {
      console.warn(`[${this.name}] Could not load state: ${(error as Error).message}`);
    }
    this.previousState = { files: {}, metadata: { watchPatterns: [], ignorePatterns: [], fileCount: 0 } };
    return this.previousState;
  }

  async saveState(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.stateFile));
      await fs.writeJson(this.stateFile, this.currentState, { spaces: 2 });
    } catch (error) {
      console.warn(`[${this.name}] Could not save state: ${(error as Error).message}`);
    }
  }

  async scanFiles(): Promise<string[]> {
    const allFiles = new Set<string>();

    for (const pattern of this.watchPatterns) {
      try {
        const files = await glob(pattern, {
          cwd: this.projectRoot,
          absolute: true,
          ignore: this.ignorePatterns,
          nodir: true
        });
        files.forEach((f) => allFiles.add(f));
      } catch (error) {
        console.warn(
          `[${this.name}] Error scanning pattern "${pattern}": ${(error as Error).message}`
        );
      }
    }

    const existingFiles: string[] = [];
    for (const file of allFiles) {
      if (await fs.pathExists(file)) {
        existingFiles.push(file);
      }
    }

    return existingFiles;
  }

  async getFileMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const stats = await fs.stat(filePath);
      const hash = await this.hashFile(filePath);

      return {
        path: filePath,
        relativePath: path.relative(this.projectRoot, filePath),
        size: stats.size,
        modified: stats.mtime.toISOString(),
        hash: hash
      };
    } catch (_error) {
      return null;
    }
  }

  async buildCurrentState(): Promise<FileState> {
    const files = await this.scanFiles();
    const currentState: FileState = {
      timestamp: new Date().toISOString(),
      detector: this.name,
      files: {},
      metadata: {
        watchPatterns: this.watchPatterns,
        ignorePatterns: this.ignorePatterns,
        fileCount: files.length
      }
    };

    for (const filePath of files) {
      const metadata = await this.getFileMetadata(filePath);
      if (metadata) {
        currentState.files[metadata.relativePath] = metadata;
      }
    }

    this.currentState = currentState;
    return currentState;
  }

  compareStates(): Change[] {
    const changes: Change[] = [];
    const previousFiles = this.previousState?.files || {};
    const currentFiles = this.currentState?.files || {};

    for (const [relativePath, currentFile] of Object.entries(currentFiles)) {
      if (!previousFiles[relativePath]) {
        changes.push({
          type: 'added',
          path: relativePath,
          file: currentFile,
          timestamp: new Date().toISOString()
        });
      }
    }

    for (const [relativePath, currentFile] of Object.entries(currentFiles)) {
      const previousFile = previousFiles[relativePath];
      if (previousFile && previousFile.hash !== currentFile.hash) {
        changes.push({
          type: 'modified',
          path: relativePath,
          file: currentFile,
          previousFile: previousFile,
          previousHash: previousFile.hash,
          currentHash: currentFile.hash,
          timestamp: new Date().toISOString()
        });
      }
    }

    for (const [relativePath, previousFile] of Object.entries(previousFiles)) {
      if (!currentFiles[relativePath]) {
        changes.push({
          type: 'deleted',
          path: relativePath,
          file: previousFile,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.changes = changes;
    return changes;
  }

  async detectChanges(options: DetectOptions = {}): Promise<DetectionResult> {
    const { saveState = true } = options;

    await this.loadState();
    await this.buildCurrentState();
    const changes = this.compareStates();

    if (saveState) {
      await this.saveState();
    }

    return {
      hasChanges: changes.length > 0,
      changes: changes,
      summary: this.getSummary(changes),
      previousTimestamp: this.previousState?.timestamp,
      currentTimestamp: this.currentState?.timestamp
    };
  }

  getSummary(changes: Change[]): ChangeSummary {
    const summary = {
      added: changes.filter((c) => c.type === 'added'),
      modified: changes.filter((c) => c.type === 'modified'),
      deleted: changes.filter((c) => c.type === 'deleted')
    };

    return {
      ...summary,
      counts: {
        added: summary.added.length,
        modified: summary.modified.length,
        deleted: summary.deleted.length,
        total: changes.length
      }
    };
  }

  async generateProofDocument(): Promise<ProofDocument> {
    if (!this.currentState) {
      await this.buildCurrentState();
    }

    const proof: ProofDocument = {
      version: '1.0.0',
      type: 'file-state-proof',
      detector: this.name,
      generatedAt: new Date().toISOString(),
      projectRoot: this.projectRoot,
      stateFile: this.stateFile,
      configuration: {
        watchPatterns: this.watchPatterns,
        ignorePatterns: this.ignorePatterns,
        hashAlgorithm: HASH_ALGORITHM
      },
      state: {
        timestamp: this.currentState!.timestamp,
        fileCount: Object.keys(this.currentState!.files).length,
        files: this.currentState!.files
      },
      stateHash: this.hashContent(
        Object.values(this.currentState!.files)
          .map((f) => f.hash)
          .sort()
          .join('')
      )
    };

    return proof;
  }

  async verifyProofDocument(proof: ProofDocument): Promise<VerificationResult> {
    await this.buildCurrentState();

    const currentStateHash = this.hashContent(
      Object.values(this.currentState!.files)
        .map((f) => f.hash)
        .sort()
        .join('')
    );

    const matches = proof.stateHash === currentStateHash;
    const discrepancies: VerificationResult['discrepancies'] = [];

    if (!matches) {
      const proofFiles = proof.state.files || {};
      const currentFiles = this.currentState!.files || {};

      for (const [filePath, proofFile] of Object.entries(proofFiles)) {
        const currentFile = currentFiles[filePath];
        if (!currentFile) {
          discrepancies.push({ path: filePath, type: 'missing', expected: proofFile });
        } else if (currentFile.hash !== proofFile.hash) {
          discrepancies.push({
            path: filePath,
            type: 'modified',
            expected: proofFile.hash,
            actual: currentFile.hash
          });
        }
      }

      for (const filePath of Object.keys(currentFiles)) {
        if (!proofFiles[filePath]) {
          discrepancies.push({ path: filePath, type: 'added' });
        }
      }
    }

    return {
      verified: matches,
      proofTimestamp: proof.generatedAt,
      verifiedAt: new Date().toISOString(),
      discrepancies
    };
  }
}

export {
  FileChangeDetector,
  HASH_ALGORITHM
};
module.exports = {
  FileChangeDetector,
  HASH_ALGORITHM
};
