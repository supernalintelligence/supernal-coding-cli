const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');

/**
 * Get git version information for template versioning
 * @param {string} dir - Directory to get git info from
 * @returns {string} Version string (tag or branch@commit)
 */
function getGitVersion(dir) {
  try {
    // Try to get current tag
    const tag = execSync('git describe --tags --exact-match 2>/dev/null', {
      cwd: dir,
      encoding: 'utf8'
    }).trim();
    if (tag) return tag;
  } catch {
    // Not on a tag
  }

  try {
    // Get branch and short commit hash
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

/**
 * Get project name from package.json or directory name
 * @param {string} targetDir - Target directory
 * @returns {Promise<string>} Project name
 */
async function getProjectName(targetDir) {
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

/**
 * Replace template variables in file content
 * @param {string} content - File content
 * @param {Object} replacements - Variable replacements
 * @returns {string} Content with variables replaced
 */
function replaceTemplateVariables(content, replacements) {
  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    // Replace {{KEY}} placeholders
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }
  return result;
}

/**
 * Install templates from canonical source (supernal-code-package/templates) to project templates/
 * This syncs the canonical templates from the package to the project's templates directory
 * @param {string} targetDir - Target installation directory
 * @param {Object} activeFeatures - Active features configuration
 * @param {Object} options - Installation options
 */
async function installTemplates(targetDir, _activeFeatures, options = {}) {
  console.log(chalk.blue('   📄 Syncing templates from canonical source...'));

  // Find canonical templates source
  const possibleSources = [
    // When running from installed package
    path.join(__dirname, '../../../../../templates'),
    // When running from monorepo
    path.join(__dirname, '../../../../../../supernal-code-package/templates')
  ];

  let sourceTemplatesDir;
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

  // Get template variable values
  const templateVersion = getGitVersion(sourceTemplatesDir);
  const projectName = await getProjectName(targetDir);

  const replacements = {
    TEMPLATE_VERSION: templateVersion,
    PROJECT_NAME: projectName
  };

  console.log(chalk.gray(`      Template version: ${templateVersion}`));
  console.log(chalk.gray(`      Project name: ${projectName}`));

  // Dry-run mode - just report what would happen
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

  // Check if target already has templates
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

  // Sync templates with variable replacement
  try {
    await copyTemplatesWithReplacement(
      sourceTemplatesDir,
      targetTemplatesDir,
      replacements,
      options
    );

    // Count synced files
    const syncedFiles = await countFiles(targetTemplatesDir);
    console.log(
      chalk.green(
        `   ✓ Templates synced (${syncedFiles} files, variables replaced)`
      )
    );
    console.log(chalk.gray('      Canonical → project/templates/'));
  } catch (error) {
    console.log(chalk.red(`   ✗ Error syncing templates: ${error.message}`));
  }
}

/**
 * Copy templates recursively with variable replacement
 * @param {string} sourceDir - Source directory
 * @param {string} targetDir - Target directory
 * @param {Object} replacements - Variable replacements
 * @param {Object} options - Copy options
 */
async function copyTemplatesWithReplacement(
  sourceDir,
  targetDir,
  replacements,
  options
) {
  await fs.ensureDir(targetDir);

  const items = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const item of items) {
    const sourcePath = path.join(sourceDir, item.name);
    const targetPath = path.join(targetDir, item.name);

    if (item.isDirectory()) {
      // Recursively copy directories
      await copyTemplatesWithReplacement(
        sourcePath,
        targetPath,
        replacements,
        options
      );
    } else if (item.isFile()) {
      // Check if file exists and merge mode
      if (
        (await fs.pathExists(targetPath)) &&
        !options.overwrite &&
        !options.merge
      ) {
        continue; // Skip existing files unless overwrite/merge
      }

      // Read file content
      const content = await fs.readFile(sourcePath, 'utf8');

      // Replace template variables
      const processedContent = replaceTemplateVariables(content, replacements);

      // Write processed content
      await fs.writeFile(targetPath, processedContent, 'utf8');
    }
  }
}

/**
 * Recursively count files in a directory
 * @param {string} dir - Directory to count files in
 * @returns {Promise<number>} Number of files
 */
async function countFiles(dir) {
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

module.exports = {
  installTemplates,
  replaceTemplateVariables,
  getProjectName,
  getGitVersion
};
