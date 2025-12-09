const yaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('node:path');
const { YAMLSyntaxError } = require('./errors');

/**
 * ConfigLoader - Main entry point for loading and resolving configurations
 *
 * Responsibilities:
 * - Parse YAML files with error context
 * - Orchestrate pattern resolution
 * - Merge resolved configs
 * - Cache results
 */
class ConfigLoader {
  constructor(options = {}) {
    this.searchPaths = options.searchPaths || this.getDefaultSearchPaths();
    this.cache = options.cache || new Map();
    this.resolver = null; // Lazy load to avoid circular deps
    this.merger = null; // Lazy load
  }

  /**
   * Get default search paths for patterns
   * @returns {Array<string>} Search paths in order: user → shipped
   */
  getDefaultSearchPaths() {
    return [
      path.join(process.cwd(), '.supernal', 'patterns'), // User patterns
      path.join(__dirname, '..', 'patterns'), // Shipped patterns (lib/patterns)
    ];
  }

  /**
   * Load and resolve configuration from file
   * @param {string} configPath - Path to .supernal/project.yaml
   * @returns {Promise<object>} Resolved configuration
   * @throws {YAMLSyntaxError, PatternNotFoundError, ValidationError}
   */
  async load(configPath) {
    // 1. Parse YAML
    const userConfig = await this.parseYAML(configPath);

    // 2. Resolve patterns (defaults list) - lazy load resolver
    if (!this.resolver) {
      const PatternResolver = require('./resolver');
      this.resolver = new PatternResolver(this.searchPaths);
    }
    const resolved = await this.resolver.resolve(userConfig);

    // 3. Merge in order - lazy load merger
    if (!this.merger) {
      const ConfigMerger = require('./merger');
      this.merger = new ConfigMerger();
    }
    const merged = this.merger.merge(resolved);

    // 4. Cache result
    this.cache.set(configPath, merged);

    return merged;
  }

  /**
   * Parse YAML file with error context
   * @param {string} filePath - Path to YAML file
   * @returns {Promise<object>} Parsed YAML as JavaScript object
   * @throws {YAMLSyntaxError} If YAML is invalid
   */
  async parseYAML(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    try {
      return yaml.load(content, { filename: filePath });
    } catch (error) {
      throw new YAMLSyntaxError(error, filePath, content);
    }
  }

  /**
   * Get resolved config (cached if available)
   * @param {string} configPath - Path to config file
   * @returns {Promise<object>} Resolved configuration
   */
  async get(configPath) {
    if (this.cache.has(configPath)) {
      return this.cache.get(configPath);
    }
    return this.load(configPath);
  }

  /**
   * Clear cache (useful for testing or dev mode)
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = ConfigLoader;
