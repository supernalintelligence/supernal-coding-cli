/**
 * CLI Output Formatters
 * Utilities for formatting CLI output
 */

const chalk = require('chalk');

/**
 * Format error for CLI display
 * @param {Error} error - Error to format
 * @returns {string} Formatted error message
 */
function formatError(error) {
  if (error.code) {
    return chalk.red(`Error [${error.code}]: ${error.message}`);
  }
  return chalk.red(`Error: ${error.message}`);
}

/**
 * Format success message
 * @param {string} message - Success message
 * @returns {string} Formatted success message
 */
function formatSuccess(message) {
  return chalk.green('✓ ') + message;
}

/**
 * Format warning message
 * @param {string} message - Warning message
 * @returns {string} Formatted warning message
 */
function formatWarning(message) {
  return chalk.yellow('⚠ ') + message;
}

/**
 * Format info message
 * @param {string} message - Info message
 * @returns {string} Formatted info message
 */
function formatInfo(message) {
  return chalk.blue('ℹ ') + message;
}

/**
 * Format table for CLI display
 * @param {Array<Object>} rows - Table rows
 * @param {Array<string>} headers - Column headers
 * @returns {string} Formatted table
 */
function formatTable(rows, headers) {
  if (rows.length === 0) {
    return 'No data to display';
  }

  // Calculate column widths
  const widths = headers.map((header, i) => {
    const maxWidth = Math.max(
      header.length,
      ...rows.map((row) => String(row[i] || '').length)
    );
    return maxWidth + 2;
  });

  // Format header
  const headerLine = headers
    .map((h, i) => h.padEnd(widths[i]))
    .join('│')
    .trim();
  const separator = widths.map((w) => '─'.repeat(w)).join('┼');

  // Format rows
  const dataLines = rows.map((row) =>
    headers
      .map((_, i) => String(row[i] || '').padEnd(widths[i]))
      .join('│')
      .trim()
  );

  return [headerLine, separator, ...dataLines].join('\n');
}

/**
 * Format YAML for CLI display
 * @param {Object} obj - Object to format
 * @param {number} indent - Indentation level
 * @returns {string} Formatted YAML-like output
 */
function formatYAML(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${spaces}${key}:`);
      lines.push(formatYAML(value, indent + 1));
    } else if (Array.isArray(value)) {
      lines.push(`${spaces}${key}:`);
      value.forEach((item) => {
        if (typeof item === 'object') {
          lines.push(`${spaces}  -`);
          lines.push(formatYAML(item, indent + 2));
        } else {
          lines.push(`${spaces}  - ${item}`);
        }
      });
    } else {
      lines.push(`${spaces}${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  formatError,
  formatSuccess,
  formatWarning,
  formatInfo,
  formatTable,
  formatYAML
};
