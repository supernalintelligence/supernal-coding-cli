import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'node:child_process';

interface ActiveFeatures {
  [key: string]: boolean;
}

interface InstallOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  merge?: boolean;
}

interface Replacements {
  [key: string]: string;
}

function getGitVersion(dir: string): string {
  try {
    const tag = execSync('git describe --tags --exact-match 2>/dev/null', {
      cwd: dir,
      encoding: 'utf8'
    }).trim();
    if (tag) return tag;
  } catch {
    // Not on a tag
  }

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dir,
      encoding: 'utf8'
    }).trim();
    const commit = execSync('git rev-parse --short HEAD', {
      cwd: dir,
      encoding: 'utf8'
    }).trim();
    return `${branch}@${commit}`;
  } catch {
    return 'unknown';
  }
}

async function getProjectName(targetDir: string): Promise<string> {
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const pkg = await fs.readJSON(packageJsonPath);
      if (pkg.name) return pkg.name;
    } catch {
      // Fall through to directory name
    }
  }
  return path.basename(targetDir);
}

function replaceTemplateVariables(content: string, replacements: Replacements): string {
  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }
  return result;
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  const items = await fs.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      count += await countFiles(path.join(dir, item.name));
    } else if (item.isFile()) {
      count++;
    }
  }

  return count;
}

async function copyTemplatesWithReplacement(
  sourceDir: string,
  targetDir: string,
  replacements: Replacements,
  options: InstallOptions
): Promise<void> {
  await fs.ensureDir(targetDir);

  const items = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const item of items) {
    const sourcePath = path.join(sourceDir, item.name);
    const targetPath = path.join(targetDir, item.name);

    if (item.isDirectory()) {
      await copyTemplatesWithReplacement(
        sourcePath,
        targetPath,
        replacements,
        options
      );
    } else if (item.isFile()) {
      if (
        (await fs.pathExists(targetPath)) &&
        !options.overwrite &&
        !options.merge
      ) {
        continue;
      }

      const content = await fs.readFile(sourcePath, 'utf8');

      const processedContent = replaceTemplateVariables(content, replacements);

      await fs.writeFile(targetPath, processedContent, 'utf8');
    }
  }
}

async function installTemplates(
  targetDir: string,
  _activeFeatures: ActiveFeatures,
  options: InstallOptions = {}
): Promise<void> {
  console.log(chalk.blue('   📄 Syncing templates from canonical source...'));

  const possibleSources = [
    path.join(__dirname, '../../../../../templates'),
    path.join(__dirname, '../../../../../../supernal-code-package/templates')
  ];

  let sourceTemplatesDir: string | undefined;
  for (const source of possibleSources) {
    if (await fs.pathExists(source)) {
      sourceTemplatesDir = source;
      console.log(chalk.gray(`      Source: ${sourceTemplatesDir}`));
      break;
    }
  }

  if (!sourceTemplatesDir) {
    console.log(
      chalk.yellow(
        '   ⚠️  Canonical templates not found, skipping template sync'
      )
    );
    return;
  }

  const targetTemplatesDir = path.join(targetDir, 'templates');

  const templateVersion = getGitVersion(sourceTemplatesDir);
  const projectName = await getProjectName(targetDir);

  const replacements: Replacements = {
    TEMPLATE_VERSION: templateVersion,
    PROJECT_NAME: projectName
  };

  console.log(chalk.gray(`      Template version: ${templateVersion}`));
  console.log(chalk.gray(`      Project name: ${projectName}`));

  if (options.dryRun) {
    const sourceCount = await countFiles(sourceTemplatesDir);
    console.log(
      chalk.gray(
        `      Would sync ${sourceCount} files from canonical templates`
      )
    );
    console.log(chalk.gray('      Canonical → project/templates/'));
    console.log(
      chalk.gray(
        `      Variables: TEMPLATE_VERSION=${templateVersion}, PROJECT_NAME=${projectName}`
      )
    );
    return;
  }

  await fs.ensureDir(targetTemplatesDir);

  const existingFiles = await fs.readdir(targetTemplatesDir).catch(() => []);

  if (existingFiles.length > 0 && !options.overwrite && !options.merge) {
    console.log(
      chalk.yellow('   ⚠️  templates/ directory already exists with content')
    );
    console.log(
      chalk.gray('      Use --merge to update from canonical source')
    );
    return;
  }

  try {
    await copyTemplatesWithReplacement(
      sourceTemplatesDir,
      targetTemplatesDir,
      replacements,
      options
    );

    const syncedFiles = await countFiles(targetTemplatesDir);
    console.log(
      chalk.green(
        `   ✓ Templates synced (${syncedFiles} files, variables replaced)`
      )
    );
    console.log(chalk.gray('      Canonical → project/templates/'));
  } catch (error) {
    console.log(chalk.red(`   ✗ Error syncing templates: ${(error as Error).message}`));
  }
}

export {
  installTemplates,
  replaceTemplateVariables,
  getProjectName,
  getGitVersion
};

module.exports = {
  installTemplates,
  replaceTemplateVariables,
  getProjectName,
  getGitVersion
};
