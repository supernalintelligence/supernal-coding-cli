/**
 * Version Manager - Track SC template versions and manage upgrades
 */

import fs from 'fs-extra';
import path from 'node:path';
import semver from 'semver';

export interface ComponentVersions {
  rules: string;
  templates: string;
  workflows: string;
  'git-hooks': string;
  [key: string]: string;
}

export interface VersionData {
  scVersion: string;
  templateVersion: string;
  installedDate: string;
  lastUpgrade: string | null;
  components: ComponentVersions;
}

export interface LatestVersionInfo {
  version: string;
  releaseDate: string | null;
  changelog: string | null;
}

export interface UpgradeCheckResult {
  hasUpgrade: boolean;
  current: string;
  latest: string;
  type: string | null;
}

export interface UpgradeHistoryEntry {
  version: string;
  timestamp: string;
  type: 'upgrade' | 'rollback';
}

export interface VersionSummary {
  current: {
    version: string;
    installedDate: string;
    lastUpgrade: string | null;
    components: ComponentVersions;
  };
  latest: {
    version: string;
    releaseDate: string | null;
  };
  upgrade: UpgradeCheckResult;
}

class VersionManager {
  protected projectRoot: string;
  protected scDir: string;
  protected versionFile: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.scDir = path.join(projectRoot, '.supernal-coding');
    this.versionFile = path.join(this.scDir, 'version.json');
  }

  async initialize(scVersion?: string): Promise<VersionData> {
    await fs.ensureDir(this.scDir);

    const version = scVersion || (await this.getPackageVersion());
    const versionData: VersionData = {
      scVersion: version,
      templateVersion: version,
      installedDate: new Date().toISOString(),
      lastUpgrade: null,
      components: {
        rules: version,
        templates: version,
        workflows: version,
        'git-hooks': version
      }
    };

    await fs.writeJson(this.versionFile, versionData, { spaces: 2 });
    return versionData;
  }

  async getCurrentVersion(): Promise<VersionData> {
    if (!(await fs.pathExists(this.versionFile))) {
      return await this.initialize();
    }

    return await fs.readJson(this.versionFile);
  }

  async getLatestVersion(): Promise<LatestVersionInfo> {
    try {
      const packageVersion = await this.getPackageVersion();

      return {
        version: packageVersion,
        releaseDate: null,
        changelog: null
      };
    } catch (error) {
      throw new Error(`Failed to get latest version: ${(error as Error).message}`);
    }
  }

  async getPackageVersion(): Promise<string> {
    try {
      const packagePath = path.join(__dirname, '../../package.json');
      const pkg = await fs.readJson(packagePath);
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }

  async checkUpgrade(): Promise<UpgradeCheckResult> {
    const current = await this.getCurrentVersion();
    const latest = await this.getLatestVersion();

    const hasUpgrade =
      !!semver.valid(current.scVersion) &&
      !!semver.valid(latest.version) &&
      semver.gt(latest.version, current.scVersion);

    return {
      hasUpgrade,
      current: current.scVersion,
      latest: latest.version,
      type: this.getUpgradeType(current.scVersion, latest.version)
    };
  }

  getUpgradeType(current: string, latest: string): string | null {
    if (!semver.valid(current) || !semver.valid(latest)) {
      return 'unknown';
    }

    const diff = semver.diff(current, latest);
    return diff;
  }

  async recordUpgrade(newVersion: string, components: Partial<ComponentVersions> | null = null): Promise<VersionData> {
    const data = await this.getCurrentVersion();

    data.scVersion = newVersion;
    data.templateVersion = newVersion;
    data.lastUpgrade = new Date().toISOString();

    if (components) {
      Object.assign(data.components, components);
    } else {
      Object.keys(data.components).forEach((key) => {
        data.components[key] = newVersion;
      });
    }

    await fs.writeJson(this.versionFile, data, { spaces: 2 });
    await this.addUpgradeToHistory(newVersion);

    return data;
  }

  async addUpgradeToHistory(newVersion: string): Promise<void> {
    const historyFile = path.join(this.scDir, 'upgrade-history.json');
    let history: UpgradeHistoryEntry[] = [];

    if (await fs.pathExists(historyFile)) {
      history = await fs.readJson(historyFile);
    }

    history.push({
      version: newVersion,
      timestamp: new Date().toISOString(),
      type: 'upgrade'
    });

    if (history.length > 50) {
      history = history.slice(-50);
    }

    await fs.writeJson(historyFile, history, { spaces: 2 });
  }

  async getUpgradeHistory(): Promise<UpgradeHistoryEntry[]> {
    const historyFile = path.join(this.scDir, 'upgrade-history.json');

    if (!(await fs.pathExists(historyFile))) {
      return [];
    }

    return await fs.readJson(historyFile);
  }

  async rollbackVersion(previousVersion: string): Promise<void> {
    const data = await this.getCurrentVersion();

    data.scVersion = previousVersion;
    data.templateVersion = previousVersion;

    await fs.writeJson(this.versionFile, data, { spaces: 2 });

    const historyFile = path.join(this.scDir, 'upgrade-history.json');
    let history: UpgradeHistoryEntry[] = [];

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

  async getVersionSummary(): Promise<VersionSummary> {
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

export default VersionManager;
module.exports = VersionManager;
