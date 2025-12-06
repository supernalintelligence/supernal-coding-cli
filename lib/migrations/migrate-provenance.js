#!/usr/bin/env node

/**
 * Phase 3: Template Provenance Migration
 *
 * Adds `created_from_template` and `version` to existing documents
 * that were created before Phase 2 implementation.
 */

const fs = require('fs-extra');
const path = require('node:path');
const matter = require('gray-matter');
const chalk = require('chalk');
const { glob } = require('glob');

class ProvenanceMigrator {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.docsDir = path.join(projectRoot, 'docs');
    this.templateMappings = {
      requirements: {
        pattern: /req-\d{3}/,
        template: 'requirement-template.md',
        version: '1.0.0',
        templateType: 'instantiated', // Documents created via sc req new
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
      // Note: Removed feature READMEs - these are structural scaffolding copied by sc init,
      // not instantiated documents. They don't need template provenance.
    };
  }

  /**
   * Find all markdown files in docs/
   */
  async findDocuments() {
    const files = await glob(`${this.docsDir}/**/*.md`, {
      ignore: ['**/node_modules/**', '**/templates/**'],
    });
    return files;
  }

  /**
   * Determine template for a document based on its path and filename
   */
  determineTemplate(filePath) {
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

  /**
   * Check if document already has provenance
   */
  hasProvenance(frontmatter) {
    return frontmatter.created_from_template && frontmatter.version;
  }

  /**
   * Migrate a single document
   */
  async migrateDocument(filePath, dryRun = false) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const { data: frontmatter, content: body } = matter(content);

      // Skip if already has provenance
      if (this.hasProvenance(frontmatter)) {
        return { status: 'skipped', reason: 'Already has provenance' };
      }

      // Determine template
      const templateInfo = this.determineTemplate(filePath);
      if (!templateInfo) {
        return { status: 'skipped', reason: 'No template mapping found' };
      }

      // Add provenance
      const updatedFrontmatter = {
        ...frontmatter,
        created_from_template: `${templateInfo.templatePath}@${templateInfo.version}`,
        version: frontmatter.version || '1.0.0', // Use existing version or default
      };

      // Reconstruct content
      const newContent = matter.stringify(body, updatedFrontmatter);

      if (!dryRun) {
        await fs.writeFile(filePath, newContent);
      }

      return {
        status: 'migrated',
        template: templateInfo.template,
        version: updatedFrontmatter.version,
        file: path.relative(this.projectRoot, filePath),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        file: path.relative(this.projectRoot, filePath),
      };
    }
  }

  /**
   * Run migration on all documents
   */
  async migrate(options = {}) {
    const { dryRun = false } = options;

    console.log(chalk.blue('\n📋 Phase 3: Template Provenance Migration\n'));
    console.log(chalk.gray(`Scanning ${this.docsDir}...`));

    const files = await this.findDocuments();
    console.log(chalk.gray(`Found ${files.length} markdown files\n`));

    const results = {
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
          reason: result.reason,
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

    // Summary
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

// CLI
if (require.main === module) {
  const program = require('commander');

  program
    .name('migrate-provenance')
    .description('Add template provenance to existing documents')
    .option('--dry-run', 'Show what would be changed without modifying files')
    .option('--project-root <path>', 'Project root directory', process.cwd())
    .action(async (options) => {
      try {
        const migrator = new ProvenanceMigrator(options.projectRoot);
        await migrator.migrate({ dryRun: options.dryRun });
        process.exit(0);
      } catch (error) {
        console.error(chalk.red(`\n❌ Migration failed: ${error.message}`));
        if (options.verbose) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  program.parse(process.argv);
}

module.exports = ProvenanceMigrator;
