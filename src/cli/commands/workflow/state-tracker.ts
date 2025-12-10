// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { execSync } = require('node:child_process');

/**
 * Supernal Coding Workflow State Tracker
 *
 * Tracks user progress through the post-init workflow and provides
 * guidance, warnings, and next-step recommendations.
 */
class WorkflowStateTracker {
  currentState: any;
  projectRoot: any;
  stateFile: any;
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.stateFile = path.join(
      projectRoot,
      '.supernal-coding',
      'workflow-state.json'
    );
    this.currentState = null;
  }

  /**
   * Initialize state tracking after successful sc init
   */
  async initializeState(initOptions = {}) {
    const gitInfo = await this.getGitInfo();
    const initialState = {
      version: '1.0.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      lastActivity: new Date().toISOString(), // Alias for lastUpdated

      // Current workflow state
      state: 'INITIALIZED',
      subState: null,
      workflowState: 'INITIALIZED', // Alias for state

      // Project context
      projectType: initOptions.detectedType || 'unknown',
      gitInfo,
      currentBranch: gitInfo.currentBranch, // Top-level alias for backward compat

      // Feature flags from init
      features: {
        gitManagement: initOptions.gitManagement || false,
        kanbanSystem: initOptions.kanbanSystem || false,
        testingFramework: initOptions.testingFramework || false,
      },

      // Progress tracking
      completed: [],
      pending: this.getInitialPendingSteps(initOptions),
      warnings: [],

      // Deviation tracking
      deviations: [],
      lastBranchCheck: null,
      expectedBranch: 'main',

      // Smart merge tracking
      smartMergeEnabled: initOptions.gitManagement || false,
      lastSmartMerge: null,
      mergeHistory: [],

      // Requirements tracking
      requirements: [],
      activeRequirement: null,

      // Next steps
      recommendedActions: this.getRecommendedActions(
        'INITIALIZED',
        initOptions
      ),
    };

    await this.saveState(initialState);
    return initialState;
  }

  /**
   * Load current workflow state
   */
  async loadState() {
    try {
      if (!(await fs.pathExists(this.stateFile))) {
        return null;
      }

      const state = await fs.readJSON(this.stateFile);
      this.currentState = state;
      return state;
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Could not load workflow state: ${error.message}`)
      );
      return null;
    }
  }

  /**
   * Save workflow state
   */
  async saveState(state) {
    try {
      await fs.ensureDir(path.dirname(this.stateFile));
      state.lastUpdated = new Date().toISOString();
      await fs.writeJSON(this.stateFile, state, { spaces: 2 });
      this.currentState = state;
    } catch (error) {
      console.warn(
        chalk.yellow(`⚠️  Could not save workflow state: ${error.message}`)
      );
    }
  }

  /**
   * Update workflow state with progress
   */
  async updateState(newState, completedAction = null, deviation = null) {
    const state = await this.loadState();
    if (!state) return null;

    // Update state
    state.state = newState;
    state.lastUpdated = new Date().toISOString();

    // Track completed actions
    if (completedAction) {
      if (!state.completed.includes(completedAction)) {
        state.completed.push(completedAction);
      }
      // Remove from pending
      state.pending = state.pending.filter((item) => item !== completedAction);
    }

    // Track deviations
    if (deviation) {
      state.deviations.push({
        type: deviation.type,
        description: deviation.description,
        detected: new Date().toISOString(),
        severity: deviation.severity || 'warning',
        resolved: false,
      });
    }

    // Update recommended actions
    state.recommendedActions = this.getRecommendedActions(newState, state);

    await this.saveState(state);
    return state;
  }

  /**
   * Check for workflow deviations
   */
  async checkDeviations() {
    const state = await this.loadState();
    if (!state) return [];

    const deviations = [];

    // Check git branch deviation
    try {
      const currentBranch = this.getCurrentBranch();
      if (
        currentBranch !== state.expectedBranch &&
        !currentBranch.startsWith('feature/req-')
      ) {
        deviations.push({
          type: 'WRONG_BRANCH',
          description: `Working on '${currentBranch}' but expected '${state.expectedBranch}' or a feature branch`,
          severity: 'warning',
          suggestion: `Consider switching to: git checkout ${state.expectedBranch}`,
        });
      }
    } catch (_error) {
      // Not a git repo or other git error - skip branch check
    }

    // Check if requirements exist but not tracked
    const reqDir = path.join(this.projectRoot, 'requirements');
    if (await fs.pathExists(reqDir)) {
      const reqFiles = await fs.readdir(reqDir);
      const mdFiles = reqFiles.filter((f) => f.endsWith('.md'));

      if (mdFiles.length > state.requirements.length) {
        deviations.push({
          type: 'UNTRACKED_REQUIREMENTS',
          description: `Found ${mdFiles.length} requirement files but only tracking ${state.requirements.length}`,
          severity: 'info',
          suggestion: 'Run: sc req sync to update tracking',
        });
      }
    }

    // Check for uncommitted changes in wrong state
    if (state.state === 'COMPLETED' && this.hasUncommittedChanges()) {
      deviations.push({
        type: 'UNCOMMITTED_CHANGES',
        description: 'Workflow marked complete but has uncommitted changes',
        severity: 'warning',
        suggestion: 'Commit changes or reset workflow state',
      });
    }

    return deviations;
  }

  /**
   * Show current workflow status
   */
  async showStatus() {
    const state = await this.loadState();

    if (!state) {
      console.log(
        chalk.yellow('⚠️  No workflow state found. Run `sc init` first.')
      );
      return;
    }

    console.log(chalk.blue.bold('\n🎯 Workflow Status'));
    console.log(chalk.blue('='.repeat(50)));

    // Current state
    console.log(
      chalk.green(
        `\n📍 Current State: ${this.getStateEmoji(state.state)} ${state.state}`
      )
    );
    if (state.subState) {
      console.log(chalk.gray(`   Sub-state: ${state.subState}`));
    }

    // Progress summary
    console.log(
      chalk.green(`\n✅ Completed: ${state.completed.length} actions`)
    );
    console.log(chalk.yellow(`📋 Pending: ${state.pending.length} actions`));

    // Show next steps
    if (state.recommendedActions.length > 0) {
      console.log(chalk.blue('\n🚀 Recommended Next Steps:'));
      state.recommendedActions.slice(0, 3).forEach((action, i) => {
        console.log(chalk.cyan(`   ${i + 1}. ${action.command}`));
        console.log(chalk.gray(`      ${action.description}`));
      });
    }

    // Show deviations
    const deviations = await this.checkDeviations();
    if (deviations.length > 0) {
      console.log(chalk.yellow('\n⚠️  Potential Issues:'));
      deviations.forEach((dev) => {
        const icon = dev.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(chalk.yellow(`   ${icon} ${dev.description}`));
        if (dev.suggestion) {
          console.log(chalk.gray(`      💡 ${dev.suggestion}`));
        }
      });
    }

    // Project context
    console.log(
      chalk.blue(
        `\n📊 Project: ${state.projectType} | Features: ${Object.entries(
          state.features
        )
          .filter(([_k, v]) => v)
          .map(([k, _v]) => k)
          .join(', ')}`
      )
    );
    console.log(
      chalk.gray(
        `   Last updated: ${new Date(state.lastUpdated).toLocaleString()}`
      )
    );
  }

  /**
   * Get initial pending steps based on init options
   */
  getInitialPendingSteps(initOptions) {
    const steps = [
      'create_first_requirement',
      'setup_development_workflow',
      'validate_setup',
    ];

    if (initOptions.gitManagement) {
      steps.push('start_feature_branch', 'smart_merge_workflow');
    }

    return steps;
  }

  /**
   * Get recommended actions for current state
   */
  getRecommendedActions(currentState, _context = {}) {
    const actions = [];

    switch (currentState) {
      case 'INITIALIZED':
        actions.push({
          command:
            'sc requirement new "Your Feature Name" --epic=main --priority=high',
          description:
            'Create your first requirement to define what you want to build',
          priority: 'high',
        });
        actions.push({
          command: 'sc kanban workflow new main-dev --template=general',
          description: 'Set up a kanban workflow for project management',
          priority: 'medium',
        });
        break;

      case 'REQUIREMENT_CREATED':
        actions.push({
          command: 'sc req start-work 001',
          description:
            'Start working on your requirement (creates feature branch)',
          priority: 'high',
        });
        actions.push({
          command: 'sc req validate 001',
          description: 'Validate your requirement structure',
          priority: 'medium',
        });
        break;

      case 'FEATURE_BRANCH':
        actions.push({
          command: 'sc req validate 001',
          description: 'Validate your changes meet the requirement',
          priority: 'high',
        });
        actions.push({
          command: 'sc git-smart merge --auto-push',
          description: 'Safely merge your changes when ready',
          priority: 'medium',
        });
        break;

      case 'CHANGES_MADE':
        actions.push({
          command: 'sc git-smart merge --auto-push',
          description: 'Merge your completed changes',
          priority: 'high',
        });
        actions.push({
          command: 'sc req validate 001',
          description: 'Final validation before merge',
          priority: 'medium',
        });
        break;

      case 'COMPLETED':
        actions.push({
          command:
            'sc requirement new "Next Feature" --epic=main --priority=medium',
          description: 'Create your next requirement',
          priority: 'medium',
        });
        actions.push({
          command: 'sc development validate',
          description: 'Check overall project health',
          priority: 'low',
        });
        break;
    }

    return actions;
  }

  /**
   * Get Git information
   */
  async getGitInfo() {
    try {
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8',
      }).trim();
      const currentBranch = this.getCurrentBranch();
      const hasRemote = this.hasRemoteOrigin();

      return {
        isGitRepo: true,
        root: gitRoot,
        currentBranch,
        hasRemote,
        lastCommit: this.getLastCommitHash(),
      };
    } catch (_error) {
      return {
        isGitRepo: false,
        root: null,
        currentBranch: null,
        hasRemote: false,
        lastCommit: null,
      };
    }
  }

  /**
   * Utility methods
   */
  getCurrentBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf8',
      }).trim();
    } catch (_error) {
      return null;
    }
  }

  hasRemoteOrigin() {
    try {
      execSync('git remote get-url origin', { stdio: 'ignore' });
      return true;
    } catch (_error) {
      return false;
    }
  }

  getLastCommitHash() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (_error) {
      return null;
    }
  }

  hasUncommittedChanges() {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      return status.trim().length > 0;
    } catch (_error) {
      return false;
    }
  }

  getStateEmoji(state) {
    const emojis = {
      INITIALIZED: '🏁',
      REQUIREMENT_CREATED: '📋',
      WORKFLOW_READY: '🔧',
      DIRECT_DEV: '⚡',
      FEATURE_BRANCH: '🌿',
      CHANGES_MADE: '💻',
      COMPLETED: '🎉',
      MERGE_CONFLICT: '⚠️',
    };
    return emojis[state] || '📍';
  }
}

module.exports = WorkflowStateTracker;
