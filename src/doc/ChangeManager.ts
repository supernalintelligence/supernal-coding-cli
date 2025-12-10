// @ts-nocheck
const fs = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');
const { execSync } = require('node:child_process');

class ChangeManager {
  changesDir: any;
  constructor() {
    this.changesDir = 'docs/changes';
  }

  ensureDir() {
    if (!fs.existsSync(this.changesDir)) {
      fs.mkdirSync(this.changesDir, { recursive: true });
    }
  }

  getNextNumber() {
    this.ensureDir();
    const files = fs
      .readdirSync(this.changesDir)
      .filter((f) => f.startsWith('CHG-') && f.endsWith('.md'));

    if (files.length === 0) return 1;

    const numbers = files.map((f) => {
      const match = f.match(/CHG-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });

    return Math.max(...numbers) + 1;
  }

  formatNumber(n) {
    return String(n).padStart(6, '0');
  }

  slugify(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  create(title, options = {}) {
    this.ensureDir();

    const num = this.getNextNumber();
    const formattedNum = this.formatNumber(num);
    const slug = this.slugify(title);
    const filename = `CHG-${formattedNum}-${slug}.md`;
    const filepath = path.join(this.changesDir, filename);

    const content = this.generateTemplate(formattedNum, title, options);
    fs.writeFileSync(filepath, content, 'utf8');

    console.log(chalk.green(`✓ Created ${filename}`));
    console.log(chalk.gray(`   Path: ${filepath}`));

    if (options.edit) {
      const editor = process.env.EDITOR || 'code';
      try {
        execSync(`${editor} "${filepath}"`, { stdio: 'inherit' });
      } catch {
        console.log(
          chalk.yellow(`Could not open editor. Edit manually: ${filepath}`)
        );
      }
    }

    return filepath;
  }

  generateTemplate(num, title, options) {
    const date = new Date().toISOString().split('T')[0];
    const type = options.type || 'general';
    const impact = options.impact || 'medium';

    return `---
id: CHG-${num}
title: "${title}"
type: ${type}
impact: ${impact}
status: draft
created: ${date}
updated: ${date}
author: ''
reviewedBy: ''
approvedBy: ''
relatedRequirements: []
affectedFiles: []
---

# CHG-${num}: ${title}

## Summary

Brief description of what this change accomplishes.

## Motivation

Why is this change needed? What problem does it solve?

## Impact Analysis

### Affected Components
- Component 1
- Component 2

### Risk Assessment
- **Risk Level**: ${impact}
- **Mitigation**: [Describe mitigation strategy]

### Testing Requirements
- [ ] Unit tests updated
- [ ] Integration tests pass
- [ ] Manual verification completed

## Implementation Details

### Changes Made
1. Change 1
2. Change 2

### Files Affected
- \`path/to/file1\`
- \`path/to/file2\`

## Rollback Plan

If issues arise, the change can be reverted by:
1. Step 1
2. Step 2

## Approval

| Role | Name | Date |
|------|------|------|
| Author | | ${date} |
| Reviewer | | |
| Approver | | |

## Related

- Requirements: []
- Issues: []
- Previous CHG: []
`;
  }

  list() {
    this.ensureDir();
    const files = fs
      .readdirSync(this.changesDir)
      .filter((f) => f.startsWith('CHG-') && f.endsWith('.md'))
      .sort();

    if (files.length === 0) {
      console.log(chalk.yellow('No change documents found'));
      return;
    }

    console.log(chalk.bold('\n📋 Change Documents\n'));
    console.log('─'.repeat(70));

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.changesDir, file), 'utf8');
      const titleMatch = content.match(/title:\s*"?([^"\n]+)"?/);
      const statusMatch = content.match(/status:\s*(\w+)/);
      const title = titleMatch ? titleMatch[1].substring(0, 40) : 'Untitled';
      const status = statusMatch ? statusMatch[1] : 'unknown';

      const chgNum = file.match(/CHG-(\d+)/)?.[1] || '?';
      console.log(
        chalk.cyan(`CHG-${chgNum}`.padEnd(12)) +
          chalk.white(title.padEnd(45)) +
          chalk.gray(status)
      );
    }
    console.log('─'.repeat(70));
  }

  show(num) {
    const paddedNum = this.formatNumber(parseInt(num, 10));
    const files = fs
      .readdirSync(this.changesDir)
      .filter((f) => f.includes(`CHG-${paddedNum}`));

    if (files.length === 0) {
      console.log(chalk.red(`CHG-${paddedNum} not found`));
      return;
    }

    const content = fs.readFileSync(
      path.join(this.changesDir, files[0]),
      'utf8'
    );
    console.log(content);
  }
}

module.exports = ChangeManager;
