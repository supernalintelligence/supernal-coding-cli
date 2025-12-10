/**
 * Development Monitoring System
 * Integrated continuous build and workflow monitoring
 */

import { execSync } from 'node:child_process';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  hasUncommitted: boolean;
}

interface WorkflowRun {
  status: string;
  conclusion: string;
  workflowName: string;
  headBranch?: string;
  createdAt: string;
}

interface MonitorConfigData {
  enabled: boolean;
  checkOnCommit: boolean;
  checkOnPull: boolean;
  checkOnPush: boolean;
  alertOnFailure: boolean;
  lastCheck: string;
}

class DevelopmentMonitor {
  readonly monitorConfig: string;
  readonly projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.monitorConfig = path.join(this.projectRoot, '.supernal-monitor.json');
  }

  async checkGitHubCLI(): Promise<boolean> {
    try {
      execSync('gh --version', { stdio: 'pipe' });
      return true;
    } catch (_error) {
      console.log(
        chalk.yellow('[!] GitHub CLI not found. Install with: brew install gh')
      );
      return false;
    }
  }

  async getWorkflowStatus(): Promise<WorkflowRun[] | null> {
    try {
      // Use our enhanced GitHub Actions Monitor
      const { GitHubActionsMonitor } = require('../git/github-actions-monitor');
      const monitor = new GitHubActionsMonitor();

      if (!monitor.checkGhCli()) {
        return null;
      }

      const runs: WorkflowRun[] = monitor.getRecentRuns('main', 5);
      return runs;
    } catch (error) {
      const err = error as Error;
      console.log(
        chalk.red(`[X] Failed to get workflow status: ${err.message}`)
      );
      return null;
    }
  }

  async getBranchStatus(): Promise<GitStatus | null> {
    try {
      // Get current branch
      const currentBranch = execSync('git branch --show-current', {
        encoding: 'utf8'
      }).trim();

      // Get ahead/behind status
      let aheadBehind = '';
      try {
        aheadBehind = execSync(
          `git rev-list --left-right --count origin/main...HEAD`,
          {
            encoding: 'utf8'
          }
        ).trim();
      } catch (_error) {
        // Might not have origin/main
        aheadBehind = '0\t0';
      }

      const [behind, ahead] = aheadBehind
        .split('\t')
        .map((n) => parseInt(n, 10));

      return {
        branch: currentBranch,
        ahead,
        behind,
        hasUncommitted:
          execSync('git status --porcelain', { encoding: 'utf8' }).trim()
            .length > 0
      };
    } catch (_error) {
      return null;
    }
  }

  formatWorkflowStatus(workflows: WorkflowRun[] | null): string {
    if (!workflows || workflows.length === 0) {
      return chalk.gray('   No recent workflows found');
    }

    return workflows
      .slice(0, 3)
      .map((workflow) => {
        const status =
          workflow.status === 'completed'
            ? workflow.conclusion
            : workflow.status;
        const icon = this.getStatusIcon(status);
        const time = new Date(workflow.createdAt).toLocaleString();
        const branch = workflow.headBranch || 'main';

        return `   ${icon} ${workflow.workflowName} (${branch}) - ${time}`;
      })
      .join('\n');
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success':
        return chalk.green('[OK]');
      case 'failure':
        return chalk.red('[X]');
      case 'cancelled':
        return chalk.yellow('[!]');
      case 'in_progress':
        return chalk.blue('[>]');
      case 'queued':
        return chalk.gray('[.]');
      default:
        return chalk.gray('[?]');
    }
  }

  async showStatus(): Promise<void> {
    console.log(chalk.blue('\n[i] Development Status Monitor'));
    console.log(chalk.blue('='.repeat(50)));

    // Git status
    const gitStatus = await this.getBranchStatus();
    if (gitStatus) {
      console.log(chalk.green('\n[>] Git Status:'));
      console.log(`   Branch: ${chalk.cyan(gitStatus.branch)}`);

      if (gitStatus.ahead > 0) {
        console.log(`   Ahead: ${chalk.green(String(gitStatus.ahead))} commits`);
      }
      if (gitStatus.behind > 0) {
        console.log(
          `   Behind: ${chalk.red(String(gitStatus.behind))} commits (git pull needed)`
        );
      }
      if (gitStatus.hasUncommitted) {
        console.log(`   ${chalk.yellow('[!] Uncommitted changes detected')}`);
      }
      if (
        gitStatus.ahead === 0 &&
        gitStatus.behind === 0 &&
        !gitStatus.hasUncommitted
      ) {
        console.log(`   ${chalk.green('[OK] Clean and up to date')}`);
      }
    }

    // GitHub workflows
    const workflows = await this.getWorkflowStatus();
    console.log(chalk.green('\n[>] Recent CI/CD Workflows:'));
    const workflowResult = this.formatWorkflowStatus(workflows);
    console.log(workflowResult);

    // Check for failures and offer diagnosis
    if (workflows?.some((w) => w.conclusion === 'failure')) {
      console.log('');
      console.log(chalk.red('[X] CI/CD failures detected!'));
      console.log(
        chalk.yellow(
          '[i] Run: sc monitor diagnose           # Get detailed error analysis'
        )
      );
      console.log(
        chalk.yellow(
          '[i] Run: sc git-smart monitor diagnose # Same, integrated with git'
        )
      );
    }

    // Local build status
    console.log(chalk.green('\n[>] Local Build Status:'));
    await this.checkLocalBuild();
  }

  async checkLocalBuild(): Promise<void> {
    try {
      // Quick syntax check instead of full test suite
      console.log('   Checking basic build integrity...');
      execSync('sc --version', { stdio: 'pipe', timeout: 5000 });
      console.log(chalk.green('   [OK] CLI syntax check passes'));
    } catch (_error) {
      console.log(chalk.red('   [X] CLI syntax issues detected'));
      console.log(chalk.gray(`   Run: sc --help for available commands`));
    }

    // Check if package.json is valid
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.version && packageJson.name) {
        console.log(chalk.green('   [OK] Package configuration valid'));
      } else {
        console.log(chalk.yellow('   [!] Package configuration incomplete'));
      }
    } catch (_error) {
      console.log(chalk.red('   [X] Package.json issues detected'));
    }
  }

  async watchMode(): Promise<void> {
    console.log(chalk.blue('[>] Starting continuous monitoring...'));
    console.log(chalk.gray('Press Ctrl+C to stop'));

    const interval = setInterval(async () => {
      process.stdout.write('\u001Bc'); // Clear screen
      await this.showStatus();
      console.log(
        chalk.gray(`\n[i] Last updated: ${new Date().toLocaleTimeString()}`)
      );
      console.log(chalk.gray('[i] Monitoring every 30 seconds...'));
    }, 30000);

    // Show initial status
    await this.showStatus();
    console.log(
      chalk.gray(`\n[i] Last updated: ${new Date().toLocaleTimeString()}`)
    );
    console.log(chalk.gray('[i] Monitoring every 30 seconds...'));

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.blue('\n[i] Monitoring stopped'));
      process.exit(0);
    });
  }

  async setupAutoMonitor(): Promise<void> {
    console.log(
      chalk.blue('[>] Setting up automatic monitoring integration...')
    );

    // Create monitoring config
    const config: MonitorConfigData = {
      enabled: true,
      checkOnCommit: true,
      checkOnPull: true,
      checkOnPush: true,
      alertOnFailure: true,
      lastCheck: new Date().toISOString()
    };

    fs.writeFileSync(this.monitorConfig, JSON.stringify(config, null, 2));
    console.log(chalk.green('[OK] Auto-monitoring configured'));
    console.log(
      chalk.gray(
        '   Status checks will now run automatically with git operations'
      )
    );
  }

  async integrationCheck(): Promise<void> {
    if (!fs.existsSync(this.monitorConfig)) {
      return;
    }

    const config: MonitorConfigData = JSON.parse(
      fs.readFileSync(this.monitorConfig, 'utf8')
    );
    if (!config.enabled) {
      return;
    }

    // Quick status check for integration
    const workflows = await this.getWorkflowStatus();
    if (workflows && workflows.length > 0) {
      const latest = workflows[0];
      const status =
        latest.status === 'completed' ? latest.conclusion : latest.status;

      if (status === 'failure') {
        console.log(chalk.red('[!] Latest CI/CD workflow failed!'));
        console.log(chalk.gray(`   Run: sc development monitor for details`));
      } else if (status === 'success') {
        console.log(chalk.green('[OK] Latest CI/CD workflow successful'));
      }
    }
  }
}

