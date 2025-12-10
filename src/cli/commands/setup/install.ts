import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';

interface InstallOptions {
  mode?: 'copy' | 'link';
  components?: string;
  force?: boolean;
}

class InstallManager {
  sourceRoot: string;
  kanbanScriptsDir: string;
  docsScriptsDir: string;
  gitHooksScriptsDir: string;
  devScriptsDir: string;
  templatesDir: string;

  constructor() {
    this.sourceRoot = path.join(__dirname, '..', '..');
    this.kanbanScriptsDir = path.join(__dirname, 'kanban-scripts');
    this.docsScriptsDir = path.join(__dirname, 'docs-scripts');
    this.gitHooksScriptsDir = path.join(__dirname, 'git-hooks-scripts');
    this.devScriptsDir = path.join(__dirname, 'dev-scripts');
    this.templatesDir = path.join(this.sourceRoot, 'templates');
  }

  async install(targetPath: string, options: InstallOptions = {}): Promise<void> {
    const { mode = 'copy', components = 'all', force = false } = options;

    console.log(
      chalk.blue('[INSTALL] Installing Supernal Coding system...')
    );
    console.log(chalk.cyan(`Target: ${targetPath}`));
    console.log(chalk.cyan(`Mode: ${mode}`));
    console.log(chalk.cyan(`Components: ${components}`));
    console.log('');

    // Validate target path
    if (!fs.existsSync(targetPath)) {
      console.error(
        chalk.red(`[ERROR] Target directory does not exist: ${targetPath}`)
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
      console.log(chalk.green('[OK] Installation complete!'));
      console.log('');
      console.log(chalk.bold('Next steps:'));
      console.log(`  cd ${targetAbsolute}`);
      console.log(`  npm install                     # Install dependencies`);
      console.log(
        `  npm install -g .                # Install globally (optional)`
      );
      console.log(`  sc kanban list   # Test kanban system`);
    } catch (error) {
      const err = error as Error;
      console.error(
        chalk.red('[ERROR] Installation failed:'),
        err.message
      );
      process.exit(1);
    }
  }

  async installComponent(component: string, targetPath: string, mode: string, force: boolean): Promise<void> {
    console.log(
      chalk.blue(`[PACKAGE] Installing ${component} component...`)
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
          chalk.yellow(`[WARN] Unknown component: ${component}`)
        );
    }
  }

  async installKanban(targetPath: string, mode: string, force: boolean): Promise<void> {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');
    const targetKanbanDir = path.join(targetCliDir, 'kanban-scripts');

    // Ensure directories exist
    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy or link kanban scripts
    if (mode === 'link') {
      if (fs.existsSync(targetKanbanDir) && !force) {
        console.log(
          chalk.yellow('  Kanban scripts already exist, skipping...')
        );
        return;
      }
      if (fs.existsSync(targetKanbanDir))
        fs.rmSync(targetKanbanDir, { recursive: true });
      fs.symlinkSync(this.kanbanScriptsDir, targetKanbanDir);
      console.log(chalk.green('  [OK] Linked kanban scripts'));
    } else {
      if (fs.existsSync(targetKanbanDir) && !force) {
        console.log(
          chalk.yellow('  Kanban scripts already exist, skipping...')
        );
        return;
      }
      this.copyDirectory(this.kanbanScriptsDir, targetKanbanDir);
      console.log(chalk.green('  [OK] Copied kanban scripts'));
    }

    // Copy kanban.js wrapper
    const sourceKanbanJs = path.join(__dirname, 'kanban.js');
    const targetKanbanJs = path.join(targetCliDir, 'kanban.js');
    fs.copyFileSync(sourceKanbanJs, targetKanbanJs);
    console.log(chalk.green('  [OK] Installed kanban wrapper'));

    // Create kanban directory structure
    const docsKanbanDir = path.join(targetPath, 'docs', 'kanban');
    this.createKanbanStructure(docsKanbanDir);
    console.log(
      chalk.green('  [OK] Created kanban directory structure')
    );
  }

