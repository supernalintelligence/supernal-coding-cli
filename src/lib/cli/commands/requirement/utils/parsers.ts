/**
 * Content parsing utilities for requirement management
 * NOW USES shared parser from supernal-code-package/lib/requirements/parser.js
 *
 * This file re-exports functions from the shared parser for CLI convenience
 */

// Import shared comprehensive parser
const sharedParser = require('../../../../requirements/parser');

/**
 * Extract frontmatter from markdown content
 * Uses shared parser internally
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatterText = match[1];
  const frontmatter = {};

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
function parseContent(content) {
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
function reconstructContent(frontmatter, body) {
  const frontmatterLines = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return `---\n${frontmatterLines}\n---\n${body}`;
}

/**
 * Get search context showing lines containing search terms
 */
function getSearchContext(content, searchPattern) {
  const lines = content.split('\n');
  const regex = new RegExp(searchPattern, 'gi');
  const contextLines = [];

  for (const line of lines) {
    if (regex.test(line)) {
      // Clean up the line and highlight matches
      const cleanLine = line
        .trim()
        .replace(/^#+\s*/, '')
        .replace(/^\*\s*/, '');
      if (cleanLine.length > 10 && !cleanLine.startsWith('---')) {
        contextLines.push(
          cleanLine.substring(0, 80) + (cleanLine.length > 80 ? '...' : '')
        );
        if (contextLines.length >= 2) break; // Limit context
      }
    }
  }

  return contextLines;
}

// Re-export comprehensive shared parser functions
module.exports = {
  // Local helper functions
  extractFrontmatter,
  parseContent,
  reconstructContent,
  getSearchContext,

  // Re-export shared parser functions for comprehensive requirement parsing
  parseRequirement: sharedParser.parseRequirement,
  determineRequirementType: sharedParser.determineRequirementType,
  loadRequirements: sharedParser.loadRequirements,
  getRepoConfig: sharedParser.getRepoConfig,
  generatePhaseStats: sharedParser.generatePhaseStats
};
