/**
 * Simple fuzzy string matching using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function similarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * YAMLSyntaxError - YAML parsing error with context
 */
class YAMLSyntaxError extends Error {
  constructor(originalError, filePath, content) {
    const lineNumber = originalError.mark?.line || 0;
    const column = originalError.mark?.column || 0;
    const context = YAMLSyntaxError.getContext(content, lineNumber);

    super(
      `YAML syntax error in ${filePath}:${lineNumber}:${column}\n${context}`
    );

    this.name = 'YAMLSyntaxError';
    this.filePath = filePath;
    this.lineNumber = lineNumber;
    this.column = column;
  }

  static getContext(content, lineNumber, contextLines = 3) {
    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - contextLines);
    const end = Math.min(lines.length, lineNumber + contextLines + 1);

    return lines
      .slice(start, end)
      .map((line, i) => {
        const num = start + i + 1;
        const marker = num === lineNumber ? '> ' : '  ';
        return `${marker}${num.toString().padStart(4)} | ${line}`;
      })
      .join('\n');
  }
}

/**
 * PatternNotFoundError - Pattern not found with suggestions
 */
class PatternNotFoundError extends Error {
  constructor(patternName, patternType, availablePatterns) {
    // Find best match using our similarity function
    let bestMatch = null;
    let bestScore = 0;

    for (const pattern of availablePatterns) {
      const score = similarity(
        patternName.toLowerCase(),
        pattern.toLowerCase()
      );
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    let message = `Pattern "${patternName}" not found in ${patternType}\n\n`;
    message += `Available ${patternType}:\n`;
    message += availablePatterns.map((p) => `  - ${p}`).join('\n');

    if (bestMatch && bestScore > 0.5) {
      message += `\n\nDid you mean "${bestMatch}"?`;
    }

    super(message);
    this.name = 'PatternNotFoundError';
    this.patternName = patternName;
    this.patternType = patternType;
    this.availablePatterns = availablePatterns;
  }
}

/**
 * CircularDependencyError - Circular pattern references
 */
class CircularDependencyError extends Error {
  constructor(dependencyChain) {
    const chain = dependencyChain.join(' -> ');
    super(`Circular dependency detected: ${chain}`);
    this.name = 'CircularDependencyError';
    this.dependencyChain = dependencyChain;
  }
}

module.exports = {
  YAMLSyntaxError,
  PatternNotFoundError,
  CircularDependencyError
};
