import chalk from 'chalk';
const MonitorManager = require('../../../monitor/MonitorManager');

interface MonitorOptions {
  daemon?: boolean;
  config?: string;
  follow?: boolean;
  tail?: number;
}

interface StartResult {
  foreground?: boolean;
  pid?: number;
  logFile?: string;
}

interface StopResult {
  pid: number;
  forced?: boolean;
}

interface RepoStatus {
  path: string;
}

interface MonitorStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  repos?: (RepoStatus | string)[];
  lastCheck?: string;
  stats?: Record<string, unknown>;
}

interface TailStream {
  on(event: 'line', callback: (line: string) => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
}

/**
 * Handle sc monitor commands
 *
 * Commands:
 * - start [--daemon] - Start monitoring
 * - stop - Stop daemon
 * - status - Show status
 * - logs [--tail N] [--follow] - View logs
 */
async function handleMonitorCommand(
  action: string | undefined,
  _args: string[],
  options: MonitorOptions
): Promise<void> {
  const manager = new MonitorManager();

  try {
    switch (action) {
      case 'start': {
        const result: StartResult = await manager.start({
          daemon: options.daemon,
          config: options.config
        });

        if (result.foreground) {
          console.log(chalk.green('✅ Monitor started in foreground'));
          console.log(chalk.gray('Press Ctrl+C to stop'));
        } else {
          console.log(chalk.green('✅ Monitor daemon started'));
          console.log(chalk.gray(`   PID: ${result.pid}`));
          console.log(chalk.gray(`   Logs: ${result.logFile}`));
          console.log();
          console.log(chalk.blue('Commands:'));
          console.log(chalk.white('  sc monitor status    # Check status'));
          console.log(chalk.white('  sc monitor logs      # View logs'));
          console.log(chalk.white('  sc monitor stop      # Stop daemon'));
        }
        break;
      }

      case 'stop': {
        const result: StopResult = await manager.stop();
        console.log(chalk.green(`✅ Monitor stopped (PID: ${result.pid})`));
        if (result.forced) {
          console.log(chalk.yellow('   (forced kill)'));
        }
        break;
      }

      case 'status': {
        const status: MonitorStatus = await manager.status();

        if (!status.running) {
          console.log(chalk.yellow('⚠️  Monitor is not running'));
          console.log();
          console.log(chalk.blue('Start with:'));
          console.log(chalk.white('  sc monitor start --daemon'));
          return;
        }

        console.log(chalk.bold('\n📊 Monitor Status'));
        console.log(chalk.green(`✅ Running (PID: ${status.pid})`));

        if (status.uptime) {
          const uptimeSeconds = Math.floor(status.uptime / 1000);
          const hours = Math.floor(uptimeSeconds / 3600);
          const minutes = Math.floor((uptimeSeconds % 3600) / 60);
          console.log(chalk.gray(`   Uptime: ${hours}h ${minutes}m`));
        }

        if (status.repos && status.repos.length > 0) {
          console.log(chalk.bold('\n📂 Watching Repos:'));
          status.repos.forEach((repo) => {
            const repoPath = typeof repo === 'string' ? repo : repo.path;
            console.log(chalk.cyan(`  • ${repoPath}`));
          });
        }

        if (status.lastCheck) {
          const lastCheck = new Date(status.lastCheck);
          const ago = Math.floor((Date.now() - lastCheck.getTime()) / 1000);
          console.log(chalk.gray(`\n   Last check: ${ago}s ago`));
        }

        if (status.stats && Object.keys(status.stats).length > 0) {
          console.log(chalk.bold('\n📈 Statistics:'));
          Object.entries(status.stats).forEach(([key, value]) => {
            console.log(chalk.white(`  ${key}: ${value}`));
          });
        }
        break;
      }

      case 'logs': {
        if (options.follow) {
          console.log(chalk.blue('Following logs (Ctrl+C to stop)...'));
          const tail: TailStream = await manager.getLogs({ follow: true });
          tail.on('line', (line: string) => {
            console.log(line);
          });
          tail.on('error', (error: Error) => {
            console.error(chalk.red(`Error: ${error.message}`));
          });
        } else {
          const logs = await manager.getLogs({ tail: options.tail });
          if (!logs) {
            console.log(chalk.yellow('No logs found'));
          } else {
            console.log(logs);
          }
        }
        break;
      }

      case 'restart': {
        console.log(chalk.blue('Restarting monitor...'));

        try {
          await manager.stop();
          console.log(chalk.gray('✓ Stopped'));
        } catch (_error) {
          // Ignore if not running
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const result: StartResult = await manager.start({ daemon: true, config: options.config });
        console.log(chalk.green(`✅ Monitor restarted (PID: ${result.pid})`));
        break;
      }

      default:
        console.log(chalk.bold('🔍 Monitor Commands'));
        console.log();
        console.log(chalk.cyan('  sc monitor start [--daemon]'));
        console.log(chalk.gray('    Start monitoring (use --daemon for background)'));
        console.log();
        console.log(chalk.cyan('  sc monitor stop'));
        console.log(chalk.gray('    Stop monitor daemon'));
        console.log();
        console.log(chalk.cyan('  sc monitor status'));
        console.log(chalk.gray('    Show monitor status'));
        console.log();
        console.log(chalk.cyan('  sc monitor logs [--tail N] [--follow]'));
        console.log(chalk.gray('    View monitor logs'));
        console.log();
        console.log(chalk.cyan('  sc monitor restart'));
        console.log(chalk.gray('    Restart monitor daemon'));
        console.log();
        console.log(chalk.bold('Configuration'));
        console.log(chalk.gray('  Add to supernal.yaml:'));
        console.log();
        console.log(chalk.white('  monitor:'));
        console.log(chalk.white('    repos:'));
        console.log(chalk.white('      - path: .'));
        console.log(chalk.white('      - path: apps/supernal-dashboard'));
        console.log(chalk.white('    watch:'));
        console.log(chalk.white('      - type: push'));
        console.log(chalk.white('        action: run-tests'));
        console.log(chalk.white('      - type: issue-response'));
        console.log(chalk.white('        action: validate'));
        console.log();
    }
  } catch (error) {
    console.error(chalk.red(`❌ ${(error as Error).message}`));
    throw error;
  }
}

export { handleMonitorCommand };
module.exports = { handleMonitorCommand };
