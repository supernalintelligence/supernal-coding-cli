/**
 * Type definitions for requirement parsing
 * @module requirements/types
 */

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export type Phase = 'discovery' | 'foundation' | 'implementation' | 'integration' | 'release';

export type RequirementType =
  | 'evidence'
  | 'problem'
  | 'story'
  | 'functional-requirement'
  | 'technical-requirement'
  | 'component'
  | 'architecture'
  | 'test'
  | 'monitoring'
  | 'verification'
  | 'compliance'
  | 'kanban';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface Requirement {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Priority;
  priorityScore: number;
  status: string;
  phase: Phase;
  pattern: string;
  type: RequirementType;
  filePath: string;
  dependencies?: string[];
  epic?: string;
  assignee?: string;
  version?: string;
  tags?: string[];
  created?: string;
  updated?: string;
  reviewedBy?: string;
  approvedBy?: string;
  riskLevel?: RiskLevel;
  complianceStandards?: string[];
}

export interface PhaseStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  progress: number;
}

export interface PhasesData {
  groups: Record<RequirementType, Requirement[]>;
  stats: Record<RequirementType, PhaseStats>;
  totalRequirements: number;
}

module.exports = {};
