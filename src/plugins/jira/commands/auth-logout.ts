/**
 * Jira Auth Logout Command
 */
import chalk from 'chalk';
const api = require('../api');

interface LogoutResult {
  success: boolean;
  reason?: string;
  error?: string;
}

async function handler(): Promise<LogoutResult> {
  try {
    const result: LogoutResult = await api.logout();

    if (result.success) {
      console.log(chalk.green('✓ Disconnected from Jira'));
    } else if (result.reason === 'not_found') {
      console.log(chalk.yellow('No Jira credentials found'));
    }

    return result;
  } catch (error) {
    console.error(chalk.red(`Logout failed: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
