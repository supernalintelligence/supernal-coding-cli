/**
 * Jira List Issues Command
 */
import chalk from 'chalk';
const api = require('../api');
import { getStatusColor, truncate } from './utils';

interface ListOptions {
  jql?: string;
  project?: string;
  status?: string;
  assignee?: string;
  limit?: string;
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status?: {
      name: string;
      statusCategory?: {
        key: string;
      };
    };
    priority?: {
      name: string;
    };
    assignee?: {
      displayName: string;
    };
  };
}

interface SearchResponse {
  issues: JiraIssue[];
  isLast: boolean;
}

interface ListResult {
  success: boolean;
  issues?: JiraIssue[];
  error?: string;
}

async function handler(_args: string[], options: ListOptions = {}): Promise<ListResult> {
  try {
    const isAuth = await api.isAuthenticated();
    if (!isAuth) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    let jql = options.jql;

    if (!jql) {
      const parts: string[] = [];
      if (options.project) parts.push(`project = ${options.project}`);
      if (options.status) parts.push(`status = "${options.status}"`);
      if (options.assignee) {
        parts.push(
          `assignee = ${options.assignee === 'me' ? 'currentUser()' : `"${options.assignee}"`}`
        );
      }
      if (parts.length === 0) {
        parts.push('updated >= -90d');
      }
      jql = `${parts.join(' AND ')} ORDER BY updated DESC`;
    }

    console.log(chalk.gray(`Fetching issues: ${jql}\n`));

    const client = api.createClient();
    const response: SearchResponse = await client.searchIssues(jql, {
      maxResults: parseInt(options.limit || '20', 10)
    });

    if (response.issues.length === 0) {
      console.log(chalk.yellow('No issues found'));
      return { success: true, issues: [] };
    }

    const issueCount = response.issues.length;
    const moreAvailable = !response.isLast ? '+' : '';
    console.log(
      chalk.white(`Found ${issueCount}${moreAvailable} issues:\n`)
    );

    for (const issue of response.issues) {
      const status = issue.fields.status?.name || 'Unknown';
      const statusColor = getStatusColor(issue.fields.status?.statusCategory?.key || '');
      const priority = issue.fields.priority?.name || '-';
      const assignee = issue.fields.assignee?.displayName || 'Unassigned';

      console.log(
        chalk.cyan(issue.key.padEnd(12)) +
        statusColor(status.padEnd(15)) +
        chalk.gray(priority.padEnd(10)) +
        chalk.white(truncate(issue.fields.summary, 50))
      );
      console.log(chalk.gray('            ') + chalk.gray(`Assignee: ${assignee}`));
    }

    return { success: true, issues: response.issues };
  } catch (error) {
    console.error(chalk.red(`Failed to list issues: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
