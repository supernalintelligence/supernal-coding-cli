const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');

/**
 * Multi-repo command handler
 * Manages multiple repositories
 */
async function handleMultiRepoCommand(action, options) {
  switch (action) {
    case 'discover':
      await discoverRepos(options);
      break;
    case 'status':
      await showStatus(options);
      break;
    default:
      console.log(chalk.yellow(`Unknown multi-repo action: ${action}`));
      console.log(chalk.blue('\nAvailable actions:'));
      console.log(
        `${chalk.cyan('  sc multi-repo discover ')}- Discover repositories`
      );
      console.log(
        `${chalk.cyan('  sc multi-repo status   ')}- Show repository status`
      );
      break;
  }
}

async function discoverRepos(_options) {
  console.log(chalk.blue('🔍 Discovering repositories...'));

  const cwd = process.cwd();
  const gitDirs = findGitDirectories(cwd);

  if (gitDirs.length === 0) {
    console.log(chalk.yellow('  No sub-repositories found'));
    return;
  }

  console.log(chalk.green(`\n  Found ${gitDirs.length} repositories:`));
  gitDirs.forEach((dir) => {
    const relativePath = path.relative(cwd, dir);
    console.log(chalk.cyan(`    - ${relativePath || '.'}`));
  });
}

async function showStatus(_options) {
  console.log(chalk.blue('📊 Repository Status:'));

  const cwd = process.cwd();
  const gitDirs = findGitDirectories(cwd);

  if (gitDirs.length === 0) {
    console.log(chalk.yellow('  No git repositories found'));
    return;
  }

  gitDirs.forEach((dir) => {
    const relativePath = path.relative(cwd, dir) || '.';
    console.log(chalk.cyan(`\n  ${relativePath}:`));

    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: dir,
        encoding: 'utf8'
      }).trim();

      const status = execSync('git status --porcelain', {
        cwd: dir,
        encoding: 'utf8'
      });

      console.log(chalk.white(`    Branch: ${branch}`));
      console.log(chalk.white(`    Status: ${status ? 'Modified' : 'Clean'}`));
    } catch (error) {
      console.log(chalk.red(`    Error: ${error.message}`));
    }
  });
}

function findGitDirectories(dir, maxDepth = 3, currentDepth = 0) {
  const results = [];

  if (currentDepth > maxDepth) return results;

  try {
    if (fs.existsSync(path.join(dir, '.git'))) {
      results.push(dir);
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules'
      ) {
        const subDir = path.join(dir, entry.name);
        results.push(...findGitDirectories(subDir, maxDepth, currentDepth + 1));
      }
    }
  } catch (_error) {
    // Ignore permission errors
  }

  return results;
}

module.exports = { handleMultiRepoCommand };
