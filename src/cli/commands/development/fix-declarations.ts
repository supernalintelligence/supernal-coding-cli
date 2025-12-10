#!/usr/bin/env node
// @ts-nocheck

/**
 * SC Dev Fix Declarations Command
 * Moved from scripts/utilities/fix-case-declarations.js for self-contained package architecture
 *
 * Fixes JavaScript case declarations by adding block scopes where needed
 */

const fs = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');

class CaseDeclarationFixer {
  dryRun: any;
  verbose: any;
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
  }

  fixCaseDeclarations(filePath) {
    if (this.verbose) {
      console.log(
        chalk.blue(
          `🔧 ${this.dryRun ? '[DRY RUN] ' : ''}Fixing case declarations in ${filePath}`
        )
      );
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const result = [];
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this is a case statement
      if (trimmed.match(/^case\s+[^:]+:$/)) {
        result.push(line);

        // Look ahead to see if next non-empty line has a variable declaration
        let j = i + 1;
        let hasDeclaration = false;
        const caseIndent = line.match(/^(\s*)/)[1];

        // Skip empty lines
        while (j < lines.length && lines[j].trim() === '') {
          result.push(lines[j]);
          j++;
        }

        // Check if the next line has a variable declaration
        if (j < lines.length) {
          const nextLine = lines[j];
          const nextTrimmed = nextLine.trim();

          if (nextTrimmed.match(/^(const|let|var)\s+/)) {
            hasDeclaration = true;
          }
        }

        // If there's a declaration, wrap the case content in a block
        if (hasDeclaration) {
          // Add opening brace
          result.push(`${caseIndent}  {`);
          modified = true;

          // Process lines until we hit break, return, or next case/default
          while (j < lines.length) {
            const currentLine = lines[j];
            const currentTrimmed = currentLine.trim();

            // Check if we've reached the end of this case
            if (
              currentTrimmed.match(
                /^(case\s+[^:]+:|default\s*:|break\s*;|return\b)/
              )
            ) {
              // If it's a break statement, include it in the block
              if (currentTrimmed.match(/^break\s*;/)) {
                result.push(`  ${currentLine}`); // Add extra indent for block
                j++;
              }
              break;
            }

            // Add the line with extra indentation for the block
            result.push(`  ${currentLine}`);
            j++;
          }

          // Add closing brace
          result.push(`${caseIndent}  }`);

          // Continue from where we left off (don't increment i again)
          i = j - 1;
        }
      } else {
        result.push(line);
      }
    }

    const newContent = result.join('\n');

    if (modified) {
      if (!this.dryRun) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }

      if (this.verbose) {
        console.log(
          chalk.green(
            `✅ ${this.dryRun ? '[DRY RUN] ' : ''}Fixed case declarations in ${filePath}`
          )
        );
      }
      return true;
    } else {
      if (this.verbose) {
        console.log(
          chalk.gray(`ℹ️  No case declarations to fix in ${filePath}`)
        );
      }
      return false;
    }
  }

  scanDirectory(directory) {
    const results = [];

    const scanRecursive = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (
            ['node_modules', '.git', 'dist', 'build', '.next'].includes(
              entry.name
            )
          ) {
            continue;
          }
          scanRecursive(fullPath);
        } else if (entry.isFile()) {
          // Only scan JavaScript/TypeScript files
          if (/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(entry.name)) {
            try {
              const wasModified = this.fixCaseDeclarations(fullPath);
              if (wasModified) {
                results.push(fullPath);
              }
            } catch (error) {
              console.warn(
                chalk.yellow(
                  `Warning: Could not process ${fullPath}: ${error.message}`
                )
              );
            }
          }
        }
      }
    };

    scanRecursive(directory);
    return results;
  }

  scanFile(filePath) {
    try {
      const wasModified = this.fixCaseDeclarations(filePath);
      return wasModified ? [filePath] : [];
    } catch (error) {
      console.error(
        chalk.red(`Error processing ${filePath}: ${error.message}`)
      );
      return [];
    }
  }
}

// CLI Interface
async function main(args) {
  const options = {
    target: process.cwd(),
    verbose: false,
    dryRun: false,
    file: null
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--file':
      case '-f':
        options.file = args[++i];
        break;
      case '--directory':
      case '-d':
        options.target = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        console.log(`
${chalk.bold('SC Dev Fix Declarations')}

${chalk.cyan('Usage:')} sc dev fix-declarations [options]

${chalk.cyan('Options:')}
  -f, --file <path>       Fix specific file
  -d, --directory <path>  Fix all files in directory (default: current directory)
  --dry-run              Show what would be fixed without making changes
  -v, --verbose          Show verbose output
  -h, --help            Show this help message

${chalk.cyan('Description:')}
  Fixes JavaScript case declarations by adding block scopes where needed.
  This prevents "Identifier 'x' has already been declared" errors in switch statements.

${chalk.cyan('Examples:')}
  sc dev fix-declarations                    # Fix all files in current directory
  sc dev fix-declarations -f ./src/app.js   # Fix specific file
  sc dev fix-declarations -d ./src --dry-run # Preview changes
  sc dev fix-declarations --verbose          # Show detailed output
`);
        return { success: true };
    }
  }

  try {
    const fixer = new CaseDeclarationFixer(options);
    let results = [];

    if (options.file) {
      // Fix specific file
      if (!fs.existsSync(options.file)) {
        console.error(chalk.red(`❌ File not found: ${options.file}`));
        return { success: false };
      }
      results = fixer.scanFile(options.file);
    } else {
      // Fix directory
      if (!fs.existsSync(options.target)) {
        console.error(chalk.red(`❌ Directory not found: ${options.target}`));
        return { success: false };
      }
      results = fixer.scanDirectory(options.target);
    }

    if (results.length > 0) {
      console.log(
        chalk.green(
          `✅ ${options.dryRun ? '[DRY RUN] ' : ''}Fixed case declarations in ${results.length} file(s)`
        )
      );
      if (options.verbose) {
        results.forEach((file) => console.log(`   - ${file}`));
      }
    } else {
      console.log(chalk.blue('ℹ️  No case declarations needed fixing'));
    }

    return { success: true };
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    return { success: false };
  }
}

// Export for CLI system
module.exports = main;

// Allow direct execution
if (require.main === module) {
  const args = process.argv.slice(2);
  main(args).then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}
