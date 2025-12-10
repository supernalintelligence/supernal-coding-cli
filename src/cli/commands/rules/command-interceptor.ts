import chalk from 'chalk';
const RuleChangeDetector = require('./rule-change-detector');
const ConsentManager = require('./consent-manager');
const RuleSubmissionClient = require('./rule-submission-client');

interface InterceptorOptions {
  projectRoot?: string;
  bypassFlag?: boolean;
  commandName?: string;
  testMode?: boolean;
  interactive?: boolean;
}

interface InterceptionResult {
  shouldProceed: boolean;
  reason: string;
  consentResult?: {
    allowed: boolean;
  };
  changes?: RuleChange[];
}

interface RuleChange {
  type: string;
  path: string;
  [key: string]: unknown;
}

interface ChangeResult {
  hasChanges: boolean;
  changes: RuleChange[];
}

interface CommandWithOptions {
  name(): string;
  args: string[];
  opts(): { Y?: boolean; 'yes-to-rules'?: boolean };
  _ruleInterceptionResult?: InterceptionResult;
}

class CommandInterceptor {
  protected projectRoot: string;
  protected bypassFlag: boolean;
  protected commandName: string;
  protected testMode: boolean;
  protected interactive: boolean;

  constructor(options: InterceptorOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.bypassFlag = options.bypassFlag || false;
    this.commandName = options.commandName || 'unknown';
    this.testMode = options.testMode || false;
    this.interactive = options.interactive !== false;
  }

  shouldIntercept(commandName: string, args: string[] = []): boolean {
    if (
      !this.testMode &&
      (process.env.NODE_ENV === 'test' ||
        process.env.CI === 'true' ||
        process.env.JEST_WORKER_ID !== undefined ||
        process.env.npm_lifecycle_event === 'test')
    ) {
      return false;
    }

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

    if (args.includes('-Y') || args.includes('--yes-to-rules')) {
      return false;
    }

    if (skipCommands.some((cmd) => commandName.includes(cmd))) {
      return false;
    }

    return true;
  }

  async interceptCommand(commandName: string, args: string[] = []): Promise<InterceptionResult> {
    try {
      if (!this.shouldIntercept(commandName, args)) {
        return {
          shouldProceed: true,
          reason: 'Command excluded from interception'
        };
      }

      const detector = new RuleChangeDetector({
        projectRoot: this.projectRoot
      });

      const consentManager = new ConsentManager({
        projectRoot: this.projectRoot,
        bypassFlag: this.bypassFlag,
        interactive: this.interactive
      });

      const changeResult: ChangeResult = await detector.checkForChanges();

      if (!changeResult.hasChanges) {
        return { shouldProceed: true, reason: 'No rule changes detected' };
      }

      console.log(detector.formatChangesForDisplay(changeResult.changes));

      const consentResult = await consentManager.getConsentForRuleSharing(
        changeResult.changes
      );

      if (consentResult.allowed) {
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
        chalk.yellow(`Warning: Rule change detection failed: ${(error as Error).message}`)
      );
      return {
        shouldProceed: true,
        reason: 'Error in rule detection - proceeding with command'
      };
    }
  }

  async submitRulesInBackground(changes: RuleChange[], consentResult: { allowed: boolean }): Promise<void> {
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

        if (process.env.SC_DEBUG) {
          console.log(
            chalk.dim('✅ Rules submitted successfully in background')
          );
        }
      } catch (error) {
        if (process.env.SC_DEBUG) {
          console.log(
            chalk.dim(`❌ Background rule submission failed: ${(error as Error).message}`)
          );
        }
      }
    });
  }

  static createMiddleware(options: InterceptorOptions = {}): (command: CommandWithOptions) => Promise<boolean> {
    return async (command: CommandWithOptions) => {
      const interceptor = new CommandInterceptor({
        ...options,
        commandName: command.name(),
        bypassFlag: command.opts().Y || command.opts()['yes-to-rules'] || false
      });

      const result = await interceptor.interceptCommand(
        command.name(),
        command.args
      );

      command._ruleInterceptionResult = result;

      return result.shouldProceed;
    };
  }

  static addBypassFlag(program: { option: (flag: string, description: string) => unknown }): typeof program {
    program.option(
      '-Y, --yes-to-rules',
      'Skip rule sharing prompts (bypass consent)'
    );

    return program;
  }

  static wrapCommandAction<T extends (...args: unknown[]) => Promise<unknown>>(
    originalAction: T,
    options: InterceptorOptions = {}
  ): (...args: unknown[]) => Promise<unknown> {
    return async function (this: unknown, ...args: unknown[]) {
      const command = args[args.length - 1] as CommandWithOptions;

      const interceptor = new CommandInterceptor({
        ...options,
        commandName: command.name(),
        bypassFlag: command.opts().Y || command.opts()['yes-to-rules'] || false
      });

      const result = await interceptor.interceptCommand(
        command.name(),
        command.args
      );

      if (result.shouldProceed) {
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

export default CommandInterceptor;
module.exports = CommandInterceptor;
