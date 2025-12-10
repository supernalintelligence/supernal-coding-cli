import chalk from 'chalk';
import readline from 'node:readline';
const ConsentManager = require('../rules/consent-manager');

type ConsentMode = 'ask_every_time' | 'always_allow' | 'never_allow' | 'sometimes_allow';

interface PrivacyOptions {
  rulesReporting?: ConsentMode;
  status?: boolean;
  reset?: boolean;
}

interface ConsentStatus {
  mode: ConsentMode;
  gdpr_consent: boolean;
  privacy_notice_shown: boolean;
  last_updated: string;
}

async function handleRulesReportingConfig(
  consentManager: InstanceType<typeof ConsentManager>,
  mode: ConsentMode
): Promise<void> {
  const validModes: ConsentMode[] = [
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

  const explanations: Record<ConsentMode, string> = {
    ask_every_time: 'You will be prompted each time rule changes are detected',
    always_allow:
      'All rule changes will be automatically submitted for community review',
    never_allow: 'Rule changes will never be submitted',
    sometimes_allow:
      'You will be prompted occasionally (about 25% of the time)',
  };

  console.log(chalk.blue(`ℹ️  ${explanations[mode]}`));
}

async function showPrivacyStatus(
  consentManager: InstanceType<typeof ConsentManager>
): Promise<void> {
  const status: ConsentStatus = await consentManager.getConsentStatus();

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

  const explanations: Record<ConsentMode, string> = {
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

async function resetPrivacySettings(
  consentManager: InstanceType<typeof ConsentManager>
): Promise<void> {
  console.log(
    chalk.yellow('⚠️  This will reset all privacy preferences to defaults.')
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('Are you sure you want to continue? (y/N): ', (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase());
    });
  });

  if (answer === 'y' || answer === 'yes') {
    await consentManager.resetConsent();
    console.log(chalk.green('✅ Privacy settings have been reset to defaults'));
  } else {
    console.log(chalk.blue('ℹ️  Privacy settings unchanged'));
  }
}

async function showPrivacyHelp(): Promise<void> {
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

async function privacyCommand(options: PrivacyOptions = {}): Promise<void> {
  const consentManager = new ConsentManager({
    projectRoot: process.cwd(),
    interactive: true,
  });

  try {
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
      chalk.red(`❌ Privacy configuration error: ${(error as Error).message}`)
    );
    process.exit(1);
  }
}

export default privacyCommand;
module.exports = privacyCommand;
