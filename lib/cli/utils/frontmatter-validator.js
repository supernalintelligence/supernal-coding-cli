const fs = require('node:fs');
const path = require('node:path');
const _matter = require('gray-matter');
const chalk = require('chalk');
const { TemplateValidator } = require('../../validation/TemplateValidator');

/**
 * Frontmatter Validator
 *
 * Now leverages the unified TemplateValidator system
 * for consistent validation across all document types
 */
class FrontmatterValidator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;

    // Initialize the unified template validator
    this.templateValidator = new TemplateValidator({
      projectRoot: this.projectRoot,
      verbose: this.verbose
    });

    this.issues = [];
    this.fixedFiles = [];
  }

  /**
   * Validate a single requirement file
   */
  async validateFile(filePath) {
    try {
      const result = await this.templateValidator.validateFile(filePath);

      // Convert TemplateValidator results to FrontmatterValidator format
      if (!result.valid) {
        for (const error of result.errors || []) {
          this.issues.push({
            file: filePath,
            type: error.type || 'validation_error',
            field: error.field,
            message: error.message || String(error),
            severity: error.severity || 'error',
            details: error
          });
        }
      }

      // Add warnings
      for (const warning of result.warnings || []) {
        this.issues.push({
          file: filePath,
          type: warning.type || 'validation_warning',
          message: warning.message || String(warning),
          severity: 'warning',
          details: warning
        });
      }

      return result.valid;
    } catch (error) {
      this.issues.push({
        file: filePath,
        type: 'file_error',
        message: `Error reading file: ${error.message}`,
        severity: 'error'
      });
      return false;
    }
  }

  /**
   * Validate all requirement files in a directory
   */
  async validateRequirements(requirementsDir) {
    const _issues = [];

    if (!fs.existsSync(requirementsDir)) {
      return {
        valid: false,
        issues: [
          {
            type: 'directory_error',
            message: `Requirements directory does not exist: ${requirementsDir}`,
            severity: 'error'
          }
        ]
      };
    }

    const categories = fs
      .readdirSync(requirementsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .filter((dirent) => dirent.name !== 'to-fix') // Exclude to-fix directory
      .map((dirent) => dirent.name);

    for (const category of categories) {
      const categoryPath = path.join(requirementsDir, category);
      const files = fs
        .readdirSync(categoryPath)
        .filter((file) => file.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        await this.validateFile(filePath);
      }
    }

    return {
      valid:
        this.issues.filter((issue) => issue.severity === 'error').length === 0,
      issues: this.issues,
      summary: this.generateSummary()
    };
  }

  /**
   * Generate a summary of validation issues
   */
  generateSummary() {
    const errorCount = this.issues.filter(
      (issue) => issue.severity === 'error'
    ).length;
    const warningCount = this.issues.filter(
      (issue) => issue.severity === 'warning'
    ).length;

    const filesWithErrors = [
      ...new Set(
        this.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => path.basename(issue.file))
      )
    ];

    const filesWithWarnings = [
      ...new Set(
        this.issues
          .filter((issue) => issue.severity === 'warning')
          .map((issue) => path.basename(issue.file))
      )
    ];

    return {
      errorCount,
      warningCount,
      filesWithErrors,
      filesWithWarnings,
      totalFiles: [...new Set(this.issues.map((issue) => issue.file))].length
    };
  }

  /**
   * Print validation report
   */
  printReport() {
    const summary = this.generateSummary();

    if (summary.errorCount === 0 && summary.warningCount === 0) {
      console.log(
        chalk.green('✅ All requirement files have valid frontmatter')
      );
      return;
    }

    console.log(chalk.yellow('\\n🔍 Frontmatter Validation Report'));
    console.log(chalk.yellow('====================================='));

    if (summary.errorCount > 0) {
      console.log(
        chalk.red(`\\n❌ ${summary.errorCount} critical issues found:`)
      );
      this.issues
        .filter((issue) => issue.severity === 'error')
        .forEach((issue) => {
          console.log(
            chalk.red(`  • ${path.basename(issue.file)}: ${issue.message}`)
          );
        });
    }

    if (summary.warningCount > 0) {
      console.log(
        chalk.yellow(`\\n⚠️  ${summary.warningCount} warnings found:`)
      );
      this.issues
        .filter((issue) => issue.severity === 'warning')
        .forEach((issue) => {
          console.log(
            chalk.yellow(`  • ${path.basename(issue.file)}: ${issue.message}`)
          );
        });
    }

    console.log(chalk.cyan(`\\n📊 Summary:`));
    console.log(
      chalk.cyan(`  Files with errors: ${summary.filesWithErrors.length}`)
    );
    console.log(
      chalk.cyan(`  Files with warnings: ${summary.filesWithWarnings.length}`)
    );
    console.log(chalk.cyan(`  Total files checked: ${summary.totalFiles}`));

    if (summary.errorCount > 0) {
      console.log(chalk.red(`\\n💡 To fix these issues:`));
      console.log(
        chalk.red(
          `  1. Check the files listed above for missing or invalid frontmatter`
        )
      );
      console.log(
        chalk.red(
          `  2. Ensure all required fields are present and correctly formatted`
        )
      );
      console.log(chalk.red(`  3. Run validation again to confirm fixes`));
      console.log(
        chalk.cyan(`\\n  Or use auto-fix: sc docs validate --template --fix`)
      );
    }
  }

  /**
   * Auto-fix common frontmatter issues
   */
  async autoFix(filePath) {
    try {
      const fixResult = await this.templateValidator.validateAndFix(filePath, {
        autoFix: true
      });

      if (fixResult.fixed) {
        this.fixedFiles.push(filePath);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to auto-fix ${filePath}:`, error.message);
      return false;
    }
  }

  /**
   * Auto-fix all files with issues
   */
  async autoFixAll() {
    const filesToFix = [
      ...new Set(
        this.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => issue.file)
      )
    ];

    let fixedCount = 0;

    for (const filePath of filesToFix) {
      const fixed = await this.autoFix(filePath);
      if (fixed) {
        fixedCount++;
      }
    }

    return {
      attempted: filesToFix.length,
      fixed: fixedCount,
      failed: filesToFix.length - fixedCount
    };
  }
}

module.exports = FrontmatterValidator;
