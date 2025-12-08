const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');

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
  constructor(projectRoot, config) {
    this.projectRoot = projectRoot;
    this.config = config;
    this.running = false;
    this.watchers = [];
    this.pollInterval = config.monitor?.pollInterval || 60000; // 1 minute default
  }

  /**
   * Start monitoring
   */
  async start() {
    if (this.running) {
      throw new Error('Runner already started');
    }

    this.running = true;
    this.log('Monitor started');

    // Initialize watchers for each repo
    for (const repo of this.config.monitor.repos) {
      await this.initRepoWatcher(repo);
    }

    // Start polling loop
    this.startPolling();
  }

  /**
   * Stop monitoring
   */
  async stop() {
    this.running = false;
    this.log('Monitor stopping...');

    // Stop all watchers
    for (const watcher of this.watchers) {
      if (watcher.close) {
        watcher.close();
      }
    }

    this.log('Monitor stopped');
  }

  /**
   * Initialize repo watcher
   * @param {object} repo - { path }
   */
  async initRepoWatcher(repo) {
    const repoPath = path.resolve(this.projectRoot, repo.path);
    const gitDir = path.join(repoPath, '.git');

    if (!fs.existsSync(gitDir)) {
      this.log(`Warning: ${repo.path} is not a git repository`);
      return;
    }

    this.log(`Watching repo: ${repo.path}`);

    // Store last known HEAD
    const lastHead = await this.getGitHead(repoPath);
    
    this.watchers.push({
      repo,
      repoPath,
      lastHead,
      type: 'git'
    });
  }

  /**
   * Get current git HEAD
   * @param {string} repoPath
   * @returns {Promise<string>}
   */
  async getGitHead(repoPath) {
    try {
      return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Start polling loop
   */
  startPolling() {
    this.pollTimer = setInterval(async () => {
      if (!this.running) return;

      try {
        await this.checkForChanges();
      } catch (error) {
        this.log(`Error in poll cycle: ${error.message}`);
      }
    }, this.pollInterval);
  }

  /**
   * Check for changes in all watched repos
   */
  async checkForChanges() {
    this.log('Checking for changes...');

    // Check git repos for new commits
    for (const watcher of this.watchers.filter(w => w.type === 'git')) {
      await this.checkGitChanges(watcher);
    }

    // Poll GitHub for issue responses
    if (this.config.monitor?.watch?.some(w => w.type === 'issue-response')) {
      await this.pollGitHubIssues();
    }

    // Update stats files
    await this.updateStatsFiles();
  }

  /**
   * Check for git changes in repo
   * @param {object} watcher
   */
  async checkGitChanges(watcher) {
    const currentHead = await this.getGitHead(watcher.repoPath);

    if (!currentHead) {
      return;
    }

    if (currentHead !== watcher.lastHead) {
      this.log(`New commit detected in ${watcher.repo.path}`);
      watcher.lastHead = currentHead;

      // Trigger push actions
      await this.triggerActions('push', {
        repo: watcher.repo,
        commit: currentHead
      });
    }
  }

  /**
   * Poll GitHub for issue responses
   */
  async pollGitHubIssues() {
    try {
      const GitHubSync = require('../cli/commands/git/github-sync');
      const sync = new GitHubSync({ verbose: false });

      // Sync issues to local tracking file
      await sync.syncIssues({
        state: 'open',
        labels: 'agent-request',
        limit: 50
      });

      this.log('GitHub issues synced');

      // Trigger issue-response actions if new responses detected
      await this.triggerActions('issue-response', {});
    } catch (error) {
      this.log(`Error polling GitHub: ${error.message}`);
    }
  }

  /**
   * Update stats files
   */
  async updateStatsFiles() {
    const supernalDir = path.join(this.projectRoot, '.supernal-coding');
    await fs.ensureDir(supernalDir);

    // Update health-cache.json
    await this.updateHealthCache(supernalDir);

    // Update ci-status.json (if configured)
    if (this.config.monitor?.watch?.some(w => w.type === 'ci-status')) {
      await this.updateCIStatus(supernalDir);
    }

    // Update issue-tracker.json
    await this.updateIssueTracker(supernalDir);
  }

  /**
   * Update health cache
   * @param {string} supernalDir
   */
  async updateHealthCache(supernalDir) {
    const healthPath = path.join(supernalDir, 'health-cache.json');
    
    const health = {
      timestamp: new Date().toISOString(),
      monitor: {
        running: true,
        lastCheck: new Date().toISOString(),
        repos: this.watchers.length
      }
    };

    // Merge with existing health data if present
    if (fs.existsSync(healthPath)) {
      const existing = await fs.readJson(healthPath);
      Object.assign(health, existing, { monitor: health.monitor });
    }

    await fs.writeJson(healthPath, health, { spaces: 2 });
  }

  /**
   * Update CI status
   * @param {string} supernalDir
   */
  async updateCIStatus(supernalDir) {
    const ciPath = path.join(supernalDir, 'ci-status.json');
    
    try {
      // Use github-sync to get CI status
      const GitHubSync = require('../cli/commands/git/github-sync');
      const sync = new GitHubSync({ verbose: false });
      
      await sync.syncCI({ limit: 10 });
      
      this.log('CI status updated');
    } catch (error) {
      this.log(`Error updating CI status: ${error.message}`);
    }
  }

  /**
   * Update issue tracker
   * @param {string} supernalDir
   */
  async updateIssueTracker(supernalDir) {
    const trackerPath = path.join(supernalDir, 'issue-tracker.json');
    
    // Issue tracker is updated by GitHub sync
    // Just record that we checked
    const tracker = {
      lastCheck: new Date().toISOString(),
      source: 'monitor-daemon'
    };

    if (fs.existsSync(trackerPath)) {
      const existing = await fs.readJson(trackerPath);
      Object.assign(tracker, existing, { lastCheck: tracker.lastCheck });
    }

    await fs.writeJson(trackerPath, tracker, { spaces: 2 });
  }

  /**
   * Trigger configured actions for event type
   * @param {string} type - Event type (push, issue-response, ci-failure)
   * @param {object} context - Event context
   */
  async triggerActions(type, context) {
    const actions = (this.config.monitor?.watch || [])
      .filter(w => w.type === type)
      .map(w => w.action);

    for (const action of actions) {
      try {
        await this.executeAction(action, context);
      } catch (error) {
        this.log(`Error executing action ${action}: ${error.message}`);
      }
    }
  }

  /**
   * Execute a configured action
   * @param {string} action - Action name
   * @param {object} context - Event context
   */
  async executeAction(action, context) {
    this.log(`Executing action: ${action}`);

    switch (action) {
      case 'run-tests':
        await this.runTests(context);
        break;

      case 'validate':
        await this.runValidation(context);
        break;

      case 'notify':
        await this.sendNotification(context);
        break;

      default:
        this.log(`Unknown action: ${action}`);
    }
  }

  /**
   * Run tests
   * @param {object} context
   */
  async runTests(context) {
    try {
      const result = execSync('npm test', {
        cwd: context.repo?.path ? path.resolve(this.projectRoot, context.repo.path) : this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      this.log('Tests passed');
      return { success: true, output: result };
    } catch (error) {
      this.log(`Tests failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run validation
   * @param {object} context
   */
  async runValidation(context) {
    try {
      const result = execSync('npx sc validate', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      this.log('Validation passed');
      return { success: true, output: result };
    } catch (error) {
      this.log(`Validation failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification
   * @param {object} context
   */
  async sendNotification(context) {
    // For now, just log
    // Future: integrate with notification systems (Slack, email, etc.)
    this.log(`Notification: ${JSON.stringify(context)}`);
  }

  /**
   * Log message
   * @param {string} message
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    // Write to log file
    const logFile = path.join(this.projectRoot, '.supernal', 'monitor.log');
    fs.appendFileSync(logFile, logMessage);

    // Also console log if not daemonized
    if (process.stdout.isTTY) {
      console.log(logMessage.trim());
    }
  }
}

module.exports = MonitorRunner;
