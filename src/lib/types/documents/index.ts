/**
 * Document Types
 * @module @supernal/types/documents
 * 
 * Types for requirements, epics, features, and other document-based entities.
 */

import type { 
  RequirementId, 
  EpicSlug, 
  FilePath, 
  RequirementStatus, 
  Priority, 
  RequestType 
} from '../config/index.js';

// =============================================================================
// Frontmatter Types
// =============================================================================

/** Base frontmatter fields common to all documents */
export interface BaseFrontmatter {
  /** Document title */
  title: string;
  /** Document description */
  description?: string;
  /** Creation date (ISO 8601) */
  created?: string;
  /** Last updated date (ISO 8601) */
  updated?: string;
  /** Document status */
  status?: string;
  /** Document version */
  version?: string;
  /** Author information */
  author?: string;
  /** Tags for categorization */
  tags?: string[];
}

/** Requirement-specific frontmatter */
export interface RequirementFrontmatter extends BaseFrontmatter {
  /** Unique requirement ID (auto-assigned) */
  id: RequirementId;
  /** Parent epic reference */
  epic?: EpicSlug;
  /** Requirement status */
  status: RequirementStatus;
  /** Priority level */
  priority?: Priority;
  /** Request type classification */
  requestType?: RequestType;
  /** Related requirements */
  relatedRequirements?: RequirementId[];
  /** Assignee */
  assignee?: string;
  /** Due date */
  dueDate?: string;
  /** Git tracking information */
  gitTracking?: {
    branch?: string;
    commits?: string[];
    pullRequest?: string;
  };
  /** Acceptance criteria count */
  acceptanceCriteria?: number;
  /** Test coverage information */
  testCoverage?: {
    unit?: number;
    integration?: number;
    e2e?: number;
  };
}

/** Epic-specific frontmatter */
export interface EpicFrontmatter extends BaseFrontmatter {
  /** Epic slug identifier */
  slug: EpicSlug;
  /** Epic status */
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  /** Priority level */
  priority?: Priority;
  /** Child requirements */
  requirements?: RequirementId[];
  /** Milestone association */
  milestone?: string;
  /** Progress percentage */
  progress?: number;
  /** Target completion date */
  targetDate?: string;
}

/** Feature-specific frontmatter */
export interface FeatureFrontmatter extends BaseFrontmatter {
  /** Feature identifier */
  featureId?: string;
  /** Parent epic */
  epic?: EpicSlug;
  /** Feature status */
  status: 'draft' | 'proposed' | 'approved' | 'in-development' | 'testing' | 'released' | 'deprecated';
  /** Related requirements */
  requirements?: RequirementId[];
  /** Feature flags */
  flags?: string[];
}

// =============================================================================
// Parsed Document Types
// =============================================================================

/** Parsed requirement document */
export interface ParsedRequirement {
  /** File path */
  path: FilePath;
  /** Parsed frontmatter */
  frontmatter: RequirementFrontmatter;
  /** Document body content */
  content: string;
  /** Gherkin scenarios if present */
  scenarios?: GherkinScenario[];
  /** Validation errors */
  errors?: ValidationError[];
}

/** Parsed epic document */
export interface ParsedEpic {
  /** File path */
  path: FilePath;
  /** Parsed frontmatter */
  frontmatter: EpicFrontmatter;
  /** Document body content */
  content: string;
  /** Child requirements */
  requirements?: ParsedRequirement[];
  /** Progress summary */
  progress?: EpicProgress;
}

/** Parsed feature document */
export interface ParsedFeature {
  /** File path */
  path: FilePath;
  /** Parsed frontmatter */
  frontmatter: FeatureFrontmatter;
  /** Document body content */
  content: string;
  /** Related requirements */
  requirements?: ParsedRequirement[];
}

// =============================================================================
// Gherkin Types
// =============================================================================

/** Gherkin scenario */
export interface GherkinScenario {
  /** Scenario name */
  name: string;
  /** Scenario type */
  type: 'Scenario' | 'Scenario Outline';
  /** Given steps */
  given: string[];
  /** When steps */
  when: string[];
  /** Then steps */
  then: string[];
  /** Example data for outlines */
  examples?: Record<string, string>[];
  /** Tags */
  tags?: string[];
}

/** Gherkin feature */
export interface GherkinFeature {
  /** Feature name */
  name: string;
  /** Feature description */
  description?: string;
  /** Background steps */
  background?: {
    given: string[];
  };
  /** Scenarios */
  scenarios: GherkinScenario[];
  /** Feature tags */
  tags?: string[];
}

// =============================================================================
// Progress & Statistics Types
// =============================================================================

/** Epic progress information */
export interface EpicProgress {
  /** Total requirements */
  total: number;
  /** Completed requirements */
  completed: number;
  /** In-progress requirements */
  inProgress: number;
  /** Blocked requirements */
  blocked: number;
  /** Percentage complete */
  percentage: number;
}

/** Document statistics */
export interface DocumentStats {
  /** Total documents */
  total: number;
  /** Documents by status */
  byStatus: Record<string, number>;
  /** Documents by priority */
  byPriority: Record<string, number>;
  /** Documents by type */
  byType: Record<string, number>;
}

// =============================================================================
// Validation Types
// =============================================================================

/** Validation error */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** File path where error occurred */
  path?: FilePath;
  /** Line number if applicable */
  line?: number;
  /** Column number if applicable */
  column?: number;
  /** Suggested fix */
  suggestion?: string;
}

/** Validation result */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationError[];
  /** Validation info */
  info: ValidationError[];
}

// =============================================================================
// Document Manager Types
// =============================================================================

/** Options for document listing */
export interface ListDocumentsOptions {
  /** Filter by status */
  status?: RequirementStatus | RequirementStatus[];
  /** Filter by epic */
  epic?: EpicSlug;
  /** Filter by priority */
  priority?: Priority;
  /** Filter by assignee */
  assignee?: string;
  /** Include archived documents */
  includeArchived?: boolean;
  /** Limit results */
  limit?: number;
  /** Sort field */
  sortBy?: 'created' | 'updated' | 'priority' | 'status' | 'title';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/** Options for document creation */
export interface CreateDocumentOptions {
  /** Document title */
  title: string;
  /** Parent epic */
  epic?: EpicSlug;
  /** Priority level */
  priority?: Priority;
  /** Request type */
  requestType?: RequestType;
  /** Initial status */
  status?: RequirementStatus;
  /** Template to use */
  template?: string;
  /** Additional frontmatter fields */
  additionalFields?: Record<string, unknown>;
}

/** Options for document update */
export interface UpdateDocumentOptions {
  /** New status */
  status?: RequirementStatus;
  /** New priority */
  priority?: Priority;
  /** New assignee */
  assignee?: string;
  /** Additional frontmatter updates */
  frontmatter?: Partial<RequirementFrontmatter>;
  /** Content updates */
  content?: string;
}

