import chalk from 'chalk';
import { execSync } from 'node:child_process';
import path from 'node:path';

interface Context {
  cwd: string;
  command: string;
  node: string;
  platform: string;
  timestamp: string;
  gitBranch?: string;
  version: string;
}

interface SuggestOptions {
  _?: string | string[];
}

function gatherContext(): Context {
  const context: Context = {
    cwd: process.cwd(),
    command: process.argv.slice(2).join(' '),
    node: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
    version: 'unknown'
  };

  try {
    context.gitBranch = execSync('git branch --show-current 2>/dev/null', {
      encoding: 'utf8'
    }).trim();
  } catch (_e) {
    // Not in a git repo
  }

  try {
    const packagePath = path.join(
      __dirname,
      '../../package.json'
    );
    const pkg = require(packagePath);
    context.version = pkg.version;
  } catch (_e) {
    context.version = 'unknown';
  }

  return context;
}

function generateGitHubUrl(title: string, description: string, type: string = 'feedback'): string {
  const context = gatherContext();

  const repo = 'supernalintelligence/supernal-coding';

  const issueTitle = encodeURIComponent(`[${type.toUpperCase()}] ${title}`);

  const body = `## Description
${description}

## Environment
- **OS**: ${context.platform}
- **Node**: ${context.node}
- **Supernal Coding**: ${context.version}
- **Command**: \`${context.command}\`
${context.gitBranch ? `- **Git Branch**: ${context.gitBranch}` : ''}

## Context
- **Directory**: ${context.cwd}
- **Timestamp**: ${context.timestamp}

---
*Issue created via \`sc suggest\` command*`;

  const encodedBody = encodeURIComponent(body);
  const labels = encodeURIComponent('user-feedback');

  return `https://github.com/${repo}/issues/new?title=${issueTitle}&body=${encodedBody}&labels=${labels}`;
}

function showHelp(): void {
  console.log(chalk.cyan('\n💡 Supernal Coding Suggestion System\n'));
  console.log(chalk.white('Instantly create GitHub issues with context\n'));

  console.log(chalk.yellow('Usage:'));
  console.log(chalk.white('  sc suggest "Your feedback here"'));
  console.log(chalk.white('  sc suggest bug "Bug description"'));
  console.log(chalk.white('  sc suggest feature "Feature idea"'));
  console.log();

  console.log(chalk.yellow('Examples:'));
  console.log(chalk.white('  sc suggest "The kanban command is too slow"'));
  console.log(chalk.white('  sc suggest bug "CLI crashes on empty directory"'));
  console.log(chalk.white('  sc suggest feature "Add dark mode support"'));
  console.log();

  console.log(chalk.green('How it works:'));
  console.log(chalk.gray('  1. Captures your system context'));
  console.log(chalk.gray('  2. Generates GitHub issue URL with details'));
  console.log(chalk.gray('  3. You click the URL to submit (or not)'));
  console.log(chalk.gray('  4. Works with forks - no authentication needed'));
}

async function handler(action: string | undefined, options: SuggestOptions): Promise<void> {
  let title: string | undefined;
  let type: string;

  if (action === 'help' || action === '--help') {
    showHelp();
    return;
  }

  if (action === 'bug' || action === 'feature') {
    type = action;
    title = Array.isArray(options._) ? options._[0] : options._;

    if (!title) {
      console.log(chalk.red(`❌ Please provide a ${type} description`));
      console.log(
        chalk.white(
          `   Example: sc suggest ${type} "Your ${type} description here"`
        )
      );
      return;
    }
  } else {
    type = 'feedback';
    title = action;

    if (!title) {
      console.log(chalk.red('❌ Please provide your suggestion'));
      console.log(chalk.white('   Example: sc suggest "Your feedback here"'));
      showHelp();
      return;
    }
  }

  const githubUrl = generateGitHubUrl(title, title, type);

  console.log(chalk.green('\n✅ GitHub Issue Ready!'));
  console.log(chalk.cyan('\n🔗 Click this URL to create the issue:'));
  console.log(chalk.blue(githubUrl));
  console.log(
    chalk.gray('\n💡 The URL contains your suggestion and system context')
  );
  console.log(
    chalk.gray('   Click to open GitHub, review the details, and submit')
  );

  console.log(chalk.yellow('\n📋 Context included:'));
  const context = gatherContext();
  console.log(chalk.gray(`   • Command: ${context.command}`));
  console.log(
    chalk.gray(`   • System: ${context.platform} with Node ${context.node}`)
  );
  console.log(chalk.gray(`   • Version: supernal-coding ${context.version}`));
  if (context.gitBranch) {
    console.log(chalk.gray(`   • Git branch: ${context.gitBranch}`));
  }
}

export default handler;
module.exports = handler;
