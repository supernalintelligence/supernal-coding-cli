/**
 * Git Hooks Configuration Loader
 *
 * Loads and provides configuration for git hooks from supernal.yaml
 * Supports project-wide defaults and environment variable overrides
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

class HookConfigLoader {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = null;
  }

  /**
   * Load configuration from supernal.yaml
   * @returns {Object} Configuration object
   */
  loadConfig() {
    if (this.config) {
      return this.config;
    }

    const supernalPath = path.join(this.projectRoot, 'supernal.yaml');

    // Default configuration if no file exists
    const defaultConfig = {
      git_hooks: {
        enabled: true,
        pre_commit: {
          enabled: true,
          checks: {
            branch_naming: { enabled: true, skip_for_protected_branches: true },
            requirement_metadata: {
              enabled: true,
              update_git_tracking: true,
              auto_stage_updates: true
            },
            date_validation: {
              enabled: true,
              block_on_errors: true,
              allow_bypass: true
            },
            documentation_validation: {
              enabled: true,
              block_on_errors: true,
              allow_bypass: true
            },
            markdown_links: {
              enabled: true,
              block_on_errors: true,
              allow_bypass: true,
              check_only_staged: true
            },
            type_duplications: {
              enabled: false,
              block_on_errors: false,
              allow_bypass: true
            }
          }
        },
        pre_push: {
          enabled: false,
          checks: {
            test_suite: { enabled: false, block_on_failures: true },
            lint_check: { enabled: false, block_on_failures: false }
          }
        },
        bypass_variables: {
          date_validation: 'SC_SKIP_DATE_VALIDATION',
          documentation_validation: 'SC_SKIP_DOC_VALIDATION',
          all_hooks: 'SC_SKIP_HOOKS'
        }
      }
    };

    if (!fs.existsSync(supernalPath)) {
      this.config = defaultConfig;
      return this.config;
    }

    try {
      const content = fs.readFileSync(supernalPath, 'utf8');
      const yamlConfig = yaml.load(content);

      // Merge with defaults
      this.config = this.mergeConfig(defaultConfig, yamlConfig);
      return this.config;
    } catch (error) {
      console.error(
        'Warning: Failed to parse supernal.yaml, using defaults:',
        error.message
      );
      this.config = defaultConfig;
      return this.config;
    }
  }

  /**
   * Deep merge configuration objects
   */
  mergeConfig(defaults, custom) {
    const result = { ...defaults };

    if (!custom) return result;

    for (const key in custom) {
      if (
        custom[key] &&
        typeof custom[key] === 'object' &&
        !Array.isArray(custom[key])
      ) {
        result[key] = this.mergeConfig(defaults[key] || {}, custom[key]);
      } else {
        result[key] = custom[key];
      }
    }

    return result;
  }

  /**
   * Check if hooks are globally enabled
   */
  areHooksEnabled() {
    const config = this.loadConfig();

    // Check for global bypass
    if (
      process.env[
        config.git_hooks.bypass_variables?.all_hooks || 'SC_SKIP_HOOKS'
      ]
    ) {
      return false;
    }

    return config.git_hooks?.enabled !== false;
  }

  /**
   * Get pre-commit configuration
   */
  getPreCommitConfig() {
    const config = this.loadConfig();
    return config.git_hooks?.pre_commit || {};
  }

  /**
   * Check if a specific pre-commit check is enabled
   * @param {string} checkName - Name of the check (e.g., 'branch_naming')
   * @returns {boolean}
   */
  isCheckEnabled(checkName) {
    if (!this.areHooksEnabled()) {
      return false;
    }

    const preCommit = this.getPreCommitConfig();
    if (!preCommit.enabled) {
      return false;
    }

    const check = preCommit.checks?.[checkName];
    if (!check) {
      return false;
    }

    // Check for bypass environment variable
    if (check.allow_bypass) {
      const config = this.loadConfig();
      const bypassVar = config.git_hooks.bypass_variables?.[checkName];
      if (bypassVar && process.env[bypassVar]) {
        return false;
      }
    }

    return check.enabled !== false;
  }

  /**
   * Get configuration for a specific check
   * @param {string} checkName - Name of the check
   * @returns {Object} Check configuration
   */
  getCheckConfig(checkName) {
    const preCommit = this.getPreCommitConfig();
    return preCommit.checks?.[checkName] || {};
  }

  /**
   * Should this check block commits on errors?
   * @param {string} checkName - Name of the check
   * @returns {boolean}
   */
  shouldBlockOnErrors(checkName) {
    const check = this.getCheckConfig(checkName);
    return check.block_on_errors !== false && check.block_on_failures !== false;
  }

  /**
   * Get bypass environment variable for a check
   * @param {string} checkName - Name of the check
   * @returns {string|null} Environment variable name or null
   */
  getBypassVariable(checkName) {
    const config = this.loadConfig();
    return config.git_hooks.bypass_variables?.[checkName] || null;
  }

  /**
   * Generate configuration report
   * @returns {string} Human-readable configuration report
   */
  generateReport() {
    const _config = this.loadConfig();
    const lines = [];

    lines.push('Git Hooks Configuration');
    lines.push('======================');
    lines.push('');

    if (!this.areHooksEnabled()) {
      lines.push('❌ Git hooks are DISABLED');
      lines.push('');
      return lines.join('\n');
    }

    lines.push('✅ Git hooks are enabled');
    lines.push('');

    const preCommit = this.getPreCommitConfig();
    lines.push('Pre-commit Checks:');
    lines.push('------------------');

    for (const [checkName, checkConfig] of Object.entries(
      preCommit.checks || {}
    )) {
      const enabled = this.isCheckEnabled(checkName);
      const status = enabled ? '✅' : '❌';
      const bypassVar = this.getBypassVariable(checkName);

      lines.push(`${status} ${checkName}`);
      if (enabled && checkConfig.block_on_errors) {
        lines.push(`   Blocks commits on errors`);
      }
      if (bypassVar) {
        lines.push(`   Bypass with: ${bypassVar}=true`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Show configuration help
   */
  static showHelp() {
    console.log(`
Git Hooks Configuration
=======================

Configuration is loaded from supernal.yaml in your project root.

Example configuration:

git_hooks:
  enabled: true
  pre_commit:
    enabled: true
    checks:
      branch_naming:
        enabled: true
        skip_for_protected_branches: true
      requirement_metadata:
        enabled: true
        update_git_tracking: true
      date_validation:
        enabled: true
        block_on_errors: true
        allow_bypass: true
      documentation_validation:
        enabled: true
        block_on_errors: true
        allow_bypass: true
      markdown_links:
        enabled: true
        block_on_errors: true
        allow_bypass: true
      type_duplications:
        enabled: false
        block_on_errors: false

Environment Variables (Bypass):
  SC_SKIP_HOOKS=true              Disable all hooks
  SC_SKIP_DATE_VALIDATION=true    Skip date validation
  SC_SKIP_DOC_VALIDATION=true     Skip documentation validation

Commands:
  sc git-hooks show-config         Show current configuration
  sc git-hooks install             Install hooks with config
  sc git-hooks status              Show hook status

Documentation:
  See docs/guides/git-hooks-configuration.md
`);
  }
}

module.exports = HookConfigLoader;
