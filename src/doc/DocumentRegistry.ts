// @ts-nocheck
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');
const glob = require('glob');
const chalk = require('chalk');

class DocumentRegistry {
  registryPath: any;
  constructor() {
    this.registryPath = '.supernal/document-registry.yaml';
  }

  exists() {
    return fs.existsSync(this.registryPath);
  }

  load() {
    if (!this.exists()) return null;
    const content = fs.readFileSync(this.registryPath, 'utf8');
    return yaml.parse(content);
  }

  save(registry) {
    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.registryPath, yaml.stringify(registry), 'utf8');
  }

  list() {
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

  check(file) {
    const registry = this.load();
    if (!registry) {
      console.log(chalk.yellow('No document registry'));
      return null;
    }

    const { minimatch } = require('minimatch');
    const required = registry.controlled?.required || [];
    const tracked = registry.controlled?.tracked || [];

    if (required.some((p) => minimatch(file, p))) {
      console.log(chalk.green(`✓ Controlled (required: signed commits)`));
      return 'required';
    }

    if (tracked.some((p) => minimatch(file, p))) {
      console.log(chalk.blue(`ℹ️  Tracked (changes logged)`));
      return 'tracked';
    }

    console.log(chalk.gray('Not controlled'));
    return null;
  }

  add(pattern, level = 'tracked') {
    const registry = this.load() || this.getDefaultRegistry();

    if (!registry.controlled) registry.controlled = {};
    if (!registry.controlled[level]) registry.controlled[level] = [];

    if (!registry.controlled[level].includes(pattern)) {
      registry.controlled[level].push(pattern);
      this.save(registry);
      console.log(chalk.green(`✓ Added "${pattern}" to ${level} paths`));
    } else {
      console.log(chalk.yellow(`Pattern already exists in ${level}`));
    }
  }

  init() {
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

  getDefaultRegistry() {
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

  stats() {
    const registry = this.load();
    if (!registry) {
      console.log(chalk.yellow('No document registry'));
      return;
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
  }
}

module.exports = DocumentRegistry;
