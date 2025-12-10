import chalk from 'chalk';

interface ActiveFeatures {
  [key: string]: boolean | unknown;
}

interface InstallOptions {
  [key: string]: unknown;
}

/**
 * Install cursor rules based on active features
 * @param targetDir - Target installation directory
 * @param activeFeatures - Active features configuration
 * @param options - Installation options
 */
export async function installCursorRules(
  _targetDir: string,
  _activeFeatures: ActiveFeatures,
  _options: InstallOptions = {}
): Promise<void> {
  // TODO: Extract from init.js
  console.log(chalk.blue('   📁 Installing cursor rules...'));
}

module.exports = {
  installCursorRules
};
