// @ts-nocheck
/**
 * FeatureValidator - Hierarchical Structure
 *
 * Scans features in hierarchical structure:
 *   features/parent-feature/child-feature/
 *
 * Phase is tracked in frontmatter, not folder structure.
 */

const path = require('node:path');
const fs = require('node:fs').promises;
const yaml = require('yaml');

class FeatureValidator {
  phaseDisplayNames: any;
  validDomains: any;
  validPhases: any;
  validPriorities: any;
  validStatuses: any;
  constructor() {
    // Valid statuses
    this.validStatuses = [
      'active',
      'paused',
      'blocked',
      'complete',
      'deprecated'
    ];

    // Valid priorities
    this.validPriorities = ['high', 'medium', 'low'];

    // Available domains (organizational structure)
    this.validDomains = [
      'ai-workflow-system',
      'developer-tooling',
      'compliance-framework',
      'dashboard-platform',
      'workflow-management',
      'content-management',
      'integrations',
      'admin-operations'
    ];

    // Valid phases (workflow state)
    this.validPhases = [
      'backlog',
      'drafting',
      'implementing',
      'testing',
      'validating',
      'complete'
    ];

    // Phase display names
    this.phaseDisplayNames = {
      backlog: 'Backlog - Ideas & Planning',
      drafting: 'Drafting - Design & Architecture',
      implementing: 'Implementing - Active Development',
      testing: 'Testing - QA & Validation',
      validating: 'Validating - Final Review',
      complete: 'Complete - Shipped'
    };
  }

  /**
   * Get all features - Hierarchical structure
   * Recursively scans: features/feature-name/sub-feature/
   */
  async getAllFeatures(featuresDir, relativePath = '') {
    const features = [];

    try {
      const entries = await fs.readdir(featuresDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip special folders
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

        const entryPath = path.join(featuresDir, entry.name);
        const readmePath = path.join(entryPath, 'README.md');
        const featurePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        // Check if this directory has a README.md (is a feature)
        try {
          await fs.access(readmePath);
          features.push({
            path: entryPath,
            relativePath: featurePath,
            name: entry.name
          });
        } catch {
          // No README, might just be a grouping folder
        }

        // Recursively scan subdirectories
        const subFeatures = await this.getAllFeatures(entryPath, featurePath);
        features.push(...subFeatures);
      }

      return features;
    } catch (error) {
      throw new Error(`Failed to get features: ${error.message}`);
    }
  }

