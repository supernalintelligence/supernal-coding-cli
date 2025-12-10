import chalk from 'chalk';
import path from 'node:path';
const RuleChangeDetector = require('./rule-change-detector');
const RuleSubmissionClient = require('./rule-submission-client');
const { getConfig } = require('../../../scripts/config-loader');

interface RulesConfig {
  rules?: {
    reporting?: {
      enabled?: boolean;
      submission_mode?: string;
      github_repo?: string;
    };
  };
}

interface RuleChange {
  type: 'added' | 'modified' | 'deleted';
  path: string;
  timestamp: string;
  content?: string;
  file?: { content?: string };
}

interface SuggestOptions {
  rule?: string;
  all?: boolean;
}

interface ConstructorOptions {
  projectRoot?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

interface HandleOptions {
  verbose?: boolean;
  dryRun?: boolean;
  all?: boolean;
}

class RulesSuggest {
  protected projectRoot: string;
  protected verbose: boolean;
  protected dryRun: boolean;
  protected config: RulesConfig | null;

  constructor(options: ConstructorOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
    this.config = null;
  }

  async loadConfig(): Promise<void> {
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

  generateGitHubIssueUrl(changes: RuleChange[], summary: string): string {
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
    (c) => `#### ${c.type === 'added' ? '➕' : c.type === 'modified' ? '✏️' : '🗑️'} \`${c.path}\`
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

  async suggest(options: SuggestOptions = {}): Promise<void> {
    await this.loadConfig();

    const detector = new RuleChangeDetector({ projectRoot: this.projectRoot });
    const submissionClient = new RuleSubmissionClient({
      projectRoot: this.projectRoot
    });

    if (!this.config?.rules?.reporting?.enabled) {
      console.log(
        chalk.yellow('⚠️  Rules reporting is disabled in supernal.yaml')
      );
      console.log(
        chalk.gray('   Enable it with: rules.reporting.enabled: true')
      );
      return;
    }

    console.log(chalk.blue('🔍 Checking for rule changes...'));
    const result = await detector.checkForChanges();

    if (!result.hasChanges) {
      console.log(chalk.green('✅ No rule changes detected'));
      console.log(chalk.gray('   Your local rules match the tracked state'));
      return;
    }

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

    let changesToSubmit: RuleChange[] = result.changes;
    if (options.rule) {
      changesToSubmit = result.changes.filter(
        (c: RuleChange) =>
          c.path.includes(options.rule!) ||
          path.basename(c.path).includes(options.rule!)
      );
      if (changesToSubmit.length === 0) {
        console.log(
          chalk.yellow(`\n⚠️  No changes found matching: ${options.rule}`)
        );
        return;
      }
    }

    if (this.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run - no submission will be made'));
      console.log(chalk.gray('   Remove --dry-run to actually submit'));
      return;
    }

    console.log(chalk.gray('\n🔒 Sanitizing content for privacy...'));
    const sanitizedChanges = await Promise.all(
      changesToSubmit.map(async (change) => {
        const sanitized: RuleChange = { ...change };
        if (change.file?.content) {
          sanitized.content = submissionClient.sanitizeRuleContent(
            change.file.content,
            change.path
          );
        }
        return sanitized;
      })
    );

    const summary = `Suggesting ${sanitizedChanges.length} rule update(s) from local development.`;

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

async function handleRulesSuggest(args: string[], options: HandleOptions): Promise<void> {
  const suggest = new RulesSuggest({
    projectRoot: process.cwd(),
    verbose: options.verbose,
    dryRun: options.dryRun
  });

  await suggest.suggest({
    rule: args[0],
    all: options.all
  });
}

export {
  RulesSuggest,
  handleRulesSuggest
};

module.exports = {
  RulesSuggest,
  handleRulesSuggest
};
