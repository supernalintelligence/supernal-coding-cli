/**
 * Jira Sprint Command
 */
const chalk = require('chalk');
const api = require('../api');
const { getStatusColor, truncate, formatDate } = require('./utils');

async function handler(args) {
  let [boardId] = args;

  try {
    const creds = await api.getCredentials();
    if (!creds) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    // If no board ID, find first scrum board
    if (!boardId) {
      const boards = await api.agileRequest('/board');
      const scrumBoards = boards.values.filter(b => b.type === 'scrum');
      
      if (scrumBoards.length === 0) {
        console.log(chalk.yellow('No scrum boards found. Use: sc connect jira boards'));
        return { success: false };
      }
      
      boardId = scrumBoards[0].id;
      console.log(chalk.gray(`Using board: ${scrumBoards[0].name}`));
    }

    // Get active sprint
    const sprints = await api.agileRequest(`/board/${boardId}/sprint?state=active`);
    const sprint = sprints.values?.[0];

    if (!sprint) {
      console.log(chalk.yellow('No active sprint found'));
      return { success: false };
    }

    console.log(chalk.cyan.bold(`\n${sprint.name}\n`));
    
    if (sprint.goal) {
      console.log(chalk.white('Goal: ') + chalk.gray(sprint.goal));
    }
    
    if (sprint.startDate) {
      console.log(chalk.white('Start: ') + chalk.gray(formatDate(sprint.startDate)));
    }
    if (sprint.endDate) {
      console.log(chalk.white('End: ') + chalk.gray(formatDate(sprint.endDate)));
    }

    // Get sprint issues
    const issues = await api.agileRequest(
      `/sprint/${sprint.id}/issue?maxResults=50&fields=summary,status,assignee,issuetype`
    );

    if (issues.issues?.length) {
      console.log(chalk.white(`\n${issues.issues.length} issues:\n`));

      // Group by status
      const byStatus = {};
      for (const issue of issues.issues) {
        const status = issue.fields.status?.name || 'Unknown';
        if (!byStatus[status]) byStatus[status] = [];
        byStatus[status].push(issue);
      }

      for (const [status, statusIssues] of Object.entries(byStatus)) {
        const statusColor = getStatusColor(statusIssues[0]?.fields?.status?.statusCategory?.key);
        console.log(statusColor(`\n${status} (${statusIssues.length}):`));
        for (const issue of statusIssues) {
          const assignee = issue.fields.assignee?.displayName || 'Unassigned';
          console.log(
            chalk.cyan(`  ${issue.key.padEnd(10)}`) +
            chalk.white(truncate(issue.fields.summary, 40).padEnd(42)) +
            chalk.gray(assignee)
          );
        }
      }
    }

    console.log(chalk.gray(`\nView board: https://${creds.domain}/jira/software/projects/*/boards/${boardId}`));
    
    return { success: true, sprint, issues: issues.issues };
  } catch (error) {
    console.error(chalk.red(`Failed to show sprint: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'Show active sprint for a board';
module.exports.args = ['[boardId]'];

