/**
 * merge-safe.js - Safe merge command for SC system
 * Integrates with git-smart for comprehensive merge workflow
 */

import chalk from 'chalk';
const GitSmart = require('./git-smart');

interface MergeOptions {
  branch?: string | null;
  autoPush?: boolean;
  deleteLocal?: boolean;
  verbose?: boolean;
  interactive?: boolean;
}

interface MergeResult {
  success: boolean;
  cancelled?: boolean;
  requirement?: string;
  branchMerged?: string;
}

class SafeMerge {
  protected gitSmart: typeof GitSmart;

  constructor() {
    this.gitSmart = new GitSmart();
  }

  async performMerge(options: MergeOptions = {}): Promise<MergeResult> {
    const {
      branch = null,
      autoPush = false,
      deleteLocal = false,
      verbose = true,
      interactive = false
    } = options;

    console.log(chalk.blue('\n🔄 SAFE MERGE WORKFLOW\n'));

    if (interactive) {
      const inquirer = require('inquirer');

      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceedWithMerge',
          message: 'Have you tested your changes and resolved any issues?',
          default: false
        },
        {
          type: 'confirm',
          name: 'pushToRemote',
          message: 'Push to remote after successful merge?',
          default: autoPush,
          when: (a: { proceedWithMerge: boolean }) => a.proceedWithMerge
        },
        {
          type: 'confirm',
          name: 'deleteLocalBranch',
          message: 'Delete local feature branch after merge?',
          default: deleteLocal,
          when: (a: { proceedWithMerge: boolean }) => a.proceedWithMerge
        }
      ]);

      if (!answers.proceedWithMerge) {
        console.log(chalk.yellow('❌ Merge cancelled by user'));
        return { success: false, cancelled: true };
      }

      options.autoPush = answers.pushToRemote;
      options.deleteLocal = answers.deleteLocalBranch;
    }

    const result: MergeResult = this.gitSmart.performSafeMerge(branch, {
      autoPush: options.autoPush,
      deleteLocal: options.deleteLocal,
      verbose
    });

    if (result.success) {
      console.log(chalk.green('\n🎉 MERGE WORKFLOW COMPLETED'));

      console.log(chalk.blue('\n📋 Next Steps:'));
      console.log('   ✅ Feature branch merged successfully');

      if (result.requirement) {
        console.log(`   ✅ Requirement ${result.requirement} updated`);
      }

      if (options.autoPush) {
        console.log('   ✅ Changes pushed to remote');
      } else {
        console.log('   💡 Consider pushing to remote: git push origin main');
      }

      if (!options.deleteLocal && result.branchMerged !== 'main') {
        console.log(
          `   💡 Clean up local branch: git branch -d ${result.branchMerged}`
        );
      }
    }

    return result;
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const branch = args.find((arg) => !arg.startsWith('--')) || null;
  const autoPush = args.includes('--auto-push') || args.includes('--push');
  const deleteLocal =
    args.includes('--delete-local') || args.includes('--delete');
  const interactive = args.includes('--interactive') || args.includes('-i');
  const quiet = args.includes('--quiet') || args.includes('-q');

  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n🚀 Safe Merge Command\n');
    console.log('Usage: sc merge-safe [branch] [options]\n');
    console.log('Options:');
    console.log('  --auto-push, --push        Push to remote after merge');
    console.log('  --delete-local, --delete   Delete local branch after merge');
    console.log('  --interactive, -i          Interactive mode with prompts');
    console.log('  --quiet, -q               Minimize output');
    console.log('  --help, -h                Show this help\n');
    console.log('Examples:');
    console.log(
      '  sc merge-safe                              # Merge current branch'
    );
    console.log(
      '  sc merge-safe feature/req-043-security     # Merge specific branch'
    );
    console.log(
      '  sc merge-safe --auto-push --delete-local   # Full automation'
    );
    console.log(
      '  sc merge-safe -i                           # Interactive mode'
    );
    console.log('');
    return;
  }

  const safeMerge = new SafeMerge();

  (async () => {
    try {
      const result = await safeMerge.performMerge({
        branch,
        autoPush,
        deleteLocal,
        verbose: !quiet,
        interactive
      });

      if (!result.success && !result.cancelled) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${(error as Error).message}`));
      process.exit(1);
    }
  })();
}

if (require.main === module) {
  main();
}

export default SafeMerge;
module.exports = SafeMerge;
