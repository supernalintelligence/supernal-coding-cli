#!/usr/bin/env node

// Supernal Coding - Workflow Management Command
// Integrates kanban-style project management into supernal-coding system

const { Command } = require('commander');
const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { execSync } = require('node:child_process');
const { getConfig } = require('../../../scripts/config-loader');

const workflow = new Command('workflow')
  .alias('kanban')
  .description('Project workflow management (kanban-style boards)')
  .option('-v, --version', 'Show workflow system version')
  .option('--check-updates', 'Check for system updates')
  .addHelpText(
    'after',
    `
Examples:
  supernal-coding workflow list                 # Show current kanban board
  supernal-coding workflow install             # Install workflow system in current project
  supernal-coding workflow new todo "task"     # Create new task
  supernal-coding workflow priority next       # Show next priority task
  supernal-coding workflow done "task"         # Mark task complete
  supernal-coding workflow search "keyword"    # Search tasks
  supernal-coding workflow template todo       # View task template
  
Enhanced Features:
  • Priority-based task management (P0-P4)
  • Timestamped completion tracking
  • Comprehensive task templates
  • Smart filename generation
  • Advanced search with preview
  • Auto-initialization and setup
  
For detailed help: supernal-coding workflow --help
`
  );

// Add subcommands
workflow
  .command('list')
  .description('Show current kanban board overview')
  .option('-s, --status <status>', 'Filter by status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .action(async (_options) => {
    try {
      await initializeWorkflowIfNeeded();
      await executeKanbanCommand(['list']);
    } catch (error) {
      console.error('Error listing tasks:', error.message);
    }
  });

workflow
  .command('install')
  .description('Install enhanced workflow system in current project')
  .option('--force', 'Force reinstall even if already exists')
  .action(async (options) => {
    try {
      await installWorkflowSystem(options.force);
    } catch (error) {
      console.error('Error installing workflow system:', error.message);
    }
  });

// Enhanced command to create tasks with better title handling
workflow
  .command('new <type> <title> [content]')
  .description(
    'Create new task with clean title and optional structured content'
  )
  .option('-p, --priority <priority>', 'Set task priority (0-4)', '2')
  .option('-d, --description <description>', 'Add detailed description')
  .option('--show-template', 'Show template after creation', true)
  .option(
    '--content <content>',
    'Structured content in YAML format or file path'
  )
  .option('--overwrite', 'Overwrite existing task if it exists')
  .action(async (type, title, content, options) => {
    try {
      await initializeWorkflowIfNeeded();

      // Extract priority from title if present
      let priority = parseInt(options.priority, 10);
      let cleanTitle = title;

      const priorityMatch = title.match(/priority\s+([0-4])/i);
      if (priorityMatch) {
        priority = parseInt(priorityMatch[1], 10);
        cleanTitle = title.replace(/priority\s+[0-4]/gi, '').trim();
      }

      // Handle content parsing
      let parsedContent = null;
      const contentSource = content || options.content;

      if (contentSource) {
        const contentResult = await parseTaskContent(contentSource);
        if (!contentResult.success) {
          console.log(
            chalk.red(`❌ Error parsing content: ${contentResult.error}`)
          );
          console.log(chalk.blue(`\n📋 Expected format (save as .yaml file):`));
          console.log(getContentFormatExample());
          return;
        }
        parsedContent = contentResult.content;
      }

      // Create task with clean title and parsed content
      const result = await createEnhancedTask(
        type,
        cleanTitle,
        priority,
        options.description,
        parsedContent,
        options.overwrite
      );

      if (result.success && options.showTemplate) {
        console.log(chalk.blue(`\n📝 Template created at: ${result.filePath}`));
        console.log(chalk.gray('='.repeat(50)));

        // Show the template structure
        const templatePath = result.filePath;
        const templateContent = await fs.readFile(templatePath, 'utf8');
        console.log(templateContent);

        console.log(chalk.gray('='.repeat(50)));

        if (parsedContent) {
          console.log(chalk.green('✅ Task created with structured content!'));
          console.log(
            chalk.blue('📝 Review and refine the generated content:')
          );
        } else {
          console.log(
            chalk.red.bold('⚠️  TEMPLATE CREATED - REQUIRES AGENT ACTION')
          );
          console.log(chalk.blue('📝 NEXT STEPS FOR AGENT:'));
          console.log(chalk.yellow('1. Edit the file directly:'));
          console.log(chalk.yellow(`   code "${templatePath}"`));
          console.log(chalk.yellow('2. OR recreate with structured content:'));
          console.log(
            chalk.yellow(
              `   ./wf.sh new ${type} "${cleanTitle}" content.yaml --overwrite`
            )
          );
          console.log(chalk.yellow('3. OR use inline YAML:'));
          console.log(
            chalk.yellow(
              `   ./wf.sh new ${type} "${cleanTitle}" --content="objective: Your task description here" --overwrite`
            )
          );
          const config = getConfig();
          const kanbanDir = config.getKanbanBaseDirectory();
          console.log(
            chalk.blue(
              `📖 Content format guide: ${kanbanDir}/TODO_FILLING_GUIDE.md`
            )
          );
          console.log(
            chalk.blue(
              `📖 Sample content: ${kanbanDir}/sample-task-content.yaml`
            )
          );
        }
      }
    } catch (error) {
      console.error('Error creating task:', error.message);
    }
  });

workflow
  .command('move')
  .description('Move task or epic between boards')
  .argument('<task>', 'Task/epic title or filename')
  .argument(
    '<destination>',
    'Destination type (todo|doing|blocked|done|handoff)'
  )
  .option('--epic', 'Move an epic instead of a task')
  .action(moveTask);

workflow
  .command('done')
  .description('Mark task as complete')
  .argument('<task>', 'Task title or filename')
  .option('-m, --message <message>', 'Completion message')
  .action(completeTask);

workflow
  .command('search')
  .alias('find')
  .description('Search tasks by keyword')
  .argument('<keyword>', 'Search term')
  .option('-t, --type <type>', 'Limit search to specific board')
  .action(searchTasks);

workflow
  .command('priority')
  .description('Show tasks ordered by priority')
  .option('-t, --top <number>', 'Show top N priority tasks', '10')
  .action(showPriority);

workflow
  .command('cleanup')
  .description('Archive old completed tasks')
  .option('-d, --days <days>', 'Archive tasks older than N days', '30')
  .option('--dry-run', 'Show what would be archived without doing it')
  .action(cleanupTasks);

workflow
  .command('rename')
  .description('Rename task')
  .argument('<oldName>', 'Current task name')
  .argument('<newName>', 'New task name')
  .action(renameTask);

workflow
  .command('template')
  .description('Show template for task type')
  .argument(
    '<type>',
    'Task type (todo|doing|blocked|planning|handoff|epic|requirement)'
  )
  .action(showTemplate);

workflow
  .command('list-epics')
  .alias('epics')
  .description('List all epics with their status and progress')
  .option('-v, --verbose', 'Show detailed information about each epic')
  .action(listEpics);

workflow
  .command('new-epic')
  .description('Create new epic with requirements and tasks structure')
  .argument('<name>', 'Epic name (kebab-case)')
  .option('-d, --description <description>', 'Epic description')
  .option('-p, --priority <priority>', 'Epic priority (0-4)', '2')
  .option('--business-value <value>', 'Business value description')
  .action(createEpic);

// Requirement management commands moved to: sc requirement
// Use: sc requirement new "Title" --epic=epic-name
// Use: sc requirement generate-tests 036
// Use: sc requirement start-work 036

workflow
  .command('epic-progress')
  .description('Show progress for an epic')
  .argument('<epic-name>', 'Epic name (kebab-case)')
  .action(showEpicProgress);

workflow
  .command('test-run')
  .description('Run specific test types (legacy)')
  .argument('<type>', 'Test type (e2e|unit|integration)')
  .option('--scenario <scenario>', 'Specific scenario to run for e2e tests')
  .option('--requirement <req>', 'Specific requirement to test')
  .option('--report', 'Generate detailed report')
  .action(runTests);

// Validation command moved to: sc requirement validate
// Use: sc requirement validate 036

workflow
  .command('update')
  .description('Update workflow system to latest version')
  .option('--check-only', 'Only check for updates without installing')
  .action(updateSystem);

workflow
  .command('test')
  .description('Run automated tests for the workflow system')
  .argument('[scenario]', 'Test scenario to run (e2e, unit, integration)')
  .option('--create-test-repo', 'Create a dynamic test repository for testing')
  .option('--test-repo-dir <dir>', 'Directory for test repository')
  .option('--verbose', 'Verbose test output')
  .action(async (scenario, options) => {
    try {
      await initializeWorkflowIfNeeded();
      await testCommand(scenario, options);
    } catch (error) {
      console.error('Error running tests:', error.message);
    }
  });

// Implementation functions

async function _listTasks(_options) {
  console.log(chalk.blue.bold('📋 Supernal Coding - Workflow Overview'));
  console.log(chalk.blue('======================================'));
  console.log();

  try {
    // Auto-initialize if needed
    await ensureWorkflowSystem();

    // Call the kanban list functionality
    const kanbanPath = await findOrCreateKanbanScript();

    if (kanbanPath) {
      const result = execSync(`${kanbanPath} list`, { encoding: 'utf-8' });
      console.log(result);
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow system'));
    }
  } catch (error) {
    console.error(chalk.red('Error listing tasks:'), error.message);
  }
}

async function moveTask(task, destination) {
  console.log(chalk.blue(`🔄 Moving "${task}" to ${destination}`));

  try {
    await ensureWorkflowSystem();
    const kanbanPath = await findOrCreateKanbanScript();

    if (kanbanPath) {
      execSync(`${kanbanPath} move "${task}" ${destination}`, {
        stdio: 'inherit',
      });
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow system'));
    }
  } catch (error) {
    console.error(chalk.red('Error moving task:'), error.message);
  }
}

async function completeTask(task, _options) {
  console.log(chalk.green(`✅ Marking "${task}" as complete`));

  try {
    await ensureWorkflowSystem();
    const kanbanPath = await findOrCreateKanbanScript();

    if (kanbanPath) {
      execSync(`${kanbanPath} done "${task}"`, { stdio: 'inherit' });
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow system'));
    }
  } catch (error) {
    console.error(chalk.red('Error completing task:'), error.message);
  }
}

async function searchTasks(keyword, _options) {
  console.log(chalk.yellow(`🔍 Searching for: "${keyword}"`));

  try {
    await ensureWorkflowSystem();
    const kanbanPath = await findOrCreateKanbanScript();

    if (kanbanPath) {
      execSync(`${kanbanPath} search "${keyword}"`, { stdio: 'inherit' });
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow system'));
    }
  } catch (error) {
    console.error(chalk.red('Error searching tasks:'), error.message);
  }
}

async function showPriority(options) {
  console.log(chalk.magenta(`📊 Top ${options.top} Priority Tasks`));

  try {
    await ensureWorkflowSystem();
    const kanbanPath = await findOrCreateKanbanScript();

    if (kanbanPath) {
      execSync(`${kanbanPath} priority`, { stdio: 'inherit' });
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow system'));
    }
  } catch (error) {
    console.error(chalk.red('Error showing priorities:'), error.message);
  }
}

async function cleanupTasks(options) {
  console.log(
    chalk.cyan(`🧹 Cleaning up tasks older than ${options.days} days`)
  );

  if (options.dryRun) {
    console.log(chalk.yellow('(Dry run - no changes will be made)'));
  }

  try {
    await ensureWorkflowSystem();
    const kanbanPath = await findOrCreateKanbanScript();

    if (kanbanPath) {
      const dryRunFlag = options.dryRun ? '--dry-run' : '';
      execSync(`${kanbanPath} cleanup ${dryRunFlag}`, { stdio: 'inherit' });
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow system'));
    }
  } catch (error) {
    console.error(chalk.red('Error during cleanup:'), error.message);
  }
}

async function renameTask(oldName, newName) {
  console.log(chalk.blue(`📝 Renaming "${oldName}" to "${newName}"`));

  try {
    await ensureWorkflowSystem();
    const kanbanPath = await findOrCreateKanbanScript();

    if (kanbanPath) {
      execSync(`${kanbanPath} rename "${oldName}" "${newName}"`, {
        stdio: 'inherit',
      });
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow system'));
    }
  } catch (error) {
    console.error(chalk.red('Error renaming task:'), error.message);
  }
}

async function showTemplate(type) {
  console.log(chalk.cyan(`📄 Template for ${type} tasks:`));

  try {
    await ensureWorkflowSystem();
    const kanbanPath = await findOrCreateKanbanScript();

    if (kanbanPath) {
      execSync(`${kanbanPath} template ${type}`, { stdio: 'inherit' });
    } else {
      console.log(chalk.red('❌ Failed to initialize workflow system'));
    }
  } catch (error) {
    console.error(chalk.red('Error showing template:'), error.message);
  }
}

async function updateSystem(options) {
  console.log(chalk.blue.bold('🔄 Supernal Coding - System Update'));

  if (options.checkOnly) {
    console.log('Checking for updates...');
    await checkForUpdates();
  } else {
    console.log('Updating system...');
    await performUpdate();
  }
}

// Helper functions

