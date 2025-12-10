#!/usr/bin/env node
// @ts-nocheck

/**
 * SC CLI Program - Minimal, Fast Implementation
 *
 * Design principles:
 * 1. Commander does ALL parsing - no manual flag handling
 * 2. Thin command layer - just routing
 * 3. Business logic in separate services
 * 4. Lazy-load heavy dependencies
 */

const { Command } = require('commander');
const chalk = require('chalk');
const _path = require('node:path');

// Lazy-load helpers to speed up startup
let findGitRoot;
const getProjectRoot = () => {
  if (!findGitRoot) {
    findGitRoot = require('./utils/git-utils').findGitRoot;
  }
  return findGitRoot();
};

// Lazy-load CommandInterceptor for rule change detection
let CommandInterceptor;
const getCommandInterceptor = () => {
  if (!CommandInterceptor) {
    CommandInterceptor = require('./commands/rules/command-interceptor');
  }
  return CommandInterceptor;
};

function buildProgram() {
  const program = new Command();

  program
    .name('sc')
    .description('Supernal Coding - Development workflow automation')
    .version(require('../../package.json').version)
    .option('-Y, --yes-to-rules', 'Bypass rule change consent prompts');

  // ============================================================================
  // RULE CHANGE DETECTION INTERCEPTOR (REQ-065)
  // ============================================================================
  // Hook that runs before every command to check for rule changes
  program.hook('preAction', async (_thisCommand, actionCommand) => {
    // Store start time for telemetry
    actionCommand._startTime = Date.now();

    // Skip interception for excluded commands and test environments
    const skipCommands = ['config', 'privacy', 'help', 'version', 'telemetry'];
    const isSkipCommand = skipCommands.some((cmd) =>
      actionCommand.name().includes(cmd)
    );

    if (
      isSkipCommand ||
      process.env.NODE_ENV === 'test' ||
      process.env.CI === 'true'
    ) {
      return;
    }

    try {
      const InterceptorClass = getCommandInterceptor();
      const interceptor = new InterceptorClass({
        projectRoot: process.cwd(),
        bypassFlag:
          actionCommand.opts().Y ||
          actionCommand.opts()['yes-to-rules'] ||
          false,
        commandName: actionCommand.name()
      });

      const result = await interceptor.interceptCommand(
        actionCommand.name(),
        actionCommand.args
      );

      if (!result.shouldProceed) {
        console.log(chalk.yellow('⚠️  Command execution cancelled'));
        process.exit(0); // Exit gracefully
      }
    } catch (error) {
      // Log but don't block command execution if interceptor fails
      if (process.env.DEBUG) {
        console.error(
          chalk.yellow(`⚠️  Rule detection error: ${error.message}`)
        );
      }
    }
  });

  // ============================================================================
  // TELEMETRY HOOK (Post-Action)
  // ============================================================================
  // Hook that runs after every command to record telemetry
  program.hook('postAction', async (_thisCommand, actionCommand) => {
    // Skip telemetry for excluded commands
    const skipCommands = ['telemetry', 'help', 'version'];
    const isSkipCommand = skipCommands.some((cmd) =>
      actionCommand.name().includes(cmd)
    );

    if (isSkipCommand || process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      const telemetry = require('../telemetry');
      if (await telemetry.isEnabled()) {
        const duration = actionCommand._startTime
          ? Date.now() - actionCommand._startTime
          : 0;
        await telemetry.recordCommand(
          actionCommand.name(),
          actionCommand.args[0], // subcommand
          Object.keys(actionCommand.opts()),
          { success: true, duration }
        );
      }
    } catch (error) {
      // Silent fail - don't block on telemetry errors
      if (process.env.DEBUG) {
        console.error(chalk.gray(`Telemetry error: ${error.message}`));
      }
    }
  });

  // ============================================================================
  // REQUIREMENT COMMAND - Fixed implementation
  // ============================================================================
  program
    .command('requirement <action>')
    .alias('req')
    .description('Manage requirements')
    .argument('[args...]', 'Action-specific arguments (ID, title, etc)')
    .option(
      '--epic <name>',
      'Epic name (kebab-case) - for centralized requirements'
    )
    .option(
      '--feature-path <path>',
      'Feature path (domain/feature-name) - for co-located requirements'
    )
    .option(
      '--category <name>',
      'Category for centralized requirements (overrides epic)'
    )
    .option('--priority <level>', 'Priority: critical|high|medium|low')
    .option(
      '--request-type <type>',
      'Type: feature|bug|enhancement|maintenance'
    )
    .option('--status <status>', 'Status for update action')
    .option('--force', 'Force operation (for delete)')
    .option('-f, --format <type>', 'Output format (json, table, csv)')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, args, options) => {
      try {
        // Lazy load to speed up startup
        const { handleRequirementCommand } = require('./commands/requirement');
        await handleRequirementCommand(action, args, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // VALIDATE COMMAND - Simple, working
  // ============================================================================
  program
    .command('validate')
    .description('Validate current installation')
    .option('-v, --verbose', 'Show detailed validation information')
    .option('--requirements', 'Validate requirements files')
    .option('--docs', 'Validate documentation files')
    .option('--tests', 'Validate test files')
    .option('--config', 'Validate configuration')
    .option('--all', 'Validate everything')
    .option('--fix', 'Automatically fix validation errors where possible')
    .option('--dry-run', 'Preview fixes without applying them (use with --fix)')
    .option(
      '--log-file <path>',
      'Save full validation results to file (default: doc-validation.log)'
    )
    .action(async (options) => {
      try {
        const ValidatorManager = require('./commands/validate');
        await ValidatorManager.main(options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // PRIORITY COMMAND - Requirement prioritization management
  // ============================================================================
  program
    .command('priority <action>')
    .description('Priority management for requirements')
    .option('-n, --limit <number>', 'Limit number of items to show')
    .option('--all', 'Show all items by priority level')
    .option('--commit', 'Auto-commit changes after update')
    .option('--file <path>', 'Specific file to process')
    .option('--dry-run', 'Show what would change without applying')
    .action(async (action, options) => {
      try {
        const priorityModule = require('./commands/kanban/priority');
        await priorityModule.main(action, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // FEATURE MANAGEMENT COMMANDS
  // ============================================================================
  program
    .command('feature <action>')
    .description('Manage features in the feature-by-phase system')
    .argument('[feature-id]', 'Feature identifier (for validate, move, etc)')
    .option('--fix', 'Automatically fix validation errors (validate action)')
    .option(
      '--move',
      'Use git mv to move features to correct phase folder when fixing (use with --fix)'
    )
    .option(
      '--commit',
      'Automatically commit fixes after auto-fix (validate action)'
    )
    .option('--quiet', 'Minimal output for git hooks (validate action)')
    .option('--all', 'Apply to all features (validate action)')
    .option('--phase <phase>', 'Target phase (for move/create action)')
    .option('--id <id>', 'Feature ID (for create action)')
    .option('--domain <domain>', 'Domain name (for create action with sync)')
    .option('--title <title>', 'Human-readable title (for create action)')
    .option('--epic <epic>', 'Epic name (for create action)')
    .option('--priority <priority>', 'Priority level (for create action)')
    .option('--assignee <assignee>', 'GitHub username (for create action)')
    .option(
      '--requirements <reqs>',
      'Comma-separated requirement IDs (for create action)'
    )
    .option('--minimal', 'Create minimal structure (for create action)')
    .option('--dry-run', 'Show what would be done (for sync action)')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, featureId, options) => {
      try {
        const projectRoot = getProjectRoot();

        switch (action) {
          case 'create': {
            const featureName = options.id || featureId;
            if (!featureName) {
              console.error(chalk.red('❌ Feature ID required'));
              console.error(
                chalk.gray(
                  'Usage: sc feature create --id=<name> --domain=<domain>'
                )
              );
              process.exit(1);
            }

            // If domain is provided, use new sync system (creates in both registry and docs)
            if (options.domain) {
              const FeatureDocumentSync = require('../feature/FeatureDocumentSync');
              const sync = new FeatureDocumentSync(projectRoot);

              const requirements = options.requirements
                ? options.requirements.split(',').map((r) => r.trim())
                : [];

              const result = await sync.createFeature(
                featureName,
                options.domain,
                {
                  title: options.title,
                  epic: options.epic,
                  priority: options.priority || 'medium',
                  phase: options.phase || 'planning',
                  owner: options.assignee,
                  requirements
                }
              );

              console.log(chalk.green(`✅ Feature created: ${result.name}`));
              console.log(chalk.gray(`   Domain: ${result.domain}`));
              console.log(chalk.gray(`   Docs: ${result.path}/`));
              console.log(chalk.gray(`   Registry: .supernal/features.yaml`));
              console.log();
              console.log(chalk.blue('Next steps:'));
              console.log(
                chalk.white('  1. Edit README.md with feature details')
              );
              console.log(
                chalk.white('  2. Create requirements in requirements/')
              );
              console.log(chalk.white('  3. Add design docs in design/'));
            } else {
              // Legacy create (phase-based, no domain)
              const { createFeature } = require('./commands/feature/create');
              await createFeature({
                id: featureName,
                title: options.title,
                phase: options.phase || 'backlog',
                epic: options.epic,
                priority: options.priority || 'medium',
                assignee: options.assignee,
                minimal: options.minimal || false
              });
            }
            break;
          }

          case 'validate': {
            const {
              validateFeatureCommand,
              validateAllFeatures
            } = require('./commands/feature/validate');
            if (options.all || !featureId) {
              await validateAllFeatures({ ...options, projectRoot });
            } else {
              await validateFeatureCommand(featureId, {
                ...options,
                projectRoot
              });
            }
            break;
          }

          case 'move': {
            if (!options.phase) {
              console.error(
                chalk.red('❌ --phase option is required for move action')
              );
              console.error(
                chalk.gray(
                  'Usage: sc feature move <feature-id> --phase <phase>'
                )
              );
              console.error(
                chalk.gray(
                  'Phases: backlog, drafting, implementing, testing, validating, complete'
                )
              );
              process.exit(1);
            }

            const { moveFeatureCommand } = require('./commands/feature/move');
            await moveFeatureCommand(featureId, options.phase, {
              ...options,
              projectRoot
            });
            break;
          }

          case 'sync': {
            const FeatureDocumentSync = require('../feature/FeatureDocumentSync');
            const sync = new FeatureDocumentSync(projectRoot);
            const results = await sync.sync({
              dryRun: options.dryRun,
              verbose: options.verbose
            });
            sync.displayResults(results, { verbose: options.verbose });
            break;
          }

          default:
            console.error(chalk.red(`❌ Unknown action: ${action}`));
            console.error(
              chalk.gray('Available actions: create, validate, move, sync')
            );
            process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // GIT-SMART COMMAND - Workflow automation
  // ============================================================================
  program
    .command('git-smart <action>')
    .description('Git workflow automation')
    .argument('[identifier]', 'Branch ID or other action-specific argument')
    .option('--branch <id>', 'Branch identifier (for branch action)')
    .option('--push', 'Auto-push after merge')
    .option('--delete-local', 'Delete local branch after merge')
    .option('--tag <version>', 'Tag version for deploy')
    .option('--skip-tests', 'Skip tests for deploy')
    .option('--skip-lint', 'Skip linting for deploy')
    .option('--no-push-tags', "Don't push tags for deploy")
    .option('-q, --quiet', 'Quiet mode')
    .option('-v, --verbose', 'Verbose mode')
    .action(async (action, identifier, options) => {
      try {
        const { handleGitSmartCommand } = require('./commands/git/git-smart');
        await handleGitSmartCommand(action, identifier, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // GIT COMMAND - Safe git operations (commit, etc.)
  // ============================================================================
  program
    .command('git <action>')
    .description('Safe git operations with stash/unstash for AI workflows')
    .argument('[files...]', 'Files to commit (for commit action)')
    .option('-m, --message <msg>', 'Commit message')
    .option('-f, --files <files>', 'Comma-separated list of files to commit')
    .option('--auto', 'Auto-commit without prompting')
    .option('--dry-run', 'Show what would be committed without actually committing')
    .option('--ai', 'Mark as AI-generated commit (adds [AI-COMMIT] tag)')
    .option('--priority', 'Mark as priority update commit')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, files, options) => {
      try {
        const { handleGitCommand } = require('./commands/git/git-commit');
        await handleGitCommand(action, files, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // GITHUB COMMAND - Sync GitHub issues, PRs, CI status + response detection
  // ============================================================================
  program
    .command('github <action> [subaction] [args...]')
    .description('GitHub integration: sync, issue management, response detection')
    .option('--issues', 'Sync issues only')
    .option('--prs', 'Sync PRs only')
    .option('--ci', 'Sync CI status only')
    .option('--state <state>', 'Filter by state: open, closed, all', 'all')
    .option('--limit <n>', 'Limit results', '50')
    .option('--labels <labels>', 'Filter by labels (comma-separated)')
    .option('--issue <number>', 'Specific issue number')
    .option('--since <time>', 'Filter by time (e.g., 1h, 2d, 30m)')
    .option('--json', 'Output as JSON')
    .option('--export <path>', 'Export results to file')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, subaction, args, options) => {
      try {
        // Handle 'issue' subcommand with response detection
        if (action === 'issue') {
          const { checkResponses } = require('./commands/git/github-issue-responses');
          
          if (subaction === 'check-responses') {
            await checkResponses(options);
            return;
          }
          
          // List/view issues
          const { execSync } = require('child_process');
          if (subaction === 'list' || !subaction) {
            let cmd = `gh issue list --state ${options.state} --limit ${options.limit}`;
            if (options.labels) cmd += ` --label "${options.labels}"`;
            console.log(execSync(cmd, { encoding: 'utf8' }));
            return;
          }
          
          if (subaction === 'view' && args[0]) {
            console.log(execSync(`gh issue view ${args[0]}`, { encoding: 'utf8' }));
            return;
          }
          
          console.log(chalk.cyan('Usage: sc github issue <action>'));
          console.log('  check-responses  Check for agent responses');
          console.log('  list            List issues');
          console.log('  view <number>   View specific issue');
          return;
        }

        // Original sync functionality
        const { GitHubSync } = require('./commands/git/github-sync');
        const sync = new GitHubSync({ verbose: options.verbose });

        switch (action) {
          case 'sync':
            if (options.issues) {
              await sync.syncIssues(options);
            } else if (options.prs) {
              await sync.syncPRs(options);
            } else if (options.ci) {
              await sync.syncCI(options);
            } else {
              // Sync all
              await sync.syncIssues(options);
              await sync.syncPRs(options);
            }
            break;
          case 'issues':
            await sync.syncIssues(options);
            break;
          case 'prs':
            await sync.syncPRs(options);
            break;
          case 'ci':
            await sync.syncCI(options);
            break;
          default:
            console.error(chalk.red(`Unknown action: ${action}`));
            console.log('Available actions: sync, issues, prs, ci, issue');
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (options.verbose) console.error(error.stack);
        process.exit(1);
      }
    });

  // ============================================================================
  // MONITOR COMMAND - Development & GitHub monitoring
  // ============================================================================
  program
    .command('monitor [subcommand]')
    .description('Development status and GitHub issue monitoring')
    .option('--issue <number>', 'GitHub issue number (for await subcommand)')
    .option('--interval <time>', 'Polling interval (e.g., 2m, 30s)', '2m')
    .option('--timeout <time>', 'Timeout duration (e.g., 30m, 1h)', '30m')
    .option('--retries <number>', 'Max retry attempts', '3')
    .option('-v, --verbose', 'Verbose output')
    .action(async (subcommand, options) => {
      try {
        const monitorCommand = require('./commands/monitor/index');
        
        // Reconstruct args for the monitor command router
        const args = subcommand ? [subcommand] : [];
        
        // Add options as CLI-style args if they were provided
        if (options.issue) {
          args.push('--issue', options.issue);
        }
        if (options.interval && options.interval !== '2m') {
          args.push('--interval', options.interval);
        }
        if (options.timeout && options.timeout !== '30m') {
          args.push('--timeout', options.timeout);
        }
        if (options.retries && options.retries !== '3') {
          args.push('--retries', options.retries);
        }
        
        // Call monitor command with reconstructed args
        const exitCode = await monitorCommand(args);
        if (typeof exitCode === 'number' && exitCode !== 0) {
          process.exit(exitCode);
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (options.verbose) console.error(error.stack);
        process.exit(1);
      }
    });

  // ============================================================================
  // MONITOR COMMAND - Development & GitHub monitoring
  // ============================================================================
  program
    .command('monitor [subcommand]')
    .description('Development status and GitHub issue monitoring')
    .option('--issue <number>', 'GitHub issue number (for await subcommand)')
    .option('--interval <time>', 'Polling interval (e.g., 2m, 30s)', '2m')
    .option('--timeout <time>', 'Timeout duration (e.g., 30m, 1h)', '30m')
    .option('--retries <number>', 'Max retry attempts', '3')
    .option('-v, --verbose', 'Verbose output')
    .action(async (subcommand, options) => {
      try {
        const monitorCommand = require('./commands/monitor/index');
        
        // Reconstruct args for the monitor command router
        const args = subcommand ? [subcommand] : [];
        
        // Add options as CLI-style args if they were provided
        if (options.issue) {
          args.push('--issue', options.issue);
        }
        if (options.interval && options.interval !== '2m') {
          args.push('--interval', options.interval);
        }
        if (options.timeout && options.timeout !== '30m') {
          args.push('--timeout', options.timeout);
        }
        if (options.retries && options.retries !== '3') {
          args.push('--retries', options.retries);
        }
        
        // Call monitor command with reconstructed args
        const exitCode = await monitorCommand(args);
        if (typeof exitCode === 'number' && exitCode !== 0) {
          process.exit(exitCode);
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (options.verbose) console.error(error.stack);
        process.exit(1);
      }
    });

  // ============================================================================
  // MONITOR COMMAND - Development & GitHub monitoring  
  // ============================================================================
  program
    .command('monitor [subcommand]')
    .description('Development status and GitHub issue monitoring')
    .option('--issue <number>', 'GitHub issue number (for await subcommand)')
    .option('--interval <time>', 'Polling interval (e.g., 2m, 30s)', '2m')
    .option('--timeout <time>', 'Timeout duration (e.g., 30m, 1h)', '30m')
    .option('--retries <number>', 'Max retry attempts', '3')
    .option('-v, --verbose', 'Verbose output')
    .action(async (subcommand, options) => {
      try {
        const monitorCommand = require('./commands/monitor/index');
        
        // Reconstruct args for the monitor command router
        const args = subcommand ? [subcommand] : [];
        
        // Add options as CLI-style args if they were provided
        if (options.issue) {
          args.push('--issue', options.issue);
        }
        if (options.interval && options.interval !== '2m') {
          args.push('--interval', options.interval);
        }
        if (options.timeout && options.timeout !== '30m') {
          args.push('--timeout', options.timeout);
        }
        if (options.retries && options.retries !== '3') {
          args.push('--retries', options.retries);
        }
        
        // Call monitor command with reconstructed args
        const exitCode = await monitorCommand(args);
        if (typeof exitCode === 'number' && exitCode !== 0) {
          process.exit(exitCode);
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (options.verbose) console.error(error.stack);
        process.exit(1);
      }
    });

  // ============================================================================
  // WIP COMMAND - Work-in-progress file registry
  // ============================================================================
  program
    .command('wip <action>')
    .alias('w')
    .description('Manage work-in-progress files via WIP registry')
    .argument(
      '[file]',
      'File path for register/unregister/touch/reassign actions'
    )
    .option('--feature <name>', 'Feature name')
    .option('--requirement <id>', 'Requirement ID (e.g., REQ-042)')
    .option('--reason <text>', 'Reason for WIP tracking')
    .option('--notes <text>', 'Additional notes')
    .option(
      '--userid <username>',
      'GitHub username (auto-detected if not provided)'
    )
    .option('--add-comment', 'Add WIP comment to file')
    .option('--no-auto-cleanup', 'Disable auto-cleanup')
    .option('--older-than <days>', 'Filter files older than N days')
    .option('--paths-only', 'Output paths only')
    .option('--me', 'Show only files registered by current user')
    .option('--unassigned', 'Show only unassigned files')
    .option('--to <userid>', 'Reassign file to this user')
    .option('--dry-run', 'Show what would be done')
    .option('--force', 'Skip confirmation prompts')
    .option('--quiet', 'Suppress output')
    .action(async (action, file, options) => {
      try {
        const WipManager = require('../wip/WipManager');
        const manager = new WipManager();

        switch (action) {
          case 'register': {
            if (!file) throw new Error('File path required');
            const entry = await manager.register(file, options);
            console.log(chalk.green('✅ Registered:'), file);
            console.log(
              chalk.gray(
                `   Feature: ${entry.feature} | REQ: ${entry.requirement} | User: @${entry.userid}`
              )
            );
            break;
          }

          case 'unregister':
            if (!file) throw new Error('File path required');
            await manager.unregister(file, options);
            if (!options.quiet)
              console.log(chalk.green('✅ De-registered:'), file);
            break;

          case 'list': {
            const files = await manager.list(options);
            if (options.pathsOnly) {
              files.forEach((f) => console.log(f));
            } else {
              if (files.length === 0) {
                console.log(chalk.green('\n✅ No WIP-tracked files'));
              } else {
                console.log(chalk.bold('\nWIP-Tracked Files:'));
                files.forEach((f) => {
                  const age = Math.floor(
                    (Date.now() - new Date(f.last_modified)) /
                      (1000 * 60 * 60 * 24)
                  );
                  const userStr = f.userid
                    ? chalk.cyan(`@${f.userid}`)
                    : chalk.gray('unassigned');
                  console.log(
                    chalk.cyan(f.path),
                    chalk.gray(`${f.feature} | ${age}d ago | ${userStr}`)
                  );
                });
              }
            }
            break;
          }

          case 'status': {
            const status = await manager.status();
            const stats = await manager.getStatsByUser();
            console.log(chalk.bold('\nWIP Registry Status:'));
            console.log(chalk.cyan(`Total WIP-tracked: ${status.total}`));
            console.log(chalk.green(`Active: ${status.active}`));
            console.log(
              chalk.yellow(`Old (>${status.warnDays}d): ${status.old}`)
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

            // Show auto-cleanup results
            if (status.cleaned > 0) {
              console.log(
                chalk.blue(`\n🧹 Auto-cleaned: ${status.cleaned} file(s)`)
              );
              console.log(
                chalk.gray('(Deleted or committed files removed from registry)')
              );
            }

            // Show untracked files (not committed, staged, or WIP-tracked)
            if (status.untracked > 0) {
              console.log(
                chalk.yellow(`\n⚠️  Untracked: ${status.untracked} file(s)`)
              );
              console.log(
                chalk.yellow('Files not committed, staged, or WIP-tracked:')
              );
              status.untrackedFiles.forEach((f) => {
                console.log(chalk.gray(`  ${f} (not WIP-tracked)`));
              });
            } else {
              console.log(
                chalk.green('\n✅ All files tracked, excluded, or WIP-tracked')
              );
            }

            // Show old files
            if (status.old > 0) {
              console.log(
                chalk.yellow('\n⚠️  Old WIP-tracked files need attention:')
              );
              status.oldFiles.forEach((f) => {
                const userStr = f.userid ? `@${f.userid}` : 'Unassigned';
                console.log(chalk.gray(`  ${f.path} (${f.age}d) - ${userStr}`));
              });
            }
            break;
          }

          case 'touch':
            if (!file) throw new Error('File path required');
            await manager.touch(file);
            console.log(chalk.green('✅ Updated timestamp:'), file);
            break;

          case 'cleanup': {
            const result = await manager.cleanup(options);
            console.log(chalk.green(`✅ Cleaned ${result.cleaned} file(s)`));
            break;
          }

          case 'check': {
            const check = await manager.checkUntracked();
            console.log(chalk.bold('\nUntracked Files Check:'));
            console.log(chalk.cyan(`Untracked: ${check.untracked}`));
            console.log(chalk.green(`WIP-tracked: ${check.wipTracked}`));
            console.log(
              chalk.yellow(`Not WIP-tracked: ${check.notWipTracked}`)
            );
            if (check.notWipTracked > 0) {
              console.log(chalk.yellow('\n⚠️  Files not in WIP registry:'));
              check.files.forEach((f) => console.log(chalk.gray(`  ${f}`)));
            }
            break;
          }

          case 'stats': {
            const statsData = await manager.getStatsByUser();
            const registry = await manager.loadRegistry();
            console.log(chalk.bold('\nWIP Registry Statistics:'));
            console.log(chalk.cyan(`Total files: ${registry.files.length}`));
            console.log(chalk.bold('\nBy User:'));

            // Sort by total files descending
            const sorted = Object.entries(statsData).sort(
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
            break;
          }

          case 'reassign': {
            if (!file) throw new Error('File path required');
            if (!options.to) throw new Error('--to <userid> required');
            const reassigned = await manager.reassign(file, options.to);
            console.log(chalk.green('✅ Reassigned file:'), file);
            console.log(
              chalk.gray(`   From: @${reassigned.oldUserid || 'unassigned'}`)
            );
            console.log(chalk.gray(`   To: @${reassigned.newUserid}`));
            break;
          }

          default:
            throw new Error(
              `Unknown action: ${action}. Use: register, unregister, list, status, touch, cleanup, check, stats, reassign`
            );
        }
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
        if (process.env.NODE_ENV !== 'test') process.exit(1);
        throw error;
      }
    });

  // ============================================================================
  // SEARCH COMMAND - Unified content search
  // ============================================================================
  program
    .command('search [query]')
    .alias('s')
    .description('Search across all documentation and content')
    .option(
      '--type <type>',
      'Content type: all, docs, requirements, features, workflow, planning, compliance',
      'all'
    )
    .option('--limit <n>', 'Maximum results', '20')
    .option('--json', 'Output as JSON')
    .option('--no-context', 'Hide context snippets')
    .option('--case-sensitive', 'Enable case-sensitive search')
    .action(async (query, options) => {
      try {
        const { handleSearchCommand } = require('./commands/search');
        await handleSearchCommand(query, {
          type: options.type,
          limit: parseInt(options.limit, 10),
          json: options.json,
          showContext: options.context !== false,
          caseSensitive: options.caseSensitive,
          help: !query
        });
      } catch (error) {
        console.error(chalk.red('❌ Search failed:'), error.message);
        if (process.env.NODE_ENV !== 'test') process.exit(1);
        throw error;
      }
    });

  // ============================================================================
  // FBC COMMAND - Feature-based commits registry
  // ============================================================================
  program
    .command('fbc <action>')
    .description('Manage feature registry for feature-based commits')
    .argument(
      '[name]',
      'Feature name for add/show/commits/complete/remove actions'
    )
    .option('--description <text>', 'Feature description')
    .option('--requirements <ids>', 'Comma-separated requirement IDs')
    .option('--owner <email>', 'Feature owner email')
    .option('--status <status>', 'Filter by status (for list action)')
    .option('--limit <number>', 'Limit number of commits (for commits action)')
    .action(async (action, name, options) => {
      try {
        const FeatureManager = require('../feature/FeatureManager');
        const manager = new FeatureManager();

        switch (action) {
          case 'add': {
            if (!name) throw new Error('Feature name required');
            const feature = await manager.addFeature(name, options);
            console.log(chalk.green('✅ Feature added:'), name);
            console.log(
              chalk.gray(
                `   Requirements: ${feature.requirements.join(', ') || '(none)'}`
              )
            );
            console.log(chalk.cyan('\nUse in commits:'));
            console.log(
              chalk.gray(
                `   git commit -m "[FEATURE:${name}] REQ-XXX: Description"`
              )
            );
            break;
          }

          case 'list': {
            const features = await manager.listFeatures(options);
            if (features.length === 0) {
              console.log(chalk.yellow('\nNo features found'));
            } else {
              console.log(chalk.bold('\nActive Features:'));
              features.forEach((f) => {
                console.log(chalk.cyan.bold(`  ${f.name}`));
                console.log(
                  chalk.gray(`    ${f.description || '(no description)'}`)
                );
              });
              const stats = await manager.getStatistics();
              console.log(
                chalk.gray(
                  `\nTotal: ${stats.active} active | ${stats.completed} completed`
                )
              );
            }
            break;
          }

          case 'show': {
            if (!name) throw new Error('Feature name required');
            const details = await manager.showFeature(name);
            console.log(chalk.bold('\nFeature:'), chalk.cyan(details.name));
            console.log(
              chalk.gray(`Description: ${details.description || '(none)'}`)
            );
            console.log(
              chalk.gray(
                `Requirements: ${details.requirements.join(', ') || '(none)'}`
              )
            );
            console.log(
              chalk.gray(
                `Status: ${details.status} | Created: ${details.created}`
              )
            );
            if (details.recentCommits?.length > 0) {
              console.log(chalk.bold('\nRecent Commits:'));
              details.recentCommits.forEach((c) => {
                console.log(chalk.gray(`  ${c.hash}`), c.message);
              });
            }
            break;
          }

          case 'commits': {
            if (!name) throw new Error('Feature name required');
            const commits = await manager.getFeatureCommits(name, options);
            if (commits.length === 0) {
              console.log(chalk.yellow(`\nNo commits for feature: ${name}`));
            } else {
              console.log(chalk.bold(`\nCommits for feature: ${name}`));
              commits.forEach((c) => {
                console.log(chalk.cyan(c.hash), c.message);
              });
            }
            break;
          }

          case 'complete':
            if (!name) throw new Error('Feature name required');
            await manager.completeFeature(name);
            console.log(chalk.green('✅ Feature completed:'), name);
            break;

          case 'remove':
            if (!name) throw new Error('Feature name required');
            await manager.removeFeature(name);
            console.log(chalk.green('✅ Feature removed:'), name);
            break;

          case 'stats': {
            const statistics = await manager.getStatistics();
            console.log(chalk.bold('\nFeature Statistics:'));
            console.log(chalk.cyan(`Active: ${statistics.active}`));
            console.log(chalk.green(`Completed: ${statistics.completed}`));
            break;
          }

          case 'validate-commit': {
            if (!name) throw new Error('Commit message required');
            const result = await manager.validateCommitFeatureTag(name);
            if (result.valid) {
              console.log(
                chalk.green('✅ Valid feature tag:'),
                result.featureName
              );
            } else {
              console.log(chalk.red('❌'), result.message);
              if (result.availableFeatures) {
                console.log(chalk.gray('\nAvailable features:'));
                result.availableFeatures.forEach((f) =>
                  console.log(chalk.gray(`  - ${f}`))
                );
              }
              if (process.env.NODE_ENV !== 'test') process.exit(1);
            }
            break;
          }

          default:
            throw new Error(
              `Unknown action: ${action}. Use: add, list, show, commits, complete, remove, stats, validate-commit`
            );
        }
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
        if (process.env.NODE_ENV !== 'test') process.exit(1);
        throw error;
      }
    });

  // ============================================================================
  // INIT COMMAND - Repository initialization
  // ============================================================================
  program
    .command('init [directory]')
    .description('Equip repository with Supernal Coding (presets or content modules)')
    // Presets (full installation)
    .option('--minimal', 'Install minimal preset')
    .option('--standard', 'Install standard preset (recommended)')
    .option('--full', 'Install full preset')
    .option('--development', 'Install development preset')
    .option('--interactive', 'Interactive setup mode')
    // Content modules (standalone for docs sites)
    .option('--guides', 'Install guides/tutorials to docs/guides/')
    .option('--compliance', 'Install compliance templates to docs/compliance/')
    .option('--workflow', 'Install workflow/SOPs to docs/workflow/')
    // Other options
    .option('--dry-run', 'Show what would be installed')
    .option('--overwrite', 'Overwrite existing files')
    .option('--skip-upgrade-check', 'Skip package upgrade check')
    .option('--merge', 'Merge with existing installation')
    .option('--yes', 'Skip confirmations')
    .option('--name <name>', 'Project name')
    .option('--alias <alias>', 'Command alias')
    .option('-t, --template <name>', 'Template to use')
    .option('--force', 'Force overwrite')
    .option(
      '--compliance-frameworks <frameworks>',
      'Comma-separated list of compliance frameworks (e.g., hipaa,gdpr,soc2,iso27001,iso27701)'
    )
    .option('-v, --verbose', 'Verbose output')
    .action(async (directory, options) => {
      try {
        // Parse compliance frameworks if provided
        if (options.complianceFrameworks) {
          options.complianceFrameworks = options.complianceFrameworks
            .split(',')
            .map((f) => f.trim().toLowerCase())
            .filter((f) => f.length > 0);
        }

        const { initCommand } = require('./commands/setup/init');
        await initCommand(directory, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // GIT-HOOKS COMMAND - Git hook management
  // ============================================================================
  program
    .command('git-hooks <action>')
    .description('Manage git hooks')
    .argument('[hook]', 'Hook name for specific actions')
    .action(async (action, hook, options) => {
      try {
        const { handleGitHooksCommand } = require('./commands/git/git-hooks');
        await handleGitHooksCommand(action, hook, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // Additional commands can be added here following the same pattern
  // ============================================================================

  // ============================================================================
  // COVERAGE COMMAND - External coverage tool integration
  // ============================================================================
  program
    .command('coverage [action]')
    .description('Coverage ecosystem integration (Vitest, Jest, Codecov)')
    .argument('[args...]', 'Action-specific arguments')
    .option('--stack <stack>', 'Stack type (react-vite|nextjs|node|auto)')
    .option('--tool <tool>', 'Coverage tool (vitest|jest|c8|auto)')
    .option('--min-line <n>', 'Minimum line coverage %')
    .option('--min-branch <n>', 'Minimum branch coverage %')
    .option('--min-function <n>', 'Minimum function coverage %')
    .option('--min-statement <n>', 'Minimum statement coverage %')
    .option('--force', 'Overwrite existing config')
    .option('--dry-run', 'Show config without writing')
    .option('--check', 'Validate thresholds after run')
    .option('--include <pattern>', 'Include only matching files')
    .option('--e2e', 'Include E2E tests')
    .option('--quiet', 'Minimal output')
    .option('--json', 'Output as JSON')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, args, options) => {
      try {
        const { handleCoverageCommand } = require('./commands/coverage');
        await handleCoverageCommand(action, args, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // HEALTH COMMAND - System health checks
  // ============================================================================
  program
    .command('health [category]')
    .description('System health checks (features, all)')
    .option('--quiet', 'Show only summary')
    .option('--exit-code', 'Exit with error code if issues found')
    .option('-v, --verbose', 'Verbose output')
    .action(async (category, options) => {
      try {
        const { handleHealthCommand } = require('./commands/health');
        await handleHealthCommand(category || 'all', [], options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Type-check command
  program
    .command('type-check')
    .description('Detect and prevent TypeScript/JavaScript type duplications')
    .option('--pre-commit', 'Pre-commit check (fails if duplications found)')
    .option('--show-ignored', 'Show ignored auto-generated types')
    .option('--show-legitimate', 'Show legitimate duplications only')
    .option('--add-ignore <type>', 'Get command to add type to ignore list')
    .option('--add-legitimate <type>', 'Add type to legitimate duplications')
    .option('--init-config', 'Create .duplication-lint.json config file')
    .option('--update <types>', 'Update specific types (comma-separated)')
    .option('--update-types <types>', 'Update multiple types (comma-separated)')
    .option('--force', 'Force operation')
    .action(async (_options) => {
      try {
        const cliMain = require('./commands/type-check');
        const args = process.argv.slice(3); // Get all args after 'type-check'
        await cliMain(args);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // TEST COMMAND - Test execution wrapper with ME.sh convention
  // ============================================================================
  program
    .command('test [action]')
    .description('Test execution, management, and evidence logging')
    .argument('[args...]', 'Command or arguments')
    // ME.sh wrapper options
    .option('--quick', 'Fast tests only (unit tests)')
    .option('--requirement <id>', 'Run tests for specific requirement')
    .option('--e2e', 'Include end-to-end tests')
    .option('--no-bail', 'Continue testing after failures')
    .option('--quiet', 'Minimal output')
    // Original test command options
    .option('-g, --guidance', 'Show test guidance')
    .option('-m, --map', 'Show test mapping')
    .option('--watch', 'Watch mode')
    .option('--coverage', 'Generate coverage')
    // Evidence logging options (REQ-106)
    .option(
      '--req <id>',
      'Link test to requirement (triggers compliance evidence)'
    )
    .option('--feature <name>', 'Link test to feature')
    .option('--compliance', 'Mark as compliance evidence')
    .option('--evidence', 'Mark as compliance evidence (alias)')
    .option('--verbose', 'Save full output even for passing tests')
    .option('--since <date>', 'Filter results by date')
    .option('--before <date>', 'Filter results before date')
    .option('--confirm', 'Confirm dangerous operations')
    // Phase 2: Invalidation options
    .option('--reason <text>', 'Reason for invalidation')
    .option('--by <id>', 'New test that supersedes old one')
    .option('--strict', 'Strict validity checking')
    .action(async (action, args, options) => {
      try {
        // No action = run tests with ME.sh wrapper
        if (!action) {
          const { handleTestCommand } = require('./commands/development/test');
          await handleTestCommand(args, options);
          return;
        }

        // Handle 'run' action - execute and log test (REQ-106)
        if (action === 'run') {
          const TestResultManager = require('../test/TestResultManager');
          const manager = new TestResultManager();
          const command = args.join(' ');
          if (!command) {
            console.log(chalk.cyan('Usage: sc test run <command> [options]'));
            console.log('');
            console.log('Options:');
            console.log(
              '  --req <id>       Link to requirement (triggers compliance evidence)'
            );
            console.log('  --feature <name> Link to feature');
            console.log('  --compliance     Mark as compliance evidence');
            console.log(
              '  --verbose        Save full output even for passing tests'
            );
            console.log('');
            console.log('Examples:');
            console.log("  sc test run 'npm test'");
            console.log(
              "  sc test run 'npm test -- doc-history' --req REQ-101"
            );
            console.log("  sc test run 'pnpm playwright test' --compliance");
            return;
          }
          await manager.run(command, options);
          return;
        }

        // Handle 'results' action - list/show/export test results
        if (action === 'results') {
          const TestResultManager = require('../test/TestResultManager');
          const manager = new TestResultManager();
          const subAction = args[0];

          if (subAction === 'show') {
            const id = args[1];
            if (!id) {
              console.error(chalk.red('Usage: sc test results show <id>'));
              return;
            }
            manager.show(id);
          } else if (subAction === 'url') {
            const id = args[1];
            if (!id) {
              console.error(chalk.red('Usage: sc test results url <id>'));
              return;
            }
            manager.getUrl(id);
          } else if (subAction === 'export') {
            manager.export(options);
          } else {
            // Default: list results
            manager.list(options);
          }
          return;
        }

        // Handle 'evidence' action - manage compliance evidence
        if (action === 'evidence') {
          const TestResultManager = require('../test/TestResultManager');
          const manager = new TestResultManager();
          const subAction = args[0];

          if (subAction === 'cleanup') {
            manager.cleanupEvidence(options);
          } else {
            console.log(chalk.cyan('Evidence Commands:'));
            console.log('  sc test evidence cleanup --before <date> --confirm');
            console.log('    Manually cleanup old compliance evidence');
            console.log('');
            console.log(
              chalk.yellow(
                'WARNING: Deleting compliance evidence may violate regulations!'
              )
            );
          }
          return;
        }

        // Handle 'invalidate' action (Phase 2)
        if (action === 'invalidate') {
          const TestResultManager = require('../test/TestResultManager');
          const manager = new TestResultManager();
          const id = args[0];

          if (!id) {
            console.log(chalk.cyan('Usage: sc test invalidate <id> [options]'));
            console.log('');
            console.log('Options:');
            console.log('  --reason <text>    Reason for invalidation');
            console.log(
              '  --by <id>          New test that supersedes this one'
            );
            return;
          }

          manager.invalidate(id, {
            reason: options.reason,
            supersededBy: options.by
          });
          return;
        }

        // Handle 'supersede' action (Phase 2)
        if (action === 'supersede') {
          const TestResultManager = require('../test/TestResultManager');
          const manager = new TestResultManager();
          const oldId = args[0];
          const newId = args[1];

          if (!oldId || !newId) {
            console.log(
              chalk.cyan('Usage: sc test supersede <old-id> <new-id>')
            );
            console.log('');
            console.log('Marks old test result as superseded by new one.');
            return;
          }

          manager.supersede(oldId, newId);
          return;
        }

        // Handle 'check-validity' action (Phase 2)
        if (action === 'check-validity') {
          const TestResultManager = require('../test/TestResultManager');
          const manager = new TestResultManager();
          manager.checkValidity({
            strict: options.strict
          });
          return;
        }

        // Default: original test guidance/map behavior
        const {
          handleTestCommand
        } = require('./commands/testing/test-command');
        await handleTestCommand(options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // BUILD COMMAND - Unified build with docs generation and validation
  // ============================================================================
  program
    .command('build')
    .description('Unified build with docs generation and validation')
    .option('--quiet', 'CI mode (minimal output)')
    .option('-v, --verbose', 'Verbose output')
    .option('--skip-docs', 'Skip CLI docs generation')
    .option('--skip-validate', 'Skip template validation')
    .option('--no-colors', 'Disable colored output')
    .option('--no-smoke-tests', 'Skip smoke tests (BUILDME.sh only)')
    .action(async (options) => {
      try {
        const { handleBuildCommand } = require('./commands/development/build');
        await handleBuildCommand([], options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Docs command
  program
    .command('docs <action>')
    .description('Documentation management')
    .argument('[args...]', 'Action-specific arguments')
    .option('--structure', 'Run structure validation only')
    .option('--template', 'Run template validation only')
    .option('--all', 'Run all validations')
    .option('--fix', 'Automatically fix issues')
    .option('--auto-fix', 'Automatically fix documentation issues')
    .option('--interactive', 'Review changes interactively')
    .option('--dry-run', 'Show what would be done')
    .option('--full-report', 'Write full link report to file')
    .option('--file <path>', 'Check specific file')
    .option('--format <type>', 'Output format (ascii, markdown, json)')
    .option('--output <path>', 'Output file path')
    .option('-v, --verbose', 'Verbose output')
    // history options (REQ-101)
    .option('--json', 'Output as JSON')
    .option('--since <date>', 'Show changes since date')
    .option('--author <name>', 'Filter by author')
    .option('--show-diff', 'Include diffs in output')
    .option('--signed-only', 'Only show signed commits')
    .option('--limit <n>', 'Limit number of results')
    // check/registry options (REQ-102, REQ-103)
    .option('--staged', 'Check staged files only')
    .option('--quiet', 'Minimal output')
    .option('--level <level>', 'Control level: required or tracked')
    .action(async (action, args, options) => {
      try {
        const handleDocsCommand = require('./commands/docs/docs');
        await handleDocsCommand(action, { ...options, _: args });
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // CLEANUP COMMAND - Repository structure and documentation cleanup
  // ============================================================================
  program
    .command('cleanup [action]')
    .description(
      'Repository structure and documentation cleanup with staging queue'
    )
    .option('--auto-fix', 'Automatically fix issues')
    .option(
      '--auto-stage',
      'Move problematic files to cleanup-queue for review'
    )
    .option('--interactive', 'Review each change interactively')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--skip-docs', 'Skip documentation structure checks')
    .option('--skip-structure', 'Skip directory structure validation')
    .option(
      '--validate-naming',
      'Enable file naming validation (REQ-VALIDATION-001)'
    )
    .option('--check-links', 'Check for broken markdown links')
    .option('--find-orphans', 'Find orphaned files with no references')
    .option('--all', 'Enable all checks')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, options) => {
      try {
        const cleanupHandler = require('./commands/maintenance/cleanup-unified');
        await cleanupHandler(action, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (options.verbose) {
          console.error(error.stack);
        }
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Change command (REQ-104)
  program
    .command('change <action>')
    .description('Change document management')
    .argument('[args...]', 'Action-specific arguments')
    .option('--type <type>', 'Change type: general, security, feature, bugfix')
    .option('--impact <level>', 'Impact level: low, medium, high')
    .option('--edit', 'Open in editor after creation')
    .action(async (action, args, options) => {
      try {
        const ChangeManager = require('../doc/ChangeManager');
        const manager = new ChangeManager();

        switch (action) {
          case 'new': {
            const title = args[0];
            if (!title) {
              console.error(
                chalk.red(
                  '❌ Usage: sc change new <title> [--type <type>] [--impact <level>] [--edit]'
                )
              );
              return;
            }
            manager.create(title, {
              type: options.type,
              impact: options.impact,
              edit: options.edit
            });
            break;
          }
          case 'list':
            manager.list();
            break;
          case 'show': {
            const num = args[0];
            if (!num) {
              console.error(chalk.red('❌ Usage: sc change show <number>'));
              return;
            }
            manager.show(num);
            break;
          }
          default:
            console.log(chalk.cyan('Change Commands:'));
            console.log(
              '  sc change new <title>     Create new change document'
            );
            console.log(
              '  sc change list            List all change documents'
            );
            console.log(
              '  sc change show <number>   Show change document details'
            );
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Rules command
  program
    .command('rules <action>')
    .description('Rule management')
    .argument('[args...]', 'Action-specific arguments')
    .option('--force', 'Force operation')
    .option('--json', 'Output in JSON format')
    .option('--markdown', 'Output in markdown format')
    .option('--output <path>', 'Save output to file')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, args, options) => {
      try {
        const {
          handleRulesCommand
        } = require('./commands/rules/rule-discovery');
        await handleRulesCommand(action, args, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Workflow command
  program
    .command('workflow <action>')
    .description('Workflow state management')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, options) => {
      try {
        const { handleWorkflowCommand } = require('./commands/workflow');
        await handleWorkflowCommand(action, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Config command
  program
    .command('config <action> [args...]')
    .description('Configuration management')
    .option('-v, --verbose', 'Verbose output')
    .option('--section <name>', 'Show specific section')
    .option('--json', 'Output as JSON')
    .action(async (action, args, options) => {
      try {
        const { handleConfigCommand } = require('./commands/config');
        // Pass additional args in options._  for compatibility
        options._ = args;
        await handleConfigCommand(action, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Upgrade command - Template updates for sc init users
  program
    .command('upgrade')
    .description('Upgrade SC templates and rules to latest version')
    .argument(
      '[action]',
      'Action: check, preview, apply, rollback, history',
      'check'
    )
    .option(
      '--component <type>',
      'Upgrade specific component: rules, templates, workflows, git-hooks, all'
    )
    .option('--auto', 'Auto-accept non-conflicting changes')
    .option('--force', 'Force upgrade even with conflicts')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, options) => {
      try {
        const upgradeCommand = require('./commands/upgrade/upgrade');
        await upgradeCommand(action, options);
      } catch (error) {
        console.error(chalk.red(`❌ Upgrade failed: ${error.message}`));
        if (options.verbose) {
          console.error(error);
        }
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Telemetry command - Privacy-first learning system
  program
    .command('telemetry')
    .description('Manage telemetry and usage insights')
    .argument(
      '[action]',
      'Action: status, enable, disable, insights, config, preview, sync, clear, export',
      'status'
    )
    .option('--commands <boolean>', 'Enable/disable command telemetry')
    .option('--rules <boolean>', 'Enable/disable rule telemetry')
    .option('--validation <boolean>', 'Enable/disable validation telemetry')
    .option('--performance <boolean>', 'Enable/disable performance telemetry')
    .option('--output <file>', 'Output file for export')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, options) => {
      try {
        const telemetryCommand = require('./commands/telemetry/telemetry');
        await telemetryCommand(action, options);
      } catch (error) {
        console.error(
          chalk.red(`❌ Telemetry command failed: ${error.message}`)
        );
        if (options.verbose) {
          console.error(error);
        }
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Sync command - Repository sync from upstream (REQ-088)
  program
    .command('sync')
    .description('Synchronize with upstream repository or global installation')
    .argument(
      '[target]',
      'Sync target: repo (upstream), global (installation)',
      'repo'
    )
    .argument('[action]', 'Action: check, pull, preview', 'check')
    .option('--upstream <url>', 'Override upstream repository URL')
    .option('--rebase', 'Use rebase strategy instead of merge')
    .option('--auto', 'Auto-merge non-conflicting changes')
    .option('-v, --verbose', 'Verbose output')
    .action(async (target, action, options) => {
      try {
        if (target === 'global' || target === 'update') {
          // Legacy: Global/local sync
          const {
            handleSyncCommand
          } = require('./commands/upgrade/repo-sync-check');
          await handleSyncCommand(options);
        } else {
          // New: Repository upstream sync (REQ-088)
          const repoSyncCommand = require('./commands/sync/repo-sync');
          await repoSyncCommand(action, options);
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Template command
  program
    .command('template <action>')
    .description('Template management')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, options) => {
      try {
        const { handleTemplateCommand } = require('./commands/template');
        await handleTemplateCommand(action, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // Multi-repo command
  program
    .command('multi-repo <action>')
    .description('Multi-repository management')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, options) => {
      try {
        const { handleMultiRepoCommand } = require('./commands/multi-repo');
        await handleMultiRepoCommand(action, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // TRACEABILITY COMMAND - Requirements traceability matrix
  // ============================================================================
  program
    .command('traceability <action> [...args]')
    .alias('trace')
    .description('Traceability matrix for compliance and requirement tracking')
    .option('-f, --format <type>', 'Output format (json, html, csv)')
    .option('-o, --output <path>', 'Output file or directory')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, args, options) => {
      try {
        const {
          handleTraceabilityCommand
        } = require('./commands/traceability');
        // Convert options to args format expected by handleTraceabilityCommand
        const allArgs = Array.isArray(args) ? [...args] : [];
        if (options.output) {
          allArgs.push('--output', options.output);
        }
        if (options.format) {
          allArgs.push('--format', options.format);
        }
        if (options.verbose) {
          allArgs.push('--verbose');
        }
        await handleTraceabilityCommand(action, ...allArgs);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // DASHBOARD COMMAND - Requirements visualization and tracking
  // ============================================================================
  program
    .command('dashboard [action]')
    .description('Dashboard management for requirements visualization')
    .argument('[args...]', 'Action-specific arguments')
    .option(
      '--port <port>',
      'Port for dashboard server (default: 3000)',
      parseInt
    )
    .option(
      '--docs-port <port>',
      'Port for documentation server (default: 3003)',
      parseInt
    )
    .option(
      '--api-port <port>',
      'Port for API server (default: 3001)',
      parseInt
    )
    .option(
      '--dashboard-port <port>',
      'Port for dashboard server (default: 3002)',
      parseInt
    )
    .option(
      '--template <type>',
      'Dashboard template type (default: supernal-dashboard)'
    )
    .option('--github-pages', 'Deploy to GitHub Pages')
    .option('--vercel', 'Deploy to Vercel')
    .option('--kill-conflicts', 'Kill processes on conflicting ports')
    .option('--force', 'Force overwrite existing dashboard')
    .option('--upgrade', 'Upgrade existing dashboard')
    .option('--dry-run', 'Preview changes without applying')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, args, options) => {
      try {
        // Show help if no action provided
        if (!action) {
          console.log(chalk.yellow('📊 Dashboard Management Commands:'));
          console.log('');
          console.log(chalk.cyan('  sc dashboard init'));
          console.log('    Initialize dashboard in current project');
          console.log('');
          console.log(chalk.cyan('  sc dashboard serve [--port 3000]'));
          console.log('    Serve dashboard locally (uses sc runtime)');
          console.log('');
          console.log(chalk.cyan('  sc dashboard build'));
          console.log('    Build dashboard for production deployment');
          console.log('');
          console.log(chalk.cyan('  sc dashboard start'));
          console.log('    Start all services (docs, api, dashboard)');
          console.log('');
          console.log(chalk.cyan('  sc dashboard deploy --github-pages'));
          console.log('    Deploy to GitHub Pages');
          console.log('');
          console.log(chalk.cyan('  sc dashboard update'));
          console.log('    Update dashboard data');
          console.log('');
          console.log(
            chalk.cyan('  sc dashboard check-ports <port1> [port2...]')
          );
          console.log('    Check if ports are available');
          console.log('');
          console.log(chalk.gray('For more details: sc dashboard --help'));
          return;
        }

        const dashboardCommand = require('./commands/dashboard');
        await dashboardCommand(action, { ...options, args });
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // CLI COMMAND - CLI introspection and workflow mapping
  // ============================================================================
  program
    .command('cli <action>')
    .description('CLI introspection and workflow mapping')
    .option('--format <type>', 'Output format (ascii, markdown, json)')
    .option('--output <path>', 'Output file/directory path')
    .option('--check', 'Check sync status without updating')
    .option('--force', 'Force regeneration even if in sync')
    .option('--skip-docs', 'Skip generating individual doc pages')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, options) => {
      try {
        switch (action) {
          case 'workflow-map': {
            const {
              CLIMapGenerator
            } = require('../../../scripts/generate-cli-map');
            const generator = new CLIMapGenerator();
            const data = generator.generate();

            const format = options.format || 'ascii';
            const outputFile = options.output;

            let content;
            if (format === 'json') {
              content = JSON.stringify(data, null, 2);
            } else if (format === 'markdown' || format === 'md') {
              content = generator.generateMarkdownTree(data);
            } else {
              content = generator.generateASCIITree(data);
            }

            if (outputFile) {
              const fs = require('node:fs');
              fs.writeFileSync(outputFile, content);
              console.log(
                chalk.green(`✅ Workflow map written to: ${outputFile}`)
              );
            } else {
              console.log(content);
            }
            break;
          }

          case 'sync': {
            // Check and sync CLI map if needed
            const {
              checkSyncStatus,
              syncCLIMap
            } = require('./commands/cli/sync-check');
            const projectRoot = process.cwd();

            if (options.check) {
              // Just check status, don't sync
              const status = await checkSyncStatus(projectRoot, {
                verbose: options.verbose
              });
              if (status.needsSync) {
                console.log(
                  chalk.yellow(`⚠️  CLI map out of sync: ${status.reason}`)
                );
                console.log(chalk.gray(`   Run 'sc cli sync' to update`));
                if (process.env.SC_STRICT_SYNC) {
                  process.exit(1);
                }
              } else {
                console.log(
                  chalk.green(
                    `✅ CLI map in sync (${status.fileCount} files watched)`
                  )
                );
              }
            } else {
              // Perform sync
              const result = await syncCLIMap(projectRoot, {
                verbose: options.verbose,
                force: options.force,
                generateDocs: !options.skipDocs
              });

              if (result.synced) {
                console.log(
                  chalk.green(
                    `✅ CLI map synced (${result.commandCount} commands, ${result.filesWatched} files watched)`
                  )
                );
              } else {
                console.log(
                  chalk.gray(
                    `✓ Already in sync (${result.filesWatched} files watched)`
                  )
                );
              }
            }
            break;
          }

          case 'generate-docs': {
            // Generate documentation pages for each CLI command
            const {
              CLIMapGenerator
            } = require('../../../scripts/generate-cli-map');
            const fs = require('node:fs');
            const path = require('node:path');

            const generator = new CLIMapGenerator();
            const mapData = generator.generate();
            // Default to docs/cli-commands (docusaurus serves from ../docs)
            const outputDir = options.output || 'docs/cli-commands';

            // Ensure output directory exists
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }

            let generated = 0;

            // Generate a doc page for each command
            Object.entries(mapData.commands).forEach(([name, cmd]) => {
              const docContent = generateCommandDoc(name, cmd);
              const filePath = path.join(outputDir, `${name}.md`);
              fs.writeFileSync(filePath, docContent);
              generated++;
              if (options.verbose) {
                console.log(chalk.gray(`  Generated: ${filePath}`));
              }
            });

            // Generate index
            const indexContent = generateCommandIndex(mapData);
            fs.writeFileSync(path.join(outputDir, 'index.md'), indexContent);

            console.log(
              chalk.green(
                `✅ Generated ${generated} command docs in ${outputDir}/`
              )
            );
            break;
          }

          default:
            console.log(chalk.bold('🔧 CLI Introspection'));
            console.log('');
            console.log(chalk.cyan('Available commands:'));
            console.log(
              '  sc cli workflow-map [--format <ascii|markdown|json>] [--output <file>]'
            );
            console.log(
              '    Map CLI commands to their workflow/SOP references'
            );
            console.log('');
            console.log(
              '  sc cli sync [--check] [--force] [--skip-docs] [--verbose]'
            );
            console.log(
              '    Sync CLI map with source changes (hash-based detection)'
            );
            console.log('');
            console.log('  sc cli generate-docs [--output <dir>] [--verbose]');
            console.log(
              '    Generate documentation pages for all CLI commands'
            );
            console.log('');
            console.log(chalk.bold('Examples:'));
            console.log(
              '  sc cli workflow-map                     # ASCII tree view'
            );
            console.log(
              '  sc cli sync --check                     # Check if sync needed'
            );
            console.log(
              '  sc cli sync                             # Sync if needed'
            );
            console.log(
              '  sc cli sync --force                     # Force regeneration'
            );
            console.log(
              '  sc cli generate-docs                    # Generate all docs'
            );
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // MONITOR COMMAND - Background daemon for repo/issue monitoring
  // ============================================================================
  program
    .command('monitor <action>')
    .description('Background monitoring for repos, issues, and CI events')
    .argument('[args...]', 'Action-specific arguments')
    .option('--daemon', 'Run as background daemon')
    .option('--config <path>', 'Config file path (default: supernal.yaml)')
    .option('--tail <n>', 'Number of log lines to show', '50')
    .option('--follow', 'Follow log output')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, args, options) => {
      try {
        const { handleMonitorCommand } = require('./commands/monitor/monitor');
        await handleMonitorCommand(action, args, options);
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (options.verbose) {
          console.error(error.stack);
        }
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // RESEARCH COMMAND - Link checking and research validation
  // ============================================================================
  program
    .command('research <action>')
    .description('Research document validation and link checking')
    .argument('[path]', 'File or directory to check (defaults to packages/awesome-ai-development)')
    .option('--no-external', 'Skip external URL checks')
    .option('--no-local', 'Skip local file reference checks')
    .option('--include-bare-urls', 'Include bare URLs (not in markdown syntax)')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '10000')
    .option('--concurrency <n>', 'Number of concurrent requests', '5')
    .option('--clear-cache', 'Clear link check cache before running')
    .option('--json', 'Output results as JSON')
    .option('-v, --verbose', 'Verbose output')
    .action(async (action, targetPath, options) => {
      try {
        switch (action) {
          case 'link-check':
          case 'links':
          case 'check-links': {
            const LinkChecker = require('../research/LinkChecker');
            
            // Clear cache if requested
            if (options.clearCache) {
              const fs = require('node:fs');
              const path = require('node:path');
              const cachePath = path.join(process.cwd(), '.supernal', '.link-check-cache.json');
              if (fs.existsSync(cachePath)) {
                fs.unlinkSync(cachePath);
                console.log(chalk.gray('Cache cleared'));
              }
            }
            
            const checker = new LinkChecker({
              checkExternal: options.external !== false,
              checkLocal: options.local !== false,
              includeBareUrls: options.includeBareUrls || false,
              timeout: parseInt(options.timeout, 10),
              concurrency: parseInt(options.concurrency, 10),
              verbose: options.verbose || false
            });
            
            const result = await checker.run(targetPath);
            
            if (options.json) {
              console.log(JSON.stringify(checker.exportResults(), null, 2));
            }
            
            if (!result.success && process.env.NODE_ENV !== 'test') {
              process.exit(1);
            }
            break;
          }
          
          case 'validate': {
            // Future: validate research document structure
            console.log(chalk.yellow('Research validation coming soon...'));
            console.log(chalk.gray('For now, use: sc research link-check [path]'));
            break;
          }
          
          default:
            console.log(chalk.bold('🔬 Research Management'));
            console.log('');
            console.log(chalk.cyan('Available commands:'));
            console.log('  sc research link-check [path]     Check links in markdown files');
            console.log('  sc research links [path]          Alias for link-check');
            console.log('');
            console.log(chalk.bold('Options:'));
            console.log('  --no-external          Skip external URL checks');
            console.log('  --no-local             Skip local file reference checks');
            console.log('  --include-bare-urls    Include bare URLs (not in [text](url) format)');
            console.log('  --timeout <ms>         Request timeout (default: 10000)');
            console.log('  --concurrency <n>      Concurrent requests (default: 5)');
            console.log('  --clear-cache          Clear cached results');
            console.log('  --json                 Output as JSON');
            console.log('  -v, --verbose          Verbose output');
            console.log('');
            console.log(chalk.bold('Examples:'));
            console.log('  sc research link-check                              # Check awesome-ai-development');
            console.log('  sc research link-check packages/awesome-ai-development/README.md');
            console.log('  sc research link-check docs/ --verbose');
            console.log('  sc research link-check --no-external                # Only check local refs');
            console.log('  sc research link-check --clear-cache --verbose');
        }
      } catch (error) {
        console.error(chalk.red(`❌ ${error.message}`));
        if (options.verbose) {
          console.error(error.stack);
        }
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
    });

  // ============================================================================
  // DOC COMMAND (Document Management)
  // ============================================================================
  const docCommand = require('../cli-router/doc');
  program.addCommand(docCommand);

  // ============================================================================
  // GPG COMMAND (Signed Commits Setup)
  // ============================================================================
  const gpgCommand = require('../cli-router/gpg');
  program.addCommand(gpgCommand);

  // ============================================================================
  // PEOPLE COMMAND (Team/Contributor Management)
  // ============================================================================
  const peopleCommand = require('../cli-router/people');
  program.addCommand(peopleCommand);

  // ============================================================================
  // COMPLIANCE COMMAND (Security Configuration Checks)
  // ============================================================================
  const complianceCommand = require('../cli-router/compliance');
  program.addCommand(complianceCommand.program);

  // ============================================================================
  // CONNECT COMMAND (Unified External Integrations)
  // ============================================================================
  // Unified CLI for external service integrations (Jira, Google, etc.)
  program
    .command('connect [plugin] [command] [args...]')
    .description('Connect to and interact with external services (Jira, Google)')
    .option('-p, --project <key>', 'Project key (for applicable commands)')
    .option('-s, --status <status>', 'Status filter')
    .option('-a, --assignee <user>', 'Assignee filter')
    .option('-n, --limit <number>', 'Result limit')
    .option('--jql <query>', 'Custom JQL query (Jira)')
    .option('-d, --domain <domain>', 'Service domain')
    .option('-e, --email <email>', 'Email address')
    .option('-t, --token <token>', 'API token')
    .action(async (plugin, command, args, options) => {
      // Delegate to the connect module
      const connectModule = require('../cli-router/connect');
      await connectModule.handleConnect(plugin, command, args, options);
    });

  return program;
}

/**
 * Generate markdown documentation for a single CLI command
 */
function generateCommandDoc(name, cmd) {
  const lines = [];

  lines.push(`# sc ${name}`);
  lines.push('');

  if (cmd.alias) {
    lines.push(`**Alias:** \`${cmd.alias}\``);
    lines.push('');
  }

  lines.push(`**Description:** ${cmd.description || 'No description'}`);
  lines.push('');

  // Usage
  lines.push('## Usage');
  lines.push('');
  lines.push('```bash');
  lines.push(`sc ${name} [action] [options]`);
  lines.push('```');
  lines.push('');

  // Actions - use actionDetails if available for better descriptions
  if (cmd.actionDetails && cmd.actionDetails.length > 0) {
    lines.push('## Actions');
    lines.push('');
    lines.push('| Action | Description |');
    lines.push('|--------|-------------|');
    cmd.actionDetails.forEach((action) => {
      lines.push(`| \`${action.name}\` | ${action.description} |`);
    });
    lines.push('');
  } else if (cmd.actions && cmd.actions.length > 0) {
    lines.push('## Actions');
    lines.push('');
    lines.push('| Action | Description |');
    lines.push('|--------|-------------|');
    cmd.actions.forEach((action) => {
      lines.push(
        `| \`${action}\` | Run \`sc ${name} ${action} --help\` for details |`
      );
    });
    lines.push('');
  }

  // Arguments
  if (cmd.arguments && cmd.arguments.length > 0) {
    lines.push('## Arguments');
    lines.push('');
    cmd.arguments.forEach((arg) => {
      lines.push(
        `- \`${arg.syntax}\` - ${arg.description || 'No description'}`
      );
    });
    lines.push('');
  }

  // Options
  if (cmd.options && cmd.options.length > 0) {
    lines.push('## Options');
    lines.push('');
    lines.push('| Option | Description |');
    lines.push('|--------|-------------|');
    cmd.options.forEach((opt) => {
      lines.push(`| \`${opt.flags}\` | ${opt.description || ''} |`);
    });
    lines.push('');
  }

  // SOP References
  if (cmd.sopReferences && cmd.sopReferences.length > 0) {
    lines.push('## Related SOPs');
    lines.push('');
    lines.push('| SOP | Title | Usages |');
    lines.push('|-----|-------|--------|');
    cmd.sopReferences.forEach((ref) => {
      lines.push(
        `| ${ref.sopId || 'N/A'} | ${ref.title || ref.file} | ${ref.usages?.length || 0} |`
      );
    });
    lines.push('');

    // Example usages from SOPs
    const usages = cmd.sopReferences.flatMap((ref) => ref.usages || []);
    if (usages.length > 0) {
      lines.push('### Example Usages');
      lines.push('');
      lines.push('```bash');
      usages.slice(0, 5).forEach((usage) => {
        lines.push(usage);
      });
      lines.push('```');
      lines.push('');
    }
  }

  // Implementation
  if (cmd.implementationFile) {
    lines.push('## Implementation');
    lines.push('');
    lines.push(`- **File:** \`${cmd.implementationFile}\``);
    if (cmd.lineNumber) {
      lines.push(`- **Line:** ${cmd.lineNumber}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(
    '*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*'
  );

  return lines.join('\n');
}

/**
 * Generate index page for CLI commands
 */
function generateCommandIndex(data) {
  const lines = [];

  lines.push('---');
  lines.push('id: cli-overview');
  lines.push('title: CLI Commands Overview');
  lines.push('sidebar_label: Overview');
  lines.push('sidebar_position: 1');
  lines.push('---');
  lines.push('');
  lines.push('# Supernal Coding CLI Commands');
  lines.push('');
  lines.push(
    `*Generated: ${new Date().toISOString()} • ${data.metadata.totalCommands} commands*`
  );
  lines.push('');
  lines.push(
    'All commands can be run with either `sc` or `supernal-coding` prefix.'
  );
  lines.push('');
  lines.push('## Available Commands');
  lines.push('');
  lines.push('| Command | Description | SOPs |');
  lines.push('|---------|-------------|------|');

  Object.entries(data.commands)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, cmd]) => {
      const sopCount = cmd.sopReferences?.length || 0;
      lines.push(
        `| [\`sc ${name}\`](./${name}) | ${cmd.description || ''} | ${sopCount} |`
      );
    });

  lines.push('');
  lines.push('## Quick Start');
  lines.push('');
  lines.push('```bash');
  lines.push('# Get help for any command');
  lines.push('sc <command> --help');
  lines.push('');
  lines.push('# Common workflow');
  lines.push('sc requirement new "Feature title" --epic=my-epic');
  lines.push('sc requirement validate REQ-XXX');
  lines.push('sc git-smart branch --branch REQ-XXX');
  lines.push('sc git-smart merge --push --delete-local');
  lines.push('```');
  lines.push('');
  lines.push('## Regenerating Documentation');
  lines.push('');
  lines.push('```bash');
  lines.push('# Regenerate all command docs');
  lines.push('sc cli generate-docs');
  lines.push('');
  lines.push('# Custom output directory');
  lines.push('sc cli generate-docs --output docs/cli');
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    '*This documentation is auto-generated from the CLI source code.*'
  );

  return lines.join('\n');
}

module.exports = { buildProgram };
