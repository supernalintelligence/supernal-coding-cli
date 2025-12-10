import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'yaml';
import { spawn, ChildProcess } from 'node:child_process';

interface MonitorConfig {
  monitor?: {
    repos?: Array<{ path: string }>;
    [key: string]: any;
  };
}

interface MonitorState {
  startTime?: string;
  repos?: Array<{ path: string }>;
  lastCheck?: string;
  stats?: Record<string, any>;
  lastUpdate?: string;
}

interface StartOptions {
  daemon?: boolean;
  config?: string;
}

interface LogOptions {
  tail?: number;
  follow?: boolean;
}

interface StopResult {
  stopped: boolean;
  pid: number;
  forced?: boolean;
}

interface StartResult {
  started: boolean;
  pid?: number;
  logFile?: string;
  foreground?: boolean;
}

interface StatusResult {
  running: boolean;
  pid: number | null;
  uptime: number | null;
  repos: Array<{ path: string }>;
  lastCheck?: string;
  stats: Record<string, any>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * MonitorManager
 * 
 * Manages background daemon for monitoring repos, GitHub issues, and CI events.
 * Supports watching multiple repos with configurable actions.
 */
class MonitorManager {
  protected logFile: string;
  protected pidFile: string;
  protected projectRoot: string;
  protected stateFile: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.pidFile = path.join(projectRoot, '.supernal', 'monitor.pid');
    this.stateFile = path.join(projectRoot, '.supernal', 'monitor-state.json');
    this.logFile = path.join(projectRoot, '.supernal', 'monitor.log');
  }

  async start(options: StartOptions = {}): Promise<StartResult> {
    if (await this.isRunning()) {
      const pid = await this.getPid();
      throw new Error(`Monitor already running (PID: ${pid})`);
    }

    const config = await this.loadConfig(options.config);

    this.validateConfig(config);

    if (options.daemon) {
      return await this.startDaemon(config);
    } else {
      return await this.run(config);
    }
  }

  async stop(): Promise<StopResult> {
    if (!(await this.isRunning())) {
      throw new Error('Monitor is not running');
    }

    const pid = await this.getPid();

    try {
      process.kill(pid, 'SIGTERM');

      const maxWait = 10000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        if (!(await this.isRunning())) {
          await fs.remove(this.pidFile);
          return { stopped: true, pid };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      process.kill(pid, 'SIGKILL');
      await fs.remove(this.pidFile);
      return { stopped: true, pid, forced: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
        await fs.remove(this.pidFile);
        throw new Error('Monitor process not found (stale PID file removed)');
      }
      throw error;
    }
  }

  async status(): Promise<StatusResult> {
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

  async isRunning(): Promise<boolean> {
    if (!(await fs.pathExists(this.pidFile))) {
      return false;
    }

    try {
      const pid = await this.getPid();
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
        await fs.remove(this.pidFile);
        return false;
      }
      throw error;
    }
  }

  async getPid(): Promise<number> {
    const content = await fs.readFile(this.pidFile, 'utf-8');
    return parseInt(content.trim(), 10);
  }

  async startDaemon(config: MonitorConfig): Promise<StartResult> {
    const configFile = path.join(this.projectRoot, '.supernal', 'monitor-config.json');
    await fs.ensureDir(path.dirname(configFile));
    await fs.writeJson(configFile, config);

    const daemonScript = path.join(__dirname, 'monitor-daemon.js');
    const child: ChildProcess = spawn(
      process.execPath,
      [daemonScript, configFile],
      {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
        cwd: this.projectRoot
      }
    );

    child.unref();

    await fs.ensureDir(path.dirname(this.pidFile));
    await fs.writeFile(this.pidFile, child.pid!.toString());

    await this.updateState({
      startTime: new Date().toISOString(),
      repos: config.monitor?.repos || [],
      stats: {}
    });

    return {
      started: true,
      pid: child.pid!,
      logFile: this.logFile
    };
  }

  async run(config: MonitorConfig): Promise<StartResult> {
    console.log('Starting monitor in foreground...');
    console.log(`Watching ${config.monitor?.repos?.length || 0} repos`);

    const MonitorRunner = require('./MonitorRunner');
    const runner = new MonitorRunner(this.projectRoot, config);

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

    await runner.start();

    return { started: true, foreground: true };
  }

  async loadConfig(configPath?: string): Promise<MonitorConfig> {
    const defaultPath = path.join(this.projectRoot, 'supernal.yaml');
    const targetPath = configPath || defaultPath;

    if (!(await fs.pathExists(targetPath))) {
      throw new Error(`Configuration file not found: ${targetPath}`);
    }

    const content = await fs.readFile(targetPath, 'utf-8');
    const config = yaml.parse(content) as MonitorConfig;

    if (!config.monitor) {
      throw new Error('No monitor configuration found in supernal.yaml');
    }

    return config;
  }

  validateConfig(config: MonitorConfig): void {
    if (!config.monitor) {
      throw new Error('Missing monitor configuration');
    }

    const configValidatorModule = require('./config-validator');
    const validateMonitorConfig = 
      typeof configValidatorModule === 'function' 
        ? configValidatorModule 
        : configValidatorModule.validateMonitorConfig;

    if (!validateMonitorConfig || typeof validateMonitorConfig !== 'function') {
      throw new Error(`Config validator not available. Got: ${typeof configValidatorModule}`);
    }

    const result: ValidationResult = validateMonitorConfig(config.monitor);

    if (!result.valid) {
      throw new Error(`Invalid monitor configuration:\n${result.errors.join('\n')}`);
    }

    for (const repo of config.monitor.repos || []) {
      const repoPath = path.resolve(this.projectRoot, repo.path);
      if (!fs.existsSync(repoPath)) {
        throw new Error(`Repo path does not exist: ${repo.path}`);
      }
    }
  }

  async getState(): Promise<MonitorState> {
    if (!(await fs.pathExists(this.stateFile))) {
      return {};
    }
    return await fs.readJson(this.stateFile);
  }

  async updateState(updates: Partial<MonitorState>): Promise<void> {
    const current = await this.getState();
    const updated = { ...current, ...updates, lastUpdate: new Date().toISOString() };
    await fs.ensureDir(path.dirname(this.stateFile));
    await fs.writeJson(this.stateFile, updated, { spaces: 2 });
  }

  async getLogs(options: LogOptions = {}): Promise<string | any> {
    if (!(await fs.pathExists(this.logFile))) {
      return '';
    }

    if (options.follow) {
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

export default MonitorManager;
module.exports = MonitorManager;
