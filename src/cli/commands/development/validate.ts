// @ts-nocheck
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');
const yaml = require('js-yaml');
const { getConfig } = require('../../../scripts/config-loader');

/**
 * Comprehensive Repository Health Check and Self-Validation System
 * Validates equipment pack installation, system health, and provides actionable feedback
 * Now includes requirements validation functionality
 */

const VALIDATION_CATEGORIES = {
  EQUIPMENT_PACK: 'Equipment Pack Installation',
  PROJECT_TYPE: 'Project Type Configuration',
  CURSOR_RULES: 'Cursor Rules System',
  MCP_CONFIG: 'MCP Configuration',
  ENVIRONMENT: 'Environment Setup',
  TESTING: 'Testing System',
  AUTOMATION: 'Automation Capabilities',
  HEALTH: 'System Health',
  REQUIREMENTS: 'Requirements Validation', // NEW
};

const VALIDATION_LEVELS = {
  CRITICAL: { level: 'critical', icon: '❌', color: 'red' },
  WARNING: { level: 'warning', icon: '⚠️', color: 'yellow' },
  INFO: { level: 'info', icon: 'ℹ️', color: 'blue' },
  SUCCESS: { level: 'success', icon: '✅', color: 'green' },
};

function validateConfiguration(config) {
  console.log(chalk.blue('🔍 Configuration Validation'));
  console.log(chalk.blue('='.repeat(30)));

  const validation = config.validateConfiguration();

  if (!validation.valid) {
    console.log(chalk.red('❌ Configuration validation failed:'));
    validation.errors.forEach((error) => {
      console.log(chalk.red(`   ✗ ${error}`));
    });
    return false;
  }

  console.log(chalk.green('✅ Configuration is valid'));

  // Show warnings if any
  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    validation.warnings.forEach((warning) => {
      console.log(chalk.yellow(`   ⚠ ${warning}`));
    });
  }

  // Show configured directories
  console.log(chalk.blue('\n📁 Configured Directories:'));
  console.log(`   Requirements: ${config.getRequirementsDirectory()}`);
  console.log(`   Kanban: ${config.getKanbanBaseDirectory()}`);

  return true;
}