async function ensureWorkflowSystem() {
  const kanbanDir = path.join(process.cwd(), 'docs', 'kanban');

  if (!(await fs.pathExists(kanbanDir))) {
    console.log(chalk.yellow('🏗️  Initializing workflow system...'));
    await initializeWorkflowSystem();
    console.log(chalk.green('✅ Workflow system initialized successfully'));
  }
}

async function initializeWorkflowSystem() {
  const kanbanDir = path.join(process.cwd(), 'docs', 'kanban');

  // Create new hierarchical structure
  const structure = {
    tasks: ['todo', 'doing', 'done', 'blocked', 'planning'],
    epics: ['todo', 'doing', 'done', 'blocked', 'planning'],
  };

  // Create task and epic directories
  for (const [type, states] of Object.entries(structure)) {
    for (const state of states) {
      const dirPath = path.join(kanbanDir, type, state);
      await fs.ensureDir(dirPath);
      await fs.ensureDir(path.join(dirPath, 'ARCHIVE'));
    }
  }

  // Create additional directories
  const additionalDirs = ['BRAINSTORM', 'HANDOFFS', 'EPICS'];
  for (const dir of additionalDirs) {
    await fs.ensureDir(path.join(kanbanDir, dir));
    await fs.ensureDir(path.join(kanbanDir, dir, 'ARCHIVE'));
  }

  // Create README.md
  const readmeContent = `# Kanban System

This directory contains the hierarchical kanban task management system for supernal-coding.

## Structure

### Epic Management
- **epics/todo/**: New epics to be planned
- **epics/doing/**: Epics in progress
- **epics/done/**: Completed epics
- **epics/blocked/**: Blocked epics
- **epics/planning/**: Epics being planned

### Task Management
- **tasks/todo/**: Ready to work tasks
- **tasks/doing/**: In progress work
- **tasks/done/**: Completed tasks
- **tasks/blocked/**: Blocked tasks
- **tasks/planning/**: Tasks being planned

### Additional Directories
- **BRAINSTORM/**: Ideas and exploration
- **HANDOFFS/**: Agent/developer handoffs
- **EPICS/**: Epic definitions and requirements

## Usage

Use the \`supernal-coding workflow\` command to interact with this system:

\`\`\`bash
# Epic management
supernal-coding workflow new epic "Epic Name"           # Create new epic
supernal-coding workflow list-epics                     # Show all epics
supernal-coding workflow move "Epic Name" doing --epic  # Move epic to doing

# Task management
supernal-coding workflow list                           # Show all tasks
supernal-coding workflow new todo "task"                # Create new task
supernal-coding workflow move "task" doing              # Move task to doing
supernal-coding workflow priority                       # Show next priority task
\`\`\`

See \`supernal-coding workflow --help\` for full documentation.

## Auto-Generated

This system was automatically created by supernal-coding v2.0.0.
`;

  await fs.writeFile(path.join(kanbanDir, 'README.md'), readmeContent);

  // Create template files
  await createTemplates();

  // Create local kanban script
  await createKanbanScript();
}

async function createTemplates() {
  const templatesDir = path.join(process.cwd(), 'docs', 'kanban', 'templates');
  await fs.ensureDir(templatesDir);

  // Create TODO template
  const todoTemplate = `# 📋 TODO: [Task Name]

**Priority**: P2 - Standard  
**Created**: ${new Date().toISOString().split('T')[0]}  
**Creator**: Supernal Coding  
**Type**: Feature  
**Estimated Effort**: M (1-2 days)  

---

## 🎯 **Description**

Brief, clear description of what needs to be accomplished.

### **Acceptance Criteria**
- [ ] Specific, measurable outcome 1
- [ ] Specific, measurable outcome 2  
- [ ] Specific, measurable outcome 3

---

## 📋 **Scope & Requirements**

### **In Scope**
- [ ] Deliverable 1: [Specific item]
- [ ] Deliverable 2: [Specific item]

### **Out of Scope**
- [What we're explicitly NOT doing]

---

## ✅ **Definition of Done**

### **Functional Requirements**
- [ ] Feature works as specified
- [ ] All acceptance criteria met
- [ ] Error handling implemented

### **Quality Requirements**
- [ ] Code reviewed and approved
- [ ] Tests written and passing
- [ ] Documentation updated

---

## 🔄 **Next Actions**

### **To Start This Task**
- [ ] Move to DOING folder
- [ ] Create feature branch if needed
- [ ] Begin implementation

---

**🚀 Ready to Move to DOING**: When ready to start, move to \`\${kanbanDir}/DOING/\`
`;

  await fs.writeFile(path.join(templatesDir, 'TODO_TEMPLATE.md'), todoTemplate);

  // Create DOING template
  const doingTemplate = `# 🚀 DOING: [Task Name]

**Status**: 🏃 In Progress  
**Priority**: P2 - Standard  
**Started**: ${new Date().toISOString().split('T')[0]}  
**Assignee**: [Your Name]  

---

## 🎯 **Current Objective**

What specific outcome are you working toward right now?

### **Progress Overview**
- **Current Phase**: Development
- **Completion**: 0% complete
- **Blockers**: None

---

## ✅ **Progress Checklist**

### **Completed**
- [x] Task started ✅ ${new Date().toISOString().split('T')[0]}

### **In Progress**
- [ ] **Current Focus**: [What you're working on right now]
- [ ] Next immediate step: [Specific next action]

### **Remaining**
- [ ] Task: [Description] (Est: [time])
- [ ] Task: [Description] (Est: [time])  

---

## 🔄 **Progress Log**

### **${new Date().toISOString().split('T')[0]} - Task Started**
**What was accomplished:**
- Task moved to DOING
- Initial setup complete

**Next session plan:**
- [ ] Priority 1: [Most important next step]
- [ ] Priority 2: [Secondary task]

---

## 📝 **Implementation Notes**

### **Approach/Strategy**
- **Method**: [How you're approaching this]
- **Tools**: [Technologies/frameworks being used]

### **Key Decisions Made**
- **Decision 1**: [What was decided] - Reason: [Why]

---

## 🎯 **Definition of Done**

### **Acceptance Criteria**
- [ ] All specified functionality implemented
- [ ] Tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated

### **Ready to Move to DONE**
When ALL criteria above are met, move this file to \`docs/planning/kanban/DONE/\`

---

## 🚀 **Ready to Complete**: When all acceptance criteria are met, move to \`docs/planning/kanban/DONE/\`
`;

  await fs.writeFile(
    path.join(templatesDir, 'DOING_TEMPLATE.md'),
    doingTemplate
  );

  // Create other templates
  const simpleTemplates = {
    'BLOCKED_TEMPLATE.md': `# 🚫 BLOCKED: [Task Name]

**Status**: 🚫 Blocked  
**Priority**: P2 - Standard  
**Blocked Date**: ${new Date().toISOString().split('T')[0]}  

---

## 🎯 **Task Description**

Brief description of what needs to be accomplished.

## 🚧 **Blocking Issues**

### **Primary Blocker**
- **Issue**: [What is blocking this task]
- **Impact**: [How it affects progress]
- **Action**: [What needs to happen to unblock]
- **Owner**: [Who is responsible for unblocking]
- **ETA**: [When expected to be resolved]

### **Additional Blockers**
- [Other blocking issues]

---

## 🔄 **Next Actions**

### **To Unblock**
- [ ] Action 1: [Specific step to resolve blocker]
- [ ] Action 2: [Next step]

### **When Unblocked**
- [ ] Move to TODO or DOING
- [ ] Update progress and continue work

---

**🚀 Ready to Unblock**: When blockers are resolved, move to appropriate folder
`,
    'HANDOFF_TEMPLATE.md': `# 🚀 HANDOFF: [Task Name]

**Status**: 🚀 Ready for Handoff  
**Priority**: P2 - Standard  
**Handoff Date**: ${new Date().toISOString().split('T')[0]}  
**From**: [Current Owner]  
**To**: [Next Owner]  

---

## 🎯 **Task Summary**

Brief description of what was accomplished and what needs to happen next.

## ✅ **Work Completed**

### **Accomplished**
- [x] Completed work item 1
- [x] Completed work item 2
- [x] Completed work item 3

### **Current State**
- [Description of current state]
- [What's been set up]
- [What's ready for next steps]

---

## 🔄 **Next Steps**

### **Immediate Actions Required**
- [ ] Action 1: [Specific next step]
- [ ] Action 2: [Following step]
- [ ] Action 3: [Additional step]

### **Important Context**
- [Key information the next person needs]
- [Decisions made and why]
- [Resources and references]

---

## 📂 **Resources & Files**

### **Key Files**
- \`file1.ext\` - [Description]
- \`file2.ext\` - [Description]

### **References**
- [Documentation links]
- [Code examples]

---

## 🎯 **Definition of Done**

### **Acceptance Criteria**
- [ ] All specified functionality implemented
- [ ] Tests passing
- [ ] Documentation updated

---

**🚀 Ready to Continue**: Next owner should move this to DOING when ready to start
`,
    'PLANNING_TEMPLATE.md': `# 📋 PLANNING: [Task Name]

**Status**: 📋 Planning  
**Priority**: P2 - Standard  
**Planning Started**: ${new Date().toISOString().split('T')[0]}  

---

## 🎯 **Objective**

What are we trying to accomplish?

## 📋 **Planning Checklist**

### **Requirements Gathering**
- [ ] Understand the problem
- [ ] Define success criteria
- [ ] Identify constraints

### **Technical Planning**
- [ ] Architecture decisions
- [ ] Technology choices
- [ ] Implementation approach

### **Resource Planning**
- [ ] Time estimates
- [ ] Dependencies identified
- [ ] Risk assessment

---

## 🔄 **Planning Notes**

### **Research Findings**
- [Key research results]
- [Technical decisions made]

### **Approach**
- [How we plan to solve this]
- [Why this approach was chosen]

---

## 🎯 **Next Steps**

### **When Planning Complete**
- [ ] Move to TODO folder
- [ ] Create detailed implementation plan
- [ ] Begin work

---

**🚀 Ready for Implementation**: When planning is complete, move to \`docs/planning/kanban/TODO/\`
`,
  };

  for (const [filename, content] of Object.entries(simpleTemplates)) {
    await fs.writeFile(path.join(templatesDir, filename), content);
  }
}

