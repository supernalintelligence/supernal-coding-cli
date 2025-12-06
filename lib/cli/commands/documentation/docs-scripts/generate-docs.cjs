#!/usr/bin/env node

/**
 * Documentation Generation Script
 * Automates creation and maintenance of documentation using templates
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Configuration
const CONFIG = {
  templatesDir: 'templates',
  docsDir: 'docs',
  familiesDir: 'families',
  platformDir: 'platform',
  outputDir: 'generated-docs'
};

// Template types
const TEMPLATE_TYPES = {
  FAMILY: 'README.family.md',
  APP: 'README.app.md',
  PACKAGE: 'README.package.md',
  KANBAN_TASK: 'KANBAN_TASK.md'
};

/**
 * Main documentation generator class
 */
class DocumentationGenerator {
  constructor() {
    this.templates = {};
    this.loadTemplates();
  }

  /**
   * Load all templates from templates directory
   */
  loadTemplates() {
    console.log('📚 Loading documentation templates...');

    for (const [type, filename] of Object.entries(TEMPLATE_TYPES)) {
      const templatePath = path.join(CONFIG.templatesDir, filename);
      if (fs.existsSync(templatePath)) {
        this.templates[type] = fs.readFileSync(templatePath, 'utf8');
        console.log(`  ✅ Loaded ${type} template`);
      } else {
        console.warn(`  ⚠️  Template not found: ${templatePath}`);
      }
    }
  }

  /**
   * Generate README.md from template
   */
  generateReadme(type, targetPath, metadata = {}) {
    console.log(`📝 Generating ${type} README for: ${targetPath}`);

    if (!this.templates[type]) {
      throw new Error(`Template not found for type: ${type}`);
    }

    let content = this.templates[type];

    // Replace template variables
    for (const [key, value] of Object.entries(metadata)) {
      const placeholder = `[${key}]`;
      content = content.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        value
      );
    }

    // Write to target path
    const readmePath = path.join(targetPath, 'README.md');
    this.ensureDirectoryExists(path.dirname(readmePath));
    fs.writeFileSync(readmePath, content);