async function validateCommand(options) {
  try {
    // Check if this is a documentation validation request
    if (options.docs || options.documentation) {
      const DocumentationValidator = require('../../../validation/DocumentationValidator');
      const validator = new DocumentationValidator();

      // Prepare validation options
      const validationOptions = {
        logFile: options.logFile || 'doc-validation.log',
        verbose: options.verbose || false,
      };

      const result = await validator.validate(validationOptions);

      // Handle --fix flag (with optional --dry-run)
      if (options.fix && !result.success) {
        const isDryRun = options.dryRun || false;

        if (isDryRun) {
          console.log(chalk.blue('\n🔍 Previewing fixes (dry-run)...\n'));
        } else {
          console.log(chalk.blue('\n🔧 Applying fixes...\n'));
        }

        const fixResult = await validator.fixIdFilenameMismatches(isDryRun);

        console.log(chalk.blue('\n📊 Fix Summary:'));
        if (isDryRun) {
          console.log(chalk.cyan(`   🔍 Would fix: ${fixResult.fixed}`));
        } else {
          console.log(chalk.green(`   ✅ Fixed: ${fixResult.fixed}`));
        }

        if (fixResult.failed > 0) {
          console.log(chalk.red(`   ❌ Failed: ${fixResult.failed}`));
        }

        // Re-validate
        console.log(chalk.blue('\n🔍 Re-validating...\n'));
        const finalResult = await validator.validate();
        return finalResult;
      }

      return result;
    }

    // Check if this is a requirements validation request
    if (options.requirements || options.req) {
      return await validateRequirements(options);
    }

    console.log(chalk.blue('🔍 Supernal Coding Repository Health Check'));
    console.log(chalk.blue('='.repeat(60)));

    // Load configuration - only when actually running validation, not during init
    let config;
    try {
      config = getConfig();
      config.load();
    } catch (_error) {
      console.log(
        chalk.yellow(
          '⚠️  Configuration not found or invalid. This may be expected for new projects.'
        )
      );
      console.log(
        chalk.yellow('   Run "sc init" to set up the project configuration.')
      );
      console.log('');
      // For now, continue with basic validation that doesn't require config
      config = null;
    }

    // First validate configuration (only if config is available)
    if (config && !validateConfiguration(config)) {
      console.log(
        chalk.red(
          '\n❌ Configuration validation failed. Please fix configuration issues first.'
        )
      );
      process.exit(1);
    }
    console.log('');

    const targetDir = options.directory || process.cwd();
    const results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      info: 0,
      checks: [],
    };

    // Equipment Pack Installation Validation
    console.log(chalk.yellow(`\n🏗️  ${VALIDATION_CATEGORIES.EQUIPMENT_PACK}`));
    await validateEquipmentPack(targetDir, config, results);

    // Project Type Configuration Validation
    console.log(chalk.yellow(`\n🎯 ${VALIDATION_CATEGORIES.PROJECT_TYPE}`));
    await validateProjectType(targetDir, config, results);

    // Cursor Rules System Validation
    console.log(chalk.yellow(`\n📋 ${VALIDATION_CATEGORIES.CURSOR_RULES}`));
    await validateCursorRules(targetDir, config, results);

    // MCP Configuration Validation
    console.log(chalk.yellow(`\n🔌 ${VALIDATION_CATEGORIES.MCP_CONFIG}`));
    await validateMCPConfig(targetDir, config, results);

    // Environment Setup Validation
    console.log(chalk.yellow(`\n🌍 ${VALIDATION_CATEGORIES.ENVIRONMENT}`));
    await validateEnvironment(targetDir, config, results);

    // Testing System Validation
    console.log(chalk.yellow(`\n🧪 ${VALIDATION_CATEGORIES.TESTING}`));
    await validateTesting(targetDir, config, results);

    // Automation Capabilities Validation
    console.log(chalk.yellow(`\n🤖 ${VALIDATION_CATEGORIES.AUTOMATION}`));
    await validateAutomation(targetDir, config, results);

    // System Health Validation
    console.log(chalk.yellow(`\n🏥 ${VALIDATION_CATEGORIES.HEALTH}`));
    await validateHealth(targetDir, config, results);

    // Display Summary
    displayValidationSummary(results, options);

    // Generate actionable recommendations
    await generateRecommendations(targetDir, config, results);

    // Exit with appropriate code
    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('❌ Validation failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function _loadConfiguration(targetDir) {
  try {
    const configPath = path.join(targetDir, '.supernal-config.json');
    if (await fs.pathExists(configPath)) {
      return await fs.readJSON(configPath);
    }
  } catch (_error) {
    // Configuration not found or invalid
  }
  return null;
}

async function validateEquipmentPack(targetDir, config, results) {
  // Check if equipment pack is installed
  await checkFile(
    targetDir,
    '.supernal-config.json',
    'Equipment Pack configuration',
    results,
    VALIDATION_LEVELS.CRITICAL
  );

  if (config) {
    // Validate equipment pack structure
    const requiredFields = ['version', 'equipmentPack'];
    for (const field of requiredFields) {
      if (!config[field]) {
        addResult(
          results,
          VALIDATION_LEVELS.CRITICAL,
          `Configuration missing required field: ${field}`
        );
      } else {
        addResult(
          results,
          VALIDATION_LEVELS.SUCCESS,
          `Configuration has ${field}`
        );
      }
    }

    // Validate equipment pack components
    if (config.equipmentPack) {
      const ep = config.equipmentPack;

      // Check installation timestamp
      if (ep.installedAt) {
        const installDate = new Date(ep.installedAt);
        const daysSinceInstall = Math.floor(
          (Date.now() - installDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceInstall > 30) {
          addResult(
            results,
            VALIDATION_LEVELS.WARNING,
            `Equipment pack installed ${daysSinceInstall} days ago - consider updating`
          );
        } else {
          addResult(
            results,
            VALIDATION_LEVELS.SUCCESS,
            `Equipment pack recently installed (${daysSinceInstall} days ago)`
          );
        }
      }

      // Check project type detection
      if (ep.projectType) {
        addResult(
          results,
          VALIDATION_LEVELS.SUCCESS,
          `Project type detected: ${ep.projectType.name}`
        );

        if (ep.projectType.confidence < 0.5) {
          addResult(
            results,
            VALIDATION_LEVELS.WARNING,
            `Low project type detection confidence: ${Math.round(ep.projectType.confidence * 100)}%`
          );
        }
      }

      // Check features
      if (ep.features) {
        const features = ep.features;
        addResult(
          results,
          VALIDATION_LEVELS.SUCCESS,
          `Core System: ${features.coreSystem ? 'enabled' : 'disabled'}`
        );
        addResult(
          results,
          VALIDATION_LEVELS.INFO,
          `Git Management: ${features.gitManagement ? 'enabled' : 'disabled'}`
        );
      }
    }
  } else {
    addResult(
      results,
      VALIDATION_LEVELS.CRITICAL,
      'Equipment pack not installed - run: supernal-coding init'
    );
  }
}

async function validateProjectType(targetDir, config, results) {
  if (!config?.equipmentPack?.projectType) {
    addResult(results, VALIDATION_LEVELS.WARNING, 'Project type not detected');
    return;
  }

  const projectType = config.equipmentPack.projectType;

  // Validate project type against actual project structure
  const actualIndicators = await detectProjectIndicators(targetDir);

  if (actualIndicators.length > 0) {
    addResult(
      results,
      VALIDATION_LEVELS.SUCCESS,
      `Project indicators found: ${actualIndicators.join(', ')}`
    );

    // Check if detected type matches actual indicators
    const typeMatch = actualIndicators.some(
      (indicator) =>
        indicator.toLowerCase().includes(projectType.type.toLowerCase()) ||
        projectType.type.toLowerCase().includes(indicator.toLowerCase())
    );

    if (typeMatch) {
      addResult(
        results,
        VALIDATION_LEVELS.SUCCESS,
        'Project type matches detected indicators'
      );
    } else {
      addResult(
        results,
        VALIDATION_LEVELS.WARNING,
        'Project type may not match actual project structure'
      );
    }
  }

  // Validate project-specific packages
  if (await fs.pathExists(path.join(targetDir, 'package.json'))) {
    const packageJson = await fs.readJSON(path.join(targetDir, 'package.json'));
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    // Check for project-type specific dependencies
    const typeSpecificDeps = getExpectedDependencies(projectType.type);
    const foundDeps = typeSpecificDeps.filter((dep) => deps[dep]);

    if (foundDeps.length > 0) {
      addResult(
        results,
        VALIDATION_LEVELS.SUCCESS,
        `Project-specific dependencies found: ${foundDeps.join(', ')}`
      );
    }
  }
}

async function validateCursorRules(targetDir, config, results) {
  const cursorRulesDir = path.join(targetDir, '.cursor/rules');

  // Check if cursor rules directory exists
  if (await fs.pathExists(cursorRulesDir)) {
    addResult(
      results,
      VALIDATION_LEVELS.SUCCESS,
      'Cursor rules directory exists'
    );

    // Check for core rules
    const coreRules = [
      'agent-on-board',
      'dev_workflow',
      'agent-hand-off',
      'avoid-anti-patterns',
    ];
    const existingRules = await fs.readdir(cursorRulesDir);

    for (const rule of coreRules) {
      const ruleFile = `${rule}.mdc`;
      if (existingRules.includes(ruleFile)) {
        addResult(
          results,
          VALIDATION_LEVELS.SUCCESS,
          `Core rule installed: ${rule}`
        );
      } else {
        addResult(
          results,
          VALIDATION_LEVELS.WARNING,
          `Core rule missing: ${rule}`
        );
      }
    }

    // Check for project-specific rules
    if (config?.equipmentPack?.projectType) {
      const projectType = config.equipmentPack.projectType.type;
      const expectedAdditionalRules = getExpectedAdditionalRules(projectType);

      for (const rule of expectedAdditionalRules) {
        const ruleFile = `${rule}.mdc`;
        if (existingRules.includes(ruleFile)) {
          addResult(
            results,
            VALIDATION_LEVELS.SUCCESS,
            `Project-specific rule installed: ${rule}`
          );
        } else {
          addResult(
            results,
            VALIDATION_LEVELS.INFO,
            `Project-specific rule could be added: ${rule}`
          );
        }
      }
    }

    // Check README
    if (existingRules.includes('README.md')) {
      addResult(
        results,
        VALIDATION_LEVELS.SUCCESS,
        'Cursor rules README exists'
      );
    } else {
      addResult(results, VALIDATION_LEVELS.INFO, 'Cursor rules README missing');
    }
  } else {
    addResult(
      results,
      VALIDATION_LEVELS.CRITICAL,
      'Cursor rules directory missing'
    );
  }
}

async function validateMCPConfig(targetDir, config, results) {
  const mcpConfigPath = path.join(targetDir, '.cursor/mcp.json');

  // Check if MCP configuration exists
  if (await fs.pathExists(mcpConfigPath)) {
    addResult(results, VALIDATION_LEVELS.SUCCESS, 'MCP configuration exists');

    try {
      const mcpConfig = await fs.readJSON(mcpConfigPath);

      // Validate MCP configuration structure
      if (mcpConfig.mcpServers) {
        const serverCount = Object.keys(mcpConfig.mcpServers).length;
        addResult(
          results,
          VALIDATION_LEVELS.SUCCESS,
          `MCP servers configured: ${serverCount}`
        );

        // Check for core MCP server
        if (mcpConfig.mcpServers['supernal-coding']) {
          addResult(
            results,
            VALIDATION_LEVELS.SUCCESS,
            'Core MCP server configured'
          );
        } else {
          addResult(
            results,
            VALIDATION_LEVELS.WARNING,
            'Core MCP server missing'
          );
        }

        // Check for project-specific MCP servers
        if (config?.equipmentPack?.projectType) {
          const projectType = config.equipmentPack.projectType.type;
          const expectedServers = getExpectedMCPServers(projectType);

          for (const server of expectedServers) {
            if (mcpConfig.mcpServers[server]) {
              addResult(
                results,
                VALIDATION_LEVELS.SUCCESS,
                `Project-specific MCP server configured: ${server}`
              );
            } else {
              addResult(
                results,
                VALIDATION_LEVELS.INFO,
                `Project-specific MCP server could be configured: ${server}`
              );
            }
          }
        }
      }

      // Check environment variables
      if (mcpConfig.env) {
        const envVarCount = Object.keys(mcpConfig.env).length;
        addResult(
          results,
          VALIDATION_LEVELS.SUCCESS,
          `MCP environment variables configured: ${envVarCount}`
        );
      }
    } catch (_error) {
      addResult(
        results,
        VALIDATION_LEVELS.CRITICAL,
        'MCP configuration is invalid JSON'
      );
    }
  } else {
    addResult(results, VALIDATION_LEVELS.CRITICAL, 'MCP configuration missing');
  }
}

async function validateEnvironment(targetDir, _config, results) {
  // Check for environment template
  await checkFile(
    targetDir,
    '.env.template',
    'Environment template',
    results,
    VALIDATION_LEVELS.SUCCESS
  );

  // Check for environment-specific files
  const envFiles = ['.env.development', '.env.production', '.env.test'];
  for (const envFile of envFiles) {
    await checkFile(
      targetDir,
      envFile,
      `Environment file: ${envFile}`,
      results,
      VALIDATION_LEVELS.SUCCESS
    );
  }

  // Check for .env file (should not exist in repo)
  if (await fs.pathExists(path.join(targetDir, '.env'))) {
    addResult(
      results,
      VALIDATION_LEVELS.WARNING,
      ".env file exists - ensure it's in .gitignore"
    );
  } else {
    addResult(
      results,
      VALIDATION_LEVELS.SUCCESS,
      '.env file properly excluded from repository'
    );
  }

  // Check .gitignore
  const gitignorePath = path.join(targetDir, '.gitignore');
  if (await fs.pathExists(gitignorePath)) {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    if (gitignoreContent.includes('.env')) {
      addResult(
        results,
        VALIDATION_LEVELS.SUCCESS,
        '.env properly ignored in .gitignore'
      );
    } else {
      addResult(
        results,
        VALIDATION_LEVELS.WARNING,
        '.env not found in .gitignore'
      );
    }
  }
}

async function validateTesting(targetDir, _config, results) {
  // Check testing directories
  const testDirs = ['tests', 'tests/e2e', 'tests/requirements'];
  for (const testDir of testDirs) {
    await checkDir(
      targetDir,
      testDir,
      `Testing directory: ${testDir}`,
      results,
      VALIDATION_LEVELS.SUCCESS
    );
  }

  // Check for test runner
  await checkFile(
    targetDir,
    'tests/e2e/lib/test-runner.js',
    'E2E test runner',
    results,
    VALIDATION_LEVELS.SUCCESS
  );

  // Check for test scenarios
  const scenariosDir = path.join(targetDir, 'tests/e2e/scenarios');
  if (await fs.pathExists(scenariosDir)) {
    const scenarios = await fs.readdir(scenariosDir);
    const yamlScenarios = scenarios.filter((f) => f.endsWith('.yaml'));

    if (yamlScenarios.length > 0) {
      addResult(
        results,
        VALIDATION_LEVELS.SUCCESS,
        `E2E test scenarios found: ${yamlScenarios.length}`
      );
    } else {
      addResult(results, VALIDATION_LEVELS.INFO, 'No E2E test scenarios found');
    }
  }

  // Check for package.json test scripts
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJSON(packageJsonPath);

    if (packageJson.scripts) {
      const testScripts = Object.keys(packageJson.scripts).filter((s) =>
        s.includes('test')
      );
      if (testScripts.length > 0) {
        addResult(
          results,
          VALIDATION_LEVELS.SUCCESS,
          `NPM test scripts found: ${testScripts.join(', ')}`
        );
      } else {
        addResult(results, VALIDATION_LEVELS.INFO, 'No NPM test scripts found');
      }
    }
  }
}

async function validateAutomation(targetDir, _config, results) {
  // Check for automation scripts
  const automationScripts = [
    'scripts/agent-onboard.sh',
    'scripts/validate-dependencies.sh',
    'scripts/setup-pre-commit-hooks.sh',
  ];

  for (const script of automationScripts) {
    await checkFile(
      targetDir,
      script,
      `Automation script: ${path.basename(script)}`,
      results,
      VALIDATION_LEVELS.SUCCESS
    );
  }

  // Check for CLI system
  await checkDir(
    targetDir,
    'cli',
    'CLI system',
    results,
    VALIDATION_LEVELS.SUCCESS
  );
  await checkFile(
    targetDir,
    'supernal-code-package/lib/cli/index.js',
    'CLI entry point',
    results,
    VALIDATION_LEVELS.SUCCESS
  );

  // Check for workflow system
  await checkFile(
    targetDir,
    'wf.sh',
    'Workflow system',
    results,
    VALIDATION_LEVELS.SUCCESS
  );

  // Check Git setup
  if (await fs.pathExists(path.join(targetDir, '.git'))) {
    addResult(results, VALIDATION_LEVELS.SUCCESS, 'Git repository initialized');

    // Check for pre-commit hooks
    const preCommitHook = path.join(targetDir, '.git/hooks/pre-commit');
    if (await fs.pathExists(preCommitHook)) {
      addResult(
        results,
        VALIDATION_LEVELS.SUCCESS,
        'Pre-commit hooks installed'
      );
    } else {
      addResult(
        results,
        VALIDATION_LEVELS.INFO,
        'Pre-commit hooks not installed'
      );
    }
  } else {
    addResult(
      results,
      VALIDATION_LEVELS.WARNING,
      'Git repository not initialized'
    );
  }
}

async function validateHealth(targetDir, _config, results) {
  // Check Node.js version
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0], 10);

    if (majorVersion >= 18) {
      addResult(
        results,
        VALIDATION_LEVELS.SUCCESS,
        `Node.js version: ${nodeVersion}`
      );
    } else {
      addResult(
        results,
        VALIDATION_LEVELS.WARNING,
        `Node.js version ${nodeVersion} - recommend v18+`
      );
    }
  } catch (_error) {
    addResult(results, VALIDATION_LEVELS.CRITICAL, 'Node.js not available');
  }

  // Check npm/package manager
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    addResult(results, VALIDATION_LEVELS.SUCCESS, `NPM version: ${npmVersion}`);
  } catch (_error) {
    addResult(results, VALIDATION_LEVELS.WARNING, 'NPM not available');
  }

  // Check dependencies
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const nodeModulesPath = path.join(targetDir, 'node_modules');
    if (await fs.pathExists(nodeModulesPath)) {
      addResult(results, VALIDATION_LEVELS.SUCCESS, 'Dependencies installed');
    } else {
      addResult(
        results,
        VALIDATION_LEVELS.WARNING,
        'Dependencies not installed - run: npm install'
      );
    }
  }

  // Check disk space
  try {
    const _stats = await fs.stat(targetDir);
    addResult(
      results,
      VALIDATION_LEVELS.SUCCESS,
      'Repository directory accessible'
    );
  } catch (_error) {
    addResult(
      results,
      VALIDATION_LEVELS.CRITICAL,
      'Repository directory not accessible'
    );
  }
}

