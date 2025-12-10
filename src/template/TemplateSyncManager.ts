// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const matter = require('gray-matter');
const chalk = require('chalk');
const { glob } = require('glob');
const semver = require('semver');

/**
 * TemplateSyncManager - Keeps documents in sync with their templates
 *
 * Core Features:
 * - Detects outdated documents (template version > document's created_from_template version)
 * - Smart YAML merging: adds new fields, preserves user content
 * - Preserves approval history and user-specific fields
 * - Increments document version on sync
 */
class TemplateSyncManager {
  docsDir: any;
  preservedFields: any;
  projectRoot: any;
  templatesDir: any;
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.templatesDir = path.join(projectRoot, 'templates');
    this.docsDir = path.join(projectRoot, 'docs');

    // Fields that are preserved from documents during sync
    this.preservedFields = [
      'id',
      'title',
      'created',
      'updated',
      'status',
      'approvals',
      'approval_history',
      'git_tracking',
      'custom_field', // Example user field
    ];
  }

  /**
   * Parse template reference from frontmatter
   * Format: path/to/template.md@version
   */
  parseTemplateReference(ref) {
    if (!ref) return null;

    const match = ref.match(/^(.+)@(.+)$/);
    if (!match) return null;

    return {
      path: match[1],
      version: match[2],
    };
  }

  /**
   * Get current version of a template
   * @param {string} templatePath - Relative path from document (e.g., "../../templates/requirement-template.md")
   * @param {string} documentPath - Full path to the document
   */
  async getTemplateVersion(templatePath, documentPath) {
    try {
      // Resolve template path relative to the document's directory
      const docDir = path.dirname(documentPath);
      const fullPath = path.resolve(docDir, templatePath);
      const content = await fs.readFile(fullPath, 'utf8');
      const { data } = matter(content);
      return data.version || '1.0.0';
    } catch (error) {
      throw new Error(
        `Failed to read template ${templatePath}: ${error.message}`
      );
    }
  }

  /**
   * Check if a document is outdated
   */
  async isDocumentOutdated(docPath) {
    const content = await fs.readFile(docPath, 'utf8');
    const { data: frontmatter } = matter(content);

    if (!frontmatter.created_from_template) {
      return { outdated: false, reason: 'No template reference' };
    }

    const templateRef = this.parseTemplateReference(
      frontmatter.created_from_template
    );
    if (!templateRef) {
      return { outdated: false, reason: 'Invalid template reference format' };
    }

    const currentTemplateVersion = await this.getTemplateVersion(
      templateRef.path,
      docPath
    );

    if (semver.gt(currentTemplateVersion, templateRef.version)) {
      return {
        outdated: true,
        documentVersion: templateRef.version,
        templateVersion: currentTemplateVersion,
        templatePath: templateRef.path,
      };
    }

    return { outdated: false, reason: 'Already up to date' };
  }

  /**
   * Smart YAML merge: template fields + preserved document fields
   */
  smartMerge(templateFrontmatter, documentFrontmatter) {
    const merged = { ...templateFrontmatter };

    // Preserve specific fields from document
    for (const field of this.preservedFields) {
      if (documentFrontmatter[field] !== undefined) {
        merged[field] = documentFrontmatter[field];
      }
    }

    // Preserve any field starting with 'custom_'
    Object.keys(documentFrontmatter).forEach((key) => {
      if (key.startsWith('custom_') && !merged[key]) {
        merged[key] = documentFrontmatter[key];
      }
    });

    return merged;
  }

  /**
   * Increment semantic version
   */
  incrementVersion(version) {
    try {
      return semver.inc(version, 'patch');
    } catch (_error) {
      return '1.0.1'; // Fallback
    }
  }

  /**
   * Sync a single document with its template
   */
  async syncDocument(docPath, options = {}) {
    const { dryRun = false } = options;

    try {
      // Read document
      const docContent = await fs.readFile(docPath, 'utf8');
      const { data: docFrontmatter, content: docBody } = matter(docContent);

      if (!docFrontmatter.created_from_template) {
        return { status: 'skipped', reason: 'No template reference' };
      }

      // Check if outdated
      const outdatedCheck = await this.isDocumentOutdated(docPath);
      if (!outdatedCheck.outdated) {
        return { status: 'skipped', reason: outdatedCheck.reason };
      }

      // Read template (resolve relative to document)
      const docDir = path.dirname(docPath);
      const templateFullPath = path.resolve(docDir, outdatedCheck.templatePath);
      const templateContent = await fs.readFile(templateFullPath, 'utf8');
      const { data: templateFrontmatter } = matter(templateContent);

      // Smart merge
      const mergedFrontmatter = this.smartMerge(
        templateFrontmatter,
        docFrontmatter
      );

      // Update provenance
      mergedFrontmatter.created_from_template = `${outdatedCheck.templatePath}@${outdatedCheck.templateVersion}`;

      // Increment document version
      mergedFrontmatter.version = this.incrementVersion(
        docFrontmatter.version || '1.0.0'
      );

      // Update timestamp
      mergedFrontmatter.updated = new Date().toISOString();

      // Reconstruct document (keep original body)
      const newContent = matter.stringify(docBody, mergedFrontmatter);

      if (!dryRun) {
        await fs.writeFile(docPath, newContent);
      }

      return {
        status: 'synced',
        file: path.relative(this.projectRoot, docPath),
        templateVersion: `${outdatedCheck.documentVersion} → ${outdatedCheck.templateVersion}`,
        documentVersion: `${docFrontmatter.version || '1.0.0'} → ${mergedFrontmatter.version}`,
        changes: this.detectChanges(docFrontmatter, mergedFrontmatter),
      };
    } catch (error) {
      return {
        status: 'error',
        file: path.relative(this.projectRoot, docPath),
        error: error.message,
      };
    }
  }

  /**
   * Detect what changed in frontmatter
   */
  detectChanges(before, after) {
    const changes = {
      added: [],
      updated: [],
      removed: [],
    };

    // Find added/updated fields
    Object.keys(after).forEach((key) => {
      if (before[key] === undefined) {
        changes.added.push(key);
      } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        if (!this.preservedFields.includes(key)) {
          changes.updated.push(key);
        }
      }
    });

    // Find removed fields (rare, but possible)
    Object.keys(before).forEach((key) => {
      if (after[key] === undefined && !this.preservedFields.includes(key)) {
        changes.removed.push(key);
      }
    });

    return changes;
  }

  /**
   * Find all documents with template references
   */
  async findDocumentsWithTemplates() {
    const files = await glob(`${this.docsDir}/**/*.md`, {
      ignore: ['**/node_modules/**', '**/templates/**'],
    });

    const docsWithTemplates = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const { data } = matter(content);

      if (data.created_from_template) {
        docsWithTemplates.push(file);
      }
    }

    return docsWithTemplates;
  }

  /**
   * Check all documents for outdated templates
   */
  async checkAll() {
    console.log(chalk.blue('\n🔍 Checking for outdated documents...\n'));

    const docs = await this.findDocumentsWithTemplates();
    console.log(
      chalk.gray(`Found ${docs.length} documents with template references\n`)
    );

    const outdated = [];
    const upToDate = [];
    const errors = [];

    for (const doc of docs) {
      try {
        const check = await this.isDocumentOutdated(doc);
        const relPath = path.relative(this.projectRoot, doc);

        if (check.outdated) {
          outdated.push({
            file: relPath,
            templateVersion: check.templateVersion,
            documentVersion: check.documentVersion,
          });
          console.log(chalk.yellow(`⚠️  ${relPath}`));
          console.log(
            chalk.gray(
              `   Template: ${check.documentVersion} → ${check.templateVersion}`
            )
          );
        } else {
          upToDate.push(relPath);
        }
      } catch (error) {
        errors.push({
          file: path.relative(this.projectRoot, doc),
          error: error.message,
        });
        console.log(
          chalk.red(
            `✗ ${path.relative(this.projectRoot, doc)}: ${error.message}`
          )
        );
      }
    }

    console.log(chalk.blue('\n📊 Summary:\n'));
    console.log(chalk.yellow(`  Outdated:   ${outdated.length}`));
    console.log(chalk.green(`  Up to date: ${upToDate.length}`));
    console.log(chalk.red(`  Errors:     ${errors.length}`));

    return { outdated, upToDate, errors };
  }

  /**
   * Sync specific document or all outdated documents
   */
  async sync(target = null, options = {}) {
    const { dryRun = false } = options;

    console.log(
      chalk.blue(`\n🔄 Template Sync ${dryRun ? '(Dry Run)' : ''}\n`)
    );

    let filesToSync = [];

    if (target) {
      // Sync specific file
      const fullPath = path.resolve(this.projectRoot, target);
      filesToSync = [fullPath];
    } else {
      // Sync all outdated
      const check = await this.checkAll();
      filesToSync = check.outdated.map((item) =>
        path.join(this.projectRoot, item.file)
      );
    }

    const results = {
      synced: [],
      skipped: [],
      errors: [],
    };

    for (const file of filesToSync) {
      const result = await this.syncDocument(file, { dryRun });

      if (result.status === 'synced') {
        results.synced.push(result);
        console.log(chalk.green(`\n✓ ${result.file}`));
        console.log(chalk.gray(`  Template: ${result.templateVersion}`));
        console.log(chalk.gray(`  Document: ${result.documentVersion}`));
        if (result.changes.added.length > 0) {
          console.log(
            chalk.gray(`  Added fields: ${result.changes.added.join(', ')}`)
          );
        }
        if (result.changes.updated.length > 0) {
          console.log(
            chalk.gray(`  Updated fields: ${result.changes.updated.join(', ')}`)
          );
        }
      } else if (result.status === 'skipped') {
        results.skipped.push(result);
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

    console.log(chalk.blue('\n📊 Sync Summary:\n'));
    console.log(chalk.green(`  Synced:  ${results.synced.length}`));
    console.log(chalk.yellow(`  Skipped: ${results.skipped.length}`));
    console.log(chalk.red(`  Errors:  ${results.errors.length}`));

    if (dryRun) {
      console.log(chalk.yellow('\n⚠️  Dry run - no files were modified'));
    } else {
      console.log(chalk.green('\n✓ Sync complete!'));
    }

    return results;
  }
}

module.exports = TemplateSyncManager;
