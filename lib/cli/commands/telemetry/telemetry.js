/**
 * SC Telemetry Command - CLI interface for telemetry management
 * Privacy-first learning and improvement system
 */

const chalk = require('chalk');
const { getTelemetryService } = require('../../../telemetry');

async function telemetryCommand(action, options) {
  const telemetry = getTelemetryService();

  switch (action.toLowerCase()) {
    case 'status':
      await showStatus(telemetry, options);
      break;
    case 'enable':
      await enableTelemetry(telemetry, options);
      break;
    case 'disable':
      await disableTelemetry(telemetry, options);
      break;
    case 'insights':
      await showInsights(telemetry, options);
      break;
    case 'config':
      await configureTelemetry(telemetry, options);
      break;
    case 'preview':
      await previewData(telemetry, options);
      break;
    case 'sync':
      await syncData(telemetry, options);
      break;
    case 'clear':
      await clearCache(telemetry, options);
      break;
    case 'export':
      await exportData(telemetry, options);
      break;
    default:
      console.error(chalk.red(`❌ Unknown action: ${action}`));
      showHelp();
      process.exit(1);
  }
}

async function showStatus(telemetry, _options) {
  await telemetry.init();
  const enabled = await telemetry.isEnabled();

  console.log(chalk.blue('📊 Telemetry Status'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  if (enabled) {
    console.log(chalk.green('Status: ✅ Enabled'));
    console.log('');
    console.log(chalk.cyan('Collection settings:'));
    console.log(
      `  Commands:     ${telemetry._config.collection.commands ? '✓' : '✗'}`
    );
    console.log(
      `  Rules:        ${telemetry._config.collection.rules ? '✓' : '✗'}`
    );
    console.log(
      `  Validation:   ${telemetry._config.collection.validation ? '✓' : '✗'}`
    );
    console.log(
      `  Performance:  ${telemetry._config.collection.performance ? '✓' : '✗'}`
    );
    console.log('');
    console.log(chalk.gray('Thank you for helping improve SC!'));
    console.log(
      chalk.gray('Your privacy is protected - all data is anonymized.')
    );
  } else {
    console.log(chalk.yellow('Status: ⚪ Disabled'));
    console.log('');
    console.log(
      chalk.gray(
        'Telemetry helps improve SC by collecting anonymized usage patterns.'
      )
    );
    console.log(
      chalk.gray(
        'Your privacy is our priority - all data is sanitized before leaving your machine.'
      )
    );
    console.log('');
    console.log(chalk.cyan('Enable with:'), 'sc telemetry enable');
  }
}

async function enableTelemetry(telemetry, options) {
  console.log(chalk.blue('🔐 Enable Telemetry'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  // Show consent information
  console.log(chalk.yellow('What we collect:'));
  console.log(
    chalk.gray('  ✓ Command usage patterns (which commands you run)')
  );
  console.log(chalk.gray('  ✓ Rule effectiveness (which rules help you)'));
  console.log(chalk.gray('  ✓ Validation results (anonymized issue types)'));
  console.log(
    chalk.gray('  ✓ Performance metrics (command duration, system info)')
  );
  console.log('');
  console.log(chalk.yellow("What we DON'T collect:"));
  console.log(chalk.gray('  ✗ File contents or code'));
  console.log(chalk.gray('  ✗ File paths or project names'));
  console.log(chalk.gray('  ✗ Personal information'));
  console.log(chalk.gray('  ✗ API keys or secrets'));
  console.log('');

  // TODO: Add interactive consent prompt
  // For now, require explicit --yes flag
  if (!options.yes) {
    console.log(chalk.yellow('⚠️  Interactive consent prompt coming soon.'));
    console.log(chalk.gray('For now, use: sc telemetry enable --yes'));
    return;
  }

  await telemetry.enable();
  console.log(chalk.green('✅ Telemetry enabled successfully'));
  console.log('');
  console.log(chalk.gray('You can disable anytime with: sc telemetry disable'));
}

async function disableTelemetry(telemetry, _options) {
  await telemetry.disable();
  console.log(chalk.green('✅ Telemetry disabled'));
  console.log(chalk.gray('Local cached data has been preserved.'));
  console.log(chalk.gray('To delete it, run: sc telemetry clear'));
}

async function showInsights(telemetry, _options) {
  console.log(chalk.blue('📈 Your SC Usage Insights'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  const insights = await telemetry.getInsights();

  if (insights.totalEvents === 0) {
    console.log(chalk.gray('No data collected yet.'));
    console.log(chalk.gray('Continue using SC to generate insights.'));
    return;
  }

  console.log(chalk.cyan(`Total events: ${insights.totalEvents}`));
  console.log(
    chalk.cyan(
      `Date range: ${new Date(insights.dateRange.start).toLocaleDateString()} - ${new Date(insights.dateRange.end).toLocaleDateString()}`
    )
  );
  console.log('');

  if (insights.mostUsedCommands && insights.mostUsedCommands.length > 0) {
    console.log(chalk.yellow('Most Used Commands:'));
    insights.mostUsedCommands.slice(0, 5).forEach(([cmd, count], index) => {
      console.log(`  ${index + 1}. ${chalk.cyan(cmd)} (${count} times)`);
    });
    console.log('');
  }

  if (insights.commonIssues && insights.commonIssues.length > 0) {
    console.log(chalk.yellow('Common Issues:'));
    insights.commonIssues.forEach(([issue, count], index) => {
      console.log(
        `  ${index + 1}. ${chalk.cyan(issue)} (${count} occurrences)`
      );
    });
    console.log('');
  }

  console.log(
    chalk.gray(`Average command duration: ${insights.averageCommandDuration}ms`)
  );
  console.log('');
  console.log(
    chalk.gray(
      '💡 These insights are generated locally from your usage patterns.'
    )
  );
}

async function configureTelemetry(telemetry, options) {
  await telemetry.init();

  console.log(chalk.blue('⚙️  Configure Telemetry'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  let changed = false;

  if (options.commands !== undefined) {
    telemetry._config.collection.commands = options.commands === 'true';
    changed = true;
  }
  if (options.rules !== undefined) {
    telemetry._config.collection.rules = options.rules === 'true';
    changed = true;
  }
  if (options.validation !== undefined) {
    telemetry._config.collection.validation = options.validation === 'true';
    changed = true;
  }
  if (options.performance !== undefined) {
    telemetry._config.collection.performance = options.performance === 'true';
    changed = true;
  }

  if (changed) {
    await telemetry.saveConfig();
    console.log(chalk.green('✅ Configuration updated'));
  } else {
    console.log(chalk.yellow('Current configuration:'));
    console.log(`  Commands:     ${telemetry._config.collection.commands}`);
    console.log(`  Rules:        ${telemetry._config.collection.rules}`);
    console.log(`  Validation:   ${telemetry._config.collection.validation}`);
    console.log(`  Performance:  ${telemetry._config.collection.performance}`);
    console.log('');
    console.log(chalk.gray('To change, use flags like:'));
    console.log(chalk.gray('  sc telemetry config --commands=false'));
  }
}

async function previewData(telemetry, _options) {
  console.log(chalk.blue('👁️  Preview Telemetry Data'));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  const events = await telemetry.getPendingEvents();

  if (events.length === 0) {
    console.log(chalk.gray('No pending telemetry data.'));
    return;
  }

  console.log(chalk.cyan(`${events.length} events ready to sync`));
  console.log('');

  // Show sample events
  console.log(chalk.yellow('Sample events:'));
  events.slice(0, 5).forEach((event, index) => {
    console.log(
      `  ${index + 1}. ${event.type} at ${new Date(event.timestamp).toLocaleString()}`
    );
    console.log(
      chalk.gray(`     ${JSON.stringify(event.data).substring(0, 80)}...`)
    );
  });

  if (events.length > 5) {
    console.log(chalk.gray(`  ... and ${events.length - 5} more`));
  }
}

async function syncData(_telemetry, _options) {
  console.log(chalk.yellow('⚠️  Cloud sync not yet implemented'));
  console.log(
    chalk.gray('This feature will be available in a future release.')
  );
  console.log(chalk.gray('For now, insights are generated locally only.'));
}

async function clearCache(telemetry, _options) {
  await telemetry.clearCache();
  console.log(chalk.green('✅ Telemetry cache cleared'));
}

async function exportData(telemetry, options) {
  const fs = require('fs-extra');
  const _path = require('node:path');

  const events = await telemetry.getPendingEvents();
  const outputFile = options.output || 'telemetry-export.json';

  await fs.writeJson(
    outputFile,
    {
      exportDate: new Date().toISOString(),
      totalEvents: events.length,
      events: events
    },
    { spaces: 2 }
  );

  console.log(chalk.green(`✅ Telemetry data exported to: ${outputFile}`));
  console.log(chalk.gray(`Total events: ${events.length}`));
}

function showHelp() {
  console.log(chalk.blue.bold('📊 SC Telemetry Command'));
  console.log(chalk.blue('='.repeat(35)));
  console.log('');
  console.log(chalk.gray('Manage privacy-first telemetry and usage insights.'));
  console.log('');
  console.log(chalk.yellow('Available Actions:'));
  console.log('');

  const actions = [
    ['status', 'Show telemetry status (default)'],
    ['enable', 'Enable telemetry with consent'],
    ['disable', 'Disable telemetry'],
    ['insights', 'View local usage insights'],
    ['config', 'Configure collection settings'],
    ['preview', 'Preview pending telemetry data'],
    ['sync', 'Sync data to cloud (when available)'],
    ['clear', 'Clear local telemetry cache'],
    ['export', 'Export telemetry data to file']
  ];

  actions.forEach(([action, description]) => {
    console.log(`  ${chalk.cyan(action.padEnd(12))} ${description}`);
  });

  console.log(`\n${chalk.yellow('Examples:')}`);
  console.log(
    `  ${chalk.cyan('sc telemetry')}                    # Check status`
  );
  console.log(
    `  ${chalk.cyan('sc telemetry enable')}             # Enable telemetry`
  );
  console.log(
    `  ${chalk.cyan('sc telemetry insights')}           # View your insights`
  );
  console.log(
    `  ${chalk.cyan('sc telemetry config --rules=false')} # Disable rule tracking`
  );
  console.log(
    `  ${chalk.cyan('sc telemetry export')}             # Export data`
  );
}

module.exports = telemetryCommand;
