/**
 * Auto-Commit Configuration Manager
 * Reads and manages auto-commit settings from supernal.yaml
 */

import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'js-yaml';

type CommitMode = 'auto' | 'prompt' | 'suggest' | 'off';

interface AutoCommitSettings {
  enabled: boolean;
  mode: CommitMode;
  maxFiles: number;
  maxSize: string;
  commands: Record<string, CommitMode>;
}

interface CommitOptions {
  commit?: boolean;
  noCommit?: boolean;
}

class AutoCommitConfig {
  protected projectRoot: string;
  protected config: AutoCommitSettings | null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = null;
  }

  async load(): Promise<AutoCommitSettings> {
    if (this.config) return this.config;

    const configPath = path.join(this.projectRoot, 'supernal.yaml');

    const defaults: AutoCommitSettings = {
      enabled: false,
      mode: 'suggest',
      maxFiles: 10,
      maxSize: '1MB',
      commands: {}
    };

    try {
      if (await fs.pathExists(configPath)) {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        const fullConfig = yaml.load(fileContent) as { autoCommit?: Partial<AutoCommitSettings> };

        if (fullConfig?.autoCommit) {
          this.config = { ...defaults, ...fullConfig.autoCommit } as AutoCommitSettings;
        } else {
          this.config = defaults;
        }
      } else {
        this.config = defaults;
      }
    } catch (error) {
      console.warn(
        `Warning: Could not load auto-commit config: ${(error as Error).message}`
      );
      this.config = defaults;
    }

    return this.config;
  }

  async getModeForCommand(commandName: string): Promise<CommitMode> {
    const config = await this.load();

    if (config.commands?.[commandName]) {
      return config.commands[commandName];
    }

    if (config.commands) {
      const parts = commandName.split('.');
      for (let i = parts.length - 1; i >= 0; i--) {
        const pattern = `${parts.slice(0, i).join('.')}.*`;
        if (config.commands[pattern]) {
          return config.commands[pattern];
        }
      }
    }

    return config.enabled ? config.mode : 'off';
  }

  async shouldAutoCommit(commandName: string, options: CommitOptions = {}): Promise<boolean> {
    if (options.commit === true) return true;
    if (options.noCommit === true) return false;

    const mode = await this.getModeForCommand(commandName);
    return mode === 'auto';
  }

  async shouldPrompt(commandName: string, options: CommitOptions = {}): Promise<boolean> {
    if (options.commit || options.noCommit) return false;

    const mode = await this.getModeForCommand(commandName);
    return mode === 'prompt';
  }

  async shouldSuggest(commandName: string, options: CommitOptions = {}): Promise<boolean> {
    if (options.commit || options.noCommit) return false;

    const mode = await this.getModeForCommand(commandName);
    return mode === 'suggest';
  }

  async getMaxSize(): Promise<number> {
    const config = await this.load();
    const sizeStr = config.maxSize || '1MB';

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB)?$/i);
    if (!match) return 1024 * 1024;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();

    const multipliers: Record<string, number> = {
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || multipliers.MB);
  }

  async getMaxFiles(): Promise<number> {
    const config = await this.load();
    return config.maxFiles || 10;
  }

  async save(autoCommitConfig: AutoCommitSettings): Promise<void> {
    const configPath = path.join(this.projectRoot, 'supernal.yaml');

    let fullConfig: Record<string, unknown> = {};

    try {
      if (await fs.pathExists(configPath)) {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        fullConfig = (yaml.load(fileContent) as Record<string, unknown>) || {};
      }
    } catch (error) {
      console.warn(`Warning: Could not load existing config: ${(error as Error).message}`);
    }

    fullConfig.autoCommit = autoCommitConfig;

    const yamlStr = yaml.dump(fullConfig, {
      indent: 2,
      lineWidth: 100,
      noRefs: true
    });

    await fs.writeFile(configPath, yamlStr, 'utf-8');
    this.config = null;
  }

  async setCommandMode(commandName: string, mode: CommitMode): Promise<void> {
    const config = await this.load();

    if (!config.commands) {
      config.commands = {};
    }

    config.commands[commandName] = mode;
    await this.save(config);
  }

  async setGlobalMode(mode: CommitMode): Promise<void> {
    const config = await this.load();
    config.enabled = mode !== 'off';
    config.mode = mode;
    await this.save(config);
  }
}

export default AutoCommitConfig;
module.exports = AutoCommitConfig;
