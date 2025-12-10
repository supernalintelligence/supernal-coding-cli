/**
 * GitHub Handler - Routes GitHub subcommands
 *
 * Provides unified interface for GitHub operations:
 * - sc github sync (existing)
 * - sc github issue check-responses (new)
 */

import chalk from 'chalk';
import { execSync } from 'node:child_process';

interface CommandResult {
  success: boolean;
  error?: Error;
}

interface CommandOptions {
  state?: string;
  labels?: string;
  limit?: number;
  json?: boolean;
  issue?: string;
  issues?: boolean;
  prs?: boolean;
}

function showHelp(): void {
  console.log(chalk.cyan('\nUsage: sc github <subcommand> [action] [options]'));
  console.log(chalk.yellow('\nSubcommands:'));
  console.log('  sync              Sync GitHub issues and PRs');
  console.log('  issue             Issue management');
  console.log('  issues            List/sync issues');
  console.log('  prs               List/sync PRs');
  console.log(chalk.yellow('\nIssue Actions:'));
  console.log('  check-responses   Check for agent responses');
  console.log('  list              List issues');
  console.log('  view <number>     View specific issue');
}

async function handleSync(options: CommandOptions): Promise<CommandResult> {
  try {
    const { handleGitHubSync } = require('./github-sync');
    return handleGitHubSync(options);
  } catch (error) {
    console.log(chalk.red('Error running sync:', (error as Error).message));
    return { success: false, error: error as Error };
  }
}

async function listIssues(options: CommandOptions): Promise<CommandResult> {
  try {
    let cmd = 'gh issue list';
    if (options.state) cmd += ` --state ${options.state}`;
    if (options.labels) cmd += ` --label "${options.labels}"`;
    if (options.limit) cmd += ` --limit ${options.limit}`;

    const output = execSync(cmd, { encoding: 'utf8' });
    console.log(output);
    return { success: true };
  } catch (error) {
    console.log(chalk.red('Error listing issues:', (error as Error).message));
    return { success: false, error: error as Error };
  }
}

async function viewIssue(issueNum: string, options: CommandOptions): Promise<CommandResult> {
  try {
    let cmd = `gh issue view ${issueNum}`;
    if (options.json) cmd += ' --json title,body,comments';

    const output = execSync(cmd, { encoding: 'utf8' });
    console.log(output);
    return { success: true };
  } catch (error) {
    console.log(chalk.red('Error viewing issue:', (error as Error).message));
    return { success: false, error: error as Error };
  }
}

async function handleIssueCommand(action: string | undefined, args: string[], options: CommandOptions): Promise<CommandResult> {
  switch (action) {
    case 'check-responses': {
      const { checkResponses } = require('./github-issue-responses');
      return checkResponses(options);
    }

    case 'list':
      return listIssues(options);

    case 'view': {
      const issueNum = args[0] || options.issue;
      if (!issueNum) {
        console.log(chalk.red('Issue number required'));
        return { success: false };
      }
      return viewIssue(issueNum, options);
    }

    default:
      if (!action) {
        console.log(chalk.yellow('Usage: sc github issue <action>'));
        console.log(chalk.cyan('Actions:'));
        console.log('  check-responses  Check for agent responses in issues');
        console.log('  list            List issues');
        console.log('  view <number>   View specific issue');
        return { success: true };
      }
      console.log(chalk.red(`Unknown action: ${action}`));
      return { success: false };
  }
}

async function handleGitHubCommand(
  subcommand: string | undefined,
  action: string | undefined,
  args: string[],
  options: CommandOptions
): Promise<CommandResult> {
  switch (subcommand) {
    case 'sync':
      return handleSync(options);

    case 'issue':
      return handleIssueCommand(action, args, options);

    case 'issues':
      return handleSync({ ...options, issues: true });

    case 'prs':
      return handleSync({ ...options, prs: true });

    default:
      if (!subcommand) {
        return handleSync(options);
      }
      console.log(chalk.red(`Unknown subcommand: ${subcommand}`));
      showHelp();
      return { success: false };
  }
}

export {
  handleGitHubCommand,
  handleIssueCommand,
  handleSync
};

module.exports = {
  handleGitHubCommand,
  handleIssueCommand,
  handleSync
};
