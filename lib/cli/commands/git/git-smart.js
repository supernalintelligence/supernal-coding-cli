#!/usr/bin/env node

// git-smart.js - Intelligent Git Management for Supernal Coding
// Part of REQ-024: Smart Git Management System

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');
const { getConfig } = require('../../../../../scripts/config-loader');
const GitFeedback = require('./git-feedback');
const { SigningManager } = require('../../../signing');

class GitSmart {
  constructor() {
    this.projectRoot = process.cwd();
    const config = getConfig(this.projectRoot);
    config.load();
    this.requirementsDir = path.join(
      this.projectRoot,
      config.getRequirementsDirectory()
    );
  }

  getCurrentBranch() {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (_error) {
      throw new Error('Not in a git repository');
    }
  }

  getRecentCommits(count = 5) {
    try {
      return execSync(`git log --oneline -${count}`, { encoding: 'utf8' })
        .trim()
        .split('\n');
    } catch (_error) {
      return [];
    }
  }

  extractRequirementFromBranch(branch) {
    // Handle both "req-003" and "req003" patterns
    const match = branch.match(/req-?(\d{3})/i);
    return match ? `REQ-${match[1].padStart(3, '0')}` : null;
  }

  shouldDeleteLocalBranch(branchName, forceDelete = false) {
    // If user explicitly requested deletion, honor it
    if (forceDelete) {
      return true;
    }

    // Smart decision logic
    try {
      // 1. Always delete requirement branches (REQ-XXX pattern) - they're meant to be temporary
      if (this.extractRequirementFromBranch(branchName)) {
        return true;
      }

      // 2. Check if branch has been fully merged
      try {
        const unmergedCommits = execSync(
          `git log main..${branchName} --oneline`,
          { encoding: 'utf8' }
        ).trim();
        if (unmergedCommits) {
          // Branch has unmerged commits, preserve it
          return false;
        }
      } catch (_error) {
        // If we can't check merge status, be conservative and preserve
        return false;
      }

      // 3. Check if branch exists on remote (has backup)
      try {
        execSync(`git rev-parse --verify origin/${branchName}`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
        // Branch exists on remote, safe to delete locally
        return true;
      } catch (_error) {
        // No remote backup, preserve locally
        return false;
      }
    } catch (_error) {
      // Any error in decision-making, be conservative and preserve
      return false;
    }
  }

  getRequirementFile(reqId) {
    const patterns = [
      `${reqId.toLowerCase()}-*.md`,
      `${reqId.toLowerCase()}.md`,
    ];

    const searchDirs = [
      path.join(this.requirementsDir, 'core'),
      path.join(this.requirementsDir, 'infrastructure'),
      path.join(this.requirementsDir, 'workflow'),
      path.join(this.requirementsDir, 'testing'),
      path.join(this.requirementsDir, 'integration'),
    ];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const pattern of patterns) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          const match = files.find((file) => regex.test(file));
          if (match) {
            return path.join(dir, match);
          }
        }
      }
    }
    return null;
  }

  // Branch Management Methods
  async cleanupMergedBranches(options = {}) {
    const { dryRun = false, verbose = true, pushFirst = true } = options;

    try {
      if (verbose) {
        console.log(chalk.blue('🧹 Starting branch cleanup...'));
      }

      // Get all merged branches except main/master
      const mergedBranches = execSync('git branch --merged main', {
        encoding: 'utf8',
        cwd: this.projectRoot,
      })
        .split('\n')
        .map((branch) => branch.trim().replace(/^\*\s*/, ''))
        .filter((branch) => branch && branch !== 'main' && branch !== 'master');

      if (mergedBranches.length === 0) {
        if (verbose) {
          console.log(chalk.green('✅ No merged feature branches to clean up'));
        }
        return { success: true, cleaned: [], pushed: [] };
      }

      const pushed = [];
      const cleaned = [];

      for (const branch of mergedBranches) {
        // Check if branch exists on remote
        const remoteExists = await this.checkRemoteBranchExists(branch);

        if (pushFirst && !remoteExists) {
          // Push branch to remote for audit trail
          if (verbose) {
            console.log(
              chalk.yellow(`📤 Pushing ${branch} to remote for audit trail...`)
            );
          }

          if (!dryRun) {
            try {
              execSync(`git push origin ${branch}`, {
                cwd: this.projectRoot,
                stdio: verbose ? 'inherit' : 'pipe',
              });
              pushed.push(branch);
            } catch (error) {
              if (verbose) {
                console.log(
                  chalk.yellow(`⚠️  Could not push ${branch}: ${error.message}`)
                );
              }
            }
          } else {
            console.log(chalk.cyan(`[DRY RUN] Would push: ${branch}`));
          }
        }

        // Delete local branch
        if (verbose) {
          console.log(chalk.blue(`🗑️  Deleting local branch: ${branch}`));
        }

        if (!dryRun) {
          try {
            execSync(`git branch -d ${branch}`, {
              cwd: this.projectRoot,
              stdio: verbose ? 'inherit' : 'pipe',
            });
            cleaned.push(branch);
          } catch (error) {
            if (verbose) {
              console.log(
                chalk.red(`❌ Could not delete ${branch}: ${error.message}`)
              );
            }
          }
        } else {
          console.log(chalk.cyan(`[DRY RUN] Would delete: ${branch}`));
        }
      }

      if (verbose) {
        console.log(chalk.green(`✅ Cleanup complete:`));
        if (pushed.length > 0) {
          console.log(
            chalk.blue(`   📤 Pushed to remote: ${pushed.join(', ')}`)
          );
        }
        console.log(
          chalk.blue(`   🗑️  Cleaned up: ${cleaned.length} branches`)
        );
      }

      return {
        success: true,
        cleaned,
        pushed,
        total: mergedBranches.length,
      };
    } catch (error) {
      console.error(
        chalk.red(`❌ Error during branch cleanup: ${error.message}`)
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkRemoteBranchExists(branchName) {
    try {
      execSync(`git ls-remote --heads origin ${branchName}`, {
        cwd: this.projectRoot,
        stdio: 'pipe',
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  async listBranchStatus(options = {}) {
    const { verbose = true } = options;

    try {
      const currentBranch = this.getCurrentBranch();

      // Get all local branches
      const allBranches = execSync('git branch', {
        encoding: 'utf8',
        cwd: this.projectRoot,
      })
        .split('\n')
        .map((branch) => branch.trim().replace(/^\*\s*/, ''))
        .filter((branch) => branch);

      // Get merged branches
      const mergedBranches = execSync('git branch --merged main', {
        encoding: 'utf8',
        cwd: this.projectRoot,
      })
        .split('\n')
        .map((branch) => branch.trim().replace(/^\*\s*/, ''))
        .filter((branch) => branch && branch !== 'main' && branch !== 'master');

      // Get unmerged branches
      const unmergedBranches = execSync('git branch --no-merged main', {
        encoding: 'utf8',
        cwd: this.projectRoot,
      })
        .split('\n')
        .map((branch) => branch.trim().replace(/^\*\s*/, ''))
        .filter((branch) => branch);

      const status = {
        current: currentBranch,
        total: allBranches.length,
        merged: mergedBranches,
        unmerged: unmergedBranches,
        canCleanup: mergedBranches.length,
      };

      if (verbose) {
        console.log(chalk.blue('\n📋 Branch Status Report:'));
        console.log(`   Current branch: ${chalk.green(currentBranch)}`);
        console.log(`   Total branches: ${status.total}`);
        console.log(
          `   Merged (can clean): ${chalk.yellow(status.canCleanup)}`
        );
        console.log(
          `   Unmerged (active): ${chalk.red(status.unmerged.length)}`
        );

        if (mergedBranches.length > 0) {
          console.log('\n🧹 Merged branches (ready for cleanup):');
          mergedBranches.forEach((branch) => {
            console.log(`   ${chalk.yellow('●')} ${branch}`);
          });
        }

        if (unmergedBranches.length > 0) {
          console.log('\n🚧 Unmerged branches (active work):');
          unmergedBranches.forEach((branch) => {
            const marker =
              branch === currentBranch ? chalk.green('●') : chalk.red('●');
            console.log(`   ${marker} ${branch}`);
          });
        }

        if (mergedBranches.length > 0) {
          console.log(
            `\n💡 Run: ${chalk.cyan('sc git-smart cleanup-branches')} to clean up merged branches`
          );
        }
      }

      return status;
    } catch (error) {
      console.error(
        chalk.red(`❌ Error getting branch status: ${error.message}`)
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getRequirementInfo(reqId) {
    const filePath = this.getRequirementFile(reqId);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const info = {};

      frontmatter.split('\n').forEach((line) => {
        const [key, value] = line.split(':').map((s) => s.trim());
        if (key && value) {
          info[key] = value.replace(/['"]/g, '');
        }
      });

      return info;
    }

    return null;
  }

  inferStage(branch, requirement, commits) {
    const branchLower = branch.toLowerCase();
    const commitText = commits.join(' ').toLowerCase();

    // Stage indicators (in priority order)

    // Explicit branch stage indicators
    if (branchLower.includes('draft') || branchLower.includes('plan')) {
      return 'planning';
    }

    if (branchLower.includes('review') || branchLower.includes('pr')) {
      return 'reviewing';
    }

    // Requirement status takes priority over commit analysis
    if (requirement?.status) {
      const status = requirement.status.toLowerCase();
      if (
        status === 'done' ||
        status === 'completed' ||
        status === 'implemented'
      ) {
        return 'completed';
      }
      if (status === 'in-progress' || status === 'implementing') {
        return 'implementing';
      }
      if (status === 'testing' || status === 'test') {
        return 'testing';
      }
      if (status === 'reviewing' || status === 'review') {
        return 'reviewing';
      }
    }

    // More specific testing indicators (avoid false positives)
    const testingIndicators = [
      'add tests',
      'test:',
      'spec:',
      'testing',
      'test coverage',
      'unit test',
      'integration test',
      'e2e test',
    ];
    if (testingIndicators.some((indicator) => commitText.includes(indicator))) {
      return 'testing';
    }

    // Implementation indicators
    const implementingIndicators = [
      'feat:',
      'implement',
      'add:',
      'create:',
      'build:',
      'develop',
    ];
    if (
      implementingIndicators.some((indicator) => commitText.includes(indicator))
    ) {
      return 'implementing';
    }

    // Default based on commit count and activity
    if (commits.length > 5) {
      return 'implementing';
    }

    return 'planning';
  }

  getSuggestedCommitPatterns(requirement, stage) {
    const reqId = requirement ? requirement.id || 'REQ-XXX' : 'REQ-XXX';
    const patterns = [];

    switch (stage) {
      case 'planning':
        patterns.push(`docs(${reqId}): add planning documentation`);
        patterns.push(`feat(${reqId}): initial structure and foundation`);
        break;

      case 'implementing':
        patterns.push(`feat(${reqId}): implement [specific feature]`);
        patterns.push(`refactor(${reqId}): optimize [component] for [reason]`);
        patterns.push(`fix(${reqId}): resolve [specific issue]`);
        break;

      case 'testing':
        patterns.push(`test(${reqId}): add unit tests for [component]`);
        patterns.push(`test(${reqId}): add integration tests`);
        patterns.push(`fix(${reqId}): resolve test failures in [area]`);
        break;

      case 'reviewing':
        patterns.push(`docs(${reqId}): update documentation for review`);
        patterns.push(`refactor(${reqId}): address code review feedback`);
        break;

      case 'completed':
        patterns.push(`feat(${reqId}): complete requirement implementation`);
        patterns.push(`docs(${reqId}): finalize documentation`);
        break;

      default:
        patterns.push(`feat(${reqId}): [description]`);
        patterns.push(`docs(${reqId}): [description]`);
        break;
    }

    return patterns;
  }

  getSuggestedActions(requirement, stage) {
    const actions = [];

    if (!requirement) {
      actions.push('🔍 Create or link requirement document');
      actions.push('📝 Define acceptance criteria');
      return actions;
    }

    switch (stage) {
      case 'planning':
        actions.push('✅ Update requirement status to in-progress');
        actions.push('🔨 Begin implementation');
        if (requirement.dependencies) {
          actions.push('🔗 Check dependency completion');
        }
        break;

      case 'implementing':
        actions.push('🧪 Add tests for implemented features');
        actions.push('📚 Update documentation');
        actions.push('🔄 Regular commits with progress updates');
        break;

      case 'testing':
        actions.push('✅ Run full test suite');
        actions.push('🐛 Fix any failing tests');
        actions.push('📋 Prepare for review');
        break;

      case 'reviewing':
        actions.push('🔄 Address review feedback');
        actions.push('✅ Update requirement status to done');
        actions.push('🚀 Prepare for merge');
        break;

      case 'completed':
        actions.push('🎉 Requirement completed!');
        actions.push('🔄 Consider next priority requirement');
        break;
    }

    return actions;
  }

  getCurrentStatus() {
    const branch = this.getCurrentBranch();
    const commits = this.getRecentCommits();
    const reqId = this.extractRequirementFromBranch(branch);
    const requirement = reqId ? this.getRequirementInfo(reqId) : null;
    const stage = this.inferStage(branch, requirement, commits);
    const actions = this.getSuggestedActions(requirement, stage);

    return {
      branch,
      requirement: reqId,
      requirementInfo: requirement,
      stage,
      actions,
      commits: commits.slice(0, 3),
    };
  }

  suggestBranchName(reqId) {
    const slug = reqId.toLowerCase().replace(/req-/, '');
    return `feature/req-${slug}-smart-git-management`;
  }

  checkWorkContext(workingOnReqs = []) {
    const currentBranch = this.getCurrentBranch();
    const branchReq = this.extractRequirementFromBranch(currentBranch);

    // Check for mixed work patterns (multiple unrelated requirement areas)
    if (workingOnReqs.length > 1) {
      const dashboardReqs = workingOnReqs.filter((req) =>
        ['REQ-026', 'REQ-027', 'REQ-028', 'REQ-029'].includes(req)
      );
      const gitReqs = workingOnReqs.filter((req) =>
        ['REQ-024', 'REQ-011', 'REQ-012'].includes(req)
      );
      const archiveReqs = workingOnReqs.filter((req) =>
        ['REQ-022'].includes(req)
      );
      const repoReqs = workingOnReqs.filter((req) => ['REQ-006'].includes(req));

      const activeAreas = [];
      if (dashboardReqs.length > 0) activeAreas.push('Dashboard System');
      if (gitReqs.length > 0) activeAreas.push('Git Management');
      if (archiveReqs.length > 0) activeAreas.push('Archiving System');
      if (repoReqs.length > 0) activeAreas.push('Repository Initialization');

      if (activeAreas.length > 1) {
        return {
          status: 'error',
          message: `MIXED WORK DETECTED: Working on ${activeAreas.join(', ')} simultaneously`,
          suggestion: `Split work: Dashboard (${dashboardReqs.join(',')}) → feature/req-026-029-dashboard-system`,
          mixedWork: true,
          areas: activeAreas,
        };
      }
    }

    if (!branchReq && workingOnReqs.length > 0) {
      return {
        status: 'warning',
        message:
          "Working on requirements but branch doesn't follow naming convention",
        suggestion: `Create branch: feature/req-${workingOnReqs.join('-').toLowerCase()}-description`,
      };
    }

    if (branchReq && workingOnReqs.length > 0) {
      const branchReqNum = parseInt(branchReq.replace('REQ-', ''), 10);
      const workingReqNums = workingOnReqs.map((req) =>
        parseInt(req.toUpperCase().replace('REQ-', ''), 10)
      );

      if (!workingReqNums.includes(branchReqNum)) {
        return {
          status: 'error',
          message: `Working on ${workingOnReqs.join(', ')} but on branch for ${branchReq}`,
          suggestion: `Create new branch: feature/req-${workingOnReqs.join('-').toLowerCase()}-description`,
        };
      }
    }

    return {
      status: 'ok',
      message: 'Work context matches branch',
    };
  }

  detectRecentWork() {
    const recentCommits = this.getRecentCommits(3);
    // Look for both REQ-XXX and req-XXX patterns
    const reqPattern = /(req|REQ)-(\d{3})/g;
    const detectedReqs = new Set();

    recentCommits.forEach((commit) => {
      // Also get full commit message including body
      try {
        const fullCommit = execSync(
          `git show --format="%B" --no-patch ${commit.split(' ')[0]}`,
          { encoding: 'utf8' }
        );
        const matches = fullCommit.matchAll(reqPattern);
        for (const match of matches) {
          detectedReqs.add(`REQ-${match[2]}`);
        }
      } catch (_error) {
        // Fallback to just commit title
        const matches = commit.matchAll(reqPattern);
        for (const match of matches) {
          detectedReqs.add(`REQ-${match[2]}`);
        }
      }
    });

    return Array.from(detectedReqs);
  }

  showStatus() {
    const status = this.getCurrentStatus();

    console.log('\n🔍 SUPERNAL CODING - Current Development Status\n');

    console.log(`📋 Branch: ${status.branch}`);

    if (status.requirement) {
      console.log(`🎯 Requirement: ${status.requirement}`);
      if (status.requirementInfo) {
        console.log(`   Title: ${status.requirementInfo.title || 'N/A'}`);
        console.log(`   Status: ${status.requirementInfo.status || 'N/A'}`);
        console.log(`   Priority: ${status.requirementInfo.priority || 'N/A'}`);
      }
    } else {
      console.log('⚠️  No requirement detected from branch name');
    }

    console.log(`🔄 Stage: ${status.stage}`);

    if (status.commits.length > 0) {
      console.log('\n📝 Recent Commits:');
      status.commits.forEach((commit) => {
        console.log(`   ${commit}`);
      });
    }

    if (status.actions.length > 0) {
      console.log('\n💡 Suggested Next Actions:');
      status.actions.forEach((action) => {
        console.log(`   ${action}`);
      });
    }

    // Show suggested commit patterns
    const commitPatterns = this.getSuggestedCommitPatterns(
      status.requirementInfo,
      status.stage
    );
    if (commitPatterns.length > 0) {
      console.log('\n📝 Suggested Commit Patterns:');
      commitPatterns.forEach((pattern) => {
        console.log(`   ${pattern}`);
      });
    }

    console.log('');
  }

  createBranch(reqId) {
    const branchName = this.suggestBranchName(reqId);

    try {
      execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
      console.log(`\n✅ Created and switched to branch: ${branchName}`);

      const requirement = this.getRequirementInfo(reqId);
      if (requirement) {
        console.log(`🎯 Working on: ${requirement.title}`);
        console.log(`📋 Priority: ${requirement.priority}`);
      }

      console.log('\n💡 Next steps:');
      console.log('   📝 Update requirement status to in-progress');
      console.log('   🔨 Begin implementation');
      console.log('   📚 Update documentation as you go');
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to create branch: ${error.message}`);
    }
  }

  /**
   * Check branch compliance - moved from agent command for reusability
   */
  checkBranchCompliance(options = { verbose: true }) {
    const results = {
      valid: true,
      branch: this.getCurrentBranch(),
      commitsAhead: 0,
      issues: [],
    };

    // Check if on main/master
    if (results.branch === 'main' || results.branch === 'master') {
      results.valid = false;
      results.issues.push({
        type: 'error',
        message: 'Working on main branch - create feature branch first!',
        suggestion: 'git checkout -b feature/your-work-description',
      });
    } else if (options.verbose) {
      console.log(`✅ Good: Working on feature branch (${results.branch})`);
    }

    // Check commits ahead of main (only if not on main)
    if (results.branch !== 'main' && results.branch !== 'master') {
      try {
        const commitsAhead = execSync(
          `git rev-list --count main..${results.branch} 2>/dev/null || echo "0"`,
          { encoding: 'utf8' }
        ).trim();
        results.commitsAhead = parseInt(commitsAhead, 10);

        if (options.verbose) {
          if (results.commitsAhead > 0) {
            console.log(
              `✅ Branch has ${results.commitsAhead} commits ahead of main`
            );
          } else {
            console.log('⚠️  Branch has no commits ahead of main');
          }
        }
      } catch (_error) {
        if (options.verbose) {
          console.log(
            '⚠️  Could not check commits ahead (main branch may not exist)'
          );
        }
      }
    }

    return results;
  }

  // Safe merge functionality
  async performSafeMerge(featureBranch, options = {}) {
    const {
      autoPush = false,
      deleteLocal = false,
      preserveLocal = false,
      verbose = true,
    } = options;

    // Set environment to prevent any git editor from opening
    const originalGitEditor = process.env.GIT_EDITOR;
    process.env.GIT_EDITOR = 'true'; // Use 'true' command which always succeeds without opening editor

    if (verbose) {
      console.log('\n🔄 SAFE MERGE PROCESS INITIATED\n');
    }

    try {
      // Step 1: Validation
      console.log('📋 Step 1: Pre-merge validation...');

      // Check if we're in a git repository
      const currentBranch = this.getCurrentBranch();
      if (verbose) {
        console.log(`   Current branch: ${currentBranch}`);
      }

      // Ensure we're not already on main
      if (currentBranch === 'main' || currentBranch === 'master') {
        throw new Error(
          'Cannot merge from main/master branch. Switch to feature branch first.'
        );
      }

      // Check if feature branch exists
      if (featureBranch && featureBranch !== currentBranch) {
        try {
          execSync(`git rev-parse --verify ${featureBranch}`, {
            encoding: 'utf8',
          });
        } catch (_error) {
          throw new Error(`Feature branch '${featureBranch}' does not exist.`);
        }
      }

      const branchToMerge = featureBranch || currentBranch;

      // Extract requirement ID from branch name
      const reqIdMatch = branchToMerge.match(/req-(\d+)/i);
      const reqId = reqIdMatch ? `REQ-${reqIdMatch[1].padStart(3, '0')}` : null;

      // Check for uncommitted changes
      try {
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        if (status.trim()) {
          throw new Error(
            'Uncommitted changes detected. Please commit or stash changes before merging.'
          );
        }
      } catch (error) {
        if (error.message.includes('Uncommitted changes')) {
          throw error;
        }
      }

      console.log('   ✅ Validation passed');

      // Step 2: Update main branch
      console.log('📋 Step 2: Updating main branch...');
      execSync('git checkout main', { stdio: verbose ? 'inherit' : 'pipe' });

      try {
        execSync('git pull origin main', {
          stdio: verbose ? 'inherit' : 'pipe',
        });
        console.log('   ✅ Main branch updated');
      } catch (_error) {
        console.log(
          '   ⚠️  Could not pull from origin (may be offline or no remote)'
        );
      }

      // Step 3: Rebase feature branch on main
      console.log(`📋 Step 3: Rebasing ${branchToMerge} on main...`);
      execSync(`git checkout ${branchToMerge}`, {
        stdio: verbose ? 'inherit' : 'pipe',
      });

      try {
        execSync('git rebase main', { stdio: verbose ? 'inherit' : 'pipe' });
        console.log('   ✅ Rebase completed successfully');
      } catch (_error) {
        console.log('\n🚨 MERGE CONFLICTS DETECTED');
        console.log('   Please resolve conflicts manually:');
        console.log('   1. Edit conflicted files');
        console.log('   2. git add <resolved-files>');
        console.log('   3. git rebase --continue');
        console.log('   4. Re-run merge command when rebase is complete');
        console.log('\n   To abort rebase: git rebase --abort');
        throw new Error('Merge conflicts require manual resolution');
      }

      // Step 4: Perform merge
      console.log('📋 Step 4: Performing merge...');
      execSync('git checkout main', { stdio: verbose ? 'inherit' : 'pipe' });

      // Create automated merge commit message
      const mergeReqId = this.extractRequirementFromBranch(branchToMerge);
      const mergeMessage = mergeReqId
        ? `Merge ${branchToMerge} into main\n\nCompletes ${mergeReqId} implementation\nMerged via git-smart safe merge process`
        : `Merge ${branchToMerge} into main\n\nMerged via git-smart safe merge process`;

      execSync(`git merge --no-ff -m "${mergeMessage}" ${branchToMerge}`, {
        stdio: verbose ? 'inherit' : 'pipe',
      });
      console.log('   ✅ Merge completed successfully');

      // Step 5: Post-merge actions
      if (autoPush) {
        console.log('📋 Step 5: Pushing to remote...');
        try {
          execSync('git push origin main', {
            stdio: verbose ? 'inherit' : 'pipe',
          });
          console.log('   ✅ Pushed to remote');

          // Start automatic monitoring of CI/CD pipelines
          const shouldMonitor = !options.skipMonitoring && process.stdout.isTTY;
          if (shouldMonitor) {
            const GitHubActionsMonitor = require('./github-actions-monitor');
            const monitor = new GitHubActionsMonitor();

            console.log('');
            console.log(
              chalk.blue('🔍 Starting automatic CI/CD pipeline monitoring...')
            );
            console.log(
              chalk.yellow(
                '💡 Auto-monitoring: Will watch workflows and provide failure diagnosis'
              )
            );
            console.log(
              chalk.yellow(
                '💡 Skip with --skip-monitoring | Manual monitoring: sc monitor push-and-monitor'
              )
            );

            try {
              const result = await monitor.monitorAfterPush('main', 300000); // 5 min timeout

              if (!result.success) {
                console.log('');
                console.log(chalk.red('🚨 CI/CD monitoring detected issues'));
                console.log(
                  chalk.yellow('💡 Run "sc monitor" to check status manually')
                );
                console.log(
                  chalk.yellow(
                    '💡 Use "npm run test:ci" to simulate CI environment locally'
                  )
                );

                // Don't fail the merge, just warn
                return {
                  success: true,
                  branchMerged: branchToMerge,
                  requirement: reqId,
                  ciStatus: 'failed',
                  warning: 'CI/CD pipelines failed after merge',
                };
              } else {
                console.log(chalk.green('🎉 All CI/CD pipelines passed!'));
              }
            } catch (error) {
              console.log(
                chalk.yellow(`⚠️  CI/CD monitoring error: ${error.message}`)
              );
              console.log(chalk.yellow('💡 Check manually with: sc monitor'));
            }
          }
        } catch (_error) {
          console.log(
            '   ⚠️  Could not push to remote (may be offline or no remote)'
          );
        }

        // Push feature branch for audit trail
        try {
          execSync(`git push origin ${branchToMerge}`, {
            stdio: verbose ? 'inherit' : 'pipe',
          });
          console.log('   ✅ Feature branch backed up to remote');
        } catch (_error) {
          console.log('   ⚠️  Could not backup feature branch to remote');
        }
      }

      // Smart branch cleanup decision
      let shouldDeleteLocal;
      if (preserveLocal) {
        // User explicitly wants to preserve
        shouldDeleteLocal = false;
        if (verbose) {
          console.log(
            '📋 Step 6: Preserving local branch (--preserve-local)...'
          );
          console.log(
            '   ✅ Local feature branch preserved for continued development'
          );
        }
      } else {
        // Use smart logic (auto-decide or honor --delete-local)
        shouldDeleteLocal = this.shouldDeleteLocalBranch(
          branchToMerge,
          deleteLocal
        );
        if (shouldDeleteLocal) {
          console.log('📋 Step 6: Cleaning up local branch...');
          const reason = deleteLocal
            ? '--delete-local flag'
            : 'smart cleanup (REQ branch completed)';
          if (verbose) {
            console.log(`   Reason: ${reason}`);
          }
          try {
            execSync(`git branch -d ${branchToMerge}`, {
              stdio: verbose ? 'inherit' : 'pipe',
            });
            console.log('   ✅ Local feature branch deleted');
          } catch (_error) {
            console.log(
              '   ⚠️  Could not delete local branch (may have unmerged changes)'
            );
          }
        } else if (verbose) {
          console.log('📋 Step 6: Preserving local branch...');
          console.log('   ✅ Local feature branch preserved (smart decision)');
        }
      }

      // Update requirement status if applicable
      const statusReqId = this.extractRequirementFromBranch(branchToMerge);
      if (statusReqId) {
        console.log('\n📋 Updating requirement status...');
        try {
          execSync(
            `sc req update ${statusReqId.replace('REQ-', '')} --status=implemented`,
            { stdio: verbose ? 'inherit' : 'pipe' }
          );
          console.log(`   ✅ ${statusReqId} marked as implemented`);
        } catch (_error) {
          console.log(
            `   ⚠️  Could not update ${statusReqId} status automatically`
          );
        }
      }

      console.log('\n🎉 MERGE COMPLETED SUCCESSFULLY');
      console.log(`   Feature: ${branchToMerge}`);
      console.log(`   Target: main`);
      if (statusReqId) {
        console.log(`   Requirement: ${statusReqId} → implemented`);
      }

      // Quick CI/CD status check if configured
      try {
        const DevelopmentMonitor = require('../development/monitor');
        const monitor = new DevelopmentMonitor();
        await monitor.integrationCheck();
      } catch (_error) {
        // Silently ignore if monitor is not available
      }

      // Restore original git editor setting
      if (originalGitEditor) {
        process.env.GIT_EDITOR = originalGitEditor;
      } else {
        delete process.env.GIT_EDITOR;
      }

      return {
        success: true,
        branchMerged: branchToMerge,
        requirement: statusReqId,
      };
    } catch (error) {
      console.log('\n❌ MERGE FAILED');
      console.log(`   Error: ${error.message}`);
      console.log('\n🔧 Recovery options:');
      console.log('   - Fix issues and retry merge');
      console.log(
        '   - git checkout main && git reset --hard HEAD~1 (if merge was completed but failed post-processing)'
      );
      console.log('   - git rebase --abort (if stuck in rebase)');

      // Get current branch safely for error reporting
      let errorBranch = featureBranch;
      try {
        errorBranch = featureBranch || this.getCurrentBranch();
      } catch (_branchError) {
        errorBranch = featureBranch || 'unknown';
      }

      // Restore original git editor setting even on error
      if (originalGitEditor) {
        process.env.GIT_EDITOR = originalGitEditor;
      } else {
        delete process.env.GIT_EDITOR;
      }

      return {
        success: false,
        error: error.message,
        branchAttempted: errorBranch,
      };
    }
  }

  // Sub-repository management
  async findSubRepos() {
    const subRepos = [];
    
    try {
      // Find all .git directories, excluding node_modules
      const result = execSync(
        'find . -name ".git" -type d 2>/dev/null | grep -v node_modules || true',
        { encoding: 'utf8', cwd: this.projectRoot }
      ).trim();
      
      if (!result) return subRepos;
      
      const gitDirs = result.split('\n').filter(d => d && d !== './.git');
      
      for (const gitDir of gitDirs) {
        const repoDir = path.dirname(gitDir);
        const fullPath = path.join(this.projectRoot, repoDir);
        
        try {
          // Get branch and sync status
          const branch = execSync('git branch --show-current', {
            encoding: 'utf8',
            cwd: fullPath
          }).trim();
          
          let ahead = 0;
          let behind = 0;
          let hasUpstream = false;
          
          try {
            ahead = parseInt(
              execSync('git rev-list --count @{u}..HEAD', {
                encoding: 'utf8',
                cwd: fullPath
              }).trim(),
              10
            );
            behind = parseInt(
              execSync('git rev-list --count HEAD..@{u}', {
                encoding: 'utf8',
                cwd: fullPath
              }).trim(),
              10
            );
            hasUpstream = true;
          } catch (_e) {
            // No upstream configured
          }
          
          // Check for uncommitted changes
          const status = execSync('git status --porcelain', {
            encoding: 'utf8',
            cwd: fullPath
          }).trim();
          
          subRepos.push({
            path: repoDir,
            fullPath,
            branch,
            ahead,
            behind,
            hasUpstream,
            hasChanges: status.length > 0,
            changeCount: status ? status.split('\n').filter(l => l).length : 0
          });
        } catch (_error) {
          // Skip repos that can't be analyzed
        }
      }
    } catch (_error) {
      // find command failed
    }
    
    return subRepos;
  }

  async showSubRepoStatus(options = {}) {
    const { verbose = true } = options;
    const subRepos = await this.findSubRepos();
    
    if (subRepos.length === 0) {
      if (verbose) {
        console.log(chalk.green('✅ No sub-repositories found'));
      }
      return { subRepos: [], allSynced: true };
    }
    
    if (verbose) {
      console.log(chalk.blue('\n📦 Sub-Repository Status Report:'));
      console.log(`   Found ${subRepos.length} sub-repositories\n`);
    }
    
    let allSynced = true;
    const unsynced = [];
    
    for (const repo of subRepos) {
      const issues = [];
      
      if (repo.ahead > 0) {
        issues.push(`${repo.ahead} commits ahead`);
        allSynced = false;
      }
      if (repo.behind > 0) {
        issues.push(`${repo.behind} commits behind`);
      }
      if (repo.hasChanges) {
        issues.push(`${repo.changeCount} uncommitted changes`);
        allSynced = false;
      }
      if (!repo.hasUpstream) {
        issues.push('no upstream configured');
      }
      
      if (issues.length > 0) {
        unsynced.push(repo);
      }
      
      if (verbose) {
        const statusIcon = issues.length === 0 ? chalk.green('✅') : chalk.yellow('⚠️');
        console.log(`   ${statusIcon} ${chalk.cyan(repo.path)}`);
        console.log(`      Branch: ${repo.branch}`);
        if (issues.length > 0) {
          console.log(`      Issues: ${chalk.yellow(issues.join(', '))}`);
        }
      }
    }
    
    if (verbose) {
      console.log('');
      if (allSynced) {
        console.log(chalk.green('✅ All sub-repositories are synced'));
      } else {
        console.log(chalk.yellow(`⚠️  ${unsynced.length} sub-repositories need attention`));
        console.log(chalk.cyan('💡 Run: sc git-smart sync-push    # Auto-sync all'));
      }
    }
    
    return { subRepos, allSynced, unsynced };
  }

  async syncPushSubRepos(options = {}) {
    const { dryRun = false, verbose = true, commitFirst = false } = options;
    
    if (verbose) {
      console.log(chalk.blue('\n🔄 SYNC-PUSH: Syncing all sub-repositories\n'));
    }
    
    const subRepos = await this.findSubRepos();
    
    if (subRepos.length === 0) {
      if (verbose) {
        console.log(chalk.green('✅ No sub-repositories found - nothing to sync'));
      }
      return { success: true, synced: [], failed: [] };
    }
    
    const synced = [];
    const failed = [];
    const skipped = [];
    
    for (const repo of subRepos) {
      if (verbose) {
        console.log(chalk.cyan(`\n📦 Processing: ${repo.path}`));
        console.log(`   Branch: ${repo.branch}`);
      }
      
      // Check if needs syncing
      if (repo.ahead === 0 && !repo.hasChanges) {
        if (verbose) {
          console.log(chalk.green('   ✅ Already synced'));
        }
        skipped.push(repo);
        continue;
      }
      
      if (!repo.hasUpstream) {
        if (verbose) {
          console.log(chalk.yellow('   ⚠️  No upstream configured - skipping'));
        }
        skipped.push(repo);
        continue;
      }
      
      try {
        // Handle uncommitted changes if requested
        if (repo.hasChanges && commitFirst) {
          if (dryRun) {
            console.log(chalk.cyan(`   [DRY RUN] Would commit ${repo.changeCount} changes`));
          } else {
            if (verbose) {
              console.log(`   📝 Committing ${repo.changeCount} changes...`);
            }
            execSync('git add -A', { cwd: repo.fullPath, stdio: 'pipe' });
            // Use agent signing for SC-initiated commits with [SC] tag
            const signingManager = new SigningManager(repo.fullPath);
            const signingFlags = signingManager.getSigningFlags({ isAgentCommit: true });
            execSync(`git commit ${signingFlags} -m "[SC] chore: auto-commit before sync-push"`, {
              cwd: repo.fullPath,
              stdio: 'pipe'
            });
          }
        } else if (repo.hasChanges) {
          if (verbose) {
            console.log(chalk.yellow(`   ⚠️  Has uncommitted changes - commit first or use --commit`));
          }
          failed.push({ ...repo, error: 'uncommitted changes' });
          continue;
        }
        
        // Pull first to avoid conflicts
        if (repo.behind > 0) {
          if (dryRun) {
            console.log(chalk.cyan(`   [DRY RUN] Would pull ${repo.behind} commits`));
          } else {
            if (verbose) {
              console.log(`   ⬇️  Pulling ${repo.behind} commits...`);
            }
            execSync('git pull --rebase', { cwd: repo.fullPath, stdio: 'pipe' });
          }
        }
        
        // Push
        if (repo.ahead > 0 || (commitFirst && repo.hasChanges)) {
          if (dryRun) {
            console.log(chalk.cyan(`   [DRY RUN] Would push ${repo.ahead} commits`));
          } else {
            if (verbose) {
              console.log(`   ⬆️  Pushing to origin/${repo.branch}...`);
            }
            execSync(`git push origin ${repo.branch}`, {
              cwd: repo.fullPath,
              stdio: 'pipe'
            });
            if (verbose) {
              console.log(chalk.green('   ✅ Pushed successfully'));
            }
          }
        }
        
        synced.push(repo);
      } catch (error) {
        if (verbose) {
          console.log(chalk.red(`   ❌ Failed: ${error.message}`));
        }
        failed.push({ ...repo, error: error.message });
      }
    }
    
    // Summary
    if (verbose) {
      console.log(chalk.blue('\n📊 Sync Summary:'));
      console.log(`   ✅ Synced: ${synced.length}`);
      console.log(`   ⏭️  Skipped: ${skipped.length}`);
      console.log(`   ❌ Failed: ${failed.length}`);
      
      if (failed.length > 0) {
        console.log(chalk.yellow('\n⚠️  Failed repositories:'));
        failed.forEach(r => {
          console.log(`   - ${r.path}: ${r.error}`);
        });
      }
    }
    
    return {
      success: failed.length === 0,
      synced,
      skipped,
      failed
    };
  }

  // Comprehensive deployment functionality
  async performDeployment(options = {}) {
    const {
      tagVersion,
      pushTags = true,
      runTests = true,
      runLint = true,
      verbose = true,
    } = options;

    if (verbose) {
      console.log('\n🚀 INITIATING COMPREHENSIVE DEPLOYMENT');
      console.log('='.repeat(50));
    }

    try {
      // Step 1: Pre-deployment validation
      if (verbose) console.log('\n📋 Step 1: Pre-deployment validation...');

      const currentBranch = this.getCurrentBranch();
      if (currentBranch !== 'main' && currentBranch !== 'master') {
        return {
          success: false,
          error: `Deployment must be done from main/master branch. Currently on: ${currentBranch}`,
        };
      }

      // Check for uncommitted changes
      const hasUncommitted =
        execSync('git status --porcelain', { encoding: 'utf8' }).trim().length >
        0;
      if (hasUncommitted) {
        return {
          success: false,
          error:
            'Uncommitted changes detected. Please commit or stash changes before deployment.',
        };
      }

      if (verbose) console.log('   ✅ Pre-deployment validation passed');

      // Step 2: Run tests if requested
      if (runTests) {
        if (verbose) console.log('\n🧪 Step 2: Running test suite...');

        try {
          execSync('npm test', { stdio: verbose ? 'inherit' : 'pipe' });
          if (verbose) console.log('   ✅ All tests passed');
        } catch (error) {
          return {
            success: false,
            error: 'Tests failed. Deployment aborted.',
            details: error.message,
          };
        }
      } else if (verbose) {
        console.log('\n⚠️  Step 2: Tests skipped (--skip-tests)');
      }

      // Step 3: Run linting if requested
      if (runLint) {
        if (verbose) console.log('\n🔍 Step 3: Running code linting...');

        try {
          execSync('npm run lint', { stdio: verbose ? 'inherit' : 'pipe' });
          if (verbose) console.log('   ✅ Linting passed');
        } catch (error) {
          return {
            success: false,
            error: 'Linting failed. Deployment aborted.',
            details: error.message,
          };
        }
      } else if (verbose) {
        console.log('\n⚠️  Step 3: Linting skipped (--skip-lint)');
      }

      // Step 4: Version tagging
      let actualTagVersion = tagVersion;
      if (!actualTagVersion) {
        // Auto-increment version from package.json
        try {
          const packageJson = JSON.parse(
            fs.readFileSync('package.json', 'utf8')
          );
          const currentVersion = packageJson.version;
          const versionParts = currentVersion.split('.');
          versionParts[2] = (parseInt(versionParts[2], 10) + 1).toString();
          actualTagVersion = versionParts.join('.');

          // Update package.json
          packageJson.version = actualTagVersion;
          fs.writeFileSync(
            'package.json',
            JSON.stringify(packageJson, null, 2)
          );

          if (verbose)
            console.log(
              `\n📦 Step 4: Auto-incremented version to ${actualTagVersion}`
            );
        } catch (error) {
          return {
            success: false,
            error: 'Failed to read/update package.json for version increment.',
            details: error.message,
          };
        }
      } else if (verbose) {
        console.log(`\n📦 Step 4: Using specified version ${actualTagVersion}`);
      }

      // Create git tag
      const tagName = `v${actualTagVersion}`;
      try {
        // Check if tag already exists
        try {
          execSync(`git rev-parse ${tagName}`, { stdio: 'pipe' });
          return {
            success: false,
            error: `Tag ${tagName} already exists. Use a different version.`,
          };
        } catch (_tagCheckError) {
          // Tag doesn't exist, which is what we want
        }

        // Commit version update if we modified package.json
        if (!tagVersion) {
          execSync(`git add package.json`, {
            stdio: verbose ? 'inherit' : 'pipe',
          });
          execSync(
            `git commit -m "chore: bump version to ${actualTagVersion}"`,
            { stdio: verbose ? 'inherit' : 'pipe' }
          );
        }

        // Create the tag
        execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, {
          stdio: verbose ? 'inherit' : 'pipe',
        });
        if (verbose) console.log(`   ✅ Created tag ${tagName}`);
      } catch (error) {
        return {
          success: false,
          error: `Failed to create git tag ${tagName}`,
          details: error.message,
        };
      }

      // Step 5: Push to remote
      if (verbose) console.log('\n🌍 Step 5: Pushing to remote...');

      try {
        execSync('git push origin main', {
          stdio: verbose ? 'inherit' : 'pipe',
        });
        if (verbose) console.log('   ✅ Pushed main branch');

        if (pushTags) {
          execSync(`git push origin ${tagName}`, {
            stdio: verbose ? 'inherit' : 'pipe',
          });
          if (verbose) console.log(`   ✅ Pushed tag ${tagName}`);
        }
      } catch (error) {
        return {
          success: false,
          error: 'Failed to push to remote',
          details: error.message,
        };
      }

      // Step 6: Show status with monitoring check
      if (verbose) {
        console.log('\n📊 Step 6: Post-deployment status...');

        // Quick CI/CD status check if monitoring is available
        try {
          const DevelopmentMonitor = require('../development/monitor');
          const monitor = new DevelopmentMonitor();
          await monitor.integrationCheck();
        } catch (_error) {
          // Silently ignore if monitor is not available
        }
      }

      if (verbose) {
        console.log('\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY');
        console.log(`   Version: ${actualTagVersion}`);
        console.log(`   Tag: ${tagName}`);
        console.log(`   Branch: ${currentBranch}`);
      }

      return {
        success: true,
        version: actualTagVersion,
        tag: tagName,
        branch: currentBranch,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Deployment failed with unexpected error',
        details: error.message,
      };
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const gitSmart = new GitSmart();

  try {
    switch (command) {
      case 'status':
      case undefined:
        gitSmart.showStatus();
        break;

      case 'branch': {
        const reqId = args[1];
        if (!reqId) {
          console.error('❌ Usage: git-smart branch REQ-XXX');
          process.exit(1);
        }
        gitSmart.createBranch(reqId.toUpperCase());
        break;
      }

      case 'suggest': {
        const currentStatus = gitSmart.getCurrentStatus();
        if (currentStatus.requirement) {
          console.log(
            `💡 Current branch follows convention: ${currentStatus.branch}`
          );
        } else {
          console.log('💡 Suggested branch naming:');
          console.log('   feature/req-XXX-description');
          console.log('   hotfix/issue-description');
          console.log('   docs/update-description');
        }
        break;
      }

      case 'check-context': {
        const detectedReqs = gitSmart.detectRecentWork();
        const contextCheck = gitSmart.checkWorkContext(detectedReqs);

        console.log('\n🔍 WORK CONTEXT CHECK\n');
        console.log(`📋 Current Branch: ${gitSmart.getCurrentBranch()}`);
        console.log(
          `🔄 Recent Work Detected: ${detectedReqs.length ? detectedReqs.join(', ') : 'None'}`
        );

        if (contextCheck.status === 'error') {
          if (contextCheck.mixedWork) {
            console.log(`\n🚨 CRITICAL: ${contextCheck.message}`);
            console.log(`📊 Active Areas: ${contextCheck.areas.join(', ')}`);
            console.log(`💡 RECOMMENDATION: ${contextCheck.suggestion}`);
            console.log('\n🚀 Remediation Steps:');
            console.log(
              `   1. git stash                                    # Save current work`
            );
            console.log(
              `   2. git checkout -b feature/req-026-029-dashboard-system  # Create dashboard branch`
            );
            console.log(
              `   3. git stash pop                               # Apply dashboard work`
            );
            console.log(
              `   4. git commit -m "feat(req-026-029): Dashboard system"`
            );
            console.log(
              `   5. git checkout feature/repository-initialization-strategy  # Return to original work`
            );
            console.log(
              '\n⚠️  This is exactly the pattern that should have been caught!'
            );
          } else {
            console.log(`\n❌ ${contextCheck.message}`);
            console.log(`💡 SUGGESTION: ${contextCheck.suggestion}`);
            console.log('\n🚀 Quick Fix:');
            console.log(`   git stash`);
            console.log(
              `   git checkout -b ${contextCheck.suggestion.split(': ')[1]}`
            );
            console.log(`   git stash pop`);
          }
        } else if (contextCheck.status === 'warning') {
          console.log(`\n⚠️  ${contextCheck.message}`);
          console.log(`💡 SUGGESTION: ${contextCheck.suggestion}`);
        } else {
          console.log(`\n✅ ${contextCheck.message}`);
        }
        break;
      }

      case 'check-branch': {
        const branchCheck = gitSmart.checkBranchCompliance({ verbose: true });

        if (!branchCheck.valid) {
          console.log('\n🚨 BRANCH COMPLIANCE ISSUES:');
          branchCheck.issues.forEach((issue) => {
            console.log(`❌ ${issue.message}`);
            console.log(`💡 ${issue.suggestion}`);
          });
          process.exit(1);
        } else {
          console.log('\n✅ Branch compliance: PASSED');
          console.log('Safe to continue development work!');
        }
        break;
      }

      case 'merge': {
        const featureBranch = args[1];
        const autoPush =
          args.includes('--push') || args.includes('--auto-push');
        const forceDeleteLocal = args.includes('--delete-local');
        const forcePreserveLocal = args.includes('--preserve-local');
        const quiet = args.includes('--quiet');
        const skipMonitoring = args.includes('--skip-monitoring');

        console.log('🔄 Initiating safe merge process...');
        if (featureBranch) {
          console.log(`   Target branch: ${featureBranch}`);
        } else {
          console.log('   Using current branch');
        }

        const mergeResult = await gitSmart.performSafeMerge(featureBranch, {
          autoPush,
          deleteLocal: forceDeleteLocal,
          preserveLocal: forcePreserveLocal,
          verbose: !quiet,
          skipMonitoring,
        });

        if (!mergeResult.success) {
          process.exit(1);
        }
        break;
      }

      case 'list-branches':
      case 'branch-status':
        await gitSmart.listBranchStatus();
        break;

      case 'cleanup-branches': {
        const dryRun = args.includes('--dry-run');
        const noPush = args.includes('--no-push');
        const cleanupResult = await gitSmart.cleanupMergedBranches({
          dryRun,
          pushFirst: !noPush,
        });

        if (!cleanupResult.success) {
          process.exit(1);
        }
        break;
      }

      case 'monitor': {
        const GitHubActionsMonitor = require('./github-actions-monitor');
        const monitor = new GitHubActionsMonitor();
        const monitorBranch = args[1] || 'main';
        const showStatus = args.includes('--status') || args[1] === 'status';
        const runDiagnose =
          args.includes('--diagnose') || args[1] === 'diagnose';

        if (showStatus) {
          await monitor.quickStatus(monitorBranch);
        } else if (runDiagnose) {
          await monitor.diagnoseIssues(monitorBranch);
        } else {
          console.log(chalk.blue('🔍 Starting CI/CD pipeline monitoring...'));
          console.log(chalk.yellow('💡 Press Ctrl+C to stop monitoring'));
          console.log(
            chalk.yellow(
              '💡 Use "sc git-smart monitor diagnose" for immediate error analysis'
            )
          );
          console.log('');
          await monitor.monitorAfterPush(monitorBranch, 600000); // 10 min timeout
        }
        break;
      }

      case 'feedback': {
        // Smart feedback and suggestions
        const feedbackSystem = new GitFeedback();
        const subCommand = args[1] || 'status';

        if (subCommand === 'suggest') {
          const suggestions = await feedbackSystem.getSmartSuggestions();
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
        } else {
          await feedbackSystem.getComprehensiveFeedback();
        }
        break;
      }

      case 'push': {
        // Smart push with automatic CI/CD monitoring
        const pushBranch = gitSmart.getCurrentBranch();
        const skipAutoMonitor = args.includes('--skip-monitoring');

        console.log(chalk.blue('🚀 Smart Push with Auto-Monitoring'));
        console.log(`   Branch: ${pushBranch}`);

        try {
          // Push to remote
          execSync(`git push origin ${pushBranch}`, { stdio: 'inherit' });
          console.log(chalk.green('✅ Successfully pushed to remote'));

          // Auto-monitor unless skipped
          if (!skipAutoMonitor && process.stdout.isTTY) {
            const GitHubActionsMonitor = require('./github-actions-monitor');
            const monitor = new GitHubActionsMonitor();

            console.log('');
            console.log(
              chalk.blue('🔍 Starting automatic workflow monitoring...')
            );
            console.log(
              chalk.yellow(
                '💡 Will watch for CI/CD results and diagnose any failures'
              )
            );
            console.log(chalk.yellow('💡 Skip with --skip-monitoring'));
            console.log('');

            try {
              const result = await monitor.monitorAfterPush(pushBranch, 300000); // 5 min timeout

              if (!result.success) {
                console.log('');
                console.log(chalk.red('🚨 CI/CD issues detected after push'));
                console.log(
                  chalk.yellow(
                    '💡 Run: sc monitor diagnose    # For detailed fixes'
                  )
                );
              } else {
                console.log(chalk.green('🎉 All workflows passed!'));
              }
            } catch (error) {
              console.log(
                chalk.yellow(`⚠️  Monitoring error: ${error.message}`)
              );
              console.log(
                chalk.yellow('💡 Check manually with: sc monitor ci')
              );
            }
          } else if (skipAutoMonitor) {
            console.log(chalk.yellow('⚠️  Auto-monitoring skipped'));
            console.log(chalk.yellow('💡 Check CI/CD manually: sc monitor ci'));
          }
        } catch (error) {
          console.log(chalk.red(`❌ Push failed: ${error.message}`));
          process.exit(1);
        }
        break;
      }

      case 'deploy': {
        // Comprehensive deployment with tests and tagging
        const tagVersion = args
          .find((arg) => arg.startsWith('--tag='))
          ?.split('=')[1];
        const skipTests = args.includes('--skip-tests');
        const skipLint = args.includes('--skip-lint');
        const noPushTags = args.includes('--no-push-tags');
        const deployQuiet = args.includes('--quiet');

        const deployResult = await gitSmart.performDeployment({
          tagVersion,
          pushTags: !noPushTags,
          runTests: !skipTests,
          runLint: !skipLint,
          verbose: !deployQuiet,
        });

        if (!deployResult.success) {
          process.exit(1);
        }
        break;
      }

      case 'subrepo-status':
      case 'subrepos': {
        // Show status of all sub-repositories
        await gitSmart.showSubRepoStatus({ verbose: true });
        break;
      }

      case 'sync-push': {
        // Sync and push all sub-repositories
        const syncDryRun = args.includes('--dry-run');
        const syncCommit = args.includes('--commit');
        const syncQuiet = args.includes('--quiet');
        const pushParent = args.includes('--push-parent');

        const syncResult = await gitSmart.syncPushSubRepos({
          dryRun: syncDryRun,
          commitFirst: syncCommit,
          verbose: !syncQuiet,
        });

        if (syncResult.success && pushParent) {
          // Also push the parent repo
          console.log(chalk.blue('\n🚀 Pushing parent repository...'));
          try {
            const parentBranch = gitSmart.getCurrentBranch();
            execSync(`git push origin ${parentBranch}`, { stdio: 'inherit' });
            console.log(chalk.green('✅ Parent repository pushed'));
          } catch (error) {
            console.log(chalk.red(`❌ Failed to push parent: ${error.message}`));
            process.exit(1);
          }
        }

        if (!syncResult.success) {
          process.exit(1);
        }
        break;
      }

      default:
        console.log('\n🚀 Supernal Coding Git Smart Commands:');
        console.log('');
        console.log(
          '   git-smart status                      🔍 Comprehensive Git & CI/CD status with feedback'
        );
        console.log(
          '   git-smart feedback [suggest]          💡 Intelligent suggestions based on current state'
        );
        console.log(
          '   git-smart branch REQ-XXX              Create feature branch for requirement'
        );
        console.log(
          '   git-smart merge [branch]              Safe merge with rebase and validation'
        );
        console.log(
          '   git-smart push                        🚀 Smart push with auto CI/CD monitoring'
        );
        console.log(
          '   git-smart deploy [--tag=X.Y.Z]       Comprehensive deployment with tests and tagging'
        );
        console.log(
          '   git-smart check-branch                Validate branch compliance (no main/master)'
        );
        console.log(
          '   git-smart check-context               Check if current work matches branch'
        );
        console.log(
          '   git-smart suggest                     Get branch naming suggestions'
        );
        console.log('');
        console.log('Deployment Options:');
        console.log(
          '   --tag=X.Y.Z                          Use specific version (auto-increment if not provided)'
        );
        console.log(
          '   --skip-tests                         Skip test validation'
        );
        console.log(
          '   --skip-lint                          Skip code linting'
        );
        console.log(
          "   --no-push-tags                       Create tag locally but don't push to remote"
        );
        console.log('');
        console.log('Branch Management:');
        console.log(
          '   git-smart list-branches               Show status of all branches'
        );
        console.log(
          '   git-smart cleanup-branches            Clean up merged branches (push first, then delete)'
        );
        console.log('');
        console.log('Merge Options:');
        console.log(
          '   --push, --auto-push                   Push to remote after successful merge'
        );
        console.log(
          '   --delete-local                        Force delete local branch after merge'
        );
        console.log(
          '   --preserve-local                      Force preserve local branch after merge'
        );
        console.log(
          '   --quiet                               Minimize output during merge process'
        );
        console.log('');
        console.log('Smart Branch Cleanup (automatic):');
        console.log(
          '   • REQ-XXX branches: Always deleted (temporary requirement work)'
        );
        console.log(
          '   • Regular branches: Preserved if unmerged commits or no remote backup'
        );
        console.log(
          '   • Use --delete-local or --preserve-local to override smart decisions'
        );
        console.log('');
        console.log('Cleanup Options:');
        console.log(
          '   --dry-run                             Show what would be cleaned without doing it'
        );
        console.log(
          '   --no-push                             Skip pushing branches to remote before deletion'
        );
        console.log('');
        console.log('Sub-Repository Management:');
        console.log(
          '   git-smart subrepos                    📦 Show status of all nested git repos'
        );
        console.log(
          '   git-smart sync-push                   🔄 Sync and push all sub-repositories'
        );
        console.log('');
        console.log('Sync-Push Options:');
        console.log(
          '   --dry-run                             Show what would be synced without doing it'
        );
        console.log(
          '   --commit                              Auto-commit uncommitted changes before push'
        );
        console.log(
          '   --push-parent                         Also push the parent repo after sub-repos'
        );
        console.log(
          '   --quiet                               Minimize output'
        );
        console.log('');
        console.log('Examples:');
        console.log('   git-smart status');
        console.log('   git-smart branch REQ-024');
        console.log('   git-smart merge feature/req-043-security');
        console.log('   git-smart merge --auto-push --delete-local');
        console.log('   git-smart list-branches');
        console.log('   git-smart cleanup-branches --dry-run');
        console.log('   git-smart cleanup-branches');
        console.log('   git-smart check-branch');
        console.log('   git-smart check-context');
        console.log('   git-smart subrepos                    # Check nested repo status');
        console.log('   git-smart sync-push --dry-run         # Preview sub-repo sync');
        console.log('   git-smart sync-push --push-parent     # Sync all and push parent');
        console.log('');
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// CLI interface function for command registry
async function cliMain(args) {
  // Handle both array and string args
  const command = Array.isArray(args) ? args[0] : args;
  const gitSmart = new GitSmart();

  try {
    switch (command) {
      case 'cleanup-branches': {
        const options = {
          dryRun: args.includes('--dry-run'),
          verbose: !args.includes('--quiet'),
          pushFirst: !args.includes('--no-push'),
        };
        await gitSmart.cleanupMergedBranches(options);
        break;
      }
      case 'status':
      case undefined:
        gitSmart.showStatus();
        break;
      default:
        // Call the original main function for other commands
        process.argv = ['node', 'git-smart', ...args];
        await main();
        break;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = GitSmart;
module.exports.cliMain = cliMain;