  async installDocs(targetPath: string, mode: string, force: boolean): Promise<void> {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');
    const targetDocsDir = path.join(targetCliDir, 'docs-scripts');

    // Ensure directories exist
    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy or link docs scripts
    if (mode === 'link') {
      if (fs.existsSync(targetDocsDir) && !force) {
        console.log(
          chalk.yellow('  Docs scripts already exist, skipping...')
        );
        return;
      }
      if (fs.existsSync(targetDocsDir))
        fs.rmSync(targetDocsDir, { recursive: true });
      fs.symlinkSync(this.docsScriptsDir, targetDocsDir);
      console.log(chalk.green('  [OK] Linked docs scripts'));
    } else {
      if (fs.existsSync(targetDocsDir) && !force) {
        console.log(
          chalk.yellow('  Docs scripts already exist, skipping...')
        );
        return;
      }
      this.copyDirectory(this.docsScriptsDir, targetDocsDir);
      console.log(chalk.green('  [OK] Copied docs scripts'));
    }

    // Copy docs.js wrapper
    const sourceDocsJs = path.join(__dirname, 'docs.js');
    const targetDocsJs = path.join(targetCliDir, 'docs.js');
    fs.copyFileSync(sourceDocsJs, targetDocsJs);
    console.log(chalk.green('  [OK] Installed docs wrapper'));
  }

