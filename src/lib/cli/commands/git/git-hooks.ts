#!/usr/bin/env node

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const HookConfigLoader = require('../git-hooks/hook-config-loader');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

class GitHooks {
  constructor() {
    this.scriptsDir = path.join(__dirname, 'git-hooks-scripts');
    this.configLoader = new HookConfigLoader();
  }

  /**
   * Show current hook configuration using reusable config module
   */
  async showConfig(options = {}) {
    const { handleConfigCommand } = require('../config');

    // Use config module to show git_hooks section
    await handleConfigCommand('show', {
      section: 'git_hooks',
      ...options
    });

    console.log();
    console.log(`${colors.cyan}Commands:${colors.reset}`);
    console.log(`  sc git-hooks install      Install hooks`);
    console.log(`  sc git-hooks status       Check hook status`);
    console.log(`  sc config hooks           View hooks configuration report`);
    console.log();
  }

  /**
   * Validate hook configuration using reusable config module
   */
  async validateConfig(options = {}) {
    const { handleConfigCommand } = require('../config');

    console.log(
      `${colors.blue}🔍 Validating hook configuration...${colors.reset}\n`
    );

    try {
      // Validate the git_hooks section
      await handleConfigCommand('validate', { ...options });

      // Additional git-hooks specific validation
      const config = this.configLoader.loadConfig();
      if (!config.git_hooks) {
        console.log(
          `${colors.yellow}⚠️  No git_hooks configuration found${colors.reset}`
        );
        console.log(
          `${colors.cyan}Hint: Run 'sc init --standard' to add git hooks configuration${colors.reset}`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        `${colors.red}❌ Configuration error: ${error.message}${colors.reset}`
      );
      return false;
    }
  }

  async installPreCommitHooks(_options = {}) {
    console.log(
      `${colors.blue}🔧 Setting up pre-commit hooks...${colors.reset}`
    );
    const scriptPath = path.join(this.scriptsDir, 'setup-pre-commit-hooks.sh');
    if (!fs.existsSync(scriptPath)) {
      console.error(
        `${colors.red}❌ Script not found: ${scriptPath}${colors.reset}`
      );
      process.exit(1);
    }
    try {
      execSync(`bash "${scriptPath}"`, {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      console.log(
        `${colors.green}✅ Pre-commit hooks installed${colors.reset}`
      );
    } catch {
      console.error(
        `${colors.red}❌ Pre-commit hooks installation failed${colors.reset}`
      );
      process.exit(1);
    }
  }

  async installGitSafetyHooks(options = {}) {
    console.log(
      `${colors.blue}🔒 Installing git safety hooks...${colors.reset}`
    );
    console.log(
      `${colors.yellow}⚠️  Using JS-based installers for safety (pre-commit + pre-push)${colors.reset}`
    );
    await this.installPreCommitHooks(options);
    await this.installPrePushHooks(options);
  }

  async installPrePushHooks(options = {}) {
    console.log(`${colors.blue}🚀 Setting up pre-push hooks...${colors.reset}`);
    try {
      const { installPrePushHook } = require('../install-pre-push-hook');
      await installPrePushHook({
        projectRoot: process.cwd(),
        verbose: options.verbose || false
      });
      console.log(`${colors.green}✅ Pre-push hooks installed${colors.reset}`);
    } catch (error) {
      console.error(
        `${colors.red}❌ Pre-push hooks installation failed: ${error.message}${colors.reset}`
      );
      process.exit(1);
    }
  }

  async installAll(options = {}) {
    console.log(`${colors.blue}🏗️  Installing all git hooks...${colors.reset}`);
    try {
      await this.installPreCommitHooks(options);
      await this.installGitSafetyHooks(options);
      await this.installPrePushHooks(options);
      console.log(
        `\n${colors.green}✅ All git hooks installed successfully!${colors.reset}\n`
      );
      console.log(`${colors.cyan}What's been set up:${colors.reset}`);
      console.log('  🔍 Type duplication checking (pre-commit)');
      console.log('  🔒 Main/master branch protection');
      console.log('  📝 Commit message format suggestions');
      console.log('  🚀 Feature branch workflow enforcement');
      console.log('  🧪 Test suite validation (pre-push)');
      console.log('  🔒 Security audit validation (pre-push)');
    } catch {
      console.error(
        `${colors.red}❌ Git hooks installation failed${colors.reset}`
      );
      process.exit(1);
    }
  }

  checkGitRepository() {
    if (!fs.existsSync('.git')) {
      console.error(`${colors.red}❌ Not in a git repository${colors.reset}`);
      console.log(
        `${colors.cyan}Initialize git first: git init${colors.reset}`
      );
      process.exit(1);
    }
  }

  async checkStatus() {
    console.log(`${colors.blue}📊 Git hooks status:${colors.reset}`);
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) {
      console.log(`${colors.red}❌ Not a git repository${colors.reset}`);
      return;
    }

    const hooksDir = path.join(gitDir, 'hooks');
    const hooks = ['pre-commit', 'pre-push', 'commit-msg'];

    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, hook);
      if (fs.existsSync(hookPath)) {
        console.log(`${colors.green}✅ ${hook} hook installed${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ ${hook} hook not found${colors.reset}`);
      }
    }
  }

  showHelp() {
    console.log(`${colors.bold}Supernal Coding Git Hooks${colors.reset}`);
    console.log('');
    console.log(`${colors.cyan}Available commands:${colors.reset}`);
    console.log('  install             Install all git hooks (recommended)');
    console.log('  pre-commit          Install only pre-commit hooks');
    console.log('  pre-push            Install only pre-push hooks');
    console.log('  safety              Install only git safety hooks');
    console.log('  status              Check git hooks status');
  }
}

// CLI interface function
async function main(args) {
  // Handle both array and string args
  const action = Array.isArray(args) ? args[0] : args;
  const gitHooks = new GitHooks();

  switch (action) {
    case 'install':
      await gitHooks.installAll();
      break;
    case 'pre-commit':
      await gitHooks.installPreCommitHooks();
      break;
    case 'pre-push':
      await gitHooks.installPrePushHooks();
      break;
    case 'safety':
      await gitHooks.installGitSafetyHooks();
      break;
    case 'status':
      await gitHooks.checkStatus();
      break;
    case 'config':
      await gitHooks.showConfig();
      break;
    case 'validate':
      await gitHooks.validateConfig();
      break;
    default:
      gitHooks.showHelp();
      break;
  }
}

// Export both for compatibility
async function handleGitHooksCommand(action, _hook, options) {
  const gitHooks = new GitHooks();

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
      await gitHooks.checkStatus(options);
      break;
    case 'config':
      await gitHooks.showConfig(options);
      break;
    case 'validate':
      await gitHooks.validateConfig(options);
      break;
    default:
      gitHooks.showHelp();
      break;
  }
}

module.exports = main;
module.exports.handleGitHooksCommand = handleGitHooksCommand;
module.exports.GitHooks = GitHooks;
