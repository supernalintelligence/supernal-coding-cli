// @ts-nocheck
const chalk = require('chalk');
const path = require('node:path');
const fs = require('fs-extra');
const yaml = require('yaml');
const HookConfigLoader = require('./git-hooks/hook-config-loader');

/**
 * Config command handler
 * Provides configuration viewing, validation, and updates
 */
async function handleConfigCommand(action, options) {
  switch (action) {
    case 'show':
      await showConfig(options);
      break;
    case 'get':
      await getConfigValue(options);
      break;
    case 'set':
      await setConfigValue(options);
      break;
    case 'validate':
      await validateConfig(options);
      break;
    case 'hooks':
    case 'git-hooks':
      await showHooksConfig(options);
      break;
    case 'patterns':
    case 'list':
    case 'list-patterns':
      await listPatterns(options);
      break;
    case 'edit':
      await editConfig(options);
      break;
    default:
      showHelp();
      break;
  }
}

function showHelp() {
  console.log(chalk.blue.bold('\n📋 Configuration Management\n'));
  console.log(chalk.white('Manage supernal.yaml configuration'));

  console.log(chalk.cyan('\nCommands:'));
  console.log(
    chalk.white('  sc config show              Show full configuration')
  );
  console.log(
    chalk.white('  sc config get <key>         Get specific config value')
  );
  console.log(
    chalk.white('  sc config set <key> <value> Set specific config value')
  );
  console.log(
    chalk.white('  sc config validate          Validate configuration')
  );
  console.log(
    chalk.white('  sc config hooks             Show git hooks configuration')
  );
  console.log(
    chalk.white('  sc config patterns          List available patterns')
  );
  console.log(
    chalk.white('  sc config edit              Open config in editor')
  );

  console.log(chalk.cyan('\nExamples:'));
  console.log(chalk.gray('  sc config show'));
  console.log(chalk.gray('  sc config get git_hooks.enabled'));
  console.log(
    chalk.gray(
      '  sc config set git_hooks.pre_commit.checks.markdown_links.enabled true'
    )
  );
  console.log(chalk.gray('  sc config hooks'));

  console.log(chalk.cyan('\nOptions:'));
  console.log(chalk.white('  --json              Output as JSON'));
  console.log(chalk.white('  --verbose           Show detailed information'));
  console.log(chalk.white('  --section <name>    Show only specific section'));

  console.log();
}

async function showConfig(options) {
  try {
    const configPath = path.join(process.cwd(), 'supernal.yaml');
    if (!fs.existsSync(configPath)) {
      console.log(
        chalk.yellow('⚠️  No supernal.yaml found in current directory')
      );
      console.log(chalk.gray('\nRun: sc init to create configuration'));
      return;
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.parse(configContent);

    // Show specific section if requested
    if (options.section) {
      const section = getNestedValue(config, options.section);
      if (section === undefined) {
        console.log(chalk.red(`❌ Section not found: ${options.section}`));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(section, null, 2));
      } else {
        console.log(chalk.blue(`📋 Configuration: ${options.section}`));
        console.log(yaml.stringify(section));
      }
      return;
    }

    // Show full config
    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log(chalk.blue('📋 Current Configuration:\n'));
      console.log(yaml.stringify(config));
      console.log(chalk.gray(`\nPath: ${configPath}`));
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to load configuration:'), error.message);
    process.exitCode = 1;
  }
}

