// @ts-nocheck
/**
 * Upgrade Integration - Automatic upgrade checking for sc commands
 * Integrates with all sc commands to provide upgrade notifications
 */

const UpgradeChecker = require('../commands/upgrade/check-upgrade');

class UpgradeIntegration {
  checker: any;
  skipUpgradeCheck: any;
  constructor() {
    this.checker = new UpgradeChecker();
    this.skipUpgradeCheck =
      process.argv.includes('--skip-upgrade-check') ||
      process.env.SC_SKIP_UPGRADE_CHECK === 'true';
  }

  /**
   * Perform background upgrade check with minimal interruption
   */
  async performBackgroundCheck() {
    if (this.skipUpgradeCheck) {
      return;
    }

    try {
      // Only check if enough time has passed (24 hours by default)
      const result = await this.checker.checkForUpgrade({ silent: true });

      if (result.needsUpgrade) {
        // Show upgrade notification after command completes
        setTimeout(() => {
          this.showUpgradeNotification(result);
        }, 100);
      }
    } catch (_error) {
      // Silently ignore upgrade check errors to not interfere with main command
    }
  }

  /**
   * Display upgrade notification for all users
   */
  showUpgradeNotification(checkResult) {
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

  /**
   * Check if we're running in development mode (internal development)
   */
  isDevelopmentMode() {
    return this.checker.getInstallationMethod() === 'development';
  }

  /**
   * Initialize upgrade integration for a command
   */
  async initializeForCommand(_commandName) {
    // Start background upgrade check (non-blocking)
    this.performBackgroundCheck().catch(() => {
      // Silently ignore errors
    });
  }

  /**
   * Check for critical updates that should block execution
   * Now also caches results for fast subsequent checks
   */
  async checkCriticalUpdates() {
    if (this.skipUpgradeCheck) {
      return { shouldContinue: true };
    }

    try {
      const result = await this.checker.checkForUpgrade({
        force: false,
        silent: true
      });

      if (result.checked && result.needsUpgrade) {
        const currentMajor = parseInt(result.currentVersion.split('.')[0], 10);
        const latestMajor = parseInt(result.latestVersion.split('.')[0], 10);

        // Cache the update status
        this.checker.cacheUpdateStatus({
          needsUpdate: true,
          message: `Update available: v${result.currentVersion} → v${result.latestVersion}`,
          upgradeCommand: result.upgradeCommand,
          isCritical: latestMajor > currentMajor
        });

        // Block execution for major version differences
        if (latestMajor > currentMajor) {
          return {
            shouldContinue: false,
            reason: 'major-version-outdated',
            message: `Critical update required: v${result.currentVersion} → v${result.latestVersion}`,
            upgradeCommand: result.upgradeCommand
          };
        }
      } else {
        // Clear cache if no update needed
        this.checker.cacheUpdateStatus({ needsUpdate: false });
      }

      return { shouldContinue: true };
    } catch (_error) {
      // Don't block execution on upgrade check errors
      return { shouldContinue: true };
    }
  }

  /**
   * Get cached update status (fast path - no network call)
   */
  getCachedUpdateStatus() {
    try {
      return this.checker.getCachedUpdateStatus();
    } catch (_error) {
      return null;
    }
  }
}

module.exports = UpgradeIntegration;
