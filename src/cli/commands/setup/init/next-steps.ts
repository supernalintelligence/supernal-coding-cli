import chalk from 'chalk';
import { execSync } from 'node:child_process';

interface DetectedType {
  [key: string]: unknown;
}

interface ActiveFeatures {
  [key: string]: unknown;
}

interface ResolvedPaths {
  [key: string]: unknown;
}

function isGpgInstalled(): boolean {
  try {
    execSync('gpg --version', { stdio: 'pipe' });
    return true;
  } catch (_e) {
    return false;
  }
}

function isGitSigningConfigured(): boolean {
  try {
    const signingKey = execSync('git config --get user.signingkey', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    return signingKey && signingKey.length > 0;
  } catch (_e) {
    return false;
  }
}

/**
 * Show actionable next steps based on project type and configuration
 */
async function showActionableNextSteps(
  _detectedType: DetectedType,
  _activeFeatures: ActiveFeatures,
  gitRoot: string,
  _resolvedPaths: ResolvedPaths
): Promise<void> {
  console.log(
    chalk.blue('\n🚀 Ready to Start! Here are your specific next steps:')
  );
  console.log(chalk.blue('='.repeat(60)));

  let isGitRepo = false;
  let currentBranch = '';
  try {
    currentBranch = execSync('git branch --show-current', {
      cwd: gitRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    isGitRepo = true;
  } catch (_error) {
    // Not a git repo or git not available
  }

  const gpgInstalled = isGpgInstalled();
  const signingConfigured = isGitSigningConfigured();

  if (!gpgInstalled || !signingConfigured) {
    console.log(chalk.yellow('\n🔐 Recommended: Set up GPG Signed Commits'));
    console.log(
      chalk.white('   For compliance tracking and document approvals:')
    );
    console.log(chalk.cyan('   sc gpg setup'));
    if (!gpgInstalled) {
      console.log(chalk.gray('   (This will also install GPG if needed)'));
    }
    console.log('');
  }

  if (isGitRepo) {
    console.log(chalk.green('\n📦 1. Create Feature Branch & Commit'));
    console.log(
      chalk.white('   Recommended: Work on a dedicated integration branch')
    );
    console.log('');
    console.log(
      chalk.cyan('   git checkout -b feat/integrate-supernal-coding')
    );
    console.log(chalk.cyan('   git add .'));
    console.log(
      chalk.cyan(
        '   git commit -m "feat: Initialize Supernal Coding system\\n\\nInstalled equipment pack with workflow, guides, and planning infrastructure"'
      )
    );
    console.log('');
    console.log(
      chalk.gray(
        `   Current branch: ${currentBranch || 'unknown'} → Switch to feat/integrate-supernal-coding`
      )
    );
  }

  const stepNum = isGitRepo ? 2 : 1;
  console.log(chalk.green(`\n📋 ${stepNum}. Create Your First Requirement`));
  console.log(chalk.white('   Start by defining what you want to build:'));
  console.log(
    chalk.cyan(
      '   sc requirement new "Your Feature Name" --epic=main --priority=high'
    )
  );
}

export { showActionableNextSteps };
module.exports = { showActionableNextSteps };
