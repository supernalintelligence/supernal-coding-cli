import chalk from 'chalk';
const WorkflowStateTracker = require('./workflow/state-tracker');

interface WorkflowState {
  state: string;
  recommendedActions: Array<{ command: string; description: string }>;
  activeRequirement?: string | null;
  expectedBranch?: string;
  requirements: string[];
}

interface Deviation {
  severity: string;
  type: string;
  description: string;
  suggestion?: string;
}

interface InitOptions {
  [key: string]: boolean;
}

interface ListPendingOptions {
  type?: string;
  path?: string;
  count?: boolean;
  json?: boolean;
  group?: boolean;
}

/**
 * Workflow state management commands
 */
class WorkflowManager {
  readonly tracker: InstanceType<typeof WorkflowStateTracker>;

  constructor() {
    this.tracker = new WorkflowStateTracker();
  }

  /**
   * Show current workflow status
   */
  async status(): Promise<void> {
    await this.tracker.showStatus();
  }

  /**
   * Initialize workflow tracking (called after sc init)
   */
  async init(initOptions: InitOptions = {}): Promise<void> {
    console.log(chalk.blue('[>] Initializing workflow state tracking...'));

    const state: WorkflowState | null =
      await this.tracker.initializeState(initOptions);

    if (state) {
      console.log(chalk.green('[OK] Workflow state tracking initialized'));

      // Show immediate next steps
      console.log(
        chalk.blue('\n[>] Ready to Start! Here are your immediate next steps:')
      );

      if (state.recommendedActions.length > 0) {
        state.recommendedActions.slice(0, 2).forEach((action, i) => {
          console.log(chalk.cyan(`   ${i + 1}. ${action.command}`));
          console.log(chalk.gray(`      ${action.description}`));
        });
      }

      console.log(
        chalk.yellow(
          `\n[i] View full status anytime: ${chalk.cyan('sc workflow status')}`
        )
      );
    } else {
      console.log(chalk.red('[X] Failed to initialize workflow tracking'));
    }
  }

  /**
   * Mark a step as completed
   */
  async complete(action: string, newState: string | null = null): Promise<void> {
    const state: WorkflowState | null = await this.tracker.loadState();
    if (!state) {
      console.log(
        chalk.yellow('[!] No workflow state found. Run `sc init` first.')
      );
      return;
    }

    await this.tracker.updateState(newState || state.state, action);
    console.log(chalk.green(`[OK] Marked "${action}" as completed`));

    // Show updated status
    await this.tracker.showStatus();
  }

  /**
   * Report a deviation or issue
   */
  async reportDeviation(
    type: string,
    description: string,
    severity: string = 'warning'
  ): Promise<void> {
    await this.tracker.updateState(null, null, {
      type,
      description,
      severity
    });

    console.log(chalk.yellow(`[!] Deviation reported: ${description}`));
  }

  /**
   * Check for and report workflow deviations
   */
  async check(): Promise<void> {
    console.log(chalk.blue('[i] Checking workflow for deviations...'));

    const deviations: Deviation[] = await this.tracker.checkDeviations();

    if (deviations.length === 0) {
      console.log(
        chalk.green('[OK] No deviations detected. Workflow is on track!')
      );
      return;
    }

    console.log(
      chalk.yellow(`\n[!] Found ${deviations.length} potential issue(s):`)
    );

    deviations.forEach((dev, i) => {
      const icon =
        dev.severity === 'warning'
          ? '[!]'
          : dev.severity === 'error'
            ? '[X]'
            : '[i]';
      console.log(chalk.yellow(`\n   ${i + 1}. ${icon} ${dev.type}`));
      console.log(chalk.gray(`      ${dev.description}`));

      if (dev.suggestion) {
        console.log(chalk.cyan(`      [i] Suggestion: ${dev.suggestion}`));
      }
    });
  }

  /**
   * Start working on a requirement (integrates with req start-work)
   */
  async startRequirement(reqId: string): Promise<void> {
    await this.tracker.updateState('FEATURE_BRANCH', 'start_feature_branch');

    const state: WorkflowState | null = await this.tracker.loadState();
    if (state) {
      state.activeRequirement = reqId;
      state.expectedBranch = `feature/req-${reqId}`;
      await this.tracker.saveState(state);
    }

    console.log(chalk.green(`[>] Started working on requirement ${reqId}`));
    console.log(chalk.blue('[i] Your workflow state has been updated'));
  }

