// @ts-nocheck
/**
 * SC Repository Sync - Sync from canonical upstream repository (REQ-088)
 * For fork/clone contributors to pull latest from supernal-nova/families/supernal-coding
 */

const chalk = require('chalk');
const { execSync } = require('node:child_process');
const _fs = require('fs-extra');
const _path = require('node:path');

const CANONICAL_UPSTREAM =
  'https://github.com/supernal-nova/families/supernal-coding.git';

async function repoSyncCommand(action, options) {
  switch (action.toLowerCase()) {
    case 'check':
      await checkSync(options);
      break;
    case 'pull':
      await pullFromUpstream(options);
      break;
    case 'preview':
      await previewSync(options);
      break;
    case 'config':
      await configureSync(options);
      break;
    default:
      console.error(chalk.red(`❌ Unknown action: ${action}`));
      showHelp();
      process.exit(1);
  }
}

async function checkSync(options) {
  console.log(chalk.blue('🔍 Checking sync with upstream repository'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  // Check if we're in a git repository
  if (!isGitRepo()) {
    console.error(chalk.red('❌ Not a git repository'));
    console.log(chalk.gray('This command only works in a git repository.'));
    return;
  }

  // Check if upstream remote exists
  const upstreamUrl = getUpstreamUrl();
  if (!upstreamUrl) {
    console.log(chalk.yellow('⚠️  No upstream remote configured'));
    console.log(
      chalk.gray(`Would you like to set upstream to: ${CANONICAL_UPSTREAM}?`)
    );
    console.log(chalk.gray('Run: sc sync config --set-upstream'));
    return;
  }

  console.log(chalk.cyan('Upstream:'), upstreamUrl);

  // Fetch from upstream
  try {
    console.log(chalk.gray('Fetching from upstream...'));
    execSync('git fetch upstream', { stdio: 'pipe' });
  } catch (_error) {
    console.error(chalk.red('❌ Failed to fetch from upstream'));
    console.log(
      chalk.gray('Make sure you have access to the upstream repository.')
    );
    return;
  }

  // Get current branch
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    encoding: 'utf8'
  }).trim();
  console.log(chalk.cyan('Current branch:'), currentBranch);

  // Check how far behind we are
  try {
    const behindCount = execSync(`git rev-list --count HEAD..upstream/main`, {
      encoding: 'utf8'
    }).trim();
    const aheadCount = execSync(`git rev-list --count upstream/main..HEAD`, {
      encoding: 'utf8'
    }).trim();

    console.log('');
    if (parseInt(behindCount, 10) > 0) {
      console.log(
        chalk.yellow(
          `📊 Your branch is ${behindCount} commits behind upstream/main`
        )
      );
    } else {
      console.log(chalk.green('✅ Your branch is up to date with upstream'));
    }

    if (parseInt(aheadCount, 10) > 0) {
      console.log(
        chalk.cyan(
          `📤 Your branch is ${aheadCount} commits ahead of upstream/main`
        )
      );
    }

    // Check for uncommitted changes
    try {
      execSync('git diff-index --quiet HEAD --', { stdio: 'pipe' });
      console.log(chalk.green('✅ No uncommitted changes'));
    } catch {
      console.log(chalk.yellow('⚠️  You have uncommitted changes'));
      console.log(chalk.gray('These will be stashed before syncing.'));
    }

    console.log('');
    if (parseInt(behindCount, 10) > 0) {
      console.log(chalk.gray('Run "sc sync pull" to sync with upstream'));
    }
  } catch (error) {
    console.error(chalk.red('❌ Could not determine sync status'));
    if (options.verbose) {
      console.error(error);
    }
  }
}

