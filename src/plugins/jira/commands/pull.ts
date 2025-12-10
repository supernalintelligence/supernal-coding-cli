// @ts-nocheck
/**
 * Jira Pull Command - Pull Jira issue updates to requirement
 */
const chalk = require('chalk');
const fs = require('node:fs/promises');
const glob = require('glob');
const crypto = require('node:crypto');
const api = require('../api');
const { extractText } = require('./utils');

async function handler(args) {
  const [requirement] = args;
  
  if (!requirement) {
    console.error(chalk.red('Usage: sc connect jira pull <requirement>'));
    return { success: false };
  }

  try {
    const creds = await api.getCredentials();
    if (!creds) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    // Find requirement file
    const reqFile = await findRequirementFile(requirement);
    if (!reqFile) {
      console.error(chalk.red(`Requirement not found: ${requirement}`));
      return { success: false };
    }

    // Parse requirement
    const content = await fs.readFile(reqFile, 'utf-8');
    const { frontmatter, body, raw } = parseRequirement(content);
    
    const jiraKey = frontmatter.jira?.key;
    if (!jiraKey) {
      console.error(chalk.red('Requirement is not linked to Jira'));
      return { success: false };
    }
    
    console.log(chalk.gray(`Fetching ${jiraKey} from Jira...`));
    
    // Get Jira issue
    const issue = await api.apiRequest(`/issue/${jiraKey}`);
    
    const jiraTitle = issue.fields.summary;
    const jiraStatus = issue.fields.status?.name;
    const jiraLabels = issue.fields.labels || [];
    
    // Map Jira status to requirement status
    const statusMap = {
      'To Do': 'draft',
      'In Progress': 'in-progress',
      'Done': 'done',
      'Closed': 'done'
    };
    const mappedStatus = statusMap[jiraStatus] || frontmatter.status;
    
    // Update requirement frontmatter
    let newFrontmatter = raw.frontmatter;
    
    // Update title
    if (frontmatter.title !== jiraTitle) {
      newFrontmatter = newFrontmatter.replace(
        /title:\s*["']?[^"'\n]+["']?/,
        `title: "${jiraTitle}"`
      );
    }
    
    // Update status if mapped
    if (mappedStatus && mappedStatus !== frontmatter.status) {
      if (newFrontmatter.includes('status:')) {
        newFrontmatter = newFrontmatter.replace(
          /status:\s*[^\n]+/,
          `status: ${mappedStatus}`
        );
      }
    }
    
    // Update tags from labels
    if (jiraLabels.length > 0 && JSON.stringify(jiraLabels) !== JSON.stringify(frontmatter.tags)) {
      if (newFrontmatter.includes('tags:')) {
        newFrontmatter = newFrontmatter.replace(
          /tags:\s*\[[^\]]*\]/,
          `tags: [${jiraLabels.map(l => `"${l}"`).join(', ')}]`
        );
      }
    }
    
    const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    
    // Update jira metadata
    const jiraSection = [
      'jira:',
      `  key: ${jiraKey}`,
      `  project: ${issue.fields.project.key}`,
      `  sync_status: synced`,
      `  last_sync: ${new Date().toISOString()}`,
      `  local_hash: ${contentHash}`
    ].join('\n');
    
    newFrontmatter = newFrontmatter.replace(/jira:\n(?: {2}[^\n]*\n)*/g, '').trim();
    newFrontmatter += '\n' + jiraSection;
    
    // Write updated file
    const newContent = '---\n' + newFrontmatter + '\n---' + body;
    await fs.writeFile(reqFile, newContent);
    
    console.log(chalk.green(`\n✓ Pulled updates from ${jiraKey}`));
    if (frontmatter.title !== jiraTitle) {
      console.log(chalk.white(`  Title: ${jiraTitle}`));
    }
    if (mappedStatus !== frontmatter.status) {
      console.log(chalk.white(`  Status: ${mappedStatus}`));
    }
    
    return { success: true };
  } catch (error) {
    console.error(chalk.red(`Pull failed: ${error.message}`));
    return { success: false, error: error.message };
  }
}

async function findRequirementFile(requirement) {
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

function parseRequirement(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content, raw: { frontmatter: '' } };
  }
  
  const rawFrontmatter = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);
  
  const frontmatter = {};
  
  const titleMatch = rawFrontmatter.match(/title:\s*["']?([^"'\n]+)/);
  if (titleMatch) frontmatter.title = titleMatch[1].trim();
  
  const statusMatch = rawFrontmatter.match(/status:\s*([^\n]+)/);
  if (statusMatch) frontmatter.status = statusMatch[1].trim();
  
  const tagsMatch = rawFrontmatter.match(/tags:\s*\[([^\]]*)\]/);
  if (tagsMatch) {
    frontmatter.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, '')).filter(Boolean);
  }
  
  const jiraMatch = rawFrontmatter.match(/jira:\n((?: {2}[^\n]*\n)*)/);
  if (jiraMatch) {
    frontmatter.jira = {};
    const keyMatch = jiraMatch[1].match(/key:\s*([^\n]+)/);
    if (keyMatch) frontmatter.jira.key = keyMatch[1].trim();
    const projMatch = jiraMatch[1].match(/project:\s*([^\n]+)/);
    if (projMatch) frontmatter.jira.project = projMatch[1].trim();
    const hashMatch = jiraMatch[1].match(/local_hash:\s*([^\n]+)/);
    if (hashMatch) frontmatter.jira.local_hash = hashMatch[1].trim();
    const lastMatch = jiraMatch[1].match(/last_sync:\s*([^\n]+)/);
    if (lastMatch) frontmatter.jira.last_sync = lastMatch[1].trim();
  }
  
  return { frontmatter, body, raw: { frontmatter: rawFrontmatter } };
}

module.exports = handler;
module.exports.description = 'Pull Jira issue updates to requirement';
module.exports.args = ['<requirement>'];

