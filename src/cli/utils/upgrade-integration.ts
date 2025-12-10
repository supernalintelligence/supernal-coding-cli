/**
 * Upgrade Integration - Automatic upgrade checking for sc commands
 * Integrates with all sc commands to provide upgrade notifications
 */

const UpgradeChecker = require('../commands/upgrade/check-upgrade');

interface CheckResult {
  checked: boolean;
  needsUpgrade: boolean;
  currentVersion: string;
  latestVersion: string;
  upgradeCommand: string;
}

interface CriticalCheckResult {
  shouldContinue: boolean;
  reason?: string;
  message?: string;
  upgradeCommand?: string;
}

interface CachedUpdateStatus {
  needsUpdate: boolean;
  message?: string;
  upgradeCommand?: string;
  isCritical?: boolean;
}

class UpgradeIntegration {
  protected checker: typeof UpgradeChecker;
  protected skipUpgradeCheck: boolean;

  constructor() {
    this.checker = new UpgradeChecker();
    this.skipUpgradeCheck =
      process.argv.includes('--skip-upgrade-check') ||
      process.env.SC_SKIP_UPGRADE_CHECK === 'true';
  }

  async performBackgroundCheck(): Promise<void> {
    if (this.skipUpgradeCheck) {
      return;
    }

    try {
      const result: CheckResult = await this.checker.checkForUpgrade({ silent: true });

      if (result.needsUpgrade) {
        setTimeout(() => {
          this.showUpgradeNotification(result);
        }, 100);
      }
    } catch (_error) {
      // Silently ignore upgrade check errors
    }
  }

  showUpgradeNotification(checkResult: CheckResult): void {
    if (!checkResult.checked || !checkResult.needsUpgrade) {
      return;
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('📦 UPDATE AVAILABLE - Supernal Code');
    console.log('═'.repeat(60));
    console.log(`Current version: ${checkResult.currentVersion}`);
    console.log(`Latest version:  ${checkResult.latestVersion}`);
    console.log('');
    console.log('🚀 To upgrade:');
    console.log(`   ${checkResult.upgradeCommand}`);
    console.log('');
    console.log('💡 Or run: sc upgrade');
    console.log('');
    console.log('💡 To skip these checks: sc <command> --skip-upgrade-check');
    console.log(`${'═'.repeat(60)}\n`);
  }

  isDevelopmentMode(): boolean {
    return this.checker.getInstallationMethod() === 'development';
  }

  async initializeForCommand(_commandName: string): Promise<void> {
    this.performBackgroundCheck().catch(() => {
      // Silently ignore errors
    });
  }

  async checkCriticalUpdates(): Promise<CriticalCheckResult> {
    if (this.skipUpgradeCheck) {
      return { shouldContinue: true };
    }

    try {
      const result: CheckResult = await this.checker.checkForUpgrade({
        force: false,
        silent: true
      });

      if (result.checked && result.needsUpgrade) {
        const currentMajor = parseInt(result.currentVersion.split('.')[0], 10);
        const latestMajor = parseInt(result.latestVersion.split('.')[0], 10);

        this.checker.cacheUpdateStatus({
          needsUpdate: true,
          message: `Update available: v${result.currentVersion} → v${result.latestVersion}`,
          upgradeCommand: result.upgradeCommand,
          isCritical: latestMajor > currentMajor
        });

        if (latestMajor > currentMajor) {
          return {
            shouldContinue: false,
            reason: 'major-version-outdated',
            message: `Critical update required: v${result.currentVersion} → v${result.latestVersion}`,
            upgradeCommand: result.upgradeCommand
          };
        }
      } else {
        this.checker.cacheUpdateStatus({ needsUpdate: false });
      }

      return { shouldContinue: true };
    } catch (_error) {
      return { shouldContinue: true };
    }
  }

  getCachedUpdateStatus(): CachedUpdateStatus | null {
    try {
      return this.checker.getCachedUpdateStatus();
    } catch (_error) {
      return null;
    }
  }
}

export default UpgradeIntegration;
module.exports = UpgradeIntegration;