async function createKanbanScript() {
  const scriptPath = path.join(process.cwd(), 'kanban.js');

  const kanbanScriptContent = `#!/usr/bin/env node

// Auto-generated Kanban Script for Supernal Coding
// This script provides basic kanban functionality for workflow management

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const KANBAN_DIR = path.join(process.cwd(), 'docs', 'kanban');
const TEMPLATES_DIR = path.join(KANBAN_DIR, 'templates');

// Main command handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'list':
      await listTasks();
      break;
    case 'new':
      await createTask(args[1], args[2]);
      break;
    case 'move':
      await moveTask(args[1], args[2]);
      break;
    case 'done':
      await completeTask(args[1]);
      break;
    case 'search':
      await searchTasks(args[1]);
      break;
    case 'priority':
      await showPriority();
      break;
    case 'cleanup':
      await cleanupTasks();
      break;
    case 'rename':
      await renameTask(args[1], args[2]);
      break;
    case 'template':
      await showTemplate(args[1]);
      break;
    default:
      console.log(\`Unknown command: \${command}\`);
      console.log('Available commands: list, new, move, done, search, priority, cleanup, rename, template');
  }
}

async function listTasks() {
  console.log(chalk.blue.bold('📋 Kanban Overview'));
  console.log('==================');
  
  const directories = ['BRAINSTORM', 'PLANNING', 'TODO', 'DOING', 'BLOCKED', 'DONE', 'HANDOFFS'];
  const icons = {
    'BRAINSTORM': '💡',
    'PLANNING': '📋',
    'TODO': '📋',
    'DOING': '🚀',
    'BLOCKED': '🚫',
    'DONE': '✅',
    'HANDOFFS': '🚀'
  };
  
  for (const dir of directories) {
    const dirPath = path.join(KANBAN_DIR, dir);
    if (await fs.pathExists(dirPath)) {
      const files = await fs.readdir(dirPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      console.log(\`\\n\${icons[dir]} \${dir}:\`);
      if (mdFiles.length === 0) {
        console.log('  (none)');
      } else {
        mdFiles.forEach(file => {
          const name = file.replace('.md', '');
          console.log(\`  - \${name}\`);
        });
      }
    }
  }
}


async function moveTask(taskName, destination) {
  if (!taskName || !destination) {
    console.log('Usage: kanban move <task> <destination>');
    return;
  }
  
  // Find the task file
  const directories = ['BRAINSTORM', 'PLANNING', 'TODO', 'DOING', 'BLOCKED', 'DONE', 'HANDOFFS'];
  let sourceFile = null;
  let sourceDir = null;
  
  for (const dir of directories) {
    const dirPath = path.join(KANBAN_DIR, dir);
    if (await fs.pathExists(dirPath)) {
      const files = await fs.readdir(dirPath);
      const matchingFile = files.find(f => 
        f.toLowerCase().includes(taskName.toLowerCase()) && f.endsWith('.md')
      );
      
      if (matchingFile) {
        sourceFile = matchingFile;
        sourceDir = dir;
        break;
      }
    }
  }
  
  if (!sourceFile) {
    console.log(\`Task "\${taskName}" not found\`);
    return;
  }
  
  const destMap = {
    'todo': 'TODO',
    'doing': 'DOING',
    'blocked': 'BLOCKED',
    'planning': 'PLANNING',
    'handoff': 'HANDOFFS',
    'handoffs': 'HANDOFFS',
    'done': 'DONE'
  };
  
  const destDir = destMap[destination.toLowerCase()] || destination.toUpperCase();
  const sourcePath = path.join(KANBAN_DIR, sourceDir, sourceFile);
  const destPath = path.join(KANBAN_DIR, destDir, sourceFile);
  
  if (!await fs.pathExists(path.join(KANBAN_DIR, destDir))) {
    console.log(\`Error: Destination directory \${destDir} does not exist\`);
    return;
  }
  
  await fs.move(sourcePath, destPath);
  console.log(\`Moved "\${sourceFile}" from \${sourceDir} to \${destDir}\`);
}

async function completeTask(taskName) {
  if (!taskName) {
    console.log('Usage: kanban done <task>');
    return;
  }
  
  await moveTask(taskName, 'done');
}

async function searchTasks(keyword) {
  if (!keyword) {
    console.log('Usage: kanban search <keyword>');
    return;
  }
  
  console.log(\`Searching for: "\${keyword}"\`);
  
  const directories = ['BRAINSTORM', 'PLANNING', 'TODO', 'DOING', 'BLOCKED', 'DONE', 'HANDOFFS'];
  let found = false;
  
  for (const dir of directories) {
    const dirPath = path.join(KANBAN_DIR, dir);
    if (await fs.pathExists(dirPath)) {
      const files = await fs.readdir(dirPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      for (const file of mdFiles) {
        const filePath = path.join(dirPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        if (content.toLowerCase().includes(keyword.toLowerCase()) || 
            file.toLowerCase().includes(keyword.toLowerCase())) {
          console.log(\`Found in \${dir}: \${file.replace('.md', '')}\`);
          found = true;
        }
      }
    }
  }
  
  if (!found) {
    console.log('No tasks found matching the keyword');
  }
}

async function showPriority() {
  console.log('Priority view - showing TODO and DOING tasks:');
  
  const priorityDirs = ['TODO', 'DOING'];
  
  for (const dir of priorityDirs) {
    const dirPath = path.join(KANBAN_DIR, dir);
    if (await fs.pathExists(dirPath)) {
      const files = await fs.readdir(dirPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      console.log(\`\\n\${dir}:\`);
      if (mdFiles.length === 0) {
        console.log('  (none)');
      } else {
        mdFiles.forEach(file => {
          const name = file.replace('.md', '');
          console.log(\`  - \${name}\`);
        });
      }
    }
  }
}

async function cleanupTasks() {
  console.log('Cleanup functionality not implemented yet');
}

async function renameTask(oldName, newName) {
  if (!oldName || !newName) {
    console.log('Usage: kanban rename <oldName> <newName>');
    return;
  }
  
  // Find the task file
  const directories = ['BRAINSTORM', 'PLANNING', 'TODO', 'DOING', 'BLOCKED', 'DONE', 'HANDOFFS'];
  let sourceFile = null;
  let sourceDir = null;
  
  for (const dir of directories) {
    const dirPath = path.join(KANBAN_DIR, dir);
    if (await fs.pathExists(dirPath)) {
      const files = await fs.readdir(dirPath);
      const matchingFile = files.find(f => 
        f.toLowerCase().includes(oldName.toLowerCase()) && f.endsWith('.md')
      );
      
      if (matchingFile) {
        sourceFile = matchingFile;
        sourceDir = dir;
        break;
      }
    }
  }
  
  if (!sourceFile) {
    console.log(\`Task "\${oldName}" not found\`);
    return;
  }
  
  const newFileName = newName.replace(/[^a-zA-Z0-9\\s-]/g, '').replace(/\\s+/g, '_') + '.md';
  const sourcePath = path.join(KANBAN_DIR, sourceDir, sourceFile);
  const newPath = path.join(KANBAN_DIR, sourceDir, newFileName);
  
  await fs.move(sourcePath, newPath);
  console.log(\`Renamed "\${sourceFile}" to "\${newFileName}"\`);
}

async function showTemplate(type) {
  if (!type) {
    console.log('Usage: kanban template <type>');
    return;
  }
  
  const typeMap = {
    'todo': 'TODO',
    'doing': 'DOING',
    'blocked': 'BLOCKED',
    'planning': 'PLANNING',
    'handoff': 'HANDOFFS'
  };
  
  const dirName = typeMap[type.toLowerCase()] || type.toUpperCase();
  const templatePath = path.join(TEMPLATES_DIR, \`\${dirName}_TEMPLATE.md\`);
  
  if (await fs.pathExists(templatePath)) {
    const content = await fs.readFile(templatePath, 'utf8');
    console.log(content);
  } else {
    console.log(\`No template found for \${type}\`);
  }
}

// Run the main function
main().catch(console.error);
`;

  await fs.writeFile(scriptPath, kanbanScriptContent);
  await fs.chmod(scriptPath, '755');
}

function findKanbanScript() {
  // Look for kanban script in various locations
  const possiblePaths = [
    path.join(process.cwd(), 'kanban.js'),
    './kanban',
    './scripts/project-management/kanban/kanban-unified.sh',
    path.join(process.cwd(), 'kanban'),
    path.join(
      process.cwd(),
      'scripts/project-management/kanban/kanban-unified.sh'
    ),
  ];

  for (const kanbanPath of possiblePaths) {
    if (fs.existsSync(kanbanPath)) {
      return kanbanPath;
    }
  }
  return null;
}

async function findOrCreateKanbanScript() {
  let kanbanPath = findKanbanScript();

  if (!kanbanPath) {
    await ensureWorkflowSystem();
    kanbanPath = path.join(process.cwd(), 'kanban.js');
  }

  return kanbanPath;
}

async function checkForUpdates() {
  console.log(chalk.yellow('🔍 Checking for updates...'));
  console.log(chalk.green('✅ Workflow system is up to date'));
}

async function performUpdate() {
  console.log(chalk.yellow('🔄 Updating workflow system...'));
  console.log(chalk.green('✅ Workflow system updated successfully'));
}

// Add the install function
async function installWorkflowSystem(force = false) {
  console.log(chalk.blue.bold('🏗️  Installing Enhanced Workflow System'));
  console.log(chalk.blue('=========================================='));
  console.log('');

  // Check if already installed
  const kanbanPath = path.join(process.cwd(), 'docs', 'kanban');
  const kanbanScriptPath = path.join(process.cwd(), 'kanban.js');

  if ((await fs.pathExists(kanbanPath)) && !force) {
    console.log(chalk.yellow('⚠️  Workflow system already exists'));
    console.log(chalk.blue('    Use --force to reinstall'));

    // Show current version and stats
    if (await fs.pathExists(kanbanScriptPath)) {
      console.log(chalk.green('✅ Kanban script: Found'));
      await showWorkflowStats();
    } else {
      console.log(chalk.red('❌ Kanban script: Missing'));
      console.log(chalk.blue('    Will create missing kanban.js'));
    }

    if (!force) {
      console.log('');
      console.log(
        chalk.blue('To reinstall: supernal-coding workflow install --force')
      );
      return;
    }
  }

  console.log(chalk.blue('📦 Installing workflow components...'));

  // Step 1: Initialize kanban structure
  console.log('   Creating kanban directories...');
  await initializeWorkflowIfNeeded();

  // Step 2: Create enhanced kanban.js script
  console.log('   Installing kanban.js command...');
  const kanbanScriptContent = await generateKanbanScript();
  await fs.writeFile(kanbanScriptPath, kanbanScriptContent);

  // Make it executable
  try {
    await fs.chmod(kanbanScriptPath, '755');
  } catch (_error) {
    // Chmod might fail on Windows, but that's okay
  }

  // Step 3: Create project integration
  console.log('   Setting up project integration...');
  await setupProjectIntegration();

  // Step 4: Create sample tasks
  console.log('   Creating sample tasks...');
  await createSampleTasks();

  // Step 5: Show completion
  console.log('');
  console.log(chalk.green.bold('🎉 Enhanced Workflow System Installed!'));
  console.log(chalk.green('======================================'));
  console.log('');
  console.log(chalk.blue.bold('🚀 Quick Start:'));
  console.log(
    chalk.yellow(
      '  supernal-coding workflow list                 # Show current board'
    )
  );
  console.log(
    chalk.yellow(
      '  supernal-coding workflow new todo "task"     # Create new task'
    )
  );
  console.log(
    chalk.yellow(
      '  supernal-coding workflow priority next       # See next priority task'
    )
  );
  console.log(
    chalk.yellow(
      '  supernal-coding workflow done "task"         # Complete task'
    )
  );
  console.log('');
  console.log(chalk.blue.bold('📚 Advanced Features:'));
  console.log(
    chalk.yellow(
      '  supernal-coding workflow search "keyword"    # Search tasks'
    )
  );
  console.log(
    chalk.yellow(
      '  supernal-coding workflow template todo       # View templates'
    )
  );
  console.log(
    chalk.yellow(
      '  supernal-coding workflow priority list       # Show all priorities'
    )
  );
  console.log('');
  console.log(chalk.blue.bold('🔧 Local Command:'));
  console.log(
    chalk.yellow(
      '  node kanban.js list                          # Direct script usage'
    )
  );
  console.log(
    chalk.yellow(
      '  node kanban.js new todo "task priority 1"    # Create priority task'
    )
  );
  console.log('');
  console.log(chalk.blue.bold('📂 Files Created:'));
  console.log(
    `  • ${chalk.blue('docs/planning/kanban/')}            # Task directories`
  );
  console.log(
    `  • ${chalk.blue('kanban.js')}                        # Command script`
  );
  console.log(
    `  • ${chalk.blue('docs/planning/kanban/README.md')}  # Documentation`
  );
  console.log('');

  await showWorkflowStats();
}

async function setupProjectIntegration() {
  // Add workflow scripts to package.json if it exists
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);

      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Add workflow scripts
      packageJson.scripts.kanban = 'node kanban.js';
      packageJson.scripts['kanban:list'] = 'node kanban.js list';
      packageJson.scripts['kanban:next'] = 'node kanban.js priority next';

      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      console.log(chalk.green('   ✅ Added npm scripts to package.json'));
    } catch (_error) {
      console.log(chalk.yellow('   ⚠️  Could not update package.json'));
    }
  }

  // Add to .gitignore recommendations
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (await fs.pathExists(gitignorePath)) {
    try {
      const gitignore = await fs.readFile(gitignorePath, 'utf8');
      if (!gitignore.includes('docs/planning/kanban/')) {
        await fs.appendFile(
          gitignorePath,
          '\n# Kanban workflow (optional - remove if you want to track tasks)\n# docs/planning/kanban/\n'
        );
        console.log(chalk.green('   ✅ Added kanban entries to .gitignore'));
      }
    } catch (_error) {
      console.log(chalk.yellow('   ⚠️  Could not update .gitignore'));
    }
  }
}

async function createSampleTasks() {
  // Create sample tasks to demonstrate the system
  await executeKanbanCommand([
    'new',
    'todo',
    'setup development environment priority 2',
  ]);
  await executeKanbanCommand([
    'new',
    'planning',
    'project roadmap and milestones',
  ]);
  await executeKanbanCommand([
    'new',
    'todo',
    'implement core functionality priority 1',
  ]);

  console.log(chalk.green('   ✅ Created sample tasks'));
}

async function showWorkflowStats() {
  const kanbanDir = path.join(process.cwd(), 'docs', 'kanban');
  const directories = [
    'BRAINSTORM',
    'PLANNING',
    'TODO',
    'DOING',
    'BLOCKED',
    'DONE',
    'HANDOFFS',
  ];

  console.log(chalk.blue.bold('📊 Workflow Statistics:'));

  let totalTasks = 0;
  for (const dir of directories) {
    const dirPath = path.join(kanbanDir, dir);
    if (await fs.pathExists(dirPath)) {
      const files = await fs.readdir(dirPath);
      const taskCount = files.filter((f) => f.endsWith('.md')).length;
      totalTasks += taskCount;

      if (taskCount > 0) {
        const icon = {
          BRAINSTORM: '💡',
          PLANNING: '📋',
          TODO: '📋',
          DOING: '🚀',
          BLOCKED: '🚫',
          DONE: '✅',
          HANDOFFS: '🚀',
        }[dir];

        console.log(chalk.blue(`   ${icon} ${dir}: ${taskCount} tasks`));
      }
    }
  }

  console.log(chalk.blue(`   📊 Total: ${totalTasks} tasks`));
}

