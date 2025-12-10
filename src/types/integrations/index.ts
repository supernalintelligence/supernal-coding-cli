/**
 * Integration Types
 * @module @supernal/types/integrations
 * 
 * Types for external integrations: data sources, GitHub, Modal workers, etc.
 * These types are shared between CLI and dashboard applications.
 */

import type { SupernalConfig } from '../config/index.js';
import type { ParsedRequirement, ParsedEpic, ParsedFeature } from '../documents/index.js';

// =============================================================================
// Data Source Types
// =============================================================================

/** Authentication context for data sources */
export interface AuthContext {
  /** GitHub access token */
  accessToken?: string;
  /** GitHub App installation token */
  installationToken?: string;
  /** User ID if authenticated */
  userId?: string;
  /** Organization ID */
  orgId?: string;
  /** Token expiration */
  expiresAt?: Date;
}

/** Repository context */
export interface RepoContext {
  /** Repository owner (user or org) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Branch name (default: main) */
  branch?: string;
  /** Specific commit SHA */
  sha?: string;
  /** Full repo path (owner/repo) */
  fullName: string;
}

/** Options for listing files */
export interface ListFilesOptions {
  /** Glob patterns to include */
  patterns?: string[];
  /** Directories to exclude */
  exclude?: string[];
  /** Maximum depth */
  maxDepth?: number;
}

/** Repository file info */
export interface RepoFile {
  /** File path relative to repo root */
  path: string;
  /** File type */
  type: 'file' | 'dir' | 'symlink';
  /** File size in bytes */
  size?: number;
  /** SHA hash */
  sha?: string;
  /** Last modified date */
  modifiedAt?: string;
}

/**
 * Abstract interface for accessing repository files.
 * Implemented by LocalFilesystemSource, GitHubApiSource, ModalSource.
 */
export interface RepoDataSource {
  /** Get file content by path */
  getFile(path: string): Promise<string | null>;
  
  /** List files matching patterns */
  listFiles(options?: ListFilesOptions): Promise<RepoFile[]>;
  
  /** Check if a file exists */
  fileExists(path: string): Promise<boolean>;
  
  /** Get repository metadata */
  getMetadata(): Promise<RepoMetadata>;
  
  /** Get source type identifier */
  readonly sourceType: 'local' | 'github' | 'modal';
}

/** Repository metadata */
export interface RepoMetadata {
  /** Repository name */
  name: string;
  /** Full name (owner/repo) */
  fullName: string;
  /** Default branch */
  defaultBranch: string;
  /** Repository description */
  description?: string;
  /** Whether repo is private */
  isPrivate: boolean;
  /** Last push date */
  pushedAt?: string;
  /** Owner info */
  owner: {
    login: string;
    type: 'User' | 'Organization';
  };
}

// =============================================================================
// Parsed Repository Data
// =============================================================================

/** Aggregated Supernal repository data */
export interface SupernalRepoData {
  /** Parsed configuration */
  config: SupernalConfig | null;
  /** Parsed requirements */
  requirements: ParsedRequirement[];
  /** Parsed epics */
  epics: ParsedEpic[];
  /** Parsed features */
  features: ParsedFeature[];
  /** Repository metadata */
  metadata: RepoMetadata;
  /** Parsing errors */
  errors: ParseError[];
  /** Cache information */
  cacheInfo?: {
    cachedAt: string;
    expiresAt: string;
    source: 'local' | 'github' | 'modal';
  };
}

/** Parse error */
export interface ParseError {
  /** File path */
  path: string;
  /** Error type */
  type: 'yaml' | 'frontmatter' | 'gherkin' | 'validation';
  /** Error message */
  message: string;
  /** Line number if available */
  line?: number;
}

// =============================================================================
// GitHub API Types
// =============================================================================

/** GitHub user */
export interface GitHubUser {
  /** GitHub user ID */
  id: number;
  /** Username */
  login: string;
  /** Display name */
  name?: string;
  /** Email */
  email?: string;
  /** Avatar URL */
  avatarUrl: string;
  /** User type */
  type: 'User' | 'Organization' | 'Bot';
}

/** GitHub repository */
export interface GitHubRepository {
  /** Repository ID */
  id: number;
  /** Repository name */
  name: string;
  /** Full name (owner/repo) */
  fullName: string;
  /** Description */
  description?: string;
  /** Whether private */
  private: boolean;
  /** HTML URL */
  htmlUrl: string;
  /** Clone URL */
  cloneUrl: string;
  /** Default branch */
  defaultBranch: string;
  /** Owner */
  owner: GitHubUser;
  /** Created at */
  createdAt: string;
  /** Updated at */
  updatedAt: string;
  /** Pushed at */
  pushedAt: string;
}

/** GitHub App installation */
export interface GitHubInstallation {
  /** Installation ID */
  id: number;
  /** App ID */
  appId: number;
  /** Target type */
  targetType: 'User' | 'Organization';
  /** Account info */
  account: GitHubUser;
  /** Repository selection */
  repositorySelection: 'all' | 'selected';
  /** Access tokens URL */
  accessTokensUrl: string;
  /** Installed repositories */
  repositories?: GitHubRepository[];
  /** Permissions granted */
  permissions: Record<string, string>;
  /** Events subscribed */
  events: string[];
  /** Created at */
  createdAt: string;
  /** Updated at */
  updatedAt: string;
}

