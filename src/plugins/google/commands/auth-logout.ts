/**
 * Google Auth Logout Command
 */
import chalk from 'chalk';
import * as api from '../api';

interface LogoutResult {
  success: boolean;
  error?: string;
}

async function handler(): Promise<LogoutResult> {
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
    console.error(chalk.red(`Logout failed: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
