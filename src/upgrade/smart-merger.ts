// @ts-nocheck
/**
 * Smart Merge Engine - Intelligent three-way merge for SC upgrades and syncs
 * Shared by both template upgrades (sc upgrade) and repository syncs (sc sync)
 */

const fs = require('fs-extra');
const crypto = require('node:crypto');

/**
 * Merge strategies for different types of conflicts
 */
const MergeStrategy = {
  OURS: 'ours', // Keep our version
  THEIRS: 'theirs', // Take their version
  MERGE: 'merge', // Attempt intelligent merge
  MANUAL: 'manual', // Require manual resolution
  AUTO: 'auto', // Auto-decide based on rules
};

/**
 * Conflict types
 */
const ConflictType = {
  CONTENT: 'content', // File content differs
  DELETED: 'deleted', // File deleted in one version
  ADDED: 'added', // File added in one version
  BINARY: 'binary', // Binary file conflict
  PERMISSION: 'permission', // Permission difference
};

class SmartMerger {
  dryRun: any;
  strategy: any;
  verbose: any;
  constructor(options = {}) {
    this.strategy = options.strategy || MergeStrategy.AUTO;
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
  }

  /**
   * Perform a three-way merge
   * @param {Object} versions - { base, ours, theirs }
   * @param {string} versions.base - Original/common ancestor version
   * @param {string} versions.ours - Our current version
   * @param {string} versions.theirs - Their/upstream version
   * @returns {Promise<MergeResult>}
   */
  async threeWayMerge(versions) {
    const { base, ours, theirs } = versions;

    // If all three are identical, no conflict
    if (this.areIdentical(base, ours, theirs)) {
      return {
        success: true,
        merged: ours,
        conflicts: [],
        strategy: 'no-change',
      };
    }

    // If ours === base, theirs changed
    if (this.areIdentical(base, ours)) {
      return {
        success: true,
        merged: theirs,
        conflicts: [],
        strategy: 'fast-forward',
        message: 'Fast-forward: taking upstream changes',
      };
    }

    // If theirs === base, we changed
    if (this.areIdentical(base, theirs)) {
      return {
        success: true,
        merged: ours,
        conflicts: [],
        strategy: 'keep-ours',
        message: 'No upstream changes, keeping our version',
      };
    }

    // Both changed - need actual merge
    return await this.performMerge(versions);
  }

  /**
   * Check if versions are identical
   */
  areIdentical(...versions) {
    if (versions.length < 2) return true;
    const hashes = versions.map((v) => this.hash(v));
    return new Set(hashes).size === 1;
  }

