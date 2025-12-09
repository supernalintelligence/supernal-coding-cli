/**
 * Workflow Types
 * @module @supernal/types/workflow
 * 
 * Types for workflow management, state transitions, and automation.
 */

import type { RequirementId, EpicSlug, RequirementStatus } from '../config/index.js';
import type { Timestamp } from '../utils/index.js';

// =============================================================================
// Workflow State Types
// =============================================================================

/** Workflow state */
export interface WorkflowState {
  /** State ID */
  id: string;
  /** State name */
  name: string;
  /** State description */
  description?: string;
  /** State type */
  type: 'initial' | 'intermediate' | 'final' | 'cancelled';
  /** Allowed transitions from this state */
  transitions: string[];
  /** Required fields to enter this state */
  requiredFields?: string[];
  /** Auto-transition conditions */
  autoTransition?: AutoTransitionCondition;
}

/** Auto-transition condition */
export interface AutoTransitionCondition {
  /** Target state */
  targetState: string;
  /** Condition type */
  type: 'all-complete' | 'approval' | 'time-based' | 'custom';
  /** Condition parameters */
  params?: Record<string, unknown>;
}

/** Workflow definition */
export interface WorkflowDefinition {
  /** Workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow version */
  version: string;
  /** Workflow description */
  description?: string;
  /** States in this workflow */
  states: WorkflowState[];
  /** Initial state ID */
  initialState: string;
  /** Final states */
  finalStates: string[];
  /** Workflow metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Workflow Instance Types
// =============================================================================

/** Workflow instance (running workflow) */
export interface WorkflowInstance {
  /** Instance ID */
  instanceId: string;
  /** Workflow definition ID */
  workflowId: string;
  /** Current state ID */
  currentState: string;
  /** Entity type being tracked */
  entityType: 'requirement' | 'epic' | 'feature' | 'task';
  /** Entity ID */
  entityId: RequirementId | EpicSlug | string;
  /** Created timestamp */
  createdAt: Timestamp;
  /** Last updated timestamp */
  updatedAt: Timestamp;
  /** State history */
  history: StateTransition[];
  /** Instance data */
  data?: Record<string, unknown>;
}

/** State transition record */
export interface StateTransition {
  /** From state */
  fromState: string;
  /** To state */
  toState: string;
  /** Transition timestamp */
  timestamp: Timestamp;
  /** User who triggered transition */
  triggeredBy?: string;
  /** Transition reason */
  reason?: string;
  /** Transition metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// WIP Registry Types
// =============================================================================

/** WIP (Work in Progress) entry */
export interface WipEntry {
  /** File path */
  path: string;
  /** Feature name */
  feature: string;
  /** Associated requirement */
  requirement?: RequirementId;
  /** User ID who registered */
  userId: string;
  /** Registration timestamp */
  registeredAt: Timestamp;
  /** Reason for WIP */
  reason?: string;
  /** Notes */
  notes?: string;
  /** Last touched timestamp */
  lastTouched?: Timestamp;
}

/** WIP registry */
export interface WipRegistry {
  /** Registry version */
  version: string;
  /** All WIP entries */
  entries: WipEntry[];
  /** Last updated */
  updatedAt: Timestamp;
}

/** WIP status summary */
export interface WipStatus {
  /** Total WIP files */
  totalFiles: number;
  /** Files by user */
  byUser: Record<string, number>;
  /** Files by feature */
  byFeature: Record<string, number>;
  /** Untracked files count */
  untrackedCount: number;
  /** Untracked file paths */
  untrackedFiles: string[];
}

// =============================================================================
// Kanban Types
// =============================================================================

/** Kanban column */
export interface KanbanColumn {
  /** Column ID */
  id: string;
  /** Column name */
  name: string;
  /** Column order */
  order: number;
  /** WIP limit */
  wipLimit?: number;
  /** Mapped status */
  mappedStatus: RequirementStatus;
  /** Column color */
  color?: string;
}

/** Kanban board */
export interface KanbanBoard {
  /** Board ID */
  id: string;
  /** Board name */
  name: string;
  /** Board columns */
  columns: KanbanColumn[];
  /** Items on board */
  items: KanbanItem[];
  /** Board filters */
  filters?: KanbanFilter[];
}

/** Kanban item */
export interface KanbanItem {
  /** Item ID (requirement/epic ID) */
  id: RequirementId | EpicSlug;
  /** Item type */
  type: 'requirement' | 'epic';
  /** Current column */
  columnId: string;
  /** Item title */
  title: string;
  /** Item priority */
  priority?: string;
  /** Assignee */
  assignee?: string;
  /** Due date */
  dueDate?: string;
  /** Position in column */
  position: number;
  /** Labels */
  labels?: string[];
}

/** Kanban filter */
export interface KanbanFilter {
  /** Filter field */
  field: 'priority' | 'assignee' | 'epic' | 'label' | 'type';
  /** Filter operator */
  operator: 'equals' | 'contains' | 'in' | 'not-in';
  /** Filter value */
  value: string | string[];
}

// =============================================================================
// Task Types
// =============================================================================

/** Task definition */
export interface Task {
  /** Task ID */
  id: string;
  /** Task title */
  title: string;
  /** Task description */
  description?: string;
  /** Parent requirement */
  requirement?: RequirementId;
  /** Task status */
  status: 'pending' | 'in-progress' | 'blocked' | 'done' | 'cancelled';
  /** Assignee */
  assignee?: string;
  /** Due date */
  dueDate?: string;
  /** Priority */
  priority?: 'high' | 'medium' | 'low';
  /** Estimated hours */
  estimate?: number;
  /** Actual hours */
  actual?: number;
  /** Dependencies */
  dependencies?: string[];
  /** Created at */
  createdAt: Timestamp;
  /** Updated at */
  updatedAt: Timestamp;
}

/** Task list */
export interface TaskList {
  /** List ID */
  id: string;
  /** List name */
  name: string;
  /** Tasks */
  tasks: Task[];
  /** Completion percentage */
  progress: number;
}

// =============================================================================
// Automation Types
// =============================================================================

/** Automation trigger */
export interface AutomationTrigger {
  /** Trigger type */
  type: 'status-change' | 'commit' | 'pr-merge' | 'schedule' | 'manual';
  /** Trigger conditions */
  conditions?: Record<string, unknown>;
  /** Source event */
  sourceEvent?: string;
}

/** Automation action */
export interface AutomationAction {
  /** Action type */
  type: 'update-status' | 'assign' | 'notify' | 'create-task' | 'run-script';
  /** Action parameters */
  params: Record<string, unknown>;
}

/** Automation rule */
export interface AutomationRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Trigger */
  trigger: AutomationTrigger;
  /** Actions to execute */
  actions: AutomationAction[];
  /** Rule priority (for ordering) */
  priority: number;
}

/** Automation execution result */
export interface AutomationResult {
  /** Rule ID */
  ruleId: string;
  /** Execution timestamp */
  executedAt: Timestamp;
  /** Whether execution succeeded */
  success: boolean;
  /** Actions executed */
  actionsExecuted: number;
  /** Error message if failed */
  error?: string;
  /** Execution duration (ms) */
  duration: number;
}

// =============================================================================
// Milestone Types
// =============================================================================

/** Milestone definition */
export interface Milestone {
  /** Milestone ID */
  id: string;
  /** Milestone name */
  name: string;
  /** Milestone description */
  description?: string;
  /** Target date */
  targetDate?: string;
  /** Completion date */
  completedDate?: string;
  /** Status */
  status: 'planned' | 'active' | 'completed' | 'missed';
  /** Associated epics */
  epics: EpicSlug[];
  /** Progress percentage */
  progress: number;
}

/** Milestone progress */
export interface MilestoneProgress {
  /** Milestone ID */
  milestoneId: string;
  /** Total requirements */
  totalRequirements: number;
  /** Completed requirements */
  completedRequirements: number;
  /** In-progress requirements */
  inProgressRequirements: number;
  /** Blocked requirements */
  blockedRequirements: number;
  /** Days until target */
  daysRemaining?: number;
  /** Projected completion date */
  projectedCompletion?: string;
  /** Risk level */
  risk: 'low' | 'medium' | 'high';
}

