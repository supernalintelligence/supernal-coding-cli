#!/usr/bin/env node

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

class InstallManager {
  constructor() {
    this.sourceRoot = path.join(__dirname, '..', '..');
    this.kanbanScriptsDir = path.join(__dirname, 'kanban-scripts');
    this.docsScriptsDir = path.join(__dirname, 'docs-scripts');
    this.gitHooksScriptsDir = path.join(__dirname, 'git-hooks-scripts');
    this.devScriptsDir = path.join(__dirname, 'dev-scripts');
    this.templatesDir = path.join(this.sourceRoot, 'templates');
  }

  async install(targetPath, options = {}) {
    const { mode = 'copy', components = 'all', force = false } = options;

    console.log(
      `${colors.blue}🏗️  Installing Supernal Coding system...${colors.reset}`
    );
    console.log(`${colors.cyan}Target: ${targetPath}${colors.reset}`);
    console.log(`${colors.cyan}Mode: ${mode}${colors.reset}`);
    console.log(`${colors.cyan}Components: ${components}${colors.reset}`);
    console.log('');

    // Validate target path
    if (!fs.existsSync(targetPath)) {
      console.error(
        `${colors.red}❌ Target directory does not exist: ${targetPath}${colors.reset}`
      );
      process.exit(1);
    }

    const targetAbsolute = path.resolve(targetPath);
    const componentsToInstall =
      components === 'all'
        ? [
            'kanban',
            'docs',
            'validation',
            'templates',
            'git-hooks',
            'dev-tools'
          ]
        : components.split(',').map((c) => c.trim());

    try {
      // Install components based on selection
      for (const component of componentsToInstall) {
        await this.installComponent(component, targetAbsolute, mode, force);
      }

      // Create main CLI entry point
      await this.createMainCLI(targetAbsolute, componentsToInstall, mode);

      // Create package.json if it doesn't exist
      await this.setupPackageJson(targetAbsolute);

      console.log('');
      console.log(`${colors.green}✅ Installation complete!${colors.reset}`);
      console.log('');
      console.log(`${colors.bold}Next steps:${colors.reset}`);
      console.log(`  cd ${targetAbsolute}`);
      console.log(`  npm install                     # Install dependencies`);
      console.log(
        `  npm install -g .                # Install globally (optional)`
      );
      console.log(`  sc kanban list   # Test kanban system`);
    } catch (error) {
      console.error(
        `${colors.red}❌ Installation failed:${colors.reset}`,
        error.message
      );
      process.exit(1);
    }
  }

  async installComponent(component, targetPath, mode, force) {
    console.log(
      `${colors.blue}📦 Installing ${component} component...${colors.reset}`
    );

    switch (component) {
      case 'kanban':
        await this.installKanban(targetPath, mode, force);
        break;
      case 'docs':
        await this.installDocs(targetPath, mode, force);
        break;
      case 'validation':
        await this.installValidation(targetPath, mode, force);
        break;
      case 'templates':
        await this.installTemplates(targetPath, mode, force);
        break;
      case 'git-hooks':
        await this.installGitHooks(targetPath, mode, force);
        break;
      case 'dev-tools':
        await this.installDevTools(targetPath, mode, force);
        break;
      default:
        console.warn(
          `${colors.yellow}⚠️  Unknown component: ${component}${colors.reset}`
        );
    }
  }

  async installKanban(targetPath, mode, force) {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');
    const targetKanbanDir = path.join(targetCliDir, 'kanban-scripts');

    // Ensure directories exist
    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy or link kanban scripts
    if (mode === 'link') {
      if (fs.existsSync(targetKanbanDir) && !force) {
        console.log(
          `${colors.yellow}  Kanban scripts already exist, skipping...${colors.reset}`
        );
        return;
      }
      if (fs.existsSync(targetKanbanDir))
        fs.rmSync(targetKanbanDir, { recursive: true });
      fs.symlinkSync(this.kanbanScriptsDir, targetKanbanDir);
      console.log(`${colors.green}  ✅ Linked kanban scripts${colors.reset}`);
    } else {
      if (fs.existsSync(targetKanbanDir) && !force) {
        console.log(
          `${colors.yellow}  Kanban scripts already exist, skipping...${colors.reset}`
        );
        return;
      }
      this.copyDirectory(this.kanbanScriptsDir, targetKanbanDir);
      console.log(`${colors.green}  ✅ Copied kanban scripts${colors.reset}`);
    }

    // Copy kanban.js wrapper
    const sourceKanbanJs = path.join(__dirname, 'kanban.js');
    const targetKanbanJs = path.join(targetCliDir, 'kanban.js');
    fs.copyFileSync(sourceKanbanJs, targetKanbanJs);
    console.log(`${colors.green}  ✅ Installed kanban wrapper${colors.reset}`);

    // Create kanban directory structure
    const docsKanbanDir = path.join(targetPath, 'docs', 'kanban');
    this.createKanbanStructure(docsKanbanDir);
    console.log(
      `${colors.green}  ✅ Created kanban directory structure${colors.reset}`
    );
  }

