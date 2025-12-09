/**
 * Configuration Types
 * @module @supernal/types/config
 * 
 * Core configuration interfaces for Supernal Coding.
 * These types define the structure of supernal.yaml and related configs.
 */

// =============================================================================
// Branded Types for Type Safety
// =============================================================================

/** Branded type for file paths to prevent string misuse */
export type FilePath = string & { readonly __brand: 'FilePath' };

/** Branded type for requirement IDs (e.g., "REQ-042") */
export type RequirementId = string & { readonly __brand: 'RequirementId' };

/** Branded type for epic slugs (e.g., "epic-authentication") */
export type EpicSlug = string & { readonly __brand: 'EpicSlug' };

// =============================================================================
// Status Types
// =============================================================================

/** Standard requirement statuses */
export type RequirementStatus = 
  | 'draft'
  | 'proposed'
  | 'approved'
  | 'in-progress'
  | 'review'
  | 'done'
  | 'cancelled'
  | 'blocked';

/** Priority levels for requirements and tasks */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

/** Request types for requirements */
export type RequestType = 'feature' | 'bug' | 'enhancement' | 'maintenance';

// =============================================================================
// Core Configuration Interfaces
// =============================================================================

/** Git configuration within supernal.yaml */
export interface GitConfig {
  /** Default branch name */
  defaultBranch?: string;
  /** Branch naming patterns */
  branchPatterns?: {
    feature?: string;
    bugfix?: string;
    hotfix?: string;
    release?: string;
  };
  /** Commit message format */
  commitFormat?: string;
  /** Protected branches that require PR */
  protectedBranches?: string[];
}

/** Paths configuration within supernal.yaml */
export interface PathsConfig {
  /** Root directory for requirements */
  requirements?: string;
  /** Root directory for epics */
  epics?: string;
  /** Root directory for features */
  features?: string;
  /** Root directory for documentation */
  docs?: string;
  /** Root directory for templates */
  templates?: string;
  /** Archive directory for deprecated items */
  archive?: string;
}

/** Workflow configuration */
export interface WorkflowConfig {
  /** Enabled workflow types */
  types?: string[];
  /** Auto-status transitions */
  autoTransitions?: boolean;
  /** Require approval for status changes */
  requireApproval?: string[];
}

/** Git hooks configuration */
export interface GitHooksConfig {
  /** Pre-commit hook settings */
  preCommit?: {
    enabled?: boolean;
    checks?: {
      /** WIP registry check configuration */
      wipRegistryCheck?: {
        enabled?: boolean;
        blockOnUntracked?: boolean;
        threshold?: number;
        allowBypass?: boolean;
      };
      /** Lint check */
      lint?: boolean;
      /** Test check */
      test?: boolean;
    };
  };
  /** Pre-push hook settings */
  prePush?: {
    enabled?: boolean;
    requireTests?: boolean;
    requireTypecheck?: boolean;
  };
}

/** Main Supernal configuration (supernal.yaml) */
export interface SupernalConfig {
  /** Configuration version */
  version?: string;
  /** Project name */
  name?: string;
  /** Project description */
  description?: string;
  /** Git-related configuration */
  git?: GitConfig;
  /** Path configuration */
  paths?: PathsConfig;
  /** Workflow configuration */
  workflow?: WorkflowConfig;
  /** Git hooks configuration */
  gitHooks?: GitHooksConfig;
  /** Custom extensions */
  extensions?: Record<string, unknown>;
}

// =============================================================================
// Config Loader Types
// =============================================================================

/** Result of loading configuration */
export interface ConfigLoadResult {
  /** Whether config was found and loaded */
  success: boolean;
  /** The loaded configuration */
  config?: SupernalConfig;
  /** Path to the config file */
  configPath?: FilePath;
  /** Error message if loading failed */
  error?: string;
}

/** Options for config loading */
export interface ConfigLoadOptions {
  /** Starting directory to search from */
  cwd?: string;
  /** Whether to search parent directories */
  searchParents?: boolean;
  /** Custom config file name */
  configName?: string;
  /** Suppress console output */
  silent?: boolean;
}

// =============================================================================
// Document Paths Types (from supernal.yaml)
// =============================================================================

/** Document paths configuration */
export interface DocPaths {
  docs: string;
  requirements: string;
  kanban: string;
  adr: string;
  planning: string;
  architecture: string;
  sessions: string;
  handoffs: string;
}

/** Planning phase paths */
export interface PlanningPhasePaths {
  startup: string;
  demo: string;
  mvp: string;
  production: string;
  templates: string;
}

/** Planning lifecycle paths */
export interface PlanningLifecyclePaths {
  backlog: string;
  review: string;
  active: string;
  complete: string;
  archive: string;
}

/** Project info extracted from config */
export interface ProjectInfo {
  name: string;
  description: string;
  version?: string;
}

// =============================================================================
// Raw supernal.yaml Structure Types
// =============================================================================

/** Documentation config section in supernal.yaml */
export interface DocumentationConfig {
  kanban_dir?: string;
  adr_dir?: string;
  planning_dir?: string;
  architecture_dir?: string;
  sessions_dir?: string;
  handoffs_dir?: string;
  planning_phases?: PlanningPhasePaths;
  planning_lifecycle?: PlanningLifecyclePaths;
  root_whitelist?: string[];
}

/** Project config section in supernal.yaml */
export interface ProjectConfig {
  name?: string;
  description?: string;
  docs_dir?: string;
  requirements_dir?: string;
}

/** Raw supernal.yaml configuration (as loaded from file) */
export interface RawSupernalConfig {
  _source?: string;
  version?: string;
  project?: ProjectConfig;
  documentation?: DocumentationConfig;
  workflow?: string;
  [key: string]: unknown;
}

