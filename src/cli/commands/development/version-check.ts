/**
 * Version check utilities for sc CLI
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { execSync } from 'node:child_process';

const FEATURE_REQUIREMENTS: Record<string, string> = {
  'sc build': '1.1.0',
  'sc docs generate': '1.1.0',
  'sc init --guides': '1.1.0',
  'sc init --compliance': '1.1.0',
  'sc init --workflow': '1.1.0',
};

interface VersionValidation {
  valid: boolean;
  message: string;
}

interface PublishStatus {
  needsPublish: boolean;
  localVersion: string | null;
  publishedVersion: string | null;
  message: string;
}

interface VersionCheckOptions {
  verbose?: boolean;
}

function getInstalledVersion(): string | null {
  try {
    const packageJsonPath = path.join(__dirname, '../../../../package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return pkg.version;
    }

    const output = execSync('sc --version 2>/dev/null', { encoding: 'utf8' });
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getPublishedVersion(): string | null {
  try {
    const output = execSync('npm view supernal-coding version 2>/dev/null', {
      encoding: 'utf8',
      timeout: 10000
    });
    return output.trim();
  } catch {
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (partsA[i] > partsB[i]) return 1;
    if (partsA[i] < partsB[i]) return -1;
  }
  return 0;
}

function meetsMinimum(installed: string, minimum: string): boolean {
  return compareVersions(installed, minimum) >= 0;
}

function validateFeatureVersion(feature: string): VersionValidation {
  const minimum = FEATURE_REQUIREMENTS[feature];
  if (!minimum) {
    return { valid: true, message: 'No version requirement' };
  }

  const installed = getInstalledVersion();
  if (!installed) {
    return {
      valid: false,
      message: `Cannot determine installed sc version. Minimum required: ${minimum}`
    };
  }

  if (meetsMinimum(installed, minimum)) {
    return { valid: true, message: `Version ${installed} meets requirement ${minimum}` };
  }

  return {
    valid: false,
    message: `Installed sc version ${installed} is below minimum ${minimum} for ${feature}`
  };
}

async function checkPublishRequired(): Promise<PublishStatus> {
  const local = getInstalledVersion();
  const published = getPublishedVersion();

  if (!local) {
    return {
      needsPublish: false,
      localVersion: null,
      publishedVersion: published,
      message: 'Cannot determine local version'
    };
  }

  if (!published) {
    return {
      needsPublish: true,
      localVersion: local,
      publishedVersion: null,
      message: 'Package not yet published to npm'
    };
  }

  const comparison = compareVersions(local, published);

  if (comparison > 0) {
    return {
      needsPublish: true,
      localVersion: local,
      publishedVersion: published,
      message: `Local version ${local} is ahead of published ${published}`
    };
  }

  return {
    needsPublish: false,
    localVersion: local,
    publishedVersion: published,
    message: `Versions in sync: ${local}`
  };
}

async function handleVersionCheckCommand(options: VersionCheckOptions = {}): Promise<PublishStatus> {
  console.log(chalk.blue('🔍 SC Version Check'));
  console.log(chalk.blue('='.repeat(40)));

  const local = getInstalledVersion();
  const published = getPublishedVersion();

  console.log('');
  console.log(chalk.white(`Local version:     ${local || 'unknown'}`));
  console.log(chalk.white(`Published version: ${published || 'unknown'}`));

  const status = await checkPublishRequired();

  console.log('');
  if (status.needsPublish) {
    console.log(chalk.yellow(`⚠️  ${status.message}`));
    console.log('');
    console.log(chalk.cyan('To publish to npm:'));
    console.log(chalk.white('  cd supernal-code-package'));
    console.log(chalk.white('  npm version patch   # or minor/major'));
    console.log(chalk.white('  npm publish'));
  } else {
    console.log(chalk.green(`✅ ${status.message}`));
  }

  if (options.verbose) {
    console.log('');
    console.log(chalk.blue('Feature Requirements:'));
    for (const [feature, version] of Object.entries(FEATURE_REQUIREMENTS)) {
      const result = validateFeatureVersion(feature);
      const icon = result.valid ? '✅' : '❌';
      console.log(`  ${icon} ${feature}: requires ${version}`);
    }
  }

  return status;
}

export {
  getInstalledVersion,
  getPublishedVersion,
  compareVersions,
  meetsMinimum,
  validateFeatureVersion,
  checkPublishRequired,
  handleVersionCheckCommand,
  FEATURE_REQUIREMENTS
};

module.exports = {
  getInstalledVersion,
  getPublishedVersion,
  compareVersions,
  meetsMinimum,
  validateFeatureVersion,
  checkPublishRequired,
  handleVersionCheckCommand,
  FEATURE_REQUIREMENTS
};