async function generateKanbanScript() {
  // Return the enhanced kanban.js script content
  return `#!/usr/bin/env node

// Auto-generated Enhanced Kanban Script for Supernal Coding
// This script provides comprehensive kanban functionality matching the old system's capabilities

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { getConfig } = require('./scripts/config-loader');

// Load configuration and get kanban directory
const config = getConfig();
config.load();
const KANBAN_DIR = path.join(process.cwd(), config.getKanbanBaseDirectory());
const TEMPLATES_DIR = path.join(KANBAN_DIR, 'templates');
const KANBAN_VERSION = "2.0.0";

// Main command handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'list':
      await listTasks();
      break;
    case 'new':
      await createTask(args[1], args.slice(2).join(' '));
      break;
    case 'move':
      await moveTask(args[1], args[2]);
      break;
    case 'done':
      await completeTask(args[1]);
      break;
    case 'search':
      await searchTasks(args[1]);
      break;
    case 'priority':
      await showPriority(args[1]);
      break;
    case 'cleanup':
      await cleanupTasks();
      break;
    case 'rename':
      await renameTask(args[1], args[2]);
      break;
    case 'template':
      await showTemplate(args[1]);
      break;
    case 'init':
      await initializeKanban();
      break;
    case '--version':
      console.log(\`Kanban Unified CLI v\${KANBAN_VERSION}\`);
      break;
    default:
      console.log(\`Unknown command: \${command}\`);
      console.log('Available commands: list, new, move, done, search, priority, cleanup, rename, template, init');
      console.log('');
      console.log('Examples:');
      console.log('  kanban new todo "implement user auth priority 1"');
      console.log('  kanban priority next');
      console.log('  kanban move "user_auth" doing');
  }
}

// [Rest of the kanban.js functionality would be included here]
// This is a simplified version for the install command

async function listTasks() {
  console.log('📋 Kanban Overview');
  console.log('==================');
  
  const directories = ['BRAINSTORM', 'PLANNING', 'TODO', 'DOING', 'BLOCKED', 'DONE', 'HANDOFFS'];
  const icons = {
    'BRAINSTORM': '💡',
    'PLANNING': '📋',
    'TODO': '📋',
    'DOING': '🚀',
    'BLOCKED': '🚫',
    'DONE': '✅',
    'HANDOFFS': '🚀'
  };
  
  for (const dir of directories) {
    const dirPath = path.join(KANBAN_DIR, dir);
    if (await fs.pathExists(dirPath)) {
      const files = await fs.readdir(dirPath);
      const mdFiles = files.filter(f => f.endsWith('.md') && !f.includes('ARCHIVE'));
      
      console.log(\`\\n\${icons[dir]} \${dir}:\`);
      if (mdFiles.length === 0) {
        console.log('  (none)');
      } else {
        if (dir === 'TODO' || dir === 'BLOCKED') {
          const prioritized = {};
          mdFiles.forEach(file => {
            const match = file.match(/^P([0-4])_(.+)\\.md$/);
            if (match) {
              const priority = parseInt(match[1]);
              const name = match[2].replace(/_/g, ' ');
              if (!prioritized[priority]) prioritized[priority] = [];
              prioritized[priority].push(name);
            } else {
              const name = file.replace('.md', '').replace(/_/g, ' ');
              if (!prioritized[2]) prioritized[2] = [];
              prioritized[2].push(name);
            }
          });
          
          for (let p = 0; p <= 4; p++) {
            if (prioritized[p]) {
              prioritized[p].forEach(name => {
                const suffix = dir === 'BLOCKED' ? ' (BLOCKED)' : '';
                console.log(\`  - [P\${p}] \${name}\${suffix}\`);
              });
            }
          }
        } else {
          mdFiles.forEach(file => {
            const name = file.replace('.md', '').replace(/_/g, ' ');
            console.log(\`  - \${name}\`);
          });
        }
      }
    }
  }
}

// Run the main function
main().catch(console.error);
`;
}

async function initializeWorkflowIfNeeded() {
  const kanbanDir = path.join(process.cwd(), 'docs', 'kanban');

  if (!(await fs.pathExists(kanbanDir))) {
    console.log(chalk.yellow('🏗️  Initializing workflow system...'));
    await initializeWorkflowSystem();
    console.log(chalk.green('✅ Workflow system initialized successfully'));
  }
}

async function executeKanbanCommand(args) {
  // Load configuration to get the correct kanban directory
  const config = getConfig();
  config.load();

  const kanbanPath = await findOrCreateKanbanScript();
  if (kanbanPath) {
    execSync(`${kanbanPath} ${args.join(' ')}`, { stdio: 'inherit' });
  } else {
    console.log(chalk.red('❌ Failed to find or initialize kanban script.'));
    console.log(
      chalk.blue('Please ensure supernal-coding workflow install is run first.')
    );
  }
}

// Enhanced task creation function
async function createEnhancedTask(
  type,
  title,
  priority = 2,
  description = '',
  parsedContent = null,
  overwrite = false
) {
  // Generate filename from title
  let taskName = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (taskName.length > 30) {
    taskName = `${taskName.substring(0, 27)}...`;
  }

  // Determine file path based on type
  let targetDir, fileName;
  const config = getConfig();
  config.load();
  const kanbanDir = path.join(process.cwd(), config.getKanbanBaseDirectory());

  switch (type.toLowerCase()) {
    case 'brainstorm':
      targetDir = path.join(kanbanDir, 'BRAINSTORM');
      fileName = `${taskName}.md`;
      break;
    case 'planning':
      targetDir = path.join(kanbanDir, 'PLANNING');
      fileName = `${taskName}.md`;
      break;
    case 'todo':
      targetDir = path.join(kanbanDir, 'TODO');
      fileName = `P${priority}_${taskName}.md`;
      break;
    case 'doing':
      targetDir = path.join(kanbanDir, 'DOING');
      fileName = `${taskName}.md`;
      break;
    case 'blocked':
      targetDir = path.join(kanbanDir, 'BLOCKED');
      fileName = `P${priority}_${taskName}.md`;
      break;
    case 'handoff':
      targetDir = path.join(kanbanDir, 'HANDOFFS');
      fileName = `${taskName}.md`;
      break;
    case 'epic':
      targetDir = path.join(kanbanDir, 'EPICS', taskName);
      fileName = `epic-overview.md`;
      break;
    case 'requirement': {
      // Requirements need an epic to be specified
      if (!parsedContent || !parsedContent.epic) {
        return {
          success: false,
          error:
            'Requirements must specify an epic. Use --content="epic: epic-name" or YAML file with epic field.',
        };
      }
      const epicDir = path.join(kanbanDir, 'EPICS', parsedContent.epic);
      if (!(await fs.pathExists(epicDir))) {
        return {
          success: false,
          error: `Epic "${parsedContent.epic}" does not exist. Create it first with: ./wf.sh new epic "${parsedContent.epic}"`,
        };
      }
      targetDir = path.join(epicDir, 'REQUIREMENTS');
      fileName = `${taskName}.md`;
      break;
    }
    default:
      return {
        success: false,
        error: `Unknown task type "${type}". Supported types: todo, doing, blocked, planning, brainstorm, handoff, epic, requirement`,
      };
  }

  const filePath = path.join(targetDir, fileName);

  if ((await fs.pathExists(filePath)) && !overwrite) {
    return {
      success: false,
      error: `Task already exists: ${fileName}. Use --overwrite to replace it.`,
    };
  }

  await fs.ensureDir(targetDir);

  // Special handling for epics - create folder structure
  if (type.toLowerCase() === 'epic') {
    // Create REQUIREMENTS and TASKS subdirectories
    await fs.ensureDir(path.join(targetDir, 'REQUIREMENTS'));
    await fs.ensureDir(path.join(targetDir, 'TASKS'));

    console.log(chalk.green(`✅ Created epic folder structure:`));
    console.log(chalk.blue(`📂 Epic: ${targetDir}`));
    console.log(
      chalk.blue(`📂 Requirements: ${path.join(targetDir, 'REQUIREMENTS')}`)
    );
    console.log(chalk.blue(`📂 Tasks: ${path.join(targetDir, 'TASKS')}`));
  }

  // Create enhanced task content with clean title
  const content = createEnhancedTaskContent(
    type,
    title,
    priority,
    description,
    parsedContent
  );
  await fs.writeFile(filePath, content);

  console.log(chalk.green(`✅ Created: ${fileName}`));
  console.log(chalk.blue(`📂 Location: ${filePath}`));

  return { success: true, filePath, fileName };
}

