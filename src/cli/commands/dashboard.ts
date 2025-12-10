// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { spawn } = require('node:child_process');
const { findGitRoot } = require('../utils/git-utils');
const net = require('node:net');

/**
 * Dashboard command handler for sc dashboard system
 * Integrates with existing YAML configuration and templates
 * Now includes port scanning and service management functionality
 */
class DashboardManager {
  config: any;
  configLoader: any;
  projectRoot: any;
  runningProcesses: any;
  constructor() {
    // ALWAYS start from current working directory - the user's intent
    const cwd = process.cwd();
    
    // Find git root starting from cwd (not from script location)
    this.projectRoot = findGitRoot(cwd);
    if (!this.projectRoot) {
      // If no git repo found, use cwd directly
      console.warn('⚠️  Not in a git repository, using current directory');
      this.projectRoot = cwd;
    }
    
    // Verify we're using the user's intended directory
    if (this.projectRoot !== cwd) {
      console.log(chalk.gray(`📂 Working directory: ${cwd}`));
      console.log(chalk.gray(`📂 Git root: ${this.projectRoot}`));
    }
    
    this.config = null;
    this.configLoader = null;
    this.loadConfig();
    this.runningProcesses = [];
  }

  /**
   * Find dashboard in package installation
   * Supports both development mode and installed package
   * @returns {Object} - Object with path and mode
   */
  findPackageDashboard() {
    // Strategy 1: Development mode (running from supernal-coding repo)
    if (this.projectRoot.includes('supernal-coding')) {
      const devDashboard = path.join(this.projectRoot, 'apps', 'supernal-dashboard');
      if (fs.existsSync(devDashboard)) {
        return { path: devDashboard, mode: 'development' };
      }
    }

    // Strategy 2: Package installation (via require.resolve)
    try {
      const pkgJson = require.resolve('supernal-coding/package.json');
      const pkgRoot = path.dirname(pkgJson);
      const pkgDashboard = path.join(pkgRoot, 'apps', 'supernal-dashboard');

      if (fs.existsSync(pkgDashboard)) {
        return { path: pkgDashboard, mode: 'package' };
      }
    } catch (_error) {
      // Package not found via require.resolve
    }

    // Strategy 3: Relative path from this file (fallback)
    const relativeDashboard = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'apps',
      'supernal-dashboard'
    );

    if (fs.existsSync(relativeDashboard)) {
      return { path: relativeDashboard, mode: 'relative' };
    }

