/**
 * Jira List Boards Command
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

    const response = await api.agileRequest('/board');

    if (response.values.length === 0) {
      console.log(chalk.yellow('No boards found'));
      return { success: true, boards: [] };
    }

    console.log(chalk.white(`\nAccessible boards:\n`));

    for (const board of response.values) {
      console.log(
        chalk.cyan(String(board.id).padEnd(8)) +
        chalk.white(board.name.padEnd(30)) +
        chalk.gray(board.type)
      );
    }
    
    return { success: true, boards: response.values };
  } catch (error) {
    console.error(chalk.red(`Failed to list boards: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'List accessible Jira boards';

