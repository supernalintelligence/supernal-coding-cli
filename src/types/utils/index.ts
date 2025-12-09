/**
 * Utility Types
 * @module @supernal/types/utils
 * 
 * Common utility types used across the codebase.
 */

// =============================================================================
// Result Types
// =============================================================================

/** Generic success result */
export interface Success<T> {
  success: true;
  data: T;
}

/** Generic error result */
export interface Failure {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/** Union type for operation results */
export type Result<T> = Success<T> | Failure;

/** Async result wrapper */
export type AsyncResult<T> = Promise<Result<T>>;

// =============================================================================
// Logging Types
// =============================================================================

/** Log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Log entry */
export interface LogEntry {
  /** Timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Error stack if applicable */
  stack?: string;
  /** Source module */
  module?: string;
}

/** Logger interface */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

// =============================================================================
// Path & File Types
// =============================================================================

/** Path resolution result */
export interface PathResolution {
  /** Resolved absolute path */
  absolute: string;
  /** Path relative to project root */
  relative: string;
  /** Whether path exists */
  exists: boolean;
  /** File type if exists */
  type?: 'file' | 'directory' | 'symlink';
}

/** File metadata */
export interface FileMetadata {
  /** File path */
  path: string;
  /** File name */
  name: string;
  /** File extension */
  extension: string;
  /** File size in bytes */
  size: number;
  /** Creation time */
  createdAt: string;
  /** Last modified time */
  modifiedAt: string;
  /** Last accessed time */
  accessedAt: string;
  /** Is directory */
  isDirectory: boolean;
  /** Is file */
  isFile: boolean;
  /** Is symlink */
  isSymlink: boolean;
}

// =============================================================================
// Collection Types
// =============================================================================

/** Paginated list */
export interface PaginatedList<T> {
  /** Items in current page */
  items: T[];
  /** Total items */
  total: number;
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total pages */
  totalPages: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrev: boolean;
}

/** Grouped items */
export interface GroupedItems<T> {
  /** Group key */
  key: string;
  /** Group label */
  label?: string;
  /** Items in group */
  items: T[];
  /** Item count */
  count: number;
}

// =============================================================================
// Template Types
// =============================================================================

/** Template variable */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable description */
  description?: string;
  /** Default value */
  defaultValue?: string;
  /** Whether variable is required */
  required: boolean;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  /** Validation pattern */
  pattern?: string;
}

/** Template definition */
export interface TemplateDefinition {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Template content */
  content: string;
  /** Template variables */
  variables: TemplateVariable[];
  /** Template version */
  version: string;
  /** Template category */
  category?: string;
}

/** Template resolution result */
export interface TemplateResolution {
  /** Resolved template path */
  path: string;
  /** Template source */
  source: 'project' | 'package' | 'default';
  /** Whether template exists */
  exists: boolean;
  /** Template metadata if found */
  metadata?: TemplateDefinition;
}

// =============================================================================
// Event Types
// =============================================================================

/** Event payload base */
export interface EventPayload {
  /** Event type */
  type: string;
  /** Event timestamp */
  timestamp: string;
  /** Event source */
  source: string;
  /** Event data */
  data: unknown;
}

/** Event handler */
export type EventHandler<T extends EventPayload = EventPayload> = (event: T) => void | Promise<void>;

/** Event emitter interface */
export interface EventEmitter {
  on<T extends EventPayload>(event: string, handler: EventHandler<T>): void;
  off<T extends EventPayload>(event: string, handler: EventHandler<T>): void;
  emit<T extends EventPayload>(event: string, payload: T): void;
}

// =============================================================================
// Helper Types
// =============================================================================

/** Deep partial - makes all nested properties optional */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/** Deep readonly - makes all nested properties readonly */
export type DeepReadonly<T> = T extends object ? {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
} : T;

/** Make specific keys required */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific keys optional */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Extract keys of type */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/** Nullable type */
export type Nullable<T> = T | null;

/** Maybe type (nullable and undefinable) */
export type Maybe<T> = T | null | undefined;

// =============================================================================
// Time Types
// =============================================================================

/** Duration in milliseconds */
export type DurationMs = number & { readonly __brand: 'DurationMs' };

/** Timestamp (ISO 8601 string) */
export type Timestamp = string & { readonly __brand: 'Timestamp' };

/** Time range */
export interface TimeRange {
  /** Start time */
  start: Timestamp;
  /** End time */
  end: Timestamp;
}

// =============================================================================
// Version Types
// =============================================================================

/** Semantic version */
export interface SemanticVersion {
  /** Major version */
  major: number;
  /** Minor version */
  minor: number;
  /** Patch version */
  patch: number;
  /** Pre-release identifier */
  prerelease?: string;
  /** Build metadata */
  build?: string;
}

/** Version comparison result */
export type VersionComparison = -1 | 0 | 1;

