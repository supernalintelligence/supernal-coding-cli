/**
 * Project Root Finder
 * Locates .supernal directory to determine project root
 */

const path = require('node:path');
const fs = require('node:fs').promises;

/**
 * Find project root by looking for .supernal directory
 * @param {string} startPath - Starting directory (defaults to cwd)
 * @returns {Promise<string>} Project root path
 * @throws {Error} If .supernal directory not found
 */
async function findProjectRoot(startPath = process.cwd()) {
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    const supernalPath = path.join(currentPath, '.supernal');
    try {
      const stat = await fs.stat(supernalPath);
      if (stat.isDirectory()) {
        return currentPath;
      }
    } catch (_err) {
      // Directory doesn't exist, continue searching
    }
    currentPath = path.dirname(currentPath);
  }

  throw new Error(
    'Not a Supernal project (no .supernal directory found)\n' +
      'Run "sc init" to initialize a new project'
  );
}

/**
 * Check if current directory is a Supernal project
 * @param {string} dirPath - Directory to check (defaults to cwd)
 * @returns {Promise<boolean>} True if .supernal exists
 */
async function isSupernalProject(dirPath = process.cwd()) {
  try {
    await findProjectRoot(dirPath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  findProjectRoot,
  isSupernalProject
};
