#!/usr/bin/env node

const chalk = require('chalk');
const ConsentManager = require('../rules/consent-manager');

/**
 * Privacy Configuration Command
 * REQ-065: Active Rules Reporting System with Automatic PR Submission
 *
 * Allows users to manage their privacy preferences for rule sharing
 * and other data collection features.
 */

async function privacyCommand(options = {}) {
  const consentManager = new ConsentManager({
    projectRoot: process.cwd(),
    interactive: true,
  });

  try {
    // Handle different privacy actions
    if (options.rulesReporting) {
      await handleRulesReportingConfig(consentManager, options.rulesReporting);
    } else if (options.status) {
      await showPrivacyStatus(consentManager);
    } else if (options.reset) {
      await resetPrivacySettings(consentManager);
    } else {
      await showPrivacyHelp();
    }
  } catch (error) {
    console.error(
      chalk.red(`❌ Privacy configuration error: ${error.message}`)
    );
    process.exit(1);
  }
}

/**
 * Handle rules reporting configuration
 */
async function handleRulesReportingConfig(consentManager, mode) {
  const validModes = [
    'ask_every_time',
    'always_allow',
    'never_allow',
    'sometimes_allow',
  ];

  if (!validModes.includes(mode)) {
    console.error(chalk.red(`❌ Invalid consent mode: ${mode}`));
    console.log(chalk.white(`Valid modes: ${validModes.join(', ')}`));
    process.exit(1);
  }

  await consentManager.updateConsentMode(mode);

  console.log(
    chalk.green(`✅ Rules reporting preference updated to: ${chalk.bold(mode)}`)
  );

  // Show explanation of the chosen mode
  const explanations = {
    ask_every_time: 'You will be prompted each time rule changes are detected',
    always_allow:
      'All rule changes will be automatically submitted for community review',
    never_allow: 'Rule changes will never be submitted',
    sometimes_allow:
      'You will be prompted occasionally (about 25% of the time)',
  };

  console.log(chalk.blue(`ℹ️  ${explanations[mode]}`));
}

/**
 * Show current privacy status
 */
async function showPrivacyStatus(consentManager) {
  const status = await consentManager.getConsentStatus();

  console.log(chalk.blue.bold('\n🔒 Privacy Settings Status'));
  console.log(chalk.blue('==========================='));

  console.log(chalk.white('\n📊 Rules Reporting:'));
  console.log(`   Mode: ${chalk.bold(status.mode)}`);
  console.log(
    `   GDPR Consent: ${status.gdpr_consent ? chalk.green('✅ Given') : chalk.red('❌ Not given')}`
  );
  console.log(
    `   Privacy Notice Shown: ${status.privacy_notice_shown ? chalk.green('✅ Yes') : chalk.yellow('⚠️  No')}`
  );
  console.log(`   Last Updated: ${chalk.dim(status.last_updated)}`);

  // Show mode explanation
  const explanations = {
    ask_every_time: 'Prompts for consent on each rule change',
    always_allow: 'Automatically submits all rule changes',
    never_allow: 'Never submits rule changes',
    sometimes_allow: 'Prompts occasionally for consent',
  };

  console.log(
    `   Behavior: ${chalk.blue(explanations[status.mode] || 'Unknown')}`
  );

  console.log(chalk.white('\n🛠️  Configuration Commands:'));
  console.log('   sc config privacy --rules-reporting=<mode>');
  console.log('   sc config privacy --status');
  console.log('   sc config privacy --reset');
}

/**
 * Reset privacy settings
 */
async function resetPrivacySettings(consentManager) {
  console.log(
    chalk.yellow('⚠️  This will reset all privacy preferences to defaults.')
  );

  const readline = require('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question('Are you sure you want to continue? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });

  if (answer === 'y' || answer === 'yes') {
    await consentManager.resetConsent();
    console.log(chalk.green('✅ Privacy settings have been reset to defaults'));
  } else {
    console.log(chalk.blue('ℹ️  Privacy settings unchanged'));
  }
}

/**
 * Show privacy help
 */
async function showPrivacyHelp() {
  console.log(chalk.blue.bold('\n🔒 Privacy Configuration'));
  console.log(chalk.blue('========================'));

  console.log(
    chalk.white(
      '\nManage your privacy preferences for Supernal Coding features.'
    )
  );

  console.log(chalk.bold('\nUsage:'));
  console.log('  sc config privacy [options]');

  console.log(chalk.bold('\nOptions:'));
  console.log('  --rules-reporting <mode>    Set rules reporting consent mode');
  console.log('  --status                    Show current privacy settings');
  console.log('  --reset                     Reset all privacy settings');

  console.log(chalk.bold('\nRules Reporting Modes:'));
  console.log(
    '  ask_every_time     Prompt for consent on each rule change (default)'
  );
  console.log('  always_allow       Automatically submit all rule changes');
  console.log('  never_allow        Never submit rule changes');
  console.log('  sometimes_allow    Prompt occasionally for consent');

  console.log(chalk.bold('\nExamples:'));
  console.log('  sc config privacy --status');
  console.log('  sc config privacy --rules-reporting=never_allow');
  console.log('  sc config privacy --rules-reporting=always_allow');
  console.log('  sc config privacy --reset');

  console.log(chalk.bold('\nPrivacy Information:'));
  console.log(
    '• Rules reporting helps improve the community by sharing anonymized rule patterns'
  );
  console.log('• All data is processed according to GDPR guidelines');
  console.log('• You maintain full control over what gets shared');
  console.log('• Personal information and sensitive data are never collected');

  console.log(
    chalk.dim(
      '\nFor more information, see: https://docs.supernal-coding.dev/privacy'
    )
  );
}

module.exports = privacyCommand;
