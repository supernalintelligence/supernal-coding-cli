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

const fs = require('fs-extra');
const path = require('node:path');
const crypto = require('node:crypto');
const { glob } = require('glob');

// Standard hash algorithm for all SC change detection
const HASH_ALGORITHM = 'sha256';

class FileChangeDetector {
  /**
   * @param {Object} options
   * @param {string} options.projectRoot - Project root directory
   * @param {string} options.stateFile - Relative path to state file
   * @param {string[]} options.watchPatterns - Glob patterns to watch
   * @param {string[]} options.ignorePatterns - Glob patterns to ignore
   * @param {boolean} options.normalizeLineEndings - Normalize CRLF to LF before hashing
   * @param {string} options.name - Detector name for logging/audit
   */
  constructor(options = {}) {
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

    // State
    this.previousState = null;
    this.currentState = null;
    this.changes = [];
  }

  // ========================================
  // Core Hashing Functions
  // ========================================

  /**
   * Hash file contents
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<string|null>} SHA-256 hash or null if file unreadable
   */
  async hashFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.hashContent(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Hash string content
   * @param {string} content - Content to hash
   * @returns {string} SHA-256 hash
   */
  hashContent(content) {
    if (!content) return null;

    let normalized = content;
    if (this.normalizeLineEndings) {
      normalized = content.replace(/\r\n/g, '\n');
    }

    return crypto.createHash(HASH_ALGORITHM).update(normalized).digest('hex');
  }

  /**
   * Hash binary file (for non-text files)
   * @param {string} filePath - Absolute path to file
   * @returns {Promise<string|null>} SHA-256 hash or null
   */
  async hashBinaryFile(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash(HASH_ALGORITHM).update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  // ========================================
  // State Management
  // ========================================

  /**
   * Load previous state from disk
   * @returns {Promise<Object>} Previous state or empty object
   */
  async loadState() {
    try {
      if (await fs.pathExists(this.stateFile)) {
        this.previousState = await fs.readJson(this.stateFile);
        return this.previousState;
      }
    } catch (error) {
      console.warn(`[${this.name}] Could not load state: ${error.message}`);
    }
    this.previousState = { files: {}, metadata: {} };
    return this.previousState;
  }

  /**
   * Save current state to disk
   * @returns {Promise<void>}
   */
  async saveState() {
    try {
      await fs.ensureDir(path.dirname(this.stateFile));
      await fs.writeJson(this.stateFile, this.currentState, { spaces: 2 });
    } catch (error) {
      console.warn(`[${this.name}] Could not save state: ${error.message}`);
    }
  }

  // ========================================
  // File Scanning
  // ========================================

  /**
   * Scan for files matching watch patterns
   * @returns {Promise<string[]>} Array of absolute file paths
   */
  async scanFiles() {
    const allFiles = new Set();

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
          `[${this.name}] Error scanning pattern "${pattern}": ${error.message}`
        );
      }
    }

    // Filter to existing files only
    const existingFiles = [];
    for (const file of allFiles) {
      if (await fs.pathExists(file)) {
        existingFiles.push(file);
      }
    }

    return existingFiles;
  }

  /**
   * Get metadata for a file
   * @param {string} filePath - Absolute path
   * @returns {Promise<Object|null>} File metadata or null
   */
  async getFileMetadata(filePath) {
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
    } catch (error) {
      return null;
    }
  }

  // ========================================
  // Change Detection
  // ========================================

  /**
   * Build current state from filesystem
   * @returns {Promise<Object>} Current state
   */
  async buildCurrentState() {
    const files = await this.scanFiles();
    const currentState = {
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

  /**
   * Compare previous and current state to detect changes
   * @returns {Object[]} Array of change objects
   */
  compareStates() {
    const changes = [];
    const previousFiles = this.previousState?.files || {};
    const currentFiles = this.currentState?.files || {};

    // Check for added files
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

    // Check for modified files
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

    // Check for deleted files
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

  /**
   * Main entry point - detect changes
   * @param {Object} options
   * @param {boolean} options.saveState - Whether to save state after detection
   * @returns {Promise<Object>} Detection result
   */
  async detectChanges(options = {}) {
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

  /**
   * Get summary of changes
   * @param {Object[]} changes - Array of changes
   * @returns {Object} Summary object
   */
  getSummary(changes) {
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

  // ========================================
  // Audit & Evidence Generation
  // ========================================

  /**
   * Generate proof-of-state document
   * Useful for compliance evidence
   * @returns {Object} Proof document
   */
  async generateProofDocument() {
    if (!this.currentState) {
      await this.buildCurrentState();
    }

    const proof = {
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
        timestamp: this.currentState.timestamp,
        fileCount: Object.keys(this.currentState.files).length,
        files: this.currentState.files
      },
      // Create a single hash of all file hashes for quick verification
      stateHash: this.hashContent(
        Object.values(this.currentState.files)
          .map((f) => f.hash)
          .sort()
          .join('')
      )
    };

    return proof;
  }

  /**
   * Verify a proof document against current state
   * @param {Object} proof - Proof document to verify
   * @returns {Object} Verification result
   */
  async verifyProofDocument(proof) {
    await this.buildCurrentState();

    const currentStateHash = this.hashContent(
      Object.values(this.currentState.files)
        .map((f) => f.hash)
        .sort()
        .join('')
    );

    const matches = proof.stateHash === currentStateHash;
    const discrepancies = [];

    if (!matches) {
      // Find specific discrepancies
      const proofFiles = proof.state.files || {};
      const currentFiles = this.currentState.files || {};

      for (const [path, proofFile] of Object.entries(proofFiles)) {
        const currentFile = currentFiles[path];
        if (!currentFile) {
          discrepancies.push({ path, type: 'missing', expected: proofFile });
        } else if (currentFile.hash !== proofFile.hash) {
          discrepancies.push({
            path,
            type: 'modified',
            expected: proofFile.hash,
            actual: currentFile.hash
          });
        }
      }

      for (const path of Object.keys(currentFiles)) {
        if (!proofFiles[path]) {
          discrepancies.push({ path, type: 'added' });
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

// Export class and constants
module.exports = {
  FileChangeDetector,
  HASH_ALGORITHM
};

