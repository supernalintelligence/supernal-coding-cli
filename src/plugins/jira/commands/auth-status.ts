/**
 * Jira Auth Status Command
 */
import chalk from 'chalk';
const api = require('../api');

interface JiraUser {
  displayName: string;
  email?: string;
}

interface JiraStatus {
  connected: boolean;
  domain?: string;
  user?: JiraUser;
  error?: string;
}

interface AuthStatusResult extends JiraStatus {
  success: boolean;
}

async function handler(): Promise<AuthStatusResult> {
  try {
    const status: JiraStatus = await api.getStatus();

    if (status.connected) {
      console.log(chalk.green('✓ Connected to Jira'));
      console.log(chalk.white(`  Domain: ${chalk.cyan(status.domain)}`));
      console.log(chalk.white(`  User: ${chalk.cyan(status.user?.displayName)}`));
      if (status.user?.email) {
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
    console.error(chalk.red(`Status check failed: ${(error as Error).message}`));
    return { success: false, connected: false, error: (error as Error).message };
  }
}

export = handler;