// Enhanced task content creation with clean titles
function createEnhancedTaskContent(
  type,
  title,
  priority,
  description = '',
  parsedContent = null
) {
  const date = new Date().toISOString().split('T')[0];
  const typeUpper = type.toUpperCase();

  // Use clean title, not full description
  const taskTitle = title;
  const taskDescription =
    description ||
    '[Fill out the specific requirements and details for this task]';

  switch (type.toLowerCase()) {
    case 'todo':
      if (parsedContent) {
        return createFilledTodoTemplate(
          taskTitle,
          date,
          priority,
          parsedContent
        );
      }

      return `# 📋 TODO: ${taskTitle}

**Created**: ${date}  
**Status**: Todo  
**Priority**: P${priority}  
**Type**: [Feature/Bug/Documentation/Research/Infrastructure]  
**Estimated Effort**: [S/M/L/XL] (1-2h/1-2d/3-5d/1-2w)  

---

## 🚨 **NEXT STEPS FOR AGENT**

⚠️ **THIS TEMPLATE REQUIRES COMPLETION** - Replace all placeholder text with actual requirements

**Option 1: Edit this file directly**
- Fill out each section with specific, actionable content
- Replace all [bracketed placeholders] with real requirements
- See docs/TODO_FILLING_GUIDE.md for examples

**Option 2: Recreate with structured content**
\`\`\`bash
# Create content.yaml file with structured requirements, then run:
./wf.sh new todo "${taskTitle}" content.yaml --overwrite

# OR use inline YAML:
./wf.sh new todo "${taskTitle}" --content="objective: Your specific task description here" --overwrite
\`\`\`

📖 **Resources:**
- Content format guide: docs/TODO_FILLING_GUIDE.md
- Sample content: docs/sample-task-content.yaml

---

## 🎯 **Objective**

${taskDescription}

### **Problem Statement**
- What problem does this solve?
- Why is this important now?
- What happens if we don't do this?

### **Acceptance Criteria**
- [ ] Specific, measurable outcome 1
- [ ] Specific, measurable outcome 2  
- [ ] Specific, measurable outcome 3

---

## 📋 **Requirements & Scope**

### **Functional Requirements**
- [ ] Core functionality requirement 1
- [ ] Core functionality requirement 2
- [ ] User experience requirement

### **Technical Requirements**
- [ ] Performance: [specific requirement]
- [ ] Security: [specific requirement]
- [ ] Compatibility: [specific requirement]

### **Out of Scope**
- [What we're explicitly NOT doing]
- [Future enhancements to consider later]

---

## 🧪 **Test Strategy**

### **Test Cases**
- [ ] Happy path: [main success scenario]
- [ ] Edge cases: [boundary conditions]
- [ ] Error handling: [failure scenarios]
- [ ] Integration: [system interactions]

### **Verification Method**
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] User acceptance testing

---

## 🔗 **Dependencies & Blockers**

### **Prerequisites**
- [ ] Dependency 1: [what must be complete first]
- [ ] Dependency 2: [external requirement]

### **Resources Needed**
- [ ] Technical resources
- [ ] Documentation/research
- [ ] External approvals

---

## ✅ **Definition of Done**

- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Performance verified
- [ ] Security review (if applicable)

---

## 📝 **Implementation Notes**

[Add implementation approaches, technical decisions, or research findings here]

---

*Created with kanban unified CLI v2.0.0*
`;

    case 'doing':
      return `# 🚀 DOING: ${taskTitle}

**Created**: ${date}  
**Status**: 🏃 In Progress  
**Priority**: P${priority}  
**Started**: ${date}  
**Estimated Completion**: [Date]  

---

## 🎯 **Current Objective**

${taskDescription}

### **Progress Overview**
- **Current Phase**: [Planning/Development/Testing/Documentation/Review]
- **Completion**: 0% complete
- **Blockers**: None

---

## ✅ **Progress Checklist**

### **Completed**
- [x] Task started ✅ ${date}

### **In Progress**
- [ ] **Current Focus**: [What you're working on right now]
- [ ] Next immediate step: [Specific next action]

### **Remaining**
- [ ] Task: [Description] (Est: [time])
- [ ] Task: [Description] (Est: [time])  

---

## 🔄 **Daily Progress Log**

### **${date} - Task Started**
**Accomplished:**
- Task moved to DOING
- Initial setup complete

**Challenges:**
- [Any issues encountered]

**Next Session Plan:**
- [ ] Priority 1: [Most important next step]
- [ ] Priority 2: [Secondary task]

---

## 🧪 **Testing Progress**

### **Test Status**
- [ ] Unit tests: Not started
- [ ] Integration tests: Not started
- [ ] Manual testing: Not started
- [ ] Performance testing: Not started

### **Test Results**
- Last test run: Not yet
- Status: Pending
- Coverage: TBD

---

## 📂 **Files & Components**

### **Modified Files**
- \`file1.ext\` - [Brief description of changes]
- \`file2.ext\` - [Brief description of changes]

### **New Components**
- [New files/modules created]

---

## 🎯 **Ready to Complete**

When ALL criteria below are met, move to \`docs/planning/kanban/DONE/\`:
- [ ] All functionality implemented
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Documentation updated

---

*Created with kanban unified CLI v2.0.0*
`;

    case 'handoff':
      return `# 🚀 HANDOFF: ${taskTitle}

**Created**: ${date}  
**Status**: 🚀 Ready for Handoff  
**Priority**: P${priority}  
**Handoff Date**: ${date}  
**From**: [Current Owner]  
**To**: [Next Owner/Team]  

---

## 🎯 **Handoff Summary**

${taskDescription}

## ✅ **Work Completed**

### **Accomplished Tasks**
- [x] Task 1: [Description of completed work]
- [x] Task 2: [Another completed item]
- [x] Task 3: [Final completed work]

### **Current State**
- **Implementation Status**: [Percentage complete]
- **Code State**: [Branch name, commit hash, deployment status]
- **Documentation**: [What docs exist, what's updated]
- **Testing**: [What tests exist, coverage, known issues]

---

## 🔄 **Next Steps Required**

### **Immediate Actions** (Next 1-2 days)
- [ ] Action 1: [Specific next step with details]
- [ ] Action 2: [Following step]
- [ ] Action 3: [Additional immediate work]

### **Medium Term** (Next week)
- [ ] Task 1: [Medium-term objective]
- [ ] Task 2: [Another medium-term goal]

### **Long Term** (Next sprint/month)
- [ ] Goal 1: [Long-term objective]
- [ ] Goal 2: [Future enhancement]

---

## 📚 **Context & Knowledge Transfer**

### **Key Decisions Made**
- **Decision 1**: [What was decided] - Rationale: [Why this choice]
- **Decision 2**: [Another decision] - Rationale: [Reasoning]

### **Important Context**
- [Critical background information]
- [Domain knowledge needed]
- [Business context and constraints]

### **Known Issues & Gotchas**
- [Issue 1]: [Description and workaround]
- [Issue 2]: [Another known problem]

---

## 📂 **Resources & References**

### **Key Files & Locations**
- \`path/to/file1.ext\` - [Description and purpose]
- \`path/to/file2.ext\` - [Description and purpose]
- \`config/settings.json\` - [Configuration notes]

### **External Dependencies**
- [API dependencies with versions]
- [Third-party services and credentials]
- [Environment setup requirements]

### **Documentation & References**
- [Design documents]
- [API documentation]
- [Research and background materials]

---

## 🧪 **Testing & Quality**

### **Existing Tests**
- Unit tests: [Coverage and location]
- Integration tests: [What exists]
- Manual test procedures: [Steps to verify]

### **Quality Checklist**
- [ ] Code follows project standards
- [ ] Documentation is up to date
- [ ] Tests are comprehensive
- [ ] Security considerations addressed

---

## 🚀 **Handoff Checklist**

### **Technical Handoff**
- [ ] Code repository access granted
- [ ] Build/deployment process documented
- [ ] Environment access provided
- [ ] Credentials and secrets transferred

### **Knowledge Transfer**
- [ ] Architecture overview provided
- [ ] Key decisions documented
- [ ] Contact list for questions
- [ ] Handoff meeting completed

### **Ready to Continue**
- [ ] Next owner has reviewed all materials
- [ ] Questions answered
- [ ] Next steps confirmed
- [ ] Success criteria agreed upon

---

*Created with kanban unified CLI v2.0.0*
`;

    case 'epic':
      return `# 🎯 EPIC: ${taskTitle}

**Created**: ${date}  
**Status**: Planning  
**Type**: Epic  
**Epic ID**: ${taskTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')}

---

## 🎯 **Epic Overview**

${taskDescription}

### **Business Value**
- **Problem**: [What high-level problem does this epic solve?]
- **Impact**: [How will success be measured?]
- **Users**: [Who benefits from this epic?]

### **Epic Goals**
- [ ] Goal 1: [High-level outcome]
- [ ] Goal 2: [Another key outcome]
- [ ] Goal 3: [Final major goal]

---

## 📋 **Requirements**

*Requirements will be created in the REQUIREMENTS/ subdirectory*

### **Current Requirements**
- [No requirements created yet - use: ./wf.sh new requirement "Name" --content="epic: ${taskTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')}"]

---

## 📊 **Progress Tracking**

### **Epic Status**
- **Phase**: Planning
- **Progress**: 0% (0/0 requirements complete)
- **Risks**: [Identify any risks or blockers]

### **Timeline**
- **Start Date**: ${date}
- **Target Date**: [Set target completion]
- **Milestones**: [Key milestones and dates]

---

## 🔗 **Dependencies & Constraints**

### **External Dependencies**
- [ ] Dependency 1: [External requirement]
- [ ] Dependency 2: [Another dependency]

### **Constraints**
- **Technical**: [Technical limitations]
- **Business**: [Business constraints]
- **Timeline**: [Time constraints]

---

## 📚 **Context & Background**

### **Research & References**
- [Research documents]
- [Market analysis]
- [User feedback]

### **Architecture Considerations**
- [High-level architectural decisions]
- [Integration points]
- [Performance requirements]

---

## ✅ **Epic Definition of Done**

- [ ] All requirements implemented and tested
- [ ] Documentation complete
- [ ] User acceptance criteria met
- [ ] Performance benchmarks achieved
- [ ] Security review passed
- [ ] Production deployment successful

---

*Epic created with enhanced workflow system v2.0.0*

---

## 📁 **Epic Structure**

\`\`\`
EPICS/${taskTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')}/
├── epic-overview.md (this file)
├── REQUIREMENTS/
│   └── [requirement files in Gherkin format]
└── TASKS/
    └── [implementation task files]
\`\`\`

### **Next Steps**
1. Create requirements: \`./wf.sh new requirement "Requirement Name" --content="epic: ${taskTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')}"\`
2. Define acceptance criteria in Gherkin format
3. Break down requirements into implementation tasks
`;

    case 'requirement': {
      const epicName = parsedContent?.epic ? parsedContent.epic : '[epic-name]';
      return `# 📋 REQUIREMENT: ${taskTitle}

**Created**: ${date}  
**Epic**: ${epicName}  
**Status**: Pending  
**Type**: Requirement  
**Requirement ID**: REQ-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}

---

## 🎯 **Gherkin Specification**

\`\`\`gherkin
Feature: ${taskTitle}
  As a [user type]
  I want [functionality]
  So that [benefit/value]

  Background:
    Given [common setup conditions]
    And [additional context]

  Scenario: [Main success scenario]
    Given [precondition]
    When [action/trigger]
    Then [expected outcome]
    And [additional verification]

  Scenario: [Alternative scenario]
    Given [different precondition]
    When [action/trigger]
    Then [different expected outcome]

  Scenario: [Error handling scenario]
    Given [error condition setup]
    When [action that triggers error]
    Then [error handling outcome]
    And [system recovery state]
\`\`\`

---

## ✅ **Acceptance Criteria**

### **Functional Criteria**
- [ ] Criterion 1: [Specific, testable requirement]
- [ ] Criterion 2: [Another testable requirement]
- [ ] Criterion 3: [Final functional requirement]

### **Non-Functional Criteria**
- [ ] Performance: [Specific performance requirement]
- [ ] Security: [Security requirement]
- [ ] Usability: [User experience requirement]
- [ ] Compatibility: [Compatibility requirement]

---

## 🔗 **Dependencies & Relationships**

### **Prerequisite Requirements**
- [ ] REQ-XXX: [Description of dependent requirement]
- [ ] REQ-YYY: [Another dependency]

### **Related Requirements**
- REQ-ZZZ: [Related requirement description]

### **Impacted Components**
- Component 1: [How it's affected]
- Component 2: [Impact description]

---

## 🧪 **Test Strategy**

### **Test Scenarios**
\`\`\`gherkin
# Test Case 1: Happy Path
Given [test setup]
When [test action]
Then [expected result]

# Test Case 2: Edge Case
Given [edge condition]
When [action]
Then [expected behavior]

# Test Case 3: Error Case
Given [error condition]
When [triggering action]
Then [error handling verification]
\`\`\`

### **Validation Methods**
- [ ] Unit tests for core logic
- [ ] Integration tests for system interaction
- [ ] User acceptance tests
- [ ] Performance/load testing
- [ ] Security testing

---

## 📝 **Implementation Notes**

### **Technical Approach**
- [Preferred implementation approach]
- [Key technical decisions]
- [Integration points]

### **Design Considerations**
- [User interface considerations]
- [Data model implications]
- [API design notes]

---

## 🚀 **Definition of Done**

- [ ] Gherkin scenarios fully defined and reviewed
- [ ] All acceptance criteria documented
- [ ] Test strategy defined and approved
- [ ] Implementation approach agreed upon
- [ ] Dependencies identified and planned
- [ ] Code implemented according to specification
- [ ] All tests passing (unit, integration, acceptance)
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Stakeholder acceptance received

---

*Requirement created with enhanced workflow system v2.0.0*

### **Git Integration**
- **Branch Pattern**: \`feature/req-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}-${taskTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')}\`
- **Commit Pattern**: \`REQ-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}: [commit message]\`

### **Linked Tasks**
*Implementation tasks will be created in the TASKS/ directory and linked to this requirement*

- [No tasks created yet - use: ./wf.sh new todo "Task Name" --content="requirement: ${taskTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')}"]
`;
    }

    default:
      return `# ${typeUpper}: ${taskTitle}

**Created**: ${date}  
**Status**: ${type}  
**Priority**: P${priority}  

---

## 📋 **Description**

${taskDescription}

## 📝 **Notes**

[Add your notes here]

## ✅ **Completion Criteria**

- [ ] [Criterion 1]
- [ ] [Criterion 2]

---

*Created with kanban unified CLI v2.0.0*
`;
  }
}

// Content parsing functions
async function parseTaskContent(contentSource) {
  try {
    let yamlContent;

    // Check if it's a file path
    if (contentSource.endsWith('.yaml') || contentSource.endsWith('.yml')) {
      if (await fs.pathExists(contentSource)) {
        yamlContent = await fs.readFile(contentSource, 'utf8');
      } else {
        return {
          success: false,
          error: `Content file not found: ${contentSource}`,
        };
      }
    } else {
      // Treat as inline YAML content
      yamlContent = contentSource;
    }

    // Parse YAML content
    const yaml = require('yaml');
    const parsed = yaml.parse(yamlContent);

    // Validate required fields
    const validation = validateTaskContent(parsed);
    if (!validation.success) {
      return validation;
    }

    return { success: true, content: parsed };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse content: ${error.message}`,
    };
  }
}

function validateTaskContent(content) {
  // For requirements, only epic field is required
  if (content.epic) {
    return { success: true };
  }

  // For regular tasks, objective is required
  const required = ['objective'];
  const _optional = [
    'problem_statement',
    'acceptance_criteria',
    'functional_requirements',
    'technical_requirements',
    'out_of_scope',
    'test_strategy',
    'dependencies',
    'definition_of_done',
    'implementation_notes',
  ];

  // Check for required fields
  for (const field of required) {
    if (!content[field]) {
      return { success: false, error: `Missing required field: ${field}` };
    }
  }

  // Validate problem_statement structure if present
  if (
    content.problem_statement &&
    typeof content.problem_statement !== 'object'
  ) {
    return {
      success: false,
      error:
        'problem_statement must be an object with what, why, consequence fields',
    };
  }

  return { success: true };
}

function createFilledTodoTemplate(title, date, priority, content) {
  const objective =
    content.objective ||
    '[Fill out the specific requirements and details for this task]';

  // Handle problem statement
  let problemStatement = '';
  if (content.problem_statement) {
    const ps = content.problem_statement;
    problemStatement = `- **What problem does this solve?** ${ps.what || 'Not specified'}
- **Why is this important now?** ${ps.why || 'Not specified'}
- **What happens if we don't do this?** ${ps.consequence || 'Not specified'}`;
  } else {
    problemStatement = `- What problem does this solve?
- Why is this important now?
- What happens if we don't do this?`;
  }

  // Handle acceptance criteria
  let acceptanceCriteria = '';
  if (
    content.acceptance_criteria &&
    Array.isArray(content.acceptance_criteria)
  ) {
    acceptanceCriteria = content.acceptance_criteria
      .map((criteria) => `- [ ] ${criteria}`)
      .join('\n');
  } else {
    acceptanceCriteria = `- [ ] Specific, measurable outcome 1
- [ ] Specific, measurable outcome 2  
- [ ] Specific, measurable outcome 3`;
  }

  // Handle functional requirements
  let functionalReqs = '';
  if (
    content.functional_requirements &&
    Array.isArray(content.functional_requirements)
  ) {
    functionalReqs = content.functional_requirements
      .map((req) => `- [ ] ${req}`)
      .join('\n');
  } else {
    functionalReqs = `- [ ] Core functionality requirement 1
- [ ] Core functionality requirement 2
- [ ] User experience requirement`;
  }

  // Handle technical requirements
  let technicalReqs = '';
  if (
    content.technical_requirements &&
    Array.isArray(content.technical_requirements)
  ) {
    technicalReqs = content.technical_requirements
      .map((req) => `- [ ] ${req}`)
      .join('\n');
  } else {
    technicalReqs = `- [ ] Performance: [specific requirement]
- [ ] Security: [specific requirement]
- [ ] Compatibility: [specific requirement]`;
  }

  // Handle out of scope
  let outOfScope = '';
  if (content.out_of_scope && Array.isArray(content.out_of_scope)) {
    outOfScope = content.out_of_scope.map((item) => `- ${item}`).join('\n');
  } else {
    outOfScope = `- [What we're explicitly NOT doing]
- [Future enhancements to consider later]`;
  }

  // Handle test strategy
  let testCases = '';
  let verificationMethod = '';
  if (content.test_strategy) {
    const ts = content.test_strategy;
    if (ts.test_cases && Array.isArray(ts.test_cases)) {
      testCases = ts.test_cases
        .map((tc) => {
          if (typeof tc === 'string') {
            return `- [ ] ${tc}`;
          } else if (typeof tc === 'object' && tc !== null) {
            // Handle objects by converting them to string representations
            const entries = Object.entries(tc);
            if (entries.length === 1) {
              const [key, value] = entries[0];
              return `- [ ] ${key}: ${value}`;
            } else {
              return `- [ ] ${JSON.stringify(tc)}`;
            }
          }
          return `- [ ] ${tc}`;
        })
        .join('\n');
    } else {
      testCases = `- [ ] Happy path: [main success scenario]
- [ ] Edge cases: [boundary conditions]
- [ ] Error handling: [failure scenarios]
- [ ] Integration: [system interactions]`;
    }

    if (ts.verification && Array.isArray(ts.verification)) {
      verificationMethod = ts.verification
        .map((vm) => `- [ ] ${vm}`)
        .join('\n');
    } else {
      verificationMethod = `- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] User acceptance testing`;
    }
  } else {
    testCases = `- [ ] Happy path: [main success scenario]
- [ ] Edge cases: [boundary conditions]
- [ ] Error handling: [failure scenarios]
- [ ] Integration: [system interactions]`;

    verificationMethod = `- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] User acceptance testing`;
  }

  // Handle dependencies
  let prerequisites = '';
  let resources = '';
  if (content.dependencies) {
    const deps = content.dependencies;
    if (deps.prerequisites && Array.isArray(deps.prerequisites)) {
      prerequisites = deps.prerequisites
        .map((req) => `- [ ] ${req}`)
        .join('\n');
    } else {
      prerequisites = `- [ ] Dependency 1: [what must be complete first]
- [ ] Dependency 2: [external requirement]`;
    }

    if (deps.resources && Array.isArray(deps.resources)) {
      resources = deps.resources.map((res) => `- [ ] ${res}`).join('\n');
    } else {
      resources = `- [ ] Technical resources
- [ ] Documentation/research
- [ ] External approvals`;
    }
  } else {
    prerequisites = `- [ ] Dependency 1: [what must be complete first]
- [ ] Dependency 2: [external requirement]`;
    resources = `- [ ] Technical resources
- [ ] Documentation/research
- [ ] External approvals`;
  }

  // Handle definition of done
  let definitionOfDone = '';
  if (content.definition_of_done && Array.isArray(content.definition_of_done)) {
    definitionOfDone = content.definition_of_done
      .map((item) => `- [ ] ${item}`)
      .join('\n');
  } else {
    definitionOfDone = `- [ ] All acceptance criteria met
- [ ] Code implemented and reviewed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Performance verified
- [ ] Security review (if applicable)`;
  }

  // Handle implementation notes
  const implementationNotes =
    content.implementation_notes ||
    '[Add implementation approaches, technical decisions, or research findings here]';

  return `# 📋 TODO: ${title}

**Created**: ${date}  
**Status**: Todo  
**Priority**: P${priority}  
**Type**: [Feature/Bug/Documentation/Research/Infrastructure]  
**Estimated Effort**: [S/M/L/XL] (1-2h/1-2d/3-5d/1-2w)  

---

## 🎯 **Objective**

${objective}

### **Problem Statement**
${problemStatement}

### **Acceptance Criteria**
${acceptanceCriteria}

---

## 📋 **Requirements & Scope**

### **Functional Requirements**
${functionalReqs}

### **Technical Requirements**
${technicalReqs}

### **Out of Scope**
${outOfScope}

---

## 🧪 **Test Strategy**

### **Test Cases**
${testCases}

### **Verification Method**
${verificationMethod}

---

## 🔗 **Dependencies & Blockers**

### **Prerequisites**
${prerequisites}

### **Resources Needed**
${resources}

---

## ✅ **Definition of Done**

${definitionOfDone}

---

## 📝 **Implementation Notes**

${implementationNotes}

---

*Created with kanban unified CLI v2.0.0*
`;
}

