/**
 * Validation Types
 * @module @supernal/types/validation
 * 
 * Types for document validation, schema validation, and compliance checking.
 */

import type { FilePath, RequirementId } from '../config/index.js';

// =============================================================================
// Validation Error Types
// =============================================================================

/** Validation severity levels */
export type ValidationSeverity = 'error' | 'warning' | 'info' | 'hint';

/** Validation error codes */
export type ValidationErrorCode =
  // Frontmatter errors
  | 'MISSING_FRONTMATTER'
  | 'INVALID_FRONTMATTER'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_TYPE'
  | 'INVALID_FIELD_VALUE'
  // Structure errors
  | 'INVALID_FILE_NAME'
  | 'INVALID_DIRECTORY'
  | 'DUPLICATE_ID'
  | 'ORPHAN_REQUIREMENT'
  | 'MISSING_EPIC'
  // Content errors
  | 'EMPTY_CONTENT'
  | 'MISSING_SECTION'
  | 'INVALID_GHERKIN'
  | 'BROKEN_LINK'
  // Reference errors
  | 'INVALID_REFERENCE'
  | 'CIRCULAR_REFERENCE'
  | 'MISSING_REFERENCE'
  // Custom rule errors
  | 'CUSTOM_RULE_VIOLATION'
  | string;

/** Validation error detail */
export interface ValidationErrorDetail {
  /** Error code */
  code: ValidationErrorCode;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: ValidationSeverity;
  /** File path where error occurred */
  path?: FilePath;
  /** Line number (1-indexed) */
  line?: number;
  /** Column number (1-indexed) */
  column?: number;
  /** End line for range */
  endLine?: number;
  /** End column for range */
  endColumn?: number;
  /** Suggested fix */
  suggestion?: string;
  /** Auto-fixable flag */
  fixable?: boolean;
  /** Rule ID that generated this error */
  ruleId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

// =============================================================================
// Validation Result Types
// =============================================================================

/** Validation result for a single file */
export interface FileValidationResult {
  /** File path */
  path: FilePath;
  /** Whether file is valid */
  valid: boolean;
  /** Errors found */
  errors: ValidationErrorDetail[];
  /** Warnings found */
  warnings: ValidationErrorDetail[];
  /** Info messages */
  info: ValidationErrorDetail[];
  /** Time taken to validate (ms) */
  duration?: number;
}

/** Aggregated validation result */
export interface ValidationResult {
  /** Overall validity */
  valid: boolean;
  /** Total error count */
  errorCount: number;
  /** Total warning count */
  warningCount: number;
  /** Total info count */
  infoCount: number;
  /** Per-file results */
  files: FileValidationResult[];
  /** Summary by error code */
  summary: Record<ValidationErrorCode, number>;
  /** Total time taken (ms) */
  duration: number;
  /** Timestamp */
  timestamp: string;
}

// =============================================================================
// Validation Rule Types
// =============================================================================

/** Validation rule definition */
export interface ValidationRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Default severity */
  severity: ValidationSeverity;
  /** Whether rule is enabled by default */
  enabled: boolean;
  /** Document types this rule applies to */
  appliesTo: ('requirement' | 'epic' | 'feature' | 'all')[];
  /** Whether rule can auto-fix */
  fixable: boolean;
  /** Rule category */
  category: 'frontmatter' | 'structure' | 'content' | 'reference' | 'custom';
  /** Rule options schema */
  optionsSchema?: Record<string, unknown>;
}

/** Validation rule configuration */
export interface ValidationRuleConfig {
  /** Rule ID */
  id: string;
  /** Whether rule is enabled */
  enabled?: boolean;
  /** Override severity */
  severity?: ValidationSeverity;
  /** Rule-specific options */
  options?: Record<string, unknown>;
}

// =============================================================================
// Validator Configuration Types
// =============================================================================

/** Validator configuration */
export interface ValidatorConfig {
  /** Rules to apply */
  rules: ValidationRuleConfig[];
  /** Paths to include */
  include?: string[];
  /** Paths to exclude */
  exclude?: string[];
  /** Fail on warnings */
  failOnWarnings?: boolean;
  /** Max errors before aborting */
  maxErrors?: number;
  /** Enable parallel validation */
  parallel?: boolean;
  /** Cache validation results */
  cache?: boolean;
  /** Output format */
  outputFormat?: 'text' | 'json' | 'junit' | 'sarif';
}

// =============================================================================
// Schema Validation Types
// =============================================================================

/** JSON Schema validation result */
export interface SchemaValidationResult {
  /** Whether data is valid */
  valid: boolean;
  /** Schema validation errors */
  errors: SchemaValidationError[];
  /** Schema that was validated against */
  schema?: string;
}

/** Schema validation error */
export interface SchemaValidationError {
  /** JSON path to error */
  path: string;
  /** Error message */
  message: string;
  /** Expected value/type */
  expected?: string;
  /** Actual value/type */
  actual?: string;
  /** Schema keyword that failed */
  keyword?: string;
  /** Parameters for the keyword */
  params?: Record<string, unknown>;
}

// =============================================================================
// Compliance Validation Types
// =============================================================================

/** Compliance check result */
export interface ComplianceCheckResult {
  /** Check ID */
  checkId: string;
  /** Check name */
  name: string;
  /** Whether check passed */
  passed: boolean;
  /** Check details */
  details: string;
  /** Evidence collected */
  evidence?: ComplianceEvidence[];
  /** Remediation steps if failed */
  remediation?: string[];
  /** Compliance standard reference */
  standard?: string;
  /** Section/clause reference */
  section?: string;
}

/** Compliance evidence */
export interface ComplianceEvidence {
  /** Evidence type */
  type: 'document' | 'code' | 'test' | 'log' | 'screenshot' | 'other';
  /** Evidence path or reference */
  reference: string;
  /** Evidence description */
  description: string;
  /** Collection timestamp */
  collectedAt: string;
}

/** Compliance report */
export interface ComplianceReport {
  /** Report ID */
  reportId: string;
  /** Report title */
  title: string;
  /** Compliance standard */
  standard: string;
  /** Report timestamp */
  timestamp: string;
  /** Overall compliance status */
  status: 'compliant' | 'non-compliant' | 'partial' | 'unknown';
  /** Total checks */
  totalChecks: number;
  /** Passed checks */
  passedChecks: number;
  /** Failed checks */
  failedChecks: number;
  /** Individual check results */
  checks: ComplianceCheckResult[];
  /** Report metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Traceability Types
// =============================================================================

/** Traceability link */
export interface TraceabilityLink {
  /** Source item ID */
  sourceId: RequirementId | string;
  /** Source type */
  sourceType: 'requirement' | 'epic' | 'feature' | 'test' | 'code';
  /** Target item ID */
  targetId: RequirementId | string;
  /** Target type */
  targetType: 'requirement' | 'epic' | 'feature' | 'test' | 'code';
  /** Link type */
  linkType: 'implements' | 'tests' | 'derives-from' | 'related-to' | 'blocks' | 'depends-on';
  /** Link status */
  status: 'valid' | 'broken' | 'stale';
  /** Verification timestamp */
  verifiedAt?: string;
}

/** Traceability matrix */
export interface TraceabilityMatrix {
  /** Matrix timestamp */
  timestamp: string;
  /** All links */
  links: TraceabilityLink[];
  /** Orphan items (no links) */
  orphans: {
    requirements: RequirementId[];
    tests: string[];
    features: string[];
  };
  /** Coverage statistics */
  coverage: {
    requirementsCovered: number;
    requirementsTotal: number;
    testCoverage: number;
    codeCoverage?: number;
  };
}

