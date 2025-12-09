/**
 * Git Types
 * @module @supernal/types/git
 * 
 * Types for Git operations, commits, branches, and tracking.
 */

import type { RequirementId } from '../config/index.js';

// =============================================================================
// Commit Types
// =============================================================================

/** Git commit information */
export interface GitCommit {
  /** Commit SHA (full) */
  sha: string;
  /** Short SHA (7 chars) */
  shortSha: string;
  /** Commit message (first line) */
  message: string;
  /** Full commit message */
  body?: string;
  /** Author name */
  authorName: string;
  /** Author email */
  authorEmail: string;
  /** Commit date */
  date: string;
  /** Parent commit SHAs */
  parents: string[];
  /** Files changed in commit */
  files?: GitFileChange[];
  /** Associated requirement IDs */
  requirements?: RequirementId[];
}

/** Git file change in a commit */
export interface GitFileChange {
  /** File path */
  path: string;
  /** Change type */
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  /** Previous path (for renames) */
  previousPath?: string;
  /** Lines added */
  additions?: number;
  /** Lines deleted */
  deletions?: number;
}

// =============================================================================
// Branch Types
// =============================================================================

/** Git branch information */
export interface GitBranch {
  /** Branch name */
  name: string;
  /** Full reference (refs/heads/...) */
  ref: string;
  /** Current HEAD commit SHA */
  sha: string;
  /** Whether this is the current branch */
  current: boolean;
  /** Upstream branch (if tracking) */
  upstream?: string;
  /** Ahead/behind count from upstream */
  tracking?: {
    ahead: number;
    behind: number;
  };
  /** Last commit date */
  lastCommit?: string;
  /** Associated requirement ID (if feature branch) */
  requirement?: RequirementId;
}

/** Branch naming patterns */
export interface BranchPattern {
  /** Pattern type */
  type: 'feature' | 'bugfix' | 'hotfix' | 'release' | 'custom';
  /** Pattern regex or template */
  pattern: string;
  /** Example branch name */
  example: string;
}

// =============================================================================
// Repository Status Types
// =============================================================================

/** Git repository status */
export interface GitStatus {
  /** Current branch */
  branch: string;
  /** Current HEAD commit SHA */
  head: string;
  /** Staged files */
  staged: GitStatusFile[];
  /** Unstaged (modified) files */
  unstaged: GitStatusFile[];
  /** Untracked files */
  untracked: string[];
  /** Whether working directory is clean */
  clean: boolean;
  /** Whether there are merge conflicts */
  conflicts: boolean;
  /** Files with conflicts */
  conflictFiles?: string[];
}

/** Git status file entry */
export interface GitStatusFile {
  /** File path */
  path: string;
  /** Status code (e.g., 'M', 'A', 'D') */
  status: string;
  /** Status description */
  statusText: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'unmerged';
  /** Previous path (for renames) */
  previousPath?: string;
}

// =============================================================================
// Remote Types
// =============================================================================

/** Git remote information */
export interface GitRemote {
  /** Remote name */
  name: string;
  /** Fetch URL */
  fetchUrl: string;
  /** Push URL */
  pushUrl: string;
  /** Remote type */
  type?: 'github' | 'gitlab' | 'bitbucket' | 'other';
  /** Owner (if parseable) */
  owner?: string;
  /** Repository name (if parseable) */
  repo?: string;
}

// =============================================================================
// Diff Types
// =============================================================================

/** Git diff information */
export interface GitDiff {
  /** Files changed */
  files: GitDiffFile[];
  /** Total additions */
  totalAdditions: number;
  /** Total deletions */
  totalDeletions: number;
  /** Total files changed */
  totalFiles: number;
}

/** Git diff file entry */
export interface GitDiffFile {
  /** File path */
  path: string;
  /** Previous path (for renames) */
  previousPath?: string;
  /** Change type */
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Lines added */
  additions: number;
  /** Lines deleted */
  deletions: number;
  /** Binary file flag */
  binary: boolean;
  /** Diff hunks */
  hunks?: GitDiffHunk[];
}

/** Git diff hunk */
export interface GitDiffHunk {
  /** Old file start line */
  oldStart: number;
  /** Old file line count */
  oldLines: number;
  /** New file start line */
  newStart: number;
  /** New file line count */
  newLines: number;
  /** Hunk header */
  header: string;
  /** Hunk content lines */
  lines: GitDiffLine[];
}

/** Git diff line */
export interface GitDiffLine {
  /** Line type */
  type: 'context' | 'add' | 'delete';
  /** Line content */
  content: string;
  /** Old line number (null for additions) */
  oldLine?: number;
  /** New line number (null for deletions) */
  newLine?: number;
}

// =============================================================================
// Tracking Types
// =============================================================================

/** Requirement-to-commit tracking */
export interface RequirementTracking {
  /** Requirement ID */
  requirementId: RequirementId;
  /** Associated branch */
  branch?: string;
  /** Associated commits */
  commits: string[];
  /** Associated pull request */
  pullRequest?: {
    number: number;
    url: string;
    state: 'open' | 'closed' | 'merged';
  };
  /** First commit date */
  startedAt?: string;
  /** Last commit date */
  lastActivity?: string;
}

/** Git context for requirement operations */
export interface GitContext {
  /** Current branch */
  branch: string;
  /** Repository root */
  root: string;
  /** Whether in a git repository */
  isRepo: boolean;
  /** Remote origin info */
  remote?: GitRemote;
  /** Current status */
  status: GitStatus;
  /** Requirement ID from branch (if applicable) */
  branchRequirement?: RequirementId;
}

// =============================================================================
// Operation Result Types
// =============================================================================

/** Git operation result */
export interface GitOperationResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Operation type */
  operation: 'commit' | 'push' | 'pull' | 'merge' | 'checkout' | 'branch' | 'fetch';
  /** Result message */
  message: string;
  /** Detailed output */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Affected files */
  affectedFiles?: string[];
}

/** Merge result */
export interface MergeResult extends GitOperationResult {
  operation: 'merge';
  /** Source branch */
  source: string;
  /** Target branch */
  target: string;
  /** Whether it was fast-forward */
  fastForward: boolean;
  /** Merge commit SHA */
  mergeCommit?: string;
  /** Conflicts if any */
  conflicts?: string[];
}

