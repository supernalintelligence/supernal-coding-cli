import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import glob from 'glob';
import chalk from 'chalk';
import { minimatch } from 'minimatch';

interface ControlledPaths {
  required?: string[];
  tracked?: string[];
  [key: string]: string[] | undefined;
}

interface RegistrySettings {
  chg_threshold?: number;
}

interface RegistryData {
  version?: string;
  controlled?: ControlledPaths;
  settings?: RegistrySettings;
}

interface RegistryStats {
  requiredCount: number;
  trackedCount: number;
  totalPatterns: number;
}

interface CheckResult {
  isControlled: boolean;
  level?: string;
  requiresSigned?: boolean;
}

class DocumentRegistry {
  protected registryPath: string;

  constructor() {
    this.registryPath = '.supernal/document-registry.yaml';
  }

  exists(): boolean {
    return fs.existsSync(this.registryPath);
  }

  load(): RegistryData | null {
    if (!this.exists()) return null;
    const content = fs.readFileSync(this.registryPath, 'utf8');
    return yaml.parse(content);
  }

  save(registry: RegistryData): void {
    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.registryPath, yaml.stringify(registry), 'utf8');
  }

  list(): void {
    const registry = this.load();
    if (!registry) {
      console.log(
        chalk.yellow('No document registry found. Run: sc doc registry init')
      );
      return;
    }

    console.log(chalk.bold('\n📋 Document Registry\n'));

    if (registry.controlled?.required?.length) {
      console.log(chalk.green('Required (signed commits):'));
      registry.controlled.required.forEach((p) =>
        console.log(chalk.white(`   - ${p}`))
      );
    }

    if (registry.controlled?.tracked?.length) {
      console.log(chalk.blue('\nTracked (logged):'));
      registry.controlled.tracked.forEach((p) =>
        console.log(chalk.gray(`   - ${p}`))
      );
    }

    if (registry.settings) {
      console.log(chalk.gray('\nSettings:'));
      console.log(
        chalk.gray(
          `   CHG threshold: ${registry.settings.chg_threshold || 10} files`
        )
      );
    }
  }

  check(file: string): CheckResult {
    const registry = this.load();
    if (!registry) {
      console.log(chalk.yellow('No document registry'));
      return { isControlled: false };
    }

    const required = registry.controlled?.required || [];
    const tracked = registry.controlled?.tracked || [];

    if (required.some((p) => minimatch(file, p))) {
      console.log(chalk.green(`✓ Controlled (required: signed commits)`));
      return { isControlled: true, level: 'required', requiresSigned: true };
    }

    if (tracked.some((p) => minimatch(file, p))) {
      console.log(chalk.blue(`ℹ️  Tracked (changes logged)`));
      return { isControlled: true, level: 'tracked', requiresSigned: false };
    }

    console.log(chalk.gray('Not controlled'));
    return { isControlled: false };
  }

  add(pattern: string, level: string = 'tracked'): void {
    const registry = this.load() || this.getDefaultRegistry();

    if (!registry.controlled) registry.controlled = {};
    if (!registry.controlled[level]) registry.controlled[level] = [];

    if (!registry.controlled[level]!.includes(pattern)) {
      registry.controlled[level]!.push(pattern);
      this.save(registry);
      console.log(chalk.green(`✓ Added "${pattern}" to ${level} paths`));
    } else {
      console.log(chalk.yellow(`Pattern already exists in ${level}`));
    }
  }

  init(): void {
    if (this.exists()) {
      console.log(chalk.yellow('Registry already exists'));
      return;
    }

    const registry = this.getDefaultRegistry();
    this.save(registry);
    console.log(chalk.green('✓ Document registry created'));
    console.log(chalk.gray(`   File: ${this.registryPath}`));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('   sc doc registry list     # View patterns'));
    console.log(chalk.gray('   sc doc registry add ...  # Add patterns'));
  }

  getDefaultRegistry(): RegistryData {
    return {
      version: '1.0.0',
      controlled: {
        required: [
          'docs/workflow/sops/**/*.md',
          'docs/compliance/**/*.md',
          'docs/architecture/**/*.md'
        ],
        tracked: [
          'docs/requirements/**/*.md',
          'docs/features/**/*.md',
          'docs/planning/**/*.md'
        ]
      },
      settings: {
        chg_threshold: 10
      }
    };
  }

  stats(): RegistryStats {
    const registry = this.load();
    if (!registry) {
      console.log(chalk.yellow('No document registry'));
      return { requiredCount: 0, trackedCount: 0, totalPatterns: 0 };
    }

    console.log(chalk.bold('\n📊 Registry Statistics\n'));

    let totalRequired = 0;
    let totalTracked = 0;

    for (const pattern of registry.controlled?.required || []) {
      const files = glob.sync(pattern);
      totalRequired += files.length;
      console.log(chalk.green(`${pattern}: ${files.length} files`));
    }

    for (const pattern of registry.controlled?.tracked || []) {
      const files = glob.sync(pattern);
      totalTracked += files.length;
      console.log(chalk.blue(`${pattern}: ${files.length} files`));
    }

    console.log(
      chalk.bold(`\nTotal: ${totalRequired} required, ${totalTracked} tracked`)
    );

    return {
      requiredCount: (registry.controlled?.required || []).length,
      trackedCount: (registry.controlled?.tracked || []).length,
      totalPatterns: totalRequired + totalTracked
    };
  }
}

export default DocumentRegistry;
module.exports = DocumentRegistry;
