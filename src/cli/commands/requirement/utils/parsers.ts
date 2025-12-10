/**
 * Content parsing utilities for requirement management
 * NOW USES shared parser from supernal-code-package/lib/requirements/parser.js
 *
 * This file re-exports functions from the shared parser for CLI convenience
 */

const sharedParser = require('../../../../requirements/parser');

interface Frontmatter {
  [key: string]: string;
}

interface ParsedContent {
  frontmatter: Frontmatter;
  body: string;
}

/**
 * Extract frontmatter from markdown content
 */
function extractFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatterText = match[1];
  const frontmatter: Frontmatter = {};

  frontmatterText.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      frontmatter[key.trim()] = valueParts.join(':').trim();
    }
  });

  return frontmatter;
}

/**
 * Parse content into frontmatter and body
 */
function parseContent(content: string): ParsedContent {
  const match = content.match(/^(---\n[\s\S]*?\n---)\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterSection = match[1];
  const body = match[2];
  const frontmatter = extractFrontmatter(frontmatterSection);

  return { frontmatter, body };
}

/**
 * Reconstruct content from frontmatter and body
 */
function reconstructContent(frontmatter: Frontmatter, body: string): string {
  const frontmatterLines = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return `---\n${frontmatterLines}\n---\n${body}`;
}

/**
 * Get search context showing lines containing search terms
 */
function getSearchContext(content: string, searchPattern: string): string[] {
  const lines = content.split('\n');
  const regex = new RegExp(searchPattern, 'gi');
  const contextLines: string[] = [];

  for (const line of lines) {
    if (regex.test(line)) {
      const cleanLine = line
        .trim()
        .replace(/^#+\s*/, '')
        .replace(/^\*\s*/, '');
      if (cleanLine.length > 10 && !cleanLine.startsWith('---')) {
        contextLines.push(
          cleanLine.substring(0, 80) + (cleanLine.length > 80 ? '...' : '')
        );
        if (contextLines.length >= 2) break;
      }
    }
  }

  return contextLines;
}

export {
  extractFrontmatter,
  parseContent,
  reconstructContent,
  getSearchContext
};

module.exports = {
  extractFrontmatter,
  parseContent,
  reconstructContent,
  getSearchContext,
  parseRequirement: sharedParser.parseRequirement,
  determineRequirementType: sharedParser.determineRequirementType,
  loadRequirements: sharedParser.loadRequirements,
  getRepoConfig: sharedParser.getRepoConfig,
  generatePhaseStats: sharedParser.generatePhaseStats
};
