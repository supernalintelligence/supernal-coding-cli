// @ts-nocheck
/**
 * Jira Sync Command - Bidirectional sync
 */
const chalk = require('chalk');
const fs = require('node:fs/promises');
const glob = require('glob');
const crypto = require('node:crypto');
const api = require('../api');

async function handler(args, options = {}) {
  const [requirement] = args;
  
  if (!requirement) {
    console.error(chalk.red('Usage: sc connect jira sync <requirement> [--local|--jira]'));
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
    const { frontmatter } = parseRequirement(content);
    
    const jiraKey = frontmatter.jira?.key;
    if (!jiraKey) {
      console.error(chalk.red('Requirement is not linked to Jira. Use: sc connect jira link'));
      return { success: false };
    }
    
    console.log(chalk.gray(`Checking sync status for ${jiraKey}...`));
    
    // Get Jira issue
    const issue = await api.apiRequest(`/issue/${jiraKey}`);
    
    // Calculate current local hash
    const currentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    const lastHash = frontmatter.jira?.local_hash;
    
    // Detect changes
    const localChanged = lastHash && currentHash !== lastHash;
    const jiraUpdated = new Date(issue.fields.updated) > new Date(frontmatter.jira?.last_sync || 0);
    
    if (!localChanged && !jiraUpdated) {
      console.log(chalk.green('✓ Already in sync'));
      return { success: true, status: 'synced' };
    }
    
    if (localChanged && jiraUpdated) {
      // Conflict
      console.log(chalk.yellow('\n⚠ Conflict detected - both local and Jira have changes'));
      
      if (options.local) {
        console.log(chalk.gray('Using local changes (--local flag)'));
        // Push local
        const push = require('./push');
        return await push([requirement], options);
      } else if (options.jira) {
        console.log(chalk.gray('Using Jira changes (--jira flag)'));
        // Pull Jira
        const pull = require('./pull');
        return await pull([requirement], options);
      } else {
        console.log(chalk.white('\nResolve with:'));
        console.log(chalk.cyan(`  sc connect jira sync ${requirement} --local   # Keep local changes`));
        console.log(chalk.cyan(`  sc connect jira sync ${requirement} --jira    # Use Jira changes`));
        return { success: false, status: 'conflict' };
      }
    } else if (localChanged) {
      console.log(chalk.blue('Local changes detected, pushing to Jira...'));
      const push = require('./push');
      return await push([requirement], options);
    } else if (jiraUpdated) {
      console.log(chalk.blue('Jira changes detected, pulling...'));
      const pull = require('./pull');
      return await pull([requirement], options);
    }
    
    return { success: true };
  } catch (error) {
    console.error(chalk.red(`Sync failed: ${error.message}`));
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
    return { frontmatter: {} };
  }
  
  const rawFrontmatter = frontmatterMatch[1];
  const frontmatter = {};
  
  const jiraMatch = rawFrontmatter.match(/jira:\n((?: {2}[^\n]*\n)*)/);
  if (jiraMatch) {
    frontmatter.jira = {};
    const keyMatch = jiraMatch[1].match(/key:\s*([^\n]+)/);
    if (keyMatch) frontmatter.jira.key = keyMatch[1].trim();
    const hashMatch = jiraMatch[1].match(/local_hash:\s*([^\n]+)/);
    if (hashMatch) frontmatter.jira.local_hash = hashMatch[1].trim();
    const lastMatch = jiraMatch[1].match(/last_sync:\s*([^\n]+)/);
    if (lastMatch) frontmatter.jira.last_sync = lastMatch[1].trim();
  }
  
  return { frontmatter };
}

module.exports = handler;
module.exports.description = 'Sync requirement with Jira (detect changes and resolve)';
module.exports.args = ['<requirement>'];
module.exports.options = [
  ['--local', 'Prefer local changes in conflicts'],
  ['--jira', 'Prefer Jira changes in conflicts']
];

