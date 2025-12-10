/**
 * Project Root Finder
 * Locates .supernal directory to determine project root
 */

import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Find project root by looking for .supernal directory
 * @param startPath - Starting directory (defaults to cwd)
 * @returns Project root path
 * @throws Error if .supernal directory not found
 */
export async function findProjectRoot(startPath = process.cwd()): Promise<string> {
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
 * @param dirPath - Directory to check (defaults to cwd)
 * @returns True if .supernal exists
 */
export async function isSupernalProject(dirPath = process.cwd()): Promise<boolean> {
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
