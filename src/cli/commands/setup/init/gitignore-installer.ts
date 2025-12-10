import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'node:path';

interface GitignoreOptions {
  [key: string]: unknown;
}

/**
 * Install or update .gitignore with Supernal Coding defaults
 * Merges with existing .gitignore if present
 */
export async function installGitignore(gitRoot: string, _options: GitignoreOptions = {}): Promise<void> {
  const gitignorePath = path.join(gitRoot, '.gitignore');
  const templatePath = path.join(
    __dirname,
    '../../../../../templates/init/gitignore.template'
  );

  const template = await fs.readFile(templatePath, 'utf8');
  const templateLines = template.split('\n');

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

  if (await fs.pathExists(gitignorePath)) {
    const existing = await fs.readFile(gitignorePath, 'utf8');

    if (existing.includes('Supernal Coding System Files')) {
      console.log(
        chalk.gray('  ✓ .gitignore already has Supernal Coding section')
      );
      return;
    }

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

    const updated = `${existing.trim()}\n\n${scSection}\n`;
    await fs.writeFile(gitignorePath, updated, 'utf8');
    console.log(
      chalk.green('  ✓ Updated .gitignore with Supernal Coding entries')
    );
    console.log(
      chalk.gray(`    • Added ${missingEntries.length} missing entries`)
    );
  } else {
    await fs.writeFile(gitignorePath, template, 'utf8');
    console.log(
      chalk.green('  ✓ Created .gitignore with Supernal Coding defaults')
    );
  }

  console.log(
    chalk.gray('    • .supernal-coding/rules-state.json (local state)')
  );
  console.log(chalk.gray('    • .supernal/wip-registry.yaml (WIP registry)'));
}

module.exports = {
  installGitignore
};
