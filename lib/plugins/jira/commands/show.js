/**
 * Jira Show Issue Command
 */
const chalk = require('chalk');
const api = require('../api');
const { getStatusColor, formatDate, extractText } = require('./utils');

async function handler(args) {
  const [key] = args;
  
  if (!key) {
    console.error(chalk.red('Issue key required. Usage: sc connect jira show PROJ-123'));
    return { success: false };
  }

  try {
    const creds = await api.getCredentials();
    if (!creds) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    const issue = await api.apiRequest(`/issue/${key}`);

    console.log(chalk.cyan.bold(`\n${issue.key}: ${issue.fields.summary}\n`));

    console.log(
      chalk.white('Status:     ') +
      getStatusColor(issue.fields.status?.statusCategory?.key)(issue.fields.status?.name)
    );
    console.log(
      chalk.white('Priority:   ') + chalk.yellow(issue.fields.priority?.name || '-')
    );
    console.log(chalk.white('Type:       ') + chalk.white(issue.fields.issuetype?.name));
    console.log(chalk.white('Project:    ') + chalk.white(issue.fields.project?.name));
    console.log(
      chalk.white('Reporter:   ') + chalk.white(issue.fields.reporter?.displayName || '-')
    );
    console.log(
      chalk.white('Assignee:   ') + chalk.white(issue.fields.assignee?.displayName || 'Unassigned')
    );
    console.log(chalk.white('Created:    ') + chalk.gray(formatDate(issue.fields.created)));
    console.log(chalk.white('Updated:    ') + chalk.gray(formatDate(issue.fields.updated)));

    if (issue.fields.labels?.length) {
      console.log(
        chalk.white('Labels:     ') + chalk.magenta(issue.fields.labels.join(', '))
      );
    }

    if (issue.fields.description) {
      console.log(chalk.white('\nDescription:'));
      const desc = extractText(issue.fields.description);
      console.log(chalk.gray(desc || '(empty)'));
    }

    console.log(chalk.gray(`\nView in Jira: https://${creds.domain}/browse/${issue.key}`));
    
    return { success: true, issue };
  } catch (error) {
    console.error(chalk.red(`Failed to show issue: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'Show Jira issue details';
module.exports.args = ['<key>'];

