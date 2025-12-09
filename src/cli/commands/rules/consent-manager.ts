#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const readline = require('node:readline');

/**
 * Consent Management System
 * REQ-065: Active Rules Reporting System with Automatic PR Submission
 *
 * Manages user consent for rule sharing with interactive prompts,
 * persistent preferences, and privacy-compliant data handling.
 */

class ConsentManager {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.bypassFlag = options.bypassFlag || false;
    this.interactive = options.interactive !== false;
    this.forceInteractive = options.forceInteractive || false; // Override test environment detection
    this.consentFile = path.join(
      this.projectRoot,
      '.supernal-coding',
      'consent.json'
    );
    this.consent = {};
    this.config = null;
    this.loadProjectConfig();
  }

  /**
   * Load project configuration for rules settings
   */
  loadProjectConfig() {
    try {
      const { getConfig } = require('../../../scripts/config-loader');
      const configLoader = getConfig(this.projectRoot);
      configLoader.load();
      this.config = configLoader.getAll(); // Get the actual config data
    } catch (_error) {
      // Use defaults if config can't be loaded
      this.config = {
        rules: {
          default_consent_mode: 'ask_every_time',
          skip_prompts_non_interactive: true
        }
      };
    }
  }

  /**
   * Load existing consent preferences
   */
  async loadConsent() {
    try {
      if (await fs.pathExists(this.consentFile)) {
        this.consent = await fs.readJson(this.consentFile);
      } else {
        // Default consent state - use config default if available
        const configDefaultMode =
          this.config?.rules?.reporting?.consent_mode ||
          this.config?.rules?.default_consent_mode ||
          'ask_every_time';
        this.consent = {
          rules_reporting: {
            mode: configDefaultMode,
            last_updated: new Date().toISOString(),
            privacy_notice_shown: false,
            gdpr_consent: configDefaultMode === 'always_allow'
          }
        };
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `Warning: Could not load consent preferences: ${error.message}`
        )
      );
      // Fallback consent state - use config default if available
      const configDefaultMode =
        this.config?.rules?.reporting?.consent_mode ||
        this.config?.rules?.default_consent_mode ||
        'ask_every_time';
      this.consent = {
        rules_reporting: {
          mode: configDefaultMode,
          last_updated: new Date().toISOString(),
          privacy_notice_shown: false,
          gdpr_consent: configDefaultMode === 'always_allow'
        }
      };
    }
  }

  /**
   * Save consent preferences
   */
  async saveConsent() {
    try {
      await fs.ensureDir(path.dirname(this.consentFile));
      await fs.writeJson(this.consentFile, this.consent, { spaces: 2 });
    } catch (error) {
      console.warn(
        chalk.yellow(
          `Warning: Could not save consent preferences: ${error.message}`
        )
      );
    }
  }

  /**
   * Show privacy notice
   */
  showPrivacyNotice() {
    console.log(chalk.blue.bold('\n🔒 Privacy Notice - Rule Sharing'));
    console.log(chalk.blue('====================================='));
    console.log(
      chalk.white(`
Supernal Coding can help improve the community by sharing your custom rules.

${chalk.bold('What we collect:')}
• Rule files (.mdc files and workflow rules)
• Basic metadata (file size, modification date)
• Project type information (anonymized)

${chalk.bold("What we DON'T collect:")}
• Personal information or credentials
• Sensitive project data
• File contents outside of rules
• Any data that could identify you personally

${chalk.bold('How it works:')}
• Rules are sanitized to remove sensitive information
• Submissions create pull requests for community review
• You maintain full control over what gets shared
• All data is processed according to GDPR guidelines

${chalk.bold('Your choices:')}
• ask_every_time: Prompt for each rule change (default)
• always_allow: Auto-submit all rule changes
• never_allow: Never submit rule changes
• sometimes_allow: Prompt occasionally

You can change your preference anytime with: ${chalk.cyan('sc config privacy --rules-reporting=<mode>')}

${chalk.bold('For automation/CI/CD:')}
Use ${chalk.cyan('echo "y" | sc <command>')} to auto-answer prompts, or set consent_mode to "always_allow" in your config.
`)
    );
  }

  /**
   * Create readline interface for user input
   */
  createReadlineInterface() {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Ask user a question and return their response
   */
  async askQuestion(question, defaultAnswer = null) {
    return new Promise((resolve) => {
      const rl = this.createReadlineInterface();
      const prompt = defaultAnswer
        ? `${question} (${defaultAnswer}): `
        : `${question}: `;

      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim() || defaultAnswer);
      });
    });
  }

  /**
   * Show consent choices menu
   */
  showConsentChoices() {
    console.log(chalk.yellow('\n📋 Consent Options:'));
    console.log(
      chalk.white(
        '  1. ask_every_time  - Prompt for each rule change (recommended)'
      )
    );
    console.log(
      chalk.white('  2. always_allow    - Auto-submit all rule changes')
    );
    console.log(
      chalk.white('  3. never_allow     - Never submit rule changes')
    );
    console.log(chalk.white('  4. sometimes_allow - Prompt occasionally'));
    console.log(chalk.white('  5. just_this_once  - Allow this time only'));
    console.log(chalk.white('  6. not_now         - Skip this time'));
  }

  /**
   * Get user consent for rule sharing
   */
  async getConsentForRuleSharing(changes) {
    // DEBUG: Log bypass flag status
    if (process.env.SC_DEBUG) {
      console.log(`DEBUG: bypassFlag = ${this.bypassFlag}`);
    }

    // FIRST: Check bypass flag - this takes absolute priority
    if (this.bypassFlag) {
      return {
        allowed: true,
        mode: 'bypass',
        reason: 'Bypass flag (-Y) was used'
      };
    }

    // SECOND: Check for non-interactive environments
    const isTestEnvironment =
      process.env.NODE_ENV === 'test' ||
      process.env.CI === 'true' ||
      process.env.JEST_WORKER_ID !== undefined ||
      process.env.npm_lifecycle_event === 'test';

    const isAIAgent =
      process.env.SC_AI_AGENT === 'true' ||
      process.env.CURSOR_AI === 'true' ||
      !process.stdin.isTTY ||
      process.env.TERM_PROGRAM === 'cursor';

    // Check configuration for non-interactive behavior
    const skipNonInteractive =
      this.config?.rules?.skip_prompts_non_interactive !== false;
    const defaultMode =
      this.config?.rules?.reporting?.consent_mode ||
      this.config?.rules?.default_consent_mode ||
      'ask_every_time';

    // Load consent preferences first (needed for both interactive and non-interactive)
    await this.loadConsent();

    // For AI agents/tests, use saved preferences if available, otherwise use default
    if (
      (isTestEnvironment || isAIAgent) &&
      !this.forceInteractive &&
      skipNonInteractive
    ) {
      const savedMode = this.consent.rules_reporting?.mode;
      const effectiveMode = savedMode || defaultMode;
      const allowed = effectiveMode === 'always_allow';

      return {
        allowed: allowed,
        mode: effectiveMode,
        reason: savedMode
          ? `Non-interactive environment - using saved preference: ${effectiveMode}`
          : `Non-interactive environment - using default: ${effectiveMode}`
      };
    }

    const rulesReporting = this.consent.rules_reporting;

    // Show privacy notice if not shown before, unless config already allows
    if (!rulesReporting.privacy_notice_shown) {
      // If config is set to always_allow, skip the privacy notice and auto-consent
      if (rulesReporting.mode === 'always_allow') {
        rulesReporting.gdpr_consent = true;
        rulesReporting.privacy_notice_shown = true;
        await this.saveConsent();
      } else if (this.interactive) {
        this.showPrivacyNotice();

        const gdprConsent = await this.askQuestion(
          chalk.bold(
            'Do you consent to rule sharing under these privacy terms? (y/N)'
          ),
          'N'
        );

        rulesReporting.gdpr_consent = gdprConsent.toLowerCase().startsWith('y');
        rulesReporting.privacy_notice_shown = true;

        if (!rulesReporting.gdpr_consent) {
          rulesReporting.mode = 'never_allow';
          await this.saveConsent();
          return {
            allowed: false,
            mode: 'never_allow',
            reason: 'User declined GDPR consent'
          };
        }
      } else {
        // In non-interactive mode (tests), assume consent for testing purposes
        rulesReporting.gdpr_consent = true;
        rulesReporting.privacy_notice_shown = true;
      }

      await this.saveConsent();
    }

    // Handle different consent modes
    switch (rulesReporting.mode) {
      case 'always_allow':
        return {
          allowed: true,
          mode: 'always_allow',
          reason: 'User preference set to always allow'
        };

      case 'never_allow':
        return {
          allowed: false,
          mode: 'never_allow',
          reason: 'User preference set to never allow'
        };

      case 'sometimes_allow':
        // Prompt occasionally (e.g., 25% of the time)
        if (Math.random() < 0.25) {
          return await this.promptForConsent(changes);
        } else {
          return {
            allowed: false,
            mode: 'sometimes_allow',
            reason: 'Sometimes allow - skipping this time'
          };
        }
      default:
        return await this.promptForConsent(changes);
    }
  }

  /**
   * Prompt user for consent with interactive menu
   */
  async promptForConsent(changes) {
    if (!this.interactive) {
      return {
        allowed: false,
        mode: 'non_interactive',
        reason: 'Non-interactive mode - defaulting to no consent'
      };
    }

    console.log(chalk.blue.bold('\n🤖 Rule Sharing Request'));
    console.log(chalk.blue('========================'));

    // Show what changed
    console.log(chalk.white('The following rule changes were detected:'));
    changes.forEach((change) => {
      const icon =
        change.type === 'added'
          ? '✨'
          : change.type === 'modified'
            ? '📝'
            : '🗑️';
      const color =
        change.type === 'added'
          ? chalk.green
          : change.type === 'modified'
            ? chalk.yellow
            : chalk.red;
      console.log(
        color(
          `  ${icon} ${change.path} (${change.file?.type || 'unknown'} rule)`
        )
      );
    });

    console.log(
      chalk.white(
        '\nSharing these rules can help improve the Supernal Coding community.'
      )
    );
    this.showConsentChoices();

    const choice = await this.askQuestion(
      chalk.bold('\nWhat would you like to do? (1-6)'),
      '1'
    );

    const choiceMap = {
      1: 'ask_every_time',
      2: 'always_allow',
      3: 'never_allow',
      4: 'sometimes_allow',
      5: 'just_this_once',
      6: 'not_now'
    };

    const selectedMode = choiceMap[choice] || 'ask_every_time';
    const allowed = ['always_allow', 'just_this_once'].includes(selectedMode);

    // Update persistent preferences for non-temporary choices
    if (!['just_this_once', 'not_now'].includes(selectedMode)) {
      this.consent.rules_reporting.mode = selectedMode;
      this.consent.rules_reporting.last_updated = new Date().toISOString();
      await this.saveConsent();
    }

    return {
      allowed: allowed,
      mode: selectedMode,
      reason: `User selected: ${selectedMode}`
    };
  }

  /**
   * Update consent preferences
   */
  async updateConsentMode(newMode) {
    const validModes = [
      'ask_every_time',
      'always_allow',
      'never_allow',
      'sometimes_allow'
    ];

    if (!validModes.includes(newMode)) {
      throw new Error(
        `Invalid consent mode: ${newMode}. Valid modes: ${validModes.join(', ')}`
      );
    }

    await this.loadConsent();
    this.consent.rules_reporting.mode = newMode;
    this.consent.rules_reporting.last_updated = new Date().toISOString();
    await this.saveConsent();

    console.log(chalk.green(`✅ Consent preference updated to: ${newMode}`));
  }

  /**
   * Get current consent status
   */
  async getConsentStatus() {
    await this.loadConsent();
    return this.consent.rules_reporting;
  }

  /**
   * Reset all consent preferences
   */
  async resetConsent() {
    this.consent = {
      rules_reporting: {
        mode: 'ask_every_time',
        last_updated: new Date().toISOString(),
        privacy_notice_shown: false,
        gdpr_consent: false
      }
    };
    await this.saveConsent();
    console.log(chalk.green('✅ Consent preferences have been reset'));
  }
}

module.exports = ConsentManager;
