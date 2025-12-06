const chalk = require('chalk');
const { execSync } = require('node:child_process');

/**
 * Check if GPG is installed
 */
function isGpgInstalled() {
  try {
    execSync('gpg --version', { stdio: 'pipe' });
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Check if git commit signing is configured
 */
function isGitSigningConfigured() {
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
 * @param {Object} detectedType - Detected project type
 * @param {Object} activeFeatures - Active features configuration
 * @param {string} gitRoot - Git repository root
 * @param {Object} resolvedPaths - Resolved paths configuration
 */
async function showActionableNextSteps(
  _detectedType,
  _activeFeatures,
  gitRoot,
  _resolvedPaths
) {
  console.log(
    chalk.blue('\n🚀 Ready to Start! Here are your specific next steps:')
  );
  console.log(chalk.blue('='.repeat(60)));

  // Check if we're in a git repository
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

  // Check GPG status and suggest setup
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

  // Step 1: Git workflow (if in git repo)
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

  // Step 2: Create first requirement
  const stepNum = isGitRepo ? 2 : 1;
  console.log(chalk.green(`\n📋 ${stepNum}. Create Your First Requirement`));
  console.log(chalk.white('   Start by defining what you want to build:'));
  console.log(
    chalk.cyan(
      '   sc requirement new "Your Feature Name" --epic=main --priority=high'
    )
  );
}

module.exports = {
  showActionableNextSteps
};