// =============================================================================
// GitHub Webhook Types
// =============================================================================

/** Base webhook payload */
export interface WebhookPayloadBase {
  /** Action type */
  action?: string;
  /** Sender */
  sender: GitHubUser;
  /** Repository */
  repository?: GitHubRepository;
  /** Installation */
  installation?: { id: number };
}

/** Push webhook payload */
export interface PushWebhookPayload extends WebhookPayloadBase {
  /** Reference (e.g., refs/heads/main) */
  ref: string;
  /** Before SHA */
  before: string;
  /** After SHA */
  after: string;
  /** Commits */
  commits: Array<{
    id: string;
    message: string;
    author: { name: string; email: string };
    timestamp: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  /** Pusher */
  pusher: { name: string; email: string };
  /** Whether forced push */
  forced: boolean;
}

/** Pull request webhook payload */
export interface PullRequestWebhookPayload extends WebhookPayloadBase {
  /** Action (opened, closed, merged, etc.) */
  action: 'opened' | 'closed' | 'reopened' | 'edited' | 'synchronize' | 'merged';
  /** Pull request number */
  number: number;
  /** Pull request details */
  pullRequest: {
    id: number;
    number: number;
    title: string;
    body?: string;
    state: 'open' | 'closed';
    merged: boolean;
    head: { ref: string; sha: string };
    base: { ref: string; sha: string };
    user: GitHubUser;
    createdAt: string;
    updatedAt: string;
    mergedAt?: string;
  };
}

/** Installation webhook payload */
export interface InstallationWebhookPayload extends WebhookPayloadBase {
  /** Action (created, deleted, suspend, unsuspend) */
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend' | 'new_permissions_accepted';
  /** Installation details */
  installation: GitHubInstallation;
  /** Repositories affected (for repos_added/removed) */
  repositories?: GitHubRepository[];
}

/** Installation repositories webhook payload */
export interface InstallationRepositoriesWebhookPayload extends WebhookPayloadBase {
  /** Action */
  action: 'added' | 'removed';
  /** Installation */
  installation: GitHubInstallation;
  /** Repositories added */
  repositoriesAdded?: GitHubRepository[];
  /** Repositories removed */
  repositoriesRemoved?: GitHubRepository[];
  /** Repository selection */
  repositorySelection: 'all' | 'selected';
}

/** Union of all webhook payloads */
export type WebhookPayload = 
  | PushWebhookPayload 
  | PullRequestWebhookPayload 
  | InstallationWebhookPayload
  | InstallationRepositoriesWebhookPayload;

// =============================================================================
// Modal Worker Types
// =============================================================================

/** Modal extraction request */
export interface ModalExtractRequest {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Branch name */
  branch?: string;
  /** Specific commit SHA */
  sha?: string;
  /** GitHub access token */
  accessToken: string;
  /** Extraction options */
  options?: {
    /** Include requirements */
    requirements?: boolean;
    /** Include epics */
    epics?: boolean;
    /** Include features */
    features?: boolean;
    /** Include config */
    config?: boolean;
    /** Max files to process */
    maxFiles?: number;
  };
}

/** Modal extraction result */
export interface ModalExtractResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** Extracted data */
  data?: SupernalRepoData;
  /** Error message if failed */
  error?: string;
  /** Extraction metadata */
  metadata: {
    /** Duration in ms */
    durationMs: number;
    /** Files processed */
    filesProcessed: number;
    /** Worker ID */
    workerId?: string;
    /** Timestamp */
    timestamp: string;
  };
}

// =============================================================================
// Cache Types
// =============================================================================

/** Cache entry */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Cache key */
  key: string;
  /** Cached at timestamp */
  cachedAt: string;
  /** Expires at timestamp */
  expiresAt: string;
  /** Cache tags for invalidation */
  tags?: string[];
}

/** Cache options */
export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Cache tags */
  tags?: string[];
  /** Skip cache read */
  skipRead?: boolean;
  /** Skip cache write */
  skipWrite?: boolean;
}

/** Repository cache */
export interface RepoCache {
  /** Get cached data */
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  
  /** Set cached data */
  set<T>(key: string, data: T, options?: CacheOptions): Promise<void>;
  
  /** Invalidate by key */
  invalidate(key: string): Promise<void>;
  
  /** Invalidate by tags */
  invalidateByTags(tags: string[]): Promise<void>;
  
  /** Clear all cache */
  clear(): Promise<void>;
}

// =============================================================================
// API Response Types
// =============================================================================

/** API response wrapper */
export interface ApiResponse<T> {
  /** Whether request succeeded */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Response metadata */
  meta?: {
    /** Request ID */
    requestId?: string;
    /** Duration in ms */
    durationMs?: number;
    /** Cache status */
    cacheStatus?: 'hit' | 'miss' | 'stale';
  };
}

/** Paginated response */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Pagination info */
  pagination: {
    /** Current page */
    page: number;
    /** Items per page */
    perPage: number;
    /** Total items */
    total: number;
    /** Total pages */
    totalPages: number;
    /** Has next page */
    hasNext: boolean;
    /** Has previous page */
    hasPrev: boolean;
  };
}

