/**
 * PhaseNavigator - Phase navigation logic
 */
class PhaseNavigator {
  constructor(workflowDefinition) {
    this.workflow = workflowDefinition;
    this.phases = workflowDefinition.phases || [];
  }

  /**
   * Get next phase
   * @param {string} currentPhaseId
   * @returns {Object|null} Next phase or null if at end
   */
  getNextPhase(currentPhaseId) {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex === -1 || currentIndex === this.phases.length - 1) {
      return null;
    }
    return this.phases[currentIndex + 1];
  }

  /**
   * Get previous phase
   * @param {string} currentPhaseId
   * @returns {Object|null} Previous phase or null if at start
   */
  getPreviousPhase(currentPhaseId) {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex <= 0) {
      return null;
    }
    return this.phases[currentIndex - 1];
  }

  /**
   * Get phase by ID
   * @param {string} phaseId
   * @returns {Object|null}
   */
  getPhase(phaseId) {
    return this.phases.find((p) => p.id === phaseId) || null;
  }

  /**
   * Get first phase
   * @returns {Object|null}
   */
  getFirstPhase() {
    return this.phases.length > 0 ? this.phases[0] : null;
  }

  /**
   * Get last phase
   * @returns {Object|null}
   */
  getLastPhase() {
    return this.phases.length > 0 ? this.phases[this.phases.length - 1] : null;
  }

  /**
   * Check if can transition to target phase
   * @param {string} fromPhaseId
   * @param {string} toPhaseId
   * @returns {boolean}
   */
  canTransitionTo(fromPhaseId, toPhaseId) {
    const fromPhase = this.getPhase(fromPhaseId);
    if (!fromPhase || !fromPhase.transitions) return false;

    // Check if toPhaseId is in allowed transitions
    return fromPhase.transitions.some((t) => t.to === toPhaseId);
  }

  /**
   * Calculate progress percentage
   * @param {string} currentPhaseId
   * @returns {number} Progress 0-100
   */
  getProgress(currentPhaseId) {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex === -1) return 0;

    const totalPhases = this.phases.length;
    if (totalPhases === 0) return 0;

    // Progress based on completed phases (current phase is in progress)
    return Math.round((currentIndex / totalPhases) * 100);
  }

  /**
   * Get upcoming phases
   * @param {string} currentPhaseId
   * @param {number} count - Number of upcoming phases to return
   * @returns {Array<Object>}
   */
  getUpcomingPhases(currentPhaseId, count = 3) {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex === -1) return [];

    const startIndex = currentIndex + 1;
    const endIndex = Math.min(startIndex + count, this.phases.length);

    return this.phases.slice(startIndex, endIndex);
  }

  /**
   * Get completed phases (before current)
   * @param {string} currentPhaseId
   * @returns {Array<Object>}
   */
  getCompletedPhases(currentPhaseId) {
    const currentIndex = this.phases.findIndex((p) => p.id === currentPhaseId);
    if (currentIndex === -1) return [];

    return this.phases.slice(0, currentIndex);
  }

  /**
   * Get phase order number
   * @param {string} phaseId
   * @returns {number} 1-based order (0 if not found)
   */
  getPhaseOrder(phaseId) {
    const index = this.phases.findIndex((p) => p.id === phaseId);
    return index === -1 ? 0 : index + 1;
  }

  /**
   * Get total phase count
   * @returns {number}
   */
  getTotalPhases() {
    return this.phases.length;
  }

  /**
   * Validate phase ID exists
   * @param {string} phaseId
   * @returns {boolean}
   */
  isValidPhase(phaseId) {
    return this.phases.some((p) => p.id === phaseId);
  }
}

module.exports = { PhaseNavigator };