  /**
   * Hash content for comparison
   */
  hash(content) {
    if (!content) return null;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Perform actual merge when all three differ
   */
  async performMerge(versions) {
    const { _, ours, theirs } = versions;

    // Try line-based merge for text files
    if (this.isTextFile(ours) && this.isTextFile(theirs)) {
      return await this.lineBasedMerge(versions);
    }

    // For binary files or non-text, require manual resolution
    return {
      success: false,
      conflicts: [
        {
          type: ConflictType.BINARY,
          message: 'Binary file or non-text requires manual resolution',
          ours,
          theirs,
        },
      ],
      strategy: MergeStrategy.MANUAL,
    };
  }

  /**
   * Line-based merge for text files
   */
  async lineBasedMerge(versions) {
    const { base, ours, theirs } = versions;

    const baseLines = this.splitLines(base);
    const ourLines = this.splitLines(ours);
    const theirLines = this.splitLines(theirs);

    // Find changes from base
    const ourChanges = this.diff(baseLines, ourLines);
    const theirChanges = this.diff(baseLines, theirLines);

    // Check for conflicting changes
    const conflicts = this.findConflicts(ourChanges, theirChanges);

    if (conflicts.length === 0) {
      // No conflicts - can merge automatically
      const merged = this.applyChanges(baseLines, ourChanges, theirChanges);
      return {
        success: true,
        merged: merged.join('\n'),
        conflicts: [],
        strategy: 'auto-merge',
      };
    }

    // Has conflicts - return conflict markers or require manual
    if (
      this.strategy === MergeStrategy.AUTO ||
      this.strategy === MergeStrategy.MERGE
    ) {
      const merged = this.mergeWithConflictMarkers(
        baseLines,
        ourChanges,
        theirChanges,
        conflicts
      );
      return {
        success: false,
        merged: merged.join('\n'),
        conflicts: conflicts.map((c) => ({
          type: ConflictType.CONTENT,
          line: c.line,
          ours: c.oursContent,
          theirs: c.theirsContent,
        })),
        strategy: MergeStrategy.MANUAL,
        message: `${conflicts.length} conflict(s) require manual resolution`,
      };
    }

    return {
      success: false,
      conflicts: conflicts,
      strategy: MergeStrategy.MANUAL,
    };
  }

  /**
   * Split text into lines
   */
  splitLines(text) {
    if (!text) return [];
    return text.split('\n');
  }

  /**
   * Simple diff between two line arrays
   */
  diff(base, modified) {
    const changes = [];
    const maxLen = Math.max(base.length, modified.length);

    for (let i = 0; i < maxLen; i++) {
      const baseLine = base[i];
      const modLine = modified[i];

      if (baseLine !== modLine) {
        if (baseLine === undefined) {
          changes.push({ type: 'add', line: i, content: modLine });
        } else if (modLine === undefined) {
          changes.push({ type: 'delete', line: i, content: baseLine });
        } else {
          changes.push({
            type: 'modify',
            line: i,
            from: baseLine,
            to: modLine,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Find conflicting changes
   */
  findConflicts(ourChanges, theirChanges) {
    const conflicts = [];
    const ourLines = new Set(ourChanges.map((c) => c.line));
    const theirLines = new Set(theirChanges.map((c) => c.line));

    // Lines changed in both versions
    const conflictLines = [...ourLines].filter((line) => theirLines.has(line));

    conflictLines.forEach((line) => {
      const ourChange = ourChanges.find((c) => c.line === line);
      const theirChange = theirChanges.find((c) => c.line === line);

      // Only conflict if they changed to different things
      if (ourChange.to !== theirChange.to) {
        conflicts.push({
          line,
          oursContent: ourChange.to,
          theirsContent: theirChange.to,
        });
      }
    });

    return conflicts;
  }

  /**
   * Apply non-conflicting changes
   */
  applyChanges(baseLines, ourChanges, theirChanges) {
    const result = [...baseLines];

    // Apply our changes first
    ourChanges.forEach((change) => {
      if (change.type === 'modify') {
        result[change.line] = change.to;
      } else if (change.type === 'add') {
        result.splice(change.line, 0, change.content);
      } else if (change.type === 'delete') {
        result.splice(change.line, 1);
      }
    });

    // Apply their non-conflicting changes
    theirChanges.forEach((change) => {
      // Skip if this line was also changed by us (already handled)
      const ourAlsoChanged = ourChanges.some((c) => c.line === change.line);
      if (!ourAlsoChanged) {
        if (change.type === 'modify') {
          result[change.line] = change.to;
        } else if (change.type === 'add') {
          result.splice(change.line, 0, change.content);
        } else if (change.type === 'delete') {
          result.splice(change.line, 1);
        }
      }
    });

    return result;
  }

  /**
   * Merge with conflict markers for manual resolution
   */
  mergeWithConflictMarkers(baseLines, _ourChanges, _theirChanges, conflicts) {
    const result = [...baseLines];
    const _conflictLines = new Set(conflicts.map((c) => c.line));

    conflicts.forEach((conflict) => {
      const line = conflict.line;
      result[line] = [
        '<<<<<<< OURS (Current)',
        conflict.oursContent,
        '=======',
        conflict.theirsContent,
        '>>>>>>> THEIRS (Upstream)',
      ].join('\n');
    });

    return result;
  }

  /**
   * Check if content is text (heuristic)
   */
  isTextFile(content) {
    if (!content) return true;

    // Check for null bytes (binary indicator)
    if (content.includes('\0')) return false;

    // Check if mostly printable ASCII/UTF-8
    const printableRatio = this.getPrintableRatio(content);
    return printableRatio > 0.8; // 80% printable = text
  }

  /**
   * Get ratio of printable characters
   */
  getPrintableRatio(content) {
    let printable = 0;
    for (let i = 0; i < Math.min(content.length, 1000); i++) {
      const code = content.charCodeAt(i);
      if (
        (code >= 32 && code <= 126) ||
        code === 9 ||
        code === 10 ||
        code === 13
      ) {
        printable++;
      }
    }
    return printable / Math.min(content.length, 1000);
  }

  /**
   * Merge files from filesystem
   */
  async mergeFiles(_filePath, versions) {
    const baseContent = versions.base
      ? await fs.readFile(versions.base, 'utf8')
      : '';
    const oursContent = versions.ours
      ? await fs.readFile(versions.ours, 'utf8')
      : '';
    const theirsContent = versions.theirs
      ? await fs.readFile(versions.theirs, 'utf8')
      : '';

    return await this.threeWayMerge({
      base: baseContent,
      ours: oursContent,
      theirs: theirsContent,
    });
  }
}

/**
 * Merge result type
 * @typedef {Object} MergeResult
 * @property {boolean} success - Whether merge was successful
 * @property {string} merged - Merged content (if successful)
 * @property {Array<Conflict>} conflicts - List of conflicts (if any)
 * @property {string} strategy - Strategy used for merge
 * @property {string} message - Optional message about merge
 */

module.exports = {
  SmartMerger,
  MergeStrategy,
  ConflictType,
};
