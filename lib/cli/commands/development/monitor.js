#!/usr/bin/env node

// Development Monitoring System
// Integrated continuous build and workflow monitoring

const { execSync } = require('node:child_process');
const chalk = require('chalk');
const fs = require('node:fs');
const path = require('node:path');

class DevelopmentMonitor {
  constructor() {
    this.projectRoot = process.cwd();
    this.monitorConfig = path.join(this.projectRoot, '.supernal-monitor.json');
  }

  async checkGitHubCLI() {
    try {
      execSync('gh --version', { stdio: 'pipe' });
      return true;
    } catch (_error) {
      console.log(
        chalk.yellow('⚠️  GitHub CLI not found. Install with: brew install gh')
      );
      return false;
    }
  }

  async getWorkflowStatus() {
    try {
      // Use our enhanced GitHub Actions Monitor
      const GitHubActionsMonitor = require('../git/github-actions-monitor');
      const monitor = new GitHubActionsMonitor();

      if (!monitor.checkGhCli()) {
        return null;
      }

      const runs = monitor.getRecentRuns('main', 5);
      return runs;
    } catch (error) {
      console.log(
        chalk.red(`❌ Failed to get workflow status: ${error.message}`)
      );
      return null;
    }
  }

  async getBranchStatus() {
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

  formatWorkflowStatus(workflows) {
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

  getStatusIcon(status) {
    switch (status) {
      case 'success':
        return chalk.green('✅');
      case 'failure':
        return chalk.red('❌');
      case 'cancelled':
        return chalk.yellow('⚠️');
      case 'in_progress':
        return chalk.blue('🔄');
      case 'queued':
        return chalk.gray('⏳');
      default:
        return chalk.gray('❓');
    }
  }

  async showStatus() {
    console.log(chalk.blue('\n📊 Development Status Monitor'));
    console.log(chalk.blue('='.repeat(50)));

    // Git status
    const gitStatus = await this.getBranchStatus();
    if (gitStatus) {
      console.log(chalk.green('\n🌳 Git Status:'));
      console.log(`   Branch: ${chalk.cyan(gitStatus.branch)}`);

      if (gitStatus.ahead > 0) {
        console.log(`   Ahead: ${chalk.green(gitStatus.ahead)} commits`);
      }
      if (gitStatus.behind > 0) {
        console.log(
          `   Behind: ${chalk.red(gitStatus.behind)} commits (git pull needed)`
        );
      }
      if (gitStatus.hasUncommitted) {
        console.log(`   ${chalk.yellow('⚠️  Uncommitted changes detected')}`);
      }
      if (
        gitStatus.ahead === 0 &&
        gitStatus.behind === 0 &&
        !gitStatus.hasUncommitted
      ) {
        console.log(`   ${chalk.green('✅ Clean and up to date')}`);
      }
    }

    // GitHub workflows
    const workflows = await this.getWorkflowStatus();
    console.log(chalk.green('\n🔄 Recent CI/CD Workflows:'));
    const workflowResult = this.formatWorkflowStatus(workflows);
    console.log(workflowResult);

    // Check for failures and offer diagnosis
    if (workflows?.some((w) => w.conclusion === 'failure')) {
      console.log('');
      console.log(chalk.red('🚨 CI/CD failures detected!'));
      console.log(
        chalk.yellow(
          '💡 Run: sc monitor diagnose           # Get detailed error analysis'
        )
      );
      console.log(
        chalk.yellow(
          '💡 Run: sc git-smart monitor diagnose # Same, integrated with git'
        )
      );
    }

    // Local build status
    console.log(chalk.green('\n🔨 Local Build Status:'));
    await this.checkLocalBuild();
  }

  async checkLocalBuild() {
    try {
      // Quick syntax check instead of full test suite
      console.log('   Checking basic build integrity...');
      execSync('sc --version', { stdio: 'pipe', timeout: 5000 });
      console.log(chalk.green('   ✅ CLI syntax check passes'));
    } catch (_error) {
      console.log(chalk.red('   ❌ CLI syntax issues detected'));
      console.log(chalk.gray(`   Run: sc --help for available commands`));
    }

    // Check if package.json is valid
    try {
      const packageJson = require('../../../../package.json');
      if (packageJson.version && packageJson.name) {
        console.log(chalk.green('   ✅ Package configuration valid'));
      } else {
        console.log(chalk.yellow('   ⚠️  Package configuration incomplete'));
      }
    } catch (_error) {
      console.log(chalk.red('   ❌ Package.json issues detected'));
    }
  }

  async watchMode() {
    console.log(chalk.blue('👀 Starting continuous monitoring...'));
    console.log(chalk.gray('Press Ctrl+C to stop'));

    const interval = setInterval(async () => {
      process.stdout.write('\u001Bc'); // Clear screen
      await this.showStatus();
      console.log(
        chalk.gray(`\n⏰ Last updated: ${new Date().toLocaleTimeString()}`)
      );
      console.log(chalk.gray('📊 Monitoring every 30 seconds...'));
    }, 30000);

    // Show initial status
    await this.showStatus();
    console.log(
      chalk.gray(`\n⏰ Last updated: ${new Date().toLocaleTimeString()}`)
    );
    console.log(chalk.gray('📊 Monitoring every 30 seconds...'));

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.blue('\n👋 Monitoring stopped'));
      process.exit(0);
    });
  }

  async setupAutoMonitor() {
    console.log(
      chalk.blue('🔧 Setting up automatic monitoring integration...')
    );

    // Create monitoring config
    const config = {
      enabled: true,
      checkOnCommit: true,
      checkOnPull: true,
      checkOnPush: true,
      alertOnFailure: true,
      lastCheck: new Date().toISOString()
    };

    fs.writeFileSync(this.monitorConfig, JSON.stringify(config, null, 2));
    console.log(chalk.green('✅ Auto-monitoring configured'));
    console.log(
      chalk.gray(
        '   Status checks will now run automatically with git operations'
      )
    );
  }

  async integrationCheck() {
    if (!fs.existsSync(this.monitorConfig)) {
      return;
    }

    const config = JSON.parse(fs.readFileSync(this.monitorConfig, 'utf8'));
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
        console.log(chalk.red('⚠️  Latest CI/CD workflow failed!'));
        console.log(chalk.gray(`   Run: sc development monitor for details`));
      } else if (status === 'success') {
        console.log(chalk.green('✅ Latest CI/CD workflow successful'));
      }
    }
  }
}

