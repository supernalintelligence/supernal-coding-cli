/**
 * CLI Types
 * @module @supernal/types/cli
 * 
 * Types for CLI commands, options, and output formatting.
 */

import type { EpicSlug, Priority, RequirementStatus, RequestType } from '../config/index.js';

// =============================================================================
// Command Types
// =============================================================================

/** Base command options common to all commands */
export interface BaseCommandOptions {
  /** Enable verbose output */
  verbose?: boolean;
  /** Suppress output */
  quiet?: boolean;
  /** Output format */
  format?: OutputFormat;
  /** Dry run mode */
  dryRun?: boolean;
  /** Working directory */
  cwd?: string;
}

/** Output format options */
export type OutputFormat = 'text' | 'json' | 'yaml' | 'table' | 'markdown';

/** Command result */
export interface CommandResult<T = unknown> {
  /** Whether command succeeded */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Warning messages */
  warnings?: string[];
  /** Exit code */
  exitCode: number;
}

// =============================================================================
// Requirement Command Types
// =============================================================================

/** Options for `sc req new` */
export interface RequirementNewOptions extends BaseCommandOptions {
  /** Parent epic */
  epic?: EpicSlug;
  /** Priority level */
  priority?: Priority;
  /** Request type */
  requestType?: RequestType;
  /** Template to use */
  template?: string;
  /** Open in editor after creation */
  edit?: boolean;
}

/** Options for `sc req list` */
export interface RequirementListOptions extends BaseCommandOptions {
  /** Filter by status */
  status?: RequirementStatus | RequirementStatus[];
  /** Filter by epic */
  epic?: EpicSlug;
  /** Filter by priority */
  priority?: Priority;
  /** Filter by assignee */
  assignee?: string;
  /** Include archived */
  archived?: boolean;
  /** Limit results */
  limit?: number;
  /** Sort field */
  sort?: 'created' | 'updated' | 'priority' | 'status' | 'title';
  /** Sort order */
  order?: 'asc' | 'desc';
}

/** Options for `sc req update` */
export interface RequirementUpdateOptions extends BaseCommandOptions {
  /** New status */
  status?: RequirementStatus;
  /** New priority */
  priority?: Priority;
  /** New assignee */
  assignee?: string;
  /** Add tags */
  addTags?: string[];
  /** Remove tags */
  removeTags?: string[];
}

/** Options for `sc req validate` */
export interface RequirementValidateOptions extends BaseCommandOptions {
  /** Validation strictness */
  strict?: boolean;
  /** Auto-fix issues */
  fix?: boolean;
  /** Specific rules to check */
  rules?: string[];
}

// =============================================================================
// Git Command Types
// =============================================================================

/** Options for `sc git-smart branch` */
export interface GitBranchOptions extends BaseCommandOptions {
  /** Branch name or requirement ID */
  branch?: string;
  /** Base branch */
  base?: string;
  /** Force create */
  force?: boolean;
}

/** Options for `sc git-smart merge` */
export interface GitMergeOptions extends BaseCommandOptions {
  /** Push after merge */
  push?: boolean;
  /** Delete local branch after merge */
  deleteLocal?: boolean;
  /** Squash commits */
  squash?: boolean;
  /** No fast-forward */
  noFf?: boolean;
}

/** Options for `sc git-smart check-context` */
export interface GitCheckContextOptions extends BaseCommandOptions {
  /** Strict mode */
  strict?: boolean;
  /** Auto-fix issues */
  fix?: boolean;
}

// =============================================================================
// Test Command Types
// =============================================================================

/** Options for `sc test` */
export interface TestOptions extends BaseCommandOptions {
  /** Test pattern to match */
  pattern?: string;
  /** Run in watch mode */
  watch?: boolean;
  /** Generate coverage report */
  coverage?: boolean;
  /** Specific test files */
  files?: string[];
  /** Update snapshots */
  updateSnapshot?: boolean;
}

/** Test result summary */
export interface TestResultSummary {
  /** Total tests */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Duration in ms */
  duration: number;
  /** Coverage percentage */
  coverage?: number;
}

// =============================================================================
// Workflow Command Types
// =============================================================================

/** Options for `sc workflow new` */
export interface WorkflowNewOptions extends BaseCommandOptions {
  /** Workflow type */
  type?: string;
  /** Template to use */
  template?: string;
}

/** Options for `sc workflow list` */
export interface WorkflowListOptions extends BaseCommandOptions {
  /** Filter by type */
  type?: string;
  /** Filter by status */
  status?: string;
}

// =============================================================================
// Output Types
// =============================================================================

/** Table column definition */
export interface TableColumn {
  /** Column header */
  header: string;
  /** Data key */
  key: string;
  /** Column width */
  width?: number;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Formatter function */
  format?: (value: unknown) => string;
}

/** Table output options */
export interface TableOptions {
  /** Column definitions */
  columns: TableColumn[];
  /** Show headers */
  showHeaders?: boolean;
  /** Row separator */
  rowSeparator?: boolean;
  /** Max width */
  maxWidth?: number;
}

/** Progress indicator options */
export interface ProgressOptions {
  /** Progress message */
  message: string;
  /** Show spinner */
  spinner?: boolean;
  /** Show percentage */
  percentage?: boolean;
  /** Total items */
  total?: number;
  /** Current item */
  current?: number;
}

// =============================================================================
// Error Types
// =============================================================================

/** CLI error codes */
export type CliErrorCode = 
  | 'INVALID_ARGUMENT'
  | 'MISSING_ARGUMENT'
  | 'FILE_NOT_FOUND'
  | 'CONFIG_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'GIT_ERROR'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR';

/** CLI error */
export interface CliError {
  /** Error code */
  code: CliErrorCode;
  /** Error message */
  message: string;
  /** Detailed description */
  details?: string;
  /** Suggested fix */
  suggestion?: string;
  /** Help URL */
  helpUrl?: string;
}

