/**
 * Google Auth Status Command
 */
import chalk from 'chalk';
import * as api from '../api';

interface AuthStatusResult {
  success: boolean;
  connected: boolean;
  email?: string;
  error?: string;
}

async function handler(): Promise<AuthStatusResult> {
  try {
    const isAuth = await api.isAuthenticated();

    if (isAuth) {
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const userInfo = await api.getUserInfo({ clientId, clientSecret });
          console.log(chalk.green('\n✅ Connected to Google\n'));
          console.log(`Account: ${chalk.bold(userInfo.email)}`);
          console.log(`Name: ${userInfo.name || 'N/A'}`);
          return { success: true, connected: true, email: userInfo.email };
        } else {
          console.log(chalk.green('\n✅ Connected to Google\n'));
          console.log(chalk.dim('(Set GOOGLE_CLIENT_ID/SECRET to see account details)'));
          return { success: true, connected: true };
        }
      } catch {
        console.log(chalk.green('\n✅ Connected to Google\n'));
        console.log(chalk.dim('(Could not fetch account details)'));
        return { success: true, connected: true };
      }
    } else {
      console.log(chalk.yellow('\n⚠️ Not connected to Google\n'));
      console.log('Run: sc connect google auth login');
      return { success: true, connected: false };
    }
  } catch (error) {
    console.error(chalk.red(`Status check failed: ${(error as Error).message}`));
    return { success: false, connected: false, error: (error as Error).message };
  }
}

export = handler;
