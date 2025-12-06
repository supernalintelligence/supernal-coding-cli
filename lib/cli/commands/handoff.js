#!/usr/bin/env node

/**
 * Handoff Management System
 * Creates and manages agent handoffs with proper naming conventions
 *
 * Enforces YYYY-MM-DD-HH-MM-[title].md naming convention
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadProjectConfig, getDocPaths } = require('../utils/config-loader');

class HandoffManager {
  constructor() {
    const config = loadProjectConfig();
    const paths = getDocPaths(config);
    this.handoffDir = path.join(process.cwd(), paths.kanban, 'handoffs');
  }

  generateTimestamp(customTimestamp = null) {
    const now = customTimestamp ? new Date(customTimestamp) : new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}-${hours}-${minutes}`;
  }

  validateNamingConvention(filename) {
    // YYYY-MM-DD-HH-MM-[title].md pattern
    const pattern = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-.+\.md$/;
    return pattern.test(filename);
  }

  generateFilename(options) {
    const { req, title, status, timestamp } = options;
    const ts = timestamp || this.generateTimestamp();

    let filename = ts;
    if (req) filename += `-${req.toLowerCase()}`;
    if (title) filename += `-${title}`;
    if (status) filename += `-${status}`;
    filename += '.md';

    return filename;
  }

  createHandoffContent(options) {
    const { req, title, status, description } = options;
    const now = new Date().toISOString().split('T')[0];

    return `# 🤝 HANDOFF: ${title || 'Development Task'}

**Date**: ${now}
**Type**: ${status?.toUpperCase() || 'ACTIVE'}
**Agent**: Agent Name
**Branch**: main
**Status**: ${status === 'completed' ? '✅' : status === 'blocked' ? '🚫' : '🔄'} ${title?.toUpperCase() || 'IN PROGRESS'}

---

## 📋 **Task Overview**

${description || `Work on ${req || 'development task'} with clear objectives and deliverables.`}

### **Current Status**
- [ ] Task analysis complete
- [ ] Implementation approach defined
- [ ] Dependencies identified
- [ ] Testing strategy planned

## 🎯 **Objectives**

### **Primary Goals**
- Complete ${title || 'assigned task'} functionality
- Ensure all tests pass
- Update documentation as needed
- Prepare clear handoff for next agent

### **Success Criteria**
- [ ] All acceptance criteria met
- [ ] Code review completed
- [ ] Tests passing
- [ ] Documentation updated

## 🛠️ **Implementation Notes**

### **Technical Approach**
*[Add implementation details here]*

### **Key Decisions**
*[Document important architectural or design decisions]*

### **Challenges & Solutions**
*[Track problems encountered and how they were solved]*

## 🧪 **Testing Strategy**

### **Test Coverage**
- [ ] Unit tests written and passing
- [ ] Integration tests verified
- [ ] E2E scenarios validated
- [ ] Manual testing completed

## 📝 **Next Steps**

### **Immediate Actions**
1. *[List next immediate tasks]*
2. *[Priority actions for next agent]*
3. *[Any blocking issues to resolve]*

### **Future Considerations**
- *[Long-term implications]*
- *[Follow-up work needed]*
- *[Integration points to consider]*

## 🔄 **Handoff Details**

### **Context for Next Agent**
*[Provide sufficient context for seamless pickup]*

### **Files Modified**
- \`file1.js\` - Description of changes
- \`file2.md\` - Documentation updates

### **Resources & References**
- Related requirements: ${req || 'N/A'}
- Documentation: [Link to relevant docs]
- Previous handoffs: [Reference related work]

---

*This handoff follows the YYYY-MM-DD-HH-MM naming convention for proper chronological organization.*`;
  }

  async create(options) {
    const {
      req,
      title,
      status = 'active',
      description,
      timestamp,
      force = false
    } = options;

    if (!title) {
      throw new Error('Title is required for handoff creation');
    }

    const filename = this.generateFilename({ req, title, status, timestamp });
    const filepath = path.join(this.handoffDir, filename);

    // Validate naming convention
    if (!this.validateNamingConvention(filename)) {
      throw new Error(
        `Generated filename "${filename}" does not match required YYYY-MM-DD-HH-MM-[title].md convention`
      );
    }

    // Check if file exists
    if (fs.existsSync(filepath) && !force) {
      throw new Error(
        `Handoff file "${filename}" already exists. Use --force to overwrite.`
      );
    }

    // Ensure directory exists
    if (!fs.existsSync(this.handoffDir)) {
      fs.mkdirSync(this.handoffDir, { recursive: true });
    }

    // Create handoff content
    const content = this.createHandoffContent({
      req,
      title,
      status,
      description
    });

    // Write file
    fs.writeFileSync(filepath, content);

    return {
      filename,
      filepath,
      valid: true,
      message: `Handoff created: ${filename}`
    };
  }

  validate(filename) {
    const isValid = this.validateNamingConvention(filename);
    return {
      filename,
      valid: isValid,
      message: isValid
        ? 'Valid handoff naming convention'
        : 'Invalid: Must follow YYYY-MM-DD-HH-MM-[title].md format'
    };
  }

  list() {
    if (!fs.existsSync(this.handoffDir)) {
      return [];
    }

    const files = fs
      .readdirSync(this.handoffDir)
      .filter((file) => file.endsWith('.md') && file !== 'README.md')
      .map((file) => ({
        filename: file,
        valid: this.validateNamingConvention(file),
        path: path.join(this.handoffDir, file),
        stat: fs.statSync(path.join(this.handoffDir, file))
      }))
      .sort((a, b) => b.stat.mtime - a.stat.mtime); // Most recent first

    return files;
  }
}

module.exports = HandoffManager;

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const handoffManager = new HandoffManager();

  try {
    switch (command) {
      case 'create': {
        const options = {};
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg.startsWith('--req=')) options.req = arg.split('=')[1];
          if (arg.startsWith('--title=')) options.title = arg.split('=')[1];
          if (arg.startsWith('--status=')) options.status = arg.split('=')[1];
          if (arg.startsWith('--description='))
            options.description = arg.split('=')[1];
          if (arg.startsWith('--timestamp='))
            options.timestamp = arg.split('=')[1];
          if (arg === '--force') options.force = true;
        }

        const result = handoffManager.create(options);
        console.log('✅', result.message);
        break;
      }

      case 'validate': {
        const filename = args[1];
        if (!filename) {
          console.error('Usage: node handoff.js validate <filename>');
          process.exit(1);
        }
        const validation = handoffManager.validate(filename);
        console.log(validation.valid ? '✅' : '❌', validation.message);
        break;
      }

      case 'list': {
        const handoffs = handoffManager.list();
        console.log('\n📋 Handoff Files:');
        handoffs.forEach((handoff) => {
          const status = handoff.valid ? '✅' : '❌';
          console.log(`${status} ${handoff.filename}`);
        });
        break;
      }

      default:
        console.log(`Usage:
  node handoff.js create --title="task-name" [--req=REQ-XXX] [--status=active] [--description="..."]
  node handoff.js validate <filename>
  node handoff.js list
  
Examples:
  node handoff.js create --req=REQ-024 --title="smart-git-management" --status=active
  node handoff.js validate 2025-01-19-14-30-req-024-smart-git-management-active.md
  node handoff.js list`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}
