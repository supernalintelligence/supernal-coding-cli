/**
 * SC Upgrade Command - Template upgrade system for sc init users
 * Allows users to safely update templates while preserving customizations
 */

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const VersionManager = require('../../../upgrade/version-manager');
const CustomizationDetector = require('../../../upgrade/customization-detector');
const BackupManager = require('../../../upgrade/backup-manager');
const TemplateFetcher = require('../../../upgrade/template-fetcher');
const { SmartMerger, MergeStrategy } = require('../../../upgrade/smart-merger');

class UpgradeCommand {
  constructor() {
    this.projectRoot = process.cwd();
    this.scDir = path.join(this.projectRoot, '.supernal-coding');
    this.versionManager = new VersionManager(this.projectRoot);
    this.customizationDetector = new CustomizationDetector(this.projectRoot);
    this.backupManager = new BackupManager(this.projectRoot);
    this.templateFetcher = new TemplateFetcher({
      cacheDir: path.join(this.scDir, 'cache')
    });
  }

  createCommand() {
    const command = new Command('upgrade');
    command
      .description('Upgrade SC templates and rules to latest version')
      .argument(
        '[action]',
        'Action to perform: check, preview, apply, rollback, history',
        'check'
      )
      .option(
        '--component <type>',
        'Upgrade specific component: rules, templates, workflows, git-hooks, all'
      )
      .option('--auto', 'Auto-accept non-conflicting changes')
      .option('--force', 'Force upgrade even with conflicts')
      .option('-v, --verbose', 'Verbose output')
      .action(async (action, options) => {
        try {
          await this.execute(action, options);
        } catch (error) {
          console.error(chalk.red('❌ Upgrade failed:'), error.message);
          if (options.verbose) {
            console.error(error);
          }
          process.exit(1);
        }
      });

    return command;
  }

  async execute(action, options) {
    // Ensure SC is initialized
    if (!(await this.isSCInitialized())) {
      console.error(chalk.red('❌ SC not initialized in this directory'));
      console.log(chalk.gray('Run "sc init" first'));
      process.exit(1);
    }

    switch (action.toLowerCase()) {
      case 'check':
        await this.checkUpgrade(options);
        break;
      case 'preview':
        await this.previewUpgrade(options);
        break;
      case 'apply':
        await this.applyUpgrade(options);
        break;
      case 'rollback':
        await this.rollbackUpgrade(options);
        break;
      case 'history':
        await this.showHistory(options);
        break;
      case 'config':
        await this.configureUpgrade(options);
        break;
      default:
        console.error(chalk.red(`❌ Unknown action: ${action}`));
        this.showHelp();
        process.exit(1);
    }
  }

  async isSCInitialized() {
    return await fs.pathExists(this.scDir);
  }

  async checkUpgrade(_options) {
    console.log(chalk.blue('🔍 Checking for SC updates...'));
    console.log(chalk.blue('='.repeat(50)));

    const summary = await this.versionManager.getVersionSummary();

    console.log(
      chalk.cyan('Current version:'),
      summary.current.version || 'unknown'
    );
    console.log(chalk.cyan('Latest version:'), summary.latest.version);

    if (!summary.upgrade.hasUpgrade) {
      console.log(chalk.green('\n✅ You are on the latest version'));

      if (summary.current.lastUpgrade) {
        console.log(
          chalk.gray(
            `Last upgraded: ${new Date(summary.current.lastUpgrade).toLocaleDateString()}`
          )
        );
      }
      return;
    }

    console.log(
      chalk.yellow(`\n📦 New version available: ${summary.latest.version}`)
    );
    console.log(chalk.cyan(`Upgrade type: ${summary.upgrade.type}`));

    // Show component versions
    console.log(chalk.gray('\nComponent versions:'));
    Object.entries(summary.current.components).forEach(([name, version]) => {
      console.log(chalk.gray(`  ${name}: ${version}`));
    });

    console.log(chalk.gray('\nRun "sc upgrade preview" to see details'));
  }

