// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { findGitRoot } = require('../../utils/git-utils');

/**
 * Create a new feature from template
 *
 * @param {Object} options
 * @param {string} options.id - Feature ID (folder name)
 * @param {string} [options.title] - Human-readable title (defaults to id)
 * @param {string} [options.domain] - Domain directory (ai-workflow-system, developer-tooling, etc.)
 * @param {string} [options.epic] - Epic name
 * @param {string} [options.priority] - Priority level (high|medium|low, default: 'medium')
 * @param {string} [options.assignee] - GitHub username
 * @param {boolean} [options.minimal] - Create minimal structure (README only)
 */
async function createFeature(options) {
  const {
    id,
    title = id,
    domain,
    epic,
    priority = 'medium',
    assignee,
    minimal = false
  } = options;

  // Validate inputs
  if (!id) {
    throw new Error('Feature ID is required (--id=my-feature)');
  }

  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(
      'Feature ID must be lowercase alphanumeric with hyphens only (e.g., my-feature-name)'
    );
  }

  if (!domain) {
    throw new Error(
      'Domain is required (--domain=ai-workflow-system)\n\nAvailable domains:\n  - ai-workflow-system\n  - developer-tooling\n  - compliance-framework\n  - dashboard-platform\n  - workflow-management\n  - content-management\n  - integrations\n  - admin-operations'
    );
  }

  if (!/^[a-z0-9-]+$/.test(domain)) {
    throw new Error('Domain must be lowercase alphanumeric with hyphens only');
  }

  const validPriorities = ['high', 'medium', 'low'];
  if (!validPriorities.includes(priority)) {
    throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
  }

  // Find project root
  const projectRoot = findGitRoot();
  if (!projectRoot) {
    throw new Error('Not in a git repository');
  }

  // Target feature path - domain/feature-name
  const featurePath = path.join(projectRoot, 'docs/features', domain, id);

  // Check if feature already exists
  if (fs.existsSync(featurePath)) {
    throw new Error(
      `Feature already exists at: ${path.relative(projectRoot, featurePath)}`
    );
  }

  console.log(chalk.blue('\n📦 Creating new feature...\n'));

  // Create feature directory
  fs.mkdirpSync(featurePath);
  console.log(
    chalk.gray(`   Created: ${path.relative(projectRoot, featurePath)}/`)
  );

  // Create standard directories
  if (!minimal) {
    const directories = ['design', 'planning'];
    for (const dir of directories) {
      const dirPath = path.join(featurePath, dir);
      fs.mkdirpSync(dirPath);
      console.log(
        chalk.gray(`   Created: ${path.relative(projectRoot, dirPath)}/`)
      );
    }
  }

  // Create README.md with frontmatter
  const today = new Date().toISOString().split('T')[0];
  const readme = generateReadme({
    id,
    title,
    domain,
    epic,
    priority,
    assignee,
    created: today,
    updated: today
  });

  const readmePath = path.join(featurePath, 'README.md');
  fs.writeFileSync(readmePath, readme);
  console.log(
    chalk.gray(`   Created: ${path.relative(projectRoot, readmePath)}`)
  );

  console.log(chalk.green('\n✅ Feature created successfully!\n'));
  console.log(chalk.gray('Next steps:\n'));
  console.log(
    chalk.gray(`   1. Edit: ${path.relative(projectRoot, readmePath)}`)
  );
  console.log(chalk.gray(`   2. Validate: sc feature validate --id=${id}`));
  console.log(
    chalk.gray(
      `   3. Commit: git add ${path.relative(projectRoot, featurePath)} && git commit -m "feat(${domain}): Add ${id} feature"\n`
    )
  );

  return {
    success: true,
    featurePath: path.relative(projectRoot, featurePath),
    readmePath: path.relative(projectRoot, readmePath)
  };
}

/**
 * Generate README.md content with frontmatter
 */
function generateReadme(data) {
  const { id, title, domain, epic, priority, assignee, created, updated } =
    data;

  return `---
feature_id: "${id}"
title: "${title}"
domain: "${domain}"${epic ? `\nepic: "${epic}"` : ''}
priority: "${priority}"${assignee ? `\nassignee: "${assignee}"` : ''}
status: "active"
created: "${created}"
updated: "${updated}"
branch: "main"
---

# ${title}

## Overview

[Provide a brief overview of this feature]

## Goals

- [Goal 1]
- [Goal 2]

## Success Criteria

- [Criteria 1]
- [Criteria 2]

## Dependencies

- [Dependency 1]

## Notes

[Additional notes or context]
`;
}

module.exports = { createFeature };
