/**
 * Jira Push Command - Push requirement to Jira
 */
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import glob from 'glob';
import crypto from 'node:crypto';
const api = require('../api');

interface PushOptions {
  project?: string;
  type?: string;
}

interface PushResult {
  success: boolean;
  error?: string;
}

interface JiraMetadata {
  key?: string;
  project?: string;
  sync_status?: string;
  last_sync?: string;
  linked_at?: string;
  local_hash?: string;
}

interface Frontmatter {
  title?: string;
  tags?: string[];
  jira?: JiraMetadata;
}

interface ParsedRequirement {
  frontmatter: Frontmatter;
  body: string;
  raw: { frontmatter: string };
}

interface Credentials {
  domain: string;
  email: string;
  token: string;
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

function parseRequirement(content: string): ParsedRequirement {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content, raw: { frontmatter: '' } };
  }

  const rawFrontmatter = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);

  const frontmatter: Frontmatter = {};

  const titleMatch = rawFrontmatter.match(/title:\s*["']?([^"'\n]+)/);
  if (titleMatch) frontmatter.title = titleMatch[1].trim();

  const tagsMatch = rawFrontmatter.match(/tags:\s*\[([^\]]*)\]/);
  if (tagsMatch) {
    frontmatter.tags = tagsMatch[1].split(',').map((t) => t.trim().replace(/["']/g, '')).filter(Boolean);
  }

  const jiraMatch = rawFrontmatter.match(/jira:\n((?: {2}[^\n]*\n)*)/);
  if (jiraMatch) {
    frontmatter.jira = {};
    const keyMatch = jiraMatch[1].match(/key:\s*([^\n]+)/);
    if (keyMatch) frontmatter.jira.key = keyMatch[1].trim();
    const projMatch = jiraMatch[1].match(/project:\s*([^\n]+)/);
    if (projMatch) frontmatter.jira.project = projMatch[1].trim();
  }

  return { frontmatter, body, raw: { frontmatter: rawFrontmatter } };
}

function extractDescription(body: string): string {
  const lines = body.trim().split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const firstPara: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') break;
    firstPara.push(line);
  }
  return firstPara.join('\n').substring(0, 500) || 'No description';
}

async function updateJiraMetadata(reqFile: string, content: string, metadata: JiraMetadata): Promise<void> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return;

  let frontmatter = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);

  const jiraSection = [
    'jira:',
    `  key: ${metadata.key}`,
    `  project: ${metadata.project}`,
    `  sync_status: ${metadata.sync_status}`,
    `  last_sync: ${metadata.last_sync}`,
    metadata.linked_at ? `  linked_at: ${metadata.linked_at}` : null,
    metadata.local_hash ? `  local_hash: ${metadata.local_hash}` : null
  ].filter(Boolean).join('\n');

  frontmatter = frontmatter.replace(/jira:\n(?: {2}[^\n]*\n)*/g, '').trim();
  frontmatter += '\n' + jiraSection;

  const newContent = '---\n' + frontmatter + '\n---' + body;
  await fs.writeFile(reqFile, newContent);
}

async function handler(args: string[], options: PushOptions = {}): Promise<PushResult> {
  const [requirement] = args;

  if (!requirement) {
    console.error(chalk.red('Usage: sc connect jira push <requirement> [--project PROJ]'));
    return { success: false };
  }

  try {
    const creds: Credentials | null = await api.getCredentials();
    if (!creds) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    const reqFile = await findRequirementFile(requirement);
    if (!reqFile) {
      console.error(chalk.red(`Requirement not found: ${requirement}`));
      return { success: false };
    }

    const content = await fs.readFile(reqFile, 'utf-8');
    const { frontmatter } = parseRequirement(content);

    const title = frontmatter.title || path.basename(reqFile, '.md');
    const description = extractDescription(content);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);

    const existingKey = frontmatter.jira?.key;

    if (existingKey) {
      console.log(chalk.gray(`Updating Jira issue ${existingKey}...`));

      await api.apiRequest(`/issue/${existingKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          fields: {
            summary: title,
            description: {
              type: 'doc',
              version: 1,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }]
            },
            labels: frontmatter.tags || []
          }
        })
      });

      await updateJiraMetadata(reqFile, content, {
        key: existingKey,
        project: frontmatter.jira?.project,
        sync_status: 'synced',
        last_sync: new Date().toISOString(),
        local_hash: contentHash
      });

      console.log(chalk.green(`\n✓ Updated ${existingKey}`));
      console.log(chalk.gray(`View: https://${creds.domain}/browse/${existingKey}`));
    } else {
      if (!options.project) {
        console.error(chalk.red('Project required for new issues. Use: --project PROJ'));
        return { success: false };
      }

      console.log(chalk.gray(`Creating Jira issue in ${options.project}...`));

      const response = await api.apiRequest('/issue', {
        method: 'POST',
        body: JSON.stringify({
          fields: {
            project: { key: options.project },
            summary: title,
            description: {
              type: 'doc',
              version: 1,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }]
            },
            issuetype: { name: options.type || 'Story' },
            labels: frontmatter.tags || []
          }
        })
      });

      await updateJiraMetadata(reqFile, content, {
        key: response.key,
        project: options.project,
        sync_status: 'synced',
        last_sync: new Date().toISOString(),
        linked_at: new Date().toISOString(),
        local_hash: contentHash
      });

      console.log(chalk.green(`\n✓ Created ${response.key}`));
      console.log(chalk.gray(`View: https://${creds.domain}/browse/${response.key}`));
    }

    return { success: true };
  } catch (error) {
    console.error(chalk.red(`Push failed: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
