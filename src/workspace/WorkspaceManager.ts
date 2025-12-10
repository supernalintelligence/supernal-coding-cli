import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'yaml';

interface WorkspaceConfig {
  workspace: {
    name: string;
    version: string;
    type: string;
    description: string;
    created: string;
    updated: string;
  };
  repos: RepoInfo[];
  coordination: {
    cross_repo_handoffs_dir: string;
    dependencies_dir: string;
    blockers_tracking: string;
    dashboard_url: string | null;
  };
}

interface RepoInfo {
  name: string;
  path: string;
  type: string;
  primary_language?: string;
  github?: string | null;
  related_requirements?: string[];
  blocked_by?: string[];
}

interface RepoConfig {
  project?: {
    type?: string;
    primary_language?: string;
  };
  github?: string;
  workspace?: {
    enabled?: boolean;
    parent_path?: string;
    repo_name?: string;
    sync_handoffs?: boolean;
    check_dependencies?: boolean;
  };
}

interface InitOptions {
  name: string;
  type?: string;
  description?: string;
}

interface LinkOptions {
  parent: string;
}

interface StatusOptions {
  json?: boolean;
}

interface InitResult {
  success: boolean;
  workspace: string;
  message: string;
  structure: {
    workspace: string;
    handoffs: string;
    dependencies: string;
  };
}

interface LinkResult {
  success: boolean;
  workspace: string;
  repo: string;
  message: string;
}

interface UnlinkResult {
  success: boolean;
  repo: string;
  message: string;
}

interface RepoStatus {
  name: string;
  path: string;
  exists: boolean;
  type: string;
  active_handoffs?: number;
  blocked_by?: string[];
}

interface StatusResult {
  workspace: string;
  type: string;
  repos: RepoStatus[];
  total_repos: number;
  existing_repos: number;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
  message?: string;
}

class WorkspaceManager {
  protected crossRepoDir: string;
  protected dependenciesDir: string;
  protected handoffsDir: string;
  protected workspaceDir: string;
  protected workspaceFile: string;

  constructor(workspaceDir = '.supernal') {
    this.workspaceDir = workspaceDir;
    this.workspaceFile = path.join(workspaceDir, 'workspace.yaml');
    this.crossRepoDir = path.join(workspaceDir, 'cross-repo');
    this.handoffsDir = path.join(this.crossRepoDir, 'handoffs');
    this.dependenciesDir = path.join(this.crossRepoDir, 'dependencies');
  }

  async init(options: InitOptions): Promise<InitResult> {
    const { name, type = 'multi-repo', description } = options;

    if (!name) {
      throw new Error('Workspace name is required');
    }

    if (await fs.pathExists(this.workspaceFile)) {
      throw new Error(`Workspace already initialized at ${this.workspaceFile}`);
    }

    await fs.ensureDir(this.workspaceDir);
    await fs.ensureDir(this.handoffsDir);
    await fs.ensureDir(this.dependenciesDir);

    const workspace: WorkspaceConfig = {
      workspace: {
        name,
        version: '1.0',
        type,
        description: description || `Multi-repo workspace for ${name}`,
        created: new Date().toISOString().split('T')[0],
        updated: new Date().toISOString().split('T')[0]
      },
      repos: [],
      coordination: {
        cross_repo_handoffs_dir: '.supernal/cross-repo/handoffs',
        dependencies_dir: '.supernal/cross-repo/dependencies',
        blockers_tracking: 'enabled',
        dashboard_url: null
      }
    };

    await fs.writeFile(this.workspaceFile, yaml.stringify(workspace), 'utf8');

    await this.createWorkspaceReadme(name);

    return {
      success: true,
      workspace: this.workspaceFile,
      message: `Workspace "${name}" initialized`,
      structure: {
        workspace: this.workspaceFile,
        handoffs: this.handoffsDir,
        dependencies: this.dependenciesDir
      }
    };
  }

  async createWorkspaceReadme(name: string): Promise<void> {
    const readme = `# ${name} Workspace

This is a Supernal Coding multi-repo workspace.

## Structure

\`\`\`
${name}/
├── .supernal/
│   ├── workspace.yaml        # Workspace configuration
│   └── cross-repo/
│       ├── handoffs/         # Cross-repo handoffs
│       └── dependencies/     # Dependency tracking
└── [repos]/                  # Individual repositories
\`\`\`

## Usage

### Add Repository to Workspace

\`\`\`bash
cd your-repo
sc workspace link --parent=../${name}
\`\`\`

### View Workspace Status

\`\`\`bash
cd ${name}
sc workspace status
\`\`\`

### Find Blockers

\`\`\`bash
sc workspace blockers
\`\`\`

## Documentation

- [Multi-Repo Coordination](docs/features/workflow-management/multi-repo-coordination/)
- [Agent Handoffs](docs/workflow/user-guides/agent-handoffs.md)
`;

    await fs.writeFile(
      path.join(this.workspaceDir, 'README.md'),
      readme,
      'utf8'
    );
  }

