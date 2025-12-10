import chalk from 'chalk';

type ChalkColor = (text: string) => string;

class RequirementHelpers {
  static normalizeReqId(reqId: string | number | null | undefined): string | null {
    if (!reqId) return null;

    const idStr = reqId.toString();

    const match = idStr.match(/^(?:REQ-|req-)?(\d+)$/i);
    if (match) {
      return match[1].padStart(3, '0');
    }

    if (/^\d+$/.test(idStr)) {
      return idStr.padStart(3, '0');
    }

    return null;
  }

  static extractReqIdFromFile(fileName: string): string {
    const match = fileName.match(/req-([a-z0-9]+)-(\d+)/);
    if (match) {
      const [, domain, num] = match;
      return `${domain.toUpperCase()}-${num.padStart(3, '0')}`;
    }
    return fileName.replace('.md', '');
  }

  static epicToCategory(epic: string | undefined): string {
    const mapping: Record<string, string> = {
      'enhanced-workflow-system': 'workflow',
      'dashboard-system': 'core',
      'agent-workflow-enhancement': 'workflow',
      'supernal-code-package': 'infrastructure',
    };

    return mapping[epic || ''] || 'workflow';
  }

  static priorityNameToNumber(priority: string | undefined): string {
    const mapping: Record<string, string> = {
      critical: '0',
      high: '1',
      medium: '2',
      low: '3',
      deferred: '4',
    };

    return mapping[priority?.toLowerCase() || ''] || priority || '2';
  }

  static getStatusColor(status: string | undefined): ChalkColor {
    const colors: Record<string, ChalkColor> = {
      pending: chalk.yellow,
      'in-progress': chalk.blue,
      done: chalk.green,
      cancelled: chalk.red,
      blocked: chalk.magenta,
    };

    return colors[status?.toLowerCase() || ''] || chalk.white;
  }

  static getPriorityIcon(priority: string | number | undefined): string {
    const icons: Record<string, string> = {
      '0': '🚨',
      '1': '🔥',
      '2': '📋',
      '3': '📝',
      '4': '⏸️',
    };

    return icons[priority?.toString() || ''] || '📋';
  }

  static getColoredStatus(status: string | undefined): string {
    switch (status?.toLowerCase()) {
      case 'done':
      case 'implemented':
        return chalk.green(status);
      case 'in-progress':
      case 'active':
        return chalk.yellow(status);
      case 'draft':
        return chalk.blue(status);
      case 'blocked':
        return chalk.red(status);
      default:
        return chalk.gray(status || '');
    }
  }

  static getPriorityColor(priority: string | undefined): string {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return chalk.red.bold(priority);
      case 'high':
        return chalk.red(priority);
      case 'medium':
        return chalk.yellow(priority);
      case 'low':
        return chalk.blue(priority);
      default:
        return chalk.gray(priority || '');
    }
  }

  static findLineNumber(content: string, searchText: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 1;
  }

  static parseOptions(args: unknown[]): Record<string, string | boolean> {
    const options: Record<string, string | boolean> = {};

    if (!Array.isArray(args)) {
      return options;
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg && typeof arg === 'string' && arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];

        if (value && typeof value === 'string' && !value.startsWith('--')) {
          options[key] = value;
          i++;
        } else {
          options[key] = true;
        }
      }
    }

    return options;
  }
}

export default RequirementHelpers;
module.exports = RequirementHelpers;
