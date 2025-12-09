/**
 * Supernal Coding Type Definitions
 * @module @supernal/types
 * 
 * Central export for all type definitions.
 * Import from this module for full type coverage.
 * 
 * @example
 * ```typescript
 * import type { 
 *   SupernalConfig, 
 *   ParsedRequirement, 
 *   RepoDataSource 
 * } from 'supernal-coding/types';
 * ```
 */

// =============================================================================
// Config Types
// =============================================================================
export type {
  // Branded types
  FilePath,
  RequirementId,
  EpicSlug,
  // Status types
  RequirementStatus,
  Priority,
  RequestType,
  // Config interfaces
  GitConfig,
  PathsConfig,
  WorkflowConfig,
  GitHooksConfig,
  SupernalConfig,
  ConfigLoadResult,
  ConfigLoadOptions,
  // Document paths
  DocPaths,
  PlanningPhasePaths,
  PlanningLifecyclePaths,
  ProjectInfo,
  // Raw config
  DocumentationConfig,
  ProjectConfig,
  RawSupernalConfig,
} from './config/index.js';

// =============================================================================
// Document Types
// =============================================================================
export type {
  // Frontmatter types
  BaseFrontmatter,
  RequirementFrontmatter,
  EpicFrontmatter,
  FeatureFrontmatter,
  // Parsed document types
  ParsedRequirement,
  ParsedEpic,
  ParsedFeature,
  // Gherkin types
  GherkinScenario,
  GherkinFeature,
  // Progress types
  EpicProgress,
  DocumentStats,
  // Validation types
  ValidationError,
  ValidationResult as DocumentValidationResult,
  // Manager types
  ListDocumentsOptions,
  CreateDocumentOptions,
  UpdateDocumentOptions,
} from './documents/index.js';

// =============================================================================
// CLI Types
// =============================================================================
export type {
  // Base types
  BaseCommandOptions,
  OutputFormat,
  CommandResult,
  // Requirement command types
  RequirementNewOptions,
  RequirementListOptions,
  RequirementUpdateOptions,
  RequirementValidateOptions,
  // Git command types
  GitBranchOptions,
  GitMergeOptions,
  GitCheckContextOptions,
  // Test command types
  TestOptions,
  TestResultSummary,
  // Workflow command types
  WorkflowNewOptions,
  WorkflowListOptions,
  // Output types
  TableColumn,
  TableOptions,
  ProgressOptions,
  // Error types
  CliErrorCode,
  CliError,
} from './cli/index.js';

// =============================================================================
// Integration Types
// =============================================================================
export type {
  // Auth types
  AuthContext,
  RepoContext,
  // Data source types
  ListFilesOptions,
  RepoFile,
  RepoDataSource,
  RepoMetadata,
  // Parsed data types
  SupernalRepoData,
  ParseError,
  // GitHub types
  GitHubUser,
  GitHubRepository,
  GitHubInstallation,
  // Webhook types
  WebhookPayloadBase,
  PushWebhookPayload,
  PullRequestWebhookPayload,
  InstallationWebhookPayload,
  InstallationRepositoriesWebhookPayload,
  WebhookPayload,
  // Modal types
  ModalExtractRequest,
  ModalExtractResult,
  // Cache types
  CacheEntry,
  CacheOptions,
  RepoCache,
  // API types
  ApiResponse,
  PaginatedResponse,
} from './integrations/index.js';

// =============================================================================
// Git Types
// =============================================================================
export type {
  // Commit types
  GitCommit,
  GitFileChange,
  // Branch types
  GitBranch,
  BranchPattern,
  // Status types
  GitStatus,
  GitStatusFile,
  // Remote types
  GitRemote,
  // Diff types
  GitDiff,
  GitDiffFile,
  GitDiffHunk,
  GitDiffLine,
  // Tracking types
  RequirementTracking,
  GitContext,
  // Operation types
  GitOperationResult,
  MergeResult,
} from './git/index.js';

// =============================================================================
// Validation Types
// =============================================================================
export type {
  // Error types
  ValidationSeverity,
  ValidationErrorCode,
  ValidationErrorDetail,
  // Result types
  FileValidationResult,
  ValidationResult,
  // Rule types
  ValidationRule,
  ValidationRuleConfig,
  ValidatorConfig,
  // Schema types
  SchemaValidationResult,
  SchemaValidationError,
  // Compliance types
  ComplianceCheckResult,
  ComplianceEvidence,
  ComplianceReport,
  // Traceability types
  TraceabilityLink,
  TraceabilityMatrix,
} from './validation/index.js';

// =============================================================================
// Utility Types
// =============================================================================
export type {
  // Result types
  Success,
  Failure,
  Result,
  AsyncResult,
  // Logging types
  LogLevel,
  LogEntry,
  Logger,
  // Path types
  PathResolution,
  FileMetadata,
  // Collection types
  PaginatedList,
  GroupedItems,
  // Template types
  TemplateVariable,
  TemplateDefinition,
  TemplateResolution,
  // Event types
  EventPayload,
  EventHandler,
  EventEmitter,
  // Helper types
  DeepPartial,
  DeepReadonly,
  RequireKeys,
  OptionalKeys,
  KeysOfType,
  Nullable,
  Maybe,
  // Time types
  DurationMs,
  Timestamp,
  TimeRange,
  // Version types
  SemanticVersion,
  VersionComparison,
} from './utils/index.js';

// =============================================================================
// Workflow Types
// =============================================================================
export type {
  // State types
  WorkflowState,
  AutoTransitionCondition,
  WorkflowDefinition,
  // Instance types
  WorkflowInstance,
  StateTransition,
  // WIP types
  WipEntry,
  WipRegistry,
  WipStatus,
  // Kanban types
  KanbanColumn,
  KanbanBoard,
  KanbanItem,
  KanbanFilter,
  // Task types
  Task,
  TaskList,
  // Automation types
  AutomationTrigger,
  AutomationAction,
  AutomationRule,
  AutomationResult,
  // Milestone types
  Milestone,
  MilestoneProgress,
} from './workflow/index.js';

// =============================================================================
// Version
// =============================================================================
/** Type definitions version */
export const TYPES_VERSION = '1.2.0';

