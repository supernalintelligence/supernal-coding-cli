const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const matter = require('gray-matter');

/**
 * Sub-Requirement Manager
 * Handles creation, management, and organization of sub-requirements
 */
class SubRequirementManager {
  constructor(requirementManager) {
    this.requirementManager = requirementManager;
    this.projectRoot = requirementManager.projectRoot;
    this.requirementsPath = requirementManager.requirementsPath;
  }

  /**
   * Create a new sub-requirement for a parent requirement
   * @param {string} parentId - Parent requirement ID (e.g., 'REQ-AUTH-001')
   * @param {string} title - Sub-requirement title
   * @param {object} options - Additional options
   */
  async createSubRequirement(parentId, title, options = {}) {
    // Find parent requirement file
    const parentFile =
      await this.requirementManager.findRequirementById(parentId);
    if (!parentFile) {
      throw new Error(`Parent requirement ${parentId} not found`);
    }

    // Parse parent requirement to get metadata
    const parentContent = await fs.readFile(parentFile, 'utf8');
    const parentMatter = matter(parentContent);
    const parentData = parentMatter.data;

    // Extract domain and number from parent ID
    const idMatch = parentId.match(/REQ-([A-Z]+)-(\d+)/i);
    if (!idMatch) {
      throw new Error(
        `Invalid parent requirement ID format: ${parentId}. Expected REQ-DOMAIN-###`
      );
    }

    const [, domain, number] = idMatch;

    // Get next sub-requirement letter
    const nextLetter = await this.getNextSubRequirementLetter(
      parentId,
      parentFile
    );

    // Generate sub-requirement ID
    const subReqId = `SUB-REQ-${domain.toUpperCase()}-${number}.${nextLetter}`;
    const fileId = `${domain.toLowerCase()}-${number}${nextLetter.toLowerCase()}`;

    // Determine folder structure
    const parentDir = path.dirname(parentFile);
    const parentBasename = path.basename(parentFile, '.md');
    const subReqFolder = path.join(parentDir, parentBasename);

    // Create folder structure if using folder-based organization
    if (options.useFolder !== false) {
      await this.createSubRequirementFolders(subReqFolder);
    }

    // Determine file location based on phase
    const phase = options.phase || 'implementation';
    const fileName = `req-${fileId}-${this.slugify(title)}.md`;
    const filePath = options.useFolder
      ? path.join(subReqFolder, phase, fileName)
      : path.join(parentDir, fileName);

    // Check if file already exists
    if (await fs.pathExists(filePath)) {
      throw new Error(`Sub-requirement file already exists: ${filePath}`);
    }

    // Generate sub-requirement content
    const content = this.generateSubRequirementContent(
      subReqId,
      title,
      parentId,
      parentData,
      options
    );

    // Write file
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);

    // Update parent requirement to reference new sub-requirement
    await this.updateParentWithSubRequirement(
      parentFile,
      subReqId,
      title,
      filePath
    );

    console.log(chalk.green(`✅ Created sub-requirement: ${subReqId}`));
    console.log(
      chalk.blue(`   File: ${path.relative(this.projectRoot, filePath)}`)
    );
    console.log(chalk.blue(`   Parent: ${parentId}`));