  async installValidation(targetPath: string, _mode: string, force: boolean): Promise<void> {
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
      const destPath = path.join(targetCliDir, command);

      if (fs.existsSync(sourcePath)) {
        if (!fs.existsSync(destPath) || force) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(
            chalk.green(`  [OK] Installed ${command}`)
          );
        } else {
          console.log(
            chalk.yellow(`  ${command} already exists, skipping...`)
          );
        }
      }
    }
  }

  async installTemplates(targetPath: string, mode: string, force: boolean): Promise<void> {
    const targetTemplatesDir = path.join(targetPath, 'templates');

    if (mode === 'link') {
      if (fs.existsSync(targetTemplatesDir) && !force) {
        console.log(
          chalk.yellow('  Templates already exist, skipping...')
        );
        return;
      }
      if (fs.existsSync(targetTemplatesDir))
        fs.rmSync(targetTemplatesDir, { recursive: true });
      fs.symlinkSync(this.templatesDir, targetTemplatesDir);
      console.log(chalk.green('  [OK] Linked templates'));
    } else {
      if (fs.existsSync(targetTemplatesDir) && !force) {
        console.log(
          chalk.yellow('  Templates already exist, skipping...')
        );
        return;
      }
      this.copyDirectory(this.templatesDir, targetTemplatesDir);
      console.log(chalk.green('  [OK] Copied templates'));
    }
  }

  async installGitHooks(targetPath: string, mode: string, force: boolean): Promise<void> {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');
    const targetGitHooksDir = path.join(targetCliDir, 'git-hooks-scripts');
    const targetGitHooksWrapper = path.join(targetCliDir, 'git-hooks.js');

    // Ensure directories exist
    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy or link git hooks scripts
    if (mode === 'link') {
      if (fs.existsSync(targetGitHooksDir) && !force) {
        console.log(
          chalk.yellow('  Git hooks scripts already exist, skipping...')
        );
        return;
      }
      if (fs.existsSync(targetGitHooksDir))
        fs.rmSync(targetGitHooksDir, { recursive: true });
      fs.symlinkSync(this.gitHooksScriptsDir, targetGitHooksDir);
      console.log(
        chalk.green('  [OK] Linked git hooks scripts')
      );
    } else {
      if (fs.existsSync(targetGitHooksDir) && !force) {
        console.log(
          chalk.yellow('  Git hooks scripts already exist, skipping...')
        );
        return;
      }
      this.copyDirectory(this.gitHooksScriptsDir, targetGitHooksDir);
      console.log(
        chalk.green('  [OK] Copied git hooks scripts')
      );
    }

    // Copy git hooks wrapper
    const sourceGitHooksWrapper = path.join(__dirname, 'git-hooks.js');
    if (fs.existsSync(sourceGitHooksWrapper)) {
      if (fs.existsSync(targetGitHooksWrapper) && !force) {
        console.log(
          chalk.yellow('  Git hooks wrapper already exists, skipping...')
        );
      } else {
        fs.copyFileSync(sourceGitHooksWrapper, targetGitHooksWrapper);
        console.log(
          chalk.green('  [OK] Copied git hooks wrapper')
        );
      }
    }
  }

  async installDevTools(targetPath: string, mode: string, force: boolean): Promise<void> {
    const targetCliDir = path.join(targetPath, 'cli', 'commands');
    const targetDevScriptsDir = path.join(targetCliDir, 'dev-scripts');
    const targetDevWrapper = path.join(targetCliDir, 'dev.js');

    // Ensure directories exist
    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy or link dev scripts
    if (mode === 'link') {
      if (fs.existsSync(targetDevScriptsDir) && !force) {
        console.log(
          chalk.yellow('  Dev scripts already exist, skipping...')
        );
        return;
      }
      if (fs.existsSync(targetDevScriptsDir))
        fs.rmSync(targetDevScriptsDir, { recursive: true });
      fs.symlinkSync(this.devScriptsDir, targetDevScriptsDir);
      console.log(chalk.green('  [OK] Linked dev scripts'));
    } else {
      if (fs.existsSync(targetDevScriptsDir) && !force) {
        console.log(
          chalk.yellow('  Dev scripts already exist, skipping...')
        );
        return;
      }
      this.copyDirectory(this.devScriptsDir, targetDevScriptsDir);
      console.log(chalk.green('  [OK] Copied dev scripts'));
    }

    // Copy dev tools wrapper
    const sourceDevWrapper = path.join(__dirname, 'dev.js');
    if (fs.existsSync(sourceDevWrapper)) {
      if (fs.existsSync(targetDevWrapper) && !force) {
        console.log(
          chalk.yellow('  Dev wrapper already exists, skipping...')
        );
      } else {
        fs.copyFileSync(sourceDevWrapper, targetDevWrapper);
        console.log(chalk.green('  [OK] Copied dev wrapper'));
      }
    }
  }

  async createMainCLI(targetPath: string, _components: string[], _mode: string): Promise<void> {
    const targetCliDir = path.join(targetPath, 'cli');
    const targetIndexJs = path.join(targetCliDir, 'index.js');

    fs.mkdirSync(targetCliDir, { recursive: true });

    // Copy the main CLI dispatcher
    const sourceIndexJs = path.join(__dirname, '..', 'index.js');
    fs.copyFileSync(sourceIndexJs, targetIndexJs);

    // Make it executable
    fs.chmodSync(targetIndexJs, '755');

    console.log(chalk.green('  [OK] Installed main CLI'));
  }

  async setupPackageJson(targetPath: string): Promise<void> {
    const packageJsonPath = path.join(targetPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      console.log(
        chalk.yellow('  package.json already exists, skipping...')
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
    console.log(chalk.green('  [OK] Created package.json'));
  }

  createKanbanStructure(kanbanDir: string): void {
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

  copyDirectory(src: string, dest: string): void {
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
async function main(targetPath: string, options: InstallOptions): Promise<void> {
  const installer = new InstallManager();
  await installer.install(targetPath, options);
}

if (require.main === module) {
  const targetPath = process.argv[2];
  const options: InstallOptions = {};

  if (!targetPath) {
    console.error(
      chalk.red('[ERROR] Usage: sc install <target-path> [options]')
    );
    process.exit(1);
  }

  // Parse options
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--force') {
      options.force = true;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1] as 'copy' | 'link';
    } else if (arg.startsWith('--components=')) {
      options.components = arg.split('=')[1];
    }
  }

  main(targetPath, options);
}

export { InstallManager, main };

module.exports = main;
