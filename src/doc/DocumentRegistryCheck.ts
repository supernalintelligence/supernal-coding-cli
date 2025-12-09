const fs = require('node:fs');
const _path = require('node:path');
const yaml = require('yaml');
const { execSync } = require('node:child_process');
const chalk = require('chalk');
const { minimatch } = require('minimatch');

class DocumentRegistryCheck {
  constructor() {
    this.registryPath = '.supernal/document-registry.yaml';
    this.registry = null;
  }

  loadRegistry() {
    if (!fs.existsSync(this.registryPath)) {
      return null;
    }
    const content = fs.readFileSync(this.registryPath, 'utf8');
    return yaml.parse(content);
  }

  getStagedFiles() {
    try {
      const result = execSync('git diff --cached --name-only', {
        encoding: 'utf8'
      });
      return result.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  matchesPatterns(file, patterns) {
    return patterns.some((pattern) => minimatch(file, pattern));
  }

  async check(options = {}) {
    this.registry = this.loadRegistry();

    if (!this.registry) {
      if (!options.quiet) {
        console.log(chalk.yellow('No document registry found'));
      }
      return { controlled: [], tracked: [], uncontrolled: [] };
    }

    const stagedFiles = this.getStagedFiles();
    const results = {
      controlled: [],
      tracked: [],
      uncontrolled: []
    };

    const requiredPatterns = this.registry.controlled?.required || [];
    const trackedPatterns = this.registry.controlled?.tracked || [];

    for (const file of stagedFiles) {
      if (this.matchesPatterns(file, requiredPatterns)) {
        results.controlled.push(file);
      } else if (this.matchesPatterns(file, trackedPatterns)) {
        results.tracked.push(file);
      } else {
        results.uncontrolled.push(file);
      }
    }

    if (!options.quiet) {
      this.displayResults(results, options);
    }

    return results;
  }

  displayResults(results, _options) {
    const { controlled, tracked } = results;
    const threshold = this.registry.settings?.chg_threshold || 10;

    if (controlled.length === 0 && tracked.length === 0) {
      console.log(chalk.green('✓ No controlled documents in staging'));
      return;
    }

    if (controlled.length > 0) {
      console.log(
        chalk.yellow(
          '\n⚠️  Controlled documents modified (signed commit recommended):'
        )
      );
      controlled.forEach((f) => console.log(chalk.white(`   - ${f}`)));
    }

    if (tracked.length > 0) {
      console.log(
        chalk.blue('\nℹ️  Tracked documents modified (will be logged):')
      );
      tracked.forEach((f) => console.log(chalk.gray(`   - ${f}`)));
    }

    const total = controlled.length + tracked.length;
    if (total >= threshold) {
      console.log(
        chalk.yellow(
          `\n📋 ${total} controlled files - consider creating a CHG document:`
        )
      );
      console.log(
        chalk.gray('   sc change new "Brief description of changes"')
      );
    }

    console.log(chalk.gray('\nRecommendations:'));
    if (controlled.length > 0) {
      console.log(
        chalk.gray('   - Use signed commit: git commit -S -m "[DOC] ..."')
      );
    }
    console.log(
      chalk.gray('   - Bypass: SC_SKIP_DOC_REGISTRY_CHECK=true git commit')
    );
  }
}

module.exports = DocumentRegistryCheck;
