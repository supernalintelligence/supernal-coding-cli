#!/usr/bin/env node
// @ts-nocheck

/**
 * Smart Template Merge Tool
 *
 * Merges updated templates while preserving approval history and project-specific frontmatter.
 *
 * Usage:
 *   sc docs merge-templates                    # Merge all templates
 *   sc docs merge-templates --dry-run          # Show what would change
 *   sc docs merge-templates --path docs/workflow/sops/  # Specific path
 *   sc docs merge-templates --report           # Generate approval report
 *
 * Preserves:
 *   - reviewedBy, reviewDates, status, version
 *   - version_history (appends updates)
 *   - Any custom project-specific fields
 *
 * Updates:
 *   - All content after frontmatter
 *   - Structural frontmatter (type, category, sop_id, etc.)
 *   - created date (if missing)
 *   - updated date (to current)
 */

const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const crypto = require('node:crypto');

class TemplateMerger {
  errors: any;
  mergedFiles: any;
  needsReapproval: any;
  options: any;
  preserveFields: any;
  projectRoot: any;
  templateSource: any;
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.options = options;
    this.templateSource = path.join(
      projectRoot,
      'supernal-code-package/templates'
    );
    this.mergedFiles = [];
    this.needsReapproval = [];
    this.errors = [];

    // Fields to preserve from target (project docs)
    this.preserveFields = [
      'reviewedBy',
      'reviewDates',
      'status',
      'version',
      'version_history',
      'approvalNotes',
      'lastApprovedDate',
      'approvedBy',
      'projectSpecific', // For any custom fields
    ];
  }

  /**
   * Extract frontmatter and content from markdown
   */
  parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!match) {
      return {
        frontmatter: {},
        content: content.trim(),
        hasFrontmatter: false,
      };
    }

    try {
      const frontmatter = yaml.load(match[1]);
      return {
        frontmatter: frontmatter || {},
        content: match[2].trim(),
        hasFrontmatter: true,
      };
    } catch (error) {
      throw new Error(`Failed to parse YAML frontmatter: ${error.message}`);
    }
  }

  /**
   * Generate content hash for change detection
   */
  generateHash(content) {
    return crypto
      .createHash('md5')
      .update(content)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Merge frontmatter intelligently
   */
  mergeFrontmatter(templateFm, targetFm) {
    const merged = { ...templateFm }; // Start with template structure

    // Preserve approval/review fields from target
    for (const field of this.preserveFields) {
      if (targetFm[field] !== undefined) {
        merged[field] = targetFm[field];
      }
    }

    // Update timestamps appropriately
    if (!merged.created && targetFm.created) {
      merged.created = targetFm.created;
    }
    merged.updated = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    return merged;
  }

  /**
   * Add version history entry
   */
  addVersionHistoryEntry(frontmatter, changes, requiresReapproval = false) {
    if (!frontmatter.version_history) {
      frontmatter.version_history = [];
    }

    const entry = {
      version: frontmatter.version || '1.0',
      date: frontmatter.updated || new Date().toISOString().split('T')[0],
      changes: changes,
      requiresReapproval: requiresReapproval,
    };

    if (frontmatter.reviewedBy && frontmatter.reviewedBy.length > 0) {
      entry.lastApprovedBy = frontmatter.reviewedBy;
    }

    frontmatter.version_history.push(entry);

    // Increment version if content changed significantly
    if (requiresReapproval) {
      const [major, minor] = (frontmatter.version || '1.0').split('.');
      frontmatter.version = `${major}.${parseInt(minor || 0, 10) + 1}`;

      // Mark as needing re-approval
      frontmatter.status = 'pending-review';
    }

    return frontmatter;
  }

  /**
   * Merge a single file
   */
  async mergeFile(templatePath, targetPath) {
    try {
      // Read both files
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const targetExists = await fs.pathExists(targetPath);

      const templateParsed = this.parseFrontmatter(templateContent);

      if (!targetExists) {
        // New file - just copy template
        if (!this.options.dryRun) {
          await fs.ensureDir(path.dirname(targetPath));
          await fs.writeFile(targetPath, templateContent, 'utf8');
        }

        this.mergedFiles.push({
          path: path.relative(this.projectRoot, targetPath),
          action: 'created',
          requiresApproval: true,
        });
        return;
      }

      const targetContent = await fs.readFile(targetPath, 'utf8');
      const targetParsed = this.parseFrontmatter(targetContent);

      // Compare content hashes
      const templateHash = this.generateHash(templateParsed.content);
      const targetHash = this.generateHash(targetParsed.content);

      if (templateHash === targetHash) {
        // No content changes
        this.mergedFiles.push({
          path: path.relative(this.projectRoot, targetPath),
          action: 'unchanged',
          requiresApproval: false,
        });
        return;
      }

      // Content differs - merge intelligently
      const mergedFm = this.mergeFrontmatter(
        templateParsed.frontmatter,
        targetParsed.frontmatter
      );

      // Determine if changes require re-approval
      const requiresReapproval = this.assessReapprovalNeed(
        targetParsed.content,
        templateParsed.content
      );

      // Add version history
      const changes = this.summarizeChanges(
        targetParsed.content,
        templateParsed.content
      );
      const finalFm = this.addVersionHistoryEntry(
        mergedFm,
        changes,
        requiresReapproval
      );

      // Construct merged document
      const mergedContent = `---\n${yaml.dump(finalFm, { lineWidth: -1 })}---\n\n${templateParsed.content}\n`;

      if (!this.options.dryRun) {
        await fs.writeFile(targetPath, mergedContent, 'utf8');
      }

      this.mergedFiles.push({
        path: path.relative(this.projectRoot, targetPath),
        action: 'updated',
        requiresApproval: requiresReapproval,
        changes: changes,
        oldHash: targetHash,
        newHash: templateHash,
      });

      if (requiresReapproval) {
        this.needsReapproval.push({
          path: path.relative(this.projectRoot, targetPath),
          previousApprovers: targetParsed.frontmatter.reviewedBy || [],
          changes: changes,
        });
      }
    } catch (error) {
      this.errors.push({
        template: path.relative(this.projectRoot, templatePath),
        target: path.relative(this.projectRoot, targetPath),
        error: error.message,
      });
    }
  }

  /**
   * Assess if changes require re-approval
   */
  assessReapprovalNeed(oldContent, newContent) {
    // Significant changes that require re-approval
    const significantPatterns = [
      /## \d+\. /g, // Section heading changes
      /### [A-Z]/g, // Subsection changes
      /\*\*[A-Z][^*]+\*\*/g, // Bold important terms
      /```[\s\S]*?```/g, // Code blocks
      /\| .* \|/g, // Tables
    ];

    for (const pattern of significantPatterns) {
      const oldMatches = (oldContent.match(pattern) || []).length;
      const newMatches = (newContent.match(pattern) || []).length;

      // If count differs by more than 20%, needs re-approval
      if (
        oldMatches > 0 &&
        Math.abs(newMatches - oldMatches) / oldMatches > 0.2
      ) {
        return true;
      }
    }

    // Simple word count check - if >25% change, needs approval
    const oldWords = oldContent.split(/\s+/).length;
    const newWords = newContent.split(/\s+/).length;

    if (oldWords > 0 && Math.abs(newWords - oldWords) / oldWords > 0.25) {
      return true;
    }

    return false;
  }

  /**
   * Summarize what changed
   */
  summarizeChanges(oldContent, newContent) {
    const changes = [];

    const oldSections = oldContent.match(/## \d+\. [^\n]+/g) || [];
    const newSections = newContent.match(/## \d+\. [^\n]+/g) || [];

    if (newSections.length > oldSections.length) {
      changes.push(
        `Added ${newSections.length - oldSections.length} section(s)`
      );
    } else if (newSections.length < oldSections.length) {
      changes.push(
        `Removed ${oldSections.length - newSections.length} section(s)`
      );
    }

    const oldWords = oldContent.split(/\s+/).length;
    const newWords = newContent.split(/\s+/).length;
    const wordDiff = newWords - oldWords;

    if (Math.abs(wordDiff) > 50) {
      changes.push(
        `Content ${wordDiff > 0 ? 'expanded' : 'reduced'} by ~${Math.abs(wordDiff)} words`
      );
    }

    return changes.length > 0 ? changes.join('; ') : 'Minor content updates';
  }

  /**
   * Recursively merge templates for a directory
   */
  async mergeDirectory(templateDir, targetDir) {
    const items = await fs.readdir(templateDir, { withFileTypes: true });

    for (const item of items) {
      const templatePath = path.join(templateDir, item.name);
      const targetPath = path.join(targetDir, item.name);

      if (item.isDirectory()) {
        await this.mergeDirectory(templatePath, targetPath);
      } else if (item.isFile() && item.name.endsWith('.md')) {
        await this.mergeFile(templatePath, targetPath);
      }
    }
  }

  /**
   * Main execution
   */
  async run() {
    console.log(chalk.blue('🔄 Smart Template Merge\n'));

    // Determine what to merge
    const mergePaths = this.options.path
      ? [this.options.path]
      : [
          'docs/workflow',
          'docs/features',
          'templates/workflow',
          'templates/features',
        ];

    for (const mergePath of mergePaths) {
      const targetDir = path.join(this.projectRoot, mergePath);

      // Determine template source
      let templateDir;
      if (mergePath.startsWith('docs/')) {
        templateDir = path.join(
          this.templateSource,
          mergePath.replace('docs/', '')
        );
      } else if (mergePath.startsWith('templates/')) {
        templateDir = path.join(
          this.templateSource,
          mergePath.replace('templates/', '')
        );
      } else {
        console.log(chalk.yellow(`   ⚠️  Unknown path type: ${mergePath}`));
        continue;
      }

      if (!(await fs.pathExists(templateDir))) {
        console.log(chalk.gray(`   ⊘ No template source for ${mergePath}`));
        continue;
      }

      console.log(chalk.blue(`   📂 Merging ${mergePath}...`));
      await this.mergeDirectory(templateDir, targetDir);
    }

    // Generate report
    this.generateReport();
  }

  /**
   * Generate merge report
   */
  generateReport() {
    console.log(chalk.blue('\n📊 MERGE REPORT\n'));

    const created = this.mergedFiles.filter((f) => f.action === 'created');
    const updated = this.mergedFiles.filter((f) => f.action === 'updated');
    const unchanged = this.mergedFiles.filter((f) => f.action === 'unchanged');

    console.log(chalk.green(`✅ Created: ${created.length} files`));
    if (created.length > 0 && this.options.verbose) {
      created.forEach((f) => console.log(chalk.gray(`   + ${f.path}`)));
    }

    console.log(chalk.yellow(`📝 Updated: ${updated.length} files`));
    if (updated.length > 0 && this.options.verbose) {
      updated.forEach((f) => {
        console.log(chalk.gray(`   ~ ${f.path}`));
        if (f.changes) {
          console.log(chalk.gray(`     ${f.changes}`));
        }
      });
    }

    console.log(chalk.gray(`⊘ Unchanged: ${unchanged.length} files`));

    if (this.needsReapproval.length > 0) {
      console.log(
        chalk.red(
          `\n⚠️  ${this.needsReapproval.length} files need re-approval:\n`
        )
      );

      for (const file of this.needsReapproval) {
        console.log(chalk.yellow(`   📄 ${file.path}`));
        console.log(chalk.gray(`      Changes: ${file.changes}`));
        if (file.previousApprovers.length > 0) {
          console.log(
            chalk.gray(
              `      Previous approvers: ${file.previousApprovers.join(', ')}`
            )
          );
        }
      }

      console.log(chalk.blue(`\n💡 Next Steps:`));
      console.log(chalk.gray(`   1. Review changed files`));
      console.log(
        chalk.gray(`   2. Get re-approval from relevant stakeholders`)
      );
      console.log(chalk.gray(`   3. Update status to 'approved' when ready`));
      console.log(
        chalk.gray(
          `   4. Commit with: "docs: Template sync - re-approval required"`
        )
      );
    }

    if (this.errors.length > 0) {
      console.log(chalk.red(`\n❌ ${this.errors.length} errors:\n`));
      this.errors.forEach((e) => {
        console.log(chalk.red(`   ✗ ${e.target}`));
        console.log(chalk.gray(`     ${e.error}`));
      });
    }

    if (this.options.dryRun) {
      console.log(chalk.yellow('\n🔍 DRY RUN - No files were modified'));
    }

    // Write approval report if requested
    if (this.options.report && this.needsReapproval.length > 0) {
      this.writeApprovalReport();
    }
  }

  /**
   * Write approval report to .supernal/reports/
   */
  async writeApprovalReport() {
    const reportPath = path.join(
      this.projectRoot,
      '.supernal/reports/TEMPLATE_SYNC_APPROVAL_REQUIRED.md'
    );

    let report = `# Template Sync Approval Report\n\n`;
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Files Requiring Re-Approval**: ${this.needsReapproval.length}\n\n`;
    report += `## Policy\n\n`;
    report += `When templates are updated, documents must be re-approved if:\n`;
    report += `- Structural changes (>20% of sections changed)\n`;
    report += `- Content changes (>25% word count difference)\n`;
    report += `- Critical code blocks or tables modified\n\n`;
    report += `Minor updates (typos, formatting, clarifications <25%) do not require re-approval.\n\n`;
    report += `## Files Requiring Re-Approval\n\n`;

    for (const file of this.needsReapproval) {
      report += `### ${file.path}\n\n`;
      report += `**Changes**: ${file.changes}\n\n`;

      if (file.previousApprovers.length > 0) {
        report += `**Previous Approvers**: ${file.previousApprovers.join(', ')}\n\n`;
        report += `**Action Required**: Request re-approval from previous approvers or designated reviewers\n\n`;
      } else {
        report += `**Action Required**: Initial approval required\n\n`;
      }

      report += `**Approval Checklist**:\n`;
      report += `- [ ] Technical accuracy verified\n`;
      report += `- [ ] Consistency with related docs checked\n`;
      report += `- [ ] Examples validated\n`;
      report += `- [ ] Approved by: _____________ Date: _________\n\n`;
      report += `---\n\n`;
    }

    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeFile(reportPath, report, 'utf8');

    console.log(chalk.green(`\n📄 Approval report written to:`));
    console.log(
      chalk.gray(`   ${path.relative(this.projectRoot, reportPath)}`)
    );
  }
}

/**
 * CLI entry point
 */
async function mergeTemplatesCommand(options) {
  const projectRoot = process.cwd();
  const merger = new TemplateMerger(projectRoot, options);

  try {
    await merger.run();

    if (merger.needsReapproval.length > 0) {
      process.exit(1); // Exit with error code to signal re-approval needed
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Merge failed: ${error.message}`));
    process.exit(1);
  }
}

module.exports = { TemplateMerger, mergeTemplatesCommand };
