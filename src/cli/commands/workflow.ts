// @ts-nocheck
const chalk = require('chalk');
const WorkflowStateTracker = require('./workflow/state-tracker');

/**
 * Workflow state management commands
 */
class WorkflowManager {
  tracker: any;
  constructor() {
    this.tracker = new WorkflowStateTracker();
  }

  /**
   * Show current workflow status
   */
  async status() {
    await this.tracker.showStatus();
  }

  /**
   * Initialize workflow tracking (called after sc init)
   */
  async init(initOptions = {}) {
    console.log(chalk.blue('🎯 Initializing workflow state tracking...'));

    const state = await this.tracker.initializeState(initOptions);

    if (state) {
      console.log(chalk.green('✅ Workflow state tracking initialized'));

      // Show immediate next steps
      console.log(
        chalk.blue('\n🚀 Ready to Start! Here are your immediate next steps:')
      );

      if (state.recommendedActions.length > 0) {
        state.recommendedActions.slice(0, 2).forEach((action, i) => {
          console.log(chalk.cyan(`   ${i + 1}. ${action.command}`));
          console.log(chalk.gray(`      ${action.description}`));
        });
      }

      console.log(
        chalk.yellow(
          `\n💡 View full status anytime: ${chalk.cyan('sc workflow status')}`
        )
      );
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow tracking'));
    }
  }

  /**
   * Mark a step as completed
   */
  async complete(action, newState = null) {
    const state = await this.tracker.loadState();
    if (!state) {
      console.log(
        chalk.yellow('⚠️  No workflow state found. Run `sc init` first.')
      );
      return;
    }

    await this.tracker.updateState(newState || state.state, action);
    console.log(chalk.green(`✅ Marked "${action}" as completed`));

    // Show updated status
    await this.tracker.showStatus();
  }

  /**
   * Report a deviation or issue
   */
  async reportDeviation(type, description, severity = 'warning') {
    await this.tracker.updateState(null, null, {
      type,
      description,
      severity
    });

    console.log(chalk.yellow(`⚠️  Deviation reported: ${description}`));
  }

  /**
   * Check for and report workflow deviations
   */
  async check() {
    console.log(chalk.blue('🔍 Checking workflow for deviations...'));

    const deviations = await this.tracker.checkDeviations();

    if (deviations.length === 0) {
      console.log(
        chalk.green('✅ No deviations detected. Workflow is on track!')
      );
      return;
    }

    console.log(
      chalk.yellow(`\n⚠️  Found ${deviations.length} potential issue(s):`)
    );

    deviations.forEach((dev, i) => {
      const icon =
        dev.severity === 'warning'
          ? '⚠️'
          : dev.severity === 'error'
            ? '❌'
            : 'ℹ️';
      console.log(chalk.yellow(`\n   ${i + 1}. ${icon} ${dev.type}`));
      console.log(chalk.gray(`      ${dev.description}`));

      if (dev.suggestion) {
        console.log(chalk.cyan(`      💡 Suggestion: ${dev.suggestion}`));
      }
    });
  }

  /**
   * Start working on a requirement (integrates with req start-work)
   */
  async startRequirement(reqId) {
    await this.tracker.updateState('FEATURE_BRANCH', 'start_feature_branch');

    const state = await this.tracker.loadState();
    if (state) {
      state.activeRequirement = reqId;
      state.expectedBranch = `feature/req-${reqId}`;
      await this.tracker.saveState(state);
    }

    console.log(chalk.green(`🌿 Started working on requirement ${reqId}`));
    console.log(chalk.blue('💡 Your workflow state has been updated'));
  }

  /**
   * Mark requirement as completed (integrates with smart merge)
   */
  async completeRequirement(reqId) {
    await this.tracker.updateState('COMPLETED', 'smart_merge_workflow');

    const state = await this.tracker.loadState();
    if (state) {
      state.activeRequirement = null;
      state.expectedBranch = 'main';

      if (!state.requirements.includes(reqId)) {
        state.requirements.push(reqId);
      }

      await this.tracker.saveState(state);
    }

    console.log(chalk.green(`🎉 Requirement ${reqId} completed and merged!`));
    await this.tracker.showStatus();
  }

  /**
   * Reset workflow state (for debugging/recovery)
   */
  async reset() {
    const fs = require('fs-extra');
    const path = require('node:path');

    const stateFile = path.join(
      process.cwd(),
      '.supernal-coding',
      'workflow-state.json'
    );

    if (await fs.pathExists(stateFile)) {
      await fs.remove(stateFile);
      console.log(chalk.green('✅ Workflow state reset'));
    } else {
      console.log(chalk.yellow('⚠️  No workflow state to reset'));
    }
  }

