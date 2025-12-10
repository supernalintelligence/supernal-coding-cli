import chalk from 'chalk';

/**
 * Create test repository for development environments
 * @param targetDir - Target installation directory
 */
export async function createTestRepository(_targetDir: string): Promise<void> {
  // TODO: Extract from init.js
  console.log(chalk.blue('   🧪 Creating test repository...'));
}

module.exports = {
  createTestRepository
};
