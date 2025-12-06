#!/usr/bin/env node

const chalk = require('chalk');
const _fs = require('fs-extra');
const path = require('node:path');
const RuleChangeDetector = require('./rule-change-detector');
const _ConsentManager = require('./consent-manager');
const RuleSubmissionClient = require('./rule-submission-client');
const { getConfig } = require('../../../scripts/config-loader');

/**
 * sc rules suggest - Suggest local rule changes to upstream repository
 *
 * Creates GitHub issues or PRs with sanitized rule content for community review.
 */

class RulesSuggest {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
    this.config = null;
  }

  async loadConfig() {
    try {
      const configLoader = getConfig(this.projectRoot);
      configLoader.load();
      this.config = configLoader.getAll();
    } catch (_error) {
      this.config = {
        rules: {
          reporting: {
            enabled: true,
            submission_mode: 'github_issue',
            github_repo: 'supernalintelligence/supernal-coding'
          }
        }
      };
    }
  }

  /**
   * Generate GitHub issue URL for rule suggestion
   */
  generateGitHubIssueUrl(changes, summary) {
    const repo =
      this.config?.rules?.reporting?.github_repo ||
      'supernalintelligence/supernal-coding';

    const title = `[RULE SUGGESTION] ${changes.length} rule${changes.length > 1 ? 's' : ''} updated`;

    const body = `## Rule Suggestion

### Summary
${summary}

### Changes

${changes
  .map(
    (
      c
    ) => `#### ${c.type === 'added' ? '➕' : c.type === 'modified' ? '✏️' : '🗑️'} \`${c.path}\`
- **Type**: ${c.type}
- **Timestamp**: ${c.timestamp}
${
  c.content
    ? `
<details>
<summary>View sanitized content</summary>

\`\`\`markdown
${c.content.slice(0, 2000)}${c.content.length > 2000 ? '\n...(truncated)' : ''}
\`\`\`
</details>
`
    : ''
}
`
  )
  .join('\n')}

### Context

- **Source**: Local development environment
- **Submitted via**: \`sc rules suggest\`

---
*This suggestion was auto-generated. The content has been sanitized to remove personal information.*
`;

    const encodedTitle = encodeURIComponent(title);
    const encodedBody = encodeURIComponent(body);
    const labels = encodeURIComponent('rule-suggestion,community');

    return `https://github.com/${repo}/issues/new?title=${encodedTitle}&body=${encodedBody}&labels=${labels}`;
  }

  /**
   * Main suggest flow
   */
  async suggest(options = {}) {
    await this.loadConfig();

    const detector = new RuleChangeDetector({ projectRoot: this.projectRoot });
    const submissionClient = new RuleSubmissionClient({
      projectRoot: this.projectRoot
    });

    // Check if rules reporting is enabled
    if (!this.config?.rules?.reporting?.enabled) {
      console.log(
        chalk.yellow('⚠️  Rules reporting is disabled in supernal.yaml')
      );
      console.log(
        chalk.gray('   Enable it with: rules.reporting.enabled: true')
      );
      return;
    }

    // Detect changes
    console.log(chalk.blue('🔍 Checking for rule changes...'));
    const result = await detector.checkForChanges();

    if (!result.hasChanges) {
      console.log(chalk.green('✅ No rule changes detected'));
      console.log(chalk.gray('   Your local rules match the tracked state'));
      return;
    }

    // Display changes
    console.log(
      chalk.cyan(`\n📋 Found ${result.changes.length} rule change(s):\n`)
    );

    for (const change of result.changes) {
      const icon =
        change.type === 'added' ? '➕' : change.type === 'modified' ? '✏️' : '🗑️';
      const color =
        change.type === 'added'
          ? chalk.green
          : change.type === 'modified'
            ? chalk.yellow
            : chalk.red;
      console.log(color(`   ${icon} ${change.type.padEnd(10)} ${change.path}`));
    }

    // Filter to specific rule if provided
    let changesToSubmit = result.changes;
    if (options.rule) {
      changesToSubmit = result.changes.filter(
        (c) =>
          c.path.includes(options.rule) ||
          path.basename(c.path).includes(options.rule)
      );
      if (changesToSubmit.length === 0) {
        console.log(
          chalk.yellow(`\n⚠️  No changes found matching: ${options.rule}`)
        );
        return;
      }
    }

    // Dry run - just show what would be submitted
    if (this.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run - no submission will be made'));
      console.log(chalk.gray('   Remove --dry-run to actually submit'));
      return;
    }

    // Sanitize content
    console.log(chalk.gray('\n🔒 Sanitizing content for privacy...'));
    const sanitizedChanges = await Promise.all(
      changesToSubmit.map(async (change) => {
        const sanitized = { ...change };
        if (change.file?.content) {
          sanitized.content = submissionClient.sanitizeRuleContent(
            change.file.content,
            change.path
          );
        }
        return sanitized;
      })
    );

    // Generate summary
    const summary = `Suggesting ${sanitizedChanges.length} rule update(s) from local development.`;

    // Determine submission mode
    const mode =
      this.config?.rules?.reporting?.submission_mode || 'github_issue';

    if (mode === 'github_issue') {
      const url = this.generateGitHubIssueUrl(sanitizedChanges, summary);

      console.log(chalk.green('\n✅ GitHub Issue Ready!'));
      console.log(chalk.cyan('\n🔗 Click this URL to create the issue:'));
      console.log(chalk.blue(url));
      console.log(chalk.gray('\n💡 The URL contains your rule suggestions'));
      console.log(chalk.gray('   Review the pre-filled content and submit'));
    } else if (mode === 'github_pr') {
      // Future: Use gh CLI to create PR
      console.log(
        chalk.yellow('⚠️  GitHub PR mode requires gh CLI authentication')
      );
      console.log(chalk.gray('   Run: gh auth login'));
      console.log(chalk.gray('   Then try again'));
    } else if (mode === 'local_only') {
      console.log(chalk.green('✅ Changes recorded locally (local_only mode)'));
      console.log(
        chalk.gray('   Changes are tracked but not submitted upstream')
      );
    }
  }
}

/**
 * CLI handler for `sc rules suggest`
 */
async function handleRulesSuggest(args, options) {
  const suggest = new RulesSuggest({
    projectRoot: process.cwd(),
    verbose: options.verbose,
    dryRun: options.dryRun
  });

  await suggest.suggest({
    rule: args[0], // Optional specific rule name
    all: options.all
  });
}

module.exports = {
  RulesSuggest,
  handleRulesSuggest
};
