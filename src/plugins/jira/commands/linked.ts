/**
 * Jira Linked Command - List requirements linked to Jira
 */
const chalk = require('chalk');
const fs = require('node:fs/promises');
const glob = require('glob');
const { truncate } = require('./utils');

async function handler() {
  try {
    // Find all requirement files
    const patterns = [
      'docs/requirements/**/*.md',
      'requirements/**/*.md'
    ];
    
    const files = [];
    for (const pattern of patterns) {
      files.push(...glob.sync(pattern));
    }
    
    const linked = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) continue;
        
        const frontmatter = frontmatterMatch[1];
        
        // Extract jira key
        const keyMatch = frontmatter.match(/jira:\n(?:.*\n)*?\s*key:\s*([^\n]+)/);
        const syncMatch = frontmatter.match(/sync_status:\s*([^\n]+)/);
        const titleMatch = frontmatter.match(/title:\s*["']?([^"'\n]+)/);
        
        if (keyMatch) {
          linked.push({
            file,
            jiraKey: keyMatch[1].trim(),
            syncStatus: syncMatch ? syncMatch[1].trim() : 'unknown',
            title: titleMatch ? titleMatch[1].trim() : file
          });
        }
      } catch {
        // Skip files we can't read
      }
    }
    
    if (linked.length === 0) {
      console.log(chalk.yellow('No requirements linked to Jira'));
      return { success: true, linked: [] };
    }
    
    console.log(chalk.white(`\n${linked.length} requirements linked to Jira:\n`));
    
    for (const item of linked) {
      const statusColor = item.syncStatus === 'synced' ? chalk.green :
        item.syncStatus === 'linked' ? chalk.blue : chalk.yellow;
      
      console.log(
        chalk.cyan(item.jiraKey.padEnd(12)) +
        statusColor(item.syncStatus.padEnd(12)) +
        chalk.white(truncate(item.title, 50))
      );
    }
    
    return { success: true, linked };
  } catch (error) {
    console.error(chalk.red(`Failed to list linked: ${error.message}`));
    return { success: false, error: error.message };
  }
}

module.exports = handler;
module.exports.description = 'List requirements linked to Jira issues';

