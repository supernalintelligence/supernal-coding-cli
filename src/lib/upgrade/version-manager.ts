/**
 * Version Manager - Track SC template versions and manage upgrades
 */

const fs = require('fs-extra');
const path = require('node:path');
const semver = require('semver');

class VersionManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.scDir = path.join(projectRoot, '.supernal-coding');
    this.versionFile = path.join(this.scDir, 'version.json');
  }

  /**
   * Initialize version tracking
   */
  async initialize(scVersion) {
    await fs.ensureDir(this.scDir);

    const versionData = {
      scVersion: scVersion || (await this.getPackageVersion()),
      templateVersion: scVersion || (await this.getPackageVersion()),
      installedDate: new Date().toISOString(),
      lastUpgrade: null,
      components: {
        rules: scVersion || (await this.getPackageVersion()),
        templates: scVersion || (await this.getPackageVersion()),
        workflows: scVersion || (await this.getPackageVersion()),
        'git-hooks': scVersion || (await this.getPackageVersion())
      }
    };

    await fs.writeJson(this.versionFile, versionData, { spaces: 2 });
    return versionData;
  }

  /**
   * Get current version information
   */
  async getCurrentVersion() {
    if (!(await fs.pathExists(this.versionFile))) {
      // Not tracked yet - try to infer from package
      return await this.initialize();
    }

    return await fs.readJson(this.versionFile);
  }

  /**
   * Get latest available version from package registry
   */
  async getLatestVersion() {
    try {
      // Try to get from local package.json first
      const packageVersion = await this.getPackageVersion();

      // TODO: Implement actual npm registry check
      // For now, return local package version
      return {
        version: packageVersion,
        releaseDate: null,
        changelog: null
      };
    } catch (error) {
      throw new Error(`Failed to get latest version: ${error.message}`);
    }
  }

  /**
   * Get version from SC package.json
   */
  async getPackageVersion() {
    try {
      const packagePath = path.join(__dirname, '../../package.json');
      const pkg = await fs.readJson(packagePath);
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check if upgrade is available
   */
  async checkUpgrade() {
    const current = await this.getCurrentVersion();
    const latest = await this.getLatestVersion();

    const hasUpgrade =
      semver.valid(current.scVersion) &&
      semver.valid(latest.version) &&
      semver.gt(latest.version, current.scVersion);

    return {
      hasUpgrade,
      current: current.scVersion,
      latest: latest.version,
      type: this.getUpgradeType(current.scVersion, latest.version)
    };
  }

  /**
   * Determine upgrade type (major, minor, patch)
   */
  getUpgradeType(current, latest) {
    if (!semver.valid(current) || !semver.valid(latest)) {
      return 'unknown';
    }

    const diff = semver.diff(current, latest);
    return diff; // 'major', 'minor', 'patch', etc.
  }

  /**
   * Record successful upgrade
   */
  async recordUpgrade(newVersion, components = null) {
    const data = await this.getCurrentVersion();

    data.scVersion = newVersion;
    data.templateVersion = newVersion;
    data.lastUpgrade = new Date().toISOString();

    if (components) {
      // Update specific components
      Object.assign(data.components, components);
    } else {
      // Update all components to new version
      Object.keys(data.components).forEach((key) => {
        data.components[key] = newVersion;
      });
    }

    await fs.writeJson(this.versionFile, data, { spaces: 2 });
    await this.addUpgradeToHistory(newVersion);

    return data;
  }

  /**
   * Add upgrade to history
   */
  async addUpgradeToHistory(newVersion) {
    const historyFile = path.join(this.scDir, 'upgrade-history.json');
    let history = [];

    if (await fs.pathExists(historyFile)) {
      history = await fs.readJson(historyFile);
    }

    history.push({
      version: newVersion,
      timestamp: new Date().toISOString(),
      type: 'upgrade'
    });

    // Keep last 50 entries
    if (history.length > 50) {
      history = history.slice(-50);
    }

    await fs.writeJson(historyFile, history, { spaces: 2 });
  }

  /**
   * Get upgrade history
   */
  async getUpgradeHistory() {
    const historyFile = path.join(this.scDir, 'upgrade-history.json');

    if (!(await fs.pathExists(historyFile))) {
      return [];
    }

    return await fs.readJson(historyFile);
  }

  /**
   * Rollback version (used after restore)
   */
  async rollbackVersion(previousVersion) {
    const data = await this.getCurrentVersion();

    data.scVersion = previousVersion;
    data.templateVersion = previousVersion;

    await fs.writeJson(this.versionFile, data, { spaces: 2 });

    const historyFile = path.join(this.scDir, 'upgrade-history.json');
    let history = [];

    if (await fs.pathExists(historyFile)) {
      history = await fs.readJson(historyFile);
    }

    history.push({
      version: previousVersion,
      timestamp: new Date().toISOString(),
      type: 'rollback'
    });

    await fs.writeJson(historyFile, history, { spaces: 2 });
  }

  /**
   * Get version comparison summary
   */
  async getVersionSummary() {
    const current = await this.getCurrentVersion();
    const latest = await this.getLatestVersion();
    const upgradeCheck = await this.checkUpgrade();

    return {
      current: {
        version: current.scVersion,
        installedDate: current.installedDate,
        lastUpgrade: current.lastUpgrade,
        components: current.components
      },
      latest: {
        version: latest.version,
        releaseDate: latest.releaseDate
      },
      upgrade: upgradeCheck
    };
  }
}

module.exports = VersionManager;
