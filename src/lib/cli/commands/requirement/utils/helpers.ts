const chalk = require('chalk');

/**
 * Shared utility functions for requirement management
 */
class RequirementHelpers {
  /**
   * Normalize requirement ID to standard format
   */
  static normalizeReqId(reqId) {
    // Handle various formats: "REQ-039", "req-039", "039", 39
    if (!reqId) return null;

    const idStr = reqId.toString();

    // If it's already in REQ-XXX format, extract the number
    const match = idStr.match(/^(?:REQ-|req-)?(\d+)$/i);
    if (match) {
      return match[1].padStart(3, '0');
    }

    // If it's just a number, pad it
    if (/^\d+$/.test(idStr)) {
      return idStr.padStart(3, '0');
    }

    return null;
  }

  /**
   * Extract requirement ID from filename
   */
  static extractReqIdFromFile(fileName) {
    const match = fileName.match(/req-([a-z0-9]+)-(\d+)/);
    if (match) {
      const [, domain, num] = match;
      return `${domain.toUpperCase()}-${num.padStart(3, '0')}`;
    }
    return fileName.replace('.md', '');
  }

  /**
   * Map epic names to categories
   */
  static epicToCategory(epic) {
    const mapping = {
      'enhanced-workflow-system': 'workflow',
      'dashboard-system': 'core',
      'agent-workflow-enhancement': 'workflow',
      'supernal-code-package': 'infrastructure',
    };

    return mapping[epic] || 'workflow';
  }

  /**
   * Convert priority name to number
   */
  static priorityNameToNumber(priority) {
    const mapping = {
      critical: '0',
      high: '1',
      medium: '2',
      low: '3',
      deferred: '4',
    };

    return mapping[priority?.toLowerCase()] || priority;
  }

  /**
   * Get colored status display
   */
  static getStatusColor(status) {
    const colors = {
      pending: chalk.yellow,
      'in-progress': chalk.blue,
      done: chalk.green,
      cancelled: chalk.red,
      blocked: chalk.magenta,
    };

    return colors[status?.toLowerCase()] || chalk.white;
  }

  /**
   * Get priority icon
   */
  static getPriorityIcon(priority) {
    const icons = {
      0: '🚨', // Critical
      1: '🔥', // High
      2: '📋', // Medium
      3: '📝', // Low
      4: '⏸️', // Deferred
    };

    return icons[priority?.toString()] || '📋';
  }

  /**
   * Get colored status display for search results
   */
  static getColoredStatus(status) {
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
        return chalk.gray(status);
    }
  }

  /**
   * Get colored priority display
   */
  static getPriorityColor(priority) {
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
        return chalk.gray(priority);
    }
  }

  /**
   * Find line number for a search text in content
   */
  static findLineNumber(content, searchText) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 1;
  }

  /**
   * Parse command line options
   */
  static parseOptions(args) {
    const options = {};

    // Ensure args is an array
    if (!Array.isArray(args)) {
      args = [];
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Ensure arg is a string before calling startsWith
      if (arg && typeof arg === 'string' && arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];

        if (value && typeof value === 'string' && !value.startsWith('--')) {
          options[key] = value;
          i++; // Skip the value in next iteration
        } else {
          options[key] = true;
        }
      }
    }

    return options;
  }
}

module.exports = RequirementHelpers;