  async link(options: LinkOptions): Promise<LinkResult> {
    const { parent } = options;

    if (!parent) {
      throw new Error('Parent workspace path is required');
    }

    const workspacePath = path.resolve(parent, '.supernal', 'workspace.yaml');
    if (!(await fs.pathExists(workspacePath))) {
      throw new Error(
        `No workspace found at ${parent}/.supernal/workspace.yaml`
      );
    }

    const workspaceContent = await fs.readFile(workspacePath, 'utf8');
    const workspace: WorkspaceConfig = yaml.parse(workspaceContent);

    const repoPath = process.cwd();
    const repoName = path.basename(repoPath);

    const configPath = '.supernal/config.yaml';
    if (!(await fs.pathExists(configPath))) {
      throw new Error(
        'This repo is not initialized with Supernal Coding. Run: sc init'
      );
    }

    const configContent = await fs.readFile(configPath, 'utf8');
    const config: RepoConfig = yaml.parse(configContent);

    config.workspace = {
      enabled: true,
      parent_path: parent,
      repo_name: repoName,
      sync_handoffs: true,
      check_dependencies: true
    };

    await fs.writeFile(configPath, yaml.stringify(config), 'utf8');

    const existingRepo = workspace.repos.find((r) => r.name === repoName);
    if (!existingRepo) {
      workspace.repos.push({
        name: repoName,
        path: `./${repoName}`,
        type: config.project?.type || 'library',
        primary_language: config.project?.primary_language || 'unknown',
        github: config.github || null,
        related_requirements: [],
        blocked_by: []
      });

      workspace.workspace.updated = new Date().toISOString().split('T')[0];

      await fs.writeFile(workspacePath, yaml.stringify(workspace), 'utf8');
    }

    return {
      success: true,
      workspace: workspacePath,
      repo: repoName,
      message: `Linked ${repoName} to workspace ${workspace.workspace.name}`
    };
  }

  async unlink(): Promise<UnlinkResult> {
    const configPath = '.supernal/config.yaml';
    if (!(await fs.pathExists(configPath))) {
      throw new Error('No Supernal Coding config found');
    }

    const configContent = await fs.readFile(configPath, 'utf8');
    const config: RepoConfig = yaml.parse(configContent);

    if (!config.workspace?.enabled) {
      throw new Error('This repo is not linked to a workspace');
    }

    const parentPath = config.workspace.parent_path!;
    const repoName = config.workspace.repo_name!;

    delete config.workspace;
    await fs.writeFile(configPath, yaml.stringify(config), 'utf8');

    const workspacePath = path.resolve(
      parentPath,
      '.supernal',
      'workspace.yaml'
    );
    if (await fs.pathExists(workspacePath)) {
      const workspaceContent = await fs.readFile(workspacePath, 'utf8');
      const workspace: WorkspaceConfig = yaml.parse(workspaceContent);

      workspace.repos = workspace.repos.filter((r) => r.name !== repoName);
      workspace.workspace.updated = new Date().toISOString().split('T')[0];

      await fs.writeFile(workspacePath, yaml.stringify(workspace), 'utf8');
    }

    return {
      success: true,
      repo: repoName,
      message: `Unlinked ${repoName} from workspace`
    };
  }

  async status(options: StatusOptions = {}): Promise<StatusResult> {
    const { json: _json = false } = options;

    if (!(await fs.pathExists(this.workspaceFile))) {
      throw new Error('No workspace found in current directory');
    }

    const workspaceContent = await fs.readFile(this.workspaceFile, 'utf8');
    const workspace: WorkspaceConfig = yaml.parse(workspaceContent);

    const repos: RepoStatus[] = [];
    for (const repo of workspace.repos) {
      const repoPath = path.resolve(repo.path);
      const exists = await fs.pathExists(repoPath);

      if (exists) {
        const handoffsPath = path.join(repoPath, 'docs/handoffs');
        let activeHandoffs = 0;
        if (await fs.pathExists(handoffsPath)) {
          const files = await fs.readdir(handoffsPath);
          activeHandoffs = files.filter((f) => f.endsWith('.md')).length;
        }

        repos.push({
          name: repo.name,
          path: repo.path,
          exists: true,
          type: repo.type,
          active_handoffs: activeHandoffs,
          blocked_by: repo.blocked_by || []
        });
      } else {
        repos.push({
          name: repo.name,
          path: repo.path,
          exists: false,
          type: repo.type
        });
      }
    }

    const result: StatusResult = {
      workspace: workspace.workspace.name,
      type: workspace.workspace.type,
      repos,
      total_repos: repos.length,
      existing_repos: repos.filter((r) => r.exists).length
    };

    return result;
  }

  async loadWorkspace(): Promise<WorkspaceConfig> {
    if (!(await fs.pathExists(this.workspaceFile))) {
      throw new Error('No workspace found');
    }

    const content = await fs.readFile(this.workspaceFile, 'utf8');
    return yaml.parse(content);
  }

  async validate(): Promise<ValidationResult> {
    if (!(await fs.pathExists(this.workspaceFile))) {
      throw new Error('No workspace found');
    }

    const workspace = await this.loadWorkspace();
    const errors: string[] = [];

    if (!workspace.workspace?.name) {
      errors.push('workspace.name is required');
    }

    if (!Array.isArray(workspace.repos)) {
      errors.push('repos must be an array');
    } else {
      for (const repo of workspace.repos) {
        if (!repo.name) {
          errors.push(`Repo missing name: ${JSON.stringify(repo)}`);
        }
        if (!repo.path) {
          errors.push(`Repo ${repo.name} missing path`);
        }
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors
      };
    }

    return {
      valid: true,
      message: 'Workspace configuration is valid'
    };
  }
}

export default WorkspaceManager;
module.exports = WorkspaceManager;
