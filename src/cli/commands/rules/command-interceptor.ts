#!/usr/bin/env node

const chalk = require('chalk');
const RuleChangeDetector = require('./rule-change-detector');
const ConsentManager = require('./consent-manager');
const RuleSubmissionClient = require('./rule-submission-client');

/**
 * Command Interceptor for Rules Reporting
 * REQ-065: Active Rules Reporting System with Automatic PR Submission
 *
 * Intercepts sc commands to check for rule changes and request consent
 * when changes are detected. Supports bypass flags and different consent modes.
 */

class CommandInterceptor {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.bypassFlag = options.bypassFlag || false;
    this.commandName = options.commandName || 'unknown';
    this.testMode = options.testMode || false; // Allow testing interception logic
    this.interactive = options.interactive !== false;
  }

  /**
   * Check if command should be intercepted
   */
  shouldIntercept(commandName, args = []) {
    // Don't intercept in test environments unless explicitly testing the logic
    if (
      !this.testMode &&
      (process.env.NODE_ENV === 'test' ||
        process.env.CI === 'true' ||
        process.env.JEST_WORKER_ID !== undefined ||
        process.env.npm_lifecycle_event === 'test')
    ) {
      return false;
    }

    // Don't intercept certain commands to avoid recursion
    const skipCommands = [
      'config',
      'privacy',
      'help',
      '--help',
      '-h',
      'version',
      '--version',
      '-v'
    ];

    // Don't intercept if bypass flag is present
    if (args.includes('-Y') || args.includes('--yes-to-rules')) {
      return false;
    }

    // Don't intercept excluded commands
    if (skipCommands.some((cmd) => commandName.includes(cmd))) {
      return false;
    }

    return true;
  }

  /**
   * Main interception logic
   */
  async interceptCommand(commandName, args = []) {
    try {
      // Check if we should intercept this command
      if (!this.shouldIntercept(commandName, args)) {
        return {
          shouldProceed: true,
          reason: 'Command excluded from interception'
        };
      }

      // Initialize components
      const detector = new RuleChangeDetector({
        projectRoot: this.projectRoot
      });

      const consentManager = new ConsentManager({
        projectRoot: this.projectRoot,
        bypassFlag: this.bypassFlag,
        interactive: this.interactive
      });

      // Check for rule changes
      const changeResult = await detector.checkForChanges();

      if (!changeResult.hasChanges) {
        return { shouldProceed: true, reason: 'No rule changes detected' };
      }

      // Display changes to user
      console.log(detector.formatChangesForDisplay(changeResult.changes));

      // Get user consent
      const consentResult = await consentManager.getConsentForRuleSharing(
        changeResult.changes
      );

      if (consentResult.allowed) {
        // Submit rules in background (non-blocking)
        this.submitRulesInBackground(changeResult.changes, consentResult);

        console.log(
          chalk.green(
            '✅ Thank you! Rules will be submitted for community review.'
          )
        );
        console.log(chalk.blue('🔄 Continuing with your command...\n'));
      } else {
        console.log(
          chalk.blue(
            'ℹ️  Rules will not be shared. Continuing with your command...\n'
          )
        );
      }

      return {
        shouldProceed: true,
        reason: 'User consent processed',
        consentResult: consentResult,
        changes: changeResult.changes
      };
    } catch (error) {
      console.warn(
        chalk.yellow(`Warning: Rule change detection failed: ${error.message}`)
      );
      return {
        shouldProceed: true,
        reason: 'Error in rule detection - proceeding with command'
      };
    }
  }

  /**
   * Submit rules to backend in background (non-blocking)
   */
  async submitRulesInBackground(changes, consentResult) {
    // Don't await this - let it run in background
    setImmediate(async () => {
      try {
        const submissionClient = new RuleSubmissionClient({
          projectRoot: this.projectRoot
        });

        await submissionClient.submitRuleChanges(changes, {
          consent: consentResult,
          timestamp: new Date().toISOString(),
          command_context: this.commandName
        });

        // Log success quietly (don't interrupt user)
        if (process.env.SC_DEBUG) {
          console.log(
            chalk.dim('✅ Rules submitted successfully in background')
          );
        }
      } catch (error) {
        // Log error quietly (don't interrupt user)
        if (process.env.SC_DEBUG) {
          console.log(
            chalk.dim(`❌ Background rule submission failed: ${error.message}`)
          );
        }
      }
    });
  }

  /**
   * Create interceptor middleware for commander.js
   */
  static createMiddleware(options = {}) {
    return async (command) => {
      const interceptor = new CommandInterceptor({
        ...options,
        commandName: command.name(),
        bypassFlag: command.opts().Y || command.opts()['yes-to-rules'] || false
      });

      const result = await interceptor.interceptCommand(
        command.name(),
        command.args
      );

      // Store result in command for potential use by the actual command
      command._ruleInterceptionResult = result;

      return result.shouldProceed;
    };
  }

  /**
   * Add bypass flag to commander program
   */
  static addBypassFlag(program) {
    // Add global -Y flag to all commands
    program.option(
      '-Y, --yes-to-rules',
      'Skip rule sharing prompts (bypass consent)'
    );

    return program;
  }

  /**
   * Wrap command action to include interception
   */
  static wrapCommandAction(originalAction, options = {}) {
    return async function (...args) {
      // Extract command object (usually the last argument in commander.js)
      const command = args[args.length - 1];

      const interceptor = new CommandInterceptor({
        ...options,
        commandName: command.name(),
        bypassFlag: command.opts().Y || command.opts()['yes-to-rules'] || false
      });

      // Intercept before running original command
      const result = await interceptor.interceptCommand(
        command.name(),
        command.args
      );

      if (result.shouldProceed) {
        // Run original command
        return await originalAction.apply(this, args);
      } else {
        console.log(
          chalk.red('❌ Command execution cancelled by rule interception')
        );
        process.exit(1);
      }
    };
  }
}

module.exports = CommandInterceptor;
