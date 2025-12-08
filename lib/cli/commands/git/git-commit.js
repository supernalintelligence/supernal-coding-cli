/**
 * git-commit.js - Safe Git Commit Operations for AI Workflows
 * 
 * Provides safe commit functionality that:
 * 1. Stashes unrelated changes
 * 2. Commits only specified files
 * 3. Restores stashed changes
 * 
 * Usage:
 *   sc git commit --files "file1.ts,file2.ts" --message "feat: description" --ai
 *   sc git commit file1.ts file2.ts --message "feat: description"
 */

const { execSync } = require('node:child_process');
const chalk = require('chalk');
const {
  safeCommit,
  hasUncommittedChanges,
  getModifiedFiles,
  stashExcept,
  popStash
} = require('../../../utils/git-commit-utils');
const { SigningManager } = require('../../../signing');

/**
 * Format commit message with appropriate tags
 */
function formatCommitMessage(message, options = {}) {
  let formatted = message;
  
  // Add AI tag if specified
  if (options.ai) {
    formatted += '\n\n[AI-COMMIT]';
  }
  
  // Add priority tag if specified
  if (options.priority) {
    formatted += '\n\n[PRIORITY-UPDATE]';
  }
  
  return formatted;
}

/**
 * Get files to commit from various input sources
 */
function resolveFiles(filesArg, options) {
  const files = [];
  
  // From positional arguments
  if (filesArg && filesArg.length > 0) {
    files.push(...filesArg);
  }
  
  // From --files option (comma-separated)
  if (options.files) {
    files.push(...options.files.split(',').map(f => f.trim()));
  }
  
  return [...new Set(files)]; // Deduplicate
}

/**
 * Perform safe commit with stash/unstash
 */
async function performSafeCommit(files, message, options = {}) {
  const { dryRun = false, verbose = false } = options;
  
  // Validate inputs
  if (!files || files.length === 0) {
    throw new Error('No files specified. Use: sc git commit file1.ts file2.ts --message "msg"');
  }
  
  if (!message) {
    throw new Error('No commit message. Use: sc git commit --message "feat: description"');
  }
  
  // Check if there are any changes at all
  if (!hasUncommittedChanges()) {
    console.log(chalk.yellow('⚠️  No uncommitted changes to commit'));
    return { success: false, message: 'No changes to commit' };
  }
  
  // Get all modified files
  const allModified = getModifiedFiles();
  
  // Filter to only files that exist in modified list
  const filesToCommit = files.filter(file => 
    allModified.some(m => m === file || m.endsWith(file) || file.endsWith(m))
  );
  
  if (filesToCommit.length === 0) {
    console.log(chalk.yellow('⚠️  None of the specified files have changes'));
    console.log(chalk.gray('Modified files:'));
    allModified.slice(0, 10).forEach(f => console.log(chalk.gray(`  • ${f}`)));
    if (allModified.length > 10) {
      console.log(chalk.gray(`  ... and ${allModified.length - 10} more`));
    }
    return { success: false, message: 'Specified files not modified' };
  }
  
  // Files that will be stashed (not being committed)
  const otherFiles = allModified.filter(f => !filesToCommit.includes(f));
  
  if (verbose || dryRun) {
    console.log(chalk.blue('\n📝 Safe Commit Plan:\n'));
    console.log(chalk.green('Files to commit:'));
    filesToCommit.forEach(f => console.log(chalk.green(`  ✓ ${f}`)));
    
    if (otherFiles.length > 0) {
      console.log(chalk.yellow('\nFiles to stash temporarily:'));
      otherFiles.slice(0, 10).forEach(f => console.log(chalk.yellow(`  ⚡ ${f}`)));
      if (otherFiles.length > 10) {
        console.log(chalk.yellow(`  ... and ${otherFiles.length - 10} more`));
      }
    }
    
    console.log(chalk.gray(`\nMessage: ${message}`));
  }
  
  if (dryRun) {
    console.log(chalk.cyan('\n[DRY RUN] No changes made'));
    return { success: true, message: 'Dry run complete', dryRun: true };
  }
  
  let stashCreated = false;
  let commitHash = null;
  
  try {
    // Step 1: Stage the files we want to commit
    console.log(chalk.blue('\n📦 Staging files...'));
    for (const file of filesToCommit) {
      execSync(`git add "${file}"`, { encoding: 'utf-8' });
    }
    
    // Step 2: Stash everything else if there are other changes
    if (otherFiles.length > 0) {
      console.log(chalk.yellow(`⚡ Stashing ${otherFiles.length} unrelated file(s)...`));
      try {
        const stashResult = execSync(
          'git stash push --keep-index -m "sc-git-commit: auto-stash"',
          { encoding: 'utf-8' }
        );
        stashCreated = stashResult.includes('Saved working directory');
        if (stashCreated && verbose) {
          console.log(chalk.gray('   Stash created successfully'));
        }
      } catch (err) {
        // Stash might fail if nothing to stash after staging
        if (verbose) {
          console.log(chalk.gray('   No additional changes to stash'));
        }
      }
    }
    
    // Step 3: Commit with WIP check bypass and agent signing
    console.log(chalk.blue('📝 Committing...'));
    
    // Get signing flags (SC commits are unsigned by default)
    const signingManager = new SigningManager(process.cwd());
    const signingFlags = signingManager.getSigningFlags({ isAgentCommit: true });
    
    // Add [SC] tag to identify agent commits
    const scMessage = message.startsWith('[SC]') ? message : `[SC] ${message}`;
    
    const commitCmd = `SC_SKIP_WIP_CHECK=true git commit ${signingFlags} -m "${scMessage.replace(/"/g, '\\"')}"`;
    execSync(commitCmd, {
      encoding: 'utf-8',
      shell: true
    });
    
    // Get commit hash
    commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    
    console.log(chalk.green(`\n✅ Committed: ${commitHash}`));
    console.log(chalk.gray(`   ${filesToCommit.length} file(s) committed`));
    
    // Step 4: Restore stash
    if (stashCreated) {
      console.log(chalk.yellow('⚡ Restoring stashed changes...'));
      try {
        execSync('git stash pop', { encoding: 'utf-8' });
        console.log(chalk.gray('   Stash restored successfully'));
      } catch (err) {
        console.log(chalk.red('⚠️  Could not restore stash automatically'));
        console.log(chalk.yellow('   Run: git stash pop'));
      }
    }
    
    return {
      success: true,
      commitHash,
      filesCommitted: filesToCommit.length,
      message: `Committed ${filesToCommit.length} file(s)`
    };
    
  } catch (error) {
    // Try to restore stash on error
    if (stashCreated) {
      console.log(chalk.yellow('\n⚡ Attempting to restore stash after error...'));
      try {
        execSync('git stash pop', { encoding: 'utf-8' });
      } catch (_e) {
        console.log(chalk.red('⚠️  Manual stash recovery needed: git stash pop'));
      }
    }
    
    throw error;
  }
}

