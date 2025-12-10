#!/usr/bin/env node
// @ts-nocheck

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('node:path');
const fs = require('node:fs');

function resolvePackageJson(dir) {
  const candidates = [
    path.join(dir, '..', 'package.json'),
    path.join(dir, '..', '..', 'package.json'),
    path.join(dir, '..', '..', '..', 'package.json')
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return require(p);
      }
    } catch (_) {
      // Ignore errors when trying to read package.json
    }
  }
  // Fallback to local
  return { version: '0.0.0' };
}

function buildProgram() {
  const program = new Command();

  const commandsDir = path.join(__dirname, 'commands');
  const scriptsDir = path.join(__dirname, '..', 'scripts');
  const packageJson = resolvePackageJson(__dirname);

  // Use command registry for lazy loading
  const CommandRegistry = require('./command-registry');
  const registry = new CommandRegistry();
  registry.initialize();

  // Keep only essential modules loaded at startup
  const _CommandInterceptor = require(
    path.join(commandsDir, 'rules', 'command-interceptor')
  );

  program
    .name('sc')
    .alias('supernal-coding')
    .description(
      'Comprehensive development workflow system with kanban, git safety, and project validation'
    )
    .version(packageJson.version)
    .option(
      '--skip-upgrade-check',
      'Skip automatic upgrade checking for this command'
    )
    .option('-Y, --yes-to-rules', 'Skip rule sharing prompts (bypass consent)');

  // Register all commands using the registry for lazy loading
  const commands = registry.getAllCommands();

  commands.forEach((cmd) => {
    const command = program.command(cmd.name);

    if (cmd.alias) {
      command.alias(cmd.alias);
    }

    command.description(cmd.description);

    // Add options
    if (cmd.options && cmd.options.length > 0) {
      cmd.options.forEach(([flags, description]) => {
        command.option(flags, description);
      });
    }

    // Add arguments
    if (cmd.arguments && cmd.arguments.length > 0) {
      cmd.arguments.forEach((arg) => {
        command.argument(arg);
      });
    }

    // Set lazy-loading action
    command.action(registry.createLazyAction(cmd.name));
  });

  // Requirement management commands
  program
    .command('requirement')
    .alias('req')
    .description('Requirement management system with API-like interface')
    .argument(
      '[action]',
      'Action to perform (new, list, show, update, delete, validate, generate-tests, start-work, smart-start, search) - defaults to "list"'
    )
    .argument('[...args]', 'Additional arguments for the action')
    .option('--epic <name>', 'Epic name (kebab-case)')
    .option(
      '--priority <level>',
      'Priority: critical, high, medium, low, deferred'
    )
    .option(
      '--request-type <type>',
      'Request type: feature, bug, enhancement, maintenance'
    )
    .option('--status <status>', 'Requirement status')
    .option('--functionality <text>', 'What functionality is needed')
    .option('--benefit <text>', 'What benefit this provides')
    .option('--user-type <type>', 'User type (developer, agent, etc.)')
    .option('--force', 'Force operation (for delete)')
    .action(async (action, args, options) => {
      const handlerArgs = [action];
      if (Array.isArray(args)) {
        handlerArgs.push(...args);
      } else if (args) {
        handlerArgs.push(args);
      }
      Object.entries(options).forEach(([key, value]) => {
        if (key !== 'parent') {
          if (value === true) {
            handlerArgs.push(`--${key}`);
          } else if (value !== undefined && value !== false) {
            handlerArgs.push(`--${key}`);
            handlerArgs.push(value);
          }
        }
      });
      const { handleRequirementCommand } = require(
        path.join(commandsDir, 'requirement')
      );
      await handleRequirementCommand(...handlerArgs);
    });

  // Priority management commands
  program
    .command('priority')
    .description('Priority management for requirements and tasks')
    .argument('[action]', 'Action to perform (update, show, validate)')
    .argument(
      '[...args]',
      'Additional arguments for show command (limit, priority level)'
    )
    .option('--file <file>', 'Specific file to process')
    .option('--dry-run', 'Show what would be changed without making changes')
    .option('--limit <number>', 'Limit number of items to show')
    .option('--all', 'Show all items by priority level')
    .action(async (action, _args, options) => {
      const priorityCommand = require(
        path.join(commandsDir, 'kanban', 'priority')
      );
      return priorityCommand.main(action, options);
    });

  // Phase management commands
  program
    .command('phase')
    .description('Development phase management and tracking')
    .argument(
      '[action]',
      'Action to perform (status, show, move, map) - defaults to "status"'
    )
    .argument('[...args]', 'Additional arguments for the action')
    .option('--epic <name>', 'Epic name for phase map generation')
    .action(async (action, args, options) => {
      const handlerArgs = [action || 'status'];
      if (Array.isArray(args)) {
        handlerArgs.push(...args);
      } else if (args) {
        handlerArgs.push(args);
      }
      if (options.epic) {
        handlerArgs.push(options.epic);
      }
      const { handlePhaseCommand } = require(path.join(commandsDir, 'phase'));
      await handlePhaseCommand(...handlerArgs);
    });

  // Dashboard command
  program
    .command('dashboard')
    .description('Project dashboard for requirements and progress tracking')
    .argument(
      '[action]',
      'Action to perform (init, upgrade, serve, update, deploy, help)'
    )
    .option('--port <port>', 'Port for local server (default: 3000)')
    .option('--host <host>', 'Host to bind server to (default: localhost)')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('--force', 'Overwrite existing dashboard files')
    .option(
      '--upgrade',
      'Upgrade existing dashboard to latest template version'
    )
    .option('--dry-run', 'Show what would change without making changes')
    .option(
      '--template <type>',
      'Dashboard template type: "static" (default) or "supernal-dashboard" (Next.js)'
    )
    .option(
      '--disable-embedded',
      'Disable embedded dashboard in documentation (for deployments)'
    )
    .option('--github-pages', 'Deploy to GitHub Pages')
    .option('--vercel', 'Deploy to Vercel')
    .option('--output <dir>', 'Output directory (default: docs)')
    .action(async (action, options) => {
      try {
        // Pass Commander.js parsed options directly instead of manual parsing
        const { handleDashboardCommand } = require(
          path.join(commandsDir, 'dashboard')
        );
        await handleDashboardCommand(action, options);
      } catch (error) {
        console.error(chalk.red('❌ Dashboard command failed:'), error.message);
        process.exit(1);
      }
    });

  // Git workflow commands
  program
    .command('git-smart')
    .description('Smart git workflow utilities')
    .argument(
      '[action]',
      'Action to perform (status, check-branch, branch, check-context, suggest, merge, deploy) - defaults to "status"'
    )
    .option('--branch <branch>', 'Specific branch')
    .option('--verbose', 'Verbose output')
    .option('--push', 'Push to remote after merge')
    .option('--delete-local', 'Delete local branch after merge')
    .option('--quiet', 'Minimize output')
    .option('--tag <version>', 'Version tag for deployment')
    .option('--skip-tests', 'Skip test validation during deployment')
    .option('--skip-lint', 'Skip linting during deployment')
    .option('--no-push-tags', "Create tag locally but don't push to remote")
    .action(async (action, options) => {
      try {
        if (!action) action = 'status';
        const gitSmartPath = path.join(
          __dirname,
          'commands',
          'git',
          'git-smart.js'
        );
        const GitSmart = require(gitSmartPath);
        const gitSmart = new GitSmart();
        switch (action) {
          case 'status':
            gitSmart.showStatus();
            break;
          case 'branch': {
            const reqId = options.branch;
            if (!reqId) {
              console.error('❌ Usage: sc git-smart branch --branch REQ-XXX');
              process.exit(1);
            }
            gitSmart.createBranch(reqId.toUpperCase());
            break;
          }
          case 'check-branch': {
            const branchCheck = gitSmart.checkBranchCompliance({
              verbose: options.verbose
            });
            if (!branchCheck.valid) {
              console.log('\n🚨 BRANCH COMPLIANCE ISSUES:');
              branchCheck.issues.forEach((issue) => {
                console.log(`❌ ${issue.message}`);
                console.log(`💡 ${issue.suggestion}`);
              });
              process.exit(1);
            } else {
              console.log('\n✅ Branch compliance: PASSED');
              console.log('Safe to continue development work!');
            }
            break;
          }
          case 'check-context': {
            const detectedReqs = gitSmart.detectRecentWork();
            const contextCheck = gitSmart.checkWorkContext(detectedReqs);
            console.log('\n🔍 WORK CONTEXT CHECK\n');
            console.log(`📋 Current Branch: ${gitSmart.getCurrentBranch()}`);
            console.log(
              `🔄 Recent Work Detected: ${detectedReqs.length ? detectedReqs.join(', ') : 'None'}`
            );
            if (contextCheck.status === 'error') {
              console.log(`\n❌ ${contextCheck.message}`);
              console.log(`💡 SUGGESTION: ${contextCheck.suggestion}`);
            } else if (contextCheck.status === 'warning') {
              console.log(`\n⚠️  ${contextCheck.message}`);
              console.log(`💡 SUGGESTION: ${contextCheck.suggestion}`);
            } else {
              console.log(`\n✅ ${contextCheck.message}`);
            }
            break;
          }
          case 'suggest': {
            const currentStatus = gitSmart.getCurrentStatus();
            if (currentStatus.requirement) {
              console.log(
                `💡 Current branch follows convention: ${currentStatus.branch}`
              );
            } else {
              console.log('💡 Suggested branch naming:');
              console.log('   feature/req-XXX-description');
              console.log('   hotfix/issue-description');
              console.log('   docs/update-description');
            }
            break;
          }
          case 'merge': {
            const featureBranch = options.branch;
            const autoPush = options.push || false;
            const deleteLocal = options.deleteLocal || false;
            const quiet = options.quiet || false;
            console.log('🔄 Initiating safe merge process...');
            if (featureBranch) {
              console.log(`   Target branch: ${featureBranch}`);
            } else {
              console.log('   Using current branch');
            }
            const mergeResult = gitSmart.performSafeMerge(featureBranch, {
              autoPush,
              deleteLocal,
              verbose: !quiet
            });
            if (!mergeResult.success) {
              process.exit(1);
            }
            break;
          }
          case 'deploy': {
            const tagVersion = options.tag;
            const skipTests = options.skipTests || false;
            const skipLint = options.skipLint || false;
            const noPushTags = options.noPushTags || false;
            const deployQuiet = options.quiet || false;
            const deployResult = await gitSmart.performDeployment({
              tagVersion,
              pushTags: !noPushTags,
              runTests: !skipTests,
              runLint: !skipLint,
              verbose: !deployQuiet
            });
            if (!deployResult.success) {
              console.error(`❌ Deployment failed: ${deployResult.error}`);
              process.exit(1);
            }
            break;
          }
          default:
            console.log(chalk.red(`❌ Unknown action: "${action}"`));
            console.log(chalk.blue('Available actions:\n'));
            console.log('🚀 Supernal Coding Git Smart Commands:');
            console.log('');
            console.log(
              '   sc git-smart status         Show current development status'
            );
            console.log(
              '   sc git-smart branch --branch REQ-XXX  Create feature branch for requirement'
            );
            console.log(
              '   sc git-smart check-branch   Validate branch compliance (no main/master)'
            );
            console.log(
              '   sc git-smart check-context  Check if current work matches branch'
            );
            console.log(
              '   sc git-smart suggest        Get branch naming suggestions'
            );
            console.log('');
            console.log('Examples:');
            console.log('   sc git-smart status');
            console.log('   sc git-smart branch --branch REQ-024');
            console.log('   sc git-smart check-branch');
            console.log('   sc git-smart check-context');
            console.log('');
            break;
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Error running git-smart command:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Safe merge command
  program
    .command('merge-safe')
    .alias('merge')
    .description('Safe merge with rebase and validation')
    .argument(
      '[branch]',
      'Feature branch to merge (defaults to current branch)'
    )
    .option('--push', 'Push to remote after merge')
    .option('--delete-local', 'Delete local branch after merge')
    .option('--interactive, -i', 'Interactive mode with prompts')
    .option('--quiet, -q', 'Minimize output')
    .action(async (branch, options) => {
      try {
        const SafeMerge = require(path.join(commandsDir, 'git', 'merge-safe'));
        const safeMerge = new SafeMerge();
        const result = await safeMerge.performMerge({
          branch,
          autoPush: options.push,
          deleteLocal: options.deleteLocal,
          verbose: !options.quiet,
          interactive: options.interactive
        });
        if (!result.success && !result.cancelled) {
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        process.exit(1);
      }
    });

  // Frontmatter fixing command
  program
    .command('fix-frontmatter')
    .description('Auto-fix common frontmatter issues in requirement files')
    .action(async (options) => {
      const fixFrontmatterCommand = require(
        path.join(commandsDir, 'validation', 'fix-frontmatter')
      );
      return fixFrontmatterCommand.main(options);
    });

  // Type duplication checking command
  program
    .command('type-check')
    .description('Detect and prevent TypeScript/JavaScript type duplications')
    .option(
      '--pre-commit',
      'Run in pre-commit mode (exit with error on duplications)'
    )
    .option(
      '--force',
      'Force commit despite duplications (use with --pre-commit)'
    )
    .option('--show-ignored', 'Include ignored types in output')
    .option('--show-legitimate', 'Include legitimate duplications in output')
    .option(
      '--init-config',
      'Create initial .duplication-lint.json config file'
    )
    .option('--add-ignore <type>', 'Add a type to the ignore list')
    .option('--add-legitimate <type>', 'Add a type to legitimate duplications')
    .option('--update <type>', "Update only the specified type's report")
    .option(
      '--update-types <types>',
      'Update multiple specific types (comma-separated)'
    )
    .action(async (_options) => {
      const args = process.argv.slice(process.argv.indexOf('type-check') + 1);
      const typeCheckCommand = require(path.join(commandsDir, 'type-check'));
      await typeCheckCommand.handler(args);
    });

  // Upgrade checking and management commands
  program
    .command('check-upgrade')
    .description('Check for available upgrades of supernal-code')
    .option('--force', 'Force check even if recently checked')
    .option('--silent', 'Suppress output except errors')
    .option('--upgrade', 'Perform automatic upgrade if available')
    .option(
      '--dry-run',
      'Show upgrade command without executing (use with --upgrade)'
    )
    .option('--version-info', 'Display current version information')
    .action(async (options) => {
      const UpgradeChecker = require(
        path.join(commandsDir, 'upgrade', 'check-upgrade')
      );
      const checker = new UpgradeChecker();
      if (options.versionInfo) {
        console.log(`Current version: ${checker.currentVersion}`);
        console.log(`Installation method: ${checker.getInstallationMethod()}`);
        return;
      }
      if (options.upgrade) {
        const result = await checker.performSelfUpgrade({
          dryRun: options.dryRun,
          verbose: true
        });
        if (!result.success) {
          process.exit(1);
        }
        return;
      }
      const result = await checker.checkForUpgrade({
        force: options.force,
        silent: options.silent
      });
      if (!options.silent && result.checked) {
        if (result.needsUpgrade) {
          checker.displayUpgradeNotification(result);
        } else if (result.isDevelopment) {
          console.log(chalk.blue('🔧 Running in development mode'));
        } else {
          console.log(chalk.green('✅ Running the latest version'));
        }
      }
    });

  program
    .command('upgrade')
    .description('Upgrade supernal-code to the latest version')
    .option('--dry-run', 'Show upgrade command without executing')
    .option('--force', 'Force upgrade even if already up to date')
    .action(async (options) => {
      const UpgradeChecker = require(
        path.join(commandsDir, 'upgrade', 'check-upgrade')
      );
      const checker = new UpgradeChecker();
      const result = await checker.performSelfUpgrade({
        dryRun: options.dryRun,
        verbose: true,
        force: options.force
      });
      if (!result.success) {
        process.exit(1);
      }
    });

  // Kanban management commands
  program
    .command('kanban')
    .description('Kanban task management system')
    .argument('[action]', 'Action to perform (list, todo, priority, etc.)')
    .argument('[...args]', 'Additional arguments for the action')
    .option('--filter <type>', 'Filter tasks by type')
    .option('--priority <level>', 'Set priority level (0-4)')
    .action(async (action, args, _options) => {
      const kanbanArgs = [];
      if (action) {
        kanbanArgs.push(action);
        if (args) {
          if (Array.isArray(args) && args.length > 0) {
            if (
              args.length > 1 &&
              args.every((arg) => typeof arg === 'string' && arg.length === 1)
            ) {
              const joinedArg = args.join('');
              kanbanArgs.push(joinedArg);
            } else {
              kanbanArgs.push(...args);
            }
          } else if (typeof args === 'string') {
            kanbanArgs.push(args);
          }
        }
      }
      try {
        const KanbanWrapper = require(
          path.join(commandsDir, 'kanban', 'kanban')
        );
        const kanban = new KanbanWrapper();
        kanban.execute(kanbanArgs);
      } catch (error) {
        console.error(
          chalk.red('❌ Error running kanban command:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Workflow management commands
  program
    .command('workflow')
    .description('Project workflow management')
    .argument(
      '[action]',
      'Action to perform (list, todo, priority, etc.) - defaults to "list"'
    )
    .argument('[...args]', 'Additional arguments for the action')
    .option('--filter <type>', 'Filter tasks by type')
    .option('--priority <level>', 'Set priority level (0-4)')
    .action(async (action, args, options) => {
      try {
        const { handleWorkflowCommand } = require(
          path.join(commandsDir, 'workflow')
        );
        if (!action) action = 'list';
        const workflowArgs = [action, ...(args || [])];
        Object.entries(options).forEach(([key, value]) => {
          if (key !== 'parent' && value !== undefined && value !== false) {
            if (value === true) {
              workflowArgs.push(`--${key}`);
            } else {
              workflowArgs.push(`--${key}`);
              workflowArgs.push(value);
            }
          }
        });
        await handleWorkflowCommand(...workflowArgs);
      } catch (error) {
        console.error(
          chalk.red('❌ Error running workflow command:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Documentation commands
  program
    .command('docs')
    .description('Documentation management system')
    .argument(
      '[action]',
      'Action to perform (generate, validate, build, init, check) - shows help if not specified'
    )
    .option('--format <format>', 'Output format (html, pdf, markdown)')
    .option('--output <path>', 'Output directory')
    .action(async (action, options) => {
      try {
        if (!action) {
          const DocsWrapper = require(
            path.join(commandsDir, 'documentation', 'docs')
          );
          const docs = new DocsWrapper();
          docs.showHelp();
          return;
        }
        const DocsWrapper = require(
          path.join(commandsDir, 'documentation', 'docs')
        );
        const docs = new DocsWrapper();
        docs.execute(action, options);
      } catch (error) {
        console.error(
          chalk.red('❌ Error running docs command:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Project initialization system
  program
    .command('init')
    .description('Equip current repository with specific preset')
    .argument('[directory]', 'Target directory (default: current)')
    .option('--name <n>', 'Project name (default: supernal-coding)')
    .option('--alias <alias>', 'Command alias (default: sc)')
    .option(
      '--interactive',
      'Interactive setup with project type detection',
      false
    )
    .option(
      '--minimal',
      'Install only essential structure and workflow automation'
    )
    .option(
      '--standard',
      'Install complete development environment (recommended)'
    )
    .option(
      '--full',
      'Install complete supernal ecosystem with advanced features'
    )
    .option(
      '--development',
      'Install everything including internal development tools'
    )
    .option(
      '--include-testing',
      'Include test-repos directory and testing infrastructure'
    )
    .option(
      '--merge',
      'Intelligently merge with existing files (analyze conflicts and merge compatible content)'
    )
    .option('--dry-run', 'Show what would be installed without making changes')
    .option('--overwrite', 'Force overwrite existing files and configurations')
    .action(async (directory, options) => {
      try {
        const initCommand = require(path.join(commandsDir, 'setup', 'init'));
        await initCommand({
          ...options,
          directory: directory || process.cwd(),
          projectName: options.name || 'supernal-coding',
          alias: options.alias || 'sc'
        });
      } catch (error) {
        console.error(
          chalk.red('❌ Error during initialization:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Suggestion system
  program
    .command('suggest')
    .description('Instantly create GitHub issues with context')
    .argument('<feedback>', 'Your feedback, bug report, or feature request')
    .argument('[...args]', 'Additional words for the feedback')
    .action(async (feedback, args = [], options = {}) => {
      try {
        const fullFeedback = [feedback, ...(args || [])].join(' ');
        options._ = args || [];
        const suggestCommand = require(
          path.join(commandsDir, 'agent', 'suggest')
        );
        await suggestCommand(fullFeedback, options);
      } catch (error) {
        console.error(
          chalk.red('❌ Error creating suggestion:'),
          error.message
        );
        process.exit(1);
      }
    });

  program
    .command('suggest-bug')
    .description('Quick bug report')
    .argument('<description>', 'Bug description')
    .argument('[...args]', 'Additional words for the description')
    .action(async (description, args = [], options = {}) => {
      try {
        const fullDescription = [description, ...(args || [])].join(' ');
        options._ = args || [];
        const suggestCommand = require(
          path.join(commandsDir, 'agent', 'suggest')
        );
        await suggestCommand('bug', { _: fullDescription });
      } catch (error) {
        console.error(
          chalk.red('❌ Error creating bug report:'),
          error.message
        );
        process.exit(1);
      }
    });

  program
    .command('suggest-feature')
    .description('Quick feature request')
    .argument('<idea>', 'Feature idea')
    .argument('[...args]', 'Additional words for the idea')
    .action(async (idea, args = [], options = {}) => {
      try {
        const fullIdea = [idea, ...(args || [])].join(' ');
        options._ = args || [];
        const suggestCommand = require(
          path.join(commandsDir, 'agent', 'suggest')
        );
        await suggestCommand('feature', { _: fullIdea });
      } catch (error) {
        console.error(
          chalk.red('❌ Error creating feature request:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Handoff management
  program
    .command('handoff')
    .description('Manage agent handoffs with proper naming conventions')
    .argument('[action]', 'Action to perform (create, validate, list)')
    .option('--req <id>', 'Requirement ID (e.g., REQ-024)')
    .option('--title <title>', 'Handoff title')
    .option(
      '--status <status>',
      'Handoff status (active, completed, blocked)',
      'active'
    )
    .option('--description <desc>', 'Handoff description')
    .option('--timestamp <timestamp>', 'Custom timestamp (YYYY-MM-DD-HH-MM)')
    .option('--force', 'Force overwrite existing handoff')
    .action(async (action, options) => {
      try {
        const HandoffManager = require(path.join(commandsDir, 'handoff'));
        const handoffManager = new HandoffManager();
        switch (action) {
          case 'create': {
            if (!options.title) {
              console.error(
                chalk.red('❌ Title is required for handoff creation')
              );
              console.log(
                chalk.yellow(
                  'Usage: sc handoff create --title="task-name" [--req=REQ-XXX]'
                )
              );
              process.exit(1);
            }
            const result = await handoffManager.create(options);
            console.log(chalk.green('✅'), result.message);
            console.log(chalk.blue('📄'), `File: ${result.filename}`);
            break;
          }
          case 'validate': {
            const filename = options.title;
            if (!filename) {
              console.error(chalk.red('❌ Filename required for validation'));
              console.log(
                chalk.yellow(
                  'Usage: sc handoff validate --title="2025-01-19-14-30-task-name.md"'
                )
              );
              process.exit(1);
            }
            const validation = handoffManager.validate(filename);
            console.log(
              validation.valid ? chalk.green('✅') : chalk.red('❌'),
              validation.message
            );
            break;
          }
          case 'list': {
            const handoffs = handoffManager.list();
            console.log(chalk.blue('\n📋 Handoff Files:'));
            if (handoffs.length === 0) {
              console.log(chalk.yellow('No handoff files found'));
            } else {
              handoffs.forEach((handoff) => {
                const status = handoff.valid
                  ? chalk.green('✅')
                  : chalk.red('❌');
                const modified = handoff.stat.mtime.toISOString().split('T')[0];
                console.log(`${status} ${handoff.filename} (${modified})`);
              });
            }
            break;
          }
          default:
            console.log(
              chalk.blue(
                `Handoff Management Commands:\n\n🤝 Create new handoff:\n  sc handoff create --title="task-name" --req=REQ-XXX --status=active\n\n✅ Validate naming:\n  sc handoff validate --title="2025-01-19-14-30-task-name.md"\n\n📋 List handoffs:\n  sc handoff list\n\nNaming Convention: YYYY-MM-DD-HH-MM-[title].md`
              )
            );
            break;
        }
      } catch (error) {
        console.error(chalk.red('❌ Handoff Error:'), error.message);
        process.exit(1);
      }
    });

  // Test guidance and execution system
  program
    .command('test')
    .description('Testing guidance and execution system')
    .argument(
      '[action]',
      'Action to perform (guide, setup, validate, plan, run, review, doctor, structure)',
      'guide'
    )
    .argument(
      '[target]',
      'Target for action (topic for guide, req-id for plan, test type for run, templates for validate)'
    )
    .option(
      '--framework <framework>',
      'Testing framework (playwright, jest, cypress)'
    )
    .option('--project-type <type>', 'Project type (web, extension, mobile)')
    .option(
      '--topic <topic>',
      'Guidance topic (playwright, naming, structure, requirements, quality)'
    )
    .option('--requirement-id <id>', 'Requirement ID for test planning')
    .option('--fix', 'Auto-fix validation issues')
    .option('--generate', 'Generate test files from plan')
    .option(
      '--coverage-threshold <number>',
      'Set coverage threshold percentage',
      '80'
    )
    .option('--e2e', 'Include end-to-end tests')
    .option('--no-parallel', 'Disable parallel test execution')
    .option('--verbose', 'Enable verbose output')
    .option('--no-bail', 'Continue testing after failures')
    .option('--timeout <number>', 'Set test timeout in seconds', '300')
    .option('--no-reports', 'Skip generating test reports')
    .option('--show-valid', 'Show valid templates in validation results')
    .action(async (action, target, options) => {
      try {
        const TestGuidanceSystem = require(
          path.join(commandsDir, 'testing', 'test-guidance')
        );
        const testSystem = new TestGuidanceSystem({
          projectRoot: process.cwd(),
          verbose: options.verbose
        });
        const legacyTestTypes = [
          'all',
          'unit',
          'e2e',
          'integration',
          'requirements',
          'specific',
          'framework',
          'map',
          'discover'
        ];
        if (action === 'run' || legacyTestTypes.includes(action)) {
          const testType = action === 'run' ? target : action;
          const testScriptPath = path.join(process.cwd(), 'TESTME.sh');
          if (!fs.existsSync(testScriptPath)) {
            console.log(
              chalk.yellow('⚠️ TESTME.sh not found, falling back to npm test')
            );
            const { spawn } = require('node:child_process');
            const npmTest = spawn('npm', ['test'], { stdio: 'inherit' });
            npmTest.on('close', (code) => process.exit(code));
            return;
          }
          const args = [testType];
          if (target && action === 'run') args.push(target);
          const env = { ...process.env };
          if (options.coverageThreshold)
            env.COVERAGE_THRESHOLD = options.coverageThreshold;
          if (options.e2e) env.RUN_E2E = 'true';
          if (options.parallel === false) env.PARALLEL_TESTS = 'false';
          if (options.verbose) env.VERBOSE = 'true';
          if (options.bail === false) env.BAIL_ON_FAILURE = 'false';
          if (options.timeout) env.TEST_TIMEOUT = options.timeout;
          if (options.reports === false) env.GENERATE_REPORTS = 'false';
          console.log(
            chalk.blue(
              '🧪 Running tests using standardized TESTME.sh interface...'
            )
          );
          const { spawn } = require('node:child_process');
          const testProcess = spawn('./TESTME.sh', args, {
            stdio: 'inherit',
            env
          });
          testProcess.on('close', (code) => process.exit(code));
          return;
        }
        const actionOptions = {
          framework: options.framework,
          projectType: options.projectType,
          topic: options.topic || target,
          requirementId: options.requirementId || target,
          fix: options.fix,
          generate: options.generate,
          ...options
        };
        await testSystem.execute(action, actionOptions);
      } catch (error) {
        console.error(chalk.red('❌ Error in test system:'), error.message);
        if (options.verbose) console.error(error.stack);
        process.exit(1);
      }
    });

  // Test mapping command
  program
    .command('test-map')
    .alias('tmap')
    .description('Generate comprehensive test mapping and analysis')
    .option(
      '--format <format>',
      'Output format (report, json, commands, stats)',
      'report'
    )
    .action(async (options) => {
      try {
        const TestMapperCommand = require(
          path.join(commandsDir, 'testing', 'test-mapper')
        );
        console.log(
          chalk.blue(`🗺️ Generating test map with format: ${options.format}...`)
        );
        const testMapper = new TestMapperCommand();
        await testMapper.discover();
        switch ((options.format || 'report').toLowerCase()) {
          case 'json':
            console.log(testMapper.exportJSON());
            break;
          case 'commands':
            console.log(
              JSON.stringify(testMapper.generateTestCommands(), null, 2)
            );
            break;
          case 'stats': {
            const stats = testMapper.getStats();
            console.log(`Total Files: ${stats.totalFiles}`);
            console.log(`Total Tests: ${stats.totalTests}`);
            console.log(`Requirements Coverage: ${stats.coveragePercentage}%`);
            break;
          }
          default:
            console.log(testMapper.generateReport());
            break;
        }
        console.log(chalk.green('✅ Test mapping completed successfully'));
      } catch (error) {
        console.error(
          chalk.red('❌ Error running test mapper:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Workflow guard
  program
    .command('guard')
    .description('Development workflow guard and validation system')
    .argument(
      '[action]',
      'Action to perform (guide, check, pre-add, install-hooks)',
      'guide'
    )
    .option('--verbose', 'Enable verbose output')
    .action(async (action, options) => {
      try {
        const WorkflowGuard = require(
          path.join(commandsDir, 'development', 'workflow-guard')
        );
        const guard = new WorkflowGuard({
          projectRoot: process.cwd(),
          verbose: options.verbose
        });
        await guard.execute(action);
      } catch (error) {
        console.error(chalk.red('❌ Workflow guard error:'), error.message);
        if (options.verbose) console.error(error.stack);
        process.exit(1);
      }
    });

  // Git protection setup
  program
    .command('git-protect')
    .description(
      'Install enhanced git workflow protection (prevents git add on main)'
    )
    .argument(
      '[action]',
      'Action to perform (install, status, uninstall)',
      'install'
    )
    .action(async (action, _options) => {
      try {
        const { GitProtectionSetup } = require(
          path.join(commandsDir, 'git', 'setup-git-protection')
        );
        const setup = new GitProtectionSetup();
        await setup.execute(action);
      } catch (error) {
        console.error(chalk.red('❌ Git protection error:'), error.message);
        process.exit(1);
      }
    });

  // Development tools commands
  program
    .command('dev')
    .description('Development tools and utilities')
    .argument('<action>', 'Action to perform (find-logs)')
    .option('--max-ratio <ratio>', 'Maximum allowed ratio for find-logs')
    .option('--output <file>', 'Output file path for find-logs')
    .action(async (action, options) => {
      try {
        const DevTools = require(path.join(commandsDir, 'development', 'dev'));
        const devTools = new DevTools();
        switch (action) {
          case 'find-logs':
            await devTools.findExcessiveLogs({
              maxRatio: options.maxRatio,
              outputFile: options.output
            });
            break;
          default:
            console.error(chalk.red(`❌ Unknown dev action: ${action}`));
            devTools.showHelp();
            process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Error running dev command:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Rule discovery and management commands
  program
    .command('rules')
    .description('Discover and manage repository rules')
    .argument(
      '[action]',
      'Action to perform (discover, export, help)',
      'discover'
    )
    .option('--verbose, -v', 'Show detailed information')
    .option('--json', 'Output in JSON format')
    .option('--output <file>', 'Save report to file')
    .action(async (action, options) => {
      try {
        const RuleDiscovery = require(
          path.join(commandsDir, 'rules', 'rule-discovery')
        );
        const discovery = new RuleDiscovery(options);
        switch (action) {
          case 'discover':
          case 'scan': {
            console.log(chalk.blue('🔍 Discovering rules in repository...'));
            await discovery.discoverRules();
            const report = discovery.generateReport();
            if (options.verbose && report.verboseLog.length > 0) {
              const fsx = require('fs-extra');
              const verboseFile = './rule-discovery-verbose.log';
              await fsx.writeFile(verboseFile, report.verboseLog.join('\n'));
              console.log(
                chalk.yellow(
                  `📝 Verbose log saved: ${verboseFile} (${report.verboseLog.length} lines)`
                )
              );
            }
            if (options.output) {
              const fsx = require('fs-extra');
              await fsx.writeFile(
                options.output,
                discovery.formatReport(report, 'json')
              );
              console.log(chalk.green(`✅ Report saved to: ${options.output}`));
            } else {
              console.log(
                discovery.formatReport(
                  report,
                  options.json ? 'json' : 'console'
                )
              );
            }
            break;
          }
          case 'export': {
            const exportPath = options.output || './rules-export.json';
            await discovery.discoverRules();
            await discovery.exportForSharing(exportPath);
            break;
          }
          default: {
            console.log(`
${chalk.blue('Rule Discovery System')}

Usage: sc rules [action] [options]

Actions:
  discover, scan    Discover and report rules (default)
  export           Export rules for sharing
  help             Show this help

Options:
  --verbose, -v    Show detailed information
  --json           Output in JSON format
  --output=<file>  Save report to file

Examples:
  sc rules discover --verbose
  sc rules export --output=./my-rules.json
  sc rules scan --json --output=./report.json
            `);
            break;
          }
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Error running rules command:'),
          error.message
        );
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  // Development monitoring commands - Enhanced with CI/CD diagnostics
  program
    .command('monitor')
    .alias('status')
    .description(
      'Monitor development status and CI/CD workflows with intelligent diagnostics'
    )
    .argument(
      '[action]',
      'Action: status, ci, diagnose, watch (see help for all)',
      'status'
    )
    .action(async (action) => {
      try {
        // Delegate to our enhanced monitor.js which has all the intelligent functionality
        const { spawn } = require('node:child_process');
        const monitorPath = path.join(commandsDir, 'development', 'monitor.js');
        const monitorProcess = spawn('node', [monitorPath, action], {
          stdio: 'inherit',
          cwd: process.cwd()
        });

        monitorProcess.on('exit', (code) => {
          if (code !== 0) {
            process.exit(code);
          }
        });
      } catch (error) {
        console.error(
          chalk.red('❌ Error running monitor command:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Git hooks commands
  program
    .command('git-hooks')
    .description('Git hooks management and installation')
    .argument(
      '<action>',
      'Action to perform (install, pre-commit, pre-push, safety, status)'
    )
    .action(async (action, options) => {
      try {
        const GitHooks = require(path.join(commandsDir, 'git', 'git-hooks'));
        const gitHooks = new GitHooks();
        if (action !== 'help') {
          gitHooks.checkGitRepository();
        }
        switch (action) {
          case 'install':
            await gitHooks.installAll(options);
            break;
          case 'pre-commit':
            await gitHooks.installPreCommitHooks(options);
            break;
          case 'pre-push':
            await gitHooks.installPrePushHooks(options);
            break;
          case 'safety':
            await gitHooks.installGitSafetyHooks(options);
            break;
          case 'status':
            gitHooks.checkStatus();
            break;
          case 'help':
            gitHooks.showHelp();
            break;
          default:
            console.error(chalk.red(`❌ Unknown git-hooks action: ${action}`));
            gitHooks.showHelp();
            process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Error running git-hooks command:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Git assessment and analysis commands
  program
    .command('git-assess')
    .alias('assess')
    .description('Comprehensive git repository assessment and analysis')
    .option('--format <format>', 'Output format (report, json, csv)', 'report')
    .option('--recommendations', 'Show only recommendations')
    .option('--score', 'Show only overall score')
    .action(async (options) => {
      try {
        const GitAssessmentCommand = require(
          path.join(commandsDir, 'git', 'assessment')
        );
        const assessment = new GitAssessmentCommand();
        const silent = options.format === 'json' || options.format === 'csv';
        const result = await assessment.runAssessment({ silent });
        if (options.score) {
          console.log(`Overall Score: ${result.overallScore}/100`);
        } else if (options.recommendations) {
          if (result.recommendations.length > 0) {
            console.log('💡 Recommendations:');
            result.recommendations.forEach((rec, index) => {
              console.log(
                `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`
              );
              if (rec.action) console.log(`   Action: ${rec.action}`);
            });
          } else {
            console.log('✅ No recommendations - repository is in good shape!');
          }
        } else if (options.format === 'json') {
          console.log(assessment.exportJSON());
        } else if (options.format === 'csv') {
          console.log(assessment.exportCSV());
        } else {
          console.log(assessment.generateReport());
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Error running git assessment:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Requirements tracking initialization
  program
    .command('init-req-tracking')
    .alias('init-tracking')
    .description(
      'Initialize git tracking metadata for all requirement markdown files'
    )
    .option('-n, --dry-run', 'Show what would be done without making changes')
    .option('-v, --verbose', 'Show detailed progress information')
    .option(
      '-f, --force',
      'Update files even if they already have git_tracking'
    )
    .option('-p, --pattern <pattern>', 'Custom glob pattern for finding files')
    .action(async (options) => {
      try {
        const { initRequirementsTracking } = require(
          path.join(commandsDir, 'git', 'init-requirements-tracking')
        );
        await initRequirementsTracking(options);
      } catch (error) {
        console.error(
          chalk.red('❌ Error initializing requirements tracking:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Git workflow validation commands
  program
    .command('git-validate')
    .alias('git-check')
    .description(
      'Validate git workflow compliance (branch naming, commit messages)'
    )
    .argument(
      '[type]',
      'What to validate (workflow, branch, commit)',
      'workflow'
    )
    .argument('[value]', 'Value to validate (branch name or commit message)')
    .action(async (type, value, _options) => {
      try {
        const GitWorkflowValidator = require(
          path.join(scriptsDir, 'git-workflow-validator')
        );
        const validator = new GitWorkflowValidator();
        switch (type) {
          case 'workflow': {
            const results = validator.validateWorkflow();
            console.log('\n🔍 Git Workflow Validation Results');
            console.log('====================================');
            console.log(
              `Overall Score: ${results.overallScore}/100 (${validator.getGradeFromScore(results.overallScore)})`
            );
            console.log(
              `Repository Health: ${results.repositoryValidation.score}/100`
            );
            if (results.branchValidation) {
              console.log(
                `Branch Naming: ${results.branchValidation.valid ? '✅' : '❌'} ${results.branchValidation.message}`
              );
            }
            if (results.commitValidation) {
              console.log(
                `Commit Format: ${results.commitValidation.valid ? '✅' : '❌'} ${results.commitValidation.message}`
              );
            }
            if (results.recommendations.length > 0) {
              console.log('\n📋 Recommendations:');
              results.recommendations.forEach((rec, index) => {
                const emoji =
                  rec.level === 'critical'
                    ? '🔴'
                    : rec.level === 'warning'
                      ? '🟡'
                      : '🔵';
                console.log(`${emoji} ${index + 1}. ${rec.message}`);
                if (rec.command) console.log(`   Command: ${rec.command}`);
              });
            }
            break;
          }
          case 'branch': {
            const branchName = value || process.env.GIT_BRANCH || 'current';
            const branchResult = validator.validateBranchName(branchName);
            console.log(
              `Branch Validation: ${branchResult.valid ? '✅' : '❌'} ${branchResult.message}`
            );
            if (!branchResult.valid && branchResult.guidance) {
              console.log('\n📋 Branch Naming Guidelines:');
              console.log(branchResult.guidance.message);
              branchResult.guidance.examples.forEach((example) => {
                console.log(`  • ${example}`);
              });
            }
            break;
          }
          case 'commit': {
            if (!value) {
              console.error('❌ Commit message required for validation');
              console.log(
                'Usage: sc git-validate commit "REQ-011: Your commit message"'
              );
              process.exit(1);
            }
            const commitResult = validator.validateCommitMessage(value);
            console.log(
              `Commit Validation: ${commitResult.valid ? '✅' : '❌'} ${commitResult.message}`
            );
            if (!commitResult.valid && commitResult.guidance) {
              console.log('\n📋 Commit Message Guidelines:');
              console.log(commitResult.guidance.message);
              console.log(`Format: ${commitResult.guidance.format}`);
              console.log('Examples:');
              commitResult.guidance.examples.forEach((example) => {
                console.log(`  • ${example}`);
              });
            }
            break;
          }
          default:
            console.error(
              '❌ Invalid validation type. Use: workflow, branch, or commit'
            );
            process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Error running git validation:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Repository sync check and management
  program
    .command('update')
    .description('Update the global sc package installation')
    .argument('[action]', 'Action to perform (check, update)', 'update')
    .option('--verbose', 'Enable verbose output')
    .option(
      '--dry-run',
      'Show what would happen during update without making changes'
    )
    .action(async (action, options) => {
      try {
        const PackageUpdater = require(
          path.join(commandsDir, 'upgrade', 'package-updater')
        );
        const updater = new PackageUpdater({
          projectRoot: process.cwd(),
          verbose: options.verbose
        });
        switch (action) {
          case 'check':
            await updater.checkForUpdates();
            break;
          default:
            await updater.updatePackage(options.dryRun);
            break;
        }
      } catch (error) {
        console.error(chalk.red('❌ Package update error:'), error.message);
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  program
    .command('sync')
    .description(
      'Synchronize local repository state with global sc installation'
    )
    .argument(
      '[action]',
      'Action to perform (check, report, init, info)',
      'sync'
    )
    .option('--verbose', 'Enable verbose output')
    .option(
      '--dry-run',
      'Show what would happen during sync without making changes'
    )
    .action(async (action, options) => {
      try {
        const RepoSyncChecker = require(
          path.join(commandsDir, 'upgrade', 'repo-sync-check')
        );
        const checker = new RepoSyncChecker({
          projectRoot: process.cwd(),
          verbose: options.verbose
        });
        switch (action) {
          case 'check':
            await checker.checkRepoSync();
            break;
          case 'report':
            await checker.showSyncReport();
            break;
          case 'init':
            await checker.stateManager.initializeScFolder();
            console.log(
              chalk.green(
                '✅ .supernal-coding folder initialized for sync tracking'
              )
            );
            break;
          case 'info':
            await checker.stateManager.showStateInfo();
            break;
          default:
            await checker.syncRepository(options.dryRun);
        }
      } catch (error) {
        console.error(chalk.red('❌ Repository sync error:'), error.message);
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  // Configuration commands
  program
    .command('config')
    .description('Manage Supernal Coding configuration and privacy settings')
    .argument('[category]', 'Configuration category (privacy)', 'help')
    .option(
      '--rules-reporting <mode>',
      'Set rules reporting consent mode (ask_every_time, always_allow, never_allow, sometimes_allow)'
    )
    .option('--status', 'Show current configuration status')
    .option('--reset', 'Reset configuration to defaults')
    .action(async (category, options) => {
      try {
        switch (category) {
          case 'privacy': {
            const privacyCommand = require(
              path.join(commandsDir, 'config', 'privacy')
            );
            await privacyCommand(options);
            break;
          }
          default:
            console.log(chalk.blue.bold('🔧 Supernal Coding Configuration'));
            console.log(chalk.blue('=================================='));
            console.log(chalk.white('\nAvailable configuration categories:'));
            console.log(
              '  privacy    Manage privacy and data sharing preferences'
            );
            console.log('');
            console.log(chalk.bold('Usage:'));
            console.log('  sc config privacy [options]');
            console.log('');
            console.log(chalk.bold('Examples:'));
            console.log('  sc config privacy --status');
            console.log('  sc config privacy --rules-reporting=never_allow');
            break;
        }
      } catch (error) {
        console.error(chalk.red('❌ Configuration error:'), error.message);
        process.exit(1);
      }
    });

  // Help command override
  program
    .command('help')
    .description('Show comprehensive help')
    .action(() => {
      console.log(
        chalk.bold.cyan('🚀 Supernal Coding - Development Workflow System')
      );
      console.log('================================================');
      console.log('');
      console.log(chalk.bold('Core Commands:'));
      console.log(
        `  ${chalk.green('sc kanban list')}          - View kanban board`
      );
      console.log(
        `  ${chalk.green('sc kanban todo "task"')}   - Create new task`
      );
      console.log(
        `  ${chalk.green('sc priority update')}      - Update requirement priorities`
      );
      console.log(
        `  ${chalk.green('sc validate --all')}       - Validate project structure`
      );
      console.log(
        `  ${chalk.green('sc agent onboard')}        - Agent onboarding workflow`
      );
      console.log(
        `  ${chalk.green('sc dashboard init')}       - Initialize project dashboard`
      );
      console.log('');
      console.log(chalk.bold('Development Tools:'));
      console.log(
        `  ${chalk.green('sc dev find-logs')}        - Find files with excessive console logs`
      );
      console.log(
        `  ${chalk.green('sc git-hooks install')}    - Install git safety hooks`
      );
      console.log(
        `  ${chalk.green('sc git-hooks status')}     - Check git hooks status`
      );
      console.log('');
      console.log(chalk.bold('Distribution:'));
      console.log(
        `  ${chalk.green('sc install <path>')}       - Install in other repositories`
      );
      console.log(
        `  ${chalk.green('npm install -g .')}        - Install globally as 'sc' command`
      );
      console.log('');
      console.log(chalk.bold('Examples:'));
      console.log(
        `  ${chalk.yellow('sc kanban todo "implement auth system"')}`
      );
      console.log(`  ${chalk.yellow('sc kanban priority next')}`);
      console.log(`  ${chalk.yellow('sc validate --requirements')}`);
      console.log(
        `  ${chalk.yellow('sc install ../other-project --mode=hybrid')}`
      );
      console.log('');
      console.log('For detailed help on any command: sc <command> --help');
    });

  // MCP Server command
  program
    .command('mcp')
    .description('Start the Supernal Coding MCP server')
    .action(async () => {
      try {
        const MCPServer = require(path.join(commandsDir, 'mcp', 'mcp'));
        const server = new MCPServer();
        await server.start();
      } catch (error) {
        console.error(
          chalk.red('❌ Error starting MCP server:'),
          error.message
        );
        process.exit(1);
      }
    });

  // Add rule reporting interception and auto-upgrade check to all commands
  program.hook('preAction', async (_thisCommand, actionCommand) => {
    // Auto-upgrade check (skip for upgrade-related commands and if explicitly disabled)
    const skipUpgradeCheck =
      actionCommand.opts()['skip-upgrade-check'] ||
      ['check-upgrade', 'upgrade', 'help', '--help', '-h'].includes(
        actionCommand.name()
      );

    if (!skipUpgradeCheck) {
      try {
        // Use the cached upgrade integration instead of loading the full checker
        const UpgradeIntegration = require(
          path.join(__dirname, 'utils', 'upgrade-integration')
        );
        const integration = new UpgradeIntegration();
        await integration.performBackgroundCheck();
      } catch (error) {
        // Silently ignore upgrade check failures to not block commands
        if (process.env.SC_DEBUG) {
          console.warn(
            chalk.yellow(`Warning: Auto-upgrade check failed: ${error.message}`)
          );
        }
      }
    }

    // Rule reporting interception - TEMPORARILY DISABLED
    // TODO: Fix bypass flag handling and re-enable
    // Temporarily disabled: if (false) {
    /*
      try {
        const interceptor = new CommandInterceptor({
          projectRoot: process.cwd(),
          bypassFlag: actionCommand.opts().Y || actionCommand.opts()['yes-to-rules'] || false,
          commandName: actionCommand.name()
        });

        const result = await interceptor.interceptCommand(actionCommand.name(), actionCommand.args);
        
        if (!result.shouldProceed) {
          console.log(chalk.red('❌ Command execution cancelled by rule interception'));
          process.exit(1);
        }
      } catch (error) {
        // Don't block commands if rule interception fails
        if (process.env.SC_DEBUG) {
          console.warn(chalk.yellow(`Warning: Rule interception failed: ${error.message}`));
        }
      }
    */
    // }
  });

  // Error handling
  program.exitOverride();

  return program;
}

module.exports = { buildProgram };
