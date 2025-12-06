#!/usr/bin/env node

/**
 * SC Date Validation Command
 *
 * Provides the `sc date-validate` command interface for detecting and fixing
 * hardcoded dates that don't match actual file creation/modification dates.
 */

const chalk = require('chalk');
const DateValidator = require('./validation/date-validator');

class DateValidateCommand {
  constructor() {
    this.validator = null;
  }

  showHelp() {
    console.log(chalk.blue('📅 SC Date Validation System'));
    console.log(chalk.blue('='.repeat(40)));
    console.log('');
    console.log(
      "Detects and fixes hardcoded dates that don't match actual file dates."
    );
    console.log('');
    console.log(chalk.bold('Usage:'));
    console.log('  sc date-validate [options]');
    console.log('');
    console.log(chalk.bold('Options:'));
    console.log('  --file=<path>      Validate specific file');
    console.log('  --fix              Fix detected issues automatically');
    console.log(
      '  --dry-run          Show what would be fixed without making changes'
    );
    console.log('  --verbose, -v      Show detailed output');
    console.log('  --help, -h         Show this help message');
    console.log('');
    console.log(chalk.bold('Examples:'));
    console.log('  sc date-validate                    # Validate all files');
    console.log('  sc date-validate --fix              # Fix all date issues');
    console.log(
      '  sc date-validate --file=README.md   # Validate specific file'
    );
    console.log(
      '  sc date-validate --dry-run --fix    # Preview fixes without applying'
    );
    console.log('');
    console.log(chalk.bold('Integration with Pre-commit:'));
    console.log(
      '  This command is automatically run during pre-commit validation.'
    );
    console.log('  To skip: SC_SKIP_DATE_VALIDATION=true git commit');
    console.log('');
    console.log(chalk.bold('Common Date Patterns Detected:'));
    console.log('  • YAML frontmatter: created, updated, createdAt, updatedAt');
    console.log(
      '  • JSON fields: "createdAt", "created", "updatedAt", "updated"'
    );
    console.log('  • Markdown: created: YYYY-MM-DD, updated: YYYY-MM-DD');
    console.log('  • ISO timestamps: 2024-01-01T00:00:00Z');
  }

  async execute(options = {}) {
    try {
      // Initialize validator with options
      this.validator = new DateValidator({
        verbose: options.verbose,
        dryRun: options.dryRun,
        projectRoot: process.cwd(),
      });

      if (options.file) {
        return await this.validateSingleFile(options.file, options);
      } else {
        return await this.validateProject(options);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Date validation error: ${error.message}`));
      if (options.verbose) {
        console.error(error.stack);
      }
      throw error;
    }
  }

  async validateSingleFile(filePath, options) {
    console.log(chalk.blue(`🔍 Validating dates in ${filePath}...`));

    const result = this.validator.validateFile(filePath);

    if (result.error) {
      console.log(chalk.red(`❌ Error: ${result.error}`));
      return { success: false, error: result.error };
    }

    if (result.valid) {
      console.log(chalk.green(`✅ All dates are valid in ${filePath}`));
      return { success: true, issues: 0 };
    }

    // Show issues with type breakdown
    console.log(chalk.red(`❌ Found ${result.issues.length} date issues:`));

    // Analyze issue types
    const issueBreakdown = {
      formatUpgrade: 0,
      dateCorrection: 0,
      standardization: 0,
    };

    for (const issue of result.issues) {
      console.log(chalk.yellow(`\n  📍 Line ${issue.line}: ${issue.field}`));
      console.log(`     Issue: ${issue.validation.reason}`);

      if (issue.suggestedFix?.gitPatch) {
        // Show actual git patch
        console.log(
          chalk.gray(`\n     Git patch (can be applied with 'git apply'):`)
        );
        console.log(chalk.cyan(issue.suggestedFix.gitPatch));
        console.log(chalk.gray(`     Type: ${issue.suggestedFix.explanation}`));

        // Count issue types
        switch (issue.suggestedFix.fixType) {
          case 'format_upgrade':
            issueBreakdown.formatUpgrade++;
            break;
          case 'date_mismatch':
            issueBreakdown.dateCorrection++;
            break;
          case 'standardize':
            issueBreakdown.standardization++;
            break;
        }
      }
    }

    // Show issue type summary
    console.log(chalk.blue('\n📊 Issue Type Breakdown:'));
    console.log(
      `  🎯 Format upgrades: ${issueBreakdown.formatUpgrade} (non-standard formats → ISO 8601 UTC)`
    );
    console.log(
      `  📅 Date corrections: ${issueBreakdown.dateCorrection} (hallucinated dates → actual file dates)`
    );
    console.log(
      `  🔄 Full standardization: ${issueBreakdown.standardization} (both format + date issues)`
    );

    // Apply fixes if requested
    if (options.fix) {
      const fixes = result.issues
        .map((issue) => issue.suggestedFix)
        .filter(Boolean);
      const fixResult = this.validator.fixFile(filePath, fixes);

      if (fixResult.fixed) {
        console.log(chalk.green(`✅ Fixed ${fixResult.count} dates`));

        // Suggest git commit command for single file
        console.log(chalk.blue('\n📝 Suggested commit:'));
        console.log(
          chalk.cyan(`git add "${filePath}" && git commit -m "fix: standardize ${fixResult.count} dates in ${require('node:path').basename(filePath)}

- Format upgrades: ${issueBreakdown.formatUpgrade} (non-standard → ISO 8601 UTC)
- Date corrections: ${issueBreakdown.dateCorrection} (hallucinated → actual file dates)
- Full standardization: ${issueBreakdown.standardization} (both format + date fixes)"`)
        );

        return { success: true, fixed: fixResult.count };
      } else if (fixResult.dryRun) {
        // Don't show duplicate "[DRY RUN]" - already shown above

        // Show what the commit would look like
        console.log(chalk.blue('\n📝 Commit after fixing would be:'));
        console.log(
          chalk.cyan(`git add "${filePath}" && git commit -m "fix: correct ${fixes.length} hallucinated dates in ${require('node:path').basename(filePath)}

- Hallucinated dates (good format): ${issueBreakdown.dateCorrection}
- Hallucinated dates (bad format): ${issueBreakdown.standardization}
- All standardized to ISO 8601 UTC format"`)
        );

        return { success: true, wouldFix: fixes.length };
      } else {
        console.log(
          chalk.yellow(
            `⚠️  Could not apply fixes: ${fixResult.reason || fixResult.error}`
          )
        );
        return { success: false, issues: result.issues.length };
      }
    }

