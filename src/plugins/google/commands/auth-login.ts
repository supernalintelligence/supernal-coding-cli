/**
 * Google Auth Login Command
 */
const chalk = require('chalk');
const api = require('../api');

async function handler(args, options = {}) {
  // Get client credentials from environment or options
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
    
    // Get user info to confirm
    const userInfo = await api.getUserInfo({ clientId, clientSecret });
    
    console.log(chalk.green('\n✅ Successfully connected to Google!\n'));
    console.log(`Logged in as: ${chalk.bold(userInfo.email)}`);
    console.log(`Credentials stored in: ${chalk.dim('~/.supernal/credentials/google.enc')}`);
    
    return { success: true, email: userInfo.email };
  } catch (error) {
    console.log(chalk.red(`\n❌ Authentication failed: ${error.message}\n`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'Connect to Google with OAuth';
module.exports.options = [
  ['--client-id <id>', 'Google OAuth client ID'],
  ['--client-secret <secret>', 'Google OAuth client secret'],
  ['--port <port>', 'Local callback port', '3847']
];

