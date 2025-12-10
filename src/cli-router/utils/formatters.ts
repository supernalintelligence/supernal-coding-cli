/**
 * CLI Output Formatters
 * Utilities for formatting CLI output
 */

import chalk from 'chalk';

/** Error with optional code */
interface ErrorWithCode extends Error {
  code?: string;
}

/**
 * Format error for CLI display
 * @param error - Error to format
 * @returns Formatted error message
 */
export function formatError(error: ErrorWithCode): string {
  if (error.code) {
    return chalk.red(`Error [${error.code}]: ${error.message}`);
  }
  return chalk.red(`Error: ${error.message}`);
}

/**
 * Format success message
 * @param message - Success message
 * @returns Formatted success message
 */
export function formatSuccess(message: string): string {
  return chalk.green('✓ ') + message;
}

/**
 * Format warning message
 * @param message - Warning message
 * @returns Formatted warning message
 */
export function formatWarning(message: string): string {
  return chalk.yellow('⚠ ') + message;
}

/**
 * Format info message
 * @param message - Info message
 * @returns Formatted info message
 */
export function formatInfo(message: string): string {
  return chalk.blue('ℹ ') + message;
}

/**
 * Format table for CLI display
 * @param rows - Table rows (array of arrays or objects)
 * @param headers - Column headers
 * @returns Formatted table
 */
export function formatTable(rows: unknown[][], headers: string[]): string {
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
 * @param obj - Object to format
 * @param indent - Indentation level
 * @returns Formatted YAML-like output
 */
export function formatYAML(obj: Record<string, unknown>, indent = 0): string {
  const spaces = '  '.repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${spaces}${key}:`);
      lines.push(formatYAML(value as Record<string, unknown>, indent + 1));
    } else if (Array.isArray(value)) {
      lines.push(`${spaces}${key}:`);
      value.forEach((item) => {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${spaces}  -`);
          lines.push(formatYAML(item as Record<string, unknown>, indent + 2));
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
