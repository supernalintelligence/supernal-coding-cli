/**
 * Jira Unlink Command - Remove Jira link from requirement
 */
const chalk = require('chalk');
const fs = require('node:fs/promises');
const path = require('node:path');
const glob = require('glob');

async function handler(args) {
  const [requirement] = args;
  
  if (!requirement) {
    console.error(chalk.red('Usage: sc connect jira unlink <requirement>'));
    return { success: false };
  }

  try {
    // Find the requirement file
    const reqFile = await findRequirementFile(requirement);
    if (!reqFile) {
      console.error(chalk.red(`Requirement not found: ${requirement}`));
      return { success: false };
    }

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
    
    // Check if linked
    if (!frontmatter.includes('jira:')) {
      console.log(chalk.yellow('Requirement is not linked to Jira'));
      return { success: true };
    }
    
    // Remove jira section
    const newFrontmatter = frontmatter.replace(/jira:\n(?:  [^\n]*\n)*/g, '').trim();
    
    // Write updated file
    const newContent = '---\n' + newFrontmatter + '\n---' + body;
    await fs.writeFile(reqFile, newContent);
    
    console.log(chalk.green(`✓ Removed Jira link from ${path.basename(reqFile)}`));
    return { success: true };
  } catch (error) {
    console.error(chalk.red(`Failed to unlink: ${error.message}`));
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
module.exports.description = 'Remove Jira link from a requirement';
module.exports.args = ['<requirement>'];