    console.log(`  ✅ Generated: ${readmePath}`);
    return readmePath;
  }

  /**
   * Generate API documentation from code
   */
  generateApiDocs(servicePath) {
    console.log(`🔧 Generating API docs for: ${servicePath}`);

    try {
      // Look for OpenAPI specs, JSDoc, or TypeScript interfaces
      const packageJsonPath = path.join(servicePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        console.warn(`  ⚠️  No package.json found in ${servicePath}`);
        return null;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const serviceName = packageJson.name || path.basename(servicePath);

      // Generate basic API documentation structure
      const apiDoc = this.generateApiDocStructure(serviceName, servicePath);

      const apiDocPath = path.join(servicePath, 'docs', 'API_REFERENCE.md');
      this.ensureDirectoryExists(path.dirname(apiDocPath));
      fs.writeFileSync(apiDocPath, apiDoc);

      console.log(`  ✅ Generated API docs: ${apiDocPath}`);
      return apiDocPath;
    } catch (error) {
      console.error(`  ❌ Error generating API docs: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate kanban task from template
   */
  generateKanbanTask(taskName, taskData = {}) {
    console.log(`📋 Generating kanban task: ${taskName}`);

    if (!this.templates.KANBAN_TASK) {
      throw new Error('Kanban task template not found');
    }

    let content = this.templates.KANBAN_TASK;

    // Replace template variables
    const defaults = {
      'Task Title': taskName,
      'Brief description of what needs to be documented':
        taskData.description || 'Task description needed',
      'TODO/DOING/BLOCKED/DONE': taskData.status || 'TODO',
      'Person/Team': taskData.assignee || 'Unassigned',
      'High/Medium/Low': taskData.priority || 'Medium',
      'Hours/Days': taskData.effort || 'TBD'
    };

    for (const [placeholder, value] of Object.entries(defaults)) {
      content = content.replace(`[${placeholder}]`, value);
    }

    // Write to kanban directory
    const taskFileName = `${taskName.toLowerCase().replace(/\s+/g, '-')}.md`;
    const taskPath = path.join(
      CONFIG.docsDir,
      'kanban',
      taskData.status || 'TODO',
      taskFileName
    );

    this.ensureDirectoryExists(path.dirname(taskPath));
    fs.writeFileSync(taskPath, content);

    console.log(`  ✅ Generated kanban task: ${taskPath}`);
    return taskPath;
  }

  /**
   * Validate documentation structure
   */
  validateStructure() {
    console.log('🔍 Validating documentation structure...');

    const issues = [];

    // Check for required directories
    const requiredDirs = [
      CONFIG.docsDir,
      path.join(CONFIG.docsDir, 'kanban'),
      CONFIG.templatesDir
    ];

    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        issues.push(`Missing required directory: ${dir}`);
      }
    }

    // Check for template files
    for (const [_type, filename] of Object.entries(TEMPLATE_TYPES)) {
      const templatePath = path.join(CONFIG.templatesDir, filename);
      if (!fs.existsSync(templatePath)) {
        issues.push(`Missing template: ${templatePath}`);
      }
    }

    // Validate kanban structure
    const kanbanDirs = ['TODO', 'DOING', 'DONE', 'BLOCKED'];
    for (const dir of kanbanDirs) {
      const kanbanPath = path.join(CONFIG.docsDir, 'kanban', dir);
      if (!fs.existsSync(kanbanPath)) {
        issues.push(`Missing kanban directory: ${kanbanPath}`);
      }
    }

    if (issues.length === 0) {
      console.log('  ✅ Documentation structure is valid');
    } else {
      console.log('  ❌ Issues found:');
      issues.forEach((issue) => console.log(`    - ${issue}`));
    }

    return issues;
  }

  /**
   * Generate documentation for all families
   */
  generateFamilyDocs() {
    console.log('🏠 Generating family documentation...');

    if (!fs.existsSync(CONFIG.familiesDir)) {
      console.warn(`Families directory not found: ${CONFIG.familiesDir}`);
      return [];
    }

    const families = fs
      .readdirSync(CONFIG.familiesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const generated = [];

    for (const family of families) {
      const familyPath = path.join(CONFIG.familiesDir, family);
      const metadata = this.extractFamilyMetadata(familyPath);

      try {
        const readmePath = this.generateReadme('FAMILY', familyPath, metadata);
        generated.push(readmePath);
      } catch (error) {
        console.error(
          `  ❌ Error generating docs for family ${family}: ${error.message}`
        );
      }
    }

    return generated;
  }

  /**
   * Extract metadata from family directory
   */
  extractFamilyMetadata(familyPath) {
    const familyName = path.basename(familyPath);
    const packageJsonPath = path.join(familyPath, 'package.json');

    const metadata = {
      'Family Name': familyName,
      'Brief Description': `${familyName} family applications and services`,
      'Active/Development/Archived': 'Development',
      'Version Number': '1.0.0',
      'Team/Person': 'Development Team'
    };

    // Try to extract from package.json
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8')
        );
        metadata['Brief Description'] =
          packageJson.description || metadata['Brief Description'];
        metadata['Version Number'] =
          packageJson.version || metadata['Version Number'];
      } catch (_error) {
        console.warn(`  ⚠️  Could not parse package.json for ${familyName}`);
      }
    }

    // Try to extract from family.config.json
    const configPath = path.join(familyPath, 'family.config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        metadata['Brief Description'] =
          config.description || metadata['Brief Description'];
        metadata['Active/Development/Archived'] =
          config.status || metadata['Active/Development/Archived'];
      } catch (_error) {
        console.warn(
          `  ⚠️  Could not parse family.config.json for ${familyName}`
        );
      }
    }

    return metadata;
  }

  /**
   * Generate basic API documentation structure
   */
  generateApiDocStructure(serviceName, _servicePath) {
    return `# ${serviceName} API Reference

## Overview

API documentation for the ${serviceName} service.

## Base URL

\`\`\`
http://localhost:3000/api
\`\`\`

## Authentication

[Authentication details]

## Endpoints

### GET /health
Health check endpoint

**Response:**
\`\`\`json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`

## Error Handling

### Error Response Format
\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
\`\`\`

### Common Error Codes
- \`400\` - Bad Request
- \`401\` - Unauthorized
- \`404\` - Not Found
- \`500\` - Internal Server Error

## Examples

[API usage examples]

---

*Generated on ${new Date().toISOString()}*
`;
  }

  /**
   * Ensure directory exists
   */
  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('📊 Generating documentation report...');

    const report = {
      timestamp: new Date().toISOString(),
      structure: this.validateStructure(),
      stats: this.gatherStats(),
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(CONFIG.outputDir, 'documentation-report.json');
    this.ensureDirectoryExists(CONFIG.outputDir);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`  ✅ Report generated: ${reportPath}`);
    return report;
  }

  /**
   * Gather documentation statistics
   */
  gatherStats() {
    const stats = {
      totalMarkdownFiles: 0,
      readmeFiles: 0,
      familyDocs: 0,
      kanbanTasks: { TODO: 0, DOING: 0, DONE: 0, BLOCKED: 0 }
    };

    // Count markdown files
    const countMarkdownFiles = (dir) => {
      if (!fs.existsSync(dir)) return 0;

      let count = 0;
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          count += countMarkdownFiles(path.join(dir, item.name));
        } else if (item.name.endsWith('.md')) {
          count++;
          if (item.name === 'README.md') {
            stats.readmeFiles++;
          }
        }
      }

      return count;
    };

    stats.totalMarkdownFiles = countMarkdownFiles('.');

    // Count family docs
    if (fs.existsSync(CONFIG.familiesDir)) {
      const families = fs
        .readdirSync(CONFIG.familiesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory());
      stats.familyDocs = families.length;
    }

    // Count kanban tasks
    for (const status of Object.keys(stats.kanbanTasks)) {
      const kanbanDir = path.join(CONFIG.docsDir, 'kanban', status);
      if (fs.existsSync(kanbanDir)) {
        stats.kanbanTasks[status] = fs
          .readdirSync(kanbanDir)
          .filter((file) => file.endsWith('.md')).length;
      }
    }

    return stats;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const stats = this.gatherStats();
    const recommendations = [];

    if (stats.readmeFiles > 25) {
      recommendations.push({
        type: 'consolidation',
        priority: 'high',
        message: `Too many README files (${stats.readmeFiles}). Target: <25 files.`
      });
    }

    if (stats.kanbanTasks.BLOCKED > 5) {
      recommendations.push({
        type: 'workflow',
        priority: 'medium',
        message: `${stats.kanbanTasks.BLOCKED} blocked tasks. Review and resolve blockers.`
      });
    }

    if (stats.kanbanTasks.DOING > 10) {
      recommendations.push({
        type: 'workflow',
        priority: 'medium',
        message: `${stats.kanbanTasks.DOING} tasks in progress. Consider limiting WIP.`
      });
    }

    return recommendations;
  }
}