async function pullFromUpstream(_options) {
  console.log(chalk.blue('🔄 Pulling from upstream repository'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  console.log(chalk.yellow('⚠️  Pull functionality coming soon'));
  console.log(chalk.gray('This will:'));
  console.log(chalk.gray('  1. Stash uncommitted changes'));
  console.log(chalk.gray('  2. Pull from upstream/main'));
  console.log(chalk.gray('  3. Handle merge conflicts'));
  console.log(chalk.gray('  4. Restore stashed changes'));
  console.log('');
  console.log(
    chalk.gray('For now, use: git fetch upstream && git merge upstream/main')
  );
}

async function previewSync(options) {
  console.log(chalk.blue('👁️  Preview sync changes'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  if (!isGitRepo()) {
    console.error(chalk.red('❌ Not a git repository'));
    return;
  }

  // Fetch from upstream
  try {
    console.log(chalk.gray('Fetching from upstream...'));
    execSync('git fetch upstream', { stdio: 'pipe' });
  } catch (_error) {
    console.error(chalk.red('❌ Failed to fetch from upstream'));
    return;
  }

  // Show commits that would be pulled
  try {
    const commits = execSync('git log HEAD..upstream/main --oneline', {
      encoding: 'utf8'
    });
    if (commits.trim()) {
      console.log(chalk.yellow('Commits that would be pulled:'));
      console.log('');
      console.log(commits);
    } else {
      console.log(chalk.green('✅ Already up to date with upstream'));
    }

    // Show files that would change
    const diffStat = execSync('git diff --stat HEAD..upstream/main', {
      encoding: 'utf8'
    });
    if (diffStat.trim()) {
      console.log(chalk.yellow('Files that would change:'));
      console.log('');
      console.log(diffStat);
    }
  } catch (error) {
    console.error(chalk.red('❌ Could not preview changes'));
    if (options.verbose) {
      console.error(error);
    }
  }
}

async function configureSync(options) {
  console.log(chalk.blue('⚙️  Configure Repository Sync'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  if (!isGitRepo()) {
    console.error(chalk.red('❌ Not a git repository'));
    return;
  }

  const upstreamUrl = options.upstream || CANONICAL_UPSTREAM;

  // Check if upstream remote exists
  const currentUpstream = getUpstreamUrl();

  if (currentUpstream && currentUpstream !== upstreamUrl) {
    console.log(
      chalk.yellow('⚠️  Upstream already configured:'),
      currentUpstream
    );
    console.log(chalk.gray('Updating to:'), upstreamUrl);

    try {
      execSync(`git remote set-url upstream ${upstreamUrl}`, {
        stdio: 'inherit'
      });
      console.log(chalk.green('✅ Upstream updated'));
    } catch (_error) {
      console.error(chalk.red('❌ Failed to update upstream'));
    }
  } else if (!currentUpstream) {
    console.log(chalk.gray('Adding upstream remote:'), upstreamUrl);

    try {
      execSync(`git remote add upstream ${upstreamUrl}`, { stdio: 'inherit' });
      console.log(chalk.green('✅ Upstream configured'));
      console.log('');
      console.log(chalk.gray('Fetching from upstream...'));
      execSync('git fetch upstream', { stdio: 'inherit' });
    } catch (_error) {
      console.error(chalk.red('❌ Failed to add upstream'));
    }
  } else {
    console.log(chalk.green('✅ Upstream already configured correctly'));
    console.log(chalk.cyan('Upstream:'), currentUpstream);
  }

  // Show current remotes
  console.log('');
  console.log(chalk.yellow('Current remotes:'));
  try {
    const remotes = execSync('git remote -v', { encoding: 'utf8' });
    console.log(remotes);
  } catch (_error) {
    console.error(chalk.red('❌ Could not list remotes'));
  }
}

function isGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getUpstreamUrl() {
  try {
    return execSync('git config --get remote.upstream.url', {
      encoding: 'utf8'
    }).trim();
  } catch {
    return null;
  }
}

function showHelp() {
  console.log(chalk.blue.bold('🔄 SC Repository Sync Command (REQ-088)'));
  console.log(chalk.blue('='.repeat(45)));
  console.log('');
  console.log(
    chalk.gray(
      'Synchronize your fork/clone with the canonical upstream repository.'
    )
  );
  console.log('');
  console.log(chalk.yellow('Available Actions:'));
  console.log('');

  const actions = [
    ['check', 'Check sync status with upstream (default)'],
    ['pull', 'Pull latest changes from upstream'],
    ['preview', 'Preview changes before pulling'],
    ['config', 'Configure upstream repository']
  ];

  actions.forEach(([action, description]) => {
    console.log(`  ${chalk.cyan(action.padEnd(10))} ${description}`);
  });

  console.log(`\n${chalk.yellow('Examples:')}`);
  console.log(
    `  ${chalk.cyan('sc sync')}                    # Check sync status`
  );
  console.log(`  ${chalk.cyan('sc sync check')}              # Same as above`);
  console.log(
    `  ${chalk.cyan('sc sync preview')}            # Preview changes`
  );
  console.log(
    `  ${chalk.cyan('sc sync config --set-upstream')} # Configure upstream`
  );
  console.log(
    `  ${chalk.cyan('sc sync pull')}               # Pull from upstream`
  );
  console.log(
    `  ${chalk.cyan('sc sync pull --rebase')}      # Pull with rebase`
  );
  console.log('');
  console.log(chalk.yellow('Legacy (global/local sync):'));
  console.log(
    `  ${chalk.cyan('sc sync global')}             # Check global vs local installation`
  );
  console.log(
    `  ${chalk.cyan('sc sync global update')}      # Update global from local`
  );
}

module.exports = repoSyncCommand;
