/**
 * Jira Unlink Command - Remove Jira link from requirement
 */
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

interface UnlinkResult {
  success: boolean;
  error?: string;
}

async function findRequirementFile(requirement: string): Promise<string | null> {
  const reqId = requirement.toLowerCase().replace(/^req-?/, '');
  const patterns = [
    `docs/requirements/**/req-${reqId}*.md`,
    `docs/requirements/**/REQ-${reqId}*.md`,
    `requirements/**/req-${reqId}*.md`
  ];

  for (const pattern of patterns) {
    const matches = glob.sync(pattern, { nocase: true });
    if (matches.length > 0) return matches[0];
  }
  return null;
}

async function handler(args: string[]): Promise<UnlinkResult> {
  const [requirement] = args;

  if (!requirement) {
    console.error(chalk.red('Usage: sc connect jira unlink <requirement>'));
    return { success: false };
  }

  try {
    const reqFile = await findRequirementFile(requirement);
    if (!reqFile) {
      console.error(chalk.red(`Requirement not found: ${requirement}`));
      return { success: false };
    }

    const content = await fs.readFile(reqFile, 'utf-8');

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.error(chalk.red('Requirement file has no frontmatter'));
      return { success: false };
    }

    const frontmatter = frontmatterMatch[1];
    const body = content.slice(frontmatterMatch[0].length);

    if (!frontmatter.includes('jira:')) {
      console.log(chalk.yellow('Requirement is not linked to Jira'));
      return { success: true };
    }

    const newFrontmatter = frontmatter.replace(/jira:\n(?: {2}[^\n]*\n)*/g, '').trim();

    const newContent = '---\n' + newFrontmatter + '\n---' + body;
    await fs.writeFile(reqFile, newContent);

    console.log(chalk.green(`✓ Removed Jira link from ${path.basename(reqFile)}`));
    return { success: true };
  } catch (error) {
    console.error(chalk.red(`Failed to unlink: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