  async previewUpgrade(_options) {
    console.log(chalk.blue('👁️  Previewing upgrade changes...'));
    console.log(chalk.blue('='.repeat(50)));

    // Check for upgrade
    const upgradeCheck = await this.versionManager.checkUpgrade();
    if (!upgradeCheck.hasUpgrade) {
      console.log(chalk.green('✅ Already on latest version'));
      return;
    }

    console.log(
      chalk.cyan(`Upgrading: ${upgradeCheck.current} → ${upgradeCheck.latest}`)
    );
    console.log('');

    // Detect customizations
    console.log(chalk.gray('Scanning for customizations...'));
    const customizations =
      await this.customizationDetector.detectCustomizations();

    console.log('');
    console.log(chalk.yellow('Customization Summary:'));
    console.log(`  Modified files:      ${customizations.modified.length}`);
    console.log(`  User-created files:  ${customizations.userCreated.length}`);
    console.log(`  Preserved patterns:  ${customizations.preserved.length}`);
    console.log(`  Untracked SC files:  ${customizations.untracked.length}`);

    if (customizations.modified.length > 0) {
      console.log('');
      console.log(chalk.yellow('Modified files that will be preserved:'));
      customizations.modified.slice(0, 10).forEach((mod) => {
        console.log(chalk.gray(`  • ${mod.path}`));
      });
      if (customizations.modified.length > 10) {
        console.log(
          chalk.gray(`  ... and ${customizations.modified.length - 10} more`)
        );
      }
    }

    console.log('');
    console.log(chalk.gray('Run "sc upgrade apply" to proceed with upgrade'));
    console.log(
      chalk.gray(
        'Run "sc upgrade apply --auto" to auto-merge non-conflicting changes'
      )
    );
  }

  async applyUpgrade(options) {
    console.log(chalk.blue('🔄 Applying upgrade...'));
    console.log(chalk.blue('='.repeat(50)));

    // Check for upgrade
    const upgradeCheck = await this.versionManager.checkUpgrade();
    if (!upgradeCheck.hasUpgrade) {
      console.log(chalk.green('✅ Already on latest version'));
      return;
    }

    console.log(
      chalk.cyan(`Upgrading: ${upgradeCheck.current} → ${upgradeCheck.latest}`)
    );
    console.log('');

    // Step 1: Detect customizations
    console.log(chalk.gray('1/5 Detecting customizations...'));
    const customizations =
      await this.customizationDetector.detectCustomizations();
    console.log(
      chalk.green(
        `    ✓ Found ${customizations.modified.length} customized files`
      )
    );

    // Step 2: Create backup
    console.log(chalk.gray('2/5 Creating backup...'));
    const backup = await this.backupManager.createBackup(
      `upgrade-${upgradeCheck.latest}`
    );
    console.log(chalk.green(`    ✓ Backup created: ${backup.name}`));

    // Step 3: Fetch latest templates
    console.log(chalk.gray('3/5 Fetching latest templates...'));
    this.templateFetcher.verbose = options.verbose;
    const fetchResult = await this.templateFetcher.fetchTemplates(
      upgradeCheck.latest
    );

    if (!fetchResult.success) {
      throw new Error('Failed to fetch templates');
    }

    console.log(
      chalk.green(
        `    ✓ Templates fetched${fetchResult.cached ? ' (cached)' : ''}`
      )
    );

    // Step 4: Apply upgrades
    console.log(chalk.gray('4/5 Applying upgrades...'));
    const applyResult = await this.applyTemplateUpgrades(
      fetchResult.path,
      customizations,
      options
    );

    if (!applyResult.success) {
      throw new Error(`Upgrade apply failed: ${applyResult.message}`);
    }

    console.log(
      chalk.green(`    ✓ Applied ${applyResult.filesUpdated} file(s)`)
    );

    // Step 5: Validate
    console.log(chalk.gray('5/5 Validating installation...'));
    const valid = await this.validateInstallation();

    if (valid) {
      await this.versionManager.recordUpgrade(upgradeCheck.latest);
      console.log('');
      console.log(chalk.green('✅ Upgrade completed successfully!'));
      console.log(chalk.gray(`Upgraded to version ${upgradeCheck.latest}`));
      console.log('');
      console.log(chalk.gray('If you encounter issues, rollback with:'));
      console.log(chalk.cyan(`  sc upgrade rollback`));
    } else {
      console.log('');
      console.log(chalk.red('❌ Validation failed, rolling back...'));
      await this.performRollback(backup.name);
    }
  }

