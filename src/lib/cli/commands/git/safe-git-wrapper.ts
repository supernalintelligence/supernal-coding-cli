#!/usr/bin/env node

// safe-git-wrapper.js - Git command wrapper with workflow protection
// Part of enhanced workflow guard system

const { execSync, spawn } = require('node:child_process');
const _path = require('node:path');
const chalk = require('chalk');

class SafeGitWrapper {
  constructor() {
    this.projectRoot = process.cwd();
    this.verbose =
      process.argv.includes('--verbose') || process.env.SC_VERBOSE === 'true';
  }

  /**
   * Main wrapper for git commands
   */
  async executeGitCommand(args) {
    const command = args[0];
    const gitArgs = args.slice(1);

    // Intercept 'git add' commands
    if (command === 'add') {
      return this.handleGitAdd(gitArgs);
    }

    // For other git commands, pass through directly
    return this.passThrough(['git', command, ...gitArgs]);
  }

  /**
   * Handle git add with workflow protection
   */
  async handleGitAdd(args) {
    try {
      // Check if --force flag is present
      const hasForce = args.includes('--force') || args.includes('-f');

      if (hasForce) {
        // Remove --force flag and pass to real git
        const cleanArgs = args.filter(
          (arg) => arg !== '--force' && arg !== '-f'
        );
        if (this.verbose) {
          console.log(
            chalk.yellow('⚠️  Force flag detected, bypassing workflow guard')
          );
        }
        return this.passThrough(['git', 'add', ...cleanArgs]);
      }

      // Run pre-add validation
      const WorkflowGuard = require('../development/workflow-guard');
      const guard = new WorkflowGuard({
        projectRoot: this.projectRoot,
        verbose: this.verbose
      });

      // Set the files to be added for the guard
      process.argv = ['node', 'workflow-guard.js', 'pre-add', ...args];

      try {
        await guard.execute('pre-add');

        // If validation passes, execute real git add
        return this.passThrough(['git', 'add', ...args]);
      } catch (error) {
        // Validation failed, exit with error
        console.error(chalk.red('❌ Git add blocked by workflow guard'));
        if (this.verbose) {
          console.error(error.message);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error in git add wrapper:'), error.message);
      process.exit(1);
    }
  }

  /**
   * Pass command through to real git
   */
  passThrough(command) {
    try {
      const result = spawn(command[0], command.slice(1), {
        stdio: 'inherit',
        cwd: this.projectRoot
      });

      result.on('close', (code) => {
        process.exit(code);
      });

      result.on('error', (error) => {
        console.error(chalk.red('❌ Git command failed:'), error.message);
        process.exit(1);
      });
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to execute git command:'),
        error.message
      );
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(chalk.red('❌ No git command provided'));
    console.log(chalk.blue('Usage: safe-git <command> [args...]'));
    process.exit(1);
  }

  const wrapper = new SafeGitWrapper();
  await wrapper.executeGitCommand(args);
}

// Execute if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('❌ Safe git wrapper error:'), error.message);
    process.exit(1);
  });
}

module.exports = { SafeGitWrapper };