/**
 * CLI Interface
 */
function main() {
  const generator = new DocumentationGenerator();
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🚀 Documentation Generator v1.0.0\n');

  try {
    switch (command) {
      case 'generate-readme': {
        const type = args[1];
        const targetPath = args[2];
        if (!type || !targetPath) {
          console.error(
            'Usage: generate-docs.js generate-readme <type> <path>'
          );
          process.exit(1);
        }
        generator.generateReadme(type.toUpperCase(), targetPath);
        break;
      }

      case 'generate-api': {
        const servicePath = args[1];
        if (!servicePath) {
          console.error('Usage: generate-docs.js generate-api <service-path>');
          process.exit(1);
        }
        generator.generateApiDocs(servicePath);
        break;
      }

      case 'generate-families':
        generator.generateFamilyDocs();
        break;

      case 'validate':
        generator.validateStructure();
        break;

      case 'report': {
        const report = generator.generateReport();
        console.log('\n📊 Documentation Report Summary:');
        console.log(
          `  📄 Total markdown files: ${report.stats.totalMarkdownFiles}`
        );
        console.log(`  📝 README files: ${report.stats.readmeFiles}`);
        console.log(
          `  📋 Kanban tasks: ${Object.values(report.stats.kanbanTasks).reduce((a, b) => a + b, 0)}`
        );
        break;
      }

      case 'kanban': {
        const taskName = args[1];
        if (!taskName) {
          console.error('Usage: generate-docs.js kanban <task-name>');
          process.exit(1);
        }
        generator.generateKanbanTask(taskName);
        break;
      }

      default:
        console.log('Available commands:');
        console.log(
          '  generate-readme <type> <path>  - Generate README from template'
        );
        console.log(
          '  generate-api <service-path>     - Generate API documentation'
        );
        console.log(
          '  generate-families               - Generate all family documentation'
        );
        console.log(
          '  validate                        - Validate documentation structure'
        );
        console.log(
          '  report                          - Generate comprehensive report'
        );
        console.log('  kanban <task-name>              - Create kanban task');
        console.log('\nExample:');
        console.log(
          '  node scripts/generate-docs.js generate-readme family families/supernal-coding'
        );
        break;
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }

  console.log('\n✅ Documentation generation completed!');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DocumentationGenerator;