    return { success: false, issues: result.issues.length };
  }

  showEnhancedProjectReport(results, options) {
    console.log(
      chalk.blue('\n📊 Date Validation & Format Standardization Report')
    );
    console.log(chalk.blue('='.repeat(50)));

    console.log(`Total files: ${results.total}`);
    console.log(chalk.green(`✅ Valid (date + format): ${results.valid}`));
    console.log(chalk.red(`❌ Invalid: ${results.invalid}`));
    console.log(chalk.yellow(`⚠️  Errors: ${results.errors}`));

    if (results.invalid > 0) {
      // Categorize issues by type and fix type
      let formatIssues = 0;
      let dateIssues = 0;
      let bothIssues = 0;
      const fixTypeBreakdown = {
        formatUpgrade: 0,
        dateCorrection: 0,
        standardization: 0,
      };

      for (const fileResult of results.issues) {
        for (const issue of fileResult.issues) {
          const hasFormatIssue = !issue.validation.formatCompliant;
          const hasDateIssue = !issue.validation.dateMatches;

          if (hasFormatIssue && hasDateIssue) {
            bothIssues++;
          } else if (hasFormatIssue) {
            formatIssues++;
          } else if (hasDateIssue) {
            dateIssues++;
          }

          // Count by fix type
          if (issue.suggestedFix) {
            switch (issue.suggestedFix.fixType) {
              case 'format_upgrade':
                fixTypeBreakdown.formatUpgrade++;
                break;
              case 'date_mismatch':
                fixTypeBreakdown.dateCorrection++;
                break;
              case 'standardize':
                fixTypeBreakdown.standardization++;
                break;
            }
          }
        }
      }

      console.log(chalk.yellow('\n📊 Issue Breakdown:'));
      console.log(`  🎯 Format standardization needed: ${formatIssues}`);
      console.log(`  📅 Date correction needed: ${dateIssues}`);
      console.log(`  🔄 Both format + date issues: ${bothIssues}`);

      console.log(chalk.blue('\n🔧 Fix Type Analysis:'));
      console.log(
        `  📝 Format upgrades: ${fixTypeBreakdown.formatUpgrade} (non-standard → ISO 8601 UTC)`
      );
      console.log(
        `  📅 Date corrections: ${fixTypeBreakdown.dateCorrection} (hallucinated → actual dates)`
      );
      console.log(
        `  🔄 Full standardization: ${fixTypeBreakdown.standardization} (format + date fixes)`
      );

      console.log(chalk.yellow('\n🔧 Detailed Git-Style Diffs:'));

      for (const fileResult of results.issues) {
        console.log(
          chalk.red(`\n📄 ${require('node:path').basename(fileResult.file)}:`)
        );

        for (const issue of fileResult.issues) {
          console.log(
            chalk.yellow(`\n  📍 Line ${issue.line}: ${issue.field}`)
          );
          console.log(`     Issue: ${issue.validation.reason}`);

          if (issue.suggestedFix?.gitPatch) {
            // Show actual git patch
            console.log(
              chalk.gray(`\n     Git patch (can be applied with 'git apply'):`)
            );
            console.log(chalk.cyan(issue.suggestedFix.gitPatch));
            console.log(
              chalk.gray(`     Type: ${issue.suggestedFix.explanation}`)
            );
          }
        }
      }

      console.log(chalk.blue('\n🎯 Standardization Benefits:'));
      console.log('  • ISO 8601 UTC format eliminates timezone ambiguity');
      console.log('  • Sortable and parseable by all systems');
      console.log('  • Internationally regulated standard (ISO 8601)');
      console.log('  • Machine-readable across all platforms');
      console.log('  • Prevents date interpretation errors');

      // Generate combined patch file
      if (options.dryRun) {
        const allPatches = [];
        for (const fileResult of results.issues) {
          for (const issue of fileResult.issues) {
            if (issue.suggestedFix?.gitPatch) {
              allPatches.push(issue.suggestedFix.gitPatch);
            }
          }
        }

        if (allPatches.length > 0) {
          const patchFile = 'date-fixes.patch';
          console.log(chalk.blue(`\n📄 Combined patch file: ${patchFile}`));
          console.log(
            chalk.gray(`   To apply all fixes: git apply ${patchFile}`)
          );

          // In dry-run, show what the patch file would contain
          console.log(
            chalk.gray(
              `\n📄 Patch file would contain ${allPatches.length} fixes`
            )
          );
        }
      }
    }
  }

  showDryRunSummary(results, _options) {
    // Calculate correct totals
    let totalIssues = 0;
    let dateCorrections = 0;
    let fullStandardization = 0;
    const changedFiles = [];
    const allPatches = [];

    for (const fileResult of results.issues) {
      if (fileResult.issues.length > 0) {
        changedFiles.push(`"${fileResult.file}"`);
        totalIssues += fileResult.issues.length;

        for (const issue of fileResult.issues) {
          if (issue.suggestedFix) {
            // ALL changes are hallucinated dates - just categorize by format needs
            if (issue.suggestedFix.fixType === 'standardize') {
              fullStandardization++; // Hallucinated + format fix needed
            } else {
              dateCorrections++; // Hallucinated but format OK
            }

            // Collect patches for file output
            if (issue.suggestedFix.gitPatch) {
              allPatches.push(issue.suggestedFix.gitPatch);
            }
          }
        }
      }
    }

    console.log(chalk.blue('\n📊 Dry Run Summary:'));
    console.log(`Total files scanned: ${results.total}`);
    console.log(`Files with issues: ${results.invalid}`);
    console.log(`Total hallucinated dates found: ${totalIssues}`);

    console.log(chalk.blue('\n🔧 Fix Type Breakdown:'));
    console.log(`  📅 Hallucinated dates (good format): ${dateCorrections}`);
    console.log(`  🔄 Hallucinated dates (bad format): ${fullStandardization}`);
    console.log(`  📝 All will be standardized to ISO 8601 UTC`);

    // Write detailed results to file
    if (totalIssues > 0) {
      const reportFile = 'date-validation-report.txt';
      const patchFile = 'date-fixes.patch';

      try {
        // Write summary report
        const reportContent = [
          `Date Validation Report - ${new Date().toISOString()}`,
          `${'='.repeat(60)}`,
          `Total files scanned: ${results.total}`,
          `Files with issues: ${results.invalid}`,
          `Total hallucinated dates: ${totalIssues}`,
          ``,
          `Fix Breakdown:`,
          `- Hallucinated dates (good format): ${dateCorrections}`,
          `- Hallucinated dates (bad format): ${fullStandardization}`,
          ``,
          `Files with issues:`,
          ...results.issues.map(
            (f) => `- ${f.file} (${f.issues.length} issues)`
          ),
          ``,
          `To apply fixes:`,
          `1. Run: sc date-validate --fix`,
          `2. Or apply patch: git apply ${patchFile}`,
          ``,
        ].join('\n');

        require('node:fs').writeFileSync(reportFile, reportContent);

        // Write patch file
        if (allPatches.length > 0) {
          require('node:fs').writeFileSync(patchFile, allPatches.join('\n\n'));
        }

        console.log(
          chalk.blue(`\n📄 Detailed report written to: ${reportFile}`)
        );
        console.log(chalk.blue(`📄 Git patches written to: ${patchFile}`));
      } catch (error) {
        console.log(
          chalk.yellow(`⚠️  Could not write report files: ${error.message}`)
        );
      }

      console.log(chalk.blue('\n📝 Suggested commit after fixing:'));
      console.log(
        chalk.cyan(`git add ${changedFiles.join(' ')} && git commit -m "fix: correct ${totalIssues} hallucinated dates to actual file dates across ${results.invalid} files

- Hallucinated dates (good format): ${dateCorrections}
- Hallucinated dates (bad format): ${fullStandardization}
- All standardized to ISO 8601 UTC format"`)
      );
    } else {
      console.log(chalk.green('\n✅ No hallucinated dates found!'));
    }
  }

  async validateProject(options) {
    // Configure display limits and logging
    const validationOptions = {
      maxDisplay: options.maxDisplay || 10,
      maxFiles: options.maxFiles,
      logFile: options.logFile || 'date-validation-full.log',
      quiet: false, // Let the validator handle its own output
    };

    const results = this.validator.validateProject(validationOptions);

    // Show dry run summary after validation
    if (options.dryRun) {
      this.showDryRunSummary(results, options);
    } else if (options.verbose) {
      // Show standard report for verbose mode
      this.validator.showReport(results);
    }

    // Apply fixes if requested
    if (options.fix && results.invalid > 0) {
      console.log(chalk.blue('\n🔧 Applying fixes...'));

      let totalFixed = 0;
      let totalErrors = 0;

      for (const fileResult of results.issues) {
        const fixes = fileResult.issues
          .map((issue) => issue.suggestedFix)
          .filter(Boolean);
        if (fixes.length > 0) {
          const fixResult = this.validator.fixFile(fileResult.file, fixes);

          if (fixResult.fixed) {
            console.log(
              chalk.green(
                `✅ Fixed ${fixResult.count} dates in ${fileResult.file}`
              )
            );
            totalFixed += fixResult.count;
          } else if (!fixResult.dryRun) {
            console.log(
              chalk.yellow(
                `⚠️  Could not fix ${fileResult.file}: ${fixResult.reason || fixResult.error}`
              )
            );
            totalErrors++;
          }
        }
      }

      if (options.dryRun) {
        // Don't show duplicate dry run message - already shown in summary

        // Analyze issue types for dry run
        const issueBreakdown = {
          formatUpgrade: 0,
          dateCorrection: 0,
          standardization: 0,
        };
        const changedFiles = [];

        for (const fileResult of results.issues) {
          const fixes = fileResult.issues
            .map((issue) => issue.suggestedFix)
            .filter(Boolean);
          if (fixes.length > 0) {
            changedFiles.push(`"${fileResult.file}"`);

            // Count issue types
            for (const issue of fileResult.issues) {
              if (issue.suggestedFix) {
                switch (issue.suggestedFix.fixType) {
                  case 'format_upgrade':
                    issueBreakdown.formatUpgrade++;
                    break;
                  case 'date_mismatch':
                    issueBreakdown.dateCorrection++;
                    break;
                  case 'standardize':
                    issueBreakdown.standardization++;
                    break;
                }
              }
            }
          }
        }

        // Show issue breakdown
        console.log(chalk.blue('\n📊 Issue Type Breakdown:'));
        console.log(
          `  🎯 Format upgrades: ${issueBreakdown.formatUpgrade} (non-standard formats → ISO 8601 UTC)`
        );
        console.log(
          `  📅 Date corrections: ${issueBreakdown.dateCorrection} (hallucinated dates → actual file dates)`
        );
        console.log(
          `  🔄 Full standardization: ${issueBreakdown.standardization} (both format + date issues)`
        );

        // Show sample of changes that would be made
        console.log(chalk.blue('\n🔧 Sample Changes (first 5 files):'));
        let sampleCount = 0;
        for (const fileResult of results.issues) {
          if (sampleCount >= 5) break;

          console.log(
            chalk.yellow(
              `\n📄 ${require('node:path').basename(fileResult.file)}:`
            )
          );
          let issueCount = 0;
          for (const issue of fileResult.issues) {
            if (issueCount >= 2) {
              // Show max 2 issues per file in sample
              if (fileResult.issues.length > 2) {
                console.log(
                  chalk.gray(
                    `     ... and ${fileResult.issues.length - 2} more`
                  )
                );
              }
              break;
            }

            if (issue.suggestedFix?.gitPatch) {
              console.log(`  📍 Line ${issue.line}: ${issue.field}`);
              console.log(
                chalk.cyan(
                  `     ${issue.suggestedFix.gitPatch.split('\n').slice(2).join('\n     ')}`
                )
              );
              issueCount++;
            }
          }
          sampleCount++;
        }

        if (results.issues.length > 5) {
          console.log(
            chalk.gray(
              `\n... and ${results.issues.length - 5} more files with changes`
            )
          );
        }

        // Show what the commit would look like
        console.log(chalk.blue('\n📝 Commit after fixing would be:'));
        console.log(
          chalk.cyan(`git add ${changedFiles.join(' ')} && git commit -m "fix: standardize ${totalFixed} dates to ISO 8601 UTC format across ${results.invalid} files

- Format upgrades: ${issueBreakdown.formatUpgrade} (non-standard → ISO 8601 UTC)
- Date corrections: ${issueBreakdown.dateCorrection} (hallucinated → actual file dates)
- Full standardization: ${issueBreakdown.standardization} (both format + date fixes)
- Eliminate timezone ambiguity for international compliance"`)
        );
      } else {
        console.log(
          chalk.green(
            `\n✅ Fixed ${totalFixed} dates across ${results.invalid - totalErrors} files`
          )
        );
        if (totalErrors > 0) {
          console.log(
            chalk.yellow(`⚠️  ${totalErrors} files could not be fixed`)
          );
        }

        // Suggest git commit command after successful fixes
        if (totalFixed > 0) {
          // Generate list of actually fixed files
          const fixedFiles = [];
          const issueBreakdown = {
            formatUpgrade: 0,
            dateCorrection: 0,
            standardization: 0,
          };

          for (const fileResult of results.issues) {
            const fixes = fileResult.issues
              .map((issue) => issue.suggestedFix)
              .filter(Boolean);
            if (fixes.length > 0) {
              fixedFiles.push(`"${fileResult.file}"`);

              // Count issue types
              for (const issue of fileResult.issues) {
                if (issue.suggestedFix) {
                  switch (issue.suggestedFix.fixType) {
                    case 'format_upgrade':
                      issueBreakdown.formatUpgrade++;
                      break;
                    case 'date_mismatch':
                      issueBreakdown.dateCorrection++;
                      break;
                    case 'standardize':
                      issueBreakdown.standardization++;
                      break;
                  }
                }
              }
            }
          }

          const changedFiles = fixedFiles.join(' ');

          console.log(chalk.blue('\n📝 Suggested commit:'));
          console.log(
            chalk.cyan(`git add ${changedFiles} && git commit -m "fix: standardize ${totalFixed} dates to ISO 8601 UTC format across ${fixedFiles.length} files

- Format upgrades: ${issueBreakdown.formatUpgrade} (non-standard → ISO 8601 UTC)
- Date corrections: ${issueBreakdown.dateCorrection} (hallucinated → actual file dates)
- Full standardization: ${issueBreakdown.standardization} (both format + date fixes)
- Eliminate timezone ambiguity for international compliance"`)
          );
        }
      }
    }

    return {
      success: results.invalid === 0 && results.errors === 0,
      total: results.total,
      valid: results.valid,
      invalid: results.invalid,
      errors: results.errors,
    };
  }

  // Static method for CLI usage
  static async main(args = []) {
    const options = {
      help: args.includes('--help') || args.includes('-h'),
      verbose: args.includes('--verbose') || args.includes('-v'),
      fix: args.includes('--fix'),
      dryRun: args.includes('--dry-run'),
      file: args.find((arg) => arg.startsWith('--file='))?.split('=')[1],
      maxDisplay: parseInt(
        args.find((arg) => arg.startsWith('--max-display='))?.split('=')[1] ||
          '10',
        10
      ),
      maxFiles: args
        .find((arg) => arg.startsWith('--max-files='))
        ?.split('=')[1]
        ? parseInt(
            args.find((arg) => arg.startsWith('--max-files='))?.split('=')[1],
            10
          )
        : undefined,
      logFile:
        args.find((arg) => arg.startsWith('--log-file='))?.split('=')[1] ||
        'date-validation-full.log',
    };

    const command = new DateValidateCommand();

    if (options.help) {
      command.showHelp();
      return { success: true };
    }

    return await command.execute(options);
  }
}

// Export for use in other modules
module.exports = DateValidateCommand;

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  DateValidateCommand.main(args)
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    });
}
