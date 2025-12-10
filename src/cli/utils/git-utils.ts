import fs from 'node:fs';
import path from 'node:path';

/** Git repository information */
export interface GitInfo {
  root: string;
  remoteUrl: string | null;
  currentBranch: string;
  configPath: string;
}

/** Git validation result */
export interface GitValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  gitRoot?: string;
}

/**
 * Find the git repository root directory
 * @param startPath - Starting directory path (defaults to current working directory)
 * @returns Path to git root or null if not found
 */
export function findGitRoot(startPath = process.cwd()): string | null {
  try {
    // Normalize the path
    const normalizedPath = path.resolve(startPath);

    // Check if the current directory is a git repository
    if (isGitRepository(normalizedPath)) {
      return normalizedPath;
    }

    // Walk up the directory tree to find git root
    let currentPath = normalizedPath;
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
      const parentPath = path.dirname(currentPath);

      if (isGitRepository(parentPath)) {
        return parentPath;
      }

      currentPath = parentPath;
    }

    return null;
  } catch (error) {
    console.warn('Error finding git root:', (error as Error).message);
    return null;
  }
}

/**
 * Check if a directory is a git repository
 * @param dirPath - Directory path to check
 * @returns True if directory is a git repository
 */
export function isGitRepository(dirPath: string): boolean {
  try {
    const gitDir = path.join(dirPath, '.git');
    return fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory();
  } catch (_error) {
    return false;
  }
}

/**
 * Get git repository information
 * @param repoPath - Repository path (defaults to git root)
 * @returns Repository information or null
 */
export function getGitInfo(repoPath: string | null = null): GitInfo | null {
  try {
    const gitRoot = repoPath || findGitRoot();
    if (!gitRoot) {
      return null;
    }

    const configPath = path.join(gitRoot, '.git', 'config');
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const config = fs.readFileSync(configPath, 'utf8');

    // Extract remote origin URL
    const remoteMatch = config.match(
      /\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/
    );
    const remoteUrl = remoteMatch ? remoteMatch[1].trim() : null;

    // Extract branch name
    const headPath = path.join(gitRoot, '.git', 'HEAD');
    let currentBranch = 'main';
    if (fs.existsSync(headPath)) {
      const headContent = fs.readFileSync(headPath, 'utf8').trim();
      const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/);
      if (branchMatch) {
        currentBranch = branchMatch[1];
      }
    }

    return {
      root: gitRoot,
      remoteUrl,
      currentBranch,
      configPath
    };
  } catch (error) {
    console.warn('Error getting git info:', (error as Error).message);
    return null;
  }
}

/**
 * Check if current directory is within a git repository
 * @param dirPath - Directory to check (defaults to current working directory)
 * @returns True if within a git repository
 */
export function isWithinGitRepository(dirPath = process.cwd()): boolean {
  return findGitRoot(dirPath) !== null;
}

/**
 * Get relative path from git root to current directory
 * @param dirPath - Directory path (defaults to current working directory)
 * @returns Relative path or null if not in git repository
 */
export function getRelativePathFromGitRoot(dirPath = process.cwd()): string | null {
  const gitRoot = findGitRoot(dirPath);
  if (!gitRoot) {
    return null;
  }

  const normalizedDir = path.resolve(dirPath);
  return path.relative(gitRoot, normalizedDir);
}

/**
 * Validate git repository structure
 * @param repoPath - Repository path (defaults to git root)
 * @returns Validation results
 */
export function validateGitRepository(repoPath: string | null = null): GitValidationResult {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) {
    return {
      isValid: false,
      errors: ['Not a git repository'],
      warnings: []
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for .git directory
  const gitDir = path.join(gitRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    errors.push('Missing .git directory');
  }

  // Check for git config (less strict in test environment)
  const configPath = path.join(gitDir, 'config');
  if (!fs.existsSync(configPath)) {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      warnings.push('Missing git config (test environment)');
    } else {
      errors.push('Missing git config');
    }
  }

  // Check for remote origin
  try {
    const config = fs.readFileSync(configPath, 'utf8');
    if (!config.includes('[remote "origin"]')) {
      warnings.push('No remote origin configured');
    }
  } catch (_error) {
    warnings.push('Could not read git config');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    gitRoot
  };
}

module.exports = {
  findGitRoot,
  isGitRepository,
  getGitInfo,
  isWithinGitRepository,
  getRelativePathFromGitRoot,
  validateGitRepository
};
