/**
 * Google Auth Login Command
 */
import chalk from 'chalk';
import * as api from '../api';

interface LoginOptions {
  clientId?: string;
  clientSecret?: string;
  port?: number | string;
}

interface LoginResult {
  success: boolean;
  email?: string;
  error?: string;
}

async function handler(_args: string[], options: LoginOptions = {}): Promise<LoginResult> {
  const clientId = options.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log(chalk.red('\n❌ Google OAuth credentials not configured\n'));
    console.log('Set the following environment variables:');
    console.log(chalk.cyan('  GOOGLE_CLIENT_ID=your-client-id'));
    console.log(chalk.cyan('  GOOGLE_CLIENT_SECRET=your-client-secret'));
    console.log('\nOr create a .env file in your project root.');
    console.log('\nTo get credentials:');
    console.log('1. Go to https://console.cloud.google.com');
    console.log('2. Create a project and enable Drive, Docs, and Sheets APIs');
    console.log('3. Create OAuth 2.0 credentials (Desktop app type)');
    return { success: false };
  }

  console.log(chalk.blue('\n🔐 Starting Google authentication...\n'));

  try {
    await api.startCLIAuthFlow({
      clientId,
      clientSecret,
      port: options.port || 3847
    });

    const userInfo = await api.getUserInfo({ clientId, clientSecret });

    console.log(chalk.green('\n✅ Successfully connected to Google!\n'));
    console.log(`Logged in as: ${chalk.bold(userInfo.email)}`);
    console.log(`Credentials stored in: ${chalk.dim('~/.supernal/credentials/google.enc')}`);

    return { success: true, email: userInfo.email };
  } catch (error) {
    console.log(chalk.red(`\n❌ Authentication failed: ${(error as Error).message}\n`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
