import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

const { TemplateValidator } = require('../../validation/TemplateValidator');

interface ValidationIssue {
  file: string;
  type: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
  details?: any;
}

interface ValidationError {
  type?: string;
  field?: string;
  message?: string;
  severity?: string;
}

interface ValidationWarning {
  type?: string;
  message?: string;
}

interface ValidatorOptions {
  projectRoot?: string;
  verbose?: boolean;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  summary: ValidationSummary;
}

interface ValidationSummary {
  errorCount: number;
  warningCount: number;
  filesWithErrors: string[];
  filesWithWarnings: string[];
  totalFiles: number;
}

interface AutoFixResult {
  attempted: number;
  fixed: number;
  failed: number;
}

interface TemplateValidatorResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  fixed?: boolean;
}

class FrontmatterValidator {
  protected fixedFiles: string[];
  protected issues: ValidationIssue[];
  protected projectRoot: string;
  protected templateValidator: any;
  protected verbose: boolean;

  constructor(options: ValidatorOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;

    this.templateValidator = new TemplateValidator({
      projectRoot: this.projectRoot,
      verbose: this.verbose
    });

    this.issues = [];
    this.fixedFiles = [];
  }

  async validateFile(filePath: string): Promise<boolean> {
    try {
      const result: TemplateValidatorResult = await this.templateValidator.validateFile(filePath);

      if (!result.valid) {
        for (const error of result.errors || []) {
          this.issues.push({
            file: filePath,
            type: error.type || 'validation_error',
            field: error.field,
            message: error.message || String(error),
            severity: (error.severity as 'error' | 'warning') || 'error',
            details: error
          });
        }
      }

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
        message: `Error reading file: ${(error as Error).message}`,
        severity: 'error'
      });
      return false;
    }
  }

  async validateRequirements(requirementsDir: string): Promise<ValidationResult> {
    if (!fs.existsSync(requirementsDir)) {
      return {
        valid: false,
        issues: [
          {
            file: requirementsDir,
            type: 'directory_error',
            message: `Requirements directory does not exist: ${requirementsDir}`,
            severity: 'error'
          }
        ],
        summary: {
          errorCount: 1,
          warningCount: 0,
          filesWithErrors: [],
          filesWithWarnings: [],
          totalFiles: 0
        }
      };
    }

    const categories = fs
      .readdirSync(requirementsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .filter((dirent) => dirent.name !== 'to-fix')
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

  generateSummary(): ValidationSummary {
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

  printReport(): void {
    const summary = this.generateSummary();

    if (summary.errorCount === 0 && summary.warningCount === 0) {
      console.log(
        chalk.green('[OK] All requirement files have valid frontmatter')
      );
      return;
    }

    console.log(chalk.yellow('\nFrontmatter Validation Report'));
    console.log(chalk.yellow('====================================='));

    if (summary.errorCount > 0) {
      console.log(
        chalk.red(`\n[ERROR] ${summary.errorCount} critical issues found:`)
      );
      this.issues
        .filter((issue) => issue.severity === 'error')
        .forEach((issue) => {
          console.log(
            chalk.red(`  - ${path.basename(issue.file)}: ${issue.message}`)
          );
        });
    }

    if (summary.warningCount > 0) {
      console.log(
        chalk.yellow(`\n[WARN] ${summary.warningCount} warnings found:`)
      );
      this.issues
        .filter((issue) => issue.severity === 'warning')
        .forEach((issue) => {
          console.log(
            chalk.yellow(`  - ${path.basename(issue.file)}: ${issue.message}`)
          );
        });
    }

    console.log(chalk.cyan(`\nSummary:`));
    console.log(
      chalk.cyan(`  Files with errors: ${summary.filesWithErrors.length}`)
    );
    console.log(
      chalk.cyan(`  Files with warnings: ${summary.filesWithWarnings.length}`)
    );
    console.log(chalk.cyan(`  Total files checked: ${summary.totalFiles}`));

    if (summary.errorCount > 0) {
      console.log(chalk.red(`\nTo fix these issues:`));
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
        chalk.cyan(`\n  Or use auto-fix: sc docs validate --template --fix`)
      );
    }
  }

  async autoFix(filePath: string): Promise<boolean> {
    try {
      const fixResult: TemplateValidatorResult = await this.templateValidator.validateAndFix(filePath, {
        autoFix: true
      });

      if (fixResult.fixed) {
        this.fixedFiles.push(filePath);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to auto-fix ${filePath}:`, (error as Error).message);
      return false;
    }
  }

  async autoFixAll(): Promise<AutoFixResult> {
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

export default FrontmatterValidator;
module.exports = FrontmatterValidator;