  async rollbackUpgrade(options) {
    console.log(chalk.blue('↩️  Rolling back last upgrade...'));
    console.log(chalk.blue('='.repeat(50)));

    // Get most recent backup
    const latest = await this.backupManager.getLatestBackup();

    if (!latest) {
      console.log(chalk.yellow('⚠️  No backups found'));
      console.log(chalk.gray('Nothing to rollback'));
      return;
    }

    console.log(chalk.cyan(`Found backup: ${latest.name}`));
    console.log(
      chalk.gray(`Created: ${new Date(latest.created).toLocaleString()}`)
    );
    console.log(chalk.gray(`Size: ${(latest.size / 1024).toFixed(2)} KB`));
    console.log('');

    // Confirm rollback (unless --yes flag)
    if (!options.yes) {
      console.log(chalk.yellow('⚠️  Interactive confirmation coming soon'));
      console.log(chalk.gray('For now, use: sc upgrade rollback --yes'));
      return;
    }

    await this.performRollback(latest.name);
  }

  async performRollback(backupName) {
    console.log(chalk.gray('Restoring from backup...'));

    const result = await this.backupManager.restoreBackup(backupName);

    if (result.success) {
      console.log(chalk.green(`✅ Rollback successful`));
      console.log(chalk.gray(`Restored ${result.restored.length} items`));

      // Update version tracking
      if (result.metadata.scVersion) {
        await this.versionManager.rollbackVersion(result.metadata.scVersion);
      }

      await this.backupManager.addRestoreToHistory(backupName);
    } else {
      console.log(chalk.red(`❌ Rollback partially failed`));
      console.log(chalk.gray(`Restored: ${result.restored.length}`));
      console.log(chalk.gray(`Failed: ${result.failed.length}`));

      result.failed.forEach((fail) => {
        console.log(chalk.red(`  • ${fail.path}: ${fail.error}`));
      });
    }
  }

  async applyTemplateUpgrades(templatePath, _customizations, options) {
    const merger = new SmartMerger({
      strategy: options.auto ? MergeStrategy.AUTO : MergeStrategy.MERGE,
      verbose: options.verbose
    });

    // Get directories to upgrade
    const directories =
      await this.templateFetcher.extractDirectories(templatePath);

    let filesUpdated = 0;
    let filesSkipped = 0;
    const conflicts = [];

    for (const [dir, sourcePath] of Object.entries(directories)) {
      const targetPath = path.join(this.projectRoot, dir);

      if (!(await fs.pathExists(targetPath))) {
        // New directory - just copy it
        await fs.copy(sourcePath, targetPath);
        filesUpdated++;
        continue;
      }

      // Merge existing directory
      const files = await this.templateFetcher.getFileList(sourcePath, [
        `${dir}/**/*`
      ]);

      for (const file of files) {
        const relPath = path.relative(sourcePath, file);
        const targetFile = path.join(targetPath, relPath);
        const sourceFile = path.join(sourcePath, file);

        // Check if customized
        const isCustomized =
          await this.customizationDetector.isCustomized(targetFile);

        if (isCustomized && !options.force) {
          // Need to merge
          const mergeResult = await this.mergeFile(
            sourceFile,
            targetFile,
            merger
          );

          if (mergeResult.success) {
            filesUpdated++;
          } else {
            conflicts.push({ file: relPath, conflicts: mergeResult.conflicts });
            filesSkipped++;
          }
        } else {
          // Safe to overwrite
          await fs.copy(sourceFile, targetFile);
          filesUpdated++;
        }
      }
    }

    return {
      success: conflicts.length === 0,
      filesUpdated,
      filesSkipped,
      conflicts,
      message:
        conflicts.length > 0
          ? `${conflicts.length} file(s) have conflicts requiring manual resolution`
          : 'All files updated successfully'
    };
  }

  async mergeFile(sourceFile, targetFile, merger) {
    try {
      // Get base version (from tracking)
      const info =
        await this.customizationDetector.getCustomizationInfo(targetFile);

      const sourceContent = await fs.readFile(sourceFile, 'utf8');
      const targetContent = await fs.readFile(targetFile, 'utf8');

      // Three-way merge (if we have base)
      const mergeResult = await merger.threeWayMerge({
        base: info.originalHash ? targetContent : '', // Simplified
        ours: targetContent,
        theirs: sourceContent
      });

      if (mergeResult.success) {
        await fs.writeFile(targetFile, mergeResult.merged, 'utf8');
      }

      return mergeResult;
    } catch (error) {
      return {
        success: false,
        conflicts: [{ error: error.message }]
      };
    }
  }

