import { Command } from 'commander';
import chalk from 'chalk';

const FeatureManager = require('../feature/FeatureManager');

interface Feature {
  name: string;
  description?: string;
  requirements: string[];
  status: string;
  created: string;
  owner?: string;
  recentCommits?: Array<{ hash: string; message: string }>;
}

interface AddOptions {
  description?: string;
  requirements?: string;
  owner?: string;
}

interface ListOptions {
  status?: string;
}

interface CommitsOptions {
  limit?: string;
}

interface Statistics {
  active: number;
  completed: number;
  byStatus: Record<string, number>;
}

interface ValidationResult {
  valid: boolean;
  hasTag: boolean;
  featureName?: string;
  message?: string;
  availableFeatures?: string[];
}

interface Commit {
  hash: string;
  message: string;
}

const program = new Command();

program
  .name('sc feature')
  .description('Manage feature registry for feature-based commits')
  .version('1.0.0');

program
  .command('add <name>')
  .description('Add a new feature to registry')
  .option('--description <text>', 'Feature description')
  .option(
    '--requirements <ids>',
    'Comma-separated requirement IDs (e.g., REQ-042,REQ-043)'
  )
  .option('--owner <email>', 'Feature owner email')
  .action(async (name: string, options: AddOptions) => {
    try {
      const manager = new FeatureManager();
      const feature: Feature = await manager.addFeature(name, {
        description: options.description,
        requirements: options.requirements,
        owner: options.owner
      });

      console.log(chalk.green('[OK] Feature added:'), name);
      console.log(
        chalk.gray(`   Description: ${feature.description || '(none)'}`)
      );
      console.log(
        chalk.gray(
          `   Requirements: ${feature.requirements.join(', ') || '(none)'}`
        )
      );
      console.log(chalk.gray(`   Status: ${feature.status}`));
      console.log();
      console.log(chalk.cyan('Use in commits:'));
      console.log(
        chalk.gray(`   git commit -m "[FEATURE:${name}] REQ-XXX: Description"`)
      );
    } catch (error) {
      console.error(chalk.red('[ERROR]'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List features')
  .option(
    '--status <status>',
    'Filter by status (in-progress, blocked, paused)'
  )
  .action(async (options: ListOptions) => {
    try {
      const manager = new FeatureManager();
      const features: Feature[] = await manager.listFeatures({ status: options.status });

      if (features.length === 0) {
        console.log(chalk.yellow('No features found'));
        return;
      }

      console.log(chalk.bold('\nActive Features:'));
      console.log(chalk.gray('-'.repeat(80)));

      for (const feature of features) {
        console.log(chalk.cyan.bold(feature.name));
        console.log(
          chalk.gray(`  Description: ${feature.description || '(none)'}`)
        );
        console.log(
          chalk.gray(
            `  Requirements: ${feature.requirements.join(', ') || '(none)'}`
          )
        );
        console.log(
          chalk.gray(
            `  Status: ${feature.status} | Created: ${feature.created}`
          )
        );
        if (feature.owner) {
          console.log(chalk.gray(`  Owner: ${feature.owner}`));
        }
        console.log();
      }

      const stats: Statistics = await manager.getStatistics();
      console.log(chalk.gray('-'.repeat(80)));
      console.log(
        chalk.cyan(
          `Total active: ${stats.active} | Completed: ${stats.completed}`
        )
      );
    } catch (error) {
      console.error(chalk.red('[ERROR]'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('show <name>')
  .description('Show feature details and recent commits')
  .action(async (name: string) => {
    try {
      const manager = new FeatureManager();
      const feature: Feature = await manager.showFeature(name);

      console.log(chalk.bold('\nFeature Details:'));
      console.log(chalk.gray('-'.repeat(80)));
      console.log(chalk.cyan.bold('Name:'), feature.name);
      console.log(chalk.cyan('Description:'), feature.description || '(none)');
      console.log(
        chalk.cyan('Requirements:'),
        feature.requirements.join(', ') || '(none)'
      );
      console.log(chalk.cyan('Status:'), feature.status);
      console.log(chalk.cyan('Created:'), feature.created);
      if (feature.owner) {
        console.log(chalk.cyan('Owner:'), feature.owner);
      }

      if (feature.recentCommits && feature.recentCommits.length > 0) {
        console.log(chalk.bold('\nRecent Commits:'));
        console.log(chalk.gray('-'.repeat(80)));
        for (const commit of feature.recentCommits) {
          console.log(chalk.gray(`  ${commit.hash}`), commit.message);
        }
      } else {
        console.log(chalk.gray('\nNo commits yet for this feature'));
      }

      console.log(chalk.gray('\nView all commits:'));
      console.log(chalk.gray(`  git log --grep="[FEATURE:${name}]"`));
    } catch (error) {
      console.error(chalk.red('[ERROR]'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('commits <name>')
  .description('View commits for a feature')
  .option('--limit <number>', 'Limit number of commits', '20')
  .action(async (name: string, options: CommitsOptions) => {
    try {
      const manager = new FeatureManager();
      const commits: Commit[] = await manager.getFeatureCommits(name, {
        limit: parseInt(options.limit || '20', 10)
      });

      if (commits.length === 0) {
        console.log(chalk.yellow(`No commits found for feature: ${name}`));
        console.log(chalk.gray('\nCommit with:'));
        console.log(
          chalk.gray(`  git commit -m "[FEATURE:${name}] REQ-XXX: Description"`)
        );
        return;
      }

      console.log(chalk.bold(`\nCommits for feature: ${name}`));
      console.log(chalk.gray('-'.repeat(80)));

      for (const commit of commits) {
        console.log(chalk.cyan(commit.hash), commit.message);
      }

      console.log(chalk.gray('\nTotal commits:'), commits.length);
    } catch (error) {
      console.error(chalk.red('[ERROR]'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('complete <name>')
  .description('Mark feature as complete (move to completed)')
  .action(async (name: string) => {
    try {
      const manager = new FeatureManager();
      const feature: Feature = await manager.completeFeature(name);

      console.log(chalk.green('[OK] Feature completed:'), name);
      console.log(
        chalk.gray(`   Description: ${feature.description || '(none)'}`)
      );
      console.log(
        chalk.gray(
          `   Requirements: ${feature.requirements.join(', ') || '(none)'}`
        )
      );
      console.log(chalk.gray(`   Status: ${feature.status} -> completed`));
    } catch (error) {
      console.error(chalk.red('[ERROR]'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('remove <name>')
  .description('Remove a feature from registry')
  .action(async (name: string) => {
    try {
      const manager = new FeatureManager();
      await manager.removeFeature(name);

      console.log(chalk.green('[OK] Feature removed:'), name);
    } catch (error) {
      console.error(chalk.red('[ERROR]'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('validate-commit <message>')
  .description('Validate a commit message has valid feature tag')
  .action(async (message: string) => {
    try {
      const manager = new FeatureManager();
      const result: ValidationResult = await manager.validateCommitFeatureTag(message);

      if (result.valid) {
        console.log(chalk.green('[OK] Valid feature tag:'), result.featureName);
      } else {
        if (!result.hasTag) {
          console.log(chalk.yellow('[WARN]'), result.message);
          console.log(chalk.gray('\nRecommended format:'));
          console.log(
            chalk.gray('  [FEATURE:feature-name] REQ-XXX: Description')
          );
        } else {
          console.log(chalk.red('[ERROR]'), result.message);
          console.log(chalk.gray('\nAvailable features:'));
          for (const feature of result.availableFeatures || []) {
            console.log(chalk.gray(`  - ${feature}`));
          }
          console.log(chalk.gray('\nAdd feature:'));
          console.log(
            chalk.gray(
              `  sc feature add ${result.featureName} --description="..."`
            )
          );
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('[ERROR]'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show feature statistics')
  .action(async () => {
    try {
      const manager = new FeatureManager();
      const stats: Statistics = await manager.getStatistics();

      console.log(chalk.bold('\nFeature Statistics:'));
      console.log(chalk.gray('-'.repeat(80)));
      console.log(chalk.cyan(`Active features: ${stats.active}`));
      console.log(chalk.green(`Completed features: ${stats.completed}`));

      if (Object.keys(stats.byStatus).length > 0) {
        console.log(chalk.bold('\nBy Status:'));
        for (const [status, count] of Object.entries(stats.byStatus)) {
          console.log(chalk.gray(`  ${status}: ${count}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('[ERROR]'), (error as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);

export default program;
