// @ts-nocheck
const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');
const chalk = require('chalk');
const yaml = require('yaml');

class PendingApprovalScanner {
  searchPaths: any;
  constructor() {
    this.searchPaths = [
      'docs/**/*.md',
      'supernal-code-package/templates/**/*.md'
    ];
  }

  extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    try {
      return yaml.parse(match[1]);
    } catch {
      return null;
    }
  }

  getDocumentType(filePath) {
    if (filePath.includes('/sops/') || filePath.includes('SOP-')) return 'sop';
    if (filePath.includes('/requirements/') || filePath.includes('req-'))
      return 'requirement';
    if (filePath.includes('/features/')) return 'feature';
    if (filePath.includes('/planning/')) return 'planning';
    if (filePath.includes('/architecture/')) return 'architecture';
    if (filePath.includes('/changes/') || filePath.includes('CHG-'))
      return 'change';
    return 'document';
  }

  async scan(options = {}) {
    const results = [];

    for (const pattern of this.searchPaths) {
      const files = glob.sync(pattern, { nodir: true });

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const frontmatter = this.extractFrontmatter(content);

          if (!frontmatter) continue;

          const status = frontmatter.status?.toLowerCase() || '';
          if (status !== 'needs_approval') continue;

          const docType = this.getDocumentType(file);

          // Apply filters
          if (options.type && docType !== options.type) continue;
          if (options.path) {
            const { minimatch } = require('minimatch');
            if (!minimatch(file, options.path)) continue;
          }

          results.push({
            path: file,
            type: docType,
            title: frontmatter.title || path.basename(file, '.md'),
            status: frontmatter.status,
            created: frontmatter.created || 'unknown',
            updated: frontmatter.updated || frontmatter.created || 'unknown'
          });
        } catch (_e) {
          // Skip files that can't be read
        }
      }
    }

    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  async display(options = {}) {
    const results = await this.scan(options);

    if (options.count) {
      console.log(`${results.length} documents need approval`);
      return results;
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return results;
    }

    if (results.length === 0) {
      console.log(chalk.green('✓ No documents pending approval'));
      return results;
    }

    if (options.group) {
      this.displayGrouped(results);
    } else {
      this.displayTable(results);
    }

    return results;
  }

  displayTable(results) {
    console.log(
      chalk.bold(`\n📋 Documents Pending Approval (${results.length})\n`)
    );
    console.log('─'.repeat(90));
    console.log(
      chalk.gray('Type'.padEnd(12)) +
        chalk.gray('Path'.padEnd(60)) +
        chalk.gray('Updated')
    );
    console.log('─'.repeat(90));

    for (const doc of results) {
      const typeColor = this.getTypeColor(doc.type);
      console.log(
        typeColor(doc.type.padEnd(12)) +
          chalk.white(doc.path.substring(0, 58).padEnd(60)) +
          chalk.gray(doc.updated)
      );
    }
    console.log('─'.repeat(90));
  }

  displayGrouped(results) {
    const grouped = {};
    for (const doc of results) {
      if (!grouped[doc.type]) grouped[doc.type] = [];
      grouped[doc.type].push(doc);
    }

    console.log(
      chalk.bold(`\n📋 Documents Pending Approval (${results.length})\n`)
    );

    for (const [type, docs] of Object.entries(grouped)) {
      const typeColor = this.getTypeColor(type);
      console.log(typeColor(`\n${type.toUpperCase()} (${docs.length}):`));
      for (const doc of docs) {
        console.log(chalk.gray(`   - ${doc.path}`));
      }
    }
  }

  getTypeColor(type) {
    const colors = {
      sop: chalk.cyan,
      requirement: chalk.yellow,
      feature: chalk.green,
      planning: chalk.magenta,
      architecture: chalk.blue,
      change: chalk.red,
      document: chalk.white
    };
    return colors[type] || chalk.white;
  }

  async getStatusSummary() {
    const _allDocs = [];
    const statusCounts = {};

    for (const pattern of this.searchPaths) {
      const files = glob.sync(pattern, { nodir: true });

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const frontmatter = this.extractFrontmatter(content);
          if (!frontmatter?.status) continue;

          const status = frontmatter.status.toLowerCase();
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        } catch {
          // Skip
        }
      }
    }

    return statusCounts;
  }
}

module.exports = PendingApprovalScanner;