  async validateInstallation() {
    // Basic validation - check key files exist
    const keyPaths = ['.cursor/rules', 'templates', '.supernal-coding'];

    for (const relPath of keyPaths) {
      const fullPath = path.join(this.projectRoot, relPath);
      if (!(await fs.pathExists(fullPath))) {
        console.error(chalk.red(`✗ Missing: ${relPath}`));
        return false;
      }
    }

    console.log(chalk.green('    ✓ Installation valid'));
    return true;
  }

  async showHistory(_options) {
    console.log(chalk.blue('📜 Upgrade History'));
    console.log(chalk.blue('='.repeat(50)));

    const history = await this.versionManager.getUpgradeHistory();

    if (history.length === 0) {
      console.log(chalk.gray('No upgrade history found'));
      console.log(chalk.gray('This is the original installation'));
      return;
    }

    console.log('');
    history.forEach((entry, _index) => {
      const icon = entry.type === 'rollback' ? '↩️ ' : '⬆️ ';
      const color = entry.type === 'rollback' ? chalk.yellow : chalk.green;
      console.log(color(`${icon} ${entry.version}`));
      console.log(
        chalk.gray(`   ${new Date(entry.timestamp).toLocaleString()}`)
      );
      console.log(chalk.gray(`   Type: ${entry.type}`));
      console.log('');
    });

    // Show available backups
    const backups = await this.backupManager.listBackups();
    if (backups.length > 0) {
      console.log(chalk.cyan('Available backups:'));
      backups.slice(0, 5).forEach((backup) => {
        console.log(
          chalk.gray(
            `  • ${backup.name} (${(backup.size / 1024).toFixed(2)} KB)`
          )
        );
      });
      if (backups.length > 5) {
        console.log(chalk.gray(`  ... and ${backups.length - 5} more`));
      }
    }
  }

  async configureUpgrade(_options) {
    console.log(chalk.blue('⚙️  Upgrade Configuration'));
    console.log(chalk.blue('='.repeat(50)));

    // TODO: Implement configuration
    // Options:
    // - Auto-check frequency (daily, weekly, never)
    // - Auto-apply (never, minor only, all)
    // - Preserve patterns
    // - Component-specific settings

    console.log(chalk.yellow('⚠️  Configuration functionality coming soon'));
  }

  showHelp() {
    console.log(chalk.blue.bold('🔄 SC Upgrade Command'));
    console.log(chalk.blue('='.repeat(35)));
    console.log('');
    console.log(
      chalk.gray(
        'Safely upgrade SC templates and rules while preserving your customizations.'
      )
    );
    console.log('');
    console.log(chalk.yellow('Available Actions:'));
    console.log('');

    const actions = [
      ['check', 'Check for available updates (default)'],
      ['preview', 'Preview upgrade changes without applying'],
      ['apply', 'Apply upgrade with smart merge'],
      ['rollback', 'Rollback to previous version'],
      ['history', 'Show upgrade history'],
      ['config', 'Configure upgrade behavior']
    ];

    actions.forEach(([action, description]) => {
      console.log(`  ${chalk.cyan(action.padEnd(12))} ${description}`);
    });

    console.log(`\n${chalk.yellow('Options:')}`);
    console.log(
      `  ${chalk.cyan('--component <type>')} Upgrade specific component only`
    );
    console.log(
      `  ${chalk.cyan('--auto')}            Auto-accept non-conflicting changes`
    );
    console.log(
      `  ${chalk.cyan('--force')}           Force upgrade even with conflicts`
    );
    console.log(`  ${chalk.cyan('--verbose')}         Verbose output`);

    console.log(`\n${chalk.yellow('Examples:')}`);
    console.log(
      `  ${chalk.cyan('sc upgrade')}                     # Check for updates`
    );
    console.log(
      `  ${chalk.cyan('sc upgrade preview')}             # Preview changes`
    );
    console.log(
      `  ${chalk.cyan('sc upgrade apply')}               # Apply upgrade (interactive)`
    );
    console.log(
      `  ${chalk.cyan('sc upgrade apply --auto')}        # Apply with auto-merge`
    );
    console.log(
      `  ${chalk.cyan('sc upgrade apply --component=rules')} # Upgrade rules only`
    );
    console.log(
      `  ${chalk.cyan('sc upgrade rollback')}            # Undo last upgrade`
    );
  }
}

// Export the command function
module.exports = async (action, options) => {
  const upgradeCmd = new UpgradeCommand();
  await upgradeCmd.execute(action, options);
};

// Export class for testing
module.exports.UpgradeCommand = UpgradeCommand;
