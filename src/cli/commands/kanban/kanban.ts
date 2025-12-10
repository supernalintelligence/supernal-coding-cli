#!/usr/bin/env node
// @ts-nocheck

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

class KanbanWrapper {
  priorityScript: any;
  scriptsDir: any;
  unifiedScript: any;
  constructor() {
    this.scriptsDir = path.join(__dirname, 'kanban-scripts');
    this.unifiedScript = path.join(this.scriptsDir, 'kanban-unified.sh');
    this.priorityScript = path.join(this.scriptsDir, 'kanban-priority.sh');

    // Ensure scripts are executable
    this.ensureExecutable();
  }

  ensureExecutable() {
    try {
      if (fs.existsSync(this.unifiedScript)) {
        execSync(`chmod +x "${this.unifiedScript}"`);
      }
      if (fs.existsSync(this.priorityScript)) {
        execSync(`chmod +x "${this.priorityScript}"`);
      }
    } catch (_error) {
      console.error(
        `${colors.yellow}⚠️  Warning: Could not make scripts executable${colors.reset}`
      );
    }
  }

  // Execute kanban-unified.sh with arguments
  runUnifiedCommand(args) {
    try {
      if (!fs.existsSync(this.unifiedScript)) {
        console.error(
          `${colors.red}❌ Kanban unified script not found: ${this.unifiedScript}${colors.reset}`
        );
        return;
      }

      const command = `"${this.unifiedScript}" ${args.map((arg) => `"${arg}"`).join(' ')}`;
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      if (error.status !== 0) {
        process.exit(error.status);
      }
    }
  }

  // Execute kanban-priority.sh with arguments
  runPriorityCommand(args) {
    try {
      if (!fs.existsSync(this.priorityScript)) {
        console.error(
          `${colors.red}❌ Kanban priority script not found: ${this.priorityScript}${colors.reset}`
        );
        return;
      }

      const command = `"${this.priorityScript}" ${args.map((arg) => `"${arg}"`).join(' ')}`;
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      if (error.status !== 0) {
        process.exit(error.status);
      }
    }
  }

  // Route commands to appropriate scripts
  execute(args) {
    if (args.length === 0) {
      this.showHelp();
      return;
    }

    const command = args[0];
    const remainingArgs = args.slice(1);

    // Priority-specific commands go to kanban-priority.sh
    if (command === 'priority') {
      this.runPriorityCommand(remainingArgs);
      return;
    }

    // All other commands go to kanban-unified.sh
    this.runUnifiedCommand(args);
  }

  showHelp() {
    console.log(`${colors.bold}Supernal Coding - Kanban System${colors.reset}`);
    console.log('===================================');
    console.log('');
    console.log(
      `${colors.bold}Usage:${colors.reset} sc kanban [command] [args...]`
    );
    console.log('');
    console.log(`${colors.bold}Core Commands:${colors.reset}`);
    console.log(
      `  ${colors.green}list${colors.reset} [type]              List tasks (all, todo, doing, blocked, done, handoffs)`
    );
    console.log(
      `  ${colors.green}stats${colors.reset}                    Show task statistics and overview`
    );
    console.log(
      `  ${colors.green}move${colors.reset} <file> <state>      Move task between states`
    );
    console.log(
      `  ${colors.green}search${colors.reset} <query>           Search across all kanban items`
    );
    console.log('');
    console.log(`${colors.bold}Natural Language:${colors.reset}`);
    console.log(
      `  ${colors.green}brainstorm${colors.reset} <description>  Create brainstorm item`
    );
    console.log(
      `  ${colors.green}planning${colors.reset} <description>   Create planning task`
    );
    console.log(
      `  ${colors.green}todo${colors.reset} <description>       Create todo task`
    );
    console.log(
      `  ${colors.green}doing${colors.reset} <description>      Create active task`
    );
    console.log(
      `  ${colors.green}blocked${colors.reset} <description>    Create blocked task`
    );
    console.log(
      `  ${colors.green}handoff${colors.reset} <description>    Create handoff task`
    );
    console.log('');
    console.log(`${colors.bold}Priority Management:${colors.reset}`);
    console.log(
      `  ${colors.green}priority list${colors.reset}            List all tasks by priority`
    );
    console.log(
      `  ${colors.green}priority next${colors.reset}            Show next task by priority`
    );
    console.log(
      `  ${colors.green}priority stats${colors.reset}           Show priority statistics`
    );
    console.log('');
    console.log(`${colors.bold}System:${colors.reset}`);
    console.log(
      `  ${colors.green}init${colors.reset}                     Initialize kanban system`
    );
    console.log(
      `  ${colors.green}cleanup${colors.reset}                  Archive old completed tasks`
    );
    console.log(
      `  ${colors.green}organize${colors.reset}                 Organize and clean up task files`
    );
    console.log('');
    console.log(`${colors.bold}Examples:${colors.reset}`);
    console.log(`  sc kanban list`);
    console.log(`  sc kanban todo "implement user authentication"`);
    console.log(`  sc kanban priority next`);
    console.log(`  sc kanban move "auth-task.md" doing`);
    console.log('');
    console.log(
      'This wrapper executes the proven kanban shell scripts while providing'
    );
    console.log('a unified CLI interface through the sc command.');
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const kanban = new KanbanWrapper();
  kanban.execute(args);
}

if (require.main === module) {
  main();
}

module.exports = KanbanWrapper;
