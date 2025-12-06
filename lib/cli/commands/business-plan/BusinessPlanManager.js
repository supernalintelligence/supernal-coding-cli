const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const matter = require('gray-matter');

/**
 * Business Plan Manager
 * Manages high-level business plans that group requirements and sub-requirements
 */
class BusinessPlanManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.plansDir = path.join(projectRoot, 'docs', 'business-plans');
    this.ensureDirectories();
  }

  /**
   * Ensure all necessary directories exist
   */
  async ensureDirectories() {
    await fs.ensureDir(this.plansDir);
  }

  /**
   * Create a new business plan
   */
  async createBusinessPlan(planId, title, options = {}) {
    const planPath = path.join(this.plansDir, `${planId}.md`);

    if (await fs.pathExists(planPath)) {
      throw new Error(`Business plan ${planId} already exists`);
    }

    const content = this.generateBusinessPlanContent(planId, title, options);

    await fs.writeFile(planPath, content);

    console.log(chalk.green(`✅ Created business plan: ${planId}`));
    console.log(chalk.blue(`   Title: ${title}`));
    console.log(chalk.blue(`   Category: ${options.category || 'general'}`));

    return {
      planId,
      title,
      path: planPath
    };
  }

  /**
   * Generate business plan content
   */
  generateBusinessPlanContent(planId, title, options) {
    const now = new Date().toISOString().split('T')[0];
    const category = options.category || 'general';
    const priority = options.priority || 'medium';
    const status = options.status || 'planning';

    return `---
id: '${planId}'
title: ${title}
category: '${category}'
priority: ${priority}
status: ${status}
created: ${now}
updated: ${now}
owner: ${options.owner || ''}
stakeholders: ${options.stakeholders ? JSON.stringify(options.stakeholders) : '[]'}
demoDate: ${options.demoDate || ''}
targetQuarter: ${options.targetQuarter || ''}
businessValue: ${options.businessValue || 'medium'}
tags: ${options.tags ? JSON.stringify(options.tags) : '[]'}
requirements: []
epics: []
kanbanBoard: ${options.kanbanBoard || ''}
---

# ${planId}: ${title}

**Status**: ${status}  
**Priority**: ${priority}  
**Category**: ${category}  
**Business Value**: ${options.businessValue || 'medium'}

## Overview

${options.description || 'High-level business plan description.'}

## Business Objectives

${
  options.objectives ||
  `
- Define business objectives for this plan
- Outline success criteria
- Identify key deliverables
`
}

## Target Outcomes

${
  options.outcomes ||
  `
- What does success look like?
- What metrics will we track?
- What value does this deliver to the business?
`
}

## Timeline

- **Start Date**: ${options.startDate || 'TBD'}
- **Demo Date**: ${options.demoDate || 'TBD'}
- **Target Quarter**: ${options.targetQuarter || 'TBD'}

## Requirements & Epics

<!-- Requirements and epics will be linked here -->

## Sub-Requirements

<!-- Sub-requirements will be linked here -->

## Stakeholders

${options.stakeholders && options.stakeholders.length > 0 ? options.stakeholders.map((s) => `- ${s}`).join('\n') : 'No stakeholders defined'}

## Demo Scope

${
  options.demoScope ||
  `
Define what features and functionality will be demonstrated:
- Core features to showcase
- User workflows to demonstrate
- Technical capabilities to highlight
`
}

## Success Criteria

${
  options.successCriteria ||
  `
- [ ] All core requirements completed
- [ ] Demo-ready functionality verified
- [ ] Stakeholder approval obtained
- [ ] Documentation updated
`
}

## Risks & Dependencies

${
  options.risks ||
  `
### Risks
- Identify potential risks
- Mitigation strategies

### Dependencies
- External dependencies
- Prerequisite work
`
}

## Notes

${options.notes || 'Additional notes and considerations.'}

---

*Business Plan created: ${new Date().toISOString()}*
`;
  }

  /**
   * List all business plans
   */
  async listBusinessPlans(filterOptions = {}) {
    await this.ensureDirectories();
    const files = await fs.readdir(this.plansDir);
    const plans = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const planPath = path.join(this.plansDir, file);
        const content = await fs.readFile(planPath, 'utf8');
        const { data } = matter(content);

        // Apply filters
        if (filterOptions.status && data.status !== filterOptions.status) {
          continue;
        }
        if (
          filterOptions.category &&
          data.category !== filterOptions.category
        ) {
          continue;
        }

        plans.push({
          id: data.id,
          title: data.title,
          category: data.category,
          priority: data.priority,
          status: data.status,
          businessValue: data.businessValue,
          demoDate: data.demoDate,
          owner: data.owner,
          path: planPath
        });
      }
    }

    return plans;
  }

  /**
   * Get a specific business plan
   */
  async getBusinessPlan(planId) {
    const planPath = path.join(this.plansDir, `${planId}.md`);

    if (!(await fs.pathExists(planPath))) {
      throw new Error(`Business plan ${planId} not found`);
    }

    const content = await fs.readFile(planPath, 'utf8');
    const { data, content: markdownContent } = matter(content);

    return {
      ...data,
      content: markdownContent,
      path: planPath
    };
  }

  /**
   * Link a requirement to a business plan
   */
  async linkRequirement(planId, requirementId, requirementTitle) {
    const planPath = path.join(this.plansDir, `${planId}.md`);

    if (!(await fs.pathExists(planPath))) {
      throw new Error(`Business plan ${planId} not found`);
    }

    const content = await fs.readFile(planPath, 'utf8');
    const { data, content: markdownContent } = matter(content);

    // Add to frontmatter
    if (!data.requirements) {
      data.requirements = [];
    }

    if (!data.requirements.includes(requirementId)) {
      data.requirements.push(requirementId);
    }

    // Add to content section
    let updatedContent = markdownContent;
    if (updatedContent.includes('## Requirements & Epics')) {
      const reqLink = `\n- [${requirementId}](../requirements/**/${requirementId}.md) - ${requirementTitle}`;
      updatedContent = updatedContent.replace(
        '## Requirements & Epics',
        `## Requirements & Epics${reqLink}`
      );
    }

    // Write updated content
    const updatedFile = matter.stringify(updatedContent, data);
    await fs.writeFile(planPath, updatedFile);

    console.log(
      chalk.green(`✅ Linked ${requirementId} to business plan ${planId}`)
    );
  }

  /**
   * Link a sub-requirement to a business plan
   */
  async linkSubRequirement(
    planId,
    subRequirementId,
    subRequirementTitle,
    parentRequirementId
  ) {
    const planPath = path.join(this.plansDir, `${planId}.md`);

    if (!(await fs.pathExists(planPath))) {
      throw new Error(`Business plan ${planId} not found`);
    }

    const content = await fs.readFile(planPath, 'utf8');
    const { data, content: markdownContent } = matter(content);

    // Add to frontmatter as metadata
    if (!data.subRequirements) {
      data.subRequirements = [];
    }

    const existing = data.subRequirements.find(
      (sr) => sr.id === subRequirementId
    );
    if (!existing) {
      data.subRequirements.push({
        id: subRequirementId,
        title: subRequirementTitle,
        parent: parentRequirementId
      });
    }

    // Add to content section
    let updatedContent = markdownContent;
    if (updatedContent.includes('## Sub-Requirements')) {
      const subReqLink = `\n- [${subRequirementId}](../requirements/**/${subRequirementId}.md) - ${subRequirementTitle} (parent: ${parentRequirementId})`;
      updatedContent = updatedContent.replace(
        '## Sub-Requirements',
        `## Sub-Requirements${subReqLink}`
      );
    }

    // Write updated content
    const updatedFile = matter.stringify(updatedContent, data);
    await fs.writeFile(planPath, updatedFile);

    console.log(
      chalk.green(`✅ Linked ${subRequirementId} to business plan ${planId}`)
    );
  }

  /**
   * Unlink a requirement from a business plan
   */
  async unlinkRequirement(planId, requirementId) {
    const planPath = path.join(this.plansDir, `${planId}.md`);

    if (!(await fs.pathExists(planPath))) {
      throw new Error(`Business plan ${planId} not found`);
    }

    const content = await fs.readFile(planPath, 'utf8');
    const { data, content: markdownContent } = matter(content);

    // Remove from frontmatter
    if (data.requirements) {
      data.requirements = data.requirements.filter(
        (id) => id !== requirementId
      );
    }

    // Remove from content
    const lines = markdownContent.split('\n');
    const updatedLines = lines.filter((line) => !line.includes(requirementId));

    // Write updated content
    const updatedFile = matter.stringify(updatedLines.join('\n'), data);
    await fs.writeFile(planPath, updatedFile);

    console.log(
      chalk.green(`✅ Unlinked ${requirementId} from business plan ${planId}`)
    );
  }

  /**
   * Update business plan status
   */
  async updateStatus(planId, newStatus) {
    const planPath = path.join(this.plansDir, `${planId}.md`);

    if (!(await fs.pathExists(planPath))) {
      throw new Error(`Business plan ${planId} not found`);
    }

    const content = await fs.readFile(planPath, 'utf8');
    const { data, content: markdownContent } = matter(content);

    data.status = newStatus;
    data.updated = new Date().toISOString().split('T')[0];

    // Write updated content
    const updatedFile = matter.stringify(markdownContent, data);
    await fs.writeFile(planPath, updatedFile);

    console.log(chalk.green(`✅ Updated ${planId} status to ${newStatus}`));
  }

  /**
   * Get progress for a business plan
   */
  async getProgress(planId) {
    const plan = await this.getBusinessPlan(planId);

    // Count total requirements/sub-requirements
    const totalReqs = (plan.requirements || []).length;
    const totalSubReqs = (plan.subRequirements || []).length;
    const total = totalReqs + totalSubReqs;

    if (total === 0) {
      return {
        total: 0,
        completed: 0,
        percentage: 0
      };
    }

    // This would require integration with RequirementManager to check actual status
    // For now, return basic structure
    return {
      total,
      completed: 0, // Would need to check actual requirement statuses
      percentage: 0,
      requirements: totalReqs,
      subRequirements: totalSubReqs
    };
  }

  /**
   * Delete a business plan
   */
  async deleteBusinessPlan(planId) {
    const planPath = path.join(this.plansDir, `${planId}.md`);

    if (!(await fs.pathExists(planPath))) {
      throw new Error(`Business plan ${planId} not found`);
    }

    await fs.remove(planPath);

    console.log(chalk.green(`✅ Deleted business plan: ${planId}`));
  }
}

module.exports = BusinessPlanManager;