// Helper functions
async function checkFile(targetDir, filePath, description, results, level) {
  const fullPath = path.join(targetDir, filePath);
  const exists = await fs.pathExists(fullPath);

  if (exists) {
    addResult(results, VALIDATION_LEVELS.SUCCESS, `${description} exists`);
  } else {
    addResult(results, level, `${description} missing`);
  }

  return exists;
}

async function checkDir(targetDir, dirPath, description, results, level) {
  const fullPath = path.join(targetDir, dirPath);
  const exists = await fs.pathExists(fullPath);

  if (exists) {
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      addResult(results, VALIDATION_LEVELS.SUCCESS, `${description} exists`);
    } else {
      addResult(
        results,
        VALIDATION_LEVELS.CRITICAL,
        `${description} is not a directory`
      );
    }
  } else {
    addResult(results, level, `${description} missing`);
  }

  return exists;
}

function addResult(results, level, message) {
  const check = {
    level: level.level,
    icon: level.icon,
    message,
    color: level.color,
  };

  results.checks.push(check);

  // Update counters
  switch (level.level) {
    case 'success':
      results.passed++;
      break;
    case 'critical':
      results.failed++;
      break;
    case 'warning':
      results.warnings++;
      break;
    case 'info':
      results.info++;
      break;
  }

  // Display immediately
  const colorFunc = chalk[level.color] || chalk.white;
  console.log(colorFunc(`   ${level.icon} ${message}`));
}

