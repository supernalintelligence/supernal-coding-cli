const { DocumentationProcessor } = require('./DocumentationProcessor');
const chalk = require('chalk');
const path = require('node:path');
const fs = require('node:fs');

/**
 * Process documentation file to extract and implement code blocks
 * @param {string} docFile - Path to documentation file
 * @param {Object} options - Processing options
 * @returns {Promise<{success: boolean, errors?: string[]}>}
 */
async function processDocumentation(docFile, _options = {}) {
  try {
    // Resolve the doc file path
    const resolvedPath = path.isAbsolute(docFile)
      ? docFile
      : path.resolve(process.cwd(), docFile);

    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red(`❌ Documentation file not found: ${docFile}`));
      return { success: false, errors: [`File not found: ${docFile}`] };
    }

    console.log(chalk.blue('📖 Processing documentation file...'));
    console.log(chalk.gray(`   File: ${resolvedPath}\n`));

    const processor = new DocumentationProcessor(process.cwd());
    const result = await processor.processDocumentation(resolvedPath);

    processor.printSummary();

    if (result.success) {
      console.log(
        chalk.green('\n✅ Documentation processing completed successfully!')
      );
      if (result.processedFiles > 0) {
        console.log(
          chalk.gray(`   ${result.processedFiles} file(s) processed`)
        );
      }
      return { success: true };
    } else {
      console.log(
        chalk.yellow('\n⚠️  Documentation processing completed with errors.')
      );
      return { success: false, errors: result.errors };
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    return { success: false, errors: [error.message] };
  }
}

/**
 * Show usage information for the process command
 */
function showHelp() {
  console.log(chalk.bold('\n📄 Documentation Processor'));
  console.log('');
  console.log(chalk.cyan('Usage:'));
  console.log('  sc docs process <doc-file>');
  console.log('');
  console.log(chalk.cyan('Description:'));
  console.log(
    '  Extract code blocks from documentation and create files automatically.'
  );
  console.log(
    '  Uses the pattern: **File**: `path/to/file.ext` followed by code block.'
  );
  console.log('');
  console.log(chalk.cyan('Features:'));
  console.log('  • Automatically creates files from documented code blocks');
  console.log('  • Creates necessary directory structures');
  console.log('  • Detects conflicts with existing files');
  console.log('  • Marks blocks as IMPLEMENTED in documentation');
  console.log('  • Removes code blocks after implementation (DRY principle)');
  console.log('');
  console.log(chalk.cyan('Example:'));
  console.log(
    '  sc docs process docs/features/{domain}/my-feature/planning/implementation.md'
  );
  console.log('');
  console.log(chalk.cyan('Pattern Format:'));
  console.log('  **File**: `src/utils/helper.ts`');
  console.log('  ```typescript');
  console.log('  export const helper = () => "value";');
  console.log('  ```');
  console.log('');
  console.log(
    chalk.gray(
      'See .cursor/rules/documentation-processor.mdc for full documentation'
    )
  );
  console.log('');
}

module.exports = {
  processDocumentation,
  showHelp
};
