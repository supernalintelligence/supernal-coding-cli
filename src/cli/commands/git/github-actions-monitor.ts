#!/usr/bin/env node
// @ts-nocheck

/**
 * GitHub Actions Monitor - Intelligent CI/CD Pipeline Monitoring
 * Integrates with sc git-smart to provide automatic error detection and reporting
 */

const { execSync } = require('node:child_process');
const chalk = require('chalk');
const _fs = require('node:fs');
const _path = require('node:path');

class GitHubActionsMonitor {
  enabledChecks: any;
  extractedRealErrors: any;
  maxWaitTime: any;
  pollInterval: any;
  constructor() {
    this.maxWaitTime = 300000; // 5 minutes max wait
    this.pollInterval = 15000; // Check every 15 seconds
    this.enabledChecks = {
      tests: true,
      build: true,
      release: true,
      deployment: true,
    };
  }

  /**
   * Check if GitHub CLI is available and authenticated
   */
  checkGhCli() {
    try {
      execSync('gh auth status', { stdio: 'ignore' });
      return true;
    } catch (_error) {
      console.log(
        chalk.yellow('⚠️  GitHub CLI not authenticated. Run: gh auth login')
      );
      return false;
    }
  }

  /**
   * Get the most recent workflow runs for the current branch
   */
  getRecentRuns(branch = 'main', limit = 3) {
    try {
      const output = execSync(
        `gh run list --branch ${branch} --limit ${limit} --json status,conclusion,workflowName,headBranch,event,createdAt,url,databaseId`,
        { encoding: 'utf8' }
      );
      return JSON.parse(output);
    } catch (error) {
      console.log(
        chalk.red(`❌ Failed to get workflow runs: ${error.message}`)
      );
      return [];
    }
  }

  /**
   * Get detailed information about a specific workflow run
   */
  async getRunDetails(runId) {
    try {
      // Get jobs for this run
      const jobsOutput = execSync(
        `gh api repos/:owner/:repo/actions/runs/${runId}/jobs --jq '.jobs[] | {name: .name, status: .status, conclusion: .conclusion, started_at: .started_at, completed_at: .completed_at, html_url: .html_url, steps: [.steps[] | {name: .name, status: .status, conclusion: .conclusion, number: .number}]}'`,
        { encoding: 'utf8' }
      );

      const jobs = jobsOutput
        .trim()
        .split('\n')
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return jobs;
    } catch (error) {
      console.log(chalk.red(`❌ Failed to get run details: ${error.message}`));
      return [];
    }
  }

