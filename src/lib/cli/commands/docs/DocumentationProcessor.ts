const fs = require('node:fs');
const path = require('node:path');

/**
 * Documentation Processor
 * Extracts file patterns and code blocks from documentation files,
 * creates/updates files, removes implemented blocks, and handles conflicts
 */
class DocumentationProcessor {
  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.processedFiles = new Map();
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Process a documentation file
   * @param {string} docFilePath - Path to the documentation file
   * @returns {Promise<{success: boolean, processedFiles: number, errors: string[], warnings: string[]}>}
   */
  async processDocumentation(docFilePath) {
    try {
      console.log(`📖 Processing documentation: ${docFilePath}`);

      if (!fs.existsSync(docFilePath)) {
        throw new Error(`Documentation file not found: ${docFilePath}`);
      }

      const content = fs.readFileSync(docFilePath, 'utf8');
      const codeBlocks = this.extractCodeBlocks(content);

      console.log(`📋 Found ${codeBlocks.length} code blocks to process`);

      let updatedContent = content;
      let contentChanged = false;

      // Process blocks in reverse order to maintain line numbers when removing
      for (let i = codeBlocks.length - 1; i >= 0; i--) {
        const block = codeBlocks[i];
        try {
          const result = await this.processCodeBlock(block);
          if (result.success) {
            // Update the documentation
            const newContent = this.updateDocumentationStatus(
              updatedContent,
              block,
              result.action
            );
            if (newContent !== updatedContent) {
              updatedContent = newContent;
              contentChanged = true;
            }
            this.processedFiles.set(block.filePath, result.action);
          } else {
            this.errors.push(
              `Failed to process ${block.filePath}: ${result.error}`
            );
          }
        } catch (error) {
          this.errors.push(
            `Error processing ${block.filePath}: ${error.message}`
          );
        }
      }

      // Write updated documentation back
      if (contentChanged) {
        fs.writeFileSync(docFilePath, updatedContent, 'utf8');
        console.log(`📝 Updated documentation file: ${docFilePath}`);
      }

      return {
        success: this.errors.length === 0,
        processedFiles: this.processedFiles.size,
        errors: this.errors,
        warnings: this.warnings
      };
    } catch (error) {
      this.errors.push(`Failed to process documentation: ${error.message}`);
      return {
        success: false,
        processedFiles: 0,
        errors: this.errors,
        warnings: this.warnings
      };
    }
  }

