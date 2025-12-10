import fs from 'fs-extra';
import path from 'node:path';
import matter from 'gray-matter';
import chalk from 'chalk';
import { glob } from 'glob';
import semver from 'semver';

interface TemplateReference {
  path: string;
  version: string;
}

interface OutdatedCheck {
  outdated: boolean;
  reason?: string;
  documentVersion?: string;
  templateVersion?: string;
  templatePath?: string;
}

interface Changes {
  added: string[];
  updated: string[];
  removed: string[];
}

interface SyncResult {
  status: 'synced' | 'skipped' | 'error';
  file?: string;
  templateVersion?: string;
  documentVersion?: string;
  changes?: Changes;
  reason?: string;
  error?: string;
}

interface SyncOptions {
  dryRun?: boolean;
}

interface CheckResult {
  outdated: Array<{
    file: string;
    templateVersion: string;
    documentVersion: string;
  }>;
  upToDate: string[];
  errors: Array<{
    file: string;
    error: string;
  }>;
}

interface SyncResults {
  synced: SyncResult[];
  skipped: SyncResult[];
  errors: SyncResult[];
}

class TemplateSyncManager {
  protected docsDir: string;
  protected preservedFields: string[];
  protected projectRoot: string;
  protected templatesDir: string;

  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.templatesDir = path.join(projectRoot, 'templates');
    this.docsDir = path.join(projectRoot, 'docs');