  /**
   * Mark requirement as completed (integrates with smart merge)
   */
  async completeRequirement(reqId: string): Promise<void> {
    await this.tracker.updateState('COMPLETED', 'smart_merge_workflow');

    const state: WorkflowState | null = await this.tracker.loadState();
    if (state) {
      state.activeRequirement = null;
      state.expectedBranch = 'main';

      if (!state.requirements.includes(reqId)) {
        state.requirements.push(reqId);
      }

      await this.tracker.saveState(state);
    }

    console.log(chalk.green(`[>] Requirement ${reqId} completed and merged!`));
    await this.tracker.showStatus();
  }

  /**
   * Reset workflow state (for debugging/recovery)
   */
  async reset(): Promise<void> {
    const fs = await import('fs-extra');
    const path = await import('node:path');

    const stateFile = path.join(
      process.cwd(),
      '.supernal-coding',
      'workflow-state.json'
    );

    if (await fs.pathExists(stateFile)) {
      await fs.remove(stateFile);
      console.log(chalk.green('[OK] Workflow state reset'));
    } else {
      console.log(chalk.yellow('[!] No workflow state to reset'));
    }
  }

  /**
   * Show detailed workflow guide
   */
  async guide(): Promise<void> {
    console.log(chalk.blue.bold('\n[i] Supernal Coding Workflow Guide'));
    console.log(chalk.blue('='.repeat(50)));

    console.log(chalk.green('\n[1] Phase 1: Initialize'));
    console.log('   1. Run `sc init` to set up your project');
    console.log('   2. Choose your equipment pack (minimal/standard/full)');
    console.log('   3. Workflow state tracking begins automatically');

    console.log(chalk.green('\n[2] Phase 2: Plan'));
    console.log('   1. Create requirements: `sc requirement new "Feature"`');
    console.log('   2. Set up kanban workflow: `sc kanban workflow new`');
    console.log('   3. Validate setup: `sc workflow check`');

    console.log(chalk.green('\n[3] Phase 3: Develop'));
    console.log('   1. Start work: `sc req start-work 001`');
    console.log('   2. Make your changes');
    console.log('   3. Validate: `sc req validate 001`');

    console.log(chalk.green('\n[4] Phase 4: Integrate'));
    console.log('   1. Smart merge: `sc git-smart merge --auto-push`');
    console.log('   2. Workflow auto-updates to COMPLETED');
    console.log('   3. Start next requirement or iterate');

    console.log(chalk.blue('\n[i] Workflow Commands:'));
    console.log('   * `sc workflow status` - Show current state');
    console.log('   * `sc workflow check` - Check for deviations');
    console.log('   * `sc workflow guide` - Show this guide');
    console.log('   * `sc workflow reset` - Reset state (debugging)');

    console.log(chalk.yellow('\n[!] The system tracks deviations like:'));
    console.log('   * Working on wrong branch');
    console.log('   * Untracked requirements');
    console.log('   * Uncommitted changes');
    console.log('   * Merge conflicts');
  }
}

/**
 * CLI interface
 */
async function handleWorkflowCommand(...args: string[]): Promise<void> {
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
            chalk.red('[X] Usage: sc workflow complete <action> [new_state]')
          );
          return;
        }
        await manager.complete(action, newState);
        break;
      }

      case 'start-req': {
        const reqId = args[1];
        if (!reqId) {
          console.log(chalk.red('[X] Usage: sc workflow start-req <req_id>'));
          return;
        }
        await manager.startRequirement(reqId);
        break;
      }

      case 'complete-req': {
        const completedReqId = args[1];
        if (!completedReqId) {
          console.log(chalk.red('[X] Usage: sc workflow complete-req <req_id>'));
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
        const PendingApprovalScanner = (
          await import('../../workflow/PendingApprovalScanner')
        ).default;
        const scanner = new PendingApprovalScanner();
        const options = parseListPendingOptions(args.slice(1));
        await scanner.display(options);
        break;
      }

      case 'help':
        showWorkflowHelp();
        break;

      default:
        console.log(chalk.red(`[X] Unknown workflow command: ${subCommand}`));
        showWorkflowHelp();
        break;
    }
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`[X] Workflow error: ${err.message}`));
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
  }
}

function parseInitOptions(args: string[]): InitOptions {
  const options: InitOptions = {};

  // Parse simple boolean flags
  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const key = arg.replace('--', '').replace(/-/g, '_');
      options[key] = true;
    }
  });

  return options;
}

function parseListPendingOptions(args: string[]): ListPendingOptions {
  const options: ListPendingOptions = {};

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

function showWorkflowHelp(): void {
  console.log(chalk.blue('\n[i] Workflow Commands:'));
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

export { WorkflowManager, handleWorkflowCommand };
