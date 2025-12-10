/**
 * sc feature move - Move feature between domains
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
const FeatureValidator = require('../../../validation/FeatureValidator');

interface MoveOptions {
  projectRoot: string;
}

interface Feature {
  name: string;
  path: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

async function moveFeatureCommand(
  featureId: string,
  targetDomain: string | undefined,
  options: MoveOptions
): Promise<void> {
  const validator = new FeatureValidator();
  const { projectRoot } = options;

  const validDomains = [
    'ai-workflow-system',
    'developer-tooling',
    'compliance-framework',
    'dashboard-platform',
    'workflow-management',
    'content-management',
    'integrations',
    'admin-operations'
  ];

  if (!targetDomain) {
    console.log(chalk.red('\n❌ Target domain is required\n'));
    console.log(
      chalk.gray('Usage: sc feature move <feature-id> <target-domain>')
    );
    console.log(chalk.gray('\nAvailable domains:'));
    validDomains.forEach((domain) => {
      console.log(chalk.gray(`  - ${domain}`));
    });
    console.log();
    if (!process.env.JEST_WORKER_ID) {
      process.exit(1);
    } else {
      throw new Error('Target domain is required');
    }
  }

  if (!validDomains.includes(targetDomain)) {
    console.log(chalk.red(`\n❌ Invalid domain: ${targetDomain}\n`));
    console.log(chalk.gray('Available domains:'));
    validDomains.forEach((domain) => {
      console.log(chalk.gray(`  - ${domain}`));
    });
    console.log();
    if (!process.env.JEST_WORKER_ID) {
      process.exit(1);
    } else {
      throw new Error(`Invalid domain: ${targetDomain}`);
    }
  }

  console.log(
    chalk.blue(`\n🔄 Moving feature: ${featureId} → ${targetDomain}/\n`)
  );

  try {
    const featuresDir = path.join(projectRoot, 'docs/features');
    const allFeatures: Feature[] = await validator.getAllFeatures(featuresDir);
    const feature = allFeatures.find((f) => f.name === featureId);

    if (!feature) {
      console.log(chalk.red(`❌ Feature not found: ${featureId}`));
      console.log(chalk.gray(`\nSearched in: ${featuresDir}`));
      if (!process.env.JEST_WORKER_ID) {
        process.exit(1);
      } else {
        throw new Error(`Feature not found: ${featureId}`);
      }
    }

    const relativePath = path.relative(featuresDir, feature!.path);
    const pathParts = relativePath.split(path.sep);
    const currentDomain = pathParts[0];

    if (currentDomain === targetDomain) {
      console.log(chalk.yellow(`⚠️  Feature is already in ${targetDomain}/`));
      console.log();
      if (!process.env.JEST_WORKER_ID) {
        process.exit(0);
      }
      return;
    }

    console.log(chalk.gray(`Current domain: ${currentDomain}`));
    console.log(chalk.gray(`Target domain:  ${targetDomain}`));
    console.log();

    console.log(chalk.blue('🔍 Validating current state...\n'));
    const currentValidation: ValidationResult = await validator.validate(feature!.path);

    if (!currentValidation.valid) {
      console.log(chalk.red('❌ Current feature has validation errors:'));
      currentValidation.errors.forEach((error) => {
        console.log(chalk.red(`   • ${error}`));
      });
      console.log();
      console.log(
        chalk.yellow(
          'Fix these errors before moving: sc feature validate --fix'
        )
      );
      console.log();
      if (!process.env.JEST_WORKER_ID) {
        process.exit(1);
      } else {
        throw new Error('Feature has validation errors');
      }
    }

    console.log(chalk.green('✅ Current state valid\n'));

    const featureSubpath = pathParts.slice(1).join(path.sep);
    const newFeaturePath = path.join(featuresDir, targetDomain, featureSubpath);

    try {
      await fs.access(newFeaturePath);
      console.log(
        chalk.red(`❌ Target location already exists: ${newFeaturePath}`)
      );
      console.log();
      if (!process.env.JEST_WORKER_ID) {
        process.exit(1);
      } else {
        throw new Error('Target location already exists');
      }
    } catch (_err) {
      // Good, doesn't exist
    }

    const targetDomainDir = path.join(featuresDir, targetDomain);
    await fs.mkdir(targetDomainDir, { recursive: true });

    console.log(chalk.blue('📦 Moving feature folder...\n'));
    try {
      execSync(`git mv "${feature!.path}" "${newFeaturePath}"`, {
        cwd: projectRoot,
        stdio: 'pipe'
      });
      console.log(
        chalk.green(
          `✅ Moved: ${relativePath} → ${targetDomain}/${featureSubpath}\n`
        )
      );
    } catch (err) {
      console.log(chalk.red(`❌ Git move failed: ${(err as Error).message}`));
      console.log();
      process.exit(1);
    }

    console.log(chalk.blue('📝 Updating frontmatter...\n'));
    const readmePath = path.join(newFeaturePath, 'README.md');

    try {
      let content = await fs.readFile(readmePath, 'utf-8');

      const domainRegex = /^domain:\s*\S+$/m;
      if (domainRegex.test(content)) {
        content = content.replace(domainRegex, `domain: ${targetDomain}`);
      }

      const now = new Date().toISOString().split('T')[0];
      const updatedRegex = /^updated:\s*\S+$/m;
      if (updatedRegex.test(content)) {
        content = content.replace(updatedRegex, `updated: ${now}`);
      }

      await fs.writeFile(readmePath, content, 'utf-8');
      console.log(chalk.green('✅ Frontmatter updated\n'));
    } catch (err) {
      console.log(
        chalk.yellow(`⚠️  Could not update frontmatter: ${(err as Error).message}`)
      );
      console.log(
        chalk.gray('This is non-fatal, feature was moved successfully\n')
      );
    }

    console.log(chalk.blue('🔍 Validating new state...\n'));
    const newValidation: ValidationResult = await validator.validate(newFeaturePath);

    if (!newValidation.valid) {
      console.log(chalk.yellow('⚠️  Validation warnings after move:'));
      newValidation.errors.forEach((error) => {
        console.log(chalk.yellow(`   • ${error}`));
      });
      console.log();
      console.log(chalk.gray('You may need to manually fix these issues'));
      console.log();
    } else {
      console.log(chalk.green('✅ New state valid\n'));
    }

    try {
      execSync(`git add "${readmePath}"`, {
        cwd: projectRoot,
        stdio: 'pipe'
      });
    } catch (_err) {
      // Non-fatal if this fails
    }

    console.log(chalk.green.bold('✅ Feature moved successfully!\n'));
    console.log(chalk.gray('Summary:'));
    console.log(chalk.gray(`  Feature: ${featureId}`));
    console.log(chalk.gray(`  From: ${currentDomain}/`));
    console.log(chalk.gray(`  To: ${targetDomain}/`));
    console.log(chalk.gray(`  New path: ${targetDomain}/${featureSubpath}`));
    console.log();
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.yellow('  1. Review the changes'));
    console.log(
      chalk.yellow(
        `  2. Commit: git commit -m "refactor: Move ${featureId} to ${targetDomain}"`
      )
    );
    console.log();

    if (!process.env.JEST_WORKER_ID) {
      process.exit(0);
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${(error as Error).message}\n`));
    if (process.env.DEBUG) {
      console.log((error as Error).stack);
    }
    if (!process.env.JEST_WORKER_ID) {
      process.exit(1);
    } else {
      throw error;
    }
  }
}

export { moveFeatureCommand };
module.exports = {
  moveFeatureCommand
};
