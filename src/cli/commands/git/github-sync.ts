#!/usr/bin/env node
// @ts-nocheck

const { execSync } = require('node:child_process');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const matter = require('gray-matter');

/**
 * GitHub Sync - Sync GitHub issues, PRs, and CI status to local markdown files
 *
 * This enables the feedback loop:
 * 1. Local rule change → sc rules suggest → GitHub Issue
 * 2. GitHub Issue → sc github sync → Local tracking in docs/
 * 3. PR created → sc github sync → Track PR status
 * 4. PR merged → sc github sync → Alert to pull latest rules
 */

class GitHubSync {
  ciDir: any;
  issuesDir: any;
  projectRoot: any;
  prsDir: any;
  repoName: any;
  repoOwner: any;
  verbose: any;
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
    this.issuesDir = path.join(
      this.projectRoot,
      'docs/research_and_analysis/evidence/issues'
    );
    this.prsDir = path.join(this.projectRoot, 'docs/repo/prs');
    this.ciDir = path.join(this.projectRoot, 'docs/repo/ci');
    this.repoOwner = null;
    this.repoName = null;
    this.initializeRepo();
  }

  initializeRepo() {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        encoding: 'utf8',
        cwd: this.projectRoot
      }).trim();
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (match) {
        this.repoOwner = match[1];
        this.repoName = match[2];
      }
    } catch (_error) {
      console.log(chalk.yellow('⚠️  Not in a Git repository or missing remote'));
    }
  }

  /**
   * Check if gh CLI is available and authenticated
   */
  checkGhCli() {
    try {
      execSync('gh auth status', { stdio: 'ignore' });
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Sync GitHub issues to local markdown files
   */
  async syncIssues(options = {}) {
    if (!this.checkGhCli()) {
      console.log(
        chalk.yellow('⚠️  GitHub CLI not authenticated. Run: gh auth login')
      );
      return { success: false, synced: 0 };
    }

    await fs.ensureDir(this.issuesDir);

    const labels = options.labels || [
      'rule-suggestion',
      'bug',
      'feature',
      'enhancement'
    ];
    const state = options.state || 'all';
    const limit = options.limit || 50;

    try {
      console.log(chalk.blue('📋 Fetching issues from GitHub...'));

      const output = execSync(
        `gh issue list --state ${state} --limit ${limit} --json number,title,state,labels,author,createdAt,updatedAt,url,body`,
        { encoding: 'utf8', cwd: this.projectRoot }
      );

      const issues = JSON.parse(output);
      let syncedCount = 0;

      for (const issue of issues) {
        // Check if issue matches our label filters (or sync all if no filter)
        const issueLabels = issue.labels.map((l) => l.name);
        const matchesFilter =
          labels.length === 0 || issueLabels.some((l) => labels.includes(l));

        if (!matchesFilter && labels.length > 0) continue;

        const filename = `gh-${issue.number}-${this.slugify(issue.title)}.md`;
        const filepath = path.join(this.issuesDir, filename);

        // Create frontmatter
        const frontmatter = {
          type: 'issue',
          source: 'github',
          github_id: issue.number,
          github_url: issue.url,
          title: issue.title,
          state: issue.state,
          labels: issueLabels,
          created: issue.createdAt.split('T')[0],
          updated: issue.updatedAt.split('T')[0],
          author: issue.author?.login || 'unknown',
          synced_at: new Date().toISOString()
        };

        // Check for linked PR
        const linkedPr = await this.findLinkedPR(issue.number);
        if (linkedPr) {
          frontmatter.linked_pr = linkedPr.number;
          frontmatter.linked_pr_state = linkedPr.state;
        }

        const content = matter.stringify(issue.body || '', frontmatter);
        await fs.writeFile(filepath, content);
        syncedCount++;

        if (this.verbose) {
          console.log(chalk.gray(`  ✓ ${filename}`));
        }
      }

      console.log(chalk.green(`✅ Synced ${syncedCount} issues`));
      return { success: true, synced: syncedCount };
    } catch (error) {
      console.log(chalk.red(`❌ Failed to sync issues: ${error.message}`));
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Sync GitHub PRs to local markdown files
   */
  async syncPRs(options = {}) {
    if (!this.checkGhCli()) {
      console.log(
        chalk.yellow('⚠️  GitHub CLI not authenticated. Run: gh auth login')
      );
      return { success: false, synced: 0 };
    }

    await fs.ensureDir(this.prsDir);

    const state = options.state || 'all';
    const limit = options.limit || 50;

    try {
      console.log(chalk.blue('🔀 Fetching PRs from GitHub...'));

      const output = execSync(
        `gh pr list --state ${state} --limit ${limit} --json number,title,state,author,createdAt,updatedAt,url,body,baseRefName,headRefName,reviewDecision,statusCheckRollup,mergeable,mergedAt`,
        { encoding: 'utf8', cwd: this.projectRoot }
      );

      const prs = JSON.parse(output);
      let syncedCount = 0;
      const recentlyMerged = [];

      for (const pr of prs) {
        const filename = `pr-${pr.number}-${this.slugify(pr.title)}.md`;
        const filepath = path.join(this.prsDir, filename);

        // Determine PR state
        let prState = pr.state.toLowerCase();
        if (pr.mergedAt) {
          prState = 'merged';
          // Track recently merged PRs for notification
          const mergedDate = new Date(pr.mergedAt);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (mergedDate > dayAgo) {
            recentlyMerged.push(pr);
          }
        }

        // Determine CI status
        let ciStatus = 'unknown';
        if (pr.statusCheckRollup) {
          const checks = pr.statusCheckRollup;
          if (checks.every((c) => c.conclusion === 'SUCCESS')) {
            ciStatus = 'passing';
          } else if (checks.some((c) => c.conclusion === 'FAILURE')) {
            ciStatus = 'failing';
          } else if (checks.some((c) => c.status === 'IN_PROGRESS')) {
            ciStatus = 'pending';
          }
        }

        // Create frontmatter
        const frontmatter = {
          type: 'pull_request',
          source: 'github',
          github_id: pr.number,
          github_url: pr.url,
          title: pr.title,
          state: prState,
          base_branch: pr.baseRefName,
          head_branch: pr.headRefName,
          ci_status: ciStatus,
          review_decision: pr.reviewDecision || 'pending',
          mergeable: pr.mergeable,
          created: pr.createdAt.split('T')[0],
          updated: pr.updatedAt.split('T')[0],
          merged_at: pr.mergedAt ? pr.mergedAt.split('T')[0] : null,
          author: pr.author?.login || 'unknown',
          synced_at: new Date().toISOString()
        };

        // Find linked issues
        const linkedIssues = this.extractLinkedIssues(pr.body || '');
        if (linkedIssues.length > 0) {
          frontmatter.linked_issues = linkedIssues;
        }

        const content = matter.stringify(pr.body || '', frontmatter);
        await fs.writeFile(filepath, content);
        syncedCount++;

        if (this.verbose) {
          console.log(chalk.gray(`  ✓ ${filename}`));
        }
      }

      console.log(chalk.green(`✅ Synced ${syncedCount} PRs`));

      // Alert about recently merged PRs
      if (recentlyMerged.length > 0) {
        console.log(chalk.cyan('\n📢 Recently merged PRs (last 24h):'));
        for (const pr of recentlyMerged) {
          console.log(chalk.yellow(`  • PR #${pr.number}: ${pr.title}`));
          // Check if it's a rule-related PR
          if (pr.title.toLowerCase().includes('rule')) {
            console.log(
              chalk.green(`    💡 This might update rules. Run: sc rules sync`)
            );
          }
        }
      }

      return { success: true, synced: syncedCount, recentlyMerged };
    } catch (error) {
      console.log(chalk.red(`❌ Failed to sync PRs: ${error.message}`));
      return { success: false, synced: 0, error: error.message };
    }
  }

  /**
   * Sync CI/CD status
   */
  async syncCI(options = {}) {
    if (!this.checkGhCli()) {
      console.log(
        chalk.yellow('⚠️  GitHub CLI not authenticated. Run: gh auth login')
      );
      return { success: false };
    }

    try {
      console.log(chalk.blue('🔧 Fetching CI/CD status...'));

      const branch = options.branch || 'main';
      const output = execSync(
        `gh run list --branch ${branch} --limit 10 --json status,conclusion,workflowName,headBranch,event,createdAt,url,databaseId`,
        { encoding: 'utf8', cwd: this.projectRoot }
      );

      const runs = JSON.parse(output);

      // Display summary
      console.log(chalk.cyan('\n📊 Recent CI/CD Runs:'));
      for (const run of runs.slice(0, 5)) {
        const icon =
          run.conclusion === 'success'
            ? '✅'
            : run.conclusion === 'failure'
              ? '❌'
              : run.status === 'in_progress'
                ? '🔄'
                : '⏳';
        console.log(
          `  ${icon} ${run.workflowName} (${run.headBranch}) - ${run.conclusion || run.status}`
        );
      }

      return { success: true, runs };
    } catch (error) {
      console.log(chalk.red(`❌ Failed to sync CI: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Full sync - issues, PRs, and CI
   */
  async syncAll(options = {}) {
    console.log(chalk.blue.bold('🔄 GitHub Sync'));
    console.log(chalk.blue('='.repeat(50)));

    if (!this.checkGhCli()) {
      console.log(chalk.red('❌ GitHub CLI not authenticated'));
      console.log(chalk.yellow('   Run: gh auth login'));
      return { success: false };
    }

    console.log(chalk.gray(`Repository: ${this.repoOwner}/${this.repoName}\n`));

    const results = {
      issues: await this.syncIssues(options),
      prs: await this.syncPRs(options),
      ci: await this.syncCI(options)
    };

    console.log(chalk.blue(`\n${'='.repeat(50)}`));
    console.log(chalk.green('✅ GitHub sync complete'));

    return results;
  }

  /**
   * Find PR linked to an issue
   */
  async findLinkedPR(issueNumber) {
    try {
      const output = execSync(
        `gh pr list --search "fixes #${issueNumber} OR closes #${issueNumber}" --json number,state --limit 1`,
        { encoding: 'utf8', cwd: this.projectRoot }
      );
      const prs = JSON.parse(output);
      return prs[0] || null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Extract issue numbers from PR body (Fixes #123, Closes #456)
   */
  extractLinkedIssues(body) {
    const matches =
      body.match(/(fixes|closes|resolves|addresses)\s*#(\d+)/gi) || [];
    return matches.map((m) => parseInt(m.match(/\d+/)[0], 10));
  }

  /**
   * Create URL-safe slug from title
   */
  slugify(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}

/**
 * CLI handler
 */
async function handleGitHubSync(action, options) {
  const sync = new GitHubSync({
    projectRoot: process.cwd(),
    verbose: options.verbose
  });

  switch (action) {
    case 'all':
    case 'sync':
    case undefined:
      await sync.syncAll(options);
      break;
    case 'issues':
      await sync.syncIssues(options);
      break;
    case 'prs':
      await sync.syncPRs(options);
      break;
    case 'ci':
      await sync.syncCI(options);
      break;
    case 'status':
      // Quick status overview
      console.log(chalk.blue.bold('📊 GitHub Status'));
      console.log(chalk.blue('='.repeat(50)));
      await sync.syncCI({ branch: 'main' });
      break;
    default:
      console.log(`
${chalk.blue('GitHub Sync')}

Usage: sc github <action> [options]

${chalk.yellow('Actions:')}
  ${chalk.cyan('sync')}        Full sync: issues, PRs, and CI status (default)
  ${chalk.cyan('issues')}      Sync GitHub issues to local markdown
  ${chalk.cyan('prs')}         Sync GitHub PRs to local markdown
  ${chalk.cyan('ci')}          Sync CI/CD status
  ${chalk.cyan('status')}      Quick status overview

${chalk.yellow('Options:')}
  --verbose       Show detailed output
  --state <s>     Filter by state: open|closed|all (default: all)
  --limit <n>     Maximum items to sync (default: 50)
  --labels <l>    Comma-separated labels to filter (issues only)

${chalk.yellow('Examples:')}
  sc github sync                    # Full sync
  sc github issues --state=open     # Sync open issues only
  sc github prs --verbose           # Sync PRs with details
  sc github status                  # Quick CI overview
      `);
  }
}

module.exports = {
  GitHubSync,
  handleGitHubSync
};