  async installDocs(targetPath, mode, force) {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');
    const targetDocsDir = path.join(targetCliDir, 'docs-scripts');

    // Ensure directories exist
    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy or link docs scripts
    if (mode === 'link') {
      if (fs.existsSync(targetDocsDir) && !force) {
        console.log(
          `${colors.yellow}  Docs scripts already exist, skipping...${colors.reset}`
        );
        return;
      }
      if (fs.existsSync(targetDocsDir))
        fs.rmSync(targetDocsDir, { recursive: true });
      fs.symlinkSync(this.docsScriptsDir, targetDocsDir);
      console.log(`${colors.green}  ✅ Linked docs scripts${colors.reset}`);
    } else {
      if (fs.existsSync(targetDocsDir) && !force) {
        console.log(
          `${colors.yellow}  Docs scripts already exist, skipping...${colors.reset}`
        );
        return;
      }
      this.copyDirectory(this.docsScriptsDir, targetDocsDir);
      console.log(`${colors.green}  ✅ Copied docs scripts${colors.reset}`);
    }

    // Copy docs.js wrapper
    const sourceDocsJs = path.join(__dirname, 'docs.js');
    const targetDocsJs = path.join(targetCliDir, 'docs.js');
    fs.copyFileSync(sourceDocsJs, targetDocsJs);
    console.log(`${colors.green}  ✅ Installed docs wrapper${colors.reset}`);
  }

  async installValidation(targetPath, _mode, force) {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');

    // Copy validation commands
    const validationCommands = [
      'validate.js',
      'priority.js',
      'agent.js',
      'git-smart.js'
    ];
    for (const command of validationCommands) {
      const sourcePath = path.join(__dirname, command);
      const targetPath = path.join(targetCliDir, command);

      if (fs.existsSync(sourcePath)) {
        if (!fs.existsSync(targetPath) || force) {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(
            `${colors.green}  ✅ Installed ${command}${colors.reset}`
          );
        } else {
          console.log(
            `${colors.yellow}  ${command} already exists, skipping...${colors.reset}`
          );
        }
      }
    }
  }

  async installTemplates(targetPath, mode, force) {
    const targetTemplatesDir = path.join(targetPath, 'templates');

    if (mode === 'link') {
      if (fs.existsSync(targetTemplatesDir) && !force) {
        console.log(
          `${colors.yellow}  Templates already exist, skipping...${colors.reset}`
        );
        return;
      }
      if (fs.existsSync(targetTemplatesDir))
        fs.rmSync(targetTemplatesDir, { recursive: true });
      fs.symlinkSync(this.templatesDir, targetTemplatesDir);
      console.log(`${colors.green}  ✅ Linked templates${colors.reset}`);
    } else {
      if (fs.existsSync(targetTemplatesDir) && !force) {
        console.log(
          `${colors.yellow}  Templates already exist, skipping...${colors.reset}`
        );
        return;
      }
      this.copyDirectory(this.templatesDir, targetTemplatesDir);
      console.log(`${colors.green}  ✅ Copied templates${colors.reset}`);
    }
  }

  async installGitHooks(targetPath, mode, force) {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');
    const targetGitHooksDir = path.join(targetCliDir, 'git-hooks-scripts');
    const targetGitHooksWrapper = path.join(targetCliDir, 'git-hooks.js');

    // Ensure directories exist
    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy or link git hooks scripts
    if (mode === 'link') {
      if (fs.existsSync(targetGitHooksDir) && !force) {
        console.log(
          `${colors.yellow}  Git hooks scripts already exist, skipping...${colors.reset}`
        );
        return;
      }
      if (fs.existsSync(targetGitHooksDir))
        fs.rmSync(targetGitHooksDir, { recursive: true });
      fs.symlinkSync(this.gitHooksScriptsDir, targetGitHooksDir);
      console.log(
        `${colors.green}  ✅ Linked git hooks scripts${colors.reset}`
      );
    } else {
      if (fs.existsSync(targetGitHooksDir) && !force) {
        console.log(
          `${colors.yellow}  Git hooks scripts already exist, skipping...${colors.reset}`
        );
        return;
      }
      this.copyDirectory(this.gitHooksScriptsDir, targetGitHooksDir);
      console.log(
        `${colors.green}  ✅ Copied git hooks scripts${colors.reset}`
      );
    }

    // Copy git hooks wrapper
    const sourceGitHooksWrapper = path.join(__dirname, 'git-hooks.js');
    if (fs.existsSync(sourceGitHooksWrapper)) {
      if (fs.existsSync(targetGitHooksWrapper) && !force) {
        console.log(
          `${colors.yellow}  Git hooks wrapper already exists, skipping...${colors.reset}`
        );
      } else {
        fs.copyFileSync(sourceGitHooksWrapper, targetGitHooksWrapper);
        console.log(
          `${colors.green}  ✅ Copied git hooks wrapper${colors.reset}`
        );
      }
    }
  }