function displayValidationSummary(results, _options) {
  console.log(chalk.blue('\n📊 VALIDATION SUMMARY'));
  console.log(chalk.blue('='.repeat(60)));

  console.log(chalk.green(`✅ Passed: ${results.passed}`));
  console.log(chalk.red(`❌ Failed: ${results.failed}`));
  console.log(chalk.yellow(`⚠️  Warnings: ${results.warnings}`));
  console.log(chalk.blue(`ℹ️  Info: ${results.info}`));

  const total =
    results.passed + results.failed + results.warnings + results.info;
  console.log(chalk.gray(`📊 Total: ${total}`));

  if (results.failed > 0) {
    console.log(chalk.red('\n❌ Repository validation FAILED!'));
    console.log(
      chalk.red(`Found ${results.failed} critical issues that need attention.`)
    );
  } else if (results.warnings > 0) {
    console.log(
      chalk.yellow('\n⚠️  Repository validation passed with warnings.')
    );
    console.log(
      chalk.yellow(`Found ${results.warnings} issues that should be addressed.`)
    );
  } else {
    console.log(chalk.green('\n✅ Repository validation PASSED!'));
    console.log(
      chalk.green('All systems are properly configured and healthy.')
    );
  }
}

async function generateRecommendations(_targetDir, _config, results) {
  const criticalIssues = results.checks.filter((c) => c.level === 'critical');
  const warnings = results.checks.filter((c) => c.level === 'warning');

  if (criticalIssues.length > 0 || warnings.length > 0) {
    console.log(chalk.blue('\n💡 RECOMMENDED ACTIONS'));
    console.log(chalk.blue('='.repeat(60)));

    if (criticalIssues.length > 0) {
      console.log(chalk.red('🚨 Critical Issues:'));

      // Equipment pack not installed
      if (
        criticalIssues.some((i) =>
          i.message.includes('Equipment pack not installed')
        )
      ) {
        console.log(chalk.red('  1. Run: supernal-coding init'));
      }

      // MCP configuration issues
      if (criticalIssues.some((i) => i.message.includes('MCP configuration'))) {
        console.log(chalk.red('  2. Check .cursor/mcp.json configuration'));
      }

      // Node.js issues
      if (criticalIssues.some((i) => i.message.includes('Node.js'))) {
        console.log(
          chalk.red('  3. Install Node.js v18+ from https://nodejs.org')
        );
      }
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Warnings:'));

      // Dependencies not installed
      if (
        warnings.some((i) => i.message.includes('Dependencies not installed'))
      ) {
        console.log(chalk.yellow('  1. Run: npm install'));
      }

      // Git not initialized
      if (
        warnings.some((i) =>
          i.message.includes('Git repository not initialized')
        )
      ) {
        console.log(chalk.yellow('  2. Run: git init'));
      }

      // Environment file issues
      if (warnings.some((i) => i.message.includes('.env'))) {
        console.log(chalk.yellow('  3. Create .env file from .env.template'));
      }
    }

    console.log(chalk.gray('\n📞 Need Help?'));
    console.log(
      chalk.gray(
        '  - Run: supernal-coding validate --verbose (for detailed output)'
      )
    );
    console.log(
      chalk.gray('  - Run: supernal-coding workflow test (to test the system)')
    );
    console.log(chalk.gray('  - Check documentation in docs/ directory'));
  }
}

