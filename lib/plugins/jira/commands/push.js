/**
 * Jira Push Command - Push requirement to Jira
 */
const chalk = require('chalk');
const fs = require('node:fs/promises');
const path = require('node:path');
const glob = require('glob');
const crypto = require('node:crypto');
const api = require('../api');

async function handler(args, options = {}) {
  const [requirement] = args;
  
  if (!requirement) {
    console.error(chalk.red('Usage: sc connect jira push <requirement> [--project PROJ]'));
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
    
    const title = frontmatter.title || path.basename(reqFile, '.md');
    const description = extractDescription(body);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    
    // Check if already linked
    const existingKey = frontmatter.jira?.key;
    
    if (existingKey) {
      // Update existing issue
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
      
      // Update frontmatter
      await updateJiraMetadata(reqFile, content, {
        key: existingKey,
        project: frontmatter.jira.project,
        sync_status: 'synced',
        last_sync: new Date().toISOString(),
        local_hash: contentHash
      });
      
      console.log(chalk.green(`\n✓ Updated ${existingKey}`));
      console.log(chalk.gray(`View: https://${creds.domain}/browse/${existingKey}`));
    } else {
      // Create new issue
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
      
      // Update frontmatter with new link
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
    console.error(chalk.red(`Push failed: ${error.message}`));
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
  
  const tagsMatch = rawFrontmatter.match(/tags:\s*\[([^\]]*)\]/);
  if (tagsMatch) {
    frontmatter.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, '')).filter(Boolean);
  }
  
  const jiraMatch = rawFrontmatter.match(/jira:\n((?:  [^\n]*\n)*)/);
  if (jiraMatch) {
    frontmatter.jira = {};
    const keyMatch = jiraMatch[1].match(/key:\s*([^\n]+)/);
    if (keyMatch) frontmatter.jira.key = keyMatch[1].trim();
    const projMatch = jiraMatch[1].match(/project:\s*([^\n]+)/);
    if (projMatch) frontmatter.jira.project = projMatch[1].trim();
  }
  
  return { frontmatter, body, raw: { frontmatter: rawFrontmatter } };
}

function extractDescription(body) {
  const lines = body.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const firstPara = [];
  for (const line of lines) {
    if (line.trim() === '') break;
    firstPara.push(line);
  }
  return firstPara.join('\n').substring(0, 500) || 'No description';
}

async function updateJiraMetadata(reqFile, content, metadata) {
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
  
  frontmatter = frontmatter.replace(/jira:\n(?:  [^\n]*\n)*/g, '').trim();
  frontmatter += '\n' + jiraSection;
  
  const newContent = '---\n' + frontmatter + '\n---' + body;
  await fs.writeFile(reqFile, newContent);
}

module.exports = handler;
module.exports.description = 'Push requirement to Jira (create or update)';
module.exports.args = ['<requirement>'];
module.exports.options = [
  ['-p, --project <key>', 'Jira project for new issues'],
  ['-t, --type <type>', 'Issue type (Story, Task, Bug)', 'Story']
];

