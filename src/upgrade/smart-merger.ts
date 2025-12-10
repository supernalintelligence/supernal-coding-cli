/**
 * Smart Merge Engine - Intelligent three-way merge for SC upgrades and syncs
 * Shared by both template upgrades (sc upgrade) and repository syncs (sc sync)
 */

import fs from 'fs-extra';
import crypto from 'node:crypto';

const MergeStrategy = {
  OURS: 'ours',
  THEIRS: 'theirs',
  MERGE: 'merge',
  MANUAL: 'manual',
  AUTO: 'auto',
} as const;

type MergeStrategyType = typeof MergeStrategy[keyof typeof MergeStrategy];

const ConflictType = {
  CONTENT: 'content',
  DELETED: 'deleted',
  ADDED: 'added',
  BINARY: 'binary',
  PERMISSION: 'permission',
} as const;

type ConflictTypeValue = typeof ConflictType[keyof typeof ConflictType];

interface MergeVersions {
  base: string;
  ours: string;
  theirs: string;
}

interface FileVersions {
  base?: string;
  ours?: string;
  theirs?: string;
}

interface Conflict {
  type: ConflictTypeValue;
  message?: string;
  ours?: string;
  theirs?: string;
  line?: number;
}

interface MergeResult {
  success: boolean;
  merged?: string;
  conflicts: Conflict[];
  strategy: string;
  message?: string;
}

interface Change {
  type: 'add' | 'delete' | 'modify';
  line: number;
  content?: string;
  from?: string;
  to?: string;
}

interface ConflictInfo {
  line: number;
  oursContent: string | undefined;
  theirsContent: string | undefined;
}

interface SmartMergerOptions {
  strategy?: MergeStrategyType;
  verbose?: boolean;
  dryRun?: boolean;
}

class SmartMerger {
  protected dryRun: boolean;
  protected strategy: MergeStrategyType;
  protected verbose: boolean;

  constructor(options: SmartMergerOptions = {}) {
    this.strategy = options.strategy || MergeStrategy.AUTO;
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
  }

  async threeWayMerge(versions: MergeVersions): Promise<MergeResult> {
    const { base, ours, theirs } = versions;

    if (this.areIdentical(base, ours, theirs)) {
      return {
        success: true,
        merged: ours,
        conflicts: [],
        strategy: 'no-change',
      };
    }

    if (this.areIdentical(base, ours)) {
      return {
        success: true,
        merged: theirs,
        conflicts: [],
        strategy: 'fast-forward',
        message: 'Fast-forward: taking upstream changes',
      };
    }

    if (this.areIdentical(base, theirs)) {
      return {
        success: true,
        merged: ours,
        conflicts: [],
        strategy: 'keep-ours',
        message: 'No upstream changes, keeping our version',
      };
    }

    return await this.performMerge(versions);
  }

  areIdentical(...versions: string[]): boolean {
    if (versions.length < 2) return true;
    const hashes = versions.map((v) => this.hash(v));
    return new Set(hashes).size === 1;
  }

  hash(content: string | null): string | null {
    if (!content) return null;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async performMerge(versions: MergeVersions): Promise<MergeResult> {
    const { ours, theirs } = versions;

    if (this.isTextFile(ours) && this.isTextFile(theirs)) {
      return await this.lineBasedMerge(versions);
    }

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

  async lineBasedMerge(versions: MergeVersions): Promise<MergeResult> {
    const { base, ours, theirs } = versions;

    const baseLines = this.splitLines(base);
    const ourLines = this.splitLines(ours);
    const theirLines = this.splitLines(theirs);

    const ourChanges = this.diff(baseLines, ourLines);
    const theirChanges = this.diff(baseLines, theirLines);

    const conflicts = this.findConflicts(ourChanges, theirChanges);

    if (conflicts.length === 0) {
      const merged = this.applyChanges(baseLines, ourChanges, theirChanges);
      return {
        success: true,
        merged: merged.join('\n'),
        conflicts: [],
        strategy: 'auto-merge',
      };
    }

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
      conflicts: conflicts.map((c) => ({
        type: ConflictType.CONTENT,
        line: c.line,
        ours: c.oursContent,
        theirs: c.theirsContent,
      })),
      strategy: MergeStrategy.MANUAL,
    };
  }

  splitLines(text: string | null): string[] {
    if (!text) return [];
    return text.split('\n');
  }

  diff(base: string[], modified: string[]): Change[] {
    const changes: Change[] = [];
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

  findConflicts(ourChanges: Change[], theirChanges: Change[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const ourLines = new Set(ourChanges.map((c) => c.line));
    const theirLines = new Set(theirChanges.map((c) => c.line));

    const conflictLines = [...ourLines].filter((line) => theirLines.has(line));

    conflictLines.forEach((line) => {
      const ourChange = ourChanges.find((c) => c.line === line);
      const theirChange = theirChanges.find((c) => c.line === line);

      if (ourChange?.to !== theirChange?.to) {
        conflicts.push({
          line,
          oursContent: ourChange?.to,
          theirsContent: theirChange?.to,
        });
      }
    });

    return conflicts;
  }

  applyChanges(baseLines: string[], ourChanges: Change[], theirChanges: Change[]): string[] {
    const result = [...baseLines];

    ourChanges.forEach((change) => {
      if (change.type === 'modify' && change.to !== undefined) {
        result[change.line] = change.to;
      } else if (change.type === 'add' && change.content !== undefined) {
        result.splice(change.line, 0, change.content);
      } else if (change.type === 'delete') {
        result.splice(change.line, 1);
      }
    });

    theirChanges.forEach((change) => {
      const ourAlsoChanged = ourChanges.some((c) => c.line === change.line);
      if (!ourAlsoChanged) {
        if (change.type === 'modify' && change.to !== undefined) {
          result[change.line] = change.to;
        } else if (change.type === 'add' && change.content !== undefined) {
          result.splice(change.line, 0, change.content);
        } else if (change.type === 'delete') {
          result.splice(change.line, 1);
        }
      }
    });

    return result;
  }

  mergeWithConflictMarkers(
    baseLines: string[],
    _ourChanges: Change[],
    _theirChanges: Change[],
    conflicts: ConflictInfo[]
  ): string[] {
    const result = [...baseLines];

    conflicts.forEach((conflict) => {
      const line = conflict.line;
      result[line] = [
        '<<<<<<< OURS (Current)',
        conflict.oursContent || '',
        '=======',
        conflict.theirsContent || '',
        '>>>>>>> THEIRS (Upstream)',
      ].join('\n');
    });

    return result;
  }

  isTextFile(content: string | null): boolean {
    if (!content) return true;

    if (content.includes('\0')) return false;

    const printableRatio = this.getPrintableRatio(content);
    return printableRatio > 0.8;
  }

  getPrintableRatio(content: string): number {
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

  async mergeFiles(_filePath: string, versions: FileVersions): Promise<MergeResult> {
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

export {
  SmartMerger,
  MergeStrategy,
  ConflictType,
};
module.exports = {
  SmartMerger,
  MergeStrategy,
  ConflictType,
};