    return {
      id: subReqId,
      filePath,
      parentId,
      letter: nextLetter
    };
  }

  /**
   * Get the next available letter for a sub-requirement
   */
  async getNextSubRequirementLetter(_parentId, parentFile) {
    const parentDir = path.dirname(parentFile);
    const files = await fs.readdir(parentDir);

    // Extract parent file pattern
    const parentBasename = path.basename(parentFile, '.md');
    const parentMatch = parentBasename.match(/req-([a-z]+-\d+)/);
    if (!parentMatch) return 'A';

    const parentPattern = parentMatch[1];

    // Find all sub-requirement files
    const subReqPattern = new RegExp(`req-${parentPattern}([a-z])`, 'i');
    const existingLetters = new Set();

    for (const file of files) {
      const match = file.match(subReqPattern);
      if (match) {
        existingLetters.add(match[1].toUpperCase());
      }
    }

    // Also check folder-based sub-requirements
    const subReqFolder = path.join(parentDir, parentBasename);
    if (await fs.pathExists(subReqFolder)) {
      const phases = ['planning', 'implementation', 'validation', 'solutions'];
      for (const phase of phases) {
        const phaseDir = path.join(subReqFolder, phase);
        if (await fs.pathExists(phaseDir)) {
          const phaseFiles = await fs.readdir(phaseDir);
          for (const file of phaseFiles) {
            const match = file.match(subReqPattern);
            if (match) {
              existingLetters.add(match[1].toUpperCase());
            }
          }
        }
      }
    }

    // Find next available letter
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const letter of alphabet) {
      if (!existingLetters.has(letter)) {
        return letter;
      }
    }

    throw new Error('All 26 sub-requirement letters are exhausted');
  }

  /**
   * Create folder structure for sub-requirements
   */
  async createSubRequirementFolders(basePath) {
    const phases = ['planning', 'implementation', 'validation', 'solutions'];
    for (const phase of phases) {
      await fs.ensureDir(path.join(basePath, phase));
    }
  }

  /**
   * Generate sub-requirement content
   */
  generateSubRequirementContent(
    subReqId,
    title,
    parentId,
    parentData,
    options
  ) {
    const now = new Date().toISOString().split('T')[0];
    const phase = options.phase || 'implementation';
    const priority = options.priority || parentData.priority || 'Medium';
    const category = parentData.category || 'core';

    return `---
id: '${subReqId}'
parentRequirement: '${parentId}'
title: ${title}
category: '${category}'
hierarchy: sub-requirement
priority: ${priority}
status: Draft
phase: ${phase}
individuallyTestable: true
dependencies: ${options.dependencies ? JSON.stringify(options.dependencies) : '[]'}
assignee: ''
version: 1.0.0
tags: []
created: ${now}
updated: ${now}
reviewedBy: ''
approvedBy: ''
riskLevel: Medium
complianceStandards: []
codeComponents: []
testFiles: []
---

# ${subReqId}: ${title}

**Parent Requirement**: [${parentId}](../requirement.md)  
**Phase**: ${phase}  
**Status**: Draft  
**Priority**: ${priority}

## Overview

${options.description || 'Sub-requirement implementation details.'}

## User Story

**As a** developer  
**I want** ${title.toLowerCase()}  
**So that** I can implement ${parentId} effectively

## Acceptance Criteria

\`\`\`gherkin
Feature: ${title}
  As a developer
  I want to implement ${title.toLowerCase()}
  So that ${parentId} requirements are met

  Scenario: Basic implementation
    Given the parent requirement ${parentId} exists
    When I implement ${title.toLowerCase()}
    Then the sub-requirement should be testable independently
    And it should integrate with the parent requirement
\`\`\`

## Implementation Details

${options.details || 'Implementation details to be defined.'}

## Test Strategy

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test integration with parent requirement
- **Component Tests**: Test UI components (if applicable)
- **Validation Tests**: Verify acceptance criteria are met

## Code Components

<!-- Auto-generated by: sc solutions map ${subReqId} -->
<!-- Components will be listed here after implementation -->

## Dependencies

${options.dependencies && options.dependencies.length > 0 ? options.dependencies.map((dep) => `- ${dep}`).join('\n') : 'No dependencies'}

## Notes

${options.notes || 'Additional notes and considerations.'}

---

*Sub-requirement of [${parentId}](../requirement.md)*  
*Generated: ${new Date().toISOString()}*
`;
  }

  /**
   * Update parent requirement with sub-requirement reference
   */
  async updateParentWithSubRequirement(
    parentFile,
    subReqId,
    subReqTitle,
    subReqPath
  ) {
    const content = await fs.readFile(parentFile, 'utf8');
    const { data, content: markdownContent } = matter(content);

    // Add sub-requirement to frontmatter
    if (!data.subRequirements) {
      data.subRequirements = [];
    }
    data.subRequirements.push({
      id: subReqId,
      title: subReqTitle,
      path: path.relative(path.dirname(parentFile), subReqPath)
    });

    // Add sub-requirement section to content if it doesn't exist
    let updatedContent = markdownContent;
    if (!updatedContent.includes('## Sub-Requirements')) {
      updatedContent += `\n\n## Sub-Requirements\n\n`;
    }

    // Add reference to new sub-requirement
    const relativeLink = path.relative(path.dirname(parentFile), subReqPath);
    const subReqSection = `\n- [${subReqId}: ${subReqTitle}](${relativeLink})\n`;

    if (updatedContent.includes('## Sub-Requirements')) {
      updatedContent = updatedContent.replace(
        '## Sub-Requirements',
        `## Sub-Requirements${subReqSection}`
      );
    }

    // Write updated content
    const updatedFile = matter.stringify(updatedContent, data);
    await fs.writeFile(parentFile, updatedFile);
  }

  /**
   * List all sub-requirements for a parent requirement
   */
  async listSubRequirements(parentId) {
    const parentFile =
      await this.requirementManager.findRequirementById(parentId);
    if (!parentFile) {
      throw new Error(`Parent requirement ${parentId} not found`);
    }

    const content = await fs.readFile(parentFile, 'utf8');
    const { data } = matter(content);

    if (!data.subRequirements || data.subRequirements.length === 0) {
      console.log(chalk.yellow(`No sub-requirements found for ${parentId}`));
      return [];
    }

    console.log(chalk.bold(`\n📋 Sub-Requirements for ${parentId}:\n`));
    for (const subReq of data.subRequirements) {
      console.log(chalk.cyan(`  • ${subReq.id}: ${subReq.title}`));
    }

    return data.subRequirements;
  }

  /**
   * Convert requirement to use folder structure
   */
  async convertToFolderStructure(reqId, options = {}) {
    const reqFile = await this.requirementManager.findRequirementById(reqId);
    if (!reqFile) {
      throw new Error(`Requirement ${reqId} not found`);
    }

    const parentDir = path.dirname(reqFile);
    const parentBasename = path.basename(reqFile, '.md');
    const folderPath = path.join(parentDir, parentBasename);

    // Create folder structure
    await this.createSubRequirementFolders(folderPath);

    // Move file to index.md if requested
    if (options.moveToIndex) {
      const indexPath = path.join(folderPath, 'index.md');
      await fs.copy(reqFile, indexPath);

      if (!options.keepOriginal) {
        await fs.remove(reqFile);
        console.log(
          chalk.yellow(
            `  Moved to: ${path.relative(this.projectRoot, indexPath)}`
          )
        );
      }
    }

    console.log(chalk.green(`✅ Created folder structure for ${reqId}`));
    console.log(
      chalk.blue(`   Path: ${path.relative(this.projectRoot, folderPath)}`)
    );

    return folderPath;
  }

  /**
   * Helper: Slugify a string
   */
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

module.exports = SubRequirementManager;
