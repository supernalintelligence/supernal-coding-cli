const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');

/**
 * Install or update .gitignore with Supernal Coding defaults
 * Merges with existing .gitignore if present
 * @param {string} gitRoot - Git repository root
 * @param {Object} options - Options
 */
async function installGitignore(gitRoot, _options = {}) {
  const gitignorePath = path.join(gitRoot, '.gitignore');
  // Path from lib/cli/commands/setup/init/ up to supernal-code-package/ then down to templates/
  const templatePath = path.join(
    __dirname,
    '../../../../../templates/init/gitignore.template'
  );

  // Read template
  const template = await fs.readFile(templatePath, 'utf8');
  const templateLines = template.split('\n');

  // Extract Supernal Coding section from template
  const scSectionStart = templateLines.findIndex((line) =>
    line.includes('Supernal Coding System Files')
  );
  const scSectionEnd = templateLines.findIndex(
    (line, idx) =>
      idx > scSectionStart &&
      line.trim().startsWith('# ===') &&
      idx !== scSectionStart
  );

  const scSection = templateLines
    .slice(scSectionStart - 1, scSectionEnd + 1)
    .join('\n');

  // Check if .gitignore exists
  if (await fs.pathExists(gitignorePath)) {
    const existing = await fs.readFile(gitignorePath, 'utf8');

    // Check if Supernal Coding section already exists
    if (existing.includes('Supernal Coding System Files')) {
      console.log(
        chalk.gray('  ✓ .gitignore already has Supernal Coding section')
      );
      return;
    }

    // Check for individual critical entries
    const criticalEntries = [
      '.supernal-coding/rules-state.json',
      '.supernal/wip-registry.yaml'
    ];

    const missingEntries = criticalEntries.filter(
      (entry) => !existing.includes(entry)
    );

    if (missingEntries.length === 0) {
      console.log(
        chalk.gray('  ✓ .gitignore already has all critical entries')
      );
      return;
    }

    // Append Supernal Coding section
    const updated = `${existing.trim()}\n\n${scSection}\n`;
    await fs.writeFile(gitignorePath, updated, 'utf8');
    console.log(
      chalk.green('  ✓ Updated .gitignore with Supernal Coding entries')
    );
    console.log(
      chalk.gray(`    • Added ${missingEntries.length} missing entries`)
    );
  } else {
    // Create new .gitignore from full template
    await fs.writeFile(gitignorePath, template, 'utf8');
    console.log(
      chalk.green('  ✓ Created .gitignore with Supernal Coding defaults')
    );
  }

  // Show what was added
  console.log(
    chalk.gray('    • .supernal-coding/rules-state.json (local state)')
  );
  console.log(chalk.gray('    • .supernal/wip-registry.yaml (WIP registry)'));
}

module.exports = {
  installGitignore
};
