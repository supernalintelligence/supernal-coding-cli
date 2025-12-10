/**
 * Post-installation setup for supernal-code package
 *
 * This script runs after npm install to set up the supernal-code environment
 */

import chalk from 'chalk';
import boxen from 'boxen';

function displayWelcomeMessage(): void {
  const packageJson = require('../package.json');
  const message = `
${chalk.bold.blue('🚀 Supernal Code')} has been installed successfully!

${chalk.bold('Quick Start:')}
  ${chalk.cyan('sc init')}          Initialize a new project
  ${chalk.cyan('sc --help')}        Show all available commands
  ${chalk.cyan('sc req new')}       Create a new requirement

${chalk.bold('Global Installation:')}
  If installed globally, the ${chalk.cyan('sc')} command is now available system-wide.
  
${chalk.bold('Local Installation:')}
  Use ${chalk.cyan('npx sc')} to run commands in projects with local installation.

${chalk.bold('Documentation:')}
  Visit ${chalk.blue('https://github.com/supernal/supernal-code')} for complete documentation.

${chalk.gray('Version:')} ${packageJson.version}
`;

  console.log(
    boxen(message, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'blue'
    })
  );
}

function checkGlobalInstallation(): void {
  const isGlobal =
    __dirname.includes('/npm/') ||
    __dirname.includes('\\npm\\') ||
    process.env.npm_config_global === 'true';

  if (isGlobal) {
    console.log(
      chalk.green(
        '✅ Global installation detected - "sc" command is available system-wide'
      )
    );
  } else {
    console.log(
      chalk.yellow('📦 Local installation - use "npx sc" to run commands')
    );
  }
}

function main(): void {
  try {
    displayWelcomeMessage();
    checkGlobalInstallation();

    console.log(
      chalk.green(
        '\n🎉 Setup complete! You can now use supernal-code in your projects.\n'
      )
    );
  } catch (error) {
    console.error(
      chalk.red('Error during post-installation setup:'),
      (error as Error).message
    );
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}
