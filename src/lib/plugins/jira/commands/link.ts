/**
 * Jira Link Command - Link requirement to Jira issue
 */
const chalk = require('chalk');
const fs = require('node:fs/promises');
const path = require('node:path');
const glob = require('glob');
const api = require('../api');

async function handler(args) {
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

    // Find the requirement file
    const reqFile = await findRequirementFile(requirement);
    if (!reqFile) {
      console.error(chalk.red(`Requirement not found: ${requirement}`));
      return { success: false };
    }

    // Verify Jira issue exists
    console.log(chalk.gray(`Verifying Jira issue ${jiraKey}...`));
    const issue = await api.apiRequest(`/issue/${jiraKey}`);
    
    // Read requirement file
    const content = await fs.readFile(reqFile, 'utf-8');
    
    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.error(chalk.red('Requirement file has no frontmatter'));
      return { success: false };
    }
    
    const frontmatter = frontmatterMatch[1];
    const body = content.slice(frontmatterMatch[0].length);
    
    // Check if already linked
    if (frontmatter.includes('jira:')) {
      console.log(chalk.yellow('Requirement already has Jira link. Updating...'));
    }
    
    // Build new frontmatter with jira section
    const jiraSection = [
      'jira:',
      `  key: ${issue.key}`,
      `  project: ${issue.fields.project.key}`,
      `  sync_status: linked`,
      `  last_sync: ${new Date().toISOString()}`,
      `  linked_at: ${new Date().toISOString()}`
    ].join('\n');
    
    // Remove existing jira section if present
    let newFrontmatter = frontmatter.replace(/jira:\n(?:  [^\n]*\n)*/g, '').trim();
    newFrontmatter += '\n' + jiraSection;
    
    // Write updated file
    const newContent = '---\n' + newFrontmatter + '\n---' + body;
    await fs.writeFile(reqFile, newContent);
    
    console.log(chalk.green(`\n✓ Linked ${path.basename(reqFile)} to ${issue.key}`));
    console.log(chalk.white(`  Issue: ${issue.fields.summary}`));
    console.log(chalk.white(`  Status: ${issue.fields.status.name}`));
    console.log(chalk.gray(`\nView in Jira: https://${creds.domain}/browse/${issue.key}`));
    
    return { success: true };
  } catch (error) {
    console.error(chalk.red(`Failed to link: ${error.message}`));
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

module.exports = handler;
module.exports.description = 'Link a requirement to a Jira issue';
module.exports.args = ['<requirement>', '<jiraKey>'];