// Project-specific helper functions
async function detectProjectIndicators(targetDir) {
  const indicators = [];

  // Check package.json
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJSON(packageJsonPath);
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    if (deps.react) indicators.push('React');
    if (deps.express) indicators.push('Express');
    if (deps.vue) indicators.push('Vue');
    if (deps.angular) indicators.push('Angular');
    if (deps.electron) indicators.push('Electron');
    if (deps.commander) indicators.push('CLI');
  }

  // Check for Python files
  const pythonFiles = ['requirements.txt', 'setup.py', 'pyproject.toml'];
  for (const file of pythonFiles) {
    if (await fs.pathExists(path.join(targetDir, file))) {
      indicators.push('Python');
      break;
    }
  }

  // Check directory structure
  const dirs = await fs.readdir(targetDir).catch(() => []);
  if (dirs.includes('src') && dirs.includes('public'))
    indicators.push('Frontend');
  if (dirs.includes('server') && dirs.includes('client'))
    indicators.push('Fullstack');
  if (dirs.includes('ios') && dirs.includes('android'))
    indicators.push('Mobile');

  return indicators;
}

function getExpectedDependencies(projectType) {
  const deps = {
    'web-frontend': ['react', 'vue', '@angular/core', 'webpack', 'vite'],
    'node-backend': ['express', 'fastify', 'koa', 'helmet', 'cors'],
    python: ['flask', 'django', 'fastapi', 'requests'],
    mobile: ['react-native', 'expo', '@react-native-community'],
    desktop: ['electron', 'electron-builder', 'tauri'],
    devtools: ['commander', 'inquirer', 'chalk', 'ora'],
  };

  return deps[projectType] || [];
}

