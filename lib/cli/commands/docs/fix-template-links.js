#!/usr/bin/env node

/**
 * Fix Template Links to Use Repo-Relative Paths
 *
 * Converts relative template links like:
 *   ../../templates/docs/architecture/pattern.template.md
 *
 * To repo-relative paths:
 *   /templates/docs/architecture/pattern.template.md
 *
 * This makes links stable when files move around.
 */

const fs = require('node:fs');
const path = require('node:path');

class TemplateLinkFixer {
  constructor(options = {}) {
    this.projectRoot = process.cwd();
    this.dryRun = options.dryRun || false;
    this.fixed = 0;
    this.filesModified = new Set();
  }

  /**
   * Main execution
   */
  async run() {
    console.log('🔗 Fixing template links to use repo-relative paths\n');

    const docsDir = path.join(this.projectRoot, 'docs');
    const mdFiles = this.findMarkdownFiles(docsDir);

    console.log(`📁 Scanning ${mdFiles.length} markdown files...\n`);

    for (const file of mdFiles) {
      await this.fixFile(file);
    }

    this.printSummary();

    return {
      fixed: this.fixed,
      filesModified: Array.from(this.filesModified)
    };
  }

  /**
   * Find all markdown files
   */
  findMarkdownFiles(dir) {
    const files = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'archive'].includes(item)) {
          files.push(...this.findMarkdownFiles(fullPath));
        }
      } else if (item.endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Fix template links in a file
   */
  async fixFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Pattern to match markdown links with relative paths to templates
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

    let modified = false;
    let newContent = content;

    const matches = [...content.matchAll(linkPattern)];

    for (const match of matches) {
      const [fullMatch, linkText, linkPath] = match;

      // Skip if not a relative path to templates
      if (!linkPath.includes('templates/')) {
        continue;
      }

      // Skip if already repo-relative (starts with /)
      if (linkPath.startsWith('/')) {
        continue;
      }

      // Skip external links
      if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
        continue;
      }

      // Extract the templates/ portion and everything after it
      // e.g., "../../templates/docs/architecture/pattern.md" -> "templates/docs/architecture/pattern.md"
      const templatesIndex = linkPath.indexOf('templates/');
      if (templatesIndex === -1) continue;

      const templatesPath = linkPath.substring(templatesIndex);

      // Create repo-relative path
      const repoRelativePath = `/${templatesPath}`;

      // Create the new link
      const newLink = `[${linkText}](${repoRelativePath})`;

      if (this.dryRun) {
        console.log(`📝 ${path.relative(this.projectRoot, filePath)}`);
        console.log(`   OLD: ${fullMatch}`);
        console.log(`   NEW: ${newLink}\n`);
      }

      // Replace in content
      newContent = newContent.replace(fullMatch, newLink);
      modified = true;
      this.fixed++;
    }

    // Write back if modified and not dry-run
    if (modified && !this.dryRun) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      this.filesModified.add(path.relative(this.projectRoot, filePath));
    }
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 SUMMARY');
    console.log(`${'='.repeat(50)}\n`);

    if (this.fixed === 0) {
      console.log('✅ No template links need fixing!\n');
      return;
    }

    console.log(`Fixed: ${this.fixed} template links`);
    console.log(`Files: ${this.filesModified.size} files modified\n`);

    if (this.dryRun) {
      console.log('💡 This was a dry run. To apply changes:');
      console.log('   sc docs fix-template-links\n');
    } else {
      console.log('✅ All template links updated to repo-relative paths!\n');
      console.log('Modified files:');
      for (const file of this.filesModified) {
        console.log(`   - ${file}`);
      }
      console.log('');
    }
  }
}

// Export for programmatic use
module.exports = TemplateLinkFixer;

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const fixer = new TemplateLinkFixer({ dryRun });
  fixer
    .run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