// CLI Interface
async function main(args?: string[]): Promise<void> {
  // Handle both direct args and process.argv
  const commandArgs = args || process.argv.slice(2);
  const command = Array.isArray(commandArgs) ? commandArgs[0] : commandArgs;
  const monitor = new DevelopmentMonitor();

  switch (command) {
    case 'status':
    case undefined:
      await monitor.showStatus();
      break;

    case 'watch':
      await monitor.watchMode();
      break;

    case 'setup':
      await monitor.setupAutoMonitor();
      break;

    case 'check':
      await monitor.integrationCheck();
      break;

    case 'diagnose':
    case 'failures':
    case 'errors':
      // Diagnose current CI/CD failures and suggest fixes
      try {
        const { GitHubActionsMonitor } = require('../git/github-actions-monitor');
        const actionMonitor = new GitHubActionsMonitor();
        await actionMonitor.diagnoseIssues('main');
      } catch (error) {
        const err = error as Error;
        console.log(
          chalk.red(`[X] Failed to diagnose issues: ${err.message}`)
        );
        console.log(
          chalk.yellow('[i] Make sure GitHub CLI is installed and authenticated')
        );
      }
      break;

    case 'live':
    case 'follow':
      // Live monitoring of CI/CD workflows (watches for new runs)
      try {
        const { GitHubActionsMonitor } = require('../git/github-actions-monitor');
        const actionMonitor = new GitHubActionsMonitor();
        console.log(
          chalk.blue('[i] Starting live CI/CD workflow monitoring...')
        );
        console.log(
          chalk.yellow(
            '[i] This will watch for new workflow runs and report results'
          )
        );
        console.log(chalk.yellow('[i] Press Ctrl+C to stop live monitoring'));
        console.log('');
        await actionMonitor.monitorAfterPush('main', 600000); // 10 min timeout
      } catch (error) {
        const err = error as Error;
        console.log(
          chalk.red(`[X] Failed to start monitoring: ${err.message}`)
        );
        console.log(
          chalk.yellow('[i] Make sure GitHub CLI is installed and authenticated')
        );
      }
      break;

    case 'ci':
    case 'workflows':
    case 'pipelines':
      // Quick CI/CD status check
      try {
        const { GitHubActionsMonitor } = require('../git/github-actions-monitor');
        const actionMonitor = new GitHubActionsMonitor();
        const success = await actionMonitor.quickStatus('main');
        if (!success) {
          console.log('');
          console.log(
            chalk.yellow(
              '[i] Run: sc monitor diagnose    # For detailed analysis'
            )
          );
        }
      } catch (error) {
        const err = error as Error;
        console.log(
          chalk.red(`[X] Failed to check CI status: ${err.message}`)
        );
      }
      break;

    default:
      console.log(
        chalk.blue('SC Monitor - Development Status & CI/CD Management')
      );
      console.log('');
      console.log(chalk.cyan('[i] Current Status:'));
      console.log(
        '  status                     Show overall development status (default)'
      );
      console.log('  ci, workflows, pipelines   Quick CI/CD status check');
      console.log('');
      console.log(chalk.cyan('[i] Failure Analysis:'));
      console.log(
        '  diagnose, failures, errors Analyze failed workflows with suggested fixes'
      );
      console.log('');
      console.log(chalk.cyan('[>] Live Monitoring:'));
      console.log(
        '  watch, live, follow        Watch for new workflow runs and report results'
      );
      console.log('');
      console.log(chalk.cyan('[>] Development Tools:'));
      console.log('  setup                      Configure auto-monitoring');
      console.log('  check                      Quick integration check');
      console.log('');
      console.log(chalk.yellow('[i] Logical workflow:'));
      console.log(
        chalk.white(
          '   1. sc git-smart push                 # Push code with auto-monitoring'
        )
      );
      console.log(
        chalk.white(
          '   2. sc monitor ci                     # Check CI/CD status'
        )
      );
      console.log(
        chalk.white(
          '   3. sc monitor diagnose               # If failures, get fixes'
        )
      );
      console.log(
        chalk.white(
          '   4. sc monitor watch                  # Live monitor during fixes'
        )
      );
      console.log('');
      break;
  }
}

// Export the class for use in other modules

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('[X] Monitor error:'), error.message);
    process.exit(1);
  });
}

export default main;
