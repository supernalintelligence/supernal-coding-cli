/**
 * Jira List Projects Command
 */
const chalk = require('chalk');
const api = require('../api');

async function handler() {
  try {
    const isAuth = await api.isAuthenticated();
    if (!isAuth) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    const response = await api.apiRequest('/project/search');

    if (response.values.length === 0) {
      console.log(chalk.yellow('No projects found'));
      return { success: true, projects: [] };
    }

    console.log(chalk.white(`\nAccessible projects:\n`));

    for (const project of response.values) {
      console.log(chalk.cyan(project.key.padEnd(10)) + chalk.white(project.name));
    }
    
    return { success: true, projects: response.values };
  } catch (error) {
    console.error(chalk.red(`Failed to list projects: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'List accessible Jira projects';

