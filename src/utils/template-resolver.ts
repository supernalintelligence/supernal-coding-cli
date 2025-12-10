import path from 'node:path';
import fs from 'fs-extra';
import { execSync } from 'node:child_process';

/** Template info returned from list() */
export interface TemplateInfo {
  path: string;
  source: 'project' | 'package';
}

/** Debug info about template resolution */
export interface TemplateDebugInfo {
  projectRoot: string;
  packageTemplatesDir: string;
  projectTemplatesDir: string;
  projectTemplatesExists: boolean;
  packageTemplatesExists: boolean;
}

/**
 * Resolve template locations with fallback chain
 * 1. Project /templates/ (overrides) - relative to repo root
 * 2. SC package templates (canonical) - resolved from installed location
 *
 * Handles all installation methods: npm install, global, npm link, development
 */
class TemplateResolver {
  protected packageTemplatesDir: string;
  protected projectRoot: string;

  constructor(projectRoot: string | null = null) {
    this.projectRoot = projectRoot || this.findProjectRoot();
    this.packageTemplatesDir = this.findPackageTemplates();
  }

  /**
   * Find the project root (git repository root)
   * This is where the user's project lives, NOT where SC is installed
   */
  findProjectRoot(): string {
    try {
      // Find git root (most reliable for repos)
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      if (gitRoot && fs.existsSync(gitRoot)) {
        return gitRoot;
      }
    } catch (_e) {
      // Not a git repo, fall back to cwd
    }

    // Fall back to current working directory
    return process.cwd();
  }

  /**
   * Find the SC package's canonical templates directory
   * Works regardless of how SC is installed (local, global, npm link, development)
   */
  findPackageTemplates(): string {
    // Try multiple resolution strategies

    // Strategy 1: Development mode (running from source)
    // Check if we're running from supernal-code-package/lib/
    const relativeDir = path.join(__dirname, '../../templates');
    if (fs.existsSync(relativeDir)) {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const pkg = require(packageJsonPath);
          if (pkg.name === 'supernal-code') {
            return relativeDir;
          }
        } catch (_e) {
          // Invalid package.json, continue
        }
      }
    }

    // Strategy 2: NPM installed (local or as dependency)
    // require.resolve finds the package wherever it's installed
    try {
      const packageJsonPath = require.resolve('supernal-code/package.json');
      const packageRoot = path.dirname(packageJsonPath);
      const templatesDir = path.join(packageRoot, 'templates');
      if (fs.existsSync(templatesDir)) {
        return templatesDir;
      }
    } catch (_e) {
      // Package not found via require.resolve
    }

    // Strategy 3: Global npm installation
    // Check global node_modules
    try {
      const globalNodeModules = execSync('npm root -g', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      const globalTemplates = path.join(
        globalNodeModules,
        'supernal-code',
        'templates'
      );
      if (fs.existsSync(globalTemplates)) {
        return globalTemplates;
      }
    } catch (_e) {
      // Could not get global npm root
    }

    // Strategy 4: Installed in project node_modules
    // Walk up from cwd to find node_modules/supernal-code
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const nodeModulesPath = path.join(
        currentDir,
        'node_modules',
        'supernal-code',
        'templates'
      );
      if (fs.existsSync(nodeModulesPath)) {
        return nodeModulesPath;
      }
      currentDir = path.dirname(currentDir);
    }

    throw new Error(
      'Could not locate SC package templates directory. Is supernal-code installed?'
    );
  }

  /**
   * Resolve a template path with override support
   * @param templatePath - Relative path like 'workflow/sops/'
   * @returns Absolute path to template
   */
  resolve(templatePath: string): string {
    // 1. Check project /templates/ first (override)
    const projectTemplate = path.join(
      this.projectRoot,
      'templates',
      templatePath
    );

    if (fs.existsSync(projectTemplate)) {
      return projectTemplate;
    }

    // 2. Fall back to package templates (canonical)
    const packageTemplate = path.join(this.packageTemplatesDir, templatePath);

    if (fs.existsSync(packageTemplate)) {
      return packageTemplate;
    }

    throw new Error(`Template not found: ${templatePath}`);
  }

  /**
   * Check if a template exists (without throwing)
   * @param templatePath - Relative path like 'workflow/sops/'
   * @returns True if template exists
   */
  exists(templatePath: string): boolean {
    try {
      this.resolve(templatePath);
      return true;
    } catch (_e) {
      return false;
    }
  }

  /**
   * Get the source of a template (project or package)
   * @param templatePath - Relative path
   * @returns 'project' or 'package'
   */
  getSource(templatePath: string): 'project' | 'package' {
    const projectTemplate = path.join(
      this.projectRoot,
      'templates',
      templatePath
    );

    if (fs.existsSync(projectTemplate)) {
      return 'project';
    }

    return 'package';
  }

  /**
   * List all available templates
   * @returns Array of template info objects
   */
  list(): TemplateInfo[] {
    const templates = new Map<string, TemplateInfo>();

    // Add package templates
    if (fs.existsSync(this.packageTemplatesDir)) {
      const packageTemplates = this._listDir(this.packageTemplatesDir, '');
      packageTemplates.forEach((t) => {
        templates.set(t, { path: t, source: 'package' });
      });
    }

    // Add/override with project templates
    const projectTemplatesDir = path.join(this.projectRoot, 'templates');
    if (fs.existsSync(projectTemplatesDir)) {
      const projectTemplates = this._listDir(projectTemplatesDir, '');
      projectTemplates.forEach((t) => {
        templates.set(t, { path: t, source: 'project' });
      });
    }

    return Array.from(templates.values());
  }

  /**
   * Recursively list directories in a path
   * @private
   */
  _listDir(dir: string, prefix: string): string[] {
    const templates: string[] = [];

    if (!fs.existsSync(dir)) {
      return templates;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        templates.push(relativePath);

        // Recurse into subdirectories
        const subDir = path.join(dir, entry.name);
        const subTemplates = this._listDir(subDir, relativePath);
        templates.push(...subTemplates);
      }
    }

    return templates;
  }

  /**
   * Get debug info about template resolution
   * @returns Debug information
   */
  getDebugInfo(): TemplateDebugInfo {
    return {
      projectRoot: this.projectRoot,
      packageTemplatesDir: this.packageTemplatesDir,
      projectTemplatesDir: path.join(this.projectRoot, 'templates'),
      projectTemplatesExists: fs.existsSync(
        path.join(this.projectRoot, 'templates')
      ),
      packageTemplatesExists: fs.existsSync(this.packageTemplatesDir)
    };
  }
}

export default TemplateResolver;
module.exports = TemplateResolver;
