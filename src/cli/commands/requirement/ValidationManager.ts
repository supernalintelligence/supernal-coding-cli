// @ts-nocheck
// TODO: This file needs extensive refactoring to have consistent return types
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import type RequirementManager from './RequirementManager';

// These modules are still JS, use require
const RequirementHelpers = require('./utils/helpers');
const { TemplateValidator } = require('../../../validation/TemplateValidator');
const { extractFrontmatter } = require('./utils/parsers');

/** Helper function to escape regex special characters */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Validation result for a requirement */
export interface ValidationResult {
  valid: boolean;
  score?: number;
  maxScore?: number;
  percentage?: number;
  issues?: ValidationIssue[];
  errors?: string[];
  warnings?: string[];
  changes?: Array<{ from: string; to: string; applied?: boolean }>;
  brokenDependencies?: string[];
  [key: string]: unknown;
}

/** A single validation issue */
export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  line?: number;
}

/** Section validation definition */
interface SectionPattern {
  pattern: RegExp;
  name: string;
  points: number;
}

/**
 * Handles all validation operations for requirements
 */
class ValidationManager {
  protected requirementManager: RequirementManager;
  protected templateValidator: InstanceType<typeof TemplateValidator>;

  constructor(requirementManager: RequirementManager) {
    this.requirementManager = requirementManager;
    this.templateValidator = new TemplateValidator({
      projectRoot: (requirementManager as unknown as { projectRoot: string }).projectRoot || process.cwd(),
    });
  }