async function getConfigValue(options) {
  try {
    // Handle positional arguments from commander
    const args = options.parent?.args || [];
    const key = args[0] || options._?.[0] || options.key;

    if (!key) {
      console.log(chalk.red('❌ Key is required'));
      console.log(chalk.gray('\nUsage: sc config get <key>'));
      console.log(chalk.gray('Example: sc config get git_hooks.enabled'));
      return;
    }

    const configPath = path.join(process.cwd(), 'supernal.yaml');
    if (!fs.existsSync(configPath)) {
      console.log(chalk.yellow('⚠️  No supernal.yaml found'));
      return;
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.parse(configContent);

    const value = getNestedValue(config, key);

    if (value === undefined) {
      console.log(chalk.yellow(`⚠️  Key not found: ${key}`));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(chalk.blue(`${key}:`));
      if (typeof value === 'object') {
        console.log(yaml.stringify(value));
      } else {
        console.log(chalk.white(`  ${value}`));
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to get config value:'), error.message);
    process.exitCode = 1;
  }
}

async function setConfigValue(options) {
  try {
    const key = options._?.[0] || options.key;
    const value = options._?.[1] || options.value;

    if (!key || value === undefined) {
      console.log(chalk.red('❌ Key and value are required'));
      console.log(chalk.gray('\nUsage: sc config set <key> <value>'));
      console.log(chalk.gray('Example: sc config set git_hooks.enabled true'));
      return;
    }

    const configPath = path.join(process.cwd(), 'supernal.yaml');
    if (!fs.existsSync(configPath)) {
      console.log(chalk.yellow('⚠️  No supernal.yaml found'));
      console.log(chalk.gray('\nRun: sc init to create configuration'));
      return;
    }

    // Create backup
    const backupPath = `${configPath}.backup`;
    await fs.copy(configPath, backupPath);

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.parse(configContent);

    // Parse value (handle booleans, numbers, JSON)
    let parsedValue = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (value === 'null') parsedValue = null;
    else if (!Number.isNaN(value)) parsedValue = Number(value);
    else if (value.startsWith('{') || value.startsWith('[')) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    // Set nested value
    setNestedValue(config, key, parsedValue);

    // Write back
    await fs.writeFile(configPath, yaml.stringify(config), 'utf8');

    console.log(chalk.green(`✅ Updated ${key} = ${parsedValue}`));
    console.log(chalk.gray(`\nBackup saved: ${backupPath}`));
  } catch (error) {
    console.error(chalk.red('❌ Failed to set config value:'), error.message);
    process.exitCode = 1;
  }
}

async function showHooksConfig(options) {
  try {
    const loader = new HookConfigLoader();
    const report = loader.generateReport();
    console.log(report);
    console.log();

    if (options.verbose) {
      const config = loader.loadConfig();
      console.log(chalk.blue('Full git_hooks configuration:'));
      console.log(yaml.stringify(config.git_hooks));
    }

    console.log(chalk.cyan('Commands:'));
    console.log(chalk.white('  sc config set git_hooks.enabled false'));
    console.log(
      chalk.white(
        '  sc config set git_hooks.pre_commit.checks.markdown_links.enabled true'
      )
    );
    console.log();
  } catch (error) {
    console.error(chalk.red('❌ Failed to show hooks config:'), error.message);
  }
}

async function editConfig(_options) {
  const configPath = path.join(process.cwd(), 'supernal.yaml');
  if (!fs.existsSync(configPath)) {
    console.log(chalk.yellow('⚠️  No supernal.yaml found'));
    return;
  }

  const editor = process.env.EDITOR || 'vi';
  console.log(chalk.blue(`📝 Opening ${configPath} in ${editor}...`));

  const { execSync } = require('node:child_process');
  try {
    execSync(`${editor} "${configPath}"`, { stdio: 'inherit' });
    console.log(chalk.green('✅ Config file closed'));
  } catch (error) {
    console.error(chalk.red('❌ Editor failed:'), error.message);
  }
}

async function validateConfig(options) {
  try {
    const configPath = path.join(process.cwd(), 'supernal.yaml');
    if (!fs.existsSync(configPath)) {
      console.log(
        chalk.yellow('⚠️  No supernal.yaml found in current directory')
      );
      return;
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.parse(configContent);
    console.log(chalk.green('✅ Configuration is valid'));

    if (options.verbose) {
      console.log(chalk.blue('\nConfiguration structure:'));
      console.log(chalk.white(JSON.stringify(config, null, 2)));
    }
  } catch (error) {
    console.error(
      chalk.red('❌ Configuration validation failed:'),
      error.message
    );
    process.exitCode = 1;
  }
}

async function listPatterns(_options) {
  console.log(chalk.blue('📋 Available Configuration Patterns:'));
  console.log(chalk.cyan('\n  Workflow Patterns:'));
  console.log(chalk.white('    - minimal - Basic project structure'));
  console.log(chalk.white('    - agile-4 - 4-phase agile workflow'));
  console.log(chalk.white('    - comprehensive-16 - Full 16-phase workflow'));

  console.log(chalk.cyan('\n  Standard Directories:'));
  console.log(chalk.white('    - requirements/'));
  console.log(chalk.white('    - tests/'));
  console.log(chalk.white('    - docs/'));
  console.log(chalk.white('    - kanban/'));

  console.log(chalk.cyan('\n  Git patterns:'));
  console.log(chalk.white('    - .git/'));
  console.log(chalk.white('    - .gitignore'));

  console.log(chalk.cyan('\n  Config files:'));
  console.log(chalk.white('    - supernal.yaml'));
  console.log(chalk.white('    - .cursor/mcp.json'));
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to get value from
 * @param {string} key - Dot-notation key (e.g., 'git_hooks.enabled')
 * @returns {*} Value at key path or undefined
 */
function getNestedValue(obj, key) {
  return key.split('.').reduce((current, part) => current?.[part], obj);
}

/**
 * Set nested value in object using dot notation
 * @param {Object} obj - Object to set value in
 * @param {string} key - Dot-notation key (e.g., 'git_hooks.enabled')
 * @param {*} value - Value to set
 */
function setNestedValue(obj, key, value) {
  const parts = key.split('.');
  const lastPart = parts.pop();

  let current = obj;
  for (const part of parts) {
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  current[lastPart] = value;
}

module.exports = { handleConfigCommand };
