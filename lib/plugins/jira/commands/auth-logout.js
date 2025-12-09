/**
 * Jira Auth Logout Command
 */
const chalk = require('chalk');
const api = require('../api');

async function handler() {
  try {
    const result = await api.logout();

    if (result.success) {
      console.log(chalk.green('✓ Disconnected from Jira'));
    } else if (result.reason === 'not_found') {
      console.log(chalk.yellow('No Jira credentials found'));
    }
    
    return result;
  } catch (error) {
    console.error(chalk.red(`Logout failed: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'Disconnect from Jira';