  /**
   * Extract code blocks with file paths from documentation
   * @param {string} content - Documentation content
   * @returns {Array<{filePath: string, code: string, startLine: number, endLine: number, originalText: string}>}
   */
  extractCodeBlocks(content) {
    const blocks = [];
    const lines = content.split('\n');

    // Pattern to match: **File**: `path/to/file.ext` or **File IMPLEMENTED **: `path/to/file.ext`
    const filePattern = /^\*\*File(?:\s+IMPLEMENTED\s*)?\*\*:\s*`([^`]+)`/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(filePattern);

      if (match) {
        const filePath = match[1];
        const isImplemented = line.includes('IMPLEMENTED');

        // Look for the code block that follows
        let codeStartLine = -1;
        let codeEndLine = -1;
        let language = '';

        // Find the start of the code block (```typescript, ```tsx, etc.)
        for (let j = i + 1; j < lines.length && j < i + 10; j++) {
          if (lines[j].startsWith('```')) {
            codeStartLine = j;
            language = lines[j].substring(3).trim();
            break;
          }
        }

        if (codeStartLine !== -1) {
          // Find the end of the code block
          for (let j = codeStartLine + 1; j < lines.length; j++) {
            if (lines[j] === '```') {
              codeEndLine = j;
              break;
            }
          }

          if (codeEndLine !== -1) {
            const code = lines.slice(codeStartLine + 1, codeEndLine).join('\n');
            const originalText = lines.slice(i, codeEndLine + 1).join('\n');

            blocks.push({
              filePath,
              code,
              language,
              startLine: i,
              endLine: codeEndLine,
              originalText,
              isImplemented
            });

            console.log(
              `📄 Found code block: ${filePath} (${isImplemented ? 'IMPLEMENTED' : 'TO IMPLEMENT'})`
            );
          }
        }
      }
    }

    return blocks;
  }

  /**
   * Process a single code block - create, update, or check for conflicts
   * @param {Object} block - Code block information
   * @returns {Promise<{success: boolean, action: string, error?: string, conflictDetails?: object}>}
   */
  async processCodeBlock(block) {
    try {
      const { filePath, code, isImplemented } = block;

      // Resolve the full path
      const fullPath = this.resolvePath(filePath);
      const exists = fs.existsSync(fullPath);

      console.log(
        `🔍 Processing: ${filePath} -> ${fullPath} (exists: ${exists})`
      );

      if (isImplemented && exists) {
        // Check if file content matches documentation
        const existingContent = fs.readFileSync(fullPath, 'utf8');
        const similarity = this.calculateSimilarity(
          existingContent.trim(),
          code.trim()
        );

        console.log(`📊 Content similarity: ${(similarity * 100).toFixed(1)}%`);

        if (similarity > 0.9) {
          console.log(
            `✅ Content matches - can reuse existing file: ${filePath}`
          );
          return { success: true, action: 'reused' };
        } else {
          console.log(
            `⚠️  Content differs significantly - marking as conflict: ${filePath}`
          );
          this.warnings.push(
            `CONFLICT: ${filePath} - existing file differs from documentation`
          );
          return { success: true, action: 'conflict' };
        }
      }

      if (!isImplemented && exists) {
        // File exists but not marked as implemented - check for conflicts
        const existingContent = fs.readFileSync(fullPath, 'utf8');
        const similarity = this.calculateSimilarity(
          existingContent.trim(),
          code.trim()
        );

        console.log(
          `📊 Existing file similarity: ${(similarity * 100).toFixed(1)}%`
        );

        if (similarity > 0.9) {
          console.log(
            `✅ Existing file matches documentation - can reuse: ${filePath}`
          );
          return { success: true, action: 'reused' };
        } else {
          console.log(
            `⚠️  Existing file conflicts with documentation: ${filePath}`
          );
          this.warnings.push(
            `CONFLICT: ${filePath} - existing file conflicts with documentation`
          );
          return { success: true, action: 'conflict' };
        }
      }

      if (!isImplemented && !exists) {
        // Create directory if it doesn't exist
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          console.log(`📁 Creating directory: ${dir}`);
          fs.mkdirSync(dir, { recursive: true });
        }

        // Create new file
        fs.writeFileSync(fullPath, code, 'utf8');
        console.log(`✨ Created new file: ${fullPath}`);

        return { success: true, action: 'created' };
      }

      // Should not reach here
      return { success: true, action: 'skipped' };
    } catch (error) {
      console.error(`❌ Error processing ${block.filePath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate similarity between two strings using normalized line-based comparison
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity ratio (0-1)
   */
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Normalize whitespace and split into lines
    const normalize = (str) =>
      str
        .replace(/\s+/g, ' ')
        .replace(/^\s+|\s+$/gm, '')
        .split('\n')
        .filter((line) => line.trim().length > 0);

    const lines1 = normalize(str1);
    const lines2 = normalize(str2);

    if (lines1.length === 0 && lines2.length === 0) return 1.0;
    if (lines1.length === 0 || lines2.length === 0) return 0.0;

    // Count matching lines
    let matches = 0;
    const used = new Set();

    for (const line1 of lines1) {
      for (let i = 0; i < lines2.length; i++) {
        if (!used.has(i) && line1 === lines2[i]) {
          matches++;
          used.add(i);
          break;
        }
      }
    }

    // Calculate similarity as ratio of matching lines to total lines
    const totalLines = Math.max(lines1.length, lines2.length);
    return matches / totalLines;
  }

  /**
   * Resolve file path relative to workspace root
   * @param {string} filePath - File path from documentation
   * @returns {string} - Full resolved path
   */
  resolvePath(filePath) {
    // Handle different path formats
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    // Remove leading ./ if present
    const cleanPath = filePath.replace(/^\.\//, '');

    return path.resolve(this.workspaceRoot, cleanPath);
  }

  /**
   * Update documentation - mark as implemented or handle conflicts
   * @param {string} content - Documentation content
   * @param {Object} block - Code block that was processed
   * @param {string} action - Action taken (created, updated, removed, conflict)
   * @returns {string} - Updated content
   */
  updateDocumentationStatus(content, block, action) {
    const lines = content.split('\n');

    if (action === 'removed') {
      // For matching files, mark as IMPLEMENTED and remove only the code block
      for (
        let i = block.startLine;
        i <= block.endLine && i < lines.length;
        i++
      ) {
        const line = lines[i];
        const filePattern =
          /^(\*\*File)(?:\s+IMPLEMENTED\s*)?(\*\*:\s*`[^`]+`)(.*)$/;
        const match = line.match(filePattern);

        if (match) {
          lines[i] = `${match[1]} IMPLEMENTED ${match[2]}${match[3]}`;
          console.log(`✅ Marked as implemented: ${block.filePath}`);
          break;
        }
      }

      // Remove only the code block (```...```) but keep the file declaration
      let codeStartLine = -1;
      let codeEndLine = -1;

      for (let i = block.startLine; i <= block.endLine; i++) {
        if (lines[i].startsWith('```') && codeStartLine === -1) {
          codeStartLine = i;
        } else if (lines[i] === '```' && codeStartLine !== -1) {
          codeEndLine = i;
          break;
        }
      }

      if (codeStartLine !== -1 && codeEndLine !== -1) {
        // Remove the code block but keep file declaration
        lines.splice(codeStartLine, codeEndLine - codeStartLine + 1);
        console.log(`🗑️  Removed code block for: ${block.filePath}`);
      }

      return lines.join('\n');
    }

    if (action === 'created' || action === 'reused') {
      // For newly created or reused files, mark as IMPLEMENTED and remove the code block
      for (
        let i = block.startLine;
        i <= block.endLine && i < lines.length;
        i++
      ) {
        const line = lines[i];
        const filePattern =
          /^(\*\*File)(?:\s+IMPLEMENTED\s*)?(\*\*:\s*`[^`]+`)(.*)$/;
        const match = line.match(filePattern);

        if (match) {
          lines[i] = `${match[1]} IMPLEMENTED ${match[2]}${match[3]}`;
          console.log(`✅ Marked as implemented: ${block.filePath}`);
          break;
        }
      }

      // Remove only the code block
      let codeStartLine = -1;
      let codeEndLine = -1;

      for (let i = block.startLine; i <= block.endLine; i++) {
        if (lines[i].startsWith('```') && codeStartLine === -1) {
          codeStartLine = i;
        } else if (lines[i] === '```' && codeStartLine !== -1) {
          codeEndLine = i;
          break;
        }
      }

      if (codeStartLine !== -1 && codeEndLine !== -1) {
        lines.splice(codeStartLine, codeEndLine - codeStartLine + 1);
        console.log(`🗑️  Removed code block for: ${block.filePath}`);
      }

      return lines.join('\n');
    }

    if (action === 'conflict') {
      // Add detailed conflict marker to the file declaration
      for (
        let i = block.startLine;
        i <= block.endLine && i < lines.length;
        i++
      ) {
        const line = lines[i];
        const filePattern =
          /^(\*\*File)(?:\s+(?:IMPLEMENTED|CONFLICT)\s*(?:⚠️)?\s*)?(\*\*:\s*`[^`]+`)(.*)$/;
        const match = line.match(filePattern);

        if (match) {
          lines[i] =
            `${match[1].replace(/IMPLEMENTED|CONFLICT.*?⚠️\s*/, '')}CONFLICT ⚠️ ${match[2]}${match[3]}`;
          console.log(`⚠️  Marked conflict for: ${block.filePath}`);

          // Add conflict resolution instructions after the file declaration
          const instructionLines = [
            '',
            '> **CONFLICT RESOLUTION NEEDED:**',
            '> - Existing file differs from documentation',
            '> - Review the differences manually',
            '> - Update either the file or documentation to match',
            '> - Remove this conflict marker when resolved',
            ''
          ];

          // Insert instructions after the file declaration line
          lines.splice(i + 1, 0, ...instructionLines);
          break;
        }
      }
      return lines.join('\n');
    }

    // For 'skipped' or other actions, no change
    return content;
  }

  /**
   * Print summary of processing results
   */
  printSummary() {
    console.log('\n📊 Processing Summary:');
    console.log(`✅ Files processed: ${this.processedFiles.size}`);

    if (this.processedFiles.size > 0) {
      console.log('\n📁 Processed files:');
      for (const [filePath, action] of this.processedFiles) {
        const emoji =
          action === 'created'
            ? '✨'
            : action === 'reused'
              ? '♻️'
              : action === 'removed'
                ? '🗑️'
                : action === 'conflict'
                  ? '⚠️'
                  : '⏭️';
        console.log(`  ${emoji} ${filePath} (${action})`);
      }
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach((warning) => console.log(`  - ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach((error) => console.log(`  - ${error}`));
    }

    // Show conflict resolution instructions if there are conflicts
    const conflicts = Array.from(this.processedFiles.entries()).filter(
      ([_, action]) => action === 'conflict'
    );
    if (conflicts.length > 0) {
      console.log('\n🔧 Conflict Resolution Instructions:');
      console.log(
        'The following files had conflicts and were not overwritten:'
      );
      conflicts.forEach(([filePath, _]) => {
        console.log(`\n📄 ${filePath}:`);
        console.log(`  • File path: ${this.resolvePath(filePath)}`);
        console.log(
          `  • Action needed: Manually review and resolve differences`
        );
        console.log(
          `  • Update documentation to mark as IMPLEMENTED when done`
        );
      });
    }
  }
}

module.exports = { DocumentationProcessor };
