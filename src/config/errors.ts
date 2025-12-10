/**
 * Simple fuzzy string matching using Levenshtein distance
 */
function similarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(str1: string, str2: string): number {
  const matrix: number[][] = [];

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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

interface YAMLErrorMark {
  line?: number;
  column?: number;
}

interface YAMLOriginalError extends Error {
  mark?: YAMLErrorMark;
}

/**
 * YAMLSyntaxError - YAML parsing error with context
 */
export class YAMLSyntaxError extends Error {
  public column: number;
  public filePath: string;
  public lineNumber: number;

  constructor(originalError: YAMLOriginalError, filePath: string, content: string) {
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

  static getContext(content: string, lineNumber: number, contextLines = 3): string {
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
export class PatternNotFoundError extends Error {
  public availablePatterns: string[];
  public patternName: string;
  public patternType: string;

  constructor(patternName: string, patternType: string, availablePatterns: string[]) {
    let bestMatch: string | null = null;
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
export class CircularDependencyError extends Error {
  public dependencyChain: string[];

  constructor(dependencyChain: string[]) {
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
