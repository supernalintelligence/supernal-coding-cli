/**
 * Auto-Commit Configuration Manager
 * Reads and manages auto-commit settings from supernal.yaml
 */

const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');

class AutoCommitConfig {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = null;
  }

  /**
   * Load configuration from supernal.yaml
   * @returns {Object} Auto-commit configuration
   */
  async load() {
    if (this.config) return this.config;

    const configPath = path.join(this.projectRoot, 'supernal.yaml');

    // Default configuration
    const defaults = {
      enabled: false,
      mode: 'suggest', // auto|prompt|suggest|off
      maxFiles: 10,
      maxSize: '1MB',
      commands: {}
    };

    try {
      if (await fs.pathExists(configPath)) {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        const fullConfig = yaml.load(fileContent);

        if (fullConfig?.autoCommit) {
          this.config = { ...defaults, ...fullConfig.autoCommit };
        } else {
          this.config = defaults;
        }
      } else {
        this.config = defaults;
      }
    } catch (error) {
      console.warn(
        `Warning: Could not load auto-commit config: ${error.message}`
      );
      this.config = defaults;
    }

    return this.config;
  }

  /**
   * Get mode for a specific command
   * @param {string} commandName - e.g., 'feature.validate', 'docs.process'
   * @returns {string} Mode: auto|prompt|suggest|off
   */
  async getModeForCommand(commandName) {
    const config = await this.load();

    // Check command-specific override
    if (config.commands?.[commandName]) {
      return config.commands[commandName];
    }

    // Check wildcard patterns
    if (config.commands) {
      const parts = commandName.split('.');
      for (let i = parts.length - 1; i >= 0; i--) {
        const pattern = `${parts.slice(0, i).join('.')}.*`;
        if (config.commands[pattern]) {
          return config.commands[pattern];
        }
      }
    }

    // Return global default
    return config.enabled ? config.mode : 'off';
  }

  /**
   * Check if auto-commit should happen for a command
   * @param {string} commandName - e.g., 'feature.validate'
   * @param {Object} options - CLI options (e.g., { commit: true, noCommit: false })
   * @returns {Promise<boolean>} Should auto-commit
   */
  async shouldAutoCommit(commandName, options = {}) {
    // CLI flag overrides
    if (options.commit === true) return true;
    if (options.noCommit === true) return false;

    // Check configuration
    const mode = await this.getModeForCommand(commandName);
    return mode === 'auto';
  }

  /**
   * Check if should prompt user for commit
   * @param {string} commandName
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  async shouldPrompt(commandName, options = {}) {
    if (options.commit || options.noCommit) return false;

    const mode = await this.getModeForCommand(commandName);
    return mode === 'prompt';
  }

  /**
   * Check if should suggest commit command
   * @param {string} commandName
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  async shouldSuggest(commandName, options = {}) {
    if (options.commit || options.noCommit) return false;

    const mode = await this.getModeForCommand(commandName);
    return mode === 'suggest';
  }

  /**
   * Get file size limit in bytes
   * @returns {Promise<number>}
   */
  async getMaxSize() {
    const config = await this.load();
    const sizeStr = config.maxSize || '1MB';

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB)?$/i);
    if (!match) return 1024 * 1024; // Default 1MB

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();

    const multipliers = {
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || multipliers.MB);
  }

  /**
   * Get max files limit
   * @returns {Promise<number>}
   */
  async getMaxFiles() {
    const config = await this.load();
    return config.maxFiles || 10;
  }

  /**
   * Save configuration to supernal.yaml
   * @param {Object} autoCommitConfig - New auto-commit config
   */
  async save(autoCommitConfig) {
    const configPath = path.join(this.projectRoot, 'supernal.yaml');

    let fullConfig = {};

    try {
      if (await fs.pathExists(configPath)) {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        fullConfig = yaml.load(fileContent) || {};
      }
    } catch (error) {
      console.warn(`Warning: Could not load existing config: ${error.message}`);
    }

    fullConfig.autoCommit = autoCommitConfig;

    const yamlStr = yaml.dump(fullConfig, {
      indent: 2,
      lineWidth: 100,
      noRefs: true
    });

    await fs.writeFile(configPath, yamlStr, 'utf-8');
    this.config = null; // Reset cache
  }

  /**
   * Set mode for a specific command
   * @param {string} commandName
   * @param {string} mode - auto|prompt|suggest|off
   */
  async setCommandMode(commandName, mode) {
    const config = await this.load();

    if (!config.commands) {
      config.commands = {};
    }

    config.commands[commandName] = mode;
    await this.save(config);
  }

  /**
   * Set global mode
   * @param {string} mode - auto|prompt|suggest|off
   */
  async setGlobalMode(mode) {
    const config = await this.load();
    config.enabled = mode !== 'off';
    config.mode = mode;
    await this.save(config);
  }
}

module.exports = AutoCommitConfig;
