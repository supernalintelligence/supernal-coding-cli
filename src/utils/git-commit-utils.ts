import { execSync } from 'node:child_process';
import chalk from 'chalk';

const { SigningManager } = require('../signing');

interface SafeCommitOptions {
  files: string[];
  message: string;
  dryRun?: boolean;
  auto?: boolean;
}

interface SafeCommitResult {
  success: boolean;
  message: string;
  commitHash: string | null;
  stashCreated: boolean;
  stashPopped: boolean;
}

interface FeatureFix {
  feature: string;
  fixes: string[];
}

interface FeatureInfo {
  path: string;
}

function hasUncommittedChanges(): boolean {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim().length > 0;
  } catch (_error) {
    return false;
  }
}

function hasStagedChanges(): boolean {
  try {
    const status = execSync('git diff --cached --name-only', {
      encoding: 'utf-8'
    });
    return status.trim().length > 0;
  } catch (_error) {
    return false;
  }
}

function getModifiedFiles(): string[] {
  try {
    const files = execSync('git status --porcelain', { encoding: 'utf-8' });
    return files
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^..\s+(.+)$/);
        return match ? match[1] : null;
      })
      .filter((f): f is string => f !== null);
  } catch (_error) {
    return [];
  }
}

function stashExcept(keepFiles: string[] = []): boolean {
  try {
    if (!hasUncommittedChanges()) {
      return false;
    }

    if (keepFiles.length > 0) {
      execSync(`git add ${keepFiles.join(' ')}`, { encoding: 'utf-8' });
    }

    const result = execSync(
      'git stash push --keep-index -m "Auto-stash for safe commit"',
      {
        encoding: 'utf-8'
      }
    );

    return result.includes('Saved working directory');
  } catch (error) {
    console.error(chalk.red(`Failed to stash: ${(error as Error).message}`));
    return false;
  }
}

function popStash(): boolean {
  try {
    execSync('git stash pop', { encoding: 'utf-8' });
    return true;
  } catch (error) {
    console.error(
      chalk.yellow(`Warning: Could not pop stash: ${(error as Error).message}`)
    );
    console.error(chalk.yellow('You may need to manually run: git stash pop'));
    return false;
  }
}

async function safeCommit(options: SafeCommitOptions): Promise<SafeCommitResult> {
  const { files, message, dryRun = false, auto = false } = options;
  
  const result: SafeCommitResult = {
    success: false,
    message: '',
    commitHash: null,
    stashCreated: false,
    stashPopped: false
  };

  try {
    if (!files || files.length === 0) {
      result.message = 'No files specified for commit';
      return result;
    }

    if (!message) {
      result.message = 'No commit message specified';
      return result;
    }

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

    if (dryRun) {
      result.message = 'Dry run - would commit:\n';
      result.message += filesToCommit.map((f) => `  - ${f}`).join('\n');
      result.message += `\n\nMessage: ${message}`;
      result.success = true;
      return result;
    }

    if (!auto) {
      console.log(chalk.blue('\nProposed commit:\n'));
      console.log(chalk.gray('Files:'));
      filesToCommit.forEach((file) => {
        console.log(chalk.gray(`  - ${file}`));
      });
      console.log(chalk.gray(`\nMessage: ${message}\n`));

      if (!auto) {
        result.message =
          'Interactive mode not yet implemented. Use --auto flag';
        return result;
      }
    }

    const otherFiles = modifiedFiles.filter((f) => !filesToCommit.includes(f));

    if (otherFiles.length > 0) {
      console.log(
        chalk.yellow(`\nStashing ${otherFiles.length} unrelated file(s)...`)
      );
      result.stashCreated = stashExcept(filesToCommit);
    }

    execSync(`git add ${filesToCommit.join(' ')}`, { encoding: 'utf-8' });
    
    const signingManager = new SigningManager(process.cwd());
    const signingFlags = signingManager.getSigningFlags({ isAgentCommit: auto });
    
    let finalMessage = message;
    if (auto && !message.startsWith('[SC]')) {
      finalMessage = `[SC] ${message}`;
    }
    
    execSync(`git commit ${signingFlags} -m "${finalMessage}"`, { encoding: 'utf-8' });

    result.commitHash = execSync('git rev-parse HEAD', {
      encoding: 'utf-8'
    }).trim();

    if (result.stashCreated) {
      console.log(chalk.yellow('\nRestoring stashed changes...'));
      result.stashPopped = popStash();
    }

    result.success = true;
    result.message = `Committed ${filesToCommit.length} file(s)`;

    return result;
  } catch (error) {
    result.message = `Commit failed: ${(error as Error).message}`;

    if (result.stashCreated && !result.stashPopped) {
      console.log(
        chalk.yellow('\nAttempting to restore stash after error...')
      );
      popStash();
    }

    return result;
  }
}

function generateFixCommitMessage(fixes: FeatureFix[]): string {
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

function getFeatureFiles(features: FeatureInfo[]): string[] {
  return features.map((f) => `${f.path}/README.md`);
}

export {
  hasUncommittedChanges,
  hasStagedChanges,
  getModifiedFiles,
  stashExcept,
  popStash,
  safeCommit,
  generateFixCommitMessage,
  getFeatureFiles
};

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
