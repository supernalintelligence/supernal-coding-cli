/**
 * WorkflowState - In-memory workflow state representation
 */

interface PhaseHistoryEntry {
  phase: string;
  completedAt: string;
  [key: string]: unknown;
}

interface WorkflowStateData {
  workflow?: string | null;
  version?: string | null;
  currentPhase?: string | null;
  phaseHistory?: PhaseHistoryEntry[];
  startedAt?: string;
  lastModified?: string;
  metadata?: Record<string, unknown>;
}

class WorkflowState {
  public workflow: string | null;
  public version: string | null;
  public currentPhase: string | null;
  public phaseHistory: PhaseHistoryEntry[];
  public startedAt: string;
  public lastModified: string;
  public metadata: Record<string, unknown>;

  constructor(data: WorkflowStateData = {}) {
    this.workflow = data.workflow || null;
    this.version = data.version || null;
    this.currentPhase = data.currentPhase || null;
    this.phaseHistory = data.phaseHistory || [];
    this.startedAt = data.startedAt || new Date().toISOString();
    this.lastModified = data.lastModified || new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  setPhase(phaseId: string): void {
    this.currentPhase = phaseId;
    this.lastModified = new Date().toISOString();
  }

  addToHistory(phaseId: string, metadata: Record<string, unknown> = {}): void {
    const entry: PhaseHistoryEntry = {
      phase: phaseId,
      completedAt: new Date().toISOString(),
      ...metadata
    };

    this.phaseHistory.push(entry);
    this.lastModified = new Date().toISOString();
  }

  getProgress(totalPhases: number): number {
    if (!totalPhases || totalPhases === 0) return 0;
    const completedCount = this.phaseHistory.length;
    return Math.round((completedCount / totalPhases) * 100);
  }

  getCompletedPhases(): string[] {
    return this.phaseHistory.map((entry) => entry.phase);
  }

  isPhaseCompleted(phaseId: string): boolean {
    return this.phaseHistory.some((entry) => entry.phase === phaseId);
  }

  getPhaseEntry(phaseId: string): PhaseHistoryEntry | null {
    return this.phaseHistory.find((entry) => entry.phase === phaseId) || null;
  }

  toJSON(): WorkflowStateData {
    return {
      workflow: this.workflow,
      version: this.version,
      currentPhase: this.currentPhase,
      phaseHistory: this.phaseHistory,
      startedAt: this.startedAt,
      lastModified: this.lastModified,
      metadata: this.metadata
    };
  }

  static fromJSON(json: WorkflowStateData): WorkflowState {
    return new WorkflowState(json);
  }
}

export { WorkflowState };
module.exports = { WorkflowState };
