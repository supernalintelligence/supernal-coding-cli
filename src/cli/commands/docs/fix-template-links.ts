/**
 * Fix Template Links to Use Repo-Relative Paths
 */

import fs from 'node:fs';
import path from 'node:path';

interface FixerOptions {
  dryRun?: boolean;
}

interface FixResult {
  fixed: number;
  filesModified: string[];
}

class TemplateLinkFixer {
  protected projectRoot: string;
  protected dryRun: boolean;
  protected fixed: number;
  protected filesModified: Set<string>;

  constructor(options: FixerOptions = {}) {
    this.projectRoot = process.cwd();
    this.dryRun = options.dryRun || false;
    this.fixed = 0;
    this.filesModified = new Set();
  }

  async run(): Promise<FixResult> {
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

  findMarkdownFiles(dir: string): string[] {
    const files: string[] = [];

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

  async fixFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');

    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

    let modified = false;
    let newContent = content;

    const matches = [...content.matchAll(linkPattern)];

    for (const match of matches) {
      const [fullMatch, linkText, linkPath] = match;

      if (!linkPath.includes('templates/')) {
        continue;
      }

      if (linkPath.startsWith('/')) {
        continue;
      }

      if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
        continue;
      }

      const templatesIndex = linkPath.indexOf('templates/');
      if (templatesIndex === -1) continue;

      const templatesPath = linkPath.substring(templatesIndex);

      const repoRelativePath = `/${templatesPath}`;

      const newLink = `[${linkText}](${repoRelativePath})`;

      if (this.dryRun) {
        console.log(`📝 ${path.relative(this.projectRoot, filePath)}`);
        console.log(`   OLD: ${fullMatch}`);
        console.log(`   NEW: ${newLink}\n`);
      }

      newContent = newContent.replace(fullMatch, newLink);
      modified = true;
      this.fixed++;
    }

    if (modified && !this.dryRun) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      this.filesModified.add(path.relative(this.projectRoot, filePath));
    }
  }

  printSummary(): void {
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

export default TemplateLinkFixer;
module.exports = TemplateLinkFixer;

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