    this.preservedFields = [
      'id',
      'title',
      'created',
      'updated',
      'status',
      'approvals',
      'approval_history',
      'git_tracking',
      'custom_field',
    ];
  }

  parseTemplateReference(ref: string): TemplateReference | null {
    if (!ref) return null;

    const match = ref.match(/^(.+)@(.+)$/);
    if (!match) return null;

    return {
      path: match[1],
      version: match[2],
    };
  }

  async getTemplateVersion(templatePath: string, documentPath: string): Promise<string> {
    try {
      const docDir = path.dirname(documentPath);
      const fullPath = path.resolve(docDir, templatePath);
      const content = await fs.readFile(fullPath, 'utf8');
      const { data } = matter(content);
      return (data.version as string) || '1.0.0';
    } catch (error) {
      throw new Error(
        `Failed to read template ${templatePath}: ${(error as Error).message}`
      );
    }
  }

  async isDocumentOutdated(docPath: string): Promise<OutdatedCheck> {
    const content = await fs.readFile(docPath, 'utf8');
    const { data: frontmatter } = matter(content);

    if (!frontmatter.created_from_template) {
      return { outdated: false, reason: 'No template reference' };
    }

    const templateRef = this.parseTemplateReference(
      frontmatter.created_from_template as string
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

  smartMerge(
    templateFrontmatter: Record<string, any>,
    documentFrontmatter: Record<string, any>
  ): Record<string, any> {
    const merged = { ...templateFrontmatter };

    for (const field of this.preservedFields) {
      if (documentFrontmatter[field] !== undefined) {
        merged[field] = documentFrontmatter[field];
      }
    }

    Object.keys(documentFrontmatter).forEach((key) => {
      if (key.startsWith('custom_') && !merged[key]) {
        merged[key] = documentFrontmatter[key];
      }
    });

    return merged;
  }

  incrementVersion(version: string): string {
    try {
      return semver.inc(version, 'patch') || '1.0.1';
    } catch (_error) {
      return '1.0.1';
    }
  }

  async syncDocument(docPath: string, options: SyncOptions = {}): Promise<SyncResult> {
    const { dryRun = false } = options;

    try {
      const docContent = await fs.readFile(docPath, 'utf8');
      const { data: docFrontmatter, content: docBody } = matter(docContent);

      if (!docFrontmatter.created_from_template) {
        return { status: 'skipped', reason: 'No template reference' };
      }

      const outdatedCheck = await this.isDocumentOutdated(docPath);
      if (!outdatedCheck.outdated) {
        return { status: 'skipped', reason: outdatedCheck.reason };
      }

      const docDir = path.dirname(docPath);
      const templateFullPath = path.resolve(docDir, outdatedCheck.templatePath!);
      const templateContent = await fs.readFile(templateFullPath, 'utf8');
      const { data: templateFrontmatter } = matter(templateContent);

      const mergedFrontmatter = this.smartMerge(
        templateFrontmatter,
        docFrontmatter
      );

      mergedFrontmatter.created_from_template = `${outdatedCheck.templatePath}@${outdatedCheck.templateVersion}`;

      mergedFrontmatter.version = this.incrementVersion(
        (docFrontmatter.version as string) || '1.0.0'
      );

      mergedFrontmatter.updated = new Date().toISOString();

      const newContent = matter.stringify(docBody, mergedFrontmatter);

      if (!dryRun) {
        await fs.writeFile(docPath, newContent);
      }

      return {
        status: 'synced',
        file: path.relative(this.projectRoot, docPath),
        templateVersion: `${outdatedCheck.documentVersion} -> ${outdatedCheck.templateVersion}`,
        documentVersion: `${docFrontmatter.version || '1.0.0'} -> ${mergedFrontmatter.version}`,
        changes: this.detectChanges(docFrontmatter, mergedFrontmatter),
      };
    } catch (error) {
      return {
        status: 'error',
        file: path.relative(this.projectRoot, docPath),
        error: (error as Error).message,
      };
    }
  }

  detectChanges(before: Record<string, any>, after: Record<string, any>): Changes {
    const changes: Changes = {
      added: [],
      updated: [],
      removed: [],
    };

    Object.keys(after).forEach((key) => {
      if (before[key] === undefined) {
        changes.added.push(key);
      } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        if (!this.preservedFields.includes(key)) {
          changes.updated.push(key);
        }
      }
    });

    Object.keys(before).forEach((key) => {
      if (after[key] === undefined && !this.preservedFields.includes(key)) {
        changes.removed.push(key);
      }
    });

    return changes;
  }

  async findDocumentsWithTemplates(): Promise<string[]> {
    const files = await glob(`${this.docsDir}/**/*.md`, {
      ignore: ['**/node_modules/**', '**/templates/**'],
    });

    const docsWithTemplates: string[] = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const { data } = matter(content);

      if (data.created_from_template) {
        docsWithTemplates.push(file);
      }
    }

    return docsWithTemplates;
  }

  async checkAll(): Promise<CheckResult> {
    console.log(chalk.blue('\nChecking for outdated documents...\n'));

    const docs = await this.findDocumentsWithTemplates();
    console.log(
      chalk.gray(`Found ${docs.length} documents with template references\n`)
    );

    const outdated: Array<{ file: string; templateVersion: string; documentVersion: string }> = [];
    const upToDate: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const doc of docs) {
      try {
        const check = await this.isDocumentOutdated(doc);
        const relPath = path.relative(this.projectRoot, doc);

        if (check.outdated) {
          outdated.push({
            file: relPath,
            templateVersion: check.templateVersion!,
            documentVersion: check.documentVersion!,
          });
          console.log(chalk.yellow(`[WARN] ${relPath}`));
          console.log(
            chalk.gray(
              `   Template: ${check.documentVersion} -> ${check.templateVersion}`
            )
          );
        } else {
          upToDate.push(relPath);
        }
      } catch (error) {
        errors.push({
          file: path.relative(this.projectRoot, doc),
          error: (error as Error).message,
        });
        console.log(
          chalk.red(
            `[ERROR] ${path.relative(this.projectRoot, doc)}: ${(error as Error).message}`
          )
        );
      }
    }

    console.log(chalk.blue('\nSummary:\n'));
    console.log(chalk.yellow(`  Outdated:   ${outdated.length}`));
    console.log(chalk.green(`  Up to date: ${upToDate.length}`));
    console.log(chalk.red(`  Errors:     ${errors.length}`));

    return { outdated, upToDate, errors };
  }

  async sync(target: string | null = null, options: SyncOptions = {}): Promise<SyncResults> {
    const { dryRun = false } = options;

    console.log(
      chalk.blue(`\nTemplate Sync ${dryRun ? '(Dry Run)' : ''}\n`)
    );

    let filesToSync: string[] = [];

    if (target) {
      const fullPath = path.resolve(this.projectRoot, target);
      filesToSync = [fullPath];
    } else {
      const check = await this.checkAll();
      filesToSync = check.outdated.map((item) =>
        path.join(this.projectRoot, item.file)
      );
    }

    const results: SyncResults = {
      synced: [],
      skipped: [],
      errors: [],
    };

    for (const file of filesToSync) {
      const result = await this.syncDocument(file, { dryRun });

      if (result.status === 'synced') {
        results.synced.push(result);
        console.log(chalk.green(`\n[OK] ${result.file}`));
        console.log(chalk.gray(`  Template: ${result.templateVersion}`));
        console.log(chalk.gray(`  Document: ${result.documentVersion}`));
        if (result.changes?.added.length) {
          console.log(
            chalk.gray(`  Added fields: ${result.changes.added.join(', ')}`)
          );
        }
        if (result.changes?.updated.length) {
          console.log(
            chalk.gray(`  Updated fields: ${result.changes.updated.join(', ')}`)
          );
        }
      } else if (result.status === 'skipped') {
        results.skipped.push(result);
        console.log(
          chalk.yellow(
            `[SKIP] ${path.relative(this.projectRoot, file)} - ${result.reason}`
          )
        );
      } else if (result.status === 'error') {
        results.errors.push(result);
        console.log(chalk.red(`[ERROR] ${result.file} - ${result.error}`));
      }
    }

    console.log(chalk.blue('\nSync Summary:\n'));
    console.log(chalk.green(`  Synced:  ${results.synced.length}`));
    console.log(chalk.yellow(`  Skipped: ${results.skipped.length}`));
    console.log(chalk.red(`  Errors:  ${results.errors.length}`));

    if (dryRun) {
      console.log(chalk.yellow('\n[WARN] Dry run - no files were modified'));
    } else {
      console.log(chalk.green('\n[OK] Sync complete!'));
    }

    return results;
  }
}

export default TemplateSyncManager;
module.exports = TemplateSyncManager;
