/**
 * Jira Link Command - Link requirement to Jira issue
 */
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import glob from 'glob';
const api = require('../api');

interface JiraIssue {
  key: string;
  fields: {
    project: { key: string };
    summary: string;
    status: { name: string };
  };
}

interface LinkResult {
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

async function handler(args: string[]): Promise<LinkResult> {
  const [requirement, jiraKey] = args;

  if (!requirement || !jiraKey) {
    console.error(chalk.red('Usage: sc connect jira link <requirement> <JIRA-KEY>'));
    return { success: false };
  }

  try {
    const creds = await api.getCredentials();
    if (!creds) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    const reqFile = await findRequirementFile(requirement);
    if (!reqFile) {
      console.error(chalk.red(`Requirement not found: ${requirement}`));
      return { success: false };
    }

    console.log(chalk.gray(`Verifying Jira issue ${jiraKey}...`));
    const issue: JiraIssue = await api.apiRequest(`/issue/${jiraKey}`);

    const content = await fs.readFile(reqFile, 'utf-8');

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.error(chalk.red('Requirement file has no frontmatter'));
      return { success: false };
    }

    const frontmatter = frontmatterMatch[1];
    const body = content.slice(frontmatterMatch[0].length);

    if (frontmatter.includes('jira:')) {
      console.log(chalk.yellow('Requirement already has Jira link. Updating...'));
    }

    const jiraSection = [
      'jira:',
      `  key: ${issue.key}`,
      `  project: ${issue.fields.project.key}`,
      `  sync_status: linked`,
      `  last_sync: ${new Date().toISOString()}`,
      `  linked_at: ${new Date().toISOString()}`
    ].join('\n');

    let newFrontmatter = frontmatter.replace(/jira:\n(?: {2}[^\n]*\n)*/g, '').trim();
    newFrontmatter += '\n' + jiraSection;

    const newContent = '---\n' + newFrontmatter + '\n---' + body;
    await fs.writeFile(reqFile, newContent);

    console.log(chalk.green(`\n✓ Linked ${path.basename(reqFile)} to ${issue.key}`));
    console.log(chalk.white(`  Issue: ${issue.fields.summary}`));
    console.log(chalk.white(`  Status: ${issue.fields.status.name}`));
    console.log(chalk.gray(`\nView in Jira: https://${creds.domain}/browse/${issue.key}`));

    return { success: true };
  } catch (error) {
    console.error(chalk.red(`Failed to link: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