function getExpectedAdditionalRules(projectType) {
  const rules = {
    'web-frontend': [
      'react-patterns',
      'component-architecture',
      'frontend-performance',
    ],
    'node-backend': ['api-design', 'security-patterns', 'database-patterns'],
    python: ['python-patterns', 'django-patterns', 'flask-patterns'],
    mobile: [
      'mobile-patterns',
      'performance-optimization',
      'platform-specific',
    ],
    desktop: ['desktop-patterns', 'native-integration', 'cross-platform'],
    devtools: ['cli-patterns', 'tool-architecture', 'config-management'],
  };

  return rules[projectType] || [];
}

function getExpectedMCPServers(projectType) {
  const servers = {
    'web-frontend': ['react-devtools'],
    'node-backend': ['api-tools', 'database-tools'],
    python: ['python-tools'],
    mobile: ['mobile-tools'],
    desktop: ['desktop-tools'],
  };

  return servers[projectType] || [];
}

/**
 * NEW: Requirements Validation Function
 * Extracted from scripts/validate-requirements.js for CLI integration
 */
async function validateRequirements(options = {}) {
  console.log(chalk.blue('🔍 Requirements Validation System'));
  console.log(chalk.blue('='.repeat(50)));

  // Default configuration
  const defaultConfig = {
    directory: config.getRequirementsDirectory(),
    ignoreFolders: ['to-fix', 'archive', 'deprecated'],
  };

  // Try to load config from file or use defaults
  let config = defaultConfig;
  try {
    const configPath = path.join(process.cwd(), 'scripts/config.json');
    if (fs.existsSync(configPath)) {
      config = { ...defaultConfig, ...require(configPath) };
    }
  } catch (_error) {
    // Use defaults if config loading fails
  }

  const requirementsDir = config.directory;

  if (!fs.existsSync(requirementsDir)) {
    console.error(
      chalk.red(`❌ Requirements directory not found: ${requirementsDir}`)
    );
    return false;
  }

  console.log(`📋 Found requirements directory: ${requirementsDir}`);
  if (options.ignoreToFix) {
    console.log(
      chalk.yellow(
        `⚠️  Ignoring validation errors in: ${config.ignoreFolders.join(', ')}`
      )
    );
  }

  const results = {
    totalFiles: 0,
    validFiles: 0,
    invalidFiles: 0,
    skippedFiles: 0,
    errors: 0,
    warnings: 0,
    traceabilityScore: 0,
  };

  const requirementFiles = findRequirementFiles(
    requirementsDir,
    config.ignoreFolders
  );
  results.totalFiles = requirementFiles.length;

  console.log(`📊 Found ${results.totalFiles} requirement files`);

  // Validate each file
  for (const filePath of requirementFiles) {
    try {
      const validation = validateRequirementFile(filePath);
      if (validation.isValid) {
        results.validFiles++;
      } else {
        results.invalidFiles++;
        results.errors += validation.errors.length;
        results.warnings += validation.warnings.length;

        // Display errors and warnings
        if (validation.errors.length > 0) {
          console.log(
            chalk.red(`\n❌ ${path.relative(process.cwd(), filePath)}:`)
          );
          validation.errors.forEach((error) => {
            console.log(chalk.red(`   • ${error}`));
          });
        }
        if (validation.warnings.length > 0) {
          console.log(
            chalk.yellow(`\n⚠️  ${path.relative(process.cwd(), filePath)}:`)
          );
          validation.warnings.forEach((warning) => {
            console.log(chalk.yellow(`   • ${warning}`));
          });
        }
      }
    } catch (error) {
      results.invalidFiles++;
      results.errors++;
      console.log(
        chalk.red(`\n❌ Error validating ${filePath}: ${error.message}`)
      );
    }
  }

  // Display summary
  console.log(chalk.blue('\n📊 VALIDATION SUMMARY:'));
  console.log(`   Total files: ${results.totalFiles}`);
  console.log(`   Valid files: ${chalk.green(results.validFiles)}`);
  console.log(`   Invalid files: ${chalk.red(results.invalidFiles)}`);
  console.log(`   Skipped files: ${results.skippedFiles}`);
  console.log(`   Errors: ${chalk.red(results.errors)}`);
  console.log(`   Warnings: ${chalk.yellow(results.warnings)}`);
  console.log(`   Traceability score: ${results.traceabilityScore}%`);

  return results.invalidFiles === 0;
}