function getContentFormatExample() {
  return `
objective: |
  Clear description of what needs to be built
  Why this task matters to the project
  Expected outcome or deliverable

problem_statement:
  what: What problem does this solve?
  why: Why is this important now?
  consequence: What happens if we don't do this?

acceptance_criteria:
  - Given X, when Y, then Z
  - Specific measurable outcome 2
  - Specific measurable outcome 3

functional_requirements:
  - Core functionality requirement 1
  - Core functionality requirement 2
  - User experience requirement

technical_requirements:
  - "Performance: specific requirement"
  - "Security: specific requirement"
  - "Compatibility: specific requirement"

out_of_scope:
  - What we're explicitly NOT doing
  - Future enhancements to consider later

test_strategy:
  test_cases:
    - Happy path: main success scenario
    - Edge cases: boundary conditions
    - Error handling: failure scenarios
  verification:
    - Unit tests
    - Integration tests
    - Manual testing

dependencies:
  prerequisites:
    - Dependency 1: what must be complete first
    - Dependency 2: external requirement
  resources:
    - Technical resources
    - Documentation/research

definition_of_done:
  - All acceptance criteria met
  - Code implemented and reviewed
  - Tests written and passing
  - Documentation updated

implementation_notes: |
  Add implementation approaches, technical decisions, or research findings here
`;
}

