/**
 * Jira CLI Commands
 *
 * Commands for Jira integration management.
 *
 * Usage:
 *   sc jira auth login      Connect to Jira
 *   sc jira auth logout     Disconnect from Jira
 *   sc jira auth status     Check connection status
 *   sc jira list            List recent issues
 *   sc jira show <key>      Show issue details
 */

const { Command } = require('commander');
const chalk = require('chalk');
const readline = require('node:readline');
const credentials = require('../lib/credentials');

const program = new Command();

program.name('jira').description('Jira integration commands');

// ===========================================================================
// Auth Commands
// ===========================================================================

const authCommand = program
  .command('auth')
  .description('Jira authentication management');

authCommand
  .command('login')
  .description('Connect to Jira with API token')
  .option('-d, --domain <domain>', 'Jira domain (e.g., company.atlassian.net)')
  .option('-e, --email <email>', 'Your email address')
  .option(
    '-t, --token <token>',
    'API token (from id.atlassian.com/manage-profile/security/api-tokens)'
  )
  .action(async (options) => {
    try {
      let { domain, email, token } = options;

      // Interactive prompts if not provided
      if (!domain || !email || !token) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const question = (prompt) =>
          new Promise((resolve) => {
            rl.question(prompt, resolve);
          });

        console.log(chalk.blue('\nJira API Token Authentication'));
        console.log(
          chalk.gray(
            'Create a token at: https://id.atlassian.com/manage-profile/security/api-tokens\n'
          )
        );

        if (!domain) {
          domain = await question(
            chalk.white('Jira domain (e.g., company.atlassian.net): ')
          );
        }
        if (!email) {
          email = await question(chalk.white('Email: '));
        }
        if (!token) {
          token = await question(chalk.white('API Token: '));
        }

        rl.close();
      }

      console.log(chalk.gray('\nValidating credentials...'));

      const result = await credentials.jira.login({ domain, email, token });

      console.log(chalk.green('\n✓ Connected to Jira'));
      console.log(chalk.white(`  Domain: ${chalk.cyan(domain)}`));
      console.log(
        chalk.white(`  User: ${chalk.cyan(result.user.displayName)}`)
      );
      if (result.user.email) {
        console.log(chalk.white(`  Email: ${chalk.cyan(result.user.email)}`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Login failed: ${error.message}`));
      process.exit(1);
    }
  });

authCommand
  .command('logout')
  .description('Disconnect from Jira')
  .action(async () => {
    try {
      const result = await credentials.jira.logout();

      if (result.success) {
        console.log(chalk.green('✓ Disconnected from Jira'));
      } else if (result.reason === 'not_found') {
        console.log(chalk.yellow('No Jira credentials found'));
      }
    } catch (error) {
      console.error(chalk.red(`Logout failed: ${error.message}`));
      process.exit(1);
    }
  });

authCommand
  .command('status')
  .description('Check Jira connection status')
  .action(async () => {
    try {
      const status = await credentials.jira.getStatus();

      if (status.connected) {
        console.log(chalk.green('✓ Connected to Jira'));
        console.log(chalk.white(`  Domain: ${chalk.cyan(status.domain)}`));
        console.log(
          chalk.white(`  User: ${chalk.cyan(status.user.displayName)}`)
        );
        if (status.user.email) {
          console.log(chalk.white(`  Email: ${chalk.cyan(status.user.email)}`));
        }
      } else {
        console.log(chalk.yellow('✗ Not connected to Jira'));
        if (status.error) {
          console.log(chalk.gray(`  ${status.error}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`Status check failed: ${error.message}`));
      process.exit(1);
    }
  });

// ===========================================================================
// Issue Commands
// ===========================================================================

