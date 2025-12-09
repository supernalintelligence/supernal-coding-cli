#!/usr/bin/env node

/**
 * Compliance Template Naming Audit
 *
 * Checks that all compliance templates have descriptive names
 * Not just: comp-iso27001-001.md
 * But: comp-iso27001-001-security-policy.md
 *
 * Also validates:
 * - ID in frontmatter matches filename
 * - Title is descriptive
 * - Filename has descriptive slug
 */

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

class TemplateNamingAuditor {
  constructor() {
    this.issues = [];
  }

  /**
   * Check if filename is descriptive
   * Bad: comp-iso27001-001.md
   * Good: comp-iso27001-001-security-policy.md
   */
  hasDescriptiveFilename(filename) {
    const parts = filename.replace('.md', '').split('-');
    // Format: comp-{framework}-{number}-{description}
    // Minimum 4 parts for descriptive name
    return parts.length >= 4;
  }

  /**
   * Extract slug from title
   * "Installation Qualification" -> "installation-qualification"
   */
  titleToSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Suggest better filename based on title
   */
  suggestFilename(currentFilename, title) {
    const match = currentFilename.match(/^(comp-[a-z0-9]+-\d+)/);
    if (!match) return null;

    const prefix = match[1];

    // Extract meaningful part of title
    // "COMP-ISO27001-001 - Security Policy" -> "Security Policy"
    const titlePart = title
      .replace(/^COMP-[A-Z0-9-]+\s*-\s*/, '') // Remove prefix
      .replace(/^REQ-[A-Z0-9-]+\s*-\s*/, ''); // Remove REQ prefix too

    const slug = this.titleToSlug(titlePart);
    return `${prefix}-${slug}.md`;
  }

