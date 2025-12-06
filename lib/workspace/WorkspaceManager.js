#!/usr/bin/env node

/**
 * Multi-Repo Workspace Manager
 * Manages workspace initialization, repo linking, and coordination
 */

const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');

class WorkspaceManager {
  constructor(workspaceDir = '.supernal') {
    this.workspaceDir = workspaceDir;
    this.workspaceFile = path.join(workspaceDir, 'workspace.yaml');
    this.crossRepoDir = path.join(workspaceDir, 'cross-repo');
    this.handoffsDir = path.join(this.crossRepoDir, 'handoffs');
    this.dependenciesDir = path.join(this.crossRepoDir, 'dependencies');
  }

  /**
   * Initialize multi-repo workspace
   */
  async init(options) {
    const { name, type = 'multi-repo', description } = options;

    if (!name) {
      throw new Error('Workspace name is required');
    }

    // Check if already initialized
    if (await fs.pathExists(this.workspaceFile)) {
      throw new Error(`Workspace already initialized at ${this.workspaceFile}`);
    }

    // Create directory structure
    await fs.ensureDir(this.workspaceDir);
    await fs.ensureDir(this.handoffsDir);
    await fs.ensureDir(this.dependenciesDir);

    // Create workspace.yaml
    const workspace = {
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

    await fs.writeFile(this.workspaceFile, yaml.dump(workspace), 'utf8');

    // Create README
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

  /**
   * Create workspace README
   */
  async createWorkspaceReadme(name) {
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

  /**
   * Link repo to workspace
   */
  async link(options) {
    const { parent } = options;

    if (!parent) {
      throw new Error('Parent workspace path is required');
    }

    // Find workspace.yaml in parent
    const workspacePath = path.resolve(parent, '.supernal', 'workspace.yaml');
    if (!(await fs.pathExists(workspacePath))) {
      throw new Error(
        `No workspace found at ${parent}/.supernal/workspace.yaml`
      );
    }

    // Load workspace config
    const workspaceContent = await fs.readFile(workspacePath, 'utf8');
    const workspace = yaml.load(workspaceContent);

    // Get current repo info
    const repoPath = process.cwd();
    const repoName = path.basename(repoPath);

    // Check if repo has Supernal Coding initialized
    const configPath = '.supernal/config.yaml';
    if (!(await fs.pathExists(configPath))) {
      throw new Error(
        'This repo is not initialized with Supernal Coding. Run: sc init'
      );
    }

    // Load repo config
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configContent);

    // Update repo config with workspace link
    config.workspace = {
      enabled: true,
      parent_path: parent,
      repo_name: repoName,
      sync_handoffs: true,
      check_dependencies: true
    };

    await fs.writeFile(configPath, yaml.dump(config), 'utf8');

    // Register repo in workspace
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

      await fs.writeFile(workspacePath, yaml.dump(workspace), 'utf8');
    }

    return {
      success: true,
      workspace: workspacePath,
      repo: repoName,
      message: `Linked ${repoName} to workspace ${workspace.workspace.name}`
    };
  }

  /**
   * Unlink repo from workspace
   */
  async unlink() {
    const configPath = '.supernal/config.yaml';
    if (!(await fs.pathExists(configPath))) {
      throw new Error('No Supernal Coding config found');
    }

    const configContent = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configContent);

    if (!config.workspace?.enabled) {
      throw new Error('This repo is not linked to a workspace');
    }

    const parentPath = config.workspace.parent_path;
    const repoName = config.workspace.repo_name;

    // Remove workspace config from repo
    delete config.workspace;
    await fs.writeFile(configPath, yaml.dump(config), 'utf8');

    // Remove repo from workspace
    const workspacePath = path.resolve(
      parentPath,
      '.supernal',
      'workspace.yaml'
    );
    if (await fs.pathExists(workspacePath)) {
      const workspaceContent = await fs.readFile(workspacePath, 'utf8');
      const workspace = yaml.load(workspaceContent);

      workspace.repos = workspace.repos.filter((r) => r.name !== repoName);
      workspace.workspace.updated = new Date().toISOString().split('T')[0];

      await fs.writeFile(workspacePath, yaml.dump(workspace), 'utf8');
    }

    return {
      success: true,
      repo: repoName,
      message: `Unlinked ${repoName} from workspace`
    };
  }

  /**
   * Get workspace status
   */
  async status(options = {}) {
    const { json = false } = options;

    if (!(await fs.pathExists(this.workspaceFile))) {
      throw new Error('No workspace found in current directory');
    }

    const workspaceContent = await fs.readFile(this.workspaceFile, 'utf8');
    const workspace = yaml.load(workspaceContent);

    const repos = [];
    for (const repo of workspace.repos) {
      const repoPath = path.resolve(repo.path);
      const exists = await fs.pathExists(repoPath);

      if (exists) {
        // Count handoffs
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

    const result = {
      workspace: workspace.workspace.name,
      type: workspace.workspace.type,
      repos,
      total_repos: repos.length,
      existing_repos: repos.filter((r) => r.exists).length
    };

    if (json) {
      return result;
    }

    return result;
  }

  /**
   * Load workspace config
   */
  async loadWorkspace() {
    if (!(await fs.pathExists(this.workspaceFile))) {
      throw new Error('No workspace found');
    }

    const content = await fs.readFile(this.workspaceFile, 'utf8');
    return yaml.load(content);
  }

  /**
   * Validate workspace
   */
  async validate() {
    if (!(await fs.pathExists(this.workspaceFile))) {
      throw new Error('No workspace found');
    }

    const workspace = await this.loadWorkspace();
    const errors = [];

    // Check required fields
    if (!workspace.workspace?.name) {
      errors.push('workspace.name is required');
    }

    // Check repos
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

module.exports = WorkspaceManager;
