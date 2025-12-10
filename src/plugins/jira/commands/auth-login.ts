/**
 * Jira Auth Login Command
 *
 * Usage: sc connect jira auth login
 */

import chalk from 'chalk';
import readline from 'node:readline';
const api = require('../api');

interface LoginOptions {
  domain?: string;
  email?: string;
  token?: string;
}

interface JiraUser {
  displayName: string;
  email?: string;
}

interface LoginResult {
  success: boolean;
  user?: JiraUser;
  error?: string;
}

async function handler(_args: string[], options: LoginOptions = {}): Promise<LoginResult> {
  try {
    let { domain, email, token } = options;

    if (!domain || !email || !token) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = (prompt: string): Promise<string> =>
        new Promise((resolve) => {
          rl.question(prompt, resolve);
        });

      console.log(chalk.blue('\nJira API Token Authentication'));
      console.log(
        chalk.gray(
          'Create a token at: https://id.atlassian.com/manage-profile/security/api-tokens\n'
        )
      );

      if (!domain) {
        domain = await question(
          chalk.white('Jira domain (e.g., company.atlassian.net): ')
        );
      }
      if (!email) {
        email = await question(chalk.white('Email: '));
      }
      if (!token) {
        token = await question(chalk.white('API Token: '));
      }

      rl.close();
    }

    console.log(chalk.gray('\nValidating credentials...'));

    const result = await api.login({ domain, email, token });

    console.log(chalk.green('\n✓ Connected to Jira'));
    console.log(chalk.white(`  Domain: ${chalk.cyan(domain)}`));
    console.log(chalk.white(`  User: ${chalk.cyan(result.user.displayName)}`));
    if (result.user.email) {
      console.log(chalk.white(`  Email: ${chalk.cyan(result.user.email)}`));
    }

    return { success: true, user: result.user };
  } catch (error) {
    console.error(chalk.red(`\n✗ Login failed: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
