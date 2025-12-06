/**
 * WorkflowState - In-memory workflow state representation
 */
class WorkflowState {
  constructor(data = {}) {
    this.workflow = data.workflow || null;
    this.version = data.version || null;
    this.currentPhase = data.currentPhase || null;
    this.phaseHistory = data.phaseHistory || [];
    this.startedAt = data.startedAt || new Date().toISOString();
    this.lastModified = data.lastModified || new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  /**
   * Update current phase
   * @param {string} phaseId - New phase ID
   */
  setPhase(phaseId) {
    this.currentPhase = phaseId;
    this.lastModified = new Date().toISOString();
  }

  /**
   * Add phase to completion history
   * @param {string} phaseId - Phase ID
   * @param {Object} metadata - Additional metadata (duration, forced, etc.)
   */
  addToHistory(phaseId, metadata = {}) {
    const entry = {
      phase: phaseId,
      completedAt: new Date().toISOString(),
      ...metadata
    };

    this.phaseHistory.push(entry);
    this.lastModified = new Date().toISOString();
  }

  /**
   * Calculate workflow progress
   * @param {number} totalPhases - Total phases in workflow
   * @returns {number} Progress percentage (0-100)
   */
  getProgress(totalPhases) {
    if (!totalPhases || totalPhases === 0) return 0;
    const completedCount = this.phaseHistory.length;
    return Math.round((completedCount / totalPhases) * 100);
  }

  /**
   * Get completed phases
   * @returns {Array<string>} Array of completed phase IDs
   */
  getCompletedPhases() {
    return this.phaseHistory.map((entry) => entry.phase);
  }

  /**
   * Check if phase was completed
   * @param {string} phaseId
   * @returns {boolean}
   */
  isPhaseCompleted(phaseId) {
    return this.phaseHistory.some((entry) => entry.phase === phaseId);
  }

  /**
   * Get phase completion entry
   * @param {string} phaseId
   * @returns {Object|null}
   */
  getPhaseEntry(phaseId) {
    return this.phaseHistory.find((entry) => entry.phase === phaseId) || null;
  }

  /**
   * Serialize to JSON
   * @returns {Object}
   */
  toJSON() {
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

  /**
   * Create from JSON
   * @param {Object} json
   * @returns {WorkflowState}
   */
  static fromJSON(json) {
    return new WorkflowState(json);
  }
}

module.exports = { WorkflowState };