    throw new Error(
      'Dashboard not found. Is supernal-coding installed? Tried:\n' +
        `  - Development: ${path.join(this.projectRoot, 'apps', 'supernal-dashboard')}\n` +
        `  - Package: require.resolve('supernal-coding/package.json')\n` +
        `  - Relative: ${relativeDashboard}`
    );
  }

  /**
   * Check if a port is available
   * @param {number} port - Port to check
   * @param {string} host - Host to check (default: '0.0.0.0')
   * @returns {Promise<boolean>} - True if port is available
   */
  isPortAvailable(port, host = '0.0.0.0') {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.listen(port, host, () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });

      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Kill processes using a specific port
   * @param {number} port - Port to free up
   * @returns {Promise<void>}
   */
  async killPort(port) {
    const { execSync } = require('node:child_process');
    
    try {
      // Find processes using the port
      const result = execSync(`lsof -ti:${port}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const pids = result
        .trim()
        .split('\n')
        .filter((pid) => pid);

      if (pids.length > 0) {
        for (const pid of pids) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
          } catch (_error) {
            // Process might already be dead
          }
        }
        // Wait for processes to die
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log(chalk.green(`   ✓ Port ${port} freed`));
      }
    } catch (_error) {
      // No processes found on this port, which is fine
    }
  }

  /**
   * Find the next available port starting from a given port
   * @param {number} startPort - Starting port number
   * @param {string} host - Host to check (default: '0.0.0.0')
   * @param {number} maxAttempts - Maximum number of ports to try (default: 100)
   * @returns {Promise<number>} - Available port number
   */
  async findAvailablePort(startPort, host = '0.0.0.0', maxAttempts = 100) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      if (await this.isPortAvailable(port, host)) {
        return port;
      }
    }
    throw new Error(
      `No available port found starting from ${startPort} after ${maxAttempts} attempts`
    );
  }

  /**
   * Check if preferred ports are available - NO FALLBACKS
   * @param {Object} services - Object with service names and preferred ports
   * @returns {Promise<Object>} - Object with service names and assigned ports
   */
  async findAvailablePorts(services) {
    const result = {};

    for (const [serviceName, preferredPort] of Object.entries(services)) {
      if (await this.isPortAvailable(preferredPort)) {
        result[serviceName] = preferredPort;
        console.log(`📡 ${serviceName}: Port ${preferredPort} (preferred)`);
      } else {
        throw new Error(
          `❌ Port ${preferredPort} for ${serviceName} is not available. Use --kill-conflicts to free up ports.`
        );
      }
    }

    return result;
  }

  /**
   * Load project configuration from supernal.yaml
   */
  loadConfig() {
    try {
      const configPath = path.join(this.projectRoot, 'supernal.yaml');

      if (fs.existsSync(configPath)) {
        // Use YAML config loader
        const { loadProjectConfig } = require('../utils/config-loader');
        this.config = loadProjectConfig(this.projectRoot);
      } else {
        console.error(
          chalk.red(
            `❌ No supernal.yaml found at ${this.projectRoot}`
          )
        );
        console.error(chalk.gray('   Dashboard requires a supernal.yaml config file.'));
        console.error(chalk.gray('   Run `sc init` to create one.'));
        throw new Error('Config file required for dashboard');
      }
    } catch (error) {
      console.error(chalk.red(`❌ Could not load config: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get default configuration when YAML config is not available
   */
  getDefaultConfig() {
    return {
      getRequirementsDirectory: () => 'requirements',
      getKanbanBaseDirectory: () => 'kanban',
      get: (_key, defaultValue) => defaultValue,
      project: {
        name: path.basename(this.projectRoot),
        version: '1.0.0',
      },
    };
  }

  /**
   * Initialize dashboard in current project (COPY MODE for customization)
   * By default, sc dashboard serve uses package dashboard (no init needed)
   */
  async init(options = {}) {
    try {
      // If --copy flag not provided, explain hybrid approach
      if (!options.copy) {
        console.log(chalk.yellow('\n💡 Dashboard Init Not Needed!'));
        console.log(
          chalk.white(
            '\n   By default, `sc dashboard serve` uses the package dashboard.'
          )
        );
        console.log(
          chalk.white(
            "   It automatically reads your repo's docs/requirements."
          )
        );
        console.log(
          chalk.white(
            '   The dashboard auto-updates when you upgrade supernal-coding.'
          )
        );
        console.log(chalk.white('\n   ✅ Try it now:'));
        console.log(chalk.cyan('      sc dashboard serve'));
        console.log(
          chalk.white(
            '\n   Only use `--copy` if you need to customize the dashboard:'
          )
        );
        console.log(chalk.cyan('      sc dashboard init --copy'));
        console.log(
          chalk.gray(
            '\n   ⚠️  Copy mode means you manually maintain dashboard code.'
          )
        );
        return { success: true, message: 'Init not needed - use runtime mode' };
      }

      // COPY MODE: Copy dashboard for customization
      console.log(chalk.blue('\n📋 Copying dashboard for customization...'));
      console.log(
        chalk.yellow('⚠️  You will need to manually update dashboard code')
      );
      console.log(
        chalk.yellow('⚠️  Auto-updates from package upgrades will NOT apply')
      );

      const targetPath = path.join(this.projectRoot, 'apps', 'supernal-dashboard');

      // Check if already exists
      if (await fs.pathExists(targetPath)) {
        if (!options.force) {
          console.log(
            chalk.red('\n❌ Dashboard already exists at apps/supernal-dashboard/')
          );
          console.log(chalk.white('   Use --force to overwrite:'));
          console.log(chalk.cyan('      sc dashboard init --copy --force'));
          return { success: false, error: 'Dashboard already exists' };
        }
        console.log(chalk.yellow('   Overwriting existing dashboard...'));
        await fs.remove(targetPath);
      }

      // Find and copy package dashboard
      const { path: sourcePath, mode } = this.findPackageDashboard();
      console.log(chalk.gray(`   Source: ${sourcePath} (${mode})`));
      console.log(chalk.gray(`   Target: ${targetPath}`));

      await fs.copy(sourcePath, targetPath);

      console.log(chalk.green('\n✅ Dashboard copied successfully!'));
      console.log(chalk.white(`   Location: apps/supernal-dashboard/`));
      console.log(
        chalk.white('\n   Now you can customize the dashboard code.')
      );
      console.log(chalk.white('\n   To serve your custom dashboard:'));
      console.log(chalk.cyan('      sc dashboard serve'));
      console.log(chalk.gray('\n   To revert to auto-updating runtime mode:'));
      console.log(chalk.gray('      rm -rf apps/supernal-dashboard/'));

      return { success: true, dashboardPath: targetPath };
    } catch (error) {
      console.error(
        chalk.red('❌ Dashboard initialization failed:'),
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Create Dashboard v2 project using sc runtime (dogfooding approach)
   */
  async createDashboardV2Project(dashboardDir, options = {}) {
    try {
      console.log(
        chalk.blue('📋 Creating Dashboard v2 project (using sc runtime)')
      );

      const projectName =
        this.config?.project?.name || path.basename(this.projectRoot);
      const projectDisplayName =
        options.displayName ||
        projectName.charAt(0).toUpperCase() + projectName.slice(1);

      // Create package.json that uses sc dashboard commands
      const packageJson = {
        name: `dashboard-${projectName}`,
        version: '0.1.0',
        private: true,
        description: `Dashboard for ${projectDisplayName} - powered by Supernal Coding`,
        scripts: {
          dev: 'sc dashboard serve',
          build: 'sc dashboard build',
          start: 'sc dashboard serve --production',
          serve: 'sc dashboard serve',
        },
        dependencies: {
          'supernal-code': 'file:../supernal-code-package',
        },
        engines: {
          node: '>=18.0.0',
        },
      };

      await fs.writeFile(
        path.join(dashboardDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create project-specific dashboard config
      await this.generateDashboardV2Config(dashboardDir, options);

      // Create README with instructions
      const readme = `# ${projectDisplayName} Dashboard

This dashboard is powered by **Supernal Coding** and uses the sc runtime.

## Development

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev
# or
sc dashboard serve

# Build for production
npm run build
# or  
sc dashboard build
\`\`\`

## Deployment

### Vercel
1. Create new Vercel project
2. Set Root Directory: \`dashboard\`
3. Framework: Next.js
4. Deploy

### Other Platforms
The dashboard uses \`sc dashboard build\` which creates a standard Next.js build.

## Configuration

Edit \`dashboard.config.js\` to customize:
- Project name and description
- Data source paths
- Deployment URLs

## How It Works

This dashboard uses the **sc runtime** from the supernal-code package:
- ✅ Same runtime locally and in production
- ✅ Automatic updates via \`npm update supernal-code\`
- ✅ True dogfooding - we use the same system
- ✅ No code duplication - runtime is in sc package

The dashboard reads your project data (requirements, kanban, config) and provides a modern web interface.
`;

      await fs.writeFile(path.join(dashboardDir, 'README.md'), readme);

      // Create .gitignore
      const gitignore = `node_modules/
.next/
out/
.vercel/
.env.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;

      await fs.writeFile(path.join(dashboardDir, '.gitignore'), gitignore);

      console.log(chalk.green('✅ Dashboard v2 project created successfully'));
      console.log(
        chalk.yellow(
          '💡 This project uses the sc runtime - no code duplication!'
        )
      );
      console.log(
        chalk.yellow('💡 Run: cd dashboard && npm install && npm run dev')
      );
      console.log(
        chalk.yellow('💡 Deploy: Set Vercel Root Directory to "dashboard"')
      );
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to create Dashboard v2 project:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Copy Dashboard v2 (Next.js) template for separate deployment (DEPRECATED)
   */
  async copyDashboardV2Template(dashboardDir, options = {}) {
    try {
      console.log(chalk.blue('📋 Using Dashboard v2 (Next.js) template'));

      // Source: apps/supernal-dashboard in the supernal-coding repo
      const templatePath = path.join(this.projectRoot, 'apps', 'supernal-dashboard');

      if (!(await fs.pathExists(templatePath))) {
        console.error(
          chalk.red(`❌ Dashboard v2 template not found at: ${templatePath}`)
        );
        console.error(
          chalk.red(
            'This command should be run from a supernal-coding repository.'
          )
        );
        console.error(chalk.red('Available directories:'));
        try {
          const dirs = await fs.readdir(this.projectRoot);
          dirs.forEach((dir) => console.error(chalk.yellow(`  - ${dir}`)));
        } catch (_e) {
          console.error(chalk.red('Could not list directories'));
        }
        throw new Error(
          'Dashboard v2 template not found. This command should be run from a supernal-coding repository.'
        );
      }

      // Copy entire Dashboard v2 directory
      await fs.copy(templatePath, dashboardDir, {
        filter: (src) => {
          // Skip node_modules, .next, and other build artifacts
          const relativePath = path.relative(templatePath, src);
          return (
            !relativePath.includes('node_modules') &&
            !relativePath.includes('.next') &&
            !relativePath.includes('out') &&
            !relativePath.includes('.vercel')
          );
        },
      });

      // Generate project-specific configuration
      await this.generateDashboardV2Config(dashboardDir, options);

      console.log(chalk.green('✅ Dashboard v2 template copied successfully'));
      console.log(
        chalk.yellow('💡 Dashboard v2 is a Next.js app with API routes')
      );
      console.log(chalk.yellow('💡 Deploy separately to your own domain'));
      console.log(
        chalk.yellow('💡 Run: cd dashboard && npm install && npm run dev')
      );
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to copy Dashboard v2 template:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Copy the beautiful dashboard template from packages/dashboard-sdk
   */
  async copyWorkingDashboardTemplate(dashboardDir) {
    try {
      // Use the proper template from packages/dashboard-sdk
      const templatePath = path.join(
        this.projectRoot,
        'packages',
        'dashboard-sdk',
        'templates',
        'github-pages',
        'index.html'
      );

      if (await fs.pathExists(templatePath)) {
        console.log(
          chalk.blue(
            '📋 Using beautiful dashboard template from packages/dashboard-sdk'
          )
        );

        // Read the template
        let templateContent = await fs.readFile(templatePath, 'utf8');

        // Apply template variable replacements
        const variables = this.getTemplateVariables();
        for (const [key, value] of Object.entries(variables)) {
          const placeholder = `{{${key}}}`;
          templateContent = templateContent.replace(
            new RegExp(placeholder, 'g'),
            value
          );
        }

        // Write the processed template
        await fs.writeFile(
          path.join(dashboardDir, 'index.html'),
          templateContent
        );

        console.log(
          chalk.green('✅ Created beautiful dashboard from template')
        );
        console.log(
          chalk.yellow(
            '💡 Dashboard uses modern design with gradients and glass morphism'
          )
        );
      } else {
        console.log(
          chalk.yellow(
            '⚠️  Dashboard SDK template not found, creating redirect'
          )
        );

        // Fallback to redirect if template not found
        const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PROJECT_NAME}} - Dashboard</title>
    <script>
        // Redirect to supernal-dashboard (local or production)
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const dashboardUrl = isLocal 
            ? 'http://localhost:3006/' 
            : 'https://supernal-dashboard-supernal-coding.vercel.app/';
        window.location.href = dashboardUrl;
    </script>
</head>
<body>
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
        <h1>Redirecting to Dashboard v2...</h1>
        <p>Loading the modern dashboard...</p>
    </div>
</body>
</html>`;

        await fs.writeFile(path.join(dashboardDir, 'index.html'), redirectHtml);
        console.log(chalk.yellow('💡 Created fallback redirect'));
      }
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to copy dashboard template:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Generate Dashboard v2 configuration for this project
   */
  async generateDashboardV2Config(dashboardDir, options = {}) {
    try {
      const projectName =
        this.config.project?.name || path.basename(this.projectRoot);
      const projectDisplayName =
        options.displayName ||
        projectName.charAt(0).toUpperCase() + projectName.slice(1);

      // Generate dashboard.config.js
      const configContent = `/**
 * Dashboard v2 Configuration for ${projectName}
 * Generated by: sc dashboard init --template=supernal-dashboard
 */

const config = {
  // Project Information
  project: {
    name: process.env.PROJECT_NAME || '${projectName}',
    displayName: process.env.PROJECT_DISPLAY_NAME || '${projectDisplayName}',
    description: process.env.PROJECT_DESCRIPTION || 'Project dashboard and requirements tracking',
  },

  // API Configuration
  api: {
    baseUrl: process.env.API_BASE_URL || '/api',
    repoId: process.env.REPO_ID || '${projectName}',
  },

  // Deployment URLs (configure for your domain)
  urls: {
    dashboard: process.env.DASHBOARD_URL || 'https://dashboard.${projectName}.com',
    documentation: process.env.DOCUMENTATION_URL || 'https://${projectName}.com',
    api: process.env.API_URL || 'https://dashboard.${projectName}.com/api',
  },

  // Data Source Paths (relative to project root)
  paths: {
    requirements: process.env.REQUIREMENTS_PATH || '${this.configLoader.getRequirementsDirectory()}',
    kanban: process.env.KANBAN_PATH || '${this.configLoader.getKanbanBaseDirectory()}',
    config: process.env.CONFIG_PATH || 'supernal.yaml',
    projectRoot: process.cwd(),
  },

  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = config;`;

      await fs.writeFile(
        path.join(dashboardDir, 'dashboard.config.js'),
        configContent
      );

      // Generate vercel.json for deployment
      const vercelConfig = {
        version: 2,
        name: `dashboard-${projectName}`,
        builds: [{ src: 'package.json', use: '@vercel/next' }],
        env: {
          PROJECT_NAME: projectName,
          PROJECT_DISPLAY_NAME: projectDisplayName,
          PROJECT_DESCRIPTION: 'Project dashboard and requirements tracking',
          REPO_ID: projectName,
          DASHBOARD_URL: `https://dashboard.${projectName}.com`,
          DOCUMENTATION_URL: `https://${projectName}.com`,
          API_URL: `https://dashboard.${projectName}.com/api`,
          REQUIREMENTS_PATH: this.configLoader.getRequirementsDirectory(),
          KANBAN_PATH: this.configLoader.getKanbanBaseDirectory(),
          CONFIG_PATH: 'supernal.yaml',
        },
        functions: {
          'src/app/api/**/*.ts': { maxDuration: 30 },
        },
      };

      await fs.writeFile(
        path.join(dashboardDir, 'vercel.json'),
        JSON.stringify(vercelConfig, null, 2)
      );

      console.log(chalk.green('✅ Generated project-specific configuration'));
      console.log(
        chalk.yellow(`💡 Configure your domain: dashboard.${projectName}.com`)
      );
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to generate Dashboard v2 config:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Update dashboard configuration for this specific project
   */
  async updateDashboardForProject(dashboardDir, options = {}) {
    const serverPath = path.join(dashboardDir, 'server.js');
    const indexPath = path.join(dashboardDir, 'index.html');

    // Get template variables
    const templateVars = this.getTemplateVariables();

    // Update server.js with template variable replacement
    if (await fs.pathExists(serverPath)) {
      let serverContent = await fs.readFile(serverPath, 'utf8');
      serverContent = this.replaceTemplateVariables(
        serverContent,
        templateVars
      );
      await fs.writeFile(serverPath, serverContent);
      console.log(
        chalk.green('✅ Updated server configuration for this project')
      );
    }

    // Update index.html with template variable replacement
    if (await fs.pathExists(indexPath)) {
      let htmlContent = await fs.readFile(indexPath, 'utf8');
      htmlContent = this.replaceTemplateVariables(htmlContent, templateVars);
      await fs.writeFile(indexPath, htmlContent);
      console.log(chalk.green('✅ Updated dashboard HTML for this project'));
    }

    // Create dashboard configuration file
    await this.createDashboardConfig(dashboardDir, options);
  }

  /**
   * Create dashboard configuration file
   */
  async createDashboardConfig(dashboardDir, options = {}) {
    const configPath = path.join(dashboardDir, 'dashboard.config.json');

    const config = {
      version: '1.0.0',
      embedded: {
        enabled: !options.disableEmbedded,
        description: options.disableEmbedded
          ? 'Embedded dashboard disabled for deployment'
          : 'Embedded dashboard enabled for documentation integration',
      },
      deployment: {
        githubPages: false,
        vercel: false,
      },
      server: {
        defaultPort: 3002,
        cors: true,
      },
      generated: {
        timestamp: new Date().toISOString(),
        by: 'sc dashboard init',
      },
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    if (options.disableEmbedded) {
      console.log(
        chalk.yellow(
          '⚠️  Embedded dashboard disabled - documentation will show alternative access methods'
        )
      );
    } else {
      console.log(
        chalk.green(
          '✅ Embedded dashboard enabled for documentation integration'
        )
      );
    }

    console.log(chalk.green('✅ Created dashboard configuration'));
  }

  /**
   * Show diff between existing dashboard and new template
   */
  async showDashboardDiff(existingDashboardDir) {
    try {
      console.log(chalk.blue('\n📋 Dashboard Changes Preview:'));

      const templatesSource = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'templates',
        'dashboard'
      );
      const variables = this.getTemplateVariables();

      // Key files to check for differences
      const filesToCheck = [
        { name: 'index.html', description: 'Dashboard HTML' },
        { name: 'server.js', description: 'API Server' },
        { name: 'package.json', description: 'Dependencies' },
      ];

      let hasChanges = false;

      for (const file of filesToCheck) {
        const existingPath = path.join(existingDashboardDir, file.name);
        const templatePath = path.join(templatesSource, file.name);

        if (
          (await fs.pathExists(existingPath)) &&
          (await fs.pathExists(templatePath))
        ) {
          const existingContent = await fs.readFile(existingPath, 'utf8');
          let templateContent = await fs.readFile(templatePath, 'utf8');

          // Apply template variables to new content
          templateContent = this.replaceTemplateVariables(
            templateContent,
            variables
          );

          if (existingContent !== templateContent) {
            hasChanges = true;
            console.log(
              chalk.yellow(`\n📄 ${file.description} (${file.name}):`)
            );

            // Show actual diff content
            this.showFileDiff(existingContent, templateContent, file.name);
          }
        } else if (await fs.pathExists(templatePath)) {
          hasChanges = true;
          console.log(
            chalk.green(`\n📄 ${file.description} (${file.name}): NEW FILE`)
          );
        }
      }

      if (!hasChanges) {
        console.log(
          chalk.green('   ✅ No changes detected - dashboard is up to date')
        );
      } else {
        console.log(chalk.blue('\n📊 Summary:'));
        console.log(`   • Template version: ${variables['template.version']}`);
        console.log(
          `   • Generation time: ${new Date(variables['generation.timestamp']).toLocaleString()}`
        );
      }
    } catch (error) {
      console.log(
        chalk.gray(`   (Unable to preview changes: ${error.message})`)
      );
    }
  }

  /**
   * Show actual diff between two file contents
   */
  showFileDiff(existingContent, newContent, _filename) {
    const existingLines = existingContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple line-by-line diff
    const maxLines = Math.max(existingLines.length, newLines.length);
    let diffCount = 0;
    const maxDiffLines = 10; // Limit output

    for (let i = 0; i < maxLines && diffCount < maxDiffLines; i++) {
      const existingLine = existingLines[i] || '';
      const newLine = newLines[i] || '';

      if (existingLine !== newLine) {
        diffCount++;

        if (existingLine && !newLine) {
          // Line removed
          console.log(chalk.red(`   -${i + 1}: ${existingLine.trim()}`));
        } else if (!existingLine && newLine) {
          // Line added
          console.log(chalk.green(`   +${i + 1}: ${newLine.trim()}`));
        } else {
          // Line changed
          console.log(chalk.red(`   -${i + 1}: ${existingLine.trim()}`));
          console.log(chalk.green(`   +${i + 1}: ${newLine.trim()}`));
        }
      }
    }

    if (diffCount >= maxDiffLines) {
      const remainingChanges =
        Math.abs(existingLines.length - newLines.length) +
        existingLines.filter((line, i) => line !== (newLines[i] || '')).length -
        diffCount;
      if (remainingChanges > 0) {
        console.log(chalk.gray(`   ... and ${remainingChanges} more changes`));
      }
    }

    // Summary
    const linesAdded = newLines.length - existingLines.length;
    if (linesAdded > 0) {
      console.log(chalk.green(`   📊 +${linesAdded} lines added`));
    } else if (linesAdded < 0) {
      console.log(chalk.red(`   📊 ${linesAdded} lines removed`));
    }

    if (diffCount > 0) {
      console.log(chalk.blue(`   📊 ${diffCount} lines changed`));
    }
  }

  /**
   * Get template variables for the current project
   */
  getTemplateVariables() {
    if (!this.config.project?.name) {
      throw new Error(
        'Project name not found in config. Config must be loaded properly.'
      );
    }
    const projectName = this.config.project.name;
    const reqDir = this.configLoader.getRequirementsDirectory();
    const kanbanDir = this.configLoader.getKanbanBaseDirectory();

    // Generate header comment
    const header = `<!--

    🤖 GENERATED FILE - DO NOT EDIT MANUALLY

    

    This dashboard was generated by: sc dashboard init

    Generated on: ${new Date().toISOString()}

    Template version: 1.0.0

    

    To update this dashboard:

    - Run: sc dashboard update

    - Or regenerate: sc dashboard init -y --force

    

    Source template: supernal-code-package/templates/dashboard/

-->`;

    return {
      PROJECT_NAME: projectName,
      LAST_UPDATED: new Date().toLocaleString(),
      DASHBOARD_DATA: '{}', // Empty object for now, can be populated with actual data later
      'project.name': projectName,
      'requirements.directory': reqDir,
      'kanban.directory': kanbanDir,
      'generation.timestamp': new Date().toISOString(),
      'template.version': '1.0.0',
      header: header,
    };
  }

  /**
   * Replace template variables in content
   */
  replaceTemplateVariables(content, variables) {
    let result = content;

    // Handle conditional blocks like {{#if header}}{{header}}{{/if}}
    for (const [key, value] of Object.entries(variables)) {
      // Handle conditional syntax
      const conditionalPattern = new RegExp(
        `\\{\\{#if ${key.replace('.', '\\.')}\\}\\}\\s*\\{\\{${key.replace('.', '\\.')}\\}\\}\\s*\\{\\{/if\\}\\}`,
        'gs'
      );
      if (value) {
        result = result.replace(conditionalPattern, value);
      } else {
        result = result.replace(conditionalPattern, '');
      }
    }

    // Replace all {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key.replace('.', '\\.')}\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }

    return result;
  }

  /**
   * Create basic dashboard templates
   */
  async createBasicTemplates(templatesDir) {
    // Copy the GitHub Pages template we created earlier
    const sdkTemplatePath = path.join(
      this.projectRoot,
      'packages/dashboard-sdk/templates/github-pages/index.html'
    );
    const targetPath = path.join(templatesDir, 'index.html.hbs');

    if (await fs.pathExists(sdkTemplatePath)) {
      let template = await fs.readFile(sdkTemplatePath, 'utf8');

      // Convert to Handlebars template
      template = template
        .replace(/{{PROJECT_NAME}}/g, '{{project.name}}')
        .replace(/{{LAST_UPDATED}}/g, '{{lastUpdated}}')
        .replace(/{{DASHBOARD_DATA}}/g, '{{{dashboardData}}}');

      await fs.writeFile(targetPath, template);
    } else {
      // Create minimal template
      const minimalTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>{{project.name}} - Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
        .stat { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
        .requirements { margin-top: 30px; }
        .req-item { padding: 10px; margin: 5px 0; background: #f9f9f9; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{project.name}} Dashboard</h1>
        <p>Requirements & Progress Tracking</p>
    </div>
    
    <div class="stats">
        <div class="stat">
            <h3>{{stats.total}}</h3>
            <p>Total Requirements</p>
        </div>
        <div class="stat">
            <h3>{{stats.completed}}</h3>
            <p>Completed</p>
        </div>
        <div class="stat">
            <h3>{{stats.progress}}%</h3>
            <p>Progress</p>
        </div>
        <div class="stat">
            <h3>{{currentPhase}}</h3>
            <p>Current Phase</p>
        </div>
    </div>
    
    <div class="requirements">
        <h2>Requirements</h2>
        {{#each requirements}}
        <div class="req-item">
            <strong>{{id}}: {{title}}</strong>
            <span style="float: right; background: #007acc; color: white; padding: 2px 8px; border-radius: 3px;">{{status}}</span>
            <br><small>{{category}} • {{priority}}</small>
        </div>
        {{/each}}
    </div>
    
    <footer style="margin-top: 40px; text-align: center; color: #666;">
        Generated by Supernal Dashboard • {{lastUpdated}}
    </footer>
</body>
</html>`;
      await fs.writeFile(targetPath, minimalTemplate);
    }
  }

  /**
   * Generate dashboard configuration
   */
  async generateDashboardConfig(dashboardDir) {
    const config = {
      project: {
        name: this.config.project.name,
        version: this.config.project.version,
      },
      dashboard: {
        title: `${this.config.project.name} Dashboard`,
        theme: 'default',
        refreshInterval: 300000, // 5 minutes
        showPhases: true,
        showEpochs: true,
        showTesting: true,
      },
      paths: {
        requirements: this.configLoader.getRequirementsDirectory(),
        kanban: this.configLoader.getKanbanBaseDirectory(),
        output: '.supernal-dashboard/static',
      },
      deployment: {
        githubPages: {
          enabled: false,
          branch: 'gh-pages',
          directory: 'docs',
        },
        vercel: {
          enabled: false,
          outputDirectory: '.supernal-dashboard/static',
        },
      },
    };

    await fs.writeJson(path.join(dashboardDir, 'config.json'), config, {
      spaces: 2,
    });
  }

  /**
   * Generate static dashboard HTML
   */
  async generateStaticDashboard(_options = {}) {
    try {
      console.log(chalk.blue('🔨 Generating static dashboard...'));

      // Scan project for data
      const data = await this.scanProjectData();

      // Load template
      const dashboardDir = path.join(this.projectRoot, '.supernal-dashboard');
      const templatePath = path.join(
        dashboardDir,
        'templates',
        'index.html.hbs'
      );

      if (!(await fs.pathExists(templatePath))) {
        throw new Error(
          'Dashboard template not found. Run sc dashboard init first.'
        );
      }

      const template = await fs.readFile(templatePath, 'utf8');

      // Simple template replacement (could use Handlebars for more complex templating)
      let html = template
        .replace(/{{project\.name}}/g, data.project.name)
        .replace(/{{lastUpdated}}/g, new Date().toLocaleString())
        .replace(/{{stats\.total}}/g, data.stats.total)
        .replace(/{{stats\.completed}}/g, data.stats.completed)
        .replace(/{{stats\.progress}}/g, data.stats.progress)
        .replace(/{{currentPhase}}/g, data.currentPhase);

      // Replace requirements list
      const requirementsList = data.requirements
        .map(
          (req) => `
        <div class="req-item">
            <strong>${req.id}: ${req.title}</strong>
            <span style="float: right; background: #007acc; color: white; padding: 2px 8px; border-radius: 3px;">${req.status}</span>
            <br><small>${req.category} • ${req.priority}</small>
        </div>
      `
        )
        .join('');

      html = html.replace(
        /{{#each requirements}}.*?{{\/each}}/s,
        requirementsList
      );

      // Write static file
      const outputPath = path.join(dashboardDir, 'static', 'index.html');
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, html);

      console.log(chalk.green(`✅ Static dashboard generated: ${outputPath}`));
      return { success: true, outputPath };
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to generate static dashboard:'),
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Scan project for dashboard data
   */
  async scanProjectData() {
    const requirementsDir = path.join(
      this.projectRoot,
      this.configLoader.getRequirementsDirectory()
    );
    const requirements = [];

    // Scan requirements files
    if (await fs.pathExists(requirementsDir)) {
      const files = await this.findRequirementFiles(requirementsDir);

      for (const file of files) {
        const req = await this.parseRequirementFile(file);
        if (req) requirements.push(req);
      }
    }

    // Calculate stats
    const completed = requirements.filter(
      (r) =>
        r.status &&
        (r.status.toLowerCase() === 'completed' ||
          r.status.toLowerCase() === 'done')
    ).length;

    const stats = {
      total: requirements.length,
      completed,
      progress:
        requirements.length > 0
          ? Math.round((completed / requirements.length) * 100)
          : 0,
    };

    // Determine current phase
    const currentPhase = this.determineCurrentPhase(requirements);

    return {
      project: {
        name: this.config.project?.name || path.basename(this.projectRoot),
        version: this.config.project?.version || '1.0.0',
      },
      stats,
      currentPhase,
      requirements: requirements.slice(0, 20), // Limit for display
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Find requirement files recursively (same logic as working API server)
   */
  async findRequirementFiles(dir) {
    const files = [];

    async function scan(currentDir) {
      try {
        const items = await fs.readdir(currentDir);

        for (const item of items) {
          const fullPath = path.join(currentDir, item);
          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            // Skip certain directories
            if (!['node_modules', '.git', 'archive', 'temp'].includes(item)) {
              await scan(fullPath);
            }
          } else if (
            item.endsWith('.md') &&
            (item.startsWith('req-') || item.includes('req-'))
          ) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(
          chalk.yellow(
            `Warning: Could not scan directory ${currentDir}: ${error.message}`
          )
        );
      }
    }

    await scan(dir);
    return files.sort();
  }

  /**
   * Parse requirement file using same logic as working API server
   */
  async parseRequirementFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath, '.md');

      // Parse YAML frontmatter for priority
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let priority = 'Medium';
      let priorityScore = 5;
      let frontmatterData = {};

      if (yamlMatch) {
        const yamlContent = yamlMatch[1];
        const priorityMatch = yamlContent.match(/priority:\s*(.+)/);
        const scoreMatch = yamlContent.match(/priorityScore:\s*(\d+)/);

        if (priorityMatch) priority = priorityMatch[1].trim();
        if (scoreMatch) priorityScore = parseInt(scoreMatch[1], 10);

        // Parse full frontmatter for additional data
        try {
          const yaml = require('yaml');
          frontmatterData = yaml.parse(yamlContent);
        } catch (_e) {
          // Continue with basic parsing if YAML parsing fails
        }
      }

      // Extract title from markdown
      const titleMatch = content.match(/# (.+)/);
      const title = titleMatch
        ? titleMatch[1].replace(/REQ-\d+:\s*/, '')
        : fileName;

      // Extract category from file path
      const relativePath = path.relative(
        path.join(
          this.projectRoot,
          this.configLoader.getRequirementsDirectory()
        ),
        filePath
      );
      const category = path.dirname(relativePath);

      // Extract status from content
      const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/);
      const status = statusMatch
        ? statusMatch[1].trim()
        : frontmatterData.status || 'Planning';

      // Extract req ID
      const reqIdMatch =
        fileName.match(/(req-\d+)/i) || title.match(/(REQ-\d+)/i);
      const reqId = reqIdMatch
        ? reqIdMatch[1].toUpperCase()
        : fileName.toUpperCase();

      return {
        id: reqId,
        title: title,
        category: category,
        priority: priority,
        priorityScore: priorityScore,
        status: status,
        filePath: filePath,
        lastModified: (await fs.stat(filePath)).mtime,
      };
    } catch (error) {
      console.warn(
        chalk.yellow(`Warning: Could not parse ${filePath}: ${error.message}`)
      );
      return null;
    }
  }

  /**
   * Determine current development phase
   */
  determineCurrentPhase(requirements) {
    if (requirements.length === 0) return 'planning';

    const statuses = requirements.map((req) => req.status?.toLowerCase());
    const completedCount = statuses.filter(
      (s) => s === 'completed' || s === 'done'
    ).length;
    const inProgressCount = statuses.filter(
      (s) => s === 'in-progress' || s === 'active'
    ).length;

    if (completedCount === requirements.length) return 'deployment';
    if (inProgressCount > 0) return 'development';
    if (completedCount > 0) return 'development';

    return 'planning';
  }

  /**
   * Serve dashboard and all related services locally
   * Hybrid approach: Check for local copy first, then use package dashboard
   */
  async serve(options = {}) {
    try {
      console.log(chalk.blue('🚀 Starting Supernal Dashboard...'));

      const port = options.port || options.dashboardPort || 3000;
      const projectRoot = this.projectRoot;
      let dashboardPath;
      let mode;

      // Auto-kill conflicting port processes (default behavior)
      if (!(await this.isPortAvailable(port))) {
        console.log(chalk.yellow(`\n⚠️  Port ${port} is in use, freeing it...`));
        await this.killPort(port);
      }

      // HYBRID APPROACH:
      // Strategy 1: Check for LOCAL dashboard first (copy mode - user customization)
      const localDashboard = path.join(projectRoot, 'apps', 'supernal-dashboard');

      if (await fs.pathExists(localDashboard)) {
        dashboardPath = localDashboard;
        mode = 'local';
      } else {
        // Strategy 2: Use package dashboard (runtime mode - DEFAULT, auto-updates)
        const dashboardInfo = this.findPackageDashboard();
        dashboardPath = dashboardInfo.path;
        mode = dashboardInfo.mode;
      }

      // Set up environment for the dashboard
      const projectName = this.config?.project?.name || path.basename(projectRoot);
      const env = {
        ...process.env,
        PORT: port,
        PROJECT_ROOT: projectRoot,
        NODE_ENV: 'development',
        // Pass project configuration
        PROJECT_NAME: projectName,
        REPO_ID: projectName,
        NEXT_PUBLIC_DEFAULT_REPO_ID: projectName,
        REQUIREMENTS_PATH:
          this.configLoader?.getRequirementsDirectory() || 'docs/requirements',
        KANBAN_PATH:
          this.configLoader?.getKanbanBaseDirectory() || 'docs/planning/kanban',
        CONFIG_PATH: 'supernal.yaml',
      };

      // Clear output about what we're serving
      console.log(chalk.green(`\n📊 Serving dashboard for: ${projectName}`));
      console.log(chalk.gray(`   Project path: ${projectRoot}`));
      console.log(chalk.gray(`   Port: ${port}`));
      console.log(chalk.gray(`   Dashboard mode: ${mode === 'local' ? 'local (customized)' : 'package (auto-updates)'}`));

      // Start the Next.js development server
      const serverProcess = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
        cwd: dashboardPath,
        stdio: 'inherit',
        env,
      });

      console.log(chalk.green(`\n✅ Dashboard running at http://localhost:${port}`));
      console.log(chalk.gray('   Press Ctrl+C to stop\n'));

      // Handle process termination
      const cleanup = () => {
        console.log(chalk.yellow('\n🛑 Stopping dashboard...'));
        serverProcess.kill('SIGTERM');
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      serverProcess.on('close', (code) => {
        console.log(chalk.blue(`Dashboard stopped with code ${code}`));
      });

      serverProcess.on('error', (error) => {
        console.error(chalk.red('❌ Failed to start dashboard:'), error);
        process.exit(1);
      });
    } catch (error) {
      console.error(chalk.red('❌ Dashboard serve failed:'), error.message);
      throw error;
    }
  }

  /**
   * Build dashboard for production deployment
   * Uses same hybrid logic as serve()
   */
  async build(_options = {}) {
    try {
      console.log(
        chalk.blue('🏗️  Building Supernal Dashboard for production...')
      );

      const projectRoot = this.projectRoot;
      let dashboardPath;

      // HYBRID APPROACH: Check for local copy first
      const localDashboard = path.join(projectRoot, 'apps', 'supernal-dashboard');

      if (await fs.pathExists(localDashboard)) {
        dashboardPath = localDashboard;
        console.log(chalk.blue('📊 Building LOCAL dashboard'));
      } else {
        // Use package dashboard
        const dashboardInfo = this.findPackageDashboard();
        dashboardPath = dashboardInfo.path;
        console.log(
          chalk.blue(`📊 Building PACKAGE dashboard (${dashboardInfo.mode})`)
        );
      }

      console.log(chalk.gray(`   Location: ${dashboardPath}`));

      // Set up environment for build
      const env = {
        ...process.env,
        PROJECT_ROOT: projectRoot,
        NODE_ENV: 'production',
        PROJECT_NAME: this.config?.project?.name || path.basename(projectRoot),
        REPO_ID: this.config?.project?.name || path.basename(projectRoot),
        NEXT_PUBLIC_DEFAULT_REPO_ID:
          this.config?.project?.name || path.basename(projectRoot),
        REQUIREMENTS_PATH:
          this.configLoader?.getRequirementsDirectory() || 'docs/requirements',
        KANBAN_PATH:
          this.configLoader?.getKanbanBaseDirectory() || 'docs/planning/kanban',
        CONFIG_PATH: 'supernal.yaml',
      };

      console.log(chalk.blue(`📋 Project: ${env.PROJECT_NAME}`));

      // Run build
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: dashboardPath,
        stdio: 'inherit',
        env,
      });

      return new Promise((resolve, reject) => {
        buildProcess.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green('✅ Dashboard built successfully'));
            resolve();
          } else {
            reject(new Error(`Build failed with code ${code}`));
          }
        });

        buildProcess.on('error', (error) => {
          console.error(chalk.red('❌ Build failed:'), error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(chalk.red('❌ Dashboard build failed:'), error.message);
      throw error;
    }
  }

  /**
   * Update dashboard data and regenerate
   */
  async update(options = {}) {
    try {
      console.log(chalk.blue('🔄 Updating dashboard...'));

      const result = await this.generateStaticDashboard(options);

      if (result.success) {
        console.log(chalk.green('✅ Dashboard updated successfully!'));
      } else {
        console.error(chalk.red('❌ Dashboard update failed:'), result.error);
      }

      return result;
    } catch (error) {
      console.error(chalk.red('❌ Dashboard update error:'), error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deploy dashboard to GitHub Pages
   */
  async deploy(options = {}) {
    try {
      console.log(chalk.blue('🚀 Deploying dashboard...'));

      // Generate fresh dashboard
      const result = await this.generateStaticDashboard();
      if (!result.success) {
        throw new Error(`Dashboard generation failed: ${result.error}`);
      }

      if (options.githubPages) {
        return await this.deployToGitHubPages(options);
      } else if (options.vercel) {
        return await this.deployToVercel(options);
      } else {
        console.log(chalk.yellow('⚠️  Please specify deployment target:'));
        console.log(chalk.white('  --github-pages  Deploy to GitHub Pages'));
        console.log(chalk.white('  --vercel        Deploy to Vercel'));
        return { success: false, error: 'No deployment target specified' };
      }
    } catch (error) {
      console.error(chalk.red('❌ Deployment failed:'), error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deploy to GitHub Pages
   */
  async deployToGitHubPages(options = {}) {
    const outputDir = options.output || 'docs';
    const dashboardDir = path.join(this.projectRoot, 'dashboard');
    const targetDir = path.join(this.projectRoot, outputDir);

    try {
      console.log(chalk.blue('📦 Preparing GitHub Pages deployment...'));

      // Ensure dashboard is initialized
      if (!(await fs.pathExists(dashboardDir))) {
        console.log(
          chalk.yellow(
            '⚠️  Dashboard not initialized. Running sc dashboard init...'
          )
        );
        await this.init();
      }

      // Create output directory
      await fs.ensureDir(targetDir);

      // Copy dashboard files
      const filesToCopy = ['index.html', 'package.json', 'README.md'];
      for (const file of filesToCopy) {
        const srcPath = path.join(dashboardDir, file);
        const destPath = path.join(targetDir, file);
        if (await fs.pathExists(srcPath)) {
          await fs.copy(srcPath, destPath);
          console.log(chalk.gray(`  ✓ Copied ${file}`));
        }
      }

      // Create a simple server.js for GitHub Pages (static only)
      const staticServerContent = `// Static server for GitHub Pages
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(\`Dashboard running on port \${PORT}\`);
});
`;
      await fs.writeFile(
        path.join(targetDir, 'server.js'),
        staticServerContent
      );

      console.log(chalk.green(`✅ Dashboard files prepared in ${outputDir}/`));
      console.log(chalk.yellow('📋 Next steps for GitHub Pages:'));
      console.log(chalk.white(`  1. git add ${outputDir}/`));
      console.log(
        chalk.white('  2. git commit -m "Deploy dashboard to GitHub Pages"')
      );
      console.log(chalk.white('  3. git push'));
      console.log(chalk.white('  4. Go to repository Settings > Pages'));
      console.log(
        chalk.white(
          `  5. Set source to "Deploy from a branch" and select "main" branch "/${outputDir}" folder`
        )
      );
      console.log(
        chalk.white(
          '  6. Your dashboard will be available at: https://username.github.io/repository/'
        )
      );

      return { success: true, outputDir };
    } catch (error) {
      console.error(
        chalk.red('❌ GitHub Pages deployment failed:'),
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Deploy to Vercel
   */
  async deployToVercel(_options = {}) {
    const dashboardDir = path.join(this.projectRoot, 'dashboard');

    try {
      console.log(chalk.blue('🚀 Preparing Vercel deployment...'));

      // Ensure dashboard is initialized
      if (!(await fs.pathExists(dashboardDir))) {
        console.log(
          chalk.yellow(
            '⚠️  Dashboard not initialized. Running sc dashboard init...'
          )
        );
        await this.init();
      }

      // Check if vercel.json exists in dashboard
      const vercelConfigPath = path.join(dashboardDir, 'vercel.json');
      if (!(await fs.pathExists(vercelConfigPath))) {
        // Create vercel.json for dashboard deployment
        const vercelConfig = {
          version: 2,
          name: 'supernal-dashboard',
          builds: [
            {
              src: 'server.js',
              use: '@vercel/node',
            },
            {
              src: 'index.html',
              use: '@vercel/static',
            },
          ],
          routes: [
            {
              src: '/api/(.*)',
              dest: '/server.js',
            },
            {
              src: '/(.*)',
              dest: '/index.html',
            },
          ],
        };
        await fs.writeFile(
          vercelConfigPath,
          JSON.stringify(vercelConfig, null, 2)
        );
        console.log(chalk.green('✅ Created vercel.json configuration'));
      }

      console.log(chalk.green('✅ Dashboard ready for Vercel deployment'));
      console.log(chalk.yellow('📋 Next steps for Vercel:'));
      console.log(chalk.white('  1. Install Vercel CLI: npm i -g vercel'));
      console.log(
        chalk.white(`  2. cd ${path.relative(this.projectRoot, dashboardDir)}`)
      );
      console.log(chalk.white('  3. vercel --prod'));
      console.log(chalk.white('  4. Follow the prompts to deploy'));
      console.log(chalk.white(''));
      console.log(chalk.white('Or connect your repository to Vercel:'));
      console.log(chalk.white('  1. Go to https://vercel.com/new'));
      console.log(chalk.white('  2. Import your repository'));
      console.log(
        chalk.white(
          `  3. Set root directory to: ${path.relative(this.projectRoot, dashboardDir)}`
        )
      );
      console.log(chalk.white('  4. Deploy'));

      return { success: true, configPath: vercelConfigPath };
    } catch (error) {
      console.error(
        chalk.red('❌ Vercel deployment preparation failed:'),
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Start all services with smart port allocation
   * @param {Object} options - Service startup options
   */
  async startServices(options = {}) {
    console.log('🔍 Scanning for available ports...');

    // Define preferred ports for each service - NO FALLBACKS
    const services = {
      docs: parseInt(options.docsPort, 10),
      api: parseInt(options.apiPort, 10),
      dashboard: parseInt(options.dashboardPort, 10),
    };

    // Validate all ports are specified
    for (const [serviceName, port] of Object.entries(services)) {
      if (!port || Number.isNaN(port)) {
        throw new Error(
          `❌ ${serviceName} port not specified or invalid. Use --${serviceName}-port flag.`
        );
      }
    }

    // Kill conflicting processes if requested
    if (options.killConflicts || options['kill-conflicts']) {
      console.log('🔄 Killing processes on conflicting ports...');
      const { killPortProcesses } = require(
        path.join(__dirname, '../../../../scripts/port-scanner')
      );
      await killPortProcesses(Object.values(services));
    }

    try {
      // Find available ports for all services
      const availablePorts = await this.findAvailablePorts(services);

      console.log('\n🚀 Starting services with smart port allocation...\n');

      // Start Documentation (if exists)
      const docsDir = path.join(this.projectRoot, 'documentation');
      if (fs.existsSync(docsDir)) {
        console.log(
          `📚 Starting Documentation on port ${availablePorts.docs}...`
        );
        const docsProcess = spawn(
          'npm',
          ['run', 'start', '--', '--port', availablePorts.docs.toString()],
          {
            cwd: docsDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PORT: availablePorts.docs.toString() },
          }
        );
        this.runningProcesses.push({
          name: 'DOCS',
          process: docsProcess,
          port: availablePorts.docs,
        });
      }

      // Start API Server (if exists)
      const apiDir = path.join(this.projectRoot, 'apps', 'api');
      if (fs.existsSync(apiDir)) {
        console.log(`🔧 Starting API Server on port ${availablePorts.api}...`);
        const apiProcess = spawn('node', ['index.js'], {
          cwd: apiDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, PORT: availablePorts.api.toString() },
        });
        this.runningProcesses.push({
          name: 'API',
          process: apiProcess,
          port: availablePorts.api,
        });
      }

      // Start Dashboard - HYBRID APPROACH
      let dashboardPath;
      let dashboardMode;

      // Check for LOCAL dashboard first (copy mode)
      const localDashboard = path.join(
        this.projectRoot,
        'apps',
        'supernal-dashboard'
      );

      if (
        fs.existsSync(localDashboard) &&
        fs.existsSync(path.join(localDashboard, 'package.json'))
      ) {
        dashboardPath = localDashboard;
        dashboardMode = 'local';
        console.log(
          `📊 Starting LOCAL Dashboard on port ${availablePorts.dashboard}...`
        );
      } else {
        // Use package dashboard (runtime mode)
        try {
          const dashboardInfo = this.findPackageDashboard();
          dashboardPath = dashboardInfo.path;
          dashboardMode = dashboardInfo.mode;
          console.log(
            `📊 Starting PACKAGE Dashboard (${dashboardMode}) on port ${availablePorts.dashboard}...`
          );
        } catch (error) {
          console.log(`❌ Dashboard not found: ${error.message}`);
          return;
        }
      }

      // Start Next.js dashboard
      const dashboardProcess = spawn(
        'npm',
        ['run', 'dev', '--', '--port', availablePorts.dashboard.toString()],
        {
          cwd: dashboardPath,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PORT: availablePorts.dashboard.toString(),
            PROJECT_ROOT: this.projectRoot,
            REPO_ID:
              this.config?.project?.name || path.basename(this.projectRoot),
            NEXT_PUBLIC_DEFAULT_REPO_ID:
              this.config?.project?.name || path.basename(this.projectRoot),
          },
        }
      );

      this.runningProcesses.push({
        name: 'DASHBOARD-V2',
        process: dashboardProcess,
        port: availablePorts.dashboard,
      });

      // Handle process outputs
      this.runningProcesses.forEach(({ name, process }) => {
        process.stdout.on('data', (data) => {
          const lines = data
            .toString()
            .split('\n')
            .filter((line) => line.trim());
          lines.forEach((line) => {
            console.log(`[${name}] ${line}`);
          });
        });

        process.stderr.on('data', (data) => {
          const lines = data
            .toString()
            .split('\n')
            .filter((line) => line.trim());
          lines.forEach((line) => {
            console.error(`[${name}] ${line}`);
          });
        });

        process.on('close', (code) => {
          console.log(`[${name}] Process exited with code ${code}`);
        });
      });

      // Wait a bit for services to start
      setTimeout(() => {
        console.log('\n🌐 Services Status:');
        this.runningProcesses.forEach(({ name, port }) => {
          const serviceName = name.toLowerCase();
          console.log(
            `${this.getServiceIcon(serviceName)} ${name}: http://localhost:${port}`
          );
        });
        console.log('\n✨ All services started successfully!');
        console.log('Press Ctrl+C to stop all services.');
      }, 3000);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        this.stopAllServices();
      });

      // Keep the process alive
      process.stdin.resume();

      return { success: true, ports: availablePorts };
    } catch (error) {
      console.error('❌ Failed to start services:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop all running services
   */
  stopAllServices() {
    console.log('\n🛑 Shutting down all services...');
    this.runningProcesses.forEach(({ name, process }) => {
      console.log(`   Stopping ${name}...`);
      process.kill('SIGTERM');
    });

    setTimeout(() => {
      console.log('✅ All services stopped.');
      process.exit(0);
    }, 2000);
  }

  /**
   * Get service icon for display
   * @param {string} serviceName - Name of the service
   * @returns {string} - Icon for the service
   */
  getServiceIcon(serviceName) {
    const icons = {
      docs: '📚',
      api: '🔧',
      dashboard: '📊',
    };
    return icons[serviceName] || '🔹';
  }

  /**
   * Check port availability (CLI interface)
   * @param {Array} ports - Array of ports to check
   */
  async checkPorts(ports) {
    console.log('🔍 Checking port availability...\n');

    const results = await Promise.all(
      ports.map(async (port) => {
        const available = await this.isPortAvailable(port);
        return { port, available };
      })
    );

    results.forEach(({ port, available }) => {
      console.log(`Port ${port}: ${available ? '✅ Available' : '❌ In use'}`);
    });

    return { success: true, results };
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(chalk.bold.cyan('📊 Dashboard Management System'));
    console.log('=====================================');
    console.log('');
    console.log(chalk.bold('Commands:'));
    console.log(
      `  ${chalk.green('sc dashboard init')}           - Initialize dashboard in project`
    );
    console.log(
      `  ${chalk.green('sc dashboard serve')}          - Serve dashboard locally (using sc runtime)`
    );
    console.log(
      `  ${chalk.green('sc dashboard build')}          - Build dashboard for production`
    );
    console.log(
      `  ${chalk.green('sc dashboard start')}          - Start all services (docs, api, dashboard)`
    );
    console.log(
      `  ${chalk.green('sc dashboard check-ports')}    - Check port availability`
    );
    console.log(
      `  ${chalk.green('sc dashboard update')}         - Update dashboard data`
    );
    console.log(
      `  ${chalk.green('sc dashboard deploy')}         - Deploy dashboard`
    );
    console.log('');
    console.log(chalk.bold('Options:'));
    console.log(
      `  ${chalk.yellow('--port <port>')}              - Port for local server (default: 3000)`
    );
    console.log(
      `  ${chalk.yellow('--docs-port <port>')}         - Port for documentation server (default: 3003)`
    );
    console.log(
      `  ${chalk.yellow('--api-port <port>')}          - Port for API server (default: 3001)`
    );
    console.log(
      `  ${chalk.yellow('--dashboard-port <port>')}    - Port for dashboard server (default: 3002)`
    );
    console.log(
      `  ${chalk.yellow('--github-pages')}             - Deploy to GitHub Pages`
    );
    console.log(
      `  ${chalk.yellow('--vercel')}                   - Deploy to Vercel`
    );
    console.log(
      `  ${chalk.yellow('--output <dir>')}             - Output directory (default: docs)`
    );
    console.log('');
    console.log(chalk.bold('Examples:'));
    console.log(`  ${chalk.cyan('sc dashboard init')}`);
    console.log(`  ${chalk.cyan('sc dashboard serve --port 3001')}`);
    console.log(`  ${chalk.cyan('sc dashboard start')}`);
    console.log(
      `  ${chalk.cyan('sc dashboard start --docs-port 3005 --api-port 3006')}`
    );
    console.log(`  ${chalk.cyan('sc dashboard check-ports 3000 3001 3002')}`);
    console.log(`  ${chalk.cyan('sc dashboard deploy --github-pages')}`);
    console.log('');
    console.log('Dashboard integrates with your supernal.yaml configuration');
    console.log('and automatically scans your requirements directory.');
    console.log('');
    console.log(chalk.bold('Service Management:'));
    console.log('The start command will automatically detect and start:');
    console.log('  📚 Documentation server (if documentation/ exists)');
    console.log('  🔧 API server (if apps/api/ exists)');
    console.log('  📊 Dashboard server (always available)');
  }
}

/**
 * Main command handler
 */
async function handleDashboardCommand(action, options = {}) {
  const manager = new DashboardManager();

  try {
    switch (action) {
      case 'init': {
        const initResult = await manager.init(options);
        if (!initResult.success) {
          console.error(
            chalk.red('❌ Dashboard initialization failed:'),
            initResult.error
          );
          process.exit(1);
        }
        return initResult;
      }

      case 'serve':
        return await manager.serve(options);

      case 'build':
        return await manager.build(options);

      case 'upgrade': {
        // Upgrade is just init with --upgrade flag
        options.upgrade = true;
        const upgradeResult = await manager.init(options);
        if (!upgradeResult.success) {
          console.error(
            chalk.red('❌ Dashboard upgrade failed:'),
            upgradeResult.error
          );
          process.exit(1);
        }
        return upgradeResult;
      }

      case 'update':
        return await manager.update(options);

      case 'deploy':
        return await manager.deploy(options);

      case 'start':
        return await manager.startServices(options);

      case 'check-ports': {
        // Parse ports from remaining arguments
        const ports = options.ports || [];
        if (ports.length === 0) {
          console.error(
            chalk.red(
              '❌ No ports specified. Usage: sc dashboard check-ports <port1> [port2] ...'
            )
          );
          return { success: false, error: 'No ports specified' };
        }
        return await manager.checkPorts(ports);
      }

      case 'help':
      case '--help':
      case undefined:
        manager.showHelp();
        return { success: true };

      default:
        console.error(chalk.red(`❌ Unknown dashboard action: ${action}`));
        manager.showHelp();
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    console.error(chalk.red('❌ Dashboard command failed:'), error.message);
    return { success: false, error: error.message };
  }
}

// Export the command function directly for CLI compatibility
module.exports = async (action, options = {}) =>
  await handleDashboardCommand(action, options);

// Export classes for direct use
module.exports.DashboardManager = DashboardManager;
module.exports.handleDashboardCommand = handleDashboardCommand;