  /**
   * Validate requirement content (Gherkin, sections, etc.)
   */
  async validateRequirementContent(reqFile: string, reqId: string | number): Promise<ValidationResult> {
    const content = await fs.readFile(reqFile, 'utf8');

    let validationScore = 0;
    let maxScore = 0;
    const issues = [];

    // Check for required sections
    const requiredSections = [
      { pattern: /# REQ-\d+:/, name: 'Requirement title', points: 2 },
      { pattern: /## Overview/, name: 'Overview section', points: 2 },
      { pattern: /## User Story/, name: 'User story', points: 2 },
      {
        pattern: /## Acceptance Criteria/,
        name: 'Acceptance criteria',
        points: 3,
      },
      { pattern: /```gherkin/, name: 'Gherkin scenarios', points: 3 },
      {
        pattern: /Given.*When.*Then/,
        name: 'Given-When-Then structure',
        points: 3,
      },
      {
        pattern: /## Technical Implementation/,
        name: 'Technical implementation',
        points: 2,
      },
      { pattern: /## Test Strategy/, name: 'Test strategy', points: 2 },
    ];

    console.log(chalk.blue(`\n📋 Validating Content for REQ-${reqId}:`));

    for (const section of requiredSections) {
      maxScore += section.points;

      if (section.pattern.test(content)) {
        validationScore += section.points;
        console.log(chalk.green(`✅ ${section.name} (${section.points} pts)`));
      } else {
        console.log(chalk.red(`❌ ${section.name} (${section.points} pts)`));
        issues.push(`Missing: ${section.name}`);
      }
    }

    // Additional quality checks
    const scenarios = (content.match(/Scenario:/g) || []).length;
    if (scenarios < 2) {
      issues.push(
        `Only ${scenarios} scenario(s) found. Consider adding more scenarios for edge cases.`
      );
    } else {
      console.log(
        chalk.green(`✅ Good scenario coverage (${scenarios} scenarios)`)
      );
      validationScore += 1;
      maxScore += 1;
    }

    // Check for placeholders
    const placeholders = content.match(/\{\{.*?\}\}/g) || [];
    if (placeholders.length > 0) {
      issues.push(
        `${placeholders.length} placeholder(s) found: ${placeholders.slice(0, 3).join(', ')}`
      );
    } else {
      console.log(chalk.green('✅ No placeholders found'));
      validationScore += 1;
      maxScore += 1;
    }

    // Calculate score
    const percentage = Math.round((validationScore / maxScore) * 100);
    console.log(
      chalk.blue(
        `\n📊 Content Validation Score: ${validationScore}/${maxScore} (${percentage}%)`
      )
    );

    if (percentage >= 90) {
      console.log(
        chalk.green('🎉 Excellent! Requirement content is well-defined.')
      );
    } else if (percentage >= 70) {
      console.log(chalk.yellow('⚠️  Good content, but could be improved.'));
    } else {
      console.log(chalk.red('❌ Content needs significant improvement.'));
    }

    if (issues.length > 0) {
      console.log(chalk.red('\n🚨 Content issues to address:'));
      for (const issue of issues) {
        console.log(chalk.red(`   • ${issue}`));
      }
    }

    return { score: percentage, issues };
  }

  /**
   * Validate requirement naming (ID, filename, title consistency)
   * Now uses TemplateValidator for naming pattern validation
   */
  async validateRequirementNaming(reqFile: string, _reqId: string | number): Promise<ValidationResult> {
    console.log(
      chalk.blue(`\n🏷️  Validating Naming for: ${path.basename(reqFile)}`)
    );
    console.log(chalk.gray(`   Full path: ${reqFile}`));

    const errors = [];
    const warnings = [];
    const changes = [];

    // Use TemplateValidator for filename validation
    const filenameResult = this.templateValidator.validateFilename(reqFile);

    if (!filenameResult.valid) {
      errors.push({
        type: 'filename_pattern',
        message: filenameResult.message,
        actual: filenameResult.actual,
        expected: filenameResult.expected,
      });
    }

    // Continue with content-based naming validation
    const content = await fs.readFile(reqFile, 'utf8');
    const fileName = path.basename(reqFile, '.md');

    // Extract domain, number, and description from filename
    const fileNameMatch = fileName.match(
      /^(req|story|arch|test|prob)-([a-z0-9]+)-(\d+)-(.+)$/
    );

    if (fileNameMatch) {
      const [, prefix, domain, num, description] = fileNameMatch;
      const expectedId = `${prefix.toUpperCase()}-${domain.toUpperCase()}-${num.padStart(3, '0')}-${description.toUpperCase().replace(/-/g, '-')}`;

      // Extract ID from frontmatter
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (yamlMatch) {
        const yamlContent = yamlMatch[1];
        const idMatch = yamlContent.match(/^id:\s*(.+)$/m);

        if (idMatch) {
          const actualId = idMatch[1].trim();

          if (actualId !== expectedId) {
            errors.push({
              type: 'id_mismatch',
              message: `ID "${actualId}" should be "${expectedId}" based on filename`,
              actual: actualId,
              expected: expectedId,
            });
            changes.push({
              type: 'id_change',
              from: actualId,
              to: expectedId,
              line: this.findLineNumber(content, `id: ${actualId}`),
            });
          }
        } else {
          errors.push({
            type: 'missing_id',
            message: 'Missing required "id" field in frontmatter',
            expected: expectedId,
          });
        }
      }

      // Extract and validate title
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        const actualTitle = titleMatch[1];

        if (!actualTitle.startsWith(expectedId)) {
          warnings.push({
            type: 'title_mismatch',
            message: `Title should start with "${expectedId}:"`,
            actual: actualTitle,
            expected: `${expectedId}: [Description]`,
          });
          changes.push({
            type: 'title_change',
            from: actualTitle,
            to: `${expectedId}: ${actualTitle.replace(/^[A-Z]+-[A-Z0-9]+-[0-9]+-[A-Z0-9-]+:\s*/, '')}`,
            line: this.findLineNumber(content, `# ${actualTitle}`),
          });
        }
      }
    }

    // Display results
    const valid = errors.length === 0;

    if (valid && warnings.length === 0) {
      console.log(chalk.green('✅ File naming is consistent'));
    } else {
      if (errors.length > 0) {
        console.log(chalk.red(`❌ ${errors.length} naming error(s) found:`));
        errors.forEach((error) => {
          console.log(chalk.red(`   • ${error.message}`));
          if (error.expected && error.actual) {
            console.log(chalk.red(`     Expected: ${error.expected}`));
            console.log(chalk.red(`     Actual: ${error.actual}`));
          }
        });
      }

      if (warnings.length > 0) {
        console.log(chalk.yellow(`⚠️  ${warnings.length} naming warning(s):`));
        warnings.forEach((warning) => {
          console.log(chalk.yellow(`   • ${warning.message}`));
        });
      }
    }

    return { valid, errors, warnings, changes };
  }

