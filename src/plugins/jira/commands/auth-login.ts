/**
 * Jira Auth Login Command
 * 
 * Usage: sc connect jira auth login
 */

const chalk = require('chalk');
const readline = require('node:readline');
const api = require('../api');

/**
 * @param {string[]} args - Command arguments
 * @param {Object} options - Command options
 */
async function handler(args, options = {}) {
  try {
    let { domain, email, token } = options;

    // Interactive prompts if not provided
    if (!domain || !email || !token) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = (prompt) =>
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
    console.error(chalk.red(`\n✗ Login failed: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'Connect to Jira with API token';
module.exports.options = [
  ['-d, --domain <domain>', 'Jira domain (e.g., company.atlassian.net)'],
  ['-e, --email <email>', 'Your email address'],
  ['-t, --token <token>', 'API token']
];

