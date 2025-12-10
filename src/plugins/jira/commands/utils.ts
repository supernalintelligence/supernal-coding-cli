/**
 * Shared utilities for Jira commands
 */
import chalk, { ChalkFunction } from 'chalk';

interface AtlassianNode {
  text?: string;
  content?: AtlassianNode[];
  type?: string;
}

interface AtlassianDoc {
  type: string;
  content?: AtlassianNode[];
}

export function getStatusColor(categoryKey: string): ChalkFunction {
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

export function truncate(str: string | null | undefined, maxLen: number): string {
  if (!str) return '';
  return str.length > maxLen ? `${str.substring(0, maxLen - 3)}...` : str;
}

export function formatDate(dateStr: string | null | undefined): string {
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

function extractFromNodes(nodes: AtlassianNode[]): string {
  return nodes
    .map((node) => {
      if (node.text) return node.text;
      if (node.content) return extractFromNodes(node.content);
      if (node.type === 'hardBreak') return '\n';
      return '';
    })
    .join('');
}

export function extractText(content: string | AtlassianDoc | null | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;

  if (content.type === 'doc' && content.content) {
    return extractFromNodes(content.content);
  }

  return '';
}

module.exports = {
  getStatusColor,
  truncate,
  formatDate,
  extractText
};
