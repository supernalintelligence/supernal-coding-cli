#!/usr/bin/env node

const { execSync } = require('node:child_process');
const chalk = require('chalk');

/**
 * Intelligent Git Feedback System
 * Provides real-time feedback from multiple Git sources using GitHub API
 */
class GitFeedback {
  constructor() {
    this.repoOwner = null;
    this.repoName = null;
    this.currentBranch = null;
    this.initializeRepo();
  }

  initializeRepo() {
    try {
      // Get repository info
      const remoteUrl = execSync('git config --get remote.origin.url', {
        encoding: 'utf8',
      }).trim();
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);

      if (match) {
        this.repoOwner = match[1];
        this.repoName = match[2];
      }

      // Get current branch
      this.currentBranch = execSync('git branch --show-current', {
        encoding: 'utf8',
      }).trim();
    } catch (_error) {
      console.log(
        chalk.yellow('⚠️  Not in a Git repository or missing remote')
      );
    }
  }

  /**
   * Get comprehensive feedback about current Git state
   */
  async getComprehensiveFeedback() {
    console.log(chalk.blue.bold('🔍 Git Feedback Analysis'));
    console.log(chalk.blue('='.repeat(50)));

    const feedback = {
      local: await this.getLocalFeedback(),
      cicd: await this.getCICDFeedback(),
      pr: await this.getPRFeedback(),
      releases: await this.getReleaseFeedback(),
      issues: await this.getIssuesFeedback(),
    };

    this.displayFeedback(feedback);
    return feedback;
  }

  /**
   * Get local Git status and health
   */
  async getLocalFeedback() {
    const feedback = {
      status: 'unknown',
      branch: this.currentBranch,
      commits: null,
      changes: null,
      suggestions: [],
    };

    try {
      // Check working directory status
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      feedback.changes = status
        ? status.split('\n').filter((l) => l.trim()).length
        : 0;

      // Check unpushed commits
      try {
        const unpushed = execSync(
          `git log origin/${this.currentBranch}..HEAD --oneline`,
          { encoding: 'utf8' }
        );
        feedback.commits = unpushed
          ? unpushed.split('\n').filter((l) => l.trim()).length
          : 0;
      } catch (_error) {
        feedback.commits = 'No remote tracking';
      }

      // Determine status
      if (feedback.changes === 0 && feedback.commits === 0) {
        feedback.status = 'clean';
      } else if (feedback.changes > 0) {
        feedback.status = 'dirty';
        feedback.suggestions.push('Commit pending changes');
      } else if (feedback.commits > 0) {
        feedback.status = 'ahead';
        feedback.suggestions.push(`Push ${feedback.commits} commits to remote`);
      }
    } catch (error) {
      feedback.status = 'error';
      feedback.suggestions.push(`Git error: ${error.message}`);
    }

    return feedback;
  }

  /**
   * Get CI/CD pipeline feedback using our enhanced monitoring
   */
  async getCICDFeedback() {
    if (!this.repoOwner || !this.repoName) {
      return {
        status: 'no-repo',
        runs: [],
        suggestions: ['Repository not configured for GitHub'],
      };
    }

    try {
      // Get recent workflow runs
      const runsOutput = execSync(
        `gh api repos/${this.repoOwner}/${this.repoName}/actions/runs?per_page=5`,
        { encoding: 'utf8', timeout: 10000 }
      );

      const data = JSON.parse(runsOutput);
      const runs = data.workflow_runs || [];

      const feedback = {
        status: 'unknown',
        runs: runs.slice(0, 3).map((run) => ({
          id: run.id,
          workflow: run.name,
          branch: run.head_branch,
          status: run.status,
          conclusion: run.conclusion,
          created_at: run.created_at,
          html_url: run.html_url,
        })),
        suggestions: [],
      };

      // Analyze recent runs
      const recentFailures = runs
        .filter((r) => r.conclusion === 'failure')
        .slice(0, 2);
      const recentSuccess = runs.find((r) => r.conclusion === 'success');

      if (recentFailures.length > 0) {
        feedback.status = 'failing';
        feedback.suggestions.push(
          `${recentFailures.length} recent workflow failures`
        );
        feedback.suggestions.push('Run: sc monitor diagnose');

        // Get specific failure details
        for (const failure of recentFailures) {
          try {
            const jobs = await this.getFailureDetails(failure.id);
            if (jobs.length > 0) {
              feedback.suggestions.push(`${failure.name}: ${jobs.join(', ')}`);
            }
          } catch (_error) {
            // Silently continue if we can't get details
          }
        }
      } else if (recentSuccess) {
        feedback.status = 'passing';
        feedback.suggestions.push('All recent workflows passing ✅');
      }

      return feedback;
    } catch (error) {
      return {
        status: 'error',
        runs: [],
        suggestions: [`CI/CD API error: ${error.message}`],
      };
    }
  }

  /**
   * Get detailed failure information for a workflow run
   */
  async getFailureDetails(runId) {
    try {
      const jobsOutput = execSync(
        `gh api repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}/jobs`,
        { encoding: 'utf8', timeout: 5000 }
      );

      const data = JSON.parse(jobsOutput);
      const failedJobs = data.jobs.filter(
        (job) => job.conclusion === 'failure'
      );

      return failedJobs.map((job) => job.name);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get Pull Request feedback
   */
  async getPRFeedback() {
    if (!this.repoOwner || !this.repoName) {
      return { status: 'no-repo', prs: [], suggestions: [] };
    }

    try {
      // Check if current branch has a PR
      const prOutput = execSync(
        `gh api repos/${this.repoOwner}/${this.repoName}/pulls?head=${this.repoOwner}:${this.currentBranch}&state=open`,
        { encoding: 'utf8', timeout: 5000 }
      );

      const prs = JSON.parse(prOutput);
      const feedback = {
        status: 'none',
        prs: prs.slice(0, 1).map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          html_url: pr.html_url,
          mergeable: pr.mergeable,
          checks: pr.mergeable_state,
        })),
        suggestions: [],
      };

      if (prs.length > 0) {
        const pr = prs[0];
        feedback.status = pr.mergeable_state;

        switch (pr.mergeable_state) {
          case 'clean':
            feedback.suggestions.push('PR ready to merge ✅');
            break;
          case 'blocked':
            feedback.suggestions.push(
              'PR blocked - check required reviews/checks'
            );
            break;
          case 'behind':
            feedback.suggestions.push('PR behind main - needs rebase/merge');
            break;
          case 'unstable':
            feedback.suggestions.push('PR has failing checks');
            break;
          default:
            feedback.suggestions.push(`PR status: ${pr.mergeable_state}`);
        }
      } else {
        feedback.suggestions.push('No open PR for current branch');
        feedback.suggestions.push(`Create PR: gh pr create`);
      }

      return feedback;
    } catch (error) {
      return {
        status: 'error',
        prs: [],
        suggestions: [`PR API error: ${error.message}`],
      };
    }
  }

  /**
   * Get release feedback
   */
  async getReleaseFeedback() {
    if (!this.repoOwner || !this.repoName) {
      return { status: 'no-repo', releases: [], suggestions: [] };
    }

    try {
      const releasesOutput = execSync(
        `gh api repos/${this.repoOwner}/${this.repoName}/releases?per_page=3`,
        { encoding: 'utf8', timeout: 5000 }
      );

      const releases = JSON.parse(releasesOutput);
      const feedback = {
        status: 'unknown',
        releases: releases.slice(0, 2).map((release) => ({
          tag: release.tag_name,
          name: release.name,
          published_at: release.published_at,
          prerelease: release.prerelease,
          html_url: release.html_url,
        })),
        suggestions: [],
      };

      if (releases.length > 0) {
        const latest = releases[0];
        feedback.status = latest.prerelease ? 'prerelease' : 'stable';

        // Check if we're ahead of latest release
        try {
          const commitsSinceRelease = execSync(
            `git rev-list --count ${latest.tag_name}..HEAD`,
            { encoding: 'utf8' }
          ).trim();

          if (parseInt(commitsSinceRelease, 10) > 0) {
            feedback.suggestions.push(
              `${commitsSinceRelease} commits since ${latest.tag_name}`
            );
            feedback.suggestions.push('Consider creating new release');
          } else {
            feedback.suggestions.push(`Up to date with ${latest.tag_name} ✅`);
          }
        } catch (_error) {
          feedback.suggestions.push(`Latest release: ${latest.tag_name}`);
        }
      } else {
        feedback.status = 'none';
        feedback.suggestions.push('No releases found');
        feedback.suggestions.push('Create release: gh release create');
      }

      return feedback;
    } catch (error) {
      return {
        status: 'error',
        releases: [],
        suggestions: [`Release API error: ${error.message}`],
      };
    }
  }

  /**
   * Get issues feedback
   */
  async getIssuesFeedback() {
    if (!this.repoOwner || !this.repoName) {
      return { status: 'no-repo', issues: [], suggestions: [] };
    }

    try {
      const issuesOutput = execSync(
        `gh api repos/${this.repoOwner}/${this.repoName}/issues?state=open&per_page=5`,
        { encoding: 'utf8', timeout: 5000 }
      );

      const issues = JSON.parse(issuesOutput);
      const feedback = {
        status: 'unknown',
        issues: issues.slice(0, 3).map((issue) => ({
          number: issue.number,
          title: issue.title,
          labels: issue.labels.map((l) => l.name),
          html_url: issue.html_url,
          created_at: issue.created_at,
        })),
        suggestions: [],
      };

      const bugIssues = issues.filter((i) =>
        i.labels.some((l) => l.name.toLowerCase().includes('bug'))
      );
      const criticalIssues = issues.filter((i) =>
        i.labels.some((l) => l.name.toLowerCase().includes('critical'))
      );

      if (criticalIssues.length > 0) {
        feedback.status = 'critical';
        feedback.suggestions.push(
          `${criticalIssues.length} critical issues need attention`
        );
      } else if (bugIssues.length > 0) {
        feedback.status = 'bugs';
        feedback.suggestions.push(`${bugIssues.length} bug reports open`);
      } else if (issues.length > 0) {
        feedback.status = 'open';
        feedback.suggestions.push(`${issues.length} open issues`);
      } else {
        feedback.status = 'clean';
        feedback.suggestions.push('No open issues ✅');
      }

      return feedback;
    } catch (error) {
      return {
        status: 'error',
        issues: [],
        suggestions: [`Issues API error: ${error.message}`],
      };
    }
  }

  /**
   * Display formatted feedback
   */
  displayFeedback(feedback) {
    console.log(`\n${chalk.green.bold('📊 Git Status Summary')}`);
    console.log(chalk.green('─'.repeat(30)));

    // Local status
    const localIcon = this.getStatusIcon(feedback.local.status);
    console.log(
      `${localIcon} Local: ${feedback.local.status} (${feedback.local.branch})`
    );
    if (feedback.local.changes > 0) {
      console.log(`   💾 ${feedback.local.changes} uncommitted changes`);
    }
    if (feedback.local.commits > 0) {
      console.log(`   📤 ${feedback.local.commits} commits to push`);
    }

    // CI/CD status
    const ciIcon = this.getStatusIcon(feedback.cicd.status);
    console.log(`${ciIcon} CI/CD: ${feedback.cicd.status}`);
    if (feedback.cicd.runs.length > 0) {
      feedback.cicd.runs.slice(0, 2).forEach((run) => {
        const runIcon = this.getStatusIcon(run.conclusion);
        console.log(`   ${runIcon} ${run.workflow} (${run.branch})`);
      });
    }

    // PR status
    const prIcon = this.getStatusIcon(feedback.pr.status);
    console.log(`${prIcon} Pull Request: ${feedback.pr.status}`);
    if (feedback.pr.prs.length > 0) {
      const pr = feedback.pr.prs[0];
      console.log(`   🔀 #${pr.number}: ${pr.title}`);
    }

    // Suggestions
    const allSuggestions = [
      ...feedback.local.suggestions,
      ...feedback.cicd.suggestions,
      ...feedback.pr.suggestions,
      ...feedback.releases.suggestions,
    ].slice(0, 5);

    if (allSuggestions.length > 0) {
      console.log(`\n${chalk.yellow.bold('💡 Recommendations')}`);
      console.log(chalk.yellow('─'.repeat(20)));
      allSuggestions.forEach((suggestion) => {
        console.log(`   • ${suggestion}`);
      });
    }

    console.log(`\n${chalk.blue('🔧 Quick Actions:')}`);
    console.log(
      `   ${chalk.cyan('sc git-smart status')}     # Full detailed status`
    );
    console.log(
      `   ${chalk.cyan('sc monitor')}              # CI/CD pipeline status`
    );
    console.log(
      `   ${chalk.cyan('sc git-smart merge')}      # Safe merge workflow`
    );
    console.log(
      `   ${chalk.cyan('gh pr create')}            # Create pull request`
    );
  }

  getStatusIcon(status) {
    const icons = {
      clean: '✅',
      passing: '✅',
      success: '✅',
      dirty: '🟡',
      ahead: '🟡',
      failing: '❌',
      failure: '❌',
      blocked: '🔒',
      behind: '⬇️',
      unstable: '⚠️',
      critical: '🚨',
      bugs: '🐛',
      open: '📋',
      none: '⚪',
      unknown: '❓',
      error: '💥',
    };
    return icons[status] || '❓';
  }

  /**
   * Get smart suggestions based on current state
   */
  async getSmartSuggestions() {
    const feedback = await this.getComprehensiveFeedback();
    const suggestions = [];

    // Priority-based suggestions
    if (feedback.cicd.status === 'failing') {
      suggestions.push({
        priority: 'high',
        action: 'sc monitor diagnose',
        reason: 'CI/CD failures need immediate attention',
      });
    }

    if (feedback.local.status === 'dirty') {
      suggestions.push({
        priority: 'medium',
        action: 'git add . && git commit -m "..."',
        reason: 'Uncommitted changes should be saved',
      });
    }

    if (feedback.local.status === 'ahead') {
      suggestions.push({
        priority: 'medium',
        action: 'sc git-smart push',
        reason: 'Local commits should be pushed',
      });
    }

    if (feedback.pr.status === 'none' && feedback.local.commits > 0) {
      suggestions.push({
        priority: 'low',
        action: 'gh pr create',
        reason: 'Consider creating PR for review',
      });
    }

    return suggestions.sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority];
    });
  }
}

module.exports = GitFeedback;

// CLI interface
if (require.main === module) {
  const feedback = new GitFeedback();

  const command = process.argv[2] || 'status';

  switch (command) {
    case 'status':
      feedback.getComprehensiveFeedback();
      break;
    case 'suggest':
      feedback.getSmartSuggestions().then((suggestions) => {
        console.log(chalk.blue.bold('🎯 Smart Suggestions'));
        suggestions.forEach((s, i) => {
          const priorityColor =
            s.priority === 'high'
              ? 'red'
              : s.priority === 'medium'
                ? 'yellow'
                : 'white';
          console.log(`${i + 1}. ${chalk[priorityColor](s.action)}`);
          console.log(`   ${chalk.gray(s.reason)}`);
        });
      });
      break;
    default:
      console.log('Usage: sc git feedback [status|suggest]');
  }
}
