#!/usr/bin/env node

const { Command } = require('commander');
const FeatureManager = require('../lib/feature/FeatureManager');
const chalk = require('chalk');

const program = new Command();

program
  .name('sc feature')
  .description('Manage feature registry for feature-based commits')
  .version('1.0.0');

/**
 * Add new feature
 */
program
  .command('add <name>')
  .description('Add a new feature to registry')
  .option('--description <text>', 'Feature description')
  .option(
    '--requirements <ids>',
    'Comma-separated requirement IDs (e.g., REQ-042,REQ-043)'
  )
  .option('--owner <email>', 'Feature owner email')
  .action(async (name, options) => {
    try {
      const manager = new FeatureManager();
      const feature = await manager.addFeature(name, {
        description: options.description,
        requirements: options.requirements,
        owner: options.owner
      });

      console.log(chalk.green('✅ Feature added:'), name);
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
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * List features
 */
program
  .command('list')
  .description('List features')
  .option(
    '--status <status>',
    'Filter by status (in-progress, blocked, paused)'
  )
  .action(async (options) => {
    try {
      const manager = new FeatureManager();
      const features = await manager.listFeatures({ status: options.status });

      if (features.length === 0) {
        console.log(chalk.yellow('No features found'));
        return;
      }

      console.log(chalk.bold('\nActive Features:'));
      console.log(chalk.gray('─'.repeat(80)));

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

      // Show statistics
      const stats = await manager.getStatistics();
      console.log(chalk.gray('─'.repeat(80)));
      console.log(
        chalk.cyan(
          `Total active: ${stats.active} | Completed: ${stats.completed}`
        )
      );
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Show feature details
 */
program
  .command('show <name>')
  .description('Show feature details and recent commits')
  .action(async (name) => {
    try {
      const manager = new FeatureManager();
      const feature = await manager.showFeature(name);

      console.log(chalk.bold('\nFeature Details:'));
      console.log(chalk.gray('─'.repeat(80)));
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
        console.log(chalk.gray('─'.repeat(80)));
        for (const commit of feature.recentCommits) {
          console.log(chalk.gray(`  ${commit.hash}`), commit.message);
        }
      } else {
        console.log(chalk.gray('\nNo commits yet for this feature'));
      }

      console.log(chalk.gray('\nView all commits:'));
      console.log(chalk.gray(`  git log --grep="[FEATURE:${name}]"`));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * View feature commits
 */
program
  .command('commits <name>')
  .description('View commits for a feature')
  .option('--limit <number>', 'Limit number of commits', '20')
  .action(async (name, options) => {
    try {
      const manager = new FeatureManager();
      const commits = await manager.getFeatureCommits(name, {
        limit: parseInt(options.limit, 10)
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
      console.log(chalk.gray('─'.repeat(80)));

      for (const commit of commits) {
        console.log(chalk.cyan(commit.hash), commit.message);
      }

      console.log(chalk.gray('\nTotal commits:'), commits.length);
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Complete feature
 */
program
  .command('complete <name>')
  .description('Mark feature as complete (move to completed)')
  .action(async (name) => {
    try {
      const manager = new FeatureManager();
      const feature = await manager.completeFeature(name);

      console.log(chalk.green('✅ Feature completed:'), name);
      console.log(
        chalk.gray(`   Description: ${feature.description || '(none)'}`)
      );
      console.log(
        chalk.gray(
          `   Requirements: ${feature.requirements.join(', ') || '(none)'}`
        )
      );
      console.log(chalk.gray(`   Status: ${feature.status} → completed`));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Remove feature
 */
program
  .command('remove <name>')
  .description('Remove a feature from registry')
  .action(async (name) => {
    try {
      const manager = new FeatureManager();
      await manager.removeFeature(name);

      console.log(chalk.green('✅ Feature removed:'), name);
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Validate commit message
 */
program
  .command('validate-commit <message>')
  .description('Validate a commit message has valid feature tag')
  .action(async (message) => {
    try {
      const manager = new FeatureManager();
      const result = await manager.validateCommitFeatureTag(message);

      if (result.valid) {
        console.log(chalk.green('✅ Valid feature tag:'), result.featureName);
      } else {
        if (!result.hasTag) {
          console.log(chalk.yellow('⚠️'), result.message);
          console.log(chalk.gray('\nRecommended format:'));
          console.log(
            chalk.gray('  [FEATURE:feature-name] REQ-XXX: Description')
          );
        } else {
          console.log(chalk.red('❌'), result.message);
          console.log(chalk.gray('\nAvailable features:'));
          for (const feature of result.availableFeatures) {
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
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Show statistics
 */
program
  .command('stats')
  .description('Show feature statistics')
  .action(async () => {
    try {
      const manager = new FeatureManager();
      const stats = await manager.getStatistics();

      console.log(chalk.bold('\nFeature Statistics:'));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(chalk.cyan(`Active features: ${stats.active}`));
      console.log(chalk.green(`Completed features: ${stats.completed}`));

      if (Object.keys(stats.byStatus).length > 0) {
        console.log(chalk.bold('\nBy Status:'));
        for (const [status, count] of Object.entries(stats.byStatus)) {
          console.log(chalk.gray(`  ${status}: ${count}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
