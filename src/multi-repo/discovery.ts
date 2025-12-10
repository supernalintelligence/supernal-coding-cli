import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
const { ConfigLoader } = require('../config');

interface RepoConfig {
  workflow?: {
    name?: string;
    defaults?: string;
  };
  [key: string]: unknown;
}

interface DiscoveredRepo {
  id: string;
  path: string;
  config: RepoConfig | null;
  workflow: string | null;
  currentPhase: string | null;
  hasConfig: boolean;
}

interface DiscoverOptions {
  maxDepth?: number;
  exclude?: string[];
}

interface WorkflowState {
  currentPhase?: string;
}

class RepoDiscovery {
  protected configLoader: InstanceType<typeof ConfigLoader>;
  protected discovered: Map<string, DiscoveredRepo>;

  constructor() {
    this.configLoader = new ConfigLoader();
    this.discovered = new Map();
  }

  async discover(rootPath: string, options: DiscoverOptions = {}): Promise<DiscoveredRepo[]> {
    const {
      maxDepth = 10,
      exclude = ['node_modules', '.git', 'dist', 'build']
    } = options;

    this.discovered.clear();

    await this.scanDirectory(rootPath, 0, maxDepth, exclude);

    return Array.from(this.discovered.values());
  }

  private async scanDirectory(
    dirPath: string,
    currentDepth: number,
    maxDepth: number,
    exclude: string[]
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

    try {
      if (await this.isValidRepo(dirPath)) {
        await this.addRepo(dirPath);
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (exclude.includes(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.supernal') continue;

        const subPath = path.join(dirPath, entry.name);
        await this.scanDirectory(subPath, currentDepth + 1, maxDepth, exclude);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EACCES' && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async isValidRepo(repoPath: string): Promise<boolean> {
    try {
      const supernalPath = path.join(repoPath, '.supernal');
      const stat = await fs.stat(supernalPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async addRepo(repoPath: string): Promise<void> {
    try {
      const repoId = this.generateRepoId(repoPath);

      const configFile = path.join(repoPath, '.supernal', 'project.yaml');
      let config: RepoConfig | null = null;
      let workflow: string | null = null;
      let currentPhase: string | null = null;

      try {
        config = await this.configLoader.load(configFile);
        workflow = config?.workflow?.name || config?.workflow?.defaults || null;

        const stateFile = path.join(
          repoPath,
          '.supernal',
          'workflow-state.yaml'
        );
        try {
          const stateContent = await fs.readFile(stateFile, 'utf8');
          const state: WorkflowState = yaml.parse(stateContent);
          currentPhase = state.currentPhase || null;
        } catch {
          // No state file - that's ok
        }
      } catch {
        // No config or invalid - still add repo
      }

      const repo: DiscoveredRepo = {
        id: repoId,
        path: repoPath,
        config,
        workflow,
        currentPhase,
        hasConfig: config !== null
      };

      this.discovered.set(repoId, repo);
    } catch (_error) {
      // Skip repos we can't process
    }
  }

  private generateRepoId(repoPath: string): string {
    const cwd = process.cwd();
    let id = repoPath;

    if (repoPath.startsWith(cwd)) {
      id = repoPath.slice(cwd.length + 1);
    }

    return id.replace(/[/\\]/g, '-').replace(/^-+|-+$/g, '') || 'root';
  }

  listRepos(): DiscoveredRepo[] {
    return Array.from(this.discovered.values());
  }

  getRepo(repoId: string): DiscoveredRepo | null {
    return this.discovered.get(repoId) || null;
  }

  getRepoByPath(repoPath: string): DiscoveredRepo | null {
    for (const repo of this.discovered.values()) {
      if (repo.path === repoPath) {
        return repo;
      }
    }
    return null;
  }

  getReposByWorkflow(workflowName: string): DiscoveredRepo[] {
    return this.listRepos().filter((r) => r.workflow === workflowName);
  }

  getReposByPhase(phaseId: string): DiscoveredRepo[] {
    return this.listRepos().filter((r) => r.currentPhase === phaseId);
  }

  getConfiguredRepos(): DiscoveredRepo[] {
    return this.listRepos().filter((r) => r.hasConfig);
  }

  getUnconfiguredRepos(): DiscoveredRepo[] {
    return this.listRepos().filter((r) => !r.hasConfig);
  }

  getRepoCount(): number {
    return this.discovered.size;
  }

  clear(): void {
    this.discovered.clear();
  }
}

export { RepoDiscovery };
module.exports = { RepoDiscovery };