  /**
   * Validate a feature's frontmatter
   */
  async validate(featurePath) {
    const readmePath = path.join(featurePath, 'README.md');
    const errors = [];
    const warnings = [];

    try {
      const content = await fs.readFile(readmePath, 'utf-8');

      // Parse frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        errors.push('Missing frontmatter');
        return { valid: false, errors, warnings, frontmatter: null };
      }

      const frontmatter = yaml.parse(frontmatterMatch[1]);

      // Required fields
      const required = ['feature_id', 'title', 'status'];
      for (const field of required) {
        if (!frontmatter[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Validate status
      if (
        frontmatter.status &&
        !this.validStatuses.includes(frontmatter.status)
      ) {
        warnings.push(`Unknown status: ${frontmatter.status}`);
      }

      // Validate priority
      if (
        frontmatter.priority &&
        !this.validPriorities.includes(frontmatter.priority)
      ) {
        warnings.push(`Unknown priority: ${frontmatter.priority}`);
      }

      // Validate domain if present
      if (
        frontmatter.domain &&
        !this.validDomains.includes(frontmatter.domain)
      ) {
        warnings.push(
          `Unknown domain: ${frontmatter.domain} (should be one of: ${this.validDomains.join(', ')})`
        );
      }

      // Validate phase if present
      if (frontmatter.phase && !this.validPhases.includes(frontmatter.phase)) {
        warnings.push(
          `Unknown phase: ${frontmatter.phase} (should be one of: ${this.validPhases.join(', ')})`
        );
      }

      // Check if feature_id matches folder name
      const folderName = path.basename(featurePath);
      if (frontmatter.feature_id !== folderName) {
        errors.push(
          `feature_id '${frontmatter.feature_id}' doesn't match folder '${folderName}'`
        );
      }

      // Validate required directories based on phase
      if (frontmatter.phase) {
        const requiredDirs = this.getRequiredDirectories(frontmatter.phase);
        for (const dir of requiredDirs) {
          const dirPath = path.join(featurePath, dir);
          const filePath = `${dirPath}.md`;

          // Check if directory exists
          let dirExists = false;
          try {
            const stat = await fs.stat(dirPath);
            dirExists = stat.isDirectory();
          } catch {
            dirExists = false;
          }

          // Check if file exists (documentation scaling)
          let fileExists = false;
          try {
            await fs.access(filePath);
            fileExists = true;
          } catch {
            fileExists = false;
          }

          if (!dirExists && !fileExists) {
            errors.push(
              `Missing required directory '${dir}/' or file '${dir}.md' for phase '${frontmatter.phase}'`
            );
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        frontmatter
      };
    } catch (error) {
      errors.push(`Failed to read/parse README.md: ${error.message}`);
      return { valid: false, errors, warnings, frontmatter: null };
    }
  }

  /**
   * Auto-fix validation issues
   */
  async autoFix(featurePath, validationResult) {
    if (validationResult.valid) {
      return { fixed: false, message: 'No issues to fix' };
    }

    const fixes = [];
    let { frontmatter } = validationResult;
    const readmePath = path.join(featurePath, 'README.md');
    const content = await fs.readFile(readmePath, 'utf-8');

    // If no frontmatter exists, create it
    if (!frontmatter) {
      const folderName = path.basename(featurePath);
      const today = new Date().toISOString().split('T')[0];

      // Extract title from first heading or use folder name
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch
        ? titleMatch[1]
        : folderName
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

      frontmatter = {
        feature_id: folderName,
        title: title,
        priority: 'medium',
        status: 'active',
        created: today,
        updated: today
      };

      const newContent = `${this.createFrontmatter(frontmatter)}\n${content}`;
      await fs.writeFile(readmePath, newContent, 'utf-8');

      fixes.push('Created missing frontmatter');
      return { fixed: true, fixes };
    }

    // Fix feature_id
    const folderName = path.basename(featurePath);
    if (frontmatter.feature_id !== folderName) {
      frontmatter.feature_id = folderName;
      fixes.push(`Updated feature_id to '${folderName}'`);
    }

    // Add missing required fields
    if (!frontmatter.status) {
      frontmatter.status = 'active';
      fixes.push('Added default status: active');
    }

    if (!frontmatter.title) {
      frontmatter.title = folderName
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      fixes.push('Added default title');
    }

    // Create missing required directories based on phase
    if (frontmatter.phase) {
      const requiredDirs = this.getRequiredDirectories(frontmatter.phase);
      for (const dir of requiredDirs) {
        const dirPath = path.join(featurePath, dir);
        try {
          await fs.access(dirPath);
        } catch {
          // Directory doesn't exist, create it
          await fs.mkdir(dirPath, { recursive: true });
          fixes.push(`Created missing directory: ${dir}/`);
        }
      }
    }

    if (fixes.length > 0) {
      const newContent = this.updateFrontmatter(content, frontmatter);
      await fs.writeFile(readmePath, newContent, 'utf-8');

      return { fixed: true, fixes };
    }

    return { fixed: false, message: 'No auto-fixable issues found' };
  }

  /**
   * Create frontmatter string from object
   */
  createFrontmatter(frontmatter) {
    return `---\n${yaml.stringify(frontmatter)}---`;
  }

  /**
   * Update frontmatter in content
   */
  updateFrontmatter(content, frontmatter) {
    const frontmatterStr = this.createFrontmatter(frontmatter);

    if (content.match(/^---\n[\s\S]*?\n---/)) {
      return content.replace(/^---\n[\s\S]*?\n---/, frontmatterStr);
    } else {
      return `${frontmatterStr}\n${content}`;
    }
  }

  /**
   * Get required directories based on phase (workflow state)
   * Phase is metadata that determines what directories should exist
   */
  getRequiredDirectories(phase) {
    if (!phase || phase === 'backlog') {
      return []; // Backlog only needs README
    }

    const dirs = [];

    if (
      phase === 'drafting' ||
      phase === 'implementing' ||
      phase === 'testing' ||
      phase === 'validating' ||
      phase === 'complete'
    ) {
      dirs.push('design', 'planning', 'requirements');
    }

    if (
      phase === 'implementing' ||
      phase === 'testing' ||
      phase === 'validating' ||
      phase === 'complete'
    ) {
      dirs.push('testing');
    }

    if (phase === 'validating' || phase === 'complete') {
      dirs.push('validation');
    }

    return dirs;
  }

  /**
   * Get suggested directories (useful but not required)
   */
  getSuggestedDirectories() {
    return ['stories', 'chats', 'archive'];
  }
}

module.exports = FeatureValidator;
