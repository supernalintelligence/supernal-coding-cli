/**
 * Google Auth Logout Command
 */
const chalk = require('chalk');
const api = require('../api');

async function handler() {
  try {
    const wasAuthenticated = await api.isAuthenticated();
    
    if (!wasAuthenticated) {
      console.log(chalk.yellow('\n⚠️ Not currently logged in to Google\n'));
      return { success: true };
    }
    
    await api.logout();
    console.log(chalk.green('\n✅ Logged out from Google\n'));
    console.log('Credentials have been removed.');
    
    return { success: true };
  } catch (error) {
    console.error(chalk.red(`Logout failed: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'Disconnect from Google';

