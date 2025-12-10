// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');

/**
 * FeatureManager
 *
 * Manages feature registry for feature-based commits.
 * Tracks active features and validates feature tags.
 *
 * Registry: .supernal/features.yaml
 */
class FeatureManager {
  projectRoot: any;
  registryPath: any;
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.registryPath = path.join(projectRoot, '.supernal', 'features.yaml');
  }

  /**
   * Add a new feature to registry
   * @param {string} name - Feature name (alphanumeric + hyphens)
   * @param {object} options - { description, requirements, owner }
   */
  async addFeature(name, options = {}) {
    // Validate name (alphanumeric + hyphens only)
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error(
        'Feature name must be lowercase alphanumeric with hyphens only'
      );
    }

    const registry = await this.loadRegistry();

    // Check if already exists
    if (registry.features.some((f) => f.name === name)) {
      throw new Error(`Feature already exists: ${name}`);
    }

    // Parse requirements array
    const requirements = options.requirements
      ? Array.isArray(options.requirements)
        ? options.requirements
        : options.requirements.split(',').map((r) => r.trim())
      : [];

    // Create feature entry
    const feature = {
      name,
      description: options.description || '',
      requirements,
      status: 'in-progress',
      owner: options.owner || '',
      created: new Date().toISOString().split('T')[0]
    };

    // Add to registry
    registry.features.push(feature);
    await this.saveRegistry(registry);

    return feature;
  }

  /**
   * List features
   * @param {object} options - { status }
   */
  async listFeatures(options = {}) {
    const registry = await this.loadRegistry();
    let features = registry.features;

    // Filter by status if provided
    if (options.status) {
      features = features.filter((f) => f.status === options.status);
    }

    return features;
  }

  /**
   * Show feature details
   * @param {string} name - Feature name
   */
  async showFeature(name) {
    const registry = await this.loadRegistry();
    const feature = registry.features.find((f) => f.name === name);

    if (!feature) {
      throw new Error(`Feature not found: ${name}`);
    }

    // Get recent commits for this feature
    const commits = await this.getFeatureCommits(name, { limit: 10 });

    return {
      ...feature,
      recentCommits: commits
    };
  }

  /**
   * Get commits for a feature
   * @param {string} name - Feature name
   * @param {object} options - { limit }
   */
  async getFeatureCommits(name, options = {}) {
    const { execSync } = require('node:child_process');

    try {
      const limit = options.limit ? `-${options.limit}` : '';
      const output = execSync(
        `git log --grep="\\[FEATURE:${name}\\]" --oneline ${limit}`,
        {
          cwd: this.projectRoot,
          encoding: 'utf8'
        }
      );

      return output
        .trim()
        .split('\n')
        .filter((line) => line)
        .map((line) => {
          const [hash, ...msgParts] = line.split(' ');
          return {
            hash,
            message: msgParts.join(' ')
          };
        });
    } catch (_error) {
      // No commits found or git error
      return [];
    }
  }

  /**
   * Complete a feature (move to completed)
   * @param {string} name - Feature name
   */
  async completeFeature(name) {
    const registry = await this.loadRegistry();
    const featureIndex = registry.features.findIndex((f) => f.name === name);

    if (featureIndex === -1) {
      throw new Error(`Feature not found: ${name}`);
    }

    // Remove from active features
    const [feature] = registry.features.splice(featureIndex, 1);

    // Add to completed
    if (!registry.completed) {
      registry.completed = [];
    }

    registry.completed.push({
      name: feature.name,
      description: feature.description,
      requirements: feature.requirements,
      completed: new Date().toISOString().split('T')[0]
    });

    await this.saveRegistry(registry);

    return feature;
  }

  /**
   * Remove a feature
   * @param {string} name - Feature name
   */
  async removeFeature(name) {
    const registry = await this.loadRegistry();
    const initialCount = registry.features.length;

    registry.features = registry.features.filter((f) => f.name !== name);

    if (registry.features.length === initialCount) {
      throw new Error(`Feature not found: ${name}`);
    }

    await this.saveRegistry(registry);

    return { removed: true, name };
  }

  /**
   * Check if feature exists
   * @param {string} name - Feature name
   */
  async featureExists(name) {
    const registry = await this.loadRegistry();
    return registry.features.some((f) => f.name === name);
  }

  /**
   * Validate commit message feature tag
   * @param {string} commitMessage - Commit message
   */
  async validateCommitFeatureTag(commitMessage) {
    // Extract feature tag from commit message
    const match = commitMessage.match(/^\[FEATURE:([a-z0-9-]+)\]/);

    if (!match) {
      return {
        valid: false,
        hasTag: false,
        message: 'No feature tag found in commit message'
      };
    }

    const featureName = match[1];
    const exists = await this.featureExists(featureName);

    if (!exists) {
      const registry = await this.loadRegistry();
      const availableFeatures = registry.features.map((f) => f.name);

      return {
        valid: false,
        hasTag: true,
        featureName,
        message: `Feature '${featureName}' not found in registry`,
        availableFeatures
      };
    }

    return {
      valid: true,
      hasTag: true,
      featureName
    };
  }

  /**
   * Get feature statistics
   */
  async getStatistics() {
    const registry = await this.loadRegistry();

    const stats = {
      active: registry.features.length,
      completed: registry.completed ? registry.completed.length : 0,
      byStatus: {}
    };

    // Count by status
    for (const feature of registry.features) {
      const status = feature.status || 'in-progress';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Load registry from disk
   */
  async loadRegistry() {
    if (!(await fs.pathExists(this.registryPath))) {
      // Create default registry
      return {
        features: [],
        completed: []
      };
    }

    const content = await fs.readFile(this.registryPath, 'utf8');
    return yaml.load(content);
  }

  /**
   * Save registry to disk
   */
  async saveRegistry(registry) {
    const content = yaml.dump(registry, { indent: 2 });

    await fs.ensureDir(path.dirname(this.registryPath));
    await fs.writeFile(this.registryPath, content);
  }
}

module.exports = FeatureManager;
