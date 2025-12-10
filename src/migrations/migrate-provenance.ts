#!/usr/bin/env node

/**
 * Phase 3: Template Provenance Migration
 *
 * Adds `created_from_template` and `version` to existing documents
 * that were created before Phase 2 implementation.
 */

import fs from 'fs-extra';
import path from 'node:path';
import matter from 'gray-matter';
import chalk from 'chalk';
import { glob } from 'glob';

interface TemplateMapping {
  pattern: RegExp;
  template: string;
  version: string;
  templateType: string;
}

interface TemplateInfo {
  template: string;
  version: string;
  templatePath: string;
}

interface MigrationResult {
  status: 'migrated' | 'skipped' | 'error';
  reason?: string;
  error?: string;
  template?: string;
  version?: string;
  file?: string;
}

interface MigrationResults {
  migrated: MigrationResult[];
  skipped: { file: string; reason: string }[];
  errors: MigrationResult[];
}

interface MigrateOptions {
  dryRun?: boolean;
}

class ProvenanceMigrator {
  protected docsDir: string;
  protected projectRoot: string;
  protected templateMappings: Record<string, TemplateMapping>;

  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.docsDir = path.join(projectRoot, 'docs');
    this.templateMappings = {
      requirements: {
        pattern: /req-\d{3}/,
        template: 'requirement-template.md',
        version: '1.0.0',
        templateType: 'instantiated',
      },
      'architecture/decisions': {
        pattern: /ADD-\d{3}/,
        template: 'add-template.md',
        version: '1.0.0',
        templateType: 'instantiated',
      },
      compliance: {
        pattern: /\w+-rule-\d{3}\.md$/,
        template: 'compliance-template.md',
        version: '1.0.0',
        templateType: 'instantiated',
      },
    };
  }

  async findDocuments(): Promise<string[]> {
    const files = await glob(`${this.docsDir}/**/*.md`, {
      ignore: ['**/node_modules/**', '**/templates/**'],
    });
    return files;
  }

  determineTemplate(filePath: string): TemplateInfo | null {
    const relativePath = path.relative(this.docsDir, filePath);
    const filename = path.basename(filePath);

    for (const [dir, config] of Object.entries(this.templateMappings)) {
      if (relativePath.startsWith(dir) && config.pattern.test(filename)) {
        return {
          template: config.template,
          version: config.version,
          templatePath: `../../templates/${config.template}`,
        };
      }
    }

    return null;
  }

  hasProvenance(frontmatter: Record<string, unknown>): boolean {
    return !!(frontmatter.created_from_template && frontmatter.version);
  }

  async migrateDocument(filePath: string, dryRun = false): Promise<MigrationResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const { data: frontmatter, content: body } = matter(content);

      if (this.hasProvenance(frontmatter)) {
        return { status: 'skipped', reason: 'Already has provenance' };
      }

      const templateInfo = this.determineTemplate(filePath);
      if (!templateInfo) {
        return { status: 'skipped', reason: 'No template mapping found' };
      }

      const updatedFrontmatter = {
        ...frontmatter,
        created_from_template: `${templateInfo.templatePath}@${templateInfo.version}`,
        version: frontmatter.version || '1.0.0',
      };

      const newContent = matter.stringify(body, updatedFrontmatter);

      if (!dryRun) {
        await fs.writeFile(filePath, newContent);
      }

      return {
        status: 'migrated',
        template: templateInfo.template,
        version: updatedFrontmatter.version as string,
        file: path.relative(this.projectRoot, filePath),
      };
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message,
        file: path.relative(this.projectRoot, filePath),
      };
    }
  }

  async migrate(options: MigrateOptions = {}): Promise<MigrationResults> {
    const { dryRun = false } = options;

    console.log(chalk.blue('\n📋 Phase 3: Template Provenance Migration\n'));
    console.log(chalk.gray(`Scanning ${this.docsDir}...`));

    const files = await this.findDocuments();
    console.log(chalk.gray(`Found ${files.length} markdown files\n`));

    const results: MigrationResults = {
      migrated: [],
      skipped: [],
      errors: [],
    };

    for (const file of files) {
      const result = await this.migrateDocument(file, dryRun);

      if (result.status === 'migrated') {
        results.migrated.push(result);
        console.log(chalk.green(`✓ ${result.file}`));
        console.log(
          chalk.gray(`  Template: ${result.template}@${result.version}`)
        );
      } else if (result.status === 'skipped') {
        results.skipped.push({
          file: path.relative(this.projectRoot, file),
          reason: result.reason || 'Unknown',
        });
        console.log(
          chalk.yellow(
            `○ ${path.relative(this.projectRoot, file)} - ${result.reason}`
          )
        );
      } else if (result.status === 'error') {
        results.errors.push(result);
        console.log(chalk.red(`✗ ${result.file} - ${result.error}`));
      }
    }

    console.log(chalk.blue('\n📊 Migration Summary:\n'));
    console.log(chalk.green(`  Migrated: ${results.migrated.length}`));
    console.log(chalk.yellow(`  Skipped:  ${results.skipped.length}`));
    console.log(chalk.red(`  Errors:   ${results.errors.length}`));

    if (dryRun) {
      console.log(chalk.yellow('\n⚠️  Dry run - no files were modified'));
    } else {
      console.log(chalk.green('\n✓ Migration complete!'));
    }

    return results;
  }
}

if (require.main === module) {
  const { Command } = require('commander');
  const program = new Command();

  program
    .name('migrate-provenance')
    .description('Add template provenance to existing documents')
    .option('--dry-run', 'Show what would be changed without modifying files')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .option('--verbose', 'Show detailed output')
    .action(async (options: { dryRun?: boolean; projectRoot: string; verbose?: boolean }) => {
      try {
        const migrator = new ProvenanceMigrator(options.projectRoot);
        await migrator.migrate({ dryRun: options.dryRun });
        process.exit(0);
      } catch (error) {
        console.error(chalk.red(`\n❌ Migration failed: ${(error as Error).message}`));
        if (options.verbose) {
          console.error((error as Error).stack);
        }
        process.exit(1);
      }
    });

  program.parse(process.argv);
}

export default ProvenanceMigrator;
module.exports = ProvenanceMigrator;
