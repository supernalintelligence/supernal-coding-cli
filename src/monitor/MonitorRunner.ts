import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'node:child_process';

interface MonitorConfig {
  monitor?: {
    pollInterval?: number;
    repos?: Array<{ path: string }>;
    watch?: Array<{
      type: string;
      action: string;
    }>;
  };
}

interface Watcher {
  repo: { path: string };
  repoPath: string;
  lastHead: string | null;
  type: 'git';
  close?: () => void;
}

interface ActionContext {
  repo?: { path: string };
  commit?: string;
}

interface ActionResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * MonitorRunner
 * 
 * Handles the actual monitoring loop:
 * - Watch repos for git changes
 * - Poll GitHub for issue responses
 * - Update stats files
 * - Trigger configured actions
 */
class MonitorRunner {
  protected config: MonitorConfig;
  protected pollInterval: number;
  protected pollTimer: ReturnType<typeof setInterval> | null;
  protected projectRoot: string;
  protected running: boolean;
  protected watchers: Watcher[];

  constructor(projectRoot: string, config: MonitorConfig) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.running = false;
    this.watchers = [];
    this.pollInterval = config.monitor?.pollInterval || 60000;
    this.pollTimer = null;
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Runner already started');
    }

    this.running = true;
    this.log('Monitor started');

    for (const repo of this.config.monitor?.repos || []) {
      await this.initRepoWatcher(repo);
    }

    this.startPolling();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.log('Monitor stopping...');

    for (const watcher of this.watchers) {
      if (watcher.close) {
        watcher.close();
      }
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.log('Monitor stopped');
  }

  async initRepoWatcher(repo: { path: string }): Promise<void> {
    const repoPath = path.resolve(this.projectRoot, repo.path);
    const gitDir = path.join(repoPath, '.git');

    if (!fs.existsSync(gitDir)) {
      this.log(`Warning: ${repo.path} is not a git repository`);
      return;
    }

    this.log(`Watching repo: ${repo.path}`);

    const lastHead = await this.getGitHead(repoPath);
    
    this.watchers.push({
      repo,
      repoPath,
      lastHead,
      type: 'git'
    });
  }

  async getGitHead(repoPath: string): Promise<string | null> {
    try {
      return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
    } catch (_error) {
      return null;
    }
  }

  startPolling(): void {
    this.pollTimer = setInterval(async () => {
      if (!this.running) return;

      try {
        await this.checkForChanges();
      } catch (error) {
        this.log(`Error in poll cycle: ${(error as Error).message}`);
      }
    }, this.pollInterval);
  }

  async checkForChanges(): Promise<void> {
    this.log('Checking for changes...');

    for (const watcher of this.watchers.filter(w => w.type === 'git')) {
      await this.checkGitChanges(watcher);
    }

    if (this.config.monitor?.watch?.some(w => w.type === 'issue-response')) {
      await this.pollGitHubIssues();
    }

    await this.updateStatsFiles();
  }

  async checkGitChanges(watcher: Watcher): Promise<void> {
    const currentHead = await this.getGitHead(watcher.repoPath);

    if (!currentHead) {
      return;
    }

    if (currentHead !== watcher.lastHead) {
      this.log(`New commit detected in ${watcher.repo.path}`);
      watcher.lastHead = currentHead;

      await this.triggerActions('push', {
        repo: watcher.repo,
        commit: currentHead
      });
    }
  }

  async pollGitHubIssues(): Promise<void> {
    try {
      const GitHubSync = require('../cli/commands/git/github-sync');
      const sync = new GitHubSync({ verbose: false });

      await sync.syncIssues({
        state: 'open',
        labels: 'agent-request',
        limit: 50
      });

      this.log('GitHub issues synced');

      await this.triggerActions('issue-response', {});
    } catch (error) {
      this.log(`Error polling GitHub: ${(error as Error).message}`);
    }
  }

  async updateStatsFiles(): Promise<void> {
    const supernalDir = path.join(this.projectRoot, '.supernal-coding');
    await fs.ensureDir(supernalDir);

    await this.updateHealthCache(supernalDir);

    if (this.config.monitor?.watch?.some(w => w.type === 'ci-status')) {
      await this.updateCIStatus(supernalDir);
    }

    await this.updateIssueTracker(supernalDir);
  }

  async updateHealthCache(supernalDir: string): Promise<void> {
    const healthPath = path.join(supernalDir, 'health-cache.json');
    
    const health: Record<string, any> = {
      timestamp: new Date().toISOString(),
      monitor: {
        running: true,
        lastCheck: new Date().toISOString(),
        repos: this.watchers.length
      }
    };

    if (fs.existsSync(healthPath)) {
      const existing = await fs.readJson(healthPath);
      Object.assign(health, existing, { monitor: health.monitor });
    }

    await fs.writeJson(healthPath, health, { spaces: 2 });
  }

  async updateCIStatus(_supernalDir: string): Promise<void> {
    try {
      const GitHubSync = require('../cli/commands/git/github-sync');
      const sync = new GitHubSync({ verbose: false });
      
      await sync.syncCI({ limit: 10 });
      
      this.log('CI status updated');
    } catch (error) {
      this.log(`Error updating CI status: ${(error as Error).message}`);
    }
  }

  async updateIssueTracker(supernalDir: string): Promise<void> {
    const trackerPath = path.join(supernalDir, 'issue-tracker.json');
    
    const tracker: Record<string, any> = {
      lastCheck: new Date().toISOString(),
      source: 'monitor-daemon'
    };

    if (fs.existsSync(trackerPath)) {
      const existing = await fs.readJson(trackerPath);
      Object.assign(tracker, existing, { lastCheck: tracker.lastCheck });
    }

    await fs.writeJson(trackerPath, tracker, { spaces: 2 });
  }

  async triggerActions(type: string, context: ActionContext): Promise<void> {
    const actions = (this.config.monitor?.watch || [])
      .filter(w => w.type === type)
      .map(w => w.action);

    for (const action of actions) {
      try {
        await this.executeAction(action, context);
      } catch (error) {
        this.log(`Error executing action ${action}: ${(error as Error).message}`);
      }
    }
  }

  async executeAction(action: string, context: ActionContext): Promise<ActionResult | void> {
    this.log(`Executing action: ${action}`);

    switch (action) {
      case 'run-tests':
        return await this.runTests(context);

      case 'validate':
        return await this.runValidation(context);

      case 'notify':
        await this.sendNotification(context);
        break;

      default:
        this.log(`Unknown action: ${action}`);
    }
  }

  async runTests(context: ActionContext): Promise<ActionResult> {
    try {
      const result = execSync('npm test', {
        cwd: context.repo?.path ? path.resolve(this.projectRoot, context.repo.path) : this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      this.log('Tests passed');
      return { success: true, output: result };
    } catch (error) {
      this.log(`Tests failed: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }

  async runValidation(_context: ActionContext): Promise<ActionResult> {
    try {
      const result = execSync('npx sc validate', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      this.log('Validation passed');
      return { success: true, output: result };
    } catch (error) {
      this.log(`Validation failed: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendNotification(context: ActionContext): Promise<void> {
    this.log(`Notification: ${JSON.stringify(context)}`);
  }

  log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    const logFile = path.join(this.projectRoot, '.supernal', 'monitor.log');
    fs.appendFileSync(logFile, logMessage);

    if (process.stdout.isTTY) {
      console.log(logMessage.trim());
    }
  }
}

export default MonitorRunner;
module.exports = MonitorRunner;
