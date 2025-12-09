const path = require('node:path');
const { ConfigLoader } = require('../config');
const { WorkflowState } = require('./state');
const { PhaseNavigator } = require('./navigator');
const { StateStore } = require('./state-store');

/**
 * WorkflowLoader - Main orchestrator for workflow execution
 */
class WorkflowLoader {
  constructor(projectRoot, config, state) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.state = state;

    // Initialize components
    this.navigator = new PhaseNavigator(config);
    this.store = new StateStore(projectRoot);
  }

  /**
   * Load workflow from config
   * @param {string} projectRoot - Project directory
   * @returns {Promise<WorkflowLoader>}
   */
  static async load(projectRoot) {
    // Load configuration
    const configLoader = new ConfigLoader();
    const configFile = path.join(projectRoot, '.supernal', 'project.yaml');
    const config = await configLoader.load(configFile);

    // Extract workflow pattern (assumes it was resolved by ConfigLoader)
    const workflowDef = config.workflow || { phases: [] };

    // Load or create state
    const store = new StateStore(projectRoot);
    let state;

    if (await store.exists()) {
      state = await store.load();
    } else {
      // Initialize new state
      state = new WorkflowState({
        workflow: workflowDef.name || 'unknown',
        version: workflowDef.version || '1.0.0',
        currentPhase: workflowDef.phases[0]?.id || null
      });
      await store.save(state);
    }

    return new WorkflowLoader(projectRoot, workflowDef, state);
  }

  /**
   * Initialize workflow state
   * @param {string} workflowName - Workflow pattern name
   * @returns {Promise<void>}
   */
  async initialize(workflowName) {
    const firstPhase = this.navigator.getFirstPhase();
    if (!firstPhase) {
      throw new Error('Workflow has no phases');
    }

    this.state = new WorkflowState({
      workflow: workflowName,
      version: this.config.version || '1.0.0',
      currentPhase: firstPhase.id
    });

    await this.store.save(this.state);
  }

  /**
   * Get current phase
   * @returns {Object|null} Current phase object with metadata
   */
  getCurrentPhase() {
    return this.navigator.getPhase(this.state.currentPhase);
  }

  /**
   * Move to next phase
   * @param {Object} options
   * @param {boolean} options.force - Skip validation
   * @param {boolean} options.skipHistory - Don't record in history
   * @returns {Promise<Object>} New current phase
   */
  async next(options = {}) {
    const currentPhase = this.state.currentPhase;
    const nextPhase = this.navigator.getNextPhase(currentPhase);

    if (!nextPhase) {
      throw new Error('Already at last phase');
    }

    // Validate transition unless forced
    if (!options.force) {
      // Basic validation - just check if phase exists
      const validation = { valid: true };

      if (!validation.valid) {
        const error = new Error('Phase transition validation failed');
        error.validationErrors = validation.errors;
        error.warnings = validation.warnings;
        throw error;
      }
    }

    // Create backup before transition
    await this.store.backup();

    // Record current phase in history
    if (!options.skipHistory) {
      this.state.addToHistory(currentPhase, {
        forced: options.force || false
      });
    }

    // Update current phase
    this.state.setPhase(nextPhase.id);

    // Persist state
    await this.store.save(this.state);

    return nextPhase;
  }

  /**
   * Move to previous phase
   * @param {Object} options
   * @returns {Promise<Object>} New current phase
   */
  async previous(_options = {}) {
    const currentPhase = this.state.currentPhase;
    const prevPhase = this.navigator.getPreviousPhase(currentPhase);

    if (!prevPhase) {
      throw new Error('Already at first phase');
    }

    // Create backup
    await this.store.backup();

    // Remove last history entry if going back
    if (this.state.phaseHistory.length > 0) {
      this.state.phaseHistory.pop();
    }

    // Update current phase
    this.state.setPhase(prevPhase.id);

    // Persist state
    await this.store.save(this.state);

    return prevPhase;
  }

  /**
   * Jump to specific phase
   * @param {string} phaseId - Target phase ID
   * @param {Object} options
   * @param {boolean} options.force - Skip validation
   * @returns {Promise<Object>} New current phase
   */
  async jumpTo(phaseId, options = {}) {
    const targetPhase = this.navigator.getPhase(phaseId);
    if (!targetPhase) {
      throw new Error(`Phase "${phaseId}" not found`);
    }

    // Validate transition unless forced
    if (!options.force) {
      // Basic validation - just check if phase exists
      const validation = { valid: true };

      if (!validation.valid) {
        const error = new Error('Phase transition validation failed');
        error.validationErrors = validation.errors;
        error.warnings = validation.warnings;
        throw error;
      }
    }

    // Create backup
    await this.store.backup();

    // Update current phase
    this.state.setPhase(phaseId);

    // Persist state
    await this.store.save(this.state);

    return targetPhase;
  }

  /**
   * Get workflow status
   * @returns {Object} WorkflowStatus
   */
  getStatus() {
    const currentPhase = this.getCurrentPhase();
    const totalPhases = this.navigator.getTotalPhases();
    const completedPhases = this.navigator.getCompletedPhases(
      this.state.currentPhase
    );
    const upcomingPhases = this.navigator.getUpcomingPhases(
      this.state.currentPhase,
      3
    );

    return {
      workflow: this.state.workflow,
      version: this.state.version,
      currentPhase,
      progress: this.navigator.getProgress(this.state.currentPhase),
      totalPhases,
      currentOrder: this.navigator.getPhaseOrder(this.state.currentPhase),
      completedPhases,
      upcomingPhases,
      history: this.state.phaseHistory,
      startedAt: this.state.startedAt,
      lastModified: this.state.lastModified
    };
  }

  /**
   * Validate if can transition to phase
   * @param {string} targetPhaseId
   * @param {Object} context
   * @returns {Promise<Object>} ValidationResult
   */
  async canTransitionTo(targetPhaseId, _context = {}) {
    // Basic check - just verify phase exists
    const targetPhase = this.navigator.getPhase(targetPhaseId);
    return {
      valid: !!targetPhase,
      errors: targetPhase ? [] : [`Phase "${targetPhaseId}" not found`]
    };
  }

  /**
   * Reset workflow to beginning
   * @returns {Promise<void>}
   */
  async reset() {
    // Create backup before reset
    await this.store.backup();

    // Reset to first phase
    const firstPhase = this.navigator.getFirstPhase();
    if (!firstPhase) {
      throw new Error('Workflow has no phases');
    }

    this.state = new WorkflowState({
      workflow: this.state.workflow,
      version: this.state.version,
      currentPhase: firstPhase.id
    });

    await this.store.save(this.state);
  }

  /**
   * Get workflow definition
   * @returns {Object}
   */
  getWorkflowDefinition() {
    return this.config;
  }

  /**
   * Get workflow state
   * @returns {WorkflowState}
   */
  getState() {
    return this.state;
  }
}

module.exports = { WorkflowLoader };