// CLI Interface
async function main(args) {
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
        const GitHubActionsMonitor = require('../git/github-actions-monitor');
        const actionMonitor = new GitHubActionsMonitor();
        await actionMonitor.diagnoseIssues('main');
      } catch (error) {
        console.log(
          chalk.red(`❌ Failed to diagnose issues: ${error.message}`)
        );
        console.log(
          chalk.yellow('💡 Make sure GitHub CLI is installed and authenticated')
        );
      }
      break;

    case 'live':
    case 'follow':
      // Live monitoring of CI/CD workflows (watches for new runs)
      try {
        const GitHubActionsMonitor = require('../git/github-actions-monitor');
        const actionMonitor = new GitHubActionsMonitor();
        console.log(
          chalk.blue('🔍 Starting live CI/CD workflow monitoring...')
        );
        console.log(
          chalk.yellow(
            '💡 This will watch for new workflow runs and report results'
          )
        );
        console.log(chalk.yellow('💡 Press Ctrl+C to stop live monitoring'));
        console.log('');
        await actionMonitor.monitorAfterPush('main', 600000); // 10 min timeout
      } catch (error) {
        console.log(
          chalk.red(`❌ Failed to start monitoring: ${error.message}`)
        );
        console.log(
          chalk.yellow('💡 Make sure GitHub CLI is installed and authenticated')
        );
      }
      break;

    case 'ci':
    case 'workflows':
    case 'pipelines':
      // Quick CI/CD status check
      try {
        const GitHubActionsMonitor = require('../git/github-actions-monitor');
        const actionMonitor = new GitHubActionsMonitor();
        const success = await actionMonitor.quickStatus('main');
        if (!success) {
          console.log('');
          console.log(
            chalk.yellow(
              '💡 Run: sc monitor diagnose    # For detailed analysis'
            )
          );
        }
      } catch (error) {
        console.log(
          chalk.red(`❌ Failed to check CI status: ${error.message}`)
        );
      }
      break;

    default:
      console.log(
        chalk.blue('SC Monitor - Development Status & CI/CD Management')
      );
      console.log('');
      console.log(chalk.cyan('📊 Current Status:'));
      console.log(
        '  status                     Show overall development status (default)'
      );
      console.log('  ci, workflows, pipelines   Quick CI/CD status check');
      console.log('');
      console.log(chalk.cyan('🔍 Failure Analysis:'));
      console.log(
        '  diagnose, failures, errors Analyze failed workflows with suggested fixes'
      );
      console.log('');
      console.log(chalk.cyan('⚡ Live Monitoring:'));
      console.log(
        '  watch, live, follow        Watch for new workflow runs and report results'
      );
      console.log('');
      console.log(chalk.cyan('🔧 Development Tools:'));
      console.log('  setup                      Configure auto-monitoring');
      console.log('  check                      Quick integration check');
      console.log('');
      console.log(chalk.yellow('💡 Logical workflow:'));
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
    console.error(chalk.red('❌ Monitor error:'), error.message);
    process.exit(1);
  });
}

module.exports = main;