  async installDevTools(targetPath, mode, force) {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');
    const targetDevScriptsDir = path.join(targetCliDir, 'dev-scripts');
    const targetDevWrapper = path.join(targetCliDir, 'dev.js');

    // Ensure directories exist
    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy or link dev scripts
    if (mode === 'link') {
      if (fs.existsSync(targetDevScriptsDir) && !force) {
        console.log(
          `${colors.yellow}  Dev scripts already exist, skipping...${colors.reset}`
        );
        return;
      }
      if (fs.existsSync(targetDevScriptsDir))
        fs.rmSync(targetDevScriptsDir, { recursive: true });
      fs.symlinkSync(this.devScriptsDir, targetDevScriptsDir);
      console.log(`${colors.green}  ✅ Linked dev scripts${colors.reset}`);
    } else {
      if (fs.existsSync(targetDevScriptsDir) && !force) {
        console.log(
          `${colors.yellow}  Dev scripts already exist, skipping...${colors.reset}`
        );
        return;
      }
      this.copyDirectory(this.devScriptsDir, targetDevScriptsDir);
      console.log(`${colors.green}  ✅ Copied dev scripts${colors.reset}`);
    }

    // Copy dev tools wrapper
    const sourceDevWrapper = path.join(__dirname, 'dev.js');
    if (fs.existsSync(sourceDevWrapper)) {
      if (fs.existsSync(targetDevWrapper) && !force) {
        console.log(
          `${colors.yellow}  Dev wrapper already exists, skipping...${colors.reset}`
        );
      } else {
        fs.copyFileSync(sourceDevWrapper, targetDevWrapper);
        console.log(`${colors.green}  ✅ Copied dev wrapper${colors.reset}`);
      }
    }
  }

  async createMainCLI(targetPath, _components, _mode) {
    const targetCliDir = path.join(targetPath, 'cli');
    const targetIndexJs = path.join(targetCliDir, 'index.js');

    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy the main CLI dispatcher
    const sourceIndexJs = path.join(__dirname, '..', 'index.js');
    fs.copyFileSync(sourceIndexJs, targetIndexJs);

    // Make it executable
    fs.chmodSync(targetIndexJs, '755');

    console.log(`${colors.green}  ✅ Installed main CLI${colors.reset}`);
  }

  async setupPackageJson(targetPath) {
    const packageJsonPath = path.join(targetPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      console.log(
        `${colors.yellow}  package.json already exists, skipping...${colors.reset}`
      );
      return;
    }

    const packageJson = {
      name: `${path.basename(targetPath)}-supernal`,
      version: '0.1.0',
      description: 'Project enhanced with Supernal Coding system',
      main: 'supernal-code-package/lib/cli/index.js',
      bin: {
        sc: './supernal-code-package/lib/cli/index.js'
      },
      scripts: {
        test: 'echo "No tests specified"',
        'install-global': 'npm install -g .',
        'uninstall-global': `npm uninstall -g ${path.basename(targetPath)}-supernal`
      },
      dependencies: {
        commander: '^9.0.0',
        chalk: '^4.1.0'
      }
    };

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`${colors.green}  ✅ Created package.json${colors.reset}`);
  }

  createKanbanStructure(kanbanDir) {
    const dirs = [
      'BRAINSTORM',
      'PLANNING',
      'TODO',
      'DOING',
      'BLOCKED',
      'DONE',
      'HANDOFFS'
    ];

    dirs.forEach((dir) => {
      const dirPath = path.join(kanbanDir, dir);
      const archivePath = path.join(dirPath, 'ARCHIVE');

      fs.mkdirSync(dirPath, { recursive: true });
      fs.mkdirSync(archivePath, { recursive: true });
    });

    // Create README
    const readmePath = path.join(kanbanDir, 'README.md');
    const readmeContent = `# Kanban System

This directory contains the kanban task management system.

## Usage

Use the \`sc kanban\` command to interact with this system:

\`\`\`bash
sc kanban list              # Show all tasks
sc kanban todo "new task"   # Create new task
sc kanban priority next     # Show next priority task
\`\`\`

See \`sc kanban --help\` for full documentation.
`;
    fs.writeFileSync(readmePath, readmeContent);
  }

  copyDirectory(src, dest) {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true });
    }
    fs.mkdirSync(dest, { recursive: true });

    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);

      if (fs.statSync(srcPath).isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// CLI Interface
async function main(targetPath, options) {
  const installer = new InstallManager();
  await installer.install(targetPath, options);
}

if (require.main === module) {
  const targetPath = process.argv[2];
  const options = {};

  if (!targetPath) {
    console.error(
      `${colors.red}❌ Usage: sc install <target-path> [options]${colors.reset}`
    );
    process.exit(1);
  }

  // Parse options
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--force') {
      options.force = true;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    } else if (arg.startsWith('--components=')) {
      options.components = arg.split('=')[1];
    }
  }

  main(targetPath, options);
}

module.exports = main;
