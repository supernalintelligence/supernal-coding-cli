import fs from 'node:fs';
import yaml from 'yaml';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { minimatch } from 'minimatch';

interface Registry {
  controlled?: {
    required?: string[];
    tracked?: string[];
  };
  settings?: {
    chg_threshold?: number;
  };
}

interface CheckOptions {
  quiet?: boolean;
}

interface CheckResults {
  controlled: string[];
  tracked: string[];
  uncontrolled: string[];
  success?: boolean;
  controlledFiles?: string[];
}

class DocumentRegistryCheck {
  protected registryPath: string;
  protected registry: Registry | null;

  constructor() {
    this.registryPath = '.supernal/document-registry.yaml';
    this.registry = null;
  }

  loadRegistry(): Registry | null {
    if (!fs.existsSync(this.registryPath)) {
      return null;
    }
    const content = fs.readFileSync(this.registryPath, 'utf8');
    return yaml.parse(content);
  }

  getStagedFiles(): string[] {
    try {
      const result = execSync('git diff --cached --name-only', {
        encoding: 'utf8'
      });
      return result.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  matchesPatterns(file: string, patterns: string[]): boolean {
    return patterns.some((pattern) => minimatch(file, pattern));
  }

  async check(options: CheckOptions = {}): Promise<CheckResults> {
    this.registry = this.loadRegistry();

    if (!this.registry) {
      if (!options.quiet) {
        console.log(chalk.yellow('No document registry found'));
      }
      return { controlled: [], tracked: [], uncontrolled: [], success: true };
    }

    const stagedFiles = this.getStagedFiles();
    const results: CheckResults = {
      controlled: [],
      tracked: [],
      uncontrolled: [],
      success: true
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

    results.controlledFiles = results.controlled;

    if (!options.quiet) {
      this.displayResults(results);
    }

    return results;
  }

  displayResults(results: CheckResults): void {
    const { controlled, tracked } = results;
    const threshold = this.registry?.settings?.chg_threshold || 10;

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

export default DocumentRegistryCheck;
module.exports = DocumentRegistryCheck;
