/**
 * Multi-Repo Workspace CLI Commands
 * sc workspace <command>
 */

import { Command } from 'commander';
import chalk from 'chalk';
const WorkspaceManager = require('../../workspace/WorkspaceManager');

interface InitOptions {
  name: string;
  type?: string;
  description?: string;
}

interface LinkOptions {
  parent: string;
}

interface StatusOptions {
  json?: boolean;
}

interface InitResult {
  workspace: string;
  structure: {
    handoffs: string;
    dependencies: string;
  };
}

interface LinkResult {
  workspace: string;
  repo: string;
}

interface UnlinkResult {
  repo: string;
}

interface RepoStatus {
  name: string;
  type: string;
  exists: boolean;
  path?: string;
  active_handoffs?: number;
  blocked_by?: string[];
}

interface WorkspaceStatus {
  workspace: string;
  type: string;
  total_repos: number;
  existing_repos: number;
  repos: RepoStatus[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const program = new Command();

program
  .name('workspace')
  .description('Multi-repo workspace coordination')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new multi-repo workspace')
  .requiredOption('--name <name>', 'Workspace name')
  .option('--type <type>', 'Workspace type', 'multi-repo')
  .option('--description <desc>', 'Workspace description')
  .action(async (options: InitOptions) => {
    try {
      const manager = new WorkspaceManager();
      const result: InitResult = await manager.init(options);

      console.log(chalk.green.bold('✅ Workspace initialized!'));
      console.log(chalk.blue('\n📁 Structure created:'));
      console.log(chalk.gray(`   Workspace file: ${result.workspace}`));
      console.log(chalk.gray(`   Handoffs: ${result.structure.handoffs}`));
      console.log(
        chalk.gray(`   Dependencies: ${result.structure.dependencies}`)
      );
      console.log(chalk.blue('\n📝 Next steps:'));
      console.log(chalk.gray('   1. cd into each repo'));
      console.log(
        chalk.gray('   2. Run: sc workspace link --parent=<path-to-workspace>')
      );
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('link')
  .description('Link this repo to a workspace')
  .requiredOption('--parent <path>', 'Path to workspace directory')
  .action(async (options: LinkOptions) => {
    try {
      const manager = new WorkspaceManager();
      const result: LinkResult = await manager.link(options);

      console.log(chalk.green.bold('✅ Repository linked!'));
      console.log(chalk.blue(`   Workspace: ${result.workspace}`));
      console.log(chalk.blue(`   Repo: ${result.repo}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('unlink')
  .description('Unlink this repo from its workspace')
  .action(async () => {
    try {
      const manager = new WorkspaceManager();
      const result: UnlinkResult = await manager.unlink();

      console.log(chalk.green.bold('✅ Repository unlinked!'));
      console.log(chalk.blue(`   Repo: ${result.repo}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show workspace status and repo list')
  .option('--json', 'Output as JSON')
  .action(async (options: StatusOptions) => {
    try {
      const manager = new WorkspaceManager();
      const status: WorkspaceStatus = await manager.status(options);

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      console.log(chalk.bold.blue(`\n📊 Workspace: ${status.workspace}`));
      console.log(chalk.gray(`   Type: ${status.type}`));
      console.log(chalk.gray(`   Total repos: ${status.total_repos}`));
      console.log(chalk.gray(`   Existing repos: ${status.existing_repos}`));

      console.log(chalk.bold.blue('\n   Repositories:'));
      status.repos.forEach((repo) => {
        const icon = repo.exists ? '✅' : '❌';
        console.log(chalk.gray(`   ${icon} ${repo.name} (${repo.type})`));
        if (repo.exists) {
          console.log(chalk.gray(`      Path: ${repo.path}`));
          if (repo.active_handoffs && repo.active_handoffs > 0) {
            console.log(
              chalk.yellow(`      Active handoffs: ${repo.active_handoffs}`)
            );
          }
          if (repo.blocked_by && repo.blocked_by.length > 0) {
            console.log(
              chalk.red(`      Blocked by: ${repo.blocked_by.join(', ')}`)
            );
          }
        }
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate workspace configuration')
  .action(async () => {
    try {
      const manager = new WorkspaceManager();
      const result: ValidationResult = await manager.validate();

      if (result.valid) {
        console.log(chalk.green.bold('✅ Workspace configuration is valid'));
      } else {
        console.log(chalk.red.bold('❌ Validation errors:'));
        result.errors.forEach((error) => {
          console.log(chalk.red(`   - ${error}`));
        });
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), (error as Error).message);
      process.exit(1);
    }
  });

if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);

export default program;
module.exports = program;