/**
 * Find all requirement files in directory, excluding specified folders
 */
function findRequirementFiles(dir, ignoreFolders = []) {
  const files = [];

  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip ignored folders
        const shouldSkip = ignoreFolders.some(
          (folder) =>
            item === folder ||
            fullPath.includes(`/${folder}/`) ||
            fullPath.includes(`\\${folder}\\`)
        );

        if (!shouldSkip) {
          scanDirectory(fullPath);
        }
      } else if (
        item.endsWith('.md') &&
        (item.startsWith('req-') || item.startsWith('REQ-'))
      ) {
        files.push(fullPath);
      }
    }
  }

  scanDirectory(dir);
  return files;
}

/**
 * Validate individual requirement file
 */
function validateRequirementFile(filePath) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for YAML frontmatter
    if (!content.startsWith('---')) {
      result.errors.push('Missing YAML frontmatter');
      result.isValid = false;
    } else {
      // Validate YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        try {
          const frontmatter = yaml.load(frontmatterMatch[1]);

          // Check required fields
          const requiredFields = [
            'id',
            'title',
            'category',
            'priority',
            'status',
          ];
          for (const field of requiredFields) {
            if (!frontmatter[field]) {
              result.errors.push(`Missing required field: ${field}`);
              result.isValid = false;
            }
          }

          // Check for Gherkin scenarios
          if (
            !content.includes('```gherkin') &&
            !content.includes('Feature:')
          ) {
            result.warnings.push('No Gherkin scenarios found');
          }
        } catch (yamlError) {
          result.errors.push(`Invalid YAML frontmatter: ${yamlError.message}`);
          result.isValid = false;
        }
      } else {
        result.errors.push('Invalid YAML frontmatter format');
        result.isValid = false;
      }
    }
  } catch (error) {
    result.errors.push(`File read error: ${error.message}`);
    result.isValid = false;
  }

  return result;
}

module.exports = validateCommand;
