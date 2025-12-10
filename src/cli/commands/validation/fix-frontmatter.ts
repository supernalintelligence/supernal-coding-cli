/**
 * Auto-fix frontmatter issues
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import chalk from 'chalk';
const { getConfig } = require('../../../scripts/config-loader');
const FrontmatterValidator = require('../../utils/frontmatter-validator');

interface Frontmatter {
  id?: string;
  title?: string;
  epic?: string;
  category?: string;
  hierarchy?: string;
  priority?: string;
  status?: string;
  dependencies?: string[];
  assignee?: string | object;
  version?: string;
  tags?: string[];
  created?: string;
  updated?: string;
  reviewedBy?: string | object;
  approvedBy?: string | object;
  riskLevel?: string;
  complianceStandards?: string[];
  priorityScore?: number;
}

async function fixFile(filePath: string): Promise<boolean> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      console.log(
        chalk.red(
          `  ❌ ${path.basename(filePath)}: Missing frontmatter section`
        )
      );
      return false;
    }

    let frontmatter: Frontmatter;
    try {
      frontmatter = yaml.parse(frontmatterMatch[1]);
    } catch (_error) {
      console.log(chalk.red(`  ❌ ${path.basename(filePath)}: Invalid YAML`));
      return false;
    }

    let modified = false;
    const fileName = path.basename(filePath, '.md');

    if (!frontmatter.id && fileName.startsWith('req-')) {
      const idMatch = fileName.match(/req-(\d+)/);
      if (idMatch) {
        frontmatter.id = `REQ-${idMatch[1].padStart(3, '0')}`;
        modified = true;
      }
    }

    if (!frontmatter.title) {
      const titleFromFileName = fileName
        .replace(/^req-\d+-/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      frontmatter.title = titleFromFileName;
      modified = true;
    }

    const defaults: Frontmatter = {
      epic: 'Uncategorized',
      category: 'core',
      hierarchy: 'feature-level',
      priority: 'Medium',
      status: 'Draft',
      dependencies: [],
      assignee: '',
      version: '1.0.0',
      tags: [],
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
      reviewedBy: '',
      approvedBy: '',
      riskLevel: 'Medium',
      complianceStandards: [],
      priorityScore: 5
    };

    for (const [field, defaultValue] of Object.entries(defaults)) {
      if (!(field in frontmatter)) {
        (frontmatter as Record<string, unknown>)[field] = defaultValue;
        modified = true;
      }
    }

    if (typeof frontmatter.assignee === 'object') {
      frontmatter.assignee = '';
      modified = true;
    }
    if (typeof frontmatter.reviewedBy === 'object') {
      frontmatter.reviewedBy = '';
      modified = true;
    }
    if (typeof frontmatter.approvedBy === 'object') {
      frontmatter.approvedBy = '';
      modified = true;
    }

    if (Array.isArray(frontmatter.dependencies)) {
      const originalDeps = [...frontmatter.dependencies];
      frontmatter.dependencies = frontmatter.dependencies.filter(
        (dep) => typeof dep === 'string' && dep.trim() !== '' && dep !== '""'
      );
      if (frontmatter.dependencies.length !== originalDeps.length) {
        modified = true;
      }
    }

    if (modified) {
      const newFrontmatter = yaml.stringify(frontmatter);
      const newContent = content.replace(
        frontmatterMatch[0],
        `---\n${newFrontmatter}---`
      );
      fs.writeFileSync(filePath, newContent);
      console.log(chalk.green(`  ✅ Fixed ${path.basename(filePath)}`));
      return true;
    }

    return false;
  } catch (error) {
    console.log(chalk.red(`  ❌ ${path.basename(filePath)}: ${(error as Error).message}`));
    return false;
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  config.load();
  const requirementsDir = path.join(
    process.cwd(),
    config.getRequirementsDirectory()
  );

  console.log(chalk.blue('🔧 Auto-fixing frontmatter issues...'));

  const validator = new FrontmatterValidator();
  const validation = validator.validateRequirements(requirementsDir);

  if (validation.valid) {
    console.log(chalk.green('✅ All frontmatter is already valid!'));
    return;
  }

  console.log(
    chalk.yellow(
      `Found ${validation.summary.errorCount} errors and ${validation.summary.warningCount} warnings`
    )
  );

  const categories = [
    'core',
    'workflow',
    'testing',
    'integration',
    'infrastructure'
  ];
  let fixedCount = 0;

  for (const category of categories) {
    const categoryDir = path.join(requirementsDir, category);
    if (!fs.existsSync(categoryDir)) continue;

    const files = fs
      .readdirSync(categoryDir)
      .filter((f) => f.startsWith('req-') && f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      const wasFixed = await fixFile(filePath);
      if (wasFixed) {
        fixedCount++;
      }
    }
  }

  if (fixedCount > 0) {
    console.log(chalk.green(`✅ Fixed ${fixedCount} files`));

    console.log(chalk.blue('\n🔍 Re-validating...'));
    const newValidation = validator.validateRequirements(requirementsDir);
    validator.printReport();

    if (newValidation.valid) {
      console.log(
        chalk.green('\n🎉 All frontmatter issues have been resolved!')
      );
    } else {
      console.log(
        chalk.yellow(
          `\n⚠️  ${newValidation.summary.errorCount} errors and ${newValidation.summary.warningCount} warnings remain`
        )
      );
      console.log(chalk.yellow('   Some issues may require manual fixes'));
    }
  } else {
    console.log(
      chalk.yellow(
        'No files were auto-fixed. Manual intervention may be required.'
      )
    );
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main, fixFile };
module.exports = { main, fixFile };
