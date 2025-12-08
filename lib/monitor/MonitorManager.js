const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');
const { spawn } = require('node:child_process');

/**
 * MonitorManager
 * 
 * Manages background daemon for monitoring repos, GitHub issues, and CI events.
 * Supports watching multiple repos with configurable actions.
 */
class MonitorManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.pidFile = path.join(projectRoot, '.supernal', 'monitor.pid');
    this.stateFile = path.join(projectRoot, '.supernal', 'monitor-state.json');
    this.logFile = path.join(projectRoot, '.supernal', 'monitor.log');
  }

  /**
   * Start the monitor daemon
   * @param {object} options - { daemon: boolean, config: string }
   * @returns {Promise<object>}
   */
  async start(options = {}) {
    // Check if already running
    if (await this.isRunning()) {
      const pid = await this.getPid();
      throw new Error(`Monitor already running (PID: ${pid})`);
    }

    // Load configuration
    const config = await this.loadConfig(options.config);

    // Validate configuration
    this.validateConfig(config);

    // Start daemon
    if (options.daemon) {
      return await this.startDaemon(config);
    } else {
      // Run in foreground for development/testing
      return await this.run(config);
    }
  }

  /**
   * Stop the monitor daemon
   * @returns {Promise<object>}
   */
  async stop() {
    if (!(await this.isRunning())) {
      throw new Error('Monitor is not running');
    }

    const pid = await this.getPid();

    try {
      // Send SIGTERM
      process.kill(pid, 'SIGTERM');

      // Wait for process to exit (max 10s)
      const maxWait = 10000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        if (!(await this.isRunning())) {
          await fs.remove(this.pidFile);
          return { stopped: true, pid };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Force kill if still running
      process.kill(pid, 'SIGKILL');
      await fs.remove(this.pidFile);
      return { stopped: true, pid, forced: true };
    } catch (error) {
      if (error.code === 'ESRCH') {
        // Process doesn't exist - clean up stale PID file
        await fs.remove(this.pidFile);
        throw new Error('Monitor process not found (stale PID file removed)');
      }
      throw error;
    }
  }

  /**
   * Get monitor status
   * @returns {Promise<object>}
   */
  async status() {
    const running = await this.isRunning();
    const pid = running ? await this.getPid() : null;
    const state = await this.getState();

    return {
      running,
      pid,
      uptime: state.startTime
        ? Date.now() - new Date(state.startTime).getTime()
        : null,
      repos: state.repos || [],
      lastCheck: state.lastCheck,
      stats: state.stats || {}
    };
  }

  /**
   * Check if monitor is running
   * @returns {Promise<boolean>}
   */
  async isRunning() {
    if (!(await fs.pathExists(this.pidFile))) {
      return false;
    }

    try {
      const pid = await this.getPid();
      // Check if process exists (signal 0 doesn't kill, just checks)
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') {
        // Process doesn't exist
        await fs.remove(this.pidFile);
        return false;
      }
      throw error;
    }
  }

  /**
   * Get PID from file
   * @returns {Promise<number>}
   */
  async getPid() {
    const content = await fs.readFile(this.pidFile, 'utf-8');
    return parseInt(content.trim(), 10);
  }

  /**
   * Start daemon process
   * @param {object} config
   * @returns {Promise<object>}
   */
  async startDaemon(config) {
    // Write config to temp file for daemon to read
    const configFile = path.join(this.projectRoot, '.supernal', 'monitor-config.json');
    await fs.ensureDir(path.dirname(configFile));
    await fs.writeJson(configFile, config);

    // Spawn detached daemon process
    const daemonScript = path.join(__dirname, 'monitor-daemon.js');
    const child = spawn(
      process.execPath,
      [daemonScript, configFile],
      {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
        cwd: this.projectRoot
      }
    );

    // Detach from parent
    child.unref();

    // Write PID file
    await fs.ensureDir(path.dirname(this.pidFile));
    await fs.writeFile(this.pidFile, child.pid.toString());

    // Initialize state
    await this.updateState({
      startTime: new Date().toISOString(),
      repos: config.monitor?.repos || [],
      stats: {}
    });

    return {
      started: true,
      pid: child.pid,
      logFile: this.logFile
    };
  }

  /**
   * Run monitor in foreground (for testing/dev)
   * @param {object} config
   * @returns {Promise<object>}
   */
  async run(config) {
    console.log('Starting monitor in foreground...');
    console.log(`Watching ${config.monitor?.repos?.length || 0} repos`);

    const MonitorRunner = require('./MonitorRunner');
    const runner = new MonitorRunner(this.projectRoot, config);

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down...');
      await runner.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down...');
      await runner.stop();
      process.exit(0);
    });

    // Start runner
    await runner.start();

    return { started: true, foreground: true };
  }

  /**
   * Load configuration from supernal.yaml
   * @param {string} configPath - Optional override path
   * @returns {Promise<object>}
   */
  async loadConfig(configPath) {
    const defaultPath = path.join(this.projectRoot, 'supernal.yaml');
    const targetPath = configPath || defaultPath;

    if (!(await fs.pathExists(targetPath))) {
      throw new Error(`Configuration file not found: ${targetPath}`);
    }

    const content = await fs.readFile(targetPath, 'utf-8');
    const config = yaml.load(content);

    if (!config.monitor) {
      throw new Error('No monitor configuration found in supernal.yaml');
    }

    return config;
  }

  /**
   * Validate monitor configuration
   * @param {object} config
   */
  validateConfig(config) {
    if (!config.monitor) {
      throw new Error('Missing monitor configuration');
    }

    // Load config validator - handle both CommonJS patterns
    const configValidatorModule = require('./config-validator');
    const validateMonitorConfig = 
      typeof configValidatorModule === 'function' 
        ? configValidatorModule 
        : configValidatorModule.validateMonitorConfig;

    if (!validateMonitorConfig || typeof validateMonitorConfig !== 'function') {
      throw new Error(`Config validator not available. Got: ${typeof configValidatorModule}`);
    }

    const result = validateMonitorConfig(config.monitor);

    if (!result.valid) {
      throw new Error(`Invalid monitor configuration:\n${result.errors.join('\n')}`);
    }

    // Additional validation: check repo paths exist
    for (const repo of config.monitor.repos) {
      const repoPath = path.resolve(this.projectRoot, repo.path);
      if (!fs.existsSync(repoPath)) {
        throw new Error(`Repo path does not exist: ${repo.path}`);
      }
    }
  }

  /**
   * Get current monitor state
   * @returns {Promise<object>}
   */
  async getState() {
    if (!(await fs.pathExists(this.stateFile))) {
      return {};
    }
    return await fs.readJson(this.stateFile);
  }

  /**
   * Update monitor state
   * @param {object} updates
   * @returns {Promise<void>}
   */
  async updateState(updates) {
    const current = await this.getState();
    const updated = { ...current, ...updates, lastUpdate: new Date().toISOString() };
    await fs.ensureDir(path.dirname(this.stateFile));
    await fs.writeJson(this.stateFile, updated, { spaces: 2 });
  }

  /**
   * Get monitor logs
   * @param {object} options - { tail: number, follow: boolean }
   * @returns {Promise<string|Stream>}
   */
  async getLogs(options = {}) {
    if (!(await fs.pathExists(this.logFile))) {
      return '';
    }

    if (options.follow) {
      // Return stream for tailing
      const { Tail } = require('tail');
      return new Tail(this.logFile);
    }

    const content = await fs.readFile(this.logFile, 'utf-8');
    
    if (options.tail) {
      const lines = content.split('\n');
      return lines.slice(-options.tail).join('\n');
    }

    return content;
  }
}

module.exports = MonitorManager;
