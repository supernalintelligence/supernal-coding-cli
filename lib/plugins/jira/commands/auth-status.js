/**
 * Jira Auth Status Command
 */
const chalk = require('chalk');
const api = require('../api');

async function handler() {
  try {
    const status = await api.getStatus();

    if (status.connected) {
      console.log(chalk.green('✓ Connected to Jira'));
      console.log(chalk.white(`  Domain: ${chalk.cyan(status.domain)}`));
      console.log(chalk.white(`  User: ${chalk.cyan(status.user.displayName)}`));
      if (status.user.email) {
        console.log(chalk.white(`  Email: ${chalk.cyan(status.user.email)}`));
      }
    } else {
      console.log(chalk.yellow('✗ Not connected to Jira'));
      if (status.error) {
        console.log(chalk.gray(`  ${status.error}`));
      }
    }
    
    return { success: true, ...status };
  } catch (error) {
    console.error(chalk.red(`Status check failed: ${error.message}`));
    return { success: false, connected: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'Check Jira connection status';

