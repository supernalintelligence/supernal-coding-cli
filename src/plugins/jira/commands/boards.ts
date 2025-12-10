/**
 * Jira List Boards Command
 */
import chalk from 'chalk';
const api = require('../api');

interface Board {
  id: number;
  name: string;
  type: string;
}

interface BoardsResult {
  success: boolean;
  boards?: Board[];
  error?: string;
}

async function handler(): Promise<BoardsResult> {
  try {
    const isAuth = await api.isAuthenticated();
    if (!isAuth) {
      console.error(chalk.red('Not connected to Jira. Run: sc connect jira auth login'));
      return { success: false };
    }

    const response = await api.agileRequest('/board');

    if (response.values.length === 0) {
      console.log(chalk.yellow('No boards found'));
      return { success: true, boards: [] };
    }

    console.log(chalk.white(`\nAccessible boards:\n`));

    for (const board of response.values as Board[]) {
      console.log(
        chalk.cyan(String(board.id).padEnd(8)) +
        chalk.white(board.name.padEnd(30)) +
        chalk.gray(board.type)
      );
    }

    return { success: true, boards: response.values };
  } catch (error) {
    console.error(chalk.red(`Failed to list boards: ${(error as Error).message}`));
    return { success: false, error: (error as Error).message };
  }
}

export = handler;
