#!/usr/bin/env node

/**
 * Unified Documentation System Management
 * Combines generation, validation, and kanban workflow management
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Import our modules
const DocumentationGenerator = require('./generate-docs.cjs');
// Note: DocumentationValidator moved to lib/validation/DocumentationValidator.js
// const DocumentationValidator = require('./validate-docs.cjs'); // REMOVED - file doesn't exist

/**
 * Documentation System Manager
 */
class DocumentationSystemManager {
  constructor() {
    this.generator = new DocumentationGenerator();
    // Validator removed - use sc docs validate or sc validate --docs instead
    // this.validator = new DocumentationValidator();
  }

  /**
   * Full documentation system setup
   */
  async setupSystem() {
    console.log('🚀 Setting up complete documentation system...\n');

    try {
      // 1. Validate current structure
      console.log('📊 Step 1: Initial validation...');
      const initialReport = await this.validator.validate();
      console.log(
        `Initial quality score: ${initialReport.summary.qualityScore}/100\n`
      );

      // 2. Generate missing templates
      console.log('📝 Step 2: Ensuring templates exist...');
      await this.ensureTemplates();

      // 3. Create kanban structure
      console.log('📋 Step 3: Setting up kanban workflow...');
      await this.setupKanban();

      // 4. Generate family documentation
      console.log('🏠 Step 4: Generating family documentation...');
      const familyDocs = this.generator.generateFamilyDocs();
      console.log(`Generated ${familyDocs.length} family README files\n`);

      // 5. Final validation
      console.log('✅ Step 5: Final validation...');
      const finalReport = await this.validator.validate();
      console.log(
        `Final quality score: ${finalReport.summary.qualityScore}/100\n`
      );

      // 6. Generate recommendations
      console.log('🎯 Step 6: Generating action plan...');
      await this.generateActionPlan(finalReport);

      console.log('✅ Documentation system setup complete!');
      return finalReport;
    } catch (error) {
      console.error(`❌ Setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure all required templates exist
   * NOTE: Templates are canonical in supernal-code-package/templates/
   * This function is deprecated - templates should NOT be copied to project root
   * See: equipment-pack.js comment "Templates are in SC package - no duplication"
   */
  async ensureTemplates() {
    // Templates should NOT be created in project root - they exist in SC package
    // Keeping this function as a no-op for backwards compatibility
    console.log(
      '  ⏭️  Templates located in SC package (no project-level duplication needed)'
    );
    return;
  }

  /**
   * Create basic template if missing
   */
  async createBasicTemplate(templatePath, templateName) {
    let content = '';

    switch (templateName) {
      case 'README.family.md':
        content = `# [Family Name] Family
## [Brief Description]

**Status**: [Active/Development/Archived]  
**Version**: [Version Number]  

## Overview
[Family overview content]

## Applications
[List of applications]

## Documentation
[Links to documentation]
`;
        break;

      case 'README.app.md':
        content = `# [App Name]
## [Brief Description]

**Status**: [Active/Development/Archived]  
**Platform**: [Web/Desktop/Mobile/Extension]  

## Overview
[App overview content]

## Quick Start
[Getting started instructions]

## Architecture
[Technical architecture details]
`;
        break;

      case 'README.package.md':
        content = `# [Package Name]
## [Brief Description]

**Version**: [Version Number]  
**Type**: [Library/Service/Utility]  

## Overview
[Package overview content]

## Installation
[Installation instructions]

## Usage
[Usage examples]
`;
        break;

      case 'KANBAN_TASK.md':
        content = `# [Task Title]
## Description
[Task description]

## Scope
- [ ] Deliverable 1
- [ ] Deliverable 2

## Definition of Done
- [ ] Completion criteria 1
- [ ] Completion criteria 2
`;
        break;
    }

    fs.writeFileSync(templatePath, content);
  }

  /**
   * Setup kanban workflow structure
   */
  async setupKanban() {
    const kanbanDirs = ['TODO', 'DOING', 'DONE', 'BLOCKED'];
    const kanbanBase = path.join('docs', 'kanban');

    this.generator.ensureDirectoryExists(kanbanBase);

    for (const dir of kanbanDirs) {
      const dirPath = path.join(kanbanBase, dir);
      this.generator.ensureDirectoryExists(dirPath);
      console.log(`  ✅ Kanban directory: ${dirPath}`);
    }

    // Create kanban README if it doesn't exist
    const kanbanReadme = path.join(kanbanBase, 'README.md');
    if (!fs.existsSync(kanbanReadme)) {
      console.log('  📝 Creating kanban README...');
      // The README is already created, so this is just a check
    }
  }

  /**
   * Generate action plan based on validation results
   */
  async generateActionPlan(report) {
    const planPath = path.join(
      'docs',
      'kanban',
      'TODO',
      'documentation-action-plan.md'
    );

    const plan = `# Documentation System Action Plan
## Generated from Validation Report

**Created**: ${new Date().toISOString()}  
**Quality Score**: ${report.summary.qualityScore}/100  

---

## 🚨 **Immediate Actions Required**

### Critical Issues (${report.issues.filter((i) => i.priority === 'high').length})
${report.issues
  .filter((i) => i.priority === 'high')
  .map((issue) => `- ${issue.message}`)
  .join('\n')}

### Medium Priority Issues (${report.issues.filter((i) => i.priority === 'medium').length})
${report.issues
  .filter((i) => i.priority === 'medium')
  .map((issue) => `- ${issue.message}`)
  .join('\n')}

---

## 📊 **Current Statistics**

- **Total Files**: ${report.summary.totalFiles}
- **README Files**: ${report.statistics.readmeCount} (Target: <25)
- **Broken Links**: ${report.statistics.brokenLinks}/${report.statistics.totalLinks}
- **Quality Score**: ${report.summary.qualityScore}/100

---

## 🎯 **Recommended Action Sequence**

${report.recommendations
  .map(
    (rec, index) => `
### ${index + 1}. ${rec.message}
**Priority**: ${rec.priority}  
**Category**: ${rec.category}  

**Actions**:
${rec.actions.map((action) => `- ${action}`).join('\n')}
`
  )
  .join('\n')}

---

## 📋 **Next Steps**

1. **Create specific kanban tasks** for each recommendation
2. **Assign team members** to high-priority issues
3. **Set up automation** to prevent regression
4. **Schedule regular validation** to monitor progress

---

**Task Status**: TODO  
**Assigned To**: Documentation Team  
**Priority**: High  
**Estimated Effort**: Based on individual subtasks
`;

    this.generator.ensureDirectoryExists(path.dirname(planPath));
    fs.writeFileSync(planPath, plan);

    console.log(`  ✅ Action plan created: ${planPath}`);
  }

  /**
   * Quick health check
   */
  async healthCheck() {
    console.log('🏥 Documentation System Health Check\n');

    // Check structure
    const structureIssues = this.validator.validateDirectoryStructure();
    console.log(
      `📁 Structure: ${structureIssues.length === 0 ? '✅ Healthy' : `⚠️  ${structureIssues.length} issues`}`
    );

    // Check kanban
    const kanbanStats = this.validator.getKanbanStats();
    const totalTasks = Object.values(kanbanStats).reduce((a, b) => a + b, 0);
    console.log(
      `📋 Kanban: ${totalTasks} total tasks (TODO: ${kanbanStats.TODO}, DOING: ${kanbanStats.DOING}, DONE: ${kanbanStats.DONE}, BLOCKED: ${kanbanStats.BLOCKED})`
    );

    // Check templates
    const templates = ['README.family.md', 'README.app.md', 'KANBAN_TASK.md'];
    const missingTemplates = templates.filter(
      (t) => !fs.existsSync(path.join('templates', t))
    );
    console.log(
      `📝 Templates: ${missingTemplates.length === 0 ? '✅ Complete' : `⚠️  Missing: ${missingTemplates.join(', ')}`}`
    );

    // Quick quality estimate
    const readmeCount = this.validator.findReadmeFiles().length;
    const qualityEstimate =
      readmeCount > 25 ? 'Poor' : readmeCount > 15 ? 'Fair' : 'Good';
    console.log(
      `📊 Quality: ${qualityEstimate} (${readmeCount} README files)\n`
    );

    return {
      structure: structureIssues.length === 0,
      kanban: totalTasks,
      templates: missingTemplates.length === 0,
      readmeCount,
      qualityEstimate
    };
  }

  /**
   * Generate documentation for specific family
   */
  async generateFamily(familyName) {
    console.log(`🏠 Generating documentation for family: ${familyName}\n`);

    const familyPath = path.join('families', familyName);
    if (!fs.existsSync(familyPath)) {
      throw new Error(`Family directory not found: ${familyPath}`);
    }

    // Extract metadata
    const metadata = this.generator.extractFamilyMetadata(familyPath);
    console.log(`📊 Family metadata:`, metadata);

    // Generate README
    const readmePath = this.generator.generateReadme(
      'FAMILY',
      familyPath,
      metadata
    );
    console.log(`✅ Generated README: ${readmePath}`);

    // Look for apps and generate their documentation
    const appsDir = path.join(familyPath, 'apps');
    if (fs.existsSync(appsDir)) {
      const apps = fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const app of apps) {
        const appPath = path.join(appsDir, app);
        const appMetadata = {
          'App Name': app,
          'Brief Description': `${app} application`,
          'Active/Development/Archived': 'Development',
          'Web/Desktop/Mobile/Extension': 'Web',
          'Team/Person': 'Development Team'
        };

        try {
          const appReadmePath = this.generator.generateReadme(
            'APP',
            appPath,
            appMetadata
          );
          console.log(`  ✅ Generated app README: ${appReadmePath}`);
        } catch (error) {
          console.log(
            `  ⚠️  Could not generate README for app ${app}: ${error.message}`
          );
        }
      }
    }

    return { familyPath, readmePath };
  }

  /**
   * Create kanban task from command line
   */
  async createTask(taskName, options = {}) {
    console.log(`📋 Creating kanban task: ${taskName}\n`);

    const taskData = {
      description: options.description || 'Task description needed',
      status: options.status || 'TODO',
      priority: options.priority || 'Medium',
      assignee: options.assignee || 'Unassigned',
      effort: options.effort || 'TBD'
    };

    const taskPath = this.generator.generateKanbanTask(taskName, taskData);
    console.log(`✅ Task created: ${taskPath}`);

    return taskPath;
  }
}

/**
 * CLI Interface
 */
async function main() {
  const manager = new DocumentationSystemManager();
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('📚 Documentation System Manager v1.0.0\n');

  try {
    switch (command) {
      case 'setup':
        await manager.setupSystem();
        break;

      case 'health':
        await manager.healthCheck();
        break;

      case 'validate': {
        const report = await manager.validator.validate();
        console.log(`\n📊 Quality Score: ${report.summary.qualityScore}/100`);
        break;
      }

      case 'generate-family': {
        const familyName = args[1];
        if (!familyName) {
          console.error('Usage: doc-system.cjs generate-family <family-name>');
          process.exit(1);
        }
        await manager.generateFamily(familyName);
        break;
      }

      case 'create-task': {
        const taskName = args[1];
        if (!taskName) {
          console.error(
            'Usage: doc-system.cjs create-task <task-name> [--description="..."] [--priority=high|medium|low]'
          );
          process.exit(1);
        }

        const options = {};
        for (let i = 2; i < args.length; i++) {
          const arg = args[i];
          if (arg.startsWith('--description=')) {
            options.description = arg.split('=')[1].replace(/"/g, '');
          } else if (arg.startsWith('--priority=')) {
            options.priority = arg.split('=')[1];
          } else if (arg.startsWith('--assignee=')) {
            options.assignee = arg.split('=')[1];
          }
        }

        await manager.createTask(taskName, options);
        break;
      }

      case 'quick-fix': {
        console.log('🔧 Running quick fixes...\n');

        // 1. Health check
        const health = await manager.healthCheck();

        // 2. Create missing templates
        if (!health.templates) {
          console.log('📝 Creating missing templates...');
          await manager.ensureTemplates();
        }

        // 3. Setup kanban if needed
        if (health.kanban === 0) {
          console.log('📋 Setting up kanban structure...');
          await manager.setupKanban();
        }

        console.log('\n✅ Quick fixes completed!');
        break;
      }

      default:
        console.log('Available commands:');
        console.log(
          '  setup              - Complete documentation system setup'
        );
        console.log('  health             - Quick system health check');
        console.log('  validate           - Run full validation');
        console.log('  generate-family    - Generate docs for specific family');
        console.log('  create-task        - Create kanban task');
        console.log('  quick-fix          - Run quick fixes for common issues');
        console.log('\nExamples:');
        console.log('  node scripts/doc-system.cjs setup');
        console.log('  node scripts/doc-system.cjs health');
        console.log(
          '  node scripts/doc-system.cjs generate-family supernal-coding'
        );
        console.log(
          '  node scripts/doc-system.cjs create-task "Fix broken links" --priority=high'
        );
        break;
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DocumentationSystemManager;
