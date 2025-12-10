import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { findGitRoot } from '../../utils/git-utils';

interface CreateFeatureOptions {
  id: string;
  title?: string;
  domain?: string;
  epic?: string;
  priority?: string;
  assignee?: string;
  minimal?: boolean;
}

interface CreateFeatureResult {
  success: boolean;
  featurePath: string;
  readmePath: string;
}

interface ReadmeData {
  id: string;
  title: string;
  domain: string;
  epic?: string;
  priority: string;
  assignee?: string;
  created: string;
  updated: string;
}

function generateReadme(data: ReadmeData): string {
  const { id, title, domain, epic, priority, assignee, created, updated } = data;

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

async function createFeature(options: CreateFeatureOptions): Promise<CreateFeatureResult> {
  const {
    id,
    title = id,
    domain,
    epic,
    priority = 'medium',
    assignee,
    minimal = false
  } = options;

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

  const projectRoot = findGitRoot();
  if (!projectRoot) {
    throw new Error('Not in a git repository');
  }

  const featurePath = path.join(projectRoot, 'docs/features', domain, id);

  if (fs.existsSync(featurePath)) {
    throw new Error(
      `Feature already exists at: ${path.relative(projectRoot, featurePath)}`
    );
  }

  console.log(chalk.blue('\n📦 Creating new feature...\n'));

  fs.mkdirpSync(featurePath);
  console.log(
    chalk.gray(`   Created: ${path.relative(projectRoot, featurePath)}/`)
  );

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

export { createFeature };
module.exports = { createFeature };
