// @ts-nocheck
/**
 * GitHub Handler - Routes GitHub subcommands
 * 
 * Provides unified interface for GitHub operations:
 * - sc github sync (existing)
 * - sc github issue check-responses (new)
 */

const chalk = require('chalk');

/**
 * Handle GitHub command routing
 */
async function handleGitHubCommand(subcommand, action, args, options) {
  // Route to appropriate handler
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
      // Default to sync behavior for backwards compatibility
      if (!subcommand) {
        return handleSync(options);
      }
      console.log(chalk.red(`Unknown subcommand: ${subcommand}`));
      showHelp();
      return { success: false };
  }
}

/**
 * Handle issue subcommand
 */
async function handleIssueCommand(action, args, options) {
  switch (action) {
    case 'check-responses':
      const { checkResponses } = require('./github-issue-responses');
      return checkResponses(options);
    
    case 'list':
      return listIssues(options);
    
    case 'view':
      const issueNum = args[0] || options.issue;
      if (!issueNum) {
        console.log(chalk.red('Issue number required'));
        return { success: false };
      }
      return viewIssue(issueNum, options);
    
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

/**
 * Handle sync command (existing functionality)
 */
async function handleSync(options) {
  try {
    const { handleGitHubSync } = require('./github-sync');
    return handleGitHubSync(options);
  } catch (error) {
    console.log(chalk.red('Error running sync:', error.message));
    return { success: false, error };
  }
}

/**
 * List issues using gh CLI
 */
async function listIssues(options) {
  const { execSync } = require('child_process');
  
  try {
    let cmd = 'gh issue list';
    if (options.state) cmd += ` --state ${options.state}`;
    if (options.labels) cmd += ` --label "${options.labels}"`;
    if (options.limit) cmd += ` --limit ${options.limit}`;
    
    const output = execSync(cmd, { encoding: 'utf8' });
    console.log(output);
    return { success: true };
  } catch (error) {
    console.log(chalk.red('Error listing issues:', error.message));
    return { success: false, error };
  }
}

/**
 * View specific issue
 */
async function viewIssue(issueNum, options) {
  const { execSync } = require('child_process');
  
  try {
    let cmd = `gh issue view ${issueNum}`;
    if (options.json) cmd += ' --json title,body,comments';
    
    const output = execSync(cmd, { encoding: 'utf8' });
    console.log(output);
    return { success: true };
  } catch (error) {
    console.log(chalk.red('Error viewing issue:', error.message));
    return { success: false, error };
  }
}

/**
 * Show help
 */
function showHelp() {
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

module.exports = { 
  handleGitHubCommand,
  handleIssueCommand,
  handleSync
};