  /**
   * Show detailed workflow guide
   */
  async guide() {
    console.log(chalk.blue.bold('\n📖 Supernal Coding Workflow Guide'));
    console.log(chalk.blue('='.repeat(50)));

    console.log(chalk.green('\n🏁 Phase 1: Initialize'));
    console.log('   1. Run `sc init` to set up your project');
    console.log('   2. Choose your equipment pack (minimal/standard/full)');
    console.log('   3. Workflow state tracking begins automatically');

    console.log(chalk.green('\n📋 Phase 2: Plan'));
    console.log('   1. Create requirements: `sc requirement new "Feature"`');
    console.log('   2. Set up kanban workflow: `sc kanban workflow new`');
    console.log('   3. Validate setup: `sc workflow check`');

    console.log(chalk.green('\n🌿 Phase 3: Develop'));
    console.log('   1. Start work: `sc req start-work 001`');
    console.log('   2. Make your changes');
    console.log('   3. Validate: `sc req validate 001`');

    console.log(chalk.green('\n🔄 Phase 4: Integrate'));
    console.log('   1. Smart merge: `sc git-smart merge --auto-push`');
    console.log('   2. Workflow auto-updates to COMPLETED');
    console.log('   3. Start next requirement or iterate');

    console.log(chalk.blue('\n💡 Workflow Commands:'));
    console.log('   • `sc workflow status` - Show current state');
    console.log('   • `sc workflow check` - Check for deviations');
    console.log('   • `sc workflow guide` - Show this guide');
    console.log('   • `sc workflow reset` - Reset state (debugging)');

    console.log(chalk.yellow('\n⚠️  The system tracks deviations like:'));
    console.log('   • Working on wrong branch');
    console.log('   • Untracked requirements');
    console.log('   • Uncommitted changes');
    console.log('   • Merge conflicts');
  }
}

/**
 * CLI interface
 */
async function handleWorkflowCommand(...args) {
  const manager = new WorkflowManager();
  const subCommand = args[0] || 'status';

  try {
    switch (subCommand) {
      case 'status':
        await manager.status();
        break;

      case 'init': {
        const initOptions = parseInitOptions(args.slice(1));
        await manager.init(initOptions);
        break;
      }

      case 'check':
        await manager.check();
        break;

      case 'complete': {
        const action = args[1];
        const newState = args[2];
        if (!action) {
          console.log(
            chalk.red('❌ Usage: sc workflow complete <action> [new_state]')
          );
          return;
        }
        await manager.complete(action, newState);
        break;
      }

      case 'start-req': {
        const reqId = args[1];
        if (!reqId) {
          console.log(chalk.red('❌ Usage: sc workflow start-req <req_id>'));
          return;
        }
        await manager.startRequirement(reqId);
        break;
      }

      case 'complete-req': {
        const completedReqId = args[1];
        if (!completedReqId) {
          console.log(chalk.red('❌ Usage: sc workflow complete-req <req_id>'));
          return;
        }
        await manager.completeRequirement(completedReqId);
        break;
      }

      case 'reset':
        await manager.reset();
        break;

      case 'guide':
        await manager.guide();
        break;

      case 'list-pending': {
        // REQ-105: List documents needing approval
        const PendingApprovalScanner = require('../../workflow/PendingApprovalScanner');
        const scanner = new PendingApprovalScanner();
        const options = parseListPendingOptions(args.slice(1));
        await scanner.display(options);
        break;
      }

      case 'help':
        showWorkflowHelp();
        break;

      default:
        console.log(chalk.red(`❌ Unknown workflow command: ${subCommand}`));
        showWorkflowHelp();
        break;
    }
  } catch (error) {
    console.error(chalk.red(`❌ Workflow error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

function parseInitOptions(args) {
  const options = {};

  // Parse simple boolean flags
  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const key = arg.replace('--', '').replace(/-/g, '_');
      options[key] = true;
    }
  });

  return options;
}

function parseListPendingOptions(args) {
  const options = {};

  args.forEach((arg, index) => {
    if (arg === '--type' && args[index + 1]) {
      options.type = args[index + 1];
    } else if (arg === '--path' && args[index + 1]) {
      options.path = args[index + 1];
    } else if (arg === '--count') {
      options.count = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--group') {
      options.group = true;
    }
  });

  return options;
}

function showWorkflowHelp() {
  console.log(chalk.blue('\n📖 Workflow Commands:'));
  console.log('   status              Show current workflow state');
  console.log('   check               Check for workflow deviations');
  console.log('   complete <action>   Mark an action as completed');
  console.log('   start-req <id>      Start working on a requirement');
  console.log('   complete-req <id>   Complete a requirement');
  console.log('   list-pending        List documents needing approval');
  console.log('   reset               Reset workflow state');
  console.log('   guide               Show detailed workflow guide');
  console.log('   help                Show this help');
  console.log('');
  console.log(chalk.cyan('list-pending options:'));
  console.log(
    '   --type <type>       Filter by type (sop, requirement, feature)'
  );
  console.log('   --path <pattern>    Filter by path pattern');
  console.log('   --count             Show count only');
  console.log('   --json              Output as JSON');
  console.log('   --group             Group by document type');
}

module.exports = {
  WorkflowManager,
  handleWorkflowCommand
};
