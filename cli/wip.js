#!/usr/bin/env node

const { Command } = require('commander');
const WipManager = require('../lib/wip/WipManager');
const chalk = require('chalk');

const program = new Command();

program
  .name('sc wip')
  .description('Manage work-in-progress files via WIP registry')
  .version('1.0.0');

/**
 * Register file in WIP registry
 */
program
  .command('register <file>')
  .description('Register a file in WIP registry')
  .requiredOption('--feature <name>', 'Feature name')
  .requiredOption('--requirement <id>', 'Requirement ID (e.g., REQ-042)')
  .option('--reason <text>', 'Reason for WIP tracking', 'Work in progress')
  .option('--notes <text>', 'Additional notes')
  .option(
    '--userid <username>',
    'GitHub username (auto-detected if not provided)'
  )
  .option('--add-comment', 'Add WIP comment to file')
  .option('--no-auto-cleanup', 'Disable auto-cleanup')
  .action(async (file, options) => {
    try {
      const manager = new WipManager();
      const entry = await manager.register(file, {
        feature: options.feature,
        requirement: options.requirement,
        reason: options.reason,
        notes: options.notes,
        userid: options.userid,
        addComment: options.addComment,
        autoCleanup: options.autoCleanup
      });

      console.log(chalk.green('✅ Registered in WIP registry:'), file);
      console.log(chalk.gray(`   Feature: ${entry.feature}`));
      console.log(chalk.gray(`   Requirement: ${entry.requirement}`));
      console.log(chalk.gray(`   User: @${entry.userid}`));
      console.log(chalk.gray(`   Reason: ${entry.reason}`));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Unregister file from WIP registry
 */
program
  .command('unregister <file>')
  .description('Unregister a file from WIP registry')
  .option('--quiet', 'Suppress output')
  .action(async (file, options) => {
    try {
      const manager = new WipManager();
      const result = await manager.unregister(file, options);

      if (!options.quiet) {
        if (result.removed) {
          console.log(chalk.green('✅ De-registered from WIP registry:'), file);
        } else {
          console.log(
            chalk.yellow('⚠️'),
            result.message || `File not in WIP registry: ${file}`
          );
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * List WIP-tracked files
 */
program
  .command('list')
  .description('List WIP-tracked files')
  .option('--older-than <days>', 'Filter files older than N days (e.g., "7d")')
  .option('--userid <username>', 'Filter by user')
  .option('--me', 'Show only files registered by current user')
  .option('--unassigned', 'Show only unassigned files')
  .option('--paths-only', 'Output paths only')
  .action(async (options) => {
    try {
      const manager = new WipManager();
      const files = await manager.list({
        olderThan: options.olderThan
          ? options.olderThan.replace('d', '')
          : null,
        userid: options.userid,
        me: options.me,
        unassigned: options.unassigned,
        pathsOnly: options.pathsOnly
      });

      if (options.pathsOnly) {
        files.forEach((path) => console.log(path));
      } else {
        if (files.length === 0) {
          console.log(chalk.green('✅ No WIP-tracked files'));
          return;
        }

        console.log(chalk.bold('\nWIP-Tracked Files:'));
        console.log(chalk.gray('─'.repeat(80)));

        for (const file of files) {
          const age = Math.floor(
            (Date.now() - new Date(file.last_modified)) / (1000 * 60 * 60 * 24)
          );
          const ageStr =
            age > 0 ? chalk.yellow(`${age}d ago`) : chalk.green('today');
          const userStr = file.userid
            ? chalk.cyan(`@${file.userid}`)
            : chalk.gray('unassigned');

          console.log(chalk.cyan(file.path));
          console.log(
            chalk.gray(
              `  Feature: ${file.feature} | Requirement: ${file.requirement} | User: ${userStr}`
            )
          );
          console.log(
            chalk.gray(`  Reason: ${file.reason} | Modified: ${ageStr}`)
          );

          if (age > 3) {
            console.log(
              chalk.yellow(`  ⚠️  OLD - Consider committing or removing`)
            );
          }
          console.log();
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Show WIP registry status
 */
program
  .command('status')
  .description('Show WIP registry status')
  .action(async () => {
    try {
      const manager = new WipManager();
      const status = await manager.status();
      const stats = await manager.getStatsByUser();

      console.log(chalk.bold('\nWIP Registry Status:'));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(chalk.cyan(`Total files: ${status.total}`));
      console.log(
        chalk.green(`Active (< ${status.warnDays} days): ${status.active}`)
      );
      console.log(
        chalk.yellow(`Old (> ${status.warnDays} days): ${status.old}`)
      );

      // Show stats by user
      console.log(chalk.bold('\nBy User:'));
      for (const [user, userStats] of Object.entries(stats)) {
        const userColor = userStats.old > 0 ? chalk.yellow : chalk.green;
        console.log(
          userColor(
            `  @${user}: ${userStats.total} files` +
              (userStats.old > 0 ? ` (${userStats.old} old)` : '')
          )
        );
      }

      if (status.old > 0) {
        console.log(chalk.yellow('\n⚠️  Old files need attention:'));
        for (const file of status.oldFiles) {
          const userStr = file.userid ? `@${file.userid}` : 'Unassigned';
          console.log(
            chalk.gray(
              `  ${file.path} (${file.age} days old) - Feature: ${file.feature} - User: ${userStr}`
            )
          );
        }
        console.log(chalk.gray('\nConsider:'));
        console.log(chalk.gray('  - Committing them if ready'));
        console.log(chalk.gray('  - Removing them if not needed'));
        console.log(
          chalk.gray('  - Touching them if still working: sc wip touch <file>')
        );
      } else {
        console.log(chalk.green('\n✅ All files are active'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Touch file (update timestamp)
 */
program
  .command('touch <file>')
  .description('Update last modified timestamp (indicate still working)')
  .action(async (file) => {
    try {
      const manager = new WipManager();
      await manager.touch(file);

      console.log(chalk.green('✅ Updated timestamp:'), file);
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Cleanup old files
 */
program
  .command('cleanup')
  .description('Clean up old WIP-tracked files')
  .option(
    '--older-than <days>',
    'Clean files older than N days (e.g., "7d")',
    '7d'
  )
  .option('--dry-run', 'Show what would be cleaned without actually doing it')
  .option('--force', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      const manager = new WipManager();
      const result = await manager.cleanup({
        olderThan: options.olderThan.replace('d', ''),
        dryRun: options.dryRun,
        force: options.force
      });

      if (result.cleaned === 0) {
        console.log(chalk.green('✅'), result.message);
      } else {
        console.log(chalk.green(`✅ Cleaned ${result.cleaned} file(s)`));

        if (options.dryRun) {
          console.log(chalk.yellow('\n(Dry run - no changes made)'));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Check for untracked files
 */
program
  .command('check')
  .description('Check for untracked files not in WIP registry')
  .action(async () => {
    try {
      const manager = new WipManager();
      const check = await manager.checkUntracked();

      console.log(chalk.bold('\nUntracked Files Check:'));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(chalk.cyan(`Total untracked files: ${check.untracked}`));
      console.log(chalk.green(`WIP-tracked: ${check.wipTracked}`));
      console.log(chalk.yellow(`Not WIP-tracked: ${check.notWipTracked}`));

      if (check.notWipTracked > 0) {
        console.log(chalk.yellow('\n⚠️  Files not in WIP registry:'));
        for (const file of check.files) {
          console.log(chalk.gray(`  ${file}`));
        }
        console.log(chalk.gray('\nRegister them with:'));
        console.log(
          chalk.gray(
            '  sc wip register <file> --feature=<name> --requirement=REQ-XXX [--userid=<username>]'
          )
        );
      } else {
        console.log(chalk.green('\n✅ All untracked files are WIP-tracked'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Show statistics by user
 */
program
  .command('stats')
  .description('Show WIP registry statistics by user')
  .action(async () => {
    try {
      const manager = new WipManager();
      const stats = await manager.getStatsByUser();
      const registry = await manager.loadRegistry();

      console.log(chalk.bold('\nWIP Registry Statistics:'));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(chalk.cyan(`Total files: ${registry.files.length}`));
      console.log(chalk.bold('\nBy User:'));

      // Sort by total files descending
      const sorted = Object.entries(stats).sort(
        ([, a], [, b]) => b.total - a.total
      );

      for (const [user, userStats] of sorted) {
        const userColor = userStats.old > 0 ? chalk.yellow : chalk.green;
        console.log(
          userColor(
            `  @${user}: ${userStats.total} files` +
              (userStats.old > 0 ? ` (${userStats.old} old)` : '')
          )
        );
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Reassign file to different user
 */
program
  .command('reassign <file>')
  .description('Reassign file to different user')
  .requiredOption('--to <userid>', 'New userid')
  .action(async (file, options) => {
    try {
      const manager = new WipManager();
      const result = await manager.reassign(file, options.to);

      console.log(chalk.green('✅ Reassigned file:'), file);
      console.log(chalk.gray(`   From: @${result.oldUserid || 'unassigned'}`));
      console.log(chalk.gray(`   To: @${result.newUserid}`));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
