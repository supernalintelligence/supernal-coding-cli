/**
 * Shared utilities for Jira commands
 */
const chalk = require('chalk');

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

module.exports = {
  getStatusColor,
  truncate,
  formatDate,
  extractText
};

