/**
 * sc validate feature - Validate feature frontmatter
 */

const FeatureValidator = require('../../../validation/FeatureValidator');
const path = require('node:path');
const chalk = require('chalk');
const AutoCommitConfig = require('../../../utils/auto-commit-config');
const {
  safeCommit,
  generateFixCommitMessage,
  getFeatureFiles,
} = require('../../../utils/git-commit-utils');

async function validateFeatureCommand(featureId, options) {
  const validator = new FeatureValidator();
  const { projectRoot, quiet } = options;

  if (!quiet) {
    console.log(chalk.blue(`\n🔍 Validating feature: ${featureId}\n`));
  }

  try {
    // Find feature
    const featuresDir = path.join(projectRoot, 'docs/features');
    const allFeatures = await validator.getAllFeatures(featuresDir);
    const feature = allFeatures.find((f) => f.name === featureId);

    if (!feature) {
      if (quiet) {
        console.log(chalk.red(`❌ ${featureId}: Feature not found`));
      } else {
        console.log(chalk.red(`❌ Feature not found: ${featureId}`));
        console.log(chalk.gray(`\nSearched in: ${featuresDir}`));
      }
      process.exit(1);
    }

    // Validate
    const result = await validator.validate(feature.path);

    // Display results
    if (!result.valid) {
      if (quiet) {
        // Quiet mode: just show feature name and errors
        console.log(chalk.red(`❌ ${feature.name}:`));
        result.errors.forEach((error) => {
          console.log(chalk.red(`   • ${error}`));
        });
      } else {
        displayValidationResult(result, feature);
      }
    } else if (!quiet) {
      displayValidationResult(result, feature);
    }

    // Auto-fix if requested
    if (options.fix && !result.valid) {
      if (!quiet) {
        console.log(chalk.yellow('\n🔧 Attempting auto-fix...\n'));
      }
      const fixResult = await validator.autoFix(feature.path, result, {
        moveIfWrong: options.move || false,
      });

      if (fixResult.fixed) {
        if (!quiet) {
          console.log(chalk.green('✅ Auto-fixed:'));
          fixResult.fixes.forEach((fix) => {
            console.log(chalk.green(`   • ${fix}`));
          });
          if (fixResult.movedTo) {
            console.log(
              chalk.blue(`\n📁 Feature moved to: ${fixResult.movedTo}`)
            );
          }
          console.log();
        }
      } else {
        if (!quiet) {
          console.log(chalk.yellow(`⚠️  ${fixResult.message}`));
          console.log();
        }
      }
    }

    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    if (quiet) {
      console.log(chalk.red(`❌ ${featureId}: ${error.message}`));
    } else {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
    process.exit(1);
  }
}

async function validateAllFeatures(options) {
  const validator = new FeatureValidator();
  const { projectRoot } = options;

  console.log(chalk.blue('\n🔍 Validating all features on current branch\n'));

  try {
    const featuresDir = path.join(projectRoot, 'docs/features');
    const allFeatures = await validator.getAllFeatures(featuresDir);

    if (allFeatures.length === 0) {
      console.log(chalk.yellow('No features found'));
      process.exit(0);
    }

    console.log(chalk.gray(`Found ${allFeatures.length} feature(s)\n`));

    let validCount = 0;
    let invalidCount = 0;
    const failures = [];

    for (const feature of allFeatures) {
      const result = await validator.validate(feature.path);

      if (result.valid) {
        console.log(chalk.green(`✅ ${feature.name}`));
        if (result.warnings.length > 0) {
          result.warnings.forEach((warning) => {
            console.log(chalk.yellow(`   ⚠️  ${warning}`));
          });
        }
        validCount++;
      } else {
        console.log(chalk.red(`❌ ${feature.name}`));
        result.errors.forEach((error) => {
          console.log(chalk.red(`   • ${error}`));
        });
        invalidCount++;
        failures.push({ feature, result });
      }
      console.log();
    }

    // Summary
    console.log(chalk.bold('\nSummary:'));
    console.log(chalk.green(`  ✅ Valid: ${validCount}`));
    if (invalidCount > 0) {
      console.log(chalk.red(`  ❌ Invalid: ${invalidCount}`));
    }

    // Auto-fix if requested
    if (options.fix && failures.length > 0) {
      console.log(
        chalk.yellow('\n🔧 Attempting auto-fix for failed features...\n')
      );

      const fixedFeatures = [];

      for (const { feature, result } of failures) {
        const fixResult = await validator.autoFix(feature.path, result, {
          moveIfWrong: options.move || false,
        });

        if (fixResult.fixed) {
          console.log(chalk.green(`✅ Fixed ${feature.name}:`));
          fixResult.fixes.forEach((fix) => {
            console.log(chalk.green(`   • ${fix}`));
          });
          if (fixResult.movedTo) {
            console.log(chalk.blue(`   📁 Moved to: ${fixResult.movedTo}`));
            // Update feature path for commit file collection
            feature.path = fixResult.movedTo;
          }
          fixedFeatures.push({ feature, fixes: fixResult.fixes });
        } else {
          console.log(
            chalk.yellow(`⚠️  ${feature.name}: ${fixResult.message}`)
          );
        }
      }

      // Offer to commit fixes
      if (fixedFeatures.length > 0 && !options.quiet) {
        console.log(chalk.blue('\n📝 Auto-fix complete!\n'));

        // Generate commit message
        const commitMessage = generateFixCommitMessage(
          fixedFeatures.map(({ feature, fixes }) => ({
            feature: feature.name,
            fixes,
          }))
        );

        // Get files to commit
        const filesToCommit = getFeatureFiles(
          fixedFeatures.map((f) => f.feature)
        );

        console.log(chalk.blue('Suggested commit:\n'));
        console.log(chalk.gray(commitMessage));
        console.log(chalk.gray('\nFiles to commit:'));
        filesToCommit.forEach((file) => {
          console.log(chalk.gray(`  • ${file}`));
        });

        // Check auto-commit configuration
        const autoCommitConfig = new AutoCommitConfig(options.projectRoot);
        const shouldAutoCommit = await autoCommitConfig.shouldAutoCommit(
          'feature.validate',
          options
        );
        const shouldPrompt = await autoCommitConfig.shouldPrompt(
          'feature.validate',
          options
        );

        // Auto-commit if configured or --commit flag is set
        if (shouldAutoCommit || options.commit) {
          console.log(chalk.blue('\n🚀 Committing fixes...\n'));

          const commitResult = await safeCommit({
            files: filesToCommit,
            message: commitMessage,
            auto: true,
          });

          if (commitResult.success) {
            console.log(
              chalk.green(
                `✅ ${commitResult.message} (${commitResult.commitHash?.slice(0, 7)})`
              )
            );
          } else {
            console.log(chalk.red(`❌ ${commitResult.message}`));
            console.log(
              chalk.yellow(
                '\nYou can manually commit with:\n' +
                  `git add ${filesToCommit.join(' ')}\n` +
                  `git commit -m "${commitMessage.split('\n')[0]}"`
              )
            );
          }
        } else if (shouldPrompt) {
          // TODO: Add interactive prompt support
          console.log(
            chalk.yellow(
              '\n💡 Interactive prompt not yet implemented. To commit these fixes, run:\n' +
                chalk.white('sc feature validate --all --fix --commit') +
                '\n\nOr manually:\n' +
                chalk.white(`git add ${filesToCommit.join(' ')}`) +
                '\n' +
                chalk.white(`git commit -m "${commitMessage.split('\n')[0]}"`)
            )
          );
        } else {
          // Suggest mode or default
          console.log(
            chalk.yellow(
              '\n💡 To commit these fixes, run:\n' +
                chalk.white('sc feature validate --all --fix --commit') +
                '\n\nOr manually:\n' +
                chalk.white(`git add ${filesToCommit.join(' ')}`) +
                '\n' +
                chalk.white(`git commit -m "${commitMessage.split('\n')[0]}"`)
            )
          );
        }
      }
    }

    console.log();
    process.exit(invalidCount > 0 ? 1 : 0);
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

function displayValidationResult(result, feature) {
  console.log('━'.repeat(60));
  console.log();

  if (result.valid) {
    console.log(chalk.green('✅ Validation Passed'));
  } else {
    console.log(chalk.red('❌ Validation Failed'));
  }

  console.log();
  console.log(chalk.bold('Feature:'), feature.name);
  console.log(chalk.bold('Path:'), feature.path);

  if (result.frontmatter) {
    console.log();
    console.log(chalk.bold('Frontmatter:'));
    console.log(
      chalk.gray(`  Domain: ${result.frontmatter.domain || 'not set'}`)
    );
    console.log(chalk.gray(`  Branch: ${result.frontmatter.branch}`));
    console.log(chalk.gray(`  Feature ID: ${result.frontmatter.feature_id}`));
  }

  if (result.errors && result.errors.length > 0) {
    console.log();
    console.log(chalk.red.bold('Errors:'));
    result.errors.forEach((error) => {
      console.log(chalk.red(`  • ${error}`));
    });
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log();
    console.log(chalk.yellow.bold('Warnings:'));
    result.warnings.forEach((warning) => {
      console.log(chalk.yellow(`  ⚠️  ${warning}`));
    });
  }

  if (!result.valid) {
    console.log();
    console.log(
      chalk.gray('Tip: Run with --fix to auto-correct simple issues')
    );
  }

  console.log();
  console.log('━'.repeat(60));
  console.log();
}

module.exports = {
  validateFeatureCommand,
  validateAllFeatures,
};