  /**
   * Validate requirement dependencies - check if all referenced dependencies exist
   */
  async validateDependencies(reqFile: string, _reqId: string | number): Promise<ValidationResult> {
    const content = await fs.readFile(reqFile, 'utf8');
    const errors = [];
    const warnings = [];
    const brokenDependencies = [];

    // Extract dependencies from YAML frontmatter
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (yamlMatch) {
      const yamlContent = yamlMatch[1];
      const depsMatch = yamlContent.match(/dependencies:\s*\[(.*?)\]/s);

      if (depsMatch) {
        const depsStr = depsMatch[1];
        // Parse dependency IDs - handle both quoted and unquoted
        const depIds = depsStr
          .split(',')
          .map((d) => d.trim().replace(/['"]/g, ''))
          .filter((d) => d.length > 0);

        if (depIds.length > 0) {
          // Get all requirement files to check against
          const allFiles =
            await this.requirementManager.getAllDocumentFiles();
          const allReqIds = allFiles.map((f) =>
            RequirementHelpers.extractReqIdFromFile(f)
          );

          // Check each dependency
          for (const depId of depIds) {
            if (!allReqIds.includes(depId)) {
              brokenDependencies.push(depId);
              errors.push(`Dependency '${depId}' not found - broken link`);
            }
          }
        }
      }
    }

    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings,
      brokenDependencies,
      message: valid
        ? 'All dependencies are valid'
        : `Found ${brokenDependencies.length} broken ${brokenDependencies.length === 1 ? 'dependency' : 'dependencies'}`,
    };
  }

  /**
   * Validate all requirements with batch processing
   */
  async validateAllRequirements(options: { dryRun?: boolean; fix?: boolean; verbose?: boolean; naming?: boolean; all?: boolean; dependencies?: boolean } = {}): Promise<{ valid: number; invalid: number; total: number; results: Array<{ id: string; valid: boolean }> } | ValidationResult[]> {
    try {
      console.log(chalk.blue('🔍 Scanning all requirement files...\n'));

      const files = await this.requirementManager.getAllDocumentFiles();
      const results = [];
      let totalErrors = 0;
      let totalWarnings = 0;
      let validFiles = 0;

      for (const file of files) {
        const reqFile = await this.requirementManager.findRequirementFile(file);
        if (reqFile) {
          const reqId = RequirementHelpers.extractReqIdFromFile(file);

          try {
            if (options.naming || options.all) {
              const namingResult = await this.validateRequirementNaming(
                reqFile,
                reqId
              );

              results.push({
                file,
                path: reqFile,
                reqId,
                naming: namingResult,
              });

              if (namingResult.valid && namingResult.warnings.length === 0) {
                validFiles++;
              } else {
                totalErrors += namingResult.errors.length;
                totalWarnings += namingResult.warnings.length;
              }
            }

            // Add dependency validation
            if (options.dependencies || options.all) {
              const depsResult = await this.validateDependencies(
                reqFile,
                reqId
              );

              // Add to or update the result object
              const existingResult = results.find((r) => r.file === file);
              if (existingResult) {
                existingResult.dependencies = depsResult;
              } else {
                results.push({
                  file,
                  path: reqFile,
                  reqId,
                  dependencies: depsResult,
                });
              }

              if (!depsResult.valid) {
                totalErrors += depsResult.errors.length;
              }
            }
          } catch (error) {
            console.log(
              chalk.red(`❌ Error validating ${file}: ${error.message}`)
            );
          }
        }
      }

      // Display summary
      console.log(chalk.blue('\n📊 VALIDATION SUMMARY'));
      console.log(chalk.blue('═'.repeat(50)));
      console.log(`Total Files:     ${results.length}`);
      console.log(`✅ Valid:        ${validFiles}`);
      console.log(`❌ Invalid:      ${results.length - validFiles}`);
      console.log(`🔴 Errors:       ${totalErrors}`);
      console.log(`🟡 Warnings:     ${totalWarnings}`);

      // Show detailed results if requested
      if (options.verbose || options['dry-run']) {
        this.displayDetailedResults(results, options);
      }

      return results;
    } catch (error) {
      console.error(
        chalk.red(`❌ Error validating all requirements: ${error.message}`)
      );
      throw error;
    }
  }

  /**
   * Display detailed validation results
   */
  displayDetailedResults(results, options = {}) {
    const invalidNaming = results.filter(
      (r) => !r.naming?.valid || r.naming?.warnings?.length > 0
    );
    const brokenDeps = results.filter(
      (r) => r.dependencies && !r.dependencies.valid
    );

    // Show naming issues
    if (invalidNaming.length > 0) {
      console.log(
        chalk.red(`\n❌ FILES WITH NAMING ISSUES (${invalidNaming.length}):`)
      );
      console.log(chalk.red('─'.repeat(50)));

      invalidNaming.forEach((result, index) => {
        const fullPath = result.path;
        const relativePath = result.file;
        console.log(`\n${index + 1}. ${chalk.cyan(relativePath)}`);
        console.log(`   ${chalk.gray('Full path:')} ${chalk.dim(fullPath)}`);

        if (result.naming?.errors?.length > 0) {
          result.naming.errors.forEach((error) => {
            console.log(`   🔴 ${error.message}`);
            if (error.expected && error.actual) {
              console.log(`      Expected: ${chalk.green(error.expected)}`);
              console.log(`      Actual:   ${chalk.red(error.actual)}`);
            }
          });
        }

        if (result.naming?.warnings?.length > 0) {
          result.naming.warnings.forEach((warning) => {
            console.log(`   🟡 ${warning.message}`);
          });
        }

        // Show diff if dry-run
        if (options['dry-run'] && result.naming?.changes?.length > 0) {
          console.log(`   ${chalk.blue('Changes that would be made:')}`);
          result.naming.changes.forEach((change) => {
            console.log(`   ${chalk.red(`-   ${change.from}`)}`);
            console.log(`   ${chalk.green(`+   ${change.to}`)}`);
          });
        }
      });
    } else if (results.some((r) => r.naming)) {
      console.log(chalk.green('\n🎉 All files have consistent naming!'));
    }

    // Show dependency issues
    if (brokenDeps.length > 0) {
      console.log(
        chalk.red(
          `\n⚠️  FILES WITH BROKEN DEPENDENCIES (${brokenDeps.length}):`
        )
      );
      console.log(chalk.red('─'.repeat(50)));

      brokenDeps.forEach((result, index) => {
        console.log(`\n${index + 1}. ${chalk.cyan(result.file)}`);
        console.log(`   Requirement: ${chalk.yellow(result.reqId)}`);
        console.log(chalk.red('   Broken dependencies:'));
        result.dependencies.brokenDependencies.forEach((depId) => {
          console.log(chalk.red(`   • ${depId} (not found)`));
        });
        console.log(
          chalk.dim(
            `   Fix: Update or remove these dependency references in the YAML frontmatter`
          )
        );
      });
    } else if (results.some((r) => r.dependencies)) {
      console.log(chalk.green('\n🎉 All dependencies are valid!'));
    }

    if (options['dry-run'] && invalidNaming.length > 0) {
      console.log(chalk.blue('\n💡 To apply these changes:'));
      console.log(`   ${chalk.cyan('sc req fix-naming --all')}`);
    } else {
      console.log(chalk.blue('\n💡 To see exact changes:'));
      console.log(`   ${chalk.cyan('sc req validate-all --dry-run')}`);
      console.log(chalk.blue('💡 To apply fixes:'));
      console.log(`   ${chalk.cyan('sc req fix-naming --all')}`);
    }
  }

  /**
   * Fix naming for a single requirement
   */
  async fixNaming(reqId, options = {}) {
    try {
      const reqFile = await this.requirementManager.findRequirementById(reqId);
      if (!reqFile) {
        throw new Error(`Requirement ${reqId} not found`);
      }

      const namingResult = await this.validateRequirementNaming(reqFile, reqId);

      if (namingResult.valid && namingResult.warnings.length === 0) {
        console.log(chalk.green(`✅ ${reqId} naming is already consistent`));
        return true;
      }

      if (!options.force && !options.yes) {
        console.log(chalk.yellow(`\n⚠️  About to fix naming for ${reqId}:`));
        namingResult.changes?.forEach((change) => {
          console.log(`   ${chalk.red(`- ${change.from}`)}`);
          console.log(`   ${chalk.green(`+ ${change.to}`)}`);
        });

        console.log(chalk.blue('\n💡 Use --yes flag to skip confirmation'));
        return false;
      }

      // Apply fixes
      const content = await fs.readFile(reqFile, 'utf8');
      let updatedContent = content;

      // Fix ID in frontmatter
      const idChange = namingResult.changes?.find(
        (c) => c.type === 'id_change'
      );
      if (idChange) {
        updatedContent = updatedContent.replace(
          new RegExp(
            `^id:\\s*${idChange.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'm'
          ),
          `id: ${idChange.to}`
        );
      }

      // Fix title
      const titleChange = namingResult.changes?.find(
        (c) => c.type === 'title_change'
      );
      if (titleChange) {
        updatedContent = updatedContent.replace(
          new RegExp(
            `^#\\s+${titleChange.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'm'
          ),
          `# ${titleChange.to}`
        );
      }

      // Write updated content
      await fs.writeFile(reqFile, updatedContent);

      console.log(chalk.green(`✅ Fixed naming for ${reqId}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error fixing naming: ${error.message}`));
      throw error;
    }
  }

  /**
   * Fix naming for all requirements
   */
  async fixAllNaming(options = {}) {
    try {
      console.log(chalk.blue('🔧 Fixing naming for all requirements...\n'));

      const results = await this.validateAllRequirements({ naming: true });
      const invalidResults = results.filter(
        (r) => !r.naming?.valid || r.naming?.warnings?.length > 0
      );

      if (invalidResults.length === 0) {
        console.log(
          chalk.green('🎉 All files already have consistent naming!')
        );
        return;
      }

      if (!options.yes) {
        console.log(
          chalk.yellow(`⚠️  About to fix ${invalidResults.length} files:`)
        );
        invalidResults.slice(0, 5).forEach((result) => {
          console.log(`   • ${result.file}`);
        });
        if (invalidResults.length > 5) {
          console.log(`   • ... and ${invalidResults.length - 5} more`);
        }
        console.log(
          chalk.blue('\n💡 Use --yes flag to proceed without confirmation')
        );
        return;
      }

      let fixedCount = 0;
      for (const result of invalidResults) {
        try {
          // Fix naming directly using the file path and extracted ID
          const reqId = RequirementHelpers.extractReqIdFromFile(result.file);
          const success = await this.fixNamingDirect(result.path, reqId, {
            yes: true,
            force: true,
          });
          if (success) {
            fixedCount++;
          }
        } catch (error) {
          console.log(
            chalk.red(`❌ Failed to fix ${result.file}: ${error.message}`)
          );
        }
      }

      console.log(
        chalk.green(
          `\n🎉 Fixed ${fixedCount} out of ${invalidResults.length} files`
        )
      );
    } catch (error) {
      console.error(chalk.red(`❌ Error fixing all naming: ${error.message}`));
      throw error;
    }
  }

  /**
   * Fix naming issues for a specific requirement file (direct file path version)
   */
  async fixNamingDirect(reqFile, reqId, options = {}) {
    try {
      if (!fs.existsSync(reqFile)) {
        throw new Error(`File not found: ${reqFile}`);
      }

      const namingResult = await this.validateRequirementNaming(reqFile, reqId);

      if (namingResult.valid && namingResult.warnings.length === 0) {
        console.log(
          chalk.green(
            `✅ ${path.basename(reqFile)} naming is already consistent`
          )
        );
        return true;
      }

      if (!options.force && !options.yes) {
        console.log(
          chalk.yellow(
            `\n⚠️  About to fix naming for ${path.basename(reqFile)}:`
          )
        );
        namingResult.changes?.forEach((change) => {
          console.log(`   ${chalk.red(`- ${change.from}`)}`);
          console.log(`   ${chalk.green(`+ ${change.to}`)}`);
        });

        // In a real implementation, you'd prompt for confirmation here
        // For now, we'll proceed if options.yes is true
      }

      // Read the current content
      let content = await fs.readFile(reqFile, 'utf8');
      let modified = false;

      // Apply the changes from the validation result
      if (namingResult.changes) {
        for (const change of namingResult.changes) {
          if (change.type === 'id_change') {
            // Replace the ID in the frontmatter
            const idRegex = new RegExp(
              `^id:\\s*["']?${escapeRegex(change.from)}["']?`,
              'm'
            );
            if (idRegex.test(content)) {
              content = content.replace(idRegex, `id: "${change.to}"`);
              modified = true;
              console.log(
                chalk.cyan(`   ✏️  Updated ID: ${change.from} → ${change.to}`)
              );
            }
          } else if (change.type === 'title_change') {
            // Replace the title in the markdown header
            const titleRegex = new RegExp(
              `^#\\s+${escapeRegex(change.from)}`,
              'm'
            );
            if (titleRegex.test(content)) {
              content = content.replace(titleRegex, `# ${change.to}`);
              modified = true;
              console.log(
                chalk.cyan(
                  `   ✏️  Updated Title: ${change.from} → ${change.to}`
                )
              );
            }
          }
        }
      }

      if (modified) {
        await fs.writeFile(reqFile, content, 'utf8');
        console.log(
          chalk.green(`✅ Fixed naming for ${path.basename(reqFile)}`)
        );
        return true;
      } else {
        console.log(
          chalk.yellow(`⚠️  No changes applied to ${path.basename(reqFile)}`)
        );
        return false;
      }
    } catch (error) {
      console.error(
        chalk.red(`❌ Error fixing naming for ${reqFile}: ${error.message}`)
      );
      throw error;
    }
  }

  findLineNumber(content, searchText) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 1;
  }
}

export default ValidationManager;
module.exports = ValidationManager;
