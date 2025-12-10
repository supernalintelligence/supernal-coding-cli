/**
 * PhaseNavigator - Phase navigation logic
 */

interface Transition {
  to: string;
}

interface Phase {
  id: string;
  name?: string;
  transitions?: Transition[];
}

interface WorkflowDefinition {
  phases: Phase[];
}

class PhaseNavigator {
  protected workflow: WorkflowDefinition;
  protected phases: Phase[];

  constructor(workflowDefinition: WorkflowDefinition) {
    this.workflow = workflowDefinition;
    this.phases = workflowDefinition.phases || [];
  }

  getNextPhase(currentPhaseId: string): Phase | null {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex === -1 || currentIndex === this.phases.length - 1) {
      return null;
    }
    return this.phases[currentIndex + 1];
  }

  getPreviousPhase(currentPhaseId: string): Phase | null {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex <= 0) {
      return null;
    }
    return this.phases[currentIndex - 1];
  }

  getPhase(phaseId: string): Phase | null {
    return this.phases.find((p) => p.id === phaseId) || null;
  }

  getFirstPhase(): Phase | null {
    return this.phases.length > 0 ? this.phases[0] : null;
  }

  getLastPhase(): Phase | null {
    return this.phases.length > 0 ? this.phases[this.phases.length - 1] : null;
  }

  canTransitionTo(fromPhaseId: string, toPhaseId: string): boolean {
    const fromPhase = this.getPhase(fromPhaseId);
    if (!fromPhase || !fromPhase.transitions) return false;

    return fromPhase.transitions.some((t) => t.to === toPhaseId);
  }

  getProgress(currentPhaseId: string): number {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex === -1) return 0;

    const totalPhases = this.phases.length;
    if (totalPhases === 0) return 0;

    return Math.round((currentIndex / totalPhases) * 100);
  }

  getUpcomingPhases(currentPhaseId: string, count: number = 3): Phase[] {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex === -1) return [];

    const startIndex = currentIndex + 1;
    const endIndex = Math.min(startIndex + count, this.phases.length);

    return this.phases.slice(startIndex, endIndex);
  }

  getCompletedPhases(currentPhaseId: string): Phase[] {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex === -1) return [];

    return this.phases.slice(0, currentIndex);
  }

  getPhaseOrder(phaseId: string): number {
    const index = this.phases.findIndex((p) => p.id === phaseId);
    return index === -1 ? 0 : index + 1;
  }

  getTotalPhases(): number {
    return this.phases.length;
  }

  isValidPhase(phaseId: string): boolean {
    return this.phases.some((p) => p.id === phaseId);
  }
}

export { PhaseNavigator };
module.exports = { PhaseNavigator };