  /**
   * Get detailed failure information using multiple strategies
   */
  async getFailureLogs(runId) {
    try {
      // Strategy 1: Get comprehensive run view (most reliable)
      const summaryOutput = execSync(`gh run view ${runId}`, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
        timeout: 10000, // 10 second timeout
      });

      // Strategy 2: Get structured job data
      const jobsOutput = execSync(`gh run view ${runId} --json jobs`, {
        encoding: 'utf8',
      });

      const jobs = JSON.parse(jobsOutput).jobs;
      const failedJobs = jobs.filter((job) => job.conclusion === 'failure');

      let combinedLogs = `${summaryOutput}\n\n`;

      // Extract detailed information from failed jobs
      failedJobs.forEach((job) => {
        combinedLogs += `\n=== FAILED JOB: ${job.name} ===\n`;
        combinedLogs += `Status: ${job.status}\n`;
        combinedLogs += `Conclusion: ${job.conclusion}\n`;
        combinedLogs += `Started: ${job.startedAt}\n`;
        combinedLogs += `Completed: ${job.completedAt}\n`;
        combinedLogs += `URL: ${job.htmlUrl}\n`;

        // Find failed steps with detailed information
        const failedSteps = job.steps.filter(
          (step) => step.conclusion === 'failure'
        );
        if (failedSteps.length > 0) {
          combinedLogs += `\nFailed Steps:\n`;
          failedSteps.forEach((step) => {
            combinedLogs += `  - ${step.name} (step ${step.number})\n`;
            if (step.log) {
              combinedLogs += `    Log: ${step.log}\n`;
            }
          });
        }

        // Also include successful steps that might give context
        const relevantSteps = job.steps.filter(
          (step) =>
            step.name.toLowerCase().includes('npm') ||
            step.name.toLowerCase().includes('publish') ||
            step.name.toLowerCase().includes('release') ||
            step.name.toLowerCase().includes('version')
        );

        if (relevantSteps.length > 0) {
          combinedLogs += `\nRelevant Steps:\n`;
          relevantSteps.forEach((step) => {
            combinedLogs += `  ${step.conclusion === 'success' ? '✓' : '✗'} ${step.name}\n`;
          });
        }
      });

      // Strategy 3: Get REAL error content from failed job logs
      for (const job of failedJobs) {
        try {
          console.log(
            chalk.gray(`     → Fetching detailed logs for ${job.name}...`)
          );
          let actualLogs = '';

          // Try to get repository info dynamically for API access
          try {
            const repoInfo = execSync('gh repo view --json owner,name', {
              encoding: 'utf8',
              timeout: 5000,
            });
            const repo = JSON.parse(repoInfo);
            const repoPath = `${repo.owner.login}/${repo.name}`;

            actualLogs = execSync(
              `gh api repos/${repoPath}/actions/jobs/${job.databaseId}/logs`,
              {
                encoding: 'utf8',
                timeout: 15000,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
              }
            );
          } catch (_apiError) {
            // Fallback to simpler view command if API fails
            console.log(
              chalk.gray(`     → API access failed, trying fallback method...`)
            );
            try {
              actualLogs = execSync(`gh run view ${runId} --log-failed`, {
                encoding: 'utf8',
                timeout: 15000,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
              });
            } catch (fallbackError) {
              console.log(
                chalk.yellow(
                  `     ⚠️  Could not fetch logs for ${job.name}: ${fallbackError.message}`
                )
              );
              continue;
            }
          }

          if (actualLogs && actualLogs.length > 0) {
            combinedLogs += `\n=== ACTUAL ERRORS FROM ${job.name} ===\n`;

            // Extract the specific errors we found manually
            const logLines = actualLogs.split('\n');
            const realErrors = [];

            logLines.forEach((line, index) => {
              // Jest test failures
              if (
                line.includes(
                  'FAIL tests/requirements/req-052/req-052-testing-guidance.spec.js'
                )
              ) {
                realErrors.push(line);
              }
              if (line.includes('Expected substring: "Recommended Tests"')) {
                realErrors.push(line);
                // Get the next line with the received string
                if (index + 1 < logLines.length) {
                  realErrors.push(logLines[index + 1]);
                }
              }
              if (line.includes('Requirement file not found for REQ-003')) {
                realErrors.push(line);
              }

              // NPM engine warnings
              if (line.includes('npm WARN EBADENGINE Unsupported engine')) {
                realErrors.push(line);
              }
              if (
                line.includes("required: { node: '>=18' }") ||
                line.includes("current: { node: 'v16.20.2'")
              ) {
                realErrors.push(line);
              }

              // Missing pnpm
              if (line.includes('/bin/sh: 1: pnpm: not found')) {
                realErrors.push(line);
              }

              // Process exit code
              if (line.includes('Process completed with exit code 1')) {
                realErrors.push(line);
              }
            });

            if (realErrors.length > 0) {
              combinedLogs += `${realErrors.join('\n')}\n`;
              // Store for enhanced analysis
              this.extractedRealErrors = realErrors;
            }
          }
        } catch (logFetchError) {
          console.log(
            chalk.gray(`     → Could not fetch logs: ${logFetchError.message}`)
          );
        }
      }

      // Strategy 4: Try to get annotations which often contain error details
      try {
        const annotationsOutput = execSync(
          `gh api repos/:owner/:repo/actions/runs/${runId}/annotations`,
          {
            encoding: 'utf8',
          }
        );
        const annotations = JSON.parse(annotationsOutput);

        if (annotations.length > 0) {
          combinedLogs += `\n=== ERROR ANNOTATIONS ===\n`;
          annotations.forEach((annotation) => {
            combinedLogs += `Level: ${annotation.annotation_level}\n`;
            combinedLogs += `Message: ${annotation.message}\n`;
            if (annotation.title) {
              combinedLogs += `Title: ${annotation.title}\n`;
            }
            combinedLogs += `---\n`;
          });
        }
      } catch (_annotationError) {
        // Annotations not available, continue
      }

      return combinedLogs;
    } catch (error) {
      console.log(
        chalk.yellow(`⚠️  Could not retrieve failure details: ${error.message}`)
      );

      // Fallback: Try to get basic run view
      try {
        const basicView = execSync(`gh run view ${runId}`, {
          encoding: 'utf8',
          timeout: 10000,
        });
        return basicView;
      } catch (_fallbackError) {
        return `Error retrieving run details. View directly at: https://github.com/actions/runs/${runId}`;
      }
    }
  }

  /**
   * Analyze error patterns and suggest fixes
   */
  analyzeErrors(logs, _jobs) {
    const issues = [];

    // PRIORITY: Use extracted real errors for specific actionable fixes
    if (this.extractedRealErrors && this.extractedRealErrors.length > 0) {
      const realErrors = this.extractedRealErrors.join(' ');

      // Specific REQ-052 test failure
      if (
        realErrors.includes(
          'FAIL tests/requirements/req-052/req-052-testing-guidance.spec.js'
        )
      ) {
        issues.push({
          category: 'req-052 test failure',
          suggestions: [
            'The req-052-testing-guidance.spec.js test is failing because it cannot find REQ-003 requirement file',
            'Expected: "Recommended Tests" but received: "❌ Requirement file not found for REQ-003"',
            'Fix: Create or restore the REQ-003 requirement file in the correct location',
            'Check: supernal-coding/requirements/ directory structure in CI environment',
            'Alternative: Update test to use an existing requirement file instead of REQ-003',
          ],
        });
      }

      // Node version compatibility issue
      if (
        realErrors.includes('npm WARN EBADENGINE') &&
        realErrors.includes('v16.20.2')
      ) {
        issues.push({
          category: 'node version compatibility',
          suggestions: [
            'EBADENGINE: package requires node >=18 but CI is using v16.20.2',
            'Update .github/workflows to use Node 18+ instead of 16.20.2',
            'OR: Update package.json engines to support Node 16: "node": ">=16.20.2"',
            'OR: Remove Node 16.20.2 from CI test matrix if not supported',
          ],
        });
      }

      // Missing pnpm
      if (realErrors.includes('pnpm: not found')) {
        issues.push({
          category: 'missing pnpm',
          suggestions: [
            'pnpm command not found in CI environment',
            'Add pnpm installation step to GitHub Actions workflow',
            'OR: Replace pnpm usage with npm in scripts and tests',
          ],
        });
      }
    }

    // If we found specific issues, return them first
    if (issues.length > 0) {
      return issues;
    }

    // Fallback to generic pattern matching
    const errorPatterns = {
      npmPublishFailures: {
        patterns: [
          /npm publish.*failed/i,
          /You cannot publish over the previously published versions/,
          /403.*Forbidden.*npm/,
          /EPUBLISHCONFLICT/,
          /version.*already published/i,
          /npm ERR!.*publish/i,
          /Publish to NPM.*failure/i,
          /X Publish to NPM/,
          /Process completed with exit code 1.*npm/i,
        ],
        suggestions: [
          'NPM publish failed - most likely version conflict',
          'Check current version: npm view supernal-coding version',
          'Bump version: npm version patch (or minor/major)',
          'Verify package.json version is higher than published',
          'Check npm authentication: npm whoami',
          'Manual publish test: npm publish --dry-run',
          'View package on npmjs.com to see published versions',
        ],
      },
      testFailures: {
        patterns: [
          /FAIL.*\.spec\.js/,
          /FAIL.*\.test\.js/,
          /Tests?.*failed/i,
          /expect\(.*\)\.to/,
          /AssertionError/,
          /Test Suites:.*failed/,
          /req-052.*failed/i,
          /The strategy configuration was canceled because.*failed/i,
          /Process completed with exit code 1/i,
        ],
        suggestions: [
          'CI test matrix failure detected - one Node version failed, causing others to cancel',
          'Most likely Node 16.20.2 compatibility issue (see Node version patterns)',
          'Run locally: npm test',
          'Check specific test: npm test <test-file>',
          'Run with CI env: CI=true NODE_ENV=test npm test',
          'Use test:critical: npm run test:critical',
          'Check req-052 test specifically - known CI environment issue',
          'Consider updating CI matrix to remove Node 16.20.2 if incompatible',
        ],
      },
      buildFailures: {
        patterns: [
          /npm ERR!/,
          /Module not found/,
          /Cannot resolve/,
          /SyntaxError/,
          /TypeError.*undefined/,
          /build.*failed/i,
          /ENOENT.*no such file/,
        ],
        suggestions: [
          'Check dependencies: npm ci',
          'Verify imports and exports',
          'Run local build: npm run build',
          'Check for typos in file paths',
          'Ensure all required files are included in git',
        ],
      },
      releaseFailures: {
        patterns: [
          /git tag.*already exists/i,
          /release.*already exists/i,
          /EEXIST.*tag/,
          /fatal.*tag.*already exists/,
        ],
        suggestions: [
          'Tag already exists - delete existing tag or use different version',
          'Run: git tag -d <tag-name> && git push origin :refs/tags/<tag-name>',
          'Check existing releases: gh release list',
          'Ensure version bumping is working correctly',
        ],
      },
      authenticationIssues: {
        patterns: [
          /authentication.*failed/i,
          /401.*Unauthorized/,
          /403.*Forbidden/,
          /ENOTFOUND.*registry/,
          /npm.*login required/i,
        ],
        suggestions: [
          'Check GitHub token permissions',
          'Verify npm token is valid: npm whoami',
          'Check repository secrets in GitHub Settings',
          'Ensure GITHUB_TOKEN has correct permissions',
          'Re-authenticate: gh auth login',
        ],
      },
      packageStructureIssues: {
        patterns: [
          /Cannot find module.*program/,
          /MODULE_NOT_FOUND.*program/,
          /Cannot find module.*\/supernal-code-package\//,
          /supernal-code-package.*not found/,
          /Error: Cannot find module/,
        ],
        suggestions: [
          'Package structure issue detected - missing files in npm package',
          'The package.json "files" field may be excluding required CLI code',
          'Check that "supernal-code-package/" is included in package.json files array',
          'Verify all main entry point dependencies are packaged',
          'Test package structure with: npm pack && tar -tzf supernal-coding-*.tgz',
          'Ensure main field matches actual file structure in published package',
        ],
      },
      nodeVersionIssues: {
        patterns: [
          /EBADENGINE.*Unsupported engine/,
          /node.*required.*current/,
          /npm WARN EBADENGINE/,
          /engines.*node/i,
        ],
        suggestions: [
          'Node version compatibility issue detected - check for unsupported Node features',
          'Current project requires Node >=20.0.0 as specified in package.json engines',
          'Check for Node version-specific syntax (optional chaining ?., nullish coalescing ??)',
          'Test with Node 20.17.0, 22.6.0 (current CI matrix versions)',
        ],
      },
      pathIssues: {
        patterns: [
          /supernal-code-package.*not found/,
          /cli\/commands.*not found/,
          /archive.*not found/,
          /Cannot find module.*cli/,
        ],
        suggestions: [
          'CLI centralization may have broken paths',
          'Check if old cli/commands references still exist',
          'Verify archive directory structure is correct',
          'Run: find . -name "*.js" -exec grep -l "cli/commands" {} \\;',
        ],
      },
    };

    const foundIssues = [];
    const logText = typeof logs === 'string' ? logs : JSON.stringify(logs);

    Object.entries(errorPatterns).forEach(([category, config]) => {
      const hasPattern = config.patterns.some((pattern) =>
        pattern.test(logText)
      );
      if (hasPattern) {
        foundIssues.push({
          category: category
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .trim(),
          suggestions: config.suggestions,
        });
      }
    });

    // If no specific patterns found, provide general debugging steps
    if (foundIssues.length === 0) {
      foundIssues.push({
        category: 'general debugging',
        suggestions: [
          'Check the full logs in GitHub Actions UI',
          'Run the failing commands locally',
          'Compare local vs CI environment differences',
          'Check if required files are committed to git',
          'Verify all environment variables are set',
        ],
      });
    }

    return foundIssues;
  }

  /**
   * Monitor workflow runs after a push
   */
  async monitorAfterPush(branch = 'main', timeout = 300000) {
    if (!this.checkGhCli()) {
      return { success: false, reason: 'GitHub CLI not available' };
    }

    console.log(chalk.blue('\n🔍 Monitoring CI/CD pipelines...'));
    console.log(`   Branch: ${branch}`);
    console.log(`   Max wait time: ${timeout / 1000}s`);
    console.log('');

    const startTime = Date.now();
    let lastRunStatus = new Map();

    while (Date.now() - startTime < timeout) {
      const runs = this.getRecentRuns(branch, 5);

      if (runs.length === 0) {
        console.log(chalk.yellow('⚠️  No recent workflow runs found'));
        await this.sleep(this.pollInterval);
        continue;
      }

      // Group runs by workflow name
      const workflowGroups = new Map();
      runs.forEach((run) => {
        if (!workflowGroups.has(run.workflowName)) {
          workflowGroups.set(run.workflowName, []);
        }
        workflowGroups.get(run.workflowName).push(run);
      });

      let allCompleted = true;
      let hasFailures = false;
      const currentStatus = new Map();

      for (const [workflowName, workflowRuns] of workflowGroups) {
        const latestRun = workflowRuns[0]; // Most recent run
        const statusKey = `${workflowName}-${latestRun.databaseId}`;
        currentStatus.set(statusKey, latestRun);

        // Only show status changes
        const lastStatus = lastRunStatus.get(statusKey);
        const statusChanged =
          !lastStatus ||
          lastStatus.status !== latestRun.status ||
          lastStatus.conclusion !== latestRun.conclusion;

        if (statusChanged) {
          if (
            latestRun.status === 'in_progress' ||
            latestRun.status === 'queued'
          ) {
            console.log(chalk.blue(`🔄 ${workflowName}: ${latestRun.status}`));
            allCompleted = false;
          } else if (latestRun.status === 'completed') {
            if (latestRun.conclusion === 'success') {
              console.log(
                chalk.green(`✅ ${workflowName}: ${latestRun.conclusion}`)
              );
            } else {
              console.log(
                chalk.red(`❌ ${workflowName}: ${latestRun.conclusion}`)
              );
              hasFailures = true;
            }
          }
        } else if (
          latestRun.status === 'in_progress' ||
          latestRun.status === 'queued'
        ) {
          allCompleted = false;
        } else if (latestRun.conclusion !== 'success') {
          hasFailures = true;
        }
      }

      lastRunStatus = currentStatus;

      // If all workflows are complete, analyze results
      if (allCompleted) {
        console.log('');
        if (hasFailures) {
          console.log(chalk.red('🚨 CI/CD Pipeline Failures Detected'));
          console.log('');

          // Analyze each failed workflow
          for (const [_workflowName, workflowRuns] of workflowGroups) {
            const latestRun = workflowRuns[0];
            if (latestRun.conclusion !== 'success') {
              await this.analyzeFailedRun(latestRun);
            }
          }

          return {
            success: false,
            reason: 'CI/CD failures detected',
            failedWorkflows: Array.from(workflowGroups.entries())
              .filter(([_, runs]) => runs[0].conclusion !== 'success')
              .map(([name, runs]) => ({ name, run: runs[0] })),
          };
        } else {
          console.log(chalk.green('🎉 All CI/CD pipelines passed!'));
          return { success: true };
        }
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
    }

    console.log(chalk.yellow('⏰ Monitoring timeout reached'));
    return { success: false, reason: 'timeout' };
  }

  /**
   * Analyze a specific failed workflow run
   */
  async analyzeFailedRun(run) {
    console.log(chalk.red(`\n📋 Analyzing failure: ${run.workflowName}`));
    console.log(`   Run URL: ${run.url}`);
    console.log(`   Conclusion: ${run.conclusion}`);

    // Get detailed job information
    const jobs = await this.getRunDetails(run.databaseId);
    const failedJobs = jobs.filter((job) => job.conclusion === 'failure');

    if (failedJobs.length === 0) {
      console.log(chalk.yellow('   ⚠️  No failed jobs found in this run'));
      return;
    }

    console.log(
      `   Failed jobs: ${failedJobs.map((job) => job.name).join(', ')}`
    );

    // Get failure logs
    const logs = await this.getFailureLogs(run.databaseId);
    if (!logs) {
      console.log(chalk.yellow('   ⚠️  Could not retrieve failure logs'));
      return;
    }

    // Analyze error patterns
    const issues = this.analyzeErrors(logs, failedJobs);

    if (issues.length > 0) {
      console.log(chalk.yellow('\n🔧 Suggested fixes:'));
      issues.forEach((issue, index) => {
        console.log(
          chalk.cyan(
            `\n   ${index + 1}. ${issue.category.replace(/([A-Z])/g, ' $1').toLowerCase()}:`
          )
        );
        issue.suggestions.forEach((suggestion) => {
          console.log(chalk.white(`      • ${suggestion}`));
        });
      });
    }

    // Show relevant log excerpts
    const logLines = logs.split('\n');
    const errorLines = logLines
      .filter(
        (line) =>
          /error|fail|❌|✗/i.test(line) &&
          !/node_modules/.test(line) &&
          line.trim().length > 0
      )
      .slice(0, 10); // Show max 10 error lines

    if (errorLines.length > 0) {
      console.log(chalk.yellow('\n📋 Key error messages:'));
      errorLines.forEach((line) => {
        console.log(chalk.red(`   ${line.trim()}`));
      });
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Quick status check without monitoring
   */
  async quickStatus(branch = 'main') {
    if (!this.checkGhCli()) {
      return false;
    }

    const runs = this.getRecentRuns(branch, 3);

    if (runs.length === 0) {
      console.log(chalk.yellow('⚠️  No recent workflow runs found'));
      return true;
    }

    console.log(chalk.blue(`\n📊 Recent CI/CD status for ${branch}:`));

    let hasFailures = false;
    runs.forEach((run) => {
      const statusIcon =
        run.conclusion === 'success'
          ? '✅'
          : run.conclusion === 'failure'
            ? '❌'
            : run.status === 'in_progress'
              ? '🔄'
              : '⏸️';

      const timeAgo = new Date(run.createdAt).toLocaleString();
      console.log(
        `   ${statusIcon} ${run.workflowName} (${run.conclusion || run.status}) - ${timeAgo}`
      );

      if (run.conclusion === 'failure') {
        hasFailures = true;
      }
    });

    return !hasFailures;
  }

  /**
   * Comprehensive diagnosis of current CI/CD issues
   */
  async diagnoseIssues(branch = 'main') {
    if (!this.checkGhCli()) {
      console.log(chalk.red('❌ GitHub CLI required for diagnosis'));
      return false;
    }

    console.log(chalk.blue('\n🔍 DIAGNOSING CI/CD ISSUES'));
    console.log(chalk.blue('================================'));

    const runs = this.getRecentRuns(branch, 5);
    const failedRuns = runs.filter((run) => run.conclusion === 'failure');

    if (failedRuns.length === 0) {
      console.log(chalk.green('\n✅ No recent failures detected!'));
      return true;
    }

    console.log(
      chalk.red(`\n🚨 Found ${failedRuns.length} failed workflow(s)\n`)
    );

    for (const run of failedRuns) {
      console.log(chalk.red(`📋 ANALYZING: ${run.workflowName}`));
      console.log(`   Run ID: ${run.databaseId}`);
      console.log(`   URL: ${run.url}`);
      console.log(`   Time: ${new Date(run.createdAt).toLocaleString()}\n`);

      // Get detailed failure information
      const jobs = await this.getRunDetails(run.databaseId);
      const logs = await this.getFailureLogs(run.databaseId);

      if (logs) {
        // Analyze the error patterns
        const issues = this.analyzeErrors(logs, jobs);

        if (issues.length > 0) {
          console.log(chalk.yellow('🔧 RECOMMENDED FIXES:'));
          issues.forEach((issue, index) => {
            console.log(chalk.cyan(`\n   ${index + 1}. ${issue.category}:`));
            issue.suggestions.forEach((suggestion) => {
              console.log(chalk.white(`      • ${suggestion}`));
            });
          });
        }

        // Show key error excerpts
        const logLines = logs.split('\n');
        const errorLines = logLines
          .filter(
            (line) =>
              /error|fail|❌|✗|npm ERR|FAIL|ERROR|Exception/i.test(line) &&
              !/node_modules|Stack trace|^\s*at\s/.test(line) &&
              line.trim().length > 10
          )
          .slice(0, 8); // Show max 8 key error lines

        if (errorLines.length > 0) {
          console.log(chalk.yellow('\n📋 KEY ERROR MESSAGES:'));
          errorLines.forEach((line) => {
            const cleanLine = line
              .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '')
              .trim();
            if (cleanLine.length > 0) {
              console.log(chalk.red(`   ${cleanLine}`));
            }
          });
        }
      } else {
        console.log(chalk.yellow('⚠️  Could not retrieve detailed logs'));
        console.log(
          chalk.white(`   Try running: gh run view ${run.databaseId}`)
        );
      }

      console.log(`\n${'─'.repeat(60)}\n`);
    }

    // Provide summary recommendations
    console.log(chalk.blue('🎯 IMMEDIATE ACTION ITEMS:'));
    console.log(chalk.white('   1. Fix the issues shown above'));
    console.log(chalk.white('   2. Test locally with: npm run test:ci'));
    console.log(chalk.white('   3. Commit fixes and push'));
    console.log(chalk.white('   4. Monitor with: sc git-smart monitor'));
    console.log('');

    return false;
  }
}

module.exports = GitHubActionsMonitor;

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const monitor = new GitHubActionsMonitor();

  switch (command) {
    case 'monitor': {
      const branch = args[1] || 'main';
      const timeout =
        parseInt(
          args.find((arg) => arg.startsWith('--timeout='))?.split('=')[1],
          10
        ) || 300000;
      await monitor.monitorAfterPush(branch, timeout);
      break;
    }

    case 'status': {
      const statusBranch = args[1] || 'main';
      await monitor.quickStatus(statusBranch);
      break;
    }

    case 'diagnose': {
      const diagnoseBranch = args[1] || 'main';
      await monitor.diagnoseIssues(diagnoseBranch);
      break;
    }

    case 'analyze': {
      const runId = args[1];
      if (!runId) {
        console.log(chalk.red('❌ Please provide a run ID'));
        process.exit(1);
      }
      const runDetails = await monitor.getRunDetails(runId);
      console.log(JSON.stringify(runDetails, null, 2));
      break;
    }

    default:
      console.log(chalk.blue('GitHub Actions Monitor Commands:'));
      console.log('');
      console.log(
        '  monitor [branch] [--timeout=300000]  Monitor workflows after push'
      );
      console.log('  status [branch]                      Quick status check');
      console.log(
        '  diagnose [branch]                    Analyze failures and suggest fixes'
      );
      console.log(
        '  analyze <run-id>                     Analyze specific run'
      );
      console.log('');
      console.log(
        chalk.yellow(
          '💡 Pro tip: Use "sc git-smart monitor" for integrated monitoring'
        )
      );
      console.log(
        chalk.yellow(
          '💡 After push: Run "sc git-smart monitor diagnose" to auto-fix issues'
        )
      );
      console.log('');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}
