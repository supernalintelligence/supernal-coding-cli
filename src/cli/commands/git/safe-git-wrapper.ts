/**
 * safe-git-wrapper.js - Git command wrapper with workflow protection
 * Part of enhanced workflow guard system
 */

import { spawn, ChildProcess } from 'node:child_process';
import chalk from 'chalk';

class SafeGitWrapper {
  protected projectRoot: string;
  protected verbose: boolean;

  constructor() {
    this.projectRoot = process.cwd();
    this.verbose =
      process.argv.includes('--verbose') || process.env.SC_VERBOSE === 'true';
  }

  async executeGitCommand(args: string[]): Promise<void> {
    const command = args[0];
    const gitArgs = args.slice(1);

    if (command === 'add') {
      return this.handleGitAdd(gitArgs);
    }

    return this.passThrough(['git', command, ...gitArgs]);
  }

  async handleGitAdd(args: string[]): Promise<void> {
    try {
      const hasForce = args.includes('--force') || args.includes('-f');

      if (hasForce) {
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

      const WorkflowGuard = require('../development/workflow-guard');
      const guard = new WorkflowGuard({
        projectRoot: this.projectRoot,
        verbose: this.verbose
      });

      process.argv = ['node', 'workflow-guard.js', 'pre-add', ...args];

      try {
        await guard.execute('pre-add');
        return this.passThrough(['git', 'add', ...args]);
      } catch (error) {
        console.error(chalk.red('❌ Git add blocked by workflow guard'));
        if (this.verbose) {
          console.error((error as Error).message);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error in git add wrapper:'), (error as Error).message);
      process.exit(1);
    }
  }

  passThrough(command: string[]): void {
    try {
      const result: ChildProcess = spawn(command[0], command.slice(1), {
        stdio: 'inherit',
        cwd: this.projectRoot
      });

      result.on('close', (code) => {
        process.exit(code ?? 0);
      });

      result.on('error', (error) => {
        console.error(chalk.red('❌ Git command failed:'), error.message);
        process.exit(1);
      });
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to execute git command:'),
        (error as Error).message
      );
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(chalk.red('❌ No git command provided'));
    console.log(chalk.blue('Usage: safe-git <command> [args...]'));
    process.exit(1);
  }

  const wrapper = new SafeGitWrapper();
  await wrapper.executeGitCommand(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('❌ Safe git wrapper error:'), error.message);
    process.exit(1);
  });
}

export { SafeGitWrapper };
module.exports = { SafeGitWrapper };
