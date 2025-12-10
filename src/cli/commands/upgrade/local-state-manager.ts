import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'yaml';

interface LocalState {
  version: string;
  installedAt: string;
  lastUpgrade: string | null;
  lastCheck: string | null;
  components: Record<string, string>;
  customizations: string[];
  upgradeHistory: Array<{
    from: string;
    to: string;
    timestamp: string;
    components: string[];
  }>;
}

/**
 * LocalStateManager - Manages local SC installation state
 */
class LocalStateManager {
  protected projectRoot: string;
  protected stateFile: string;
  protected state: LocalState | null;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || this.findProjectRoot();
    this.stateFile = path.join(
      this.projectRoot,
      '.supernal',
      'local-state.yaml'
    );
    this.state = null;
  }

  private findProjectRoot(): string {
    let current = process.cwd();

    while (current !== path.dirname(current)) {
      if (
        fs.existsSync(path.join(current, 'supernal.yaml')) ||
        fs.existsSync(path.join(current, '.supernal'))
      ) {
        return current;
      }
      current = path.dirname(current);
    }

    return process.cwd();
  }

  /**
   * Load state from file
   */
  async load(): Promise<LocalState> {
    if (this.state) {
      return this.state;
    }

    try {
      if (await fs.pathExists(this.stateFile)) {
        const content = await fs.readFile(this.stateFile, 'utf-8');
        this.state = yaml.parse(content);
        return this.state!;
      }
    } catch {
      // Ignore errors, return default
    }

    // Return default state
    this.state = {
      version: '0.0.0',
      installedAt: new Date().toISOString(),
      lastUpgrade: null,
      lastCheck: null,
      components: {},
      customizations: [],
      upgradeHistory: []
    };

    return this.state;
  }

  /**
   * Save state to file
   */
  async save(): Promise<void> {
    if (!this.state) {
      return;
    }

    await fs.ensureDir(path.dirname(this.stateFile));
    await fs.writeFile(this.stateFile, yaml.stringify(this.state));
  }

  /**
   * Get current version
   */
  async getVersion(): Promise<string> {
    const state = await this.load();
    return state.version;
  }

  /**
   * Set version
   */
  async setVersion(version: string): Promise<void> {
    const state = await this.load();
    state.version = version;
    await this.save();
  }

  /**
   * Get component version
   */
  async getComponentVersion(component: string): Promise<string | null> {
    const state = await this.load();
    return state.components[component] || null;
  }

  /**
   * Set component version
   */
  async setComponentVersion(component: string, version: string): Promise<void> {
    const state = await this.load();
    state.components[component] = version;
    await this.save();
  }

  /**
   * Get all component versions
   */
  async getComponents(): Promise<Record<string, string>> {
    const state = await this.load();
    return { ...state.components };
  }

  /**
   * Record an upgrade
   */
  async recordUpgrade(
    fromVersion: string,
    toVersion: string,
    components: string[]
  ): Promise<void> {
    const state = await this.load();

    state.upgradeHistory.push({
      from: fromVersion,
      to: toVersion,
      timestamp: new Date().toISOString(),
      components
    });

    state.version = toVersion;
    state.lastUpgrade = new Date().toISOString();

    // Keep only last 20 upgrades
    if (state.upgradeHistory.length > 20) {
      state.upgradeHistory = state.upgradeHistory.slice(-20);
    }

    await this.save();
  }

  /**
   * Get upgrade history
   */
  async getUpgradeHistory(): Promise<LocalState['upgradeHistory']> {
    const state = await this.load();
    return [...state.upgradeHistory];
  }

  /**
   * Record customization
   */
  async addCustomization(filePath: string): Promise<void> {
    const state = await this.load();

    if (!state.customizations.includes(filePath)) {
      state.customizations.push(filePath);
      await this.save();
    }
  }

  /**
   * Remove customization
   */
  async removeCustomization(filePath: string): Promise<void> {
    const state = await this.load();

    const index = state.customizations.indexOf(filePath);
    if (index !== -1) {
      state.customizations.splice(index, 1);
      await this.save();
    }
  }

  /**
   * Get customizations
   */
  async getCustomizations(): Promise<string[]> {
    const state = await this.load();
    return [...state.customizations];
  }

  /**
   * Check if file is customized
   */
  async isCustomized(filePath: string): Promise<boolean> {
    const state = await this.load();
    return state.customizations.includes(filePath);
  }

  /**
   * Record version check
   */
  async recordCheck(): Promise<void> {
    const state = await this.load();
    state.lastCheck = new Date().toISOString();
    await this.save();
  }

  /**
   * Get last check time
   */
  async getLastCheck(): Promise<string | null> {
    const state = await this.load();
    return state.lastCheck;
  }

  /**
   * Should check for updates
   */
  async shouldCheckForUpdates(intervalHours = 24): Promise<boolean> {
    const lastCheck = await this.getLastCheck();

    if (!lastCheck) {
      return true;
    }

    const lastCheckDate = new Date(lastCheck);
    const now = new Date();
    const hoursSinceCheck =
      (now.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60);

    return hoursSinceCheck >= intervalHours;
  }

  /**
   * Reset state
   */
  async reset(): Promise<void> {
    this.state = {
      version: '0.0.0',
      installedAt: new Date().toISOString(),
      lastUpgrade: null,
      lastCheck: null,
      components: {},
      customizations: [],
      upgradeHistory: []
    };
    await this.save();
  }
}

export default LocalStateManager;
export { LocalStateManager };
export type { LocalState };
module.exports = LocalStateManager;