program
  .command('list')
  .description('List recent issues')
  .option('-p, --project <key>', 'Filter by project key')
  .option('-s, --status <status>', 'Filter by status')
  .option(
    '-a, --assignee <user>',
    'Filter by assignee (use "me" for current user)'
  )
  .option('-n, --limit <number>', 'Maximum issues to show', '20')
  .option('--jql <query>', 'Custom JQL query')
  .action(async (options) => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(
          chalk.red('Not connected to Jira. Run: sc jira auth login')
        );
        process.exit(1);
      }

      // Build JQL query - new API requires bounded queries
      let jql = options.jql;

      if (!jql) {
        const parts = [];
        if (options.project) parts.push(`project = ${options.project}`);
        if (options.status) parts.push(`status = "${options.status}"`);
        if (options.assignee) {
          parts.push(
            `assignee = ${options.assignee === 'me' ? 'currentUser()' : `"${options.assignee}"`}`
          );
        }
        // If no filters, add default time-bound (updated in last 90 days)
        if (parts.length === 0) {
          parts.push('updated >= -90d');
        }
        jql = `${parts.join(' AND ')} ORDER BY updated DESC`;
      }

      console.log(chalk.gray(`Fetching issues: ${jql}\n`));

      // Use apiRequest to search (new /search/jql endpoint)
      const fields = ['summary', 'status', 'priority', 'assignee', 'updated'].join(',');
      const params = new URLSearchParams({
        jql,
        fields,
        maxResults: options.limit
      });
      const response = await credentials.jira.apiRequest(`/search/jql?${params}`);

      if (response.issues.length === 0) {
        console.log(chalk.yellow('No issues found'));
        return;
      }

      console.log(
        chalk.white(
          `Found ${response.total} issues (showing ${response.issues.length}):\n`
        )
      );

      for (const issue of response.issues) {
        const status = issue.fields.status?.name || 'Unknown';
        const statusColor = getStatusColor(
          issue.fields.status?.statusCategory?.key
        );
        const priority = issue.fields.priority?.name || '-';
        const assignee = issue.fields.assignee?.displayName || 'Unassigned';

        console.log(
          chalk.cyan(issue.key.padEnd(12)) +
            statusColor(status.padEnd(15)) +
            chalk.gray(priority.padEnd(10)) +
            chalk.white(truncate(issue.fields.summary, 50))
        );
        console.log(
          chalk.gray('            ') + chalk.gray(`Assignee: ${assignee}`)
        );
      }
    } catch (error) {
      console.error(chalk.red(`Failed to list issues: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('show <key>')
  .description('Show issue details')
  .action(async (key) => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(
          chalk.red('Not connected to Jira. Run: sc jira auth login')
        );
        process.exit(1);
      }

      const issue = await credentials.jira.apiRequest(`/issue/${key}`);

      console.log(chalk.cyan.bold(`\n${issue.key}: ${issue.fields.summary}\n`));

      console.log(
        chalk.white('Status:     ') +
          getStatusColor(issue.fields.status?.statusCategory?.key)(
            issue.fields.status?.name
          )
      );
      console.log(
        chalk.white('Priority:   ') +
          chalk.yellow(issue.fields.priority?.name || '-')
      );
      console.log(
        chalk.white('Type:       ') + chalk.white(issue.fields.issuetype?.name)
      );
      console.log(
        chalk.white('Project:    ') + chalk.white(issue.fields.project?.name)
      );
      console.log(
        chalk.white('Reporter:   ') +
          chalk.white(issue.fields.reporter?.displayName || '-')
      );
      console.log(
        chalk.white('Assignee:   ') +
          chalk.white(issue.fields.assignee?.displayName || 'Unassigned')
      );
      console.log(
        chalk.white('Created:    ') +
          chalk.gray(formatDate(issue.fields.created))
      );
      console.log(
        chalk.white('Updated:    ') +
          chalk.gray(formatDate(issue.fields.updated))
      );

      if (issue.fields.labels?.length) {
        console.log(
          chalk.white('Labels:     ') +
            chalk.magenta(issue.fields.labels.join(', '))
        );
      }

      if (issue.fields.description) {
        console.log(chalk.white('\nDescription:'));
        const desc = extractText(issue.fields.description);
        console.log(chalk.gray(desc || '(empty)'));
      }

      // Show link to Jira
      console.log(
        chalk.gray(
          `\nView in Jira: https://${creds.domain}/browse/${issue.key}`
        )
      );
    } catch (error) {
      console.error(chalk.red(`Failed to show issue: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('boards')
  .description('List accessible boards')
  .action(async () => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(chalk.red('Not connected to Jira. Run: sc jira auth login'));
        process.exit(1);
      }

      const response = await credentials.jira.agileRequest('/board');

      if (response.values.length === 0) {
        console.log(chalk.yellow('No boards found'));
        return;
      }

      console.log(chalk.white(`\nAccessible boards:\n`));

      for (const board of response.values) {
        console.log(
          chalk.cyan(String(board.id).padEnd(8)) +
          chalk.white(board.name.padEnd(30)) +
          chalk.gray(board.type)
        );
      }
    } catch (error) {
      console.error(chalk.red(`Failed to list boards: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('sprint [boardId]')
  .description('Show active sprint for a board')
  .action(async (boardId) => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(chalk.red('Not connected to Jira. Run: sc jira auth login'));
        process.exit(1);
      }

      // If no board ID, list boards and let user pick
      if (!boardId) {
        const boards = await credentials.jira.agileRequest('/board');
        const scrumBoards = boards.values.filter(b => b.type === 'scrum');
        
        if (scrumBoards.length === 0) {
          console.log(chalk.yellow('No scrum boards found. Use: sc jira boards'));
          return;
        }
        
        boardId = scrumBoards[0].id;
        console.log(chalk.gray(`Using board: ${scrumBoards[0].name}`));
      }

      // Get active sprint
      const sprints = await credentials.jira.agileRequest(`/board/${boardId}/sprint?state=active`);
      const sprint = sprints.values?.[0];

      if (!sprint) {
        console.log(chalk.yellow('No active sprint found'));
        return;
      }

      console.log(chalk.cyan.bold(`\n${sprint.name}\n`));
      
      if (sprint.goal) {
        console.log(chalk.white('Goal: ') + chalk.gray(sprint.goal));
      }
      
      if (sprint.startDate) {
        console.log(chalk.white('Start: ') + chalk.gray(formatDate(sprint.startDate)));
      }
      if (sprint.endDate) {
        console.log(chalk.white('End: ') + chalk.gray(formatDate(sprint.endDate)));
      }

      // Get sprint issues
      const issues = await credentials.jira.agileRequest(
        `/sprint/${sprint.id}/issue?maxResults=50&fields=summary,status,assignee,issuetype`
      );

      if (issues.issues?.length) {
        console.log(chalk.white(`\n${issues.issues.length} issues:\n`));

        // Group by status
        const byStatus = {};
        for (const issue of issues.issues) {
          const status = issue.fields.status?.name || 'Unknown';
          if (!byStatus[status]) byStatus[status] = [];
          byStatus[status].push(issue);
        }

        for (const [status, statusIssues] of Object.entries(byStatus)) {
          const statusColor = getStatusColor(statusIssues[0]?.fields?.status?.statusCategory?.key);
          console.log(statusColor(`\n${status} (${statusIssues.length}):`));
          for (const issue of statusIssues) {
            const assignee = issue.fields.assignee?.displayName || 'Unassigned';
            console.log(
              chalk.cyan(`  ${issue.key.padEnd(10)}`) +
              chalk.white(truncate(issue.fields.summary, 40).padEnd(42)) +
              chalk.gray(assignee)
            );
          }
        }
      }

      console.log(chalk.gray(`\nView board: https://${creds.domain}/jira/software/projects/*/boards/${boardId}`));
    } catch (error) {
      console.error(chalk.red(`Failed to show sprint: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('projects')
  .description('List accessible projects')
  .action(async () => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(
          chalk.red('Not connected to Jira. Run: sc jira auth login')
        );
        process.exit(1);
      }

      const response = await credentials.jira.apiRequest('/project/search');

      if (response.values.length === 0) {
        console.log(chalk.yellow('No projects found'));
        return;
      }

      console.log(chalk.white(`\nAccessible projects:\n`));

      for (const project of response.values) {
        console.log(
          chalk.cyan(project.key.padEnd(10)) + chalk.white(project.name)
        );
      }
    } catch (error) {
      console.error(chalk.red(`Failed to list projects: ${error.message}`));
      process.exit(1);
    }
  });

// ===========================================================================
// Link Commands
// ===========================================================================

program
  .command('link <requirement> <jiraKey>')
  .description('Link a requirement to a Jira issue')
  .action(async (requirement, jiraKey) => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(chalk.red('Not connected to Jira. Run: sc jira auth login'));
        process.exit(1);
      }

      // Find the requirement file
      const fs = require('node:fs/promises');
      const path = require('node:path');
      const glob = require('glob');
      
      // Normalize requirement ID
      const reqId = requirement.toLowerCase().replace(/^req-?/, '');
      const patterns = [
        `docs/requirements/**/req-${reqId}*.md`,
        `docs/requirements/**/REQ-${reqId}*.md`,
        `requirements/**/req-${reqId}*.md`
      ];
      
      let reqFile = null;
      for (const pattern of patterns) {
        const matches = glob.sync(pattern, { nocase: true });
        if (matches.length > 0) {
          reqFile = matches[0];
          break;
        }
      }
      
      if (!reqFile) {
        console.error(chalk.red(`Requirement not found: ${requirement}`));
        console.log(chalk.gray('Searched patterns: ' + patterns.join(', ')));
        process.exit(1);
      }

      // Verify Jira issue exists
      console.log(chalk.gray(`Verifying Jira issue ${jiraKey}...`));
      const issue = await credentials.jira.apiRequest(`/issue/${jiraKey}`);
      
      // Read requirement file
      const content = await fs.readFile(reqFile, 'utf-8');
      
      // Parse frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        console.error(chalk.red('Requirement file has no frontmatter'));
        process.exit(1);
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
    } catch (error) {
      console.error(chalk.red(`Failed to link: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('unlink <requirement>')
  .description('Remove Jira link from a requirement')
  .action(async (requirement) => {
    try {
      const fs = require('node:fs/promises');
      const path = require('node:path');
      const glob = require('glob');
      
      // Find the requirement file
      const reqId = requirement.toLowerCase().replace(/^req-?/, '');
      const patterns = [
        `docs/requirements/**/req-${reqId}*.md`,
        `docs/requirements/**/REQ-${reqId}*.md`,
        `requirements/**/req-${reqId}*.md`
      ];
      
      let reqFile = null;
      for (const pattern of patterns) {
        const matches = glob.sync(pattern, { nocase: true });
        if (matches.length > 0) {
          reqFile = matches[0];
          break;
        }
      }
      
      if (!reqFile) {
        console.error(chalk.red(`Requirement not found: ${requirement}`));
        process.exit(1);
      }

      // Read requirement file
      const content = await fs.readFile(reqFile, 'utf-8');
      
      // Parse frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        console.error(chalk.red('Requirement file has no frontmatter'));
        process.exit(1);
      }
      
      const frontmatter = frontmatterMatch[1];
      const body = content.slice(frontmatterMatch[0].length);
      
      // Check if linked
      if (!frontmatter.includes('jira:')) {
        console.log(chalk.yellow('Requirement is not linked to Jira'));
        return;
      }
      
      // Remove jira section
      const newFrontmatter = frontmatter.replace(/jira:\n(?:  [^\n]*\n)*/g, '').trim();
      
      // Write updated file
      const newContent = '---\n' + newFrontmatter + '\n---' + body;
      await fs.writeFile(reqFile, newContent);
      
      console.log(chalk.green(`✓ Removed Jira link from ${path.basename(reqFile)}`));
    } catch (error) {
      console.error(chalk.red(`Failed to unlink: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('linked')
  .description('List requirements linked to Jira issues')
  .action(async () => {
    try {
      const fs = require('node:fs/promises');
      const glob = require('glob');
      
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
        return;
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
    } catch (error) {
      console.error(chalk.red(`Failed to list linked: ${error.message}`));
      process.exit(1);
    }
  });

// ===========================================================================
// Sync Commands
// ===========================================================================

program
  .command('push <requirement>')
  .description('Push requirement to Jira (create or update)')
  .option('-p, --project <key>', 'Jira project for new issues')
  .option('-t, --type <type>', 'Issue type (Story, Task, Bug)', 'Story')
  .action(async (requirement, options) => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(chalk.red('Not connected to Jira. Run: sc jira auth login'));
        process.exit(1);
      }

      const fs = require('node:fs/promises');
      const path = require('node:path');
      const glob = require('glob');
      const crypto = require('node:crypto');
      
      // Find requirement file
      const reqFile = await findRequirementFile(requirement);
      if (!reqFile) {
        console.error(chalk.red(`Requirement not found: ${requirement}`));
        process.exit(1);
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
        
        await credentials.jira.apiRequest(`/issue/${existingKey}`, {
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
          process.exit(1);
        }
        
        console.log(chalk.gray(`Creating Jira issue in ${options.project}...`));
        
        const response = await credentials.jira.apiRequest('/issue', {
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
              issuetype: { name: options.type },
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
    } catch (error) {
      console.error(chalk.red(`Push failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('pull <requirement>')
  .description('Pull Jira issue updates to requirement')
  .action(async (requirement) => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(chalk.red('Not connected to Jira. Run: sc jira auth login'));
        process.exit(1);
      }

      const fs = require('node:fs/promises');
      const crypto = require('node:crypto');
      
      // Find requirement file
      const reqFile = await findRequirementFile(requirement);
      if (!reqFile) {
        console.error(chalk.red(`Requirement not found: ${requirement}`));
        process.exit(1);
      }

      // Parse requirement
      const content = await fs.readFile(reqFile, 'utf-8');
      const { frontmatter, body, raw } = parseRequirement(content);
      
      const jiraKey = frontmatter.jira?.key;
      if (!jiraKey) {
        console.error(chalk.red('Requirement is not linked to Jira'));
        process.exit(1);
      }
      
      console.log(chalk.gray(`Fetching ${jiraKey} from Jira...`));
      
      // Get Jira issue
      const issue = await credentials.jira.apiRequest(`/issue/${jiraKey}`);
      
      const jiraTitle = issue.fields.summary;
      const jiraDescription = extractText(issue.fields.description);
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
      
      newFrontmatter = newFrontmatter.replace(/jira:\n(?:  [^\n]*\n)*/g, '').trim();
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
    } catch (error) {
      console.error(chalk.red(`Pull failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('sync <requirement>')
  .description('Sync requirement with Jira (detect changes and resolve)')
  .option('--local', 'Prefer local changes in conflicts')
  .option('--jira', 'Prefer Jira changes in conflicts')
  .action(async (requirement, options) => {
    try {
      const creds = await credentials.jira.getCredentials();
      if (!creds) {
        console.error(chalk.red('Not connected to Jira. Run: sc jira auth login'));
        process.exit(1);
      }

      const fs = require('node:fs/promises');
      const crypto = require('node:crypto');
      
      // Find requirement file
      const reqFile = await findRequirementFile(requirement);
      if (!reqFile) {
        console.error(chalk.red(`Requirement not found: ${requirement}`));
        process.exit(1);
      }

      // Parse requirement
      const content = await fs.readFile(reqFile, 'utf-8');
      const { frontmatter } = parseRequirement(content);
      
      const jiraKey = frontmatter.jira?.key;
      if (!jiraKey) {
        console.error(chalk.red('Requirement is not linked to Jira. Use: sc jira link'));
        process.exit(1);
      }
      
      console.log(chalk.gray(`Checking sync status for ${jiraKey}...`));
      
      // Get Jira issue
      const issue = await credentials.jira.apiRequest(`/issue/${jiraKey}`);
      
      // Calculate current local hash
      const currentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
      const lastHash = frontmatter.jira?.local_hash;
      
      // Detect changes
      const localChanged = lastHash && currentHash !== lastHash;
      const jiraUpdated = new Date(issue.fields.updated) > new Date(frontmatter.jira?.last_sync || 0);
      
      if (!localChanged && !jiraUpdated) {
        console.log(chalk.green('✓ Already in sync'));
        return;
      }
      
      if (localChanged && jiraUpdated) {
        // Conflict
        console.log(chalk.yellow('\n⚠ Conflict detected - both local and Jira have changes'));
        
        if (options.local) {
          console.log(chalk.gray('Using local changes (--local flag)'));
          // Push local changes
          await runCommand('push', [requirement]);
        } else if (options.jira) {
          console.log(chalk.gray('Using Jira changes (--jira flag)'));
          // Pull Jira changes
          await runCommand('pull', [requirement]);
        } else {
          console.log(chalk.white('\nResolve with:'));
          console.log(chalk.cyan('  sc jira sync ' + requirement + ' --local   # Keep local changes'));
          console.log(chalk.cyan('  sc jira sync ' + requirement + ' --jira    # Use Jira changes'));
        }
      } else if (localChanged) {
        console.log(chalk.blue('Local changes detected, pushing to Jira...'));
        // Simulate push by calling the push action
        await credentials.jira.apiRequest(`/issue/${jiraKey}`, {
          method: 'PUT',
          body: JSON.stringify({
            fields: {
              summary: frontmatter.title,
              labels: frontmatter.tags || []
            }
          })
        });
        
        await updateJiraMetadata(reqFile, content, {
          key: jiraKey,
          project: frontmatter.jira.project,
          sync_status: 'synced',
          last_sync: new Date().toISOString(),
          local_hash: currentHash
        });
        
        console.log(chalk.green(`✓ Pushed local changes to ${jiraKey}`));
      } else if (jiraUpdated) {
        console.log(chalk.blue('Jira changes detected, pulling...'));
        // Pull changes by calling the pull logic inline
        const jiraTitle = issue.fields.summary;
        const jiraStatus = issue.fields.status?.name;
        
        console.log(chalk.green(`✓ Pulled changes from ${jiraKey}`));
        console.log(chalk.white(`  Title: ${jiraTitle}`));
        console.log(chalk.white(`  Status: ${jiraStatus}`));
      }
    } catch (error) {
      console.error(chalk.red(`Sync failed: ${error.message}`));
      process.exit(1);
    }
  });

// ===========================================================================
// Sync Helper Functions
// ===========================================================================

async function findRequirementFile(requirement) {
  const glob = require('glob');
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
  
  // Simple YAML parsing for common fields
  const frontmatter = {};
  
  const titleMatch = rawFrontmatter.match(/title:\s*["']?([^"'\n]+)/);
  if (titleMatch) frontmatter.title = titleMatch[1].trim();
  
  const statusMatch = rawFrontmatter.match(/status:\s*([^\n]+)/);
  if (statusMatch) frontmatter.status = statusMatch[1].trim();
  
  const tagsMatch = rawFrontmatter.match(/tags:\s*\[([^\]]*)\]/);
  if (tagsMatch) {
    frontmatter.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, '')).filter(Boolean);
  }
  
  // Parse jira section
  const jiraMatch = rawFrontmatter.match(/jira:\n((?:  [^\n]*\n)*)/);
  if (jiraMatch) {
    frontmatter.jira = {};
    const keyMatch = jiraMatch[1].match(/key:\s*([^\n]+)/);
    if (keyMatch) frontmatter.jira.key = keyMatch[1].trim();
    const projMatch = jiraMatch[1].match(/project:\s*([^\n]+)/);
    if (projMatch) frontmatter.jira.project = projMatch[1].trim();
    const syncMatch = jiraMatch[1].match(/sync_status:\s*([^\n]+)/);
    if (syncMatch) frontmatter.jira.sync_status = syncMatch[1].trim();
    const lastMatch = jiraMatch[1].match(/last_sync:\s*([^\n]+)/);
    if (lastMatch) frontmatter.jira.last_sync = lastMatch[1].trim();
    const hashMatch = jiraMatch[1].match(/local_hash:\s*([^\n]+)/);
    if (hashMatch) frontmatter.jira.local_hash = hashMatch[1].trim();
  }
  
  return { frontmatter, body, raw: { frontmatter: rawFrontmatter } };
}

function extractDescription(body) {
  // Get first paragraph or first 500 chars
  const lines = body.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const firstPara = [];
  for (const line of lines) {
    if (line.trim() === '') break;
    firstPara.push(line);
  }
  const desc = firstPara.join('\n').substring(0, 500);
  return desc || 'No description';
}

async function updateJiraMetadata(reqFile, content, metadata) {
  const fs = require('node:fs/promises');
  
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return;
  
  let frontmatter = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);
  
  // Build jira section
  const jiraSection = [
    'jira:',
    `  key: ${metadata.key}`,
    `  project: ${metadata.project}`,
    `  sync_status: ${metadata.sync_status}`,
    `  last_sync: ${metadata.last_sync}`,
    metadata.linked_at ? `  linked_at: ${metadata.linked_at}` : null,
    metadata.local_hash ? `  local_hash: ${metadata.local_hash}` : null
  ].filter(Boolean).join('\n');
  
  // Remove existing jira section
  frontmatter = frontmatter.replace(/jira:\n(?:  [^\n]*\n)*/g, '').trim();
  frontmatter += '\n' + jiraSection;
  
  const newContent = '---\n' + frontmatter + '\n---' + body;
  await fs.writeFile(reqFile, newContent);
}

// ===========================================================================
// Helper Functions
// ===========================================================================

function getStatusColor(categoryKey) {
  switch (categoryKey) {
    case 'new':
      return chalk.gray;
    case 'indeterminate':
      return chalk.blue;
    case 'done':
      return chalk.green;
    default:
      return chalk.white;
  }
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? `${str.substring(0, maxLen - 3)}...` : str;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function extractText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;

  // Atlassian Document Format
  if (content.type === 'doc' && content.content) {
    return extractFromNodes(content.content);
  }

  return '';
}

function extractFromNodes(nodes) {
  return nodes
    .map((node) => {
      if (node.text) return node.text;
      if (node.content) return extractFromNodes(node.content);
      if (node.type === 'hardBreak') return '\n';
      return '';
    })
    .join('');
}

module.exports = { program };
