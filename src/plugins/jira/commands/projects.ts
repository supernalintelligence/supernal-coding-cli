/**
 * Jira List Projects Command
 */
import chalk from 'chalk';
const api = require('../api');

interface Project {
  key: string;
  name: string;
}

interface ProjectsResult {
  success: boolean;
  projects?: Project[];
  error?: string;
}

async function handler(): Promise<ProjectsResult> {
  try {
    const isAuth = await api.isAuthenticated();
    if (!isAuth) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    const response = await api.apiRequest('/project/search');

    if (response.values.length === 0) {
      console.log(chalk.yellow('No projects found'));
      return { success: true, projects: [] };
    }

    console.log(chalk.white(`\nAccessible projects:\n`));

    for (const project of response.values as Project[]) {
      console.log(chalk.cyan(project.key.padEnd(10)) + chalk.white(project.name));
    }

    return { success: true, projects: response.values };
  } catch (error) {
    console.error(chalk.red(`Failed to list projects: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
