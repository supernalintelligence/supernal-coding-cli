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
  phaseNames: any;
  constructor() {
    // Phase names for reference
    this.phaseNames = {
      1: 'Discovery',
      2: 'Research',
      3: 'Design',
      4: 'Planning',
      5: 'Requirements',
      6: 'Testing Strategy',
      7: 'Implementation',
      8: 'Integration',
      9: 'Testing',
      10: 'Staging',
      11: 'Validation',
      12: 'Production'
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
      const required = ['feature_id', 'title', 'phase', 'status'];
      for (const field of required) {
        if (!frontmatter[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Validate phase is 1-12
      if (frontmatter.phase) {
        const phase = parseInt(frontmatter.phase, 10);
        if (Number.isNaN(phase) || phase < 1 || phase > 12) {
          errors.push(`Invalid phase: ${frontmatter.phase} (must be 1-12)`);
        }
      }

      // Validate status
      const validStatuses = [
        'active',
        'paused',
        'blocked',
        'complete',
        'deprecated'
      ];
      if (frontmatter.status && !validStatuses.includes(frontmatter.status)) {
        warnings.push(`Unknown status: ${frontmatter.status}`);
      }

      // Validate priority
      const validPriorities = ['high', 'medium', 'low'];
      if (
        frontmatter.priority &&
        !validPriorities.includes(frontmatter.priority)
      ) {
        warnings.push(`Unknown priority: ${frontmatter.priority}`);
      }

      // Check if feature_id matches folder name
      const folderName = path.basename(featurePath);
      if (frontmatter.feature_id !== folderName) {
        errors.push(
          `feature_id '${frontmatter.feature_id}' doesn't match folder '${folderName}'`
        );
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
        phase: 1, // Default to Discovery
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
    if (!frontmatter.phase) {
      frontmatter.phase = 1;
      fixes.push('Added default phase: 1 (Discovery)');
    }

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
   * Get required directories for a phase
   */
  getRequiredDirectories(phase) {
    // Simplified - just check for basic structure
    const dirs = [];

    if (phase >= 3) dirs.push('design');
    if (phase >= 4) dirs.push('planning');
    if (phase >= 5) dirs.push('requirements');
    if (phase >= 7) dirs.push('implementation');
    if (phase >= 9) dirs.push('testing');
    if (phase >= 11) dirs.push('validation');

    return dirs;
  }
}

module.exports = FeatureValidator;