/**
 * Show commit help
 */
function showCommitHelp() {
  console.log(chalk.blue.bold('\n📝 sc git commit - Safe Git Commit\n'));
  console.log('Safely commits specific files while preserving other changes.\n');
  
  console.log(chalk.white.bold('Usage:'));
  console.log('  sc git commit <files...> --message "msg" [options]\n');
  
  console.log(chalk.white.bold('Options:'));
  console.log('  -m, --message <msg>    Commit message (required)');
  console.log('  -f, --files <list>     Comma-separated file list');
  console.log('  --ai                   Add [AI-COMMIT] tag');
  console.log('  --priority             Add [PRIORITY-UPDATE] tag');
  console.log('  --dry-run              Show plan without committing');
  console.log('  -v, --verbose          Verbose output\n');
  
  console.log(chalk.white.bold('Examples:'));
  console.log(chalk.gray('  # Commit specific files'));
  console.log('  sc git commit TasksList.tsx parser.js -m "feat: add columns"');
  console.log('');
  console.log(chalk.gray('  # AI-generated commit'));
  console.log('  sc git commit --files "file1.ts,file2.ts" -m "fix: bug" --ai');
  console.log('');
  console.log(chalk.gray('  # Priority update (used by sc priority update --commit)'));
  console.log('  sc git commit docs/req*.md -m "chore: update priorities" --priority');
  console.log('');
  console.log(chalk.gray('  # Dry run to see what would happen'));
  console.log('  sc git commit *.tsx -m "feat: ui" --dry-run');
  console.log('');
}

/**
 * Main handler for sc git <action>
 */
async function handleGitCommand(action, files, options) {
  switch (action) {
    case 'commit': {
      // If no message but has files, show help
      if (!options.message && files.length === 0) {
        showCommitHelp();
        return;
      }
      
      const resolvedFiles = resolveFiles(files, options);
      const message = formatCommitMessage(options.message || '', options);
      
      const result = await performSafeCommit(resolvedFiles, message, {
        dryRun: options.dryRun,
        verbose: options.verbose,
        auto: options.auto
      });
      
      if (!result.success && !result.dryRun) {
        process.exit(1);
      }
      break;
    }
    
    case 'status': {
      // Show current git status with modified files
      const modified = getModifiedFiles();
      console.log(chalk.blue('\n📋 Modified Files:\n'));
      if (modified.length === 0) {
        console.log(chalk.green('  No modified files'));
      } else {
        modified.forEach(f => console.log(`  • ${f}`));
        console.log(chalk.gray(`\nTotal: ${modified.length} file(s)`));
      }
      break;
    }
    
    case 'help':
    default:
      showCommitHelp();
      break;
  }
}

module.exports = {
  handleGitCommand,
  performSafeCommit,
  formatCommitMessage
};

