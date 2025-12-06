const { execSync } = require('node:child_process');
const chalk = require('chalk');

/**
 * Git utilities for safe committing with stash/unstash
 */

/**
 * Check if there are uncommitted changes
 */
function hasUncommittedChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim().length > 0;
  } catch (_error) {
    return false;
  }
}

/**
 * Check if there are staged changes
 */
function hasStagedChanges() {
  try {
    const status = execSync('git diff --cached --name-only', {
      encoding: 'utf-8'
    });
    return status.trim().length > 0;
  } catch (_error) {
    return false;
  }
}

/**
 * Get list of modified files
 */
function getModifiedFiles() {
  try {
    const files = execSync('git status --porcelain', { encoding: 'utf-8' });
    return files
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^..\s+(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
  } catch (_error) {
    return [];
  }
}

/**
 * Stash changes excluding specific files
 * @param {string[]} keepFiles - Files to keep unstashed
 * @returns {boolean} - True if stash was created
 */
function stashExcept(keepFiles = []) {
  try {
    if (!hasUncommittedChanges()) {
      return false;
    }

    // Stage the files we want to keep
    if (keepFiles.length > 0) {
      execSync(`git add ${keepFiles.join(' ')}`, { encoding: 'utf-8' });
    }

    // Stash everything except staged files
    const result = execSync(
      'git stash push --keep-index -m "Auto-stash for safe commit"',
      {
        encoding: 'utf-8'
      }
    );

    return result.includes('Saved working directory');
  } catch (error) {
    console.error(chalk.red(`Failed to stash: ${error.message}`));
    return false;
  }
}

/**
 * Pop the most recent stash
 */
function popStash() {
  try {
    execSync('git stash pop', { encoding: 'utf-8' });
    return true;
  } catch (error) {
    console.error(
      chalk.yellow(`Warning: Could not pop stash: ${error.message}`)
    );
    console.error(chalk.yellow('You may need to manually run: git stash pop'));
    return false;
  }
}

/**
 * Safely commit specific files with automatic stash/unstash
 * @param {Object} options
 * @param {string[]} options.files - Files to commit
 * @param {string} options.message - Commit message
 * @param {boolean} options.dryRun - If true, only show what would be committed
 * @param {boolean} options.auto - If true, commit without prompting
 * @returns {Object} - Result with success, message, and commit hash
 */
async function safeCommit({ files, message, dryRun = false, auto = false }) {
  const result = {
    success: false,
    message: '',
    commitHash: null,
    stashCreated: false,
    stashPopped: false
  };

  try {
    // Validate inputs
    if (!files || files.length === 0) {
      result.message = 'No files specified for commit';
      return result;
    }

    if (!message) {
      result.message = 'No commit message specified';
      return result;
    }

    // Check if files exist and are modified
    const modifiedFiles = getModifiedFiles();
    const filesToCommit = files.filter((file) =>
      modifiedFiles.some(
        (modified) => modified === file || modified.endsWith(file)
      )
    );

    if (filesToCommit.length === 0) {
      result.message = 'No modified files to commit';
      return result;
    }

    // Dry run - show what would be committed
    if (dryRun) {
      result.message = 'Dry run - would commit:\n';
      result.message += filesToCommit.map((f) => `  • ${f}`).join('\n');
      result.message += `\n\nMessage: ${message}`;
      result.success = true;
      return result;
    }

    // Interactive mode - ask for confirmation
    if (!auto) {
      console.log(chalk.blue('\n📝 Proposed commit:\n'));
      console.log(chalk.gray('Files:'));
      filesToCommit.forEach((file) => {
        console.log(chalk.gray(`  • ${file}`));
      });
      console.log(chalk.gray(`\nMessage: ${message}\n`));

      // For now, we'll commit automatically in auto mode
      // In interactive mode, this would prompt the user
      // We can add readline later if needed
      if (!auto) {
        result.message =
          'Interactive mode not yet implemented. Use --auto flag';
        return result;
      }
    }

    // Stash other changes
    const otherFiles = modifiedFiles.filter((f) => !filesToCommit.includes(f));

    if (otherFiles.length > 0) {
      console.log(
        chalk.yellow(`\n⚡ Stashing ${otherFiles.length} unrelated file(s)...`)
      );
      result.stashCreated = stashExcept(filesToCommit);
    }

    // Stage and commit the specific files
    execSync(`git add ${filesToCommit.join(' ')}`, { encoding: 'utf-8' });
    execSync(`git commit -m "${message}"`, { encoding: 'utf-8' });

    // Get commit hash
    result.commitHash = execSync('git rev-parse HEAD', {
      encoding: 'utf-8'
    }).trim();

    // Pop stash if we created one
    if (result.stashCreated) {
      console.log(chalk.yellow('\n⚡ Restoring stashed changes...'));
      result.stashPopped = popStash();
    }

    result.success = true;
    result.message = `Committed ${filesToCommit.length} file(s)`;

    return result;
  } catch (error) {
    result.message = `Commit failed: ${error.message}`;

    // Try to restore stash on error
    if (result.stashCreated && !result.stashPopped) {
      console.log(
        chalk.yellow('\n⚡ Attempting to restore stash after error...')
      );
      popStash();
    }

    return result;
  }
}

/**
 * Generate a commit message for fixed features
 * @param {Array} fixes - Array of {feature, fixes[]} objects
 * @returns {string} - Commit message
 */
function generateFixCommitMessage(fixes) {
  if (fixes.length === 0) {
    return 'chore: Fix feature validation issues';
  }

  if (fixes.length === 1) {
    const { feature, fixes: fixList } = fixes[0];
    return `chore(${feature}): Auto-fix validation\n\n${fixList.map((f) => `- ${f}`).join('\n')}`;
  }

  const message = `chore: Auto-fix ${fixes.length} feature validation issues\n\n`;
  const details = fixes
    .map(({ feature, fixes: fixList }) => {
      return `${feature}:\n${fixList.map((f) => `  - ${f}`).join('\n')}`;
    })
    .join('\n\n');

  return message + details;
}

/**
 * Get files that would be committed for feature fixes
 * @param {Array} features - Array of feature objects with path
 * @returns {string[]} - Array of file paths
 */
function getFeatureFiles(features) {
  return features.map((f) => `${f.path}/README.md`);
}

module.exports = {
  hasUncommittedChanges,
  hasStagedChanges,
  getModifiedFiles,
  stashExcept,
  popStash,
  safeCommit,
  generateFixCommitMessage,
  getFeatureFiles
};