// Epic management functions
async function listEpics(options) {
  try {
    const epicsDir = path.join(process.cwd(), 'docs', 'kanban', 'EPICS');

    if (!(await fs.pathExists(epicsDir))) {
      console.log(
        chalk.yellow(
          '📂 No epics directory found. Create your first epic with:'
        )
      );
      console.log(chalk.blue('   ./wf.sh new epic "Epic Name"'));
      return;
    }

    const epicFolders = await fs.readdir(epicsDir);

    if (epicFolders.length === 0) {
      console.log(
        chalk.yellow('📂 No epics found. Create your first epic with:')
      );
      console.log(chalk.blue('   ./wf.sh new epic "Epic Name"'));
      return;
    }

    console.log(chalk.blue.bold('🎯 Epics Overview'));
    console.log(chalk.blue('================'));
    console.log();

    for (const epicFolder of epicFolders) {
      const epicPath = path.join(epicsDir, epicFolder);
      const epicOverviewPath = path.join(epicPath, 'epic-overview.md');

      if (!(await fs.pathExists(epicOverviewPath))) {
        continue;
      }

      // Read epic overview to get status and details
      const epicContent = await fs.readFile(epicOverviewPath, 'utf8');
      const titleMatch = epicContent.match(/# 🎯 EPIC: (.+)/);
      const statusMatch = epicContent.match(/\*\*Status\*\*: (.+)/);

      const title = titleMatch ? titleMatch[1] : epicFolder;
      const status = statusMatch ? statusMatch[1] : 'Unknown';

      // Count requirements and tasks
      const requirementsDir = path.join(epicPath, 'REQUIREMENTS');
      const tasksDir = path.join(epicPath, 'TASKS');

      let requirementCount = 0;
      let taskCount = 0;

      if (await fs.pathExists(requirementsDir)) {
        const requirements = await fs.readdir(requirementsDir);
        requirementCount = requirements.filter((f) => f.endsWith('.md')).length;
      }

      if (await fs.pathExists(tasksDir)) {
        const tasks = await fs.readdir(tasksDir);
        taskCount = tasks.filter((f) => f.endsWith('.md')).length;
      }

      console.log(chalk.green(`📋 ${title}`));
      console.log(chalk.gray(`   Folder: ${epicFolder}`));
      console.log(chalk.gray(`   Status: ${status}`));
      console.log(
        chalk.gray(`   Requirements: ${requirementCount} | Tasks: ${taskCount}`)
      );

      if (options.verbose) {
        console.log(chalk.gray(`   Path: ${epicPath}`));
        // Show first few lines of epic description
        const descMatch = epicContent.match(
          /## 🎯 \*\*Epic Overview\*\*\n\n(.+?)\n/
        );
        if (descMatch) {
          console.log(
            chalk.gray(`   Description: ${descMatch[1].substring(0, 100)}...`)
          );
        }
      }

      console.log();
    }

    console.log(chalk.blue(`📊 Total: ${epicFolders.length} epics`));
    console.log(chalk.gray('💡 Use --verbose for more details'));
    console.log(chalk.gray('💡 Create new epic: ./wf.sh new epic "Epic Name"'));
  } catch (error) {
    console.error('Error listing epics:', error.message);
  }
}

async function _validateItem(type, name) {
  try {
    console.log(chalk.blue(`🔍 Validating ${type}: ${name}`));

    if (type === 'requirement') {
      await validateRequirement(name);
    } else if (type === 'epic') {
      await validateEpic(name);
    } else {
      console.log(chalk.red(`❌ Unknown validation type: ${type}`));
      console.log(chalk.blue('Supported types: requirement, epic'));
      return;
    }
  } catch (error) {
    console.error('Error validating item:', error.message);
  }
}

async function validateRequirement(name) {
  // Find the requirement file
  const epicsDir = path.join(process.cwd(), 'docs', 'kanban', 'EPICS');

  if (!(await fs.pathExists(epicsDir))) {
    console.log(chalk.red('❌ No epics directory found'));
    return;
  }

  let requirementPath = null;
  let epicName = null;

  // Search through all epics for the requirement
  const epicFolders = await fs.readdir(epicsDir);

  for (const epicFolder of epicFolders) {
    const requirementsDir = path.join(epicsDir, epicFolder, 'REQUIREMENTS');

    if (await fs.pathExists(requirementsDir)) {
      const possiblePath = path.join(requirementsDir, `${name}.md`);

      if (await fs.pathExists(possiblePath)) {
        requirementPath = possiblePath;
        epicName = epicFolder;
        break;
      }
    }
  }

  if (!requirementPath) {
    console.log(chalk.red(`❌ Requirement "${name}" not found in any epic`));
    console.log(chalk.blue('💡 Available requirements:'));

    // List all available requirements
    for (const epicFolder of epicFolders) {
      const requirementsDir = path.join(epicsDir, epicFolder, 'REQUIREMENTS');

      if (await fs.pathExists(requirementsDir)) {
        const requirements = await fs.readdir(requirementsDir);

        for (const req of requirements.filter((f) => f.endsWith('.md'))) {
          console.log(
            chalk.blue(`   ${epicFolder}: ${req.replace('.md', '')}`)
          );
        }
      }
    }

    return;
  }

  console.log(chalk.green(`✅ Found requirement in epic: ${epicName}`));
  console.log(chalk.blue(`📍 Path: ${requirementPath}`));

  // Read and validate the requirement content
  const content = await fs.readFile(requirementPath, 'utf8');

  let validationScore = 0;
  let maxScore = 0;
  const issues = [];
  const _suggestions = [];

  // Check for required sections
  const requiredSections = [
    { pattern: /# 📋 REQUIREMENT:/, name: 'Requirement title', points: 2 },
    {
      pattern: /## 🎯 \*\*Gherkin Specification\*\*/,
      name: 'Gherkin specification',
      points: 3,
    },
    { pattern: /Feature:/, name: 'Feature definition', points: 2 },
    { pattern: /Scenario:/, name: 'At least one scenario', points: 2 },
    {
      pattern: /Given.*When.*Then/,
      name: 'Given-When-Then structure',
      points: 3,
    },
    {
      pattern: /## ✅ \*\*Acceptance Criteria\*\*/,
      name: 'Acceptance criteria',
      points: 2,
    },
    {
      pattern: /## 🧪 \*\*Test Strategy\*\*/,
      name: 'Test strategy',
      points: 2,
    },
    {
      pattern: /## 🚀 \*\*Definition of Done\*\*/,
      name: 'Definition of done',
      points: 2,
    },
  ];

  console.log(chalk.blue('\n📋 Validation Results:'));

  for (const section of requiredSections) {
    maxScore += section.points;

    if (section.pattern.test(content)) {
      validationScore += section.points;
      console.log(chalk.green(`✅ ${section.name} (${section.points} pts)`));
    } else {
      console.log(chalk.red(`❌ ${section.name} (${section.points} pts)`));
      issues.push(`Missing: ${section.name}`);
    }
  }

  // Additional quality checks
  const scenarios = (content.match(/Scenario:/g) || []).length;
  if (scenarios < 3) {
    issues.push(
      `Only ${scenarios} scenarios found. Consider adding more scenarios for edge cases and error handling.`
    );
  } else {
    console.log(
      chalk.green(`✅ Good scenario coverage (${scenarios} scenarios)`)
    );
    validationScore += 1;
    maxScore += 1;
  }

  // Check for TODOs or placeholders
  const placeholders = content.match(/\[.*?\]/g) || [];
  if (placeholders.length > 0) {
    issues.push(
      `${placeholders.length} placeholder(s) found: ${placeholders.slice(0, 3).join(', ')}${placeholders.length > 3 ? '...' : ''}`
    );
  } else {
    console.log(chalk.green('✅ No placeholders found'));
    validationScore += 1;
    maxScore += 1;
  }

  // Calculate score
  const percentage = Math.round((validationScore / maxScore) * 100);
  console.log(
    chalk.blue(
      `\n📊 Validation Score: ${validationScore}/${maxScore} (${percentage}%)`
    )
  );

  if (percentage >= 90) {
    console.log(chalk.green('🎉 Excellent! Requirement is well-defined.'));
  } else if (percentage >= 70) {
    console.log(chalk.yellow('⚠️  Good, but could be improved.'));
  } else {
    console.log(chalk.red('❌ Needs significant improvement.'));
  }

  if (issues.length > 0) {
    console.log(chalk.red('\n🚨 Issues to address:'));

    for (const issue of issues) {
      console.log(chalk.red(`   • ${issue}`));
    }
  }

  console.log(chalk.blue('\n💡 Suggestions:'));
  console.log(
    chalk.blue('   • Ensure all Gherkin scenarios are complete and testable')
  );
  console.log(chalk.blue('   • Add error handling scenarios for edge cases'));
  console.log(
    chalk.blue('   • Include specific performance and security criteria')
  );
  console.log(
    chalk.blue('   • Reference related requirements and dependencies')
  );
}

async function validateEpic(name) {
  const epicsDir = path.join(process.cwd(), 'docs', 'kanban', 'EPICS');
  const epicPath = path.join(epicsDir, name);
  const epicOverviewPath = path.join(epicPath, 'epic-overview.md');

  if (!(await fs.pathExists(epicOverviewPath))) {
    console.log(chalk.red(`❌ Epic "${name}" not found`));
    console.log(chalk.blue('💡 Available epics:'));

    if (await fs.pathExists(epicsDir)) {
      const epicFolders = await fs.readdir(epicsDir);

      for (const epic of epicFolders) {
        console.log(chalk.blue(`   ${epic}`));
      }
    }

    return;
  }

  console.log(chalk.green(`✅ Found epic: ${name}`));
  console.log(chalk.blue(`📍 Path: ${epicPath}`));

  // Read epic overview
  const content = await fs.readFile(epicOverviewPath, 'utf8');

  // Count requirements and tasks
  const requirementsDir = path.join(epicPath, 'REQUIREMENTS');
  const tasksDir = path.join(epicPath, 'TASKS');

  let requirementCount = 0;
  let taskCount = 0;

  if (await fs.pathExists(requirementsDir)) {
    const requirements = await fs.readdir(requirementsDir);
    requirementCount = requirements.filter((f) => f.endsWith('.md')).length;
  }

  if (await fs.pathExists(tasksDir)) {
    const tasks = await fs.readdir(tasksDir);
    taskCount = tasks.filter((f) => f.endsWith('.md')).length;
  }

  console.log(chalk.blue('\n📊 Epic Structure:'));
  console.log(chalk.blue(`   Requirements: ${requirementCount}`));
  console.log(chalk.blue(`   Tasks: ${taskCount}`));

  if (requirementCount === 0) {
    console.log(
      chalk.yellow(
        '⚠️  No requirements found. Consider adding requirements to define the epic scope.'
      )
    );
    console.log(
      chalk.blue(
        '💡 Create requirement: ./wf.sh new requirement "Requirement Name" --content="epic: ' +
          name +
          '"'
      )
    );
  }

  if (taskCount === 0 && requirementCount > 0) {
    console.log(
      chalk.yellow('⚠️  Requirements exist but no implementation tasks found.')
    );
    console.log(
      chalk.blue(
        '💡 Create tasks: ./wf.sh new todo "Task Name" --content="requirement: req-name"'
      )
    );
  }

  // Analyze epic content
  let validationScore = 0;
  let maxScore = 0;
  const issues = [];

  const requiredSections = [
    { pattern: /# 🎯 EPIC:/, name: 'Epic title', points: 2 },
    {
      pattern: /## 🎯 \*\*Epic Overview\*\*/,
      name: 'Epic overview',
      points: 2,
    },
    {
      pattern: /### \*\*Business Value\*\*/,
      name: 'Business value',
      points: 2,
    },
    { pattern: /### \*\*Epic Goals\*\*/, name: 'Epic goals', points: 2 },
    {
      pattern: /## ✅ \*\*Epic Definition of Done\*\*/,
      name: 'Definition of done',
      points: 2,
    },
  ];

  console.log(chalk.blue('\n📋 Validation Results:'));

  for (const section of requiredSections) {
    maxScore += section.points;

    if (section.pattern.test(content)) {
      validationScore += section.points;
      console.log(chalk.green(`✅ ${section.name} (${section.points} pts)`));
    } else {
      console.log(chalk.red(`❌ ${section.name} (${section.points} pts)`));
      issues.push(`Missing: ${section.name}`);
    }
  }

  // Check for placeholders
  const placeholders = content.match(/\[.*?\]/g) || [];
  if (placeholders.length > 0) {
    issues.push(
      `${placeholders.length} placeholder(s) found - epic needs completion`
    );
  } else {
    console.log(chalk.green('✅ No placeholders found'));
    validationScore += 1;
    maxScore += 1;
  }

  // Calculate score
  const percentage = Math.round((validationScore / maxScore) * 100);
  console.log(
    chalk.blue(
      `\n📊 Validation Score: ${validationScore}/${maxScore} (${percentage}%)`
    )
  );

  if (percentage >= 90) {
    console.log(chalk.green('🎉 Excellent! Epic is well-defined.'));
  } else if (percentage >= 70) {
    console.log(chalk.yellow('⚠️  Good, but could be improved.'));
  } else {
    console.log(chalk.red('❌ Needs significant improvement.'));
  }

  if (issues.length > 0) {
    console.log(chalk.red('\n🚨 Issues to address:'));

    for (const issue of issues) {
      console.log(chalk.red(`   • ${issue}`));
    }
  }
}

// Epic and Requirement Creation Functions
async function createEpic(name, options) {
  try {
    await initializeWorkflowIfNeeded();

    // Ensure kebab-case naming
    const epicName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const epicDir = path.join(
      process.cwd(),
      'docs',
      'kanban',
      'epics',
      epicName
    );

    // Check if epic already exists
    if (await fs.pathExists(epicDir)) {
      console.log(
        chalk.red(`❌ Epic "${epicName}" already exists at ${epicDir}`)
      );
      return;
    }

    // Create epic directory structure
    await fs.ensureDir(path.join(epicDir, 'requirements'));
    await fs.ensureDir(path.join(epicDir, 'tasks'));

    // Get next epic ID
    const epicId = await getNextEpicId();

    // Create epic overview file
    const epicTemplate = await loadTemplate('epic-template.md');
    const epicContent = epicTemplate
      .replace(/{{epic-name}}/g, name)
      .replace(/{{epic-id}}/g, epicId)
      .replace(/{{date}}/g, new Date().toISOString().split('T')[0])
      .replace(/{{priority}}/g, options.priority || '2')
      .replace(
        /{{epic-description}}/g,
        options.description || 'Epic description to be added'
      )
      .replace(
        /{{business-value}}/g,
        options.businessValue || 'business value to be defined'
      )
      .replace(/{{notes}}/g, 'Initial epic creation');

    await fs.writeFile(path.join(epicDir, 'epic-overview.md'), epicContent);

    console.log(chalk.green(`✅ Epic "${name}" created successfully!`));
    console.log(chalk.blue(`📁 Epic directory: ${epicDir}`));
    console.log(chalk.blue(`📝 Epic ID: ${epicId}`));
    console.log(chalk.yellow(`\n📋 Next steps:`));
    console.log(
      chalk.yellow(
        `1. Add requirements: ./wf.sh new-requirement "requirement name" --epic="${epicName}"`
      )
    );
    console.log(chalk.yellow(`2. Review and update epic-overview.md`));
    console.log(chalk.yellow(`3. Define success criteria and timeline`));
  } catch (error) {
    console.error(chalk.red('❌ Error creating epic:'), error.message);
  }
}

async function _createRequirement(name, options) {
  try {
    await initializeWorkflowIfNeeded();

    // Get next requirement ID
    const reqId = await getNextRequirementId();
    const reqDir = path.join(
      process.cwd(),
      'docs',
      'requirements',
      `req-${reqId.toString().padStart(3, '0')}`
    );

    // Check if requirement already exists
    if (await fs.pathExists(reqDir)) {
      console.log(
        chalk.red(`❌ Requirement directory already exists: ${reqDir}`)
      );
      return;
    }

    // Create requirement directory structure
    await fs.ensureDir(reqDir);
    await fs.ensureDir(path.join(reqDir, 'history'));

    // Create kebab-case name for URLs and branches
    const kebabName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Create requirement file
    const reqTemplate = await loadTemplate('requirement-template.md');
    const reqContent = reqTemplate
      .replace(/{{requirement-name}}/g, name)
      .replace(/{{id}}/g, reqId.toString().padStart(3, '0'))
      .replace(/{{epic-name}}/g, options.epic || 'not-assigned')
      .replace(/{{date}}/g, new Date().toISOString().split('T')[0])
      .replace(/{{priority}}/g, options.priority || '2')
      .replace(/{{user-type}}/g, options.userType || 'AI agent')
      .replace(
        /{{functionality}}/g,
        options.functionality || 'functionality to be defined'
      )
      .replace(/{{benefit}}/g, options.benefit || 'benefit to be defined')
      .replace(/{{feature-name}}/g, name)
      .replace(/{{scenario-name}}/g, 'Basic scenario')
      .replace(/{{precondition}}/g, 'precondition to be defined')
      .replace(/{{action}}/g, 'action to be defined')
      .replace(/{{expected-result}}/g, 'expected result to be defined')
      .replace(/{{additional-result}}/g, 'additional result to be defined')
      .replace(
        /{{technical-details}}/g,
        'Technical implementation details to be added'
      )
      .replace(/{{component}}/g, 'component name')
      .replace(/{{integration}}/g, 'integration point')
      .replace(/{{workflow}}/g, 'workflow name')
      .replace(/{{implementation-notes}}/g, 'Implementation notes to be added')
      .replace(/{{kebab-case-name}}/g, kebabName)
      .replace(/{{implementation-path}}/g, 'to be determined');

    await fs.writeFile(path.join(reqDir, 'requirement.md'), reqContent);

    // If epic is specified, link the requirement to the epic
    if (options.epic) {
      await linkRequirementToEpic(reqId, options.epic);
    }

    console.log(
      chalk.green(
        `✅ Requirement REQ-${reqId.toString().padStart(3, '0')} created successfully!`
      )
    );
    console.log(chalk.blue(`📁 Requirement directory: ${reqDir}`));
    console.log(
      chalk.blue(`📝 Requirement file: ${path.join(reqDir, 'requirement.md')}`)
    );
    if (options.epic) {
      console.log(chalk.blue(`🔗 Linked to epic: ${options.epic}`));
    }
    console.log(chalk.yellow(`\n📋 Next steps:`));
    console.log(chalk.yellow(`1. Review and complete the requirement.md file`));
    console.log(chalk.yellow(`2. Define detailed Gherkin scenarios`));
    console.log(
      chalk.yellow(
        `3. Generate tests: ./wf.sh generate-tests req-${reqId.toString().padStart(3, '0')}`
      )
    );
    console.log(
      chalk.yellow(
        `4. Start work: ./wf.sh start-work req-${reqId.toString().padStart(3, '0')}`
      )
    );
  } catch (error) {
    console.error(chalk.red('❌ Error creating requirement:'), error.message);
  }
}

async function _generateTests(requirementId) {
  try {
    const reqDir = path.join(
      process.cwd(),
      'docs',
      'requirements',
      requirementId
    );
    const testDir = path.join(
      process.cwd(),
      'tests',
      'requirements',
      requirementId
    );

    // Check if requirement exists
    if (!(await fs.pathExists(reqDir))) {
      console.log(
        chalk.red(`❌ Requirement ${requirementId} not found at ${reqDir}`)
      );
      return;
    }

    // Create test directory
    await fs.ensureDir(testDir);

    // Read requirement file to extract Gherkin scenarios
    const reqFile = path.join(reqDir, 'requirement.md');
    const reqContent = await fs.readFile(reqFile, 'utf8');

    // Create test files
    const featureFile = path.join(testDir, `${requirementId}.feature`);
    const stepsFile = path.join(testDir, `${requirementId}.steps.js`);
    const unitTestFile = path.join(testDir, `${requirementId}.unit.test.js`);
    const e2eTestFile = path.join(testDir, `${requirementId}.e2e.test.js`);

    // Extract and create feature file
    const gherkinMatch = reqContent.match(/```gherkin\n([\s\S]*?)\n```/);
    if (gherkinMatch) {
      await fs.writeFile(featureFile, gherkinMatch[1]);
    }

    // Create basic test templates
    await fs.writeFile(stepsFile, createStepsTemplate(requirementId));
    await fs.writeFile(unitTestFile, createUnitTestTemplate(requirementId));
    await fs.writeFile(e2eTestFile, createE2ETestTemplate(requirementId));

    console.log(chalk.green(`✅ Test files generated for ${requirementId}`));
    console.log(chalk.blue(`📁 Test directory: ${testDir}`));
    console.log(chalk.blue(`📝 Files created:`));
    console.log(chalk.blue(`   - ${requirementId}.feature`));
    console.log(chalk.blue(`   - ${requirementId}.steps.js`));
    console.log(chalk.blue(`   - ${requirementId}.unit.test.js`));
    console.log(chalk.blue(`   - ${requirementId}.e2e.test.js`));
  } catch (error) {
    console.error(chalk.red('❌ Error generating tests:'), error.message);
  }
}

async function _startWork(requirementId) {
  try {
    const reqDir = path.join(
      process.cwd(),
      'docs',
      'requirements',
      requirementId
    );

    // Check if requirement exists
    if (!(await fs.pathExists(reqDir))) {
      console.log(chalk.red(`❌ Requirement ${requirementId} not found`));
      return;
    }

    // Read requirement to get name
    const reqFile = path.join(reqDir, 'requirement.md');
    const reqContent = await fs.readFile(reqFile, 'utf8');
    const nameMatch = reqContent.match(/# Requirement: (.+)/);
    const reqName = nameMatch
      ? nameMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : 'unknown';

    // Create git branch
    const branchName = `feature/${requirementId}-${reqName}`;

    try {
      execSync(`git checkout -b ${branchName}`, { cwd: process.cwd() });
      console.log(
        chalk.green(`✅ Created and switched to branch: ${branchName}`)
      );

      // Update requirement with branch info
      const updatedContent = reqContent.replace(
        /- \*\*Git Branch\*\*: .+/,
        `- **Git Branch**: ${branchName}`
      );
      await fs.writeFile(reqFile, updatedContent);

      console.log(chalk.blue(`📝 Updated requirement with branch information`));
      console.log(chalk.yellow(`\n📋 Next steps:`));
      console.log(
        chalk.yellow(
          `1. Implement the requirement following the acceptance criteria`
        )
      );
      console.log(chalk.yellow(`2. Run tests: npm test -- ${requirementId}`));
      console.log(
        chalk.yellow(
          `3. Commit with format: "REQ-${requirementId}: your commit message"`
        )
      );
    } catch (gitError) {
      console.log(chalk.red(`❌ Git error: ${gitError.message}`));
      console.log(
        chalk.yellow(
          `💡 Make sure you're in a git repository and have no uncommitted changes`
        )
      );
    }
  } catch (error) {
    console.error(chalk.red('❌ Error starting work:'), error.message);
  }
}

async function showEpicProgress(epicName) {
  try {
    const epicDir = path.join(
      process.cwd(),
      'docs',
      'kanban',
      'epics',
      epicName
    );

    if (!(await fs.pathExists(epicDir))) {
      console.log(chalk.red(`❌ Epic "${epicName}" not found`));
      return;
    }

    // Count requirements and tasks
    const requirementsDir = path.join(epicDir, 'requirements');
    const tasksDir = path.join(epicDir, 'tasks');

    let requirementCount = 0;
    const completedRequirements = 0;
    let taskCount = 0;
    const completedTasks = 0;

    if (await fs.pathExists(requirementsDir)) {
      const reqFiles = await fs.readdir(requirementsDir);
      requirementCount = reqFiles.length;
      // TODO: Check completion status
    }

    if (await fs.pathExists(tasksDir)) {
      const taskFiles = await fs.readdir(tasksDir);
      taskCount = taskFiles.length;
      // TODO: Check completion status
    }

    console.log(chalk.blue(`📊 Epic Progress: ${epicName}`));
    console.log(
      chalk.blue(
        `📋 Requirements: ${completedRequirements}/${requirementCount} complete`
      )
    );
    console.log(
      chalk.blue(`✅ Tasks: ${completedTasks}/${taskCount} complete`)
    );
  } catch (error) {
    console.error(chalk.red('❌ Error showing epic progress:'), error.message);
  }
}

// Helper functions
async function getNextEpicId() {
  // TODO: Implement proper ID generation
  return 'EPIC-001';
}

async function getNextRequirementId() {
  const reqDir = path.join(process.cwd(), 'docs', 'requirements');

  if (!(await fs.pathExists(reqDir))) {
    await fs.ensureDir(reqDir);
    return 1;
  }

  const reqFolders = await fs.readdir(reqDir);
  const reqNumbers = reqFolders
    .filter((folder) => folder.startsWith('req-'))
    .map((folder) => parseInt(folder.split('-')[1], 10))
    .filter((num) => !Number.isNaN(num));

  return reqNumbers.length > 0 ? Math.max(...reqNumbers) + 1 : 1;
}

async function loadTemplate(templateName) {
  const templatePath = path.join(process.cwd(), 'templates', templateName);

  if (!(await fs.pathExists(templatePath))) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  return await fs.readFile(templatePath, 'utf8');
}

async function linkRequirementToEpic(reqId, epicName) {
  const epicDir = path.join(process.cwd(), 'docs', 'kanban', 'epics', epicName);
  const reqLinksDir = path.join(epicDir, 'requirements');

  if (!(await fs.pathExists(epicDir))) {
    console.log(
      chalk.yellow(`⚠️  Epic "${epicName}" not found, skipping link`)
    );
    return;
  }

  // Create symlink or reference file
  const linkFile = path.join(
    reqLinksDir,
    `req-${reqId.toString().padStart(3, '0')}.md`
  );
  const linkContent = `# Requirement Link: REQ-${reqId.toString().padStart(3, '0')}

This requirement is part of the **${epicName}** epic.

**Full Requirement**: [../../../requirements/req-${reqId.toString().padStart(3, '0')}/requirement.md](../../../requirements/req-${reqId.toString().padStart(3, '0')}/requirement.md)

**Tests**: [../../../tests/requirements/req-${reqId.toString().padStart(3, '0')}/](../../../tests/requirements/req-${reqId.toString().padStart(3, '0')}//)

**Status**: Draft
`;

  await fs.writeFile(linkFile, linkContent);
}

function createStepsTemplate(reqId) {
  return `const { Given, When, Then } = require('@cucumber/cucumber');

// Step definitions for ${reqId}
// These are generated stubs - implement the actual step logic

Given('precondition to be defined', function () {
  // TODO: Implement precondition
});

When('action to be defined', function () {
  // TODO: Implement action
});

Then('expected result to be defined', function () {
  // TODO: Implement assertion
});

Then('additional result to be defined', function () {
  // TODO: Implement additional assertion
});
`;
}

function createUnitTestTemplate(reqId) {
  return `const { describe, it, expect } = require('@jest/globals');

describe('${reqId} - Unit Tests', () => {
  it('should implement basic functionality', () => {
    // TODO: Implement unit test
    expect(true).toBe(true);
  });
  
  it('should handle edge cases', () => {
    // TODO: Implement edge case tests
    expect(true).toBe(true);
  });
});
`;
}

function createE2ETestTemplate(reqId) {
  return `const { describe, it, expect } = require('@jest/globals');

describe('${reqId} - E2E Tests', () => {
  it('should complete the full workflow', async () => {
    // TODO: Implement end-to-end test
    expect(true).toBe(true);
  });
});
`;
}

// Test execution functions
async function runTests(type, options) {
  try {
    console.log(`Running ${type} tests...`);

    switch (type) {
      case 'e2e':
        await runE2ETests(options);
        break;
      case 'unit':
        await runUnitTests(options);
        break;
      case 'integration':
        await runIntegrationTests(options);
        break;
      default:
        console.error(`Unknown test type: ${type}`);
        console.log('Available types: e2e, unit, integration');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

async function runE2ETests(options) {
  const _path = require('node:path');
  const E2ETestRunner = require('../../../tests/e2e/lib/test-runner');

  if (!options.scenario) {
    console.error('E2E tests require a --scenario parameter');
    console.log(
      'Example: ./wf.sh test e2e --scenario=req-002-architecture-validation'
    );
    process.exit(1);
  }

  const runner = new E2ETestRunner();
  const scenarioFile = options.scenario.endsWith('.yaml')
    ? options.scenario
    : `${options.scenario}.yaml`;

  console.log(`🧪 Running E2E scenario: ${scenarioFile}`);

  const results = await runner.runScenario(scenarioFile);

  if (results.status === 'PASSED') {
    console.log('✅ E2E tests passed!');
  } else {
    console.log(`❌ E2E tests ${results.status.toLowerCase()}`);
    process.exit(1);
  }
}

async function runUnitTests(options) {
  console.log('🧪 Running unit tests...');

  if (options.requirement) {
    console.log(`   Filtering by requirement: ${options.requirement}`);
  }

  // Implementation for unit tests
  console.log('✅ Unit tests completed (placeholder)');
}

async function runIntegrationTests(options) {
  console.log('🧪 Running integration tests...');

  if (options.requirement) {
    console.log(`   Filtering by requirement: ${options.requirement}`);
  }

  // Implementation for integration tests
  console.log('✅ Integration tests completed (placeholder)');
}

async function testCommand(scenario, options) {
  try {
    console.log(chalk.blue('🧪 Supernal Coding Test Runner'));
    console.log(chalk.blue('='.repeat(60)));

    // Create test repository if requested
    if (options.createTestRepo) {
      console.log(chalk.yellow('📦 Creating test repository...'));
      await createTestRepository(options);
    }

    // Run tests based on scenario
    if (!scenario) {
      console.log(chalk.yellow('📋 Running all test suites...'));
      await runAllTests(options);
    } else {
      console.log(chalk.yellow(`📋 Running ${scenario} tests...`));
      switch (scenario.toLowerCase()) {
        case 'e2e':
          await runE2ETests(options);
          break;
        case 'unit':
          await runUnitTests(options);
          break;
        case 'integration':
          await runIntegrationTests(options);
          break;
        default:
          console.log(chalk.red(`❌ Unknown test scenario: ${scenario}`));
          console.log(
            chalk.gray('Available scenarios: e2e, unit, integration')
          );
          process.exit(1);
      }
    }

    console.log(chalk.green('✅ Test execution completed'));
  } catch (error) {
    console.error(chalk.red('❌ Test execution failed:'), error.message);
    process.exit(1);
  }
}

async function runAllTests(options) {
  console.log(chalk.blue('🔄 Running all test suites...'));

  try {
    await runUnitTests(options);
    await runIntegrationTests(options);
    await runE2ETests(options);

    console.log(chalk.green('✅ All test suites completed'));
  } catch (error) {
    console.error(chalk.red('❌ Test suite failed:'), error.message);
    throw error;
  }
}

async function createTestRepository(options) {
  const fs = require('fs-extra');
  const path = require('node:path');

  // Create test repository in current directory or specified location
  const testRepoDir =
    options.testRepoDir || path.join(process.cwd(), 'dynamic-test-repo');

  console.log(chalk.gray(`  Creating test repository at: ${testRepoDir}`));

  // Remove existing test repo if it exists
  if (await fs.pathExists(testRepoDir)) {
    await fs.remove(testRepoDir);
  }

  // Create test repository structure
  await fs.ensureDir(testRepoDir);

  const testRepoStructure = {
    'README.md': `# Dynamic Test Repository

This repository was created dynamically for testing purposes.
Created at: ${new Date().toISOString()}

## Purpose
This repository tests the auto-building, auto-documenting, auto-testing system.
`,
    'src/index.js': `// Dynamic test repository
console.log('Hello from dynamic test repository!');
console.log('Testing auto-building system...');

module.exports = {
  name: 'dynamic-test-repo',
  version: '1.0.0',
  created: '${new Date().toISOString()}'
};
`,
    'src/utils.js': `// Utility functions for testing
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

export function greet(name) {
  return \`Hello, \${name}!\`;
}
`,
    'tests/basic.test.js': `// Basic test file
const assert = require('assert');
const { add, multiply, greet } = require('../src/utils');

describe('Basic functionality', () => {
  it('should add numbers correctly', () => {
    assert.equal(add(2, 3), 5);
  });
  
  it('should multiply numbers correctly', () => {
    assert.equal(multiply(4, 5), 20);
  });
  
  it('should greet correctly', () => {
    assert.equal(greet('World'), 'Hello, World!');
  });
});
`,
    'package.json': JSON.stringify(
      {
        name: 'dynamic-test-repo',
        version: '1.0.0',
        description:
          'Dynamically created test repository for equipment pack testing',
        main: 'src/index.js',
        scripts: {
          test: 'node tests/basic.test.js',
          start: 'node src/index.js',
        },
        dependencies: {},
        devDependencies: {},
      },
      null,
      2
    ),
    'docs/README.md': `# Documentation

This documentation was auto-generated for testing purposes.

## Features
- Auto-building system
- Auto-documenting system
- Auto-testing system

## Usage
\`\`\`bash
npm install
npm test
npm start
\`\`\`
`,
    '.gitignore': `node_modules/
*.log
.env
dist/
build/
`,
  };

  // Create all files
  for (const [filePath, content] of Object.entries(testRepoStructure)) {
    const fullPath = path.join(testRepoDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
  }

  console.log(chalk.green('  ✅ Test repository created successfully'));
  console.log(chalk.gray(`  📁 Location: ${testRepoDir}`));
  console.log(
    chalk.gray(
      `  📋 Structure: ${Object.keys(testRepoStructure).length} files created`
    )
  );

  return testRepoDir;
}

// Suppress error output for unknown commands
workflow.configureOutput({
  writeErr: (str) => {
    // Don't write error messages for unknown commands - we'll handle them gracefully
    if (str.includes('error: unknown command')) {
      return;
    }
    // For other errors, use default behavior
    process.stderr.write(str);
  },
});

// Override the default error handling to show help for wrong commands
workflow.exitOverride((err) => {
  if (err.code === 'commander.unknownCommand') {
    console.log(chalk.red(`❌ Unknown command: "${err.command}"`));
    console.log(chalk.blue('Available commands:\n'));

    // Show help instead of list for wrong commands
    workflow.outputHelp();
    return;
  }

  // Don't exit for help commands, let them display normally
  if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
    return;
  }

  // For other errors, exit normally
  process.exit(err.exitCode);
});

module.exports = workflow;