  /**
   * Audit a single template file
   */
  async auditTemplate(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const filename = path.basename(filePath);
      const framework = path.basename(path.dirname(path.dirname(filePath)));

      // Extract metadata from frontmatter
      const idMatch = content.match(/^id:\s*(.+)$/m);
      const titleMatch = content.match(/^title:\s*(.+)$/m);

      if (!idMatch || !titleMatch) {
        return {
          filePath,
          filename,
          framework,
          issues: ['Missing frontmatter (id or title)'],
          severity: 'error'
        };
      }

      const id = idMatch[1].trim();
      const title = titleMatch[1].trim();

      const issues = [];
      let severity = 'ok';

      // Check 1: Does filename have descriptive slug?
      if (!this.hasDescriptiveFilename(filename)) {
        issues.push('Filename not descriptive (missing slug)');
        severity = 'warning';
      }

      // Check 2: Does ID match filename base?
      const filenameBase = filename.replace('.md', '');
      if (id !== filenameBase) {
        // Extract just the core ID part (comp-xxx-###)
        const coreId = filenameBase.match(/^(comp-[a-z0-9]+-\d+)/);
        const coreFrontmatterId = id.match(/^(comp-[a-z0-9]+-\d+)/);

        if (coreId && coreFrontmatterId && coreId[1] !== coreFrontmatterId[1]) {
          issues.push(
            `ID mismatch: frontmatter='${id}' filename='${filenameBase}'`
          );
          severity = 'error';
        }
      }

      // Check 3: Is title descriptive enough?
      if (title.length < 20) {
        issues.push('Title may be too short');
        if (severity === 'ok') severity = 'info';
      }

      // Generate suggestion
      const suggestedFilename = this.suggestFilename(filename, title);

      return {
        filePath,
        filename,
        framework,
        id,
        title,
        issues,
        severity,
        suggestedFilename:
          suggestedFilename !== filename ? suggestedFilename : null
      };
    } catch (error) {
      return {
        filePath,
        filename: path.basename(filePath),
        framework: 'unknown',
        issues: [error.message],
        severity: 'error',
        error: true
      };
    }
  }

  /**
   * Audit all templates in a framework
   */
  async auditFramework(frameworkPath) {
    const framework = path.basename(frameworkPath);
    const templatesPath = path.join(frameworkPath, 'templates');

    if (!(await fs.pathExists(templatesPath))) {
      return {
        framework,
        error: 'Templates directory not found',
        templates: []
      };
    }

    const files = await fs.readdir(templatesPath);
    const mdFiles = files.filter(
      (f) => f.endsWith('.md') && f.startsWith('comp-')
    );

    const results = await Promise.all(
      mdFiles.map((file) => this.auditTemplate(path.join(templatesPath, file)))
    );

    const stats = {
      total: results.length,
      ok: results.filter((r) => r.severity === 'ok').length,
      info: results.filter((r) => r.severity === 'info').length,
      warning: results.filter((r) => r.severity === 'warning').length,
      error: results.filter((r) => r.severity === 'error').length,
      needsRename: results.filter((r) => r.suggestedFilename).length
    };

    return {
      framework,
      stats,
      templates: results
    };
  }

  /**
   * Audit all frameworks
   */
  async auditAllFrameworks(
    complianceRoot = 'supernal-code-package/templates/compliance/frameworks'
  ) {
    const frameworksPath = path.resolve(complianceRoot);

    if (!(await fs.pathExists(frameworksPath))) {
      throw new Error(
        `Compliance frameworks directory not found: ${frameworksPath}`
      );
    }

    const frameworks = await fs.readdir(frameworksPath);
    const frameworkDirs = [];

    for (const fw of frameworks) {
      const fwPath = path.join(frameworksPath, fw);
      const stat = await fs.stat(fwPath);
      if (stat.isDirectory()) {
        frameworkDirs.push(fwPath);
      }
    }

    const results = await Promise.all(
      frameworkDirs.map((dir) => this.auditFramework(dir))
    );

    // Overall statistics
    const overallStats = {
      totalFrameworks: results.length,
      totalTemplates: results.reduce((sum, r) => sum + r.stats.total, 0),
      ok: results.reduce((sum, r) => sum + r.stats.ok, 0),
      info: results.reduce((sum, r) => sum + r.stats.info, 0),
      warning: results.reduce((sum, r) => sum + r.stats.warning, 0),
      error: results.reduce((sum, r) => sum + r.stats.error, 0),
      needsRename: results.reduce((sum, r) => sum + r.stats.needsRename, 0)
    };

    return {
      overall: overallStats,
      frameworks: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Display audit results
   */
  displayResults(results, options = {}) {
    console.log(chalk.bold('\n📋 Compliance Template Naming Audit\n'));

    // Overall statistics
    console.log(chalk.bold('Overall Statistics:'));
    console.log(`  Total Templates: ${results.overall.totalTemplates}`);
    console.log(`  ${chalk.green('OK')}: ${results.overall.ok}`);
    console.log(`  ${chalk.blue('Info')}: ${results.overall.info}`);
    console.log(`  ${chalk.yellow('Warnings')}: ${results.overall.warning}`);
    console.log(`  ${chalk.red('Errors')}: ${results.overall.error}`);
    console.log(
      `  ${chalk.cyan('Needs Rename')}: ${results.overall.needsRename}\n`
    );

    // Framework breakdown
    console.log(chalk.bold('Framework Breakdown:\n'));

    for (const fw of results.frameworks) {
      console.log(`  ${chalk.bold(fw.framework)}: ${fw.stats.total} templates`);
      console.log(
        `    OK: ${fw.stats.ok}, Warnings: ${chalk.yellow(fw.stats.warning)}, Errors: ${chalk.red(fw.stats.error)}`
      );
      console.log(`    Needs Rename: ${chalk.cyan(fw.stats.needsRename)}\n`);
    }

    // Show templates needing renaming
    if (options.showRenames) {
      console.log(
        chalk.bold.cyan('\n🔄 Templates Needing Descriptive Names:\n')
      );

      for (const fw of results.frameworks) {
        const needsRename = fw.templates.filter((t) => t.suggestedFilename);
        if (needsRename.length > 0) {
          console.log(
            chalk.yellow(`  ${fw.framework} (${needsRename.length} templates):`)
          );
          const limit = options.limit || 10;
          needsRename.slice(0, limit).forEach((template) => {
            console.log(`    ${chalk.cyan('→')} ${template.filename}`);
            console.log(
              `      ${chalk.green('Suggested')}: ${template.suggestedFilename}`
            );
            console.log(`      ${chalk.gray(template.title)}`);
          });
          if (needsRename.length > limit) {
            console.log(
              `    ${chalk.gray(`... and ${needsRename.length - limit} more`)}`
            );
          }
          console.log();
        }
      }
    }

    // Show errors
    if (options.showErrors) {
      const allErrors = [];
      for (const fw of results.frameworks) {
        allErrors.push(...fw.templates.filter((t) => t.severity === 'error'));
      }

      if (allErrors.length > 0) {
        console.log(chalk.bold.red('\n❌ Errors:\n'));
        allErrors.slice(0, options.limit || 10).forEach((template) => {
          console.log(`  ${chalk.red('✗')} ${template.filename}`);
          template.issues.forEach((issue) => {
            console.log(`    ${chalk.gray(issue)}`);
          });
        });
        if (allErrors.length > (options.limit || 10)) {
          console.log(
            `  ${chalk.gray(`... and ${allErrors.length - (options.limit || 10)} more errors`)}`
          );
        }
        console.log();
      }
    }

    // Summary recommendation
    console.log(chalk.bold('\n📋 Recommendation:\n'));
    if (results.overall.needsRename > results.overall.totalTemplates * 0.7) {
      console.log(
        chalk.yellow('  ⚠️  Most templates need descriptive filenames')
      );
      console.log(
        chalk.yellow('  → Run with --generate-renames to create rename script')
      );
      console.log(
        chalk.yellow(
          '  → Example: comp-iso27001-001.md → comp-iso27001-001-security-policy.md\n'
        )
      );
    } else if (results.overall.needsRename > 50) {
      console.log(chalk.blue('  ℹ️  Many templates could use better names'));
      console.log(chalk.blue('  → Consider batch renaming for consistency\n'));
    } else {
      console.log(chalk.green('  ✅ Most templates have descriptive names\n'));
    }
  }

  /**
   * Generate rename script
   */
  async generateRenameScript(results, outputPath) {
    const renames = [];

    for (const fw of results.frameworks) {
      for (const template of fw.templates) {
        if (template.suggestedFilename) {
          renames.push({
            framework: fw.framework,
            oldPath: template.filePath,
            oldFilename: template.filename,
            newFilename: template.suggestedFilename,
            title: template.title
          });
        }
      }
    }

    // Generate bash script
    let script = '#!/bin/bash\n\n';
    script += '# Compliance Template Rename Script\n';
    script += `# Generated: ${new Date().toISOString()}\n`;
    script += `# Total renames: ${renames.length}\n\n`;
    script += 'set -e\n\n';
    script += 'echo "🔄 Renaming compliance templates..."\n\n';

    for (const rename of renames) {
      const dir = path.dirname(rename.oldPath);
      const newPath = path.join(dir, rename.newFilename);
      script += `# ${rename.title}\n`;
      script += `git mv "${rename.oldPath}" "${newPath}"\n\n`;
    }

    script += `echo "✅ Renamed ${renames.length} templates"\n`;

    await fs.writeFile(outputPath, script, { mode: 0o755 });
    console.log(chalk.green(`\n✅ Rename script saved to ${outputPath}`));
    console.log(
      chalk.yellow(
        `   Review the script, then run: ./${path.basename(outputPath)}`
      )
    );

    return renames.length;
  }
}

module.exports = TemplateNamingAuditor;

// CLI usage
if (require.main === module) {
  const { program } = require('commander');

  program
    .name('audit-template-names')
    .description('Audit compliance template filenames for descriptive names')
    .option(
      '-p, --path <path>',
      'Path to compliance frameworks',
      'supernal-code-package/templates/compliance/frameworks'
    )
    .option('-r, --show-renames', 'Show templates needing rename', false)
    .option('-e, --show-errors', 'Show error details', false)
    .option('-l, --limit <number>', 'Limit results shown', '20')
    .option('-g, --generate-renames <file>', 'Generate rename script', null)
    .parse();

  const options = program.opts();

  (async () => {
    try {
      const auditor = new TemplateNamingAuditor();
      const results = await auditor.auditAllFrameworks(options.path);

      auditor.displayResults(results, {
        showRenames: options.showRenames,
        showErrors: options.showErrors,
        limit: parseInt(options.limit, 10)
      });

      if (options.generateRenames) {
        await auditor.generateRenameScript(results, options.generateRenames);
      }

      process.exit(results.overall.error > 0 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      console.error(error.stack);
      process.exit(1);
    }
  })();
}
