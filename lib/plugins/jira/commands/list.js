/**
 * Jira List Issues Command
 */
const chalk = require('chalk');
const api = require('../api');
const { getStatusColor, truncate } = require('./utils');

async function handler(args, options = {}) {
  try {
    const isAuth = await api.isAuthenticated();
    if (!isAuth) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    // Build JQL query
    let jql = options.jql;

    if (!jql) {
      const parts = [];
      if (options.project) parts.push(`project = ${options.project}`);
      if (options.status) parts.push(`status = "${options.status}"`);
      if (options.assignee) {
        parts.push(
          `assignee = ${options.assignee === 'me' ? 'currentUser()' : `"${options.assignee}"`}`
        );
      }
      // Default time-bound for new API
      if (parts.length === 0) {
        parts.push('updated >= -90d');
      }
      jql = `${parts.join(' AND ')} ORDER BY updated DESC`;
    }

    console.log(chalk.gray(`Fetching issues: ${jql}\n`));

    const client = api.createClient();
    const response = await client.searchIssues(jql, { 
      maxResults: parseInt(options.limit || '20', 10) 
    });

    if (response.issues.length === 0) {
      console.log(chalk.yellow('No issues found'));
      return { success: true, issues: [] };
    }

    console.log(
      chalk.white(`Found ${response.total} issues (showing ${response.issues.length}):\n`)
    );

    for (const issue of response.issues) {
      const status = issue.fields.status?.name || 'Unknown';
      const statusColor = getStatusColor(issue.fields.status?.statusCategory?.key);
      const priority = issue.fields.priority?.name || '-';
      const assignee = issue.fields.assignee?.displayName || 'Unassigned';

      console.log(
        chalk.cyan(issue.key.padEnd(12)) +
        statusColor(status.padEnd(15)) +
        chalk.gray(priority.padEnd(10)) +
        chalk.white(truncate(issue.fields.summary, 50))
      );
      console.log(chalk.gray('            ') + chalk.gray(`Assignee: ${assignee}`));
    }
    
    return { success: true, issues: response.issues };
  } catch (error) {
    console.error(chalk.red(`Failed to list issues: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'List recent Jira issues';
module.exports.options = [
  ['-p, --project <key>', 'Filter by project key'],
  ['-s, --status <status>', 'Filter by status'],
  ['-a, --assignee <user>', 'Filter by assignee (use "me" for current user)'],
  ['-n, --limit <number>', 'Maximum issues to show', '20'],
  ['--jql <query>', 'Custom JQL query']
];

