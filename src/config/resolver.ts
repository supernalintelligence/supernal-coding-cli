const yaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('node:path');
const { PatternNotFoundError, CircularDependencyError } = require('./errors');

/**
 * PatternResolver - Resolve pattern references from shipped/user patterns
 *
 * Responsibilities:
 * - Search for patterns in order (user → shipped)
 * - Resolve `defaults` list recursively
 * - Detect circular dependencies
 * - Suggest similar patterns when not found
 */
class PatternResolver {
  constructor(searchPaths) {
    this.searchPaths = searchPaths;
    this.patterns = new Map(); // Pattern cache
  }

  /**
   * Resolve pattern by name
   * @param {string} patternName - e.g.,
   * @param {string} patternType - "workflows", "phases", "documents"
   * @returns {Promise<object>} Resolved pattern
   * @throws {PatternNotFoundError} If pattern not found
   */
  async resolvePattern(patternName, patternType = 'workflows') {
    const cacheKey = `${patternType}/${patternName}`;

    if (this.patterns.has(cacheKey)) {
      return this.patterns.get(cacheKey);
    }

    // Search in order: user patterns, shipped patterns
    for (const searchPath of this.searchPaths) {
      const patternPath = path.join(
        searchPath,
        patternType,
        `${patternName}.yaml`
      );

      if (await fs.pathExists(patternPath)) {
        const pattern = await this.loadPattern(patternPath);
        this.patterns.set(cacheKey, pattern);
        return pattern;
      }
    }

    // Pattern not found - suggest similar
    const availablePatterns = await this.listPatterns(patternType);
    throw new PatternNotFoundError(patternName, patternType, availablePatterns);
  }

  /**
   * Load pattern from file
   * @param {string} patternPath - Full path to pattern file
   * @returns {Promise<object>} Parsed pattern
   */
  async loadPattern(patternPath) {
    const content = await fs.readFile(patternPath, 'utf8');
    return yaml.load(content, { filename: patternPath });
  }

  /**
   * Resolve complete config with all defaults
   * @param {object} userConfig - User's .supernal/project.yaml
   * @returns {Promise<Array<object>>} Ordered list of configs to merge
   * @throws {CircularDependencyError} If circular references detected
   */
  async resolve(userConfig) {
    const resolved = [];
    const visited = new Set(); // Circular dependency detection

    // Process defaults list
    const defaults = userConfig.defaults || [];
    const selfIndex = defaults.indexOf('_self_');

    for (let i = 0; i < defaults.length; i++) {
      const def = defaults[i];

      if (def === '_self_') {
        resolved.push(userConfig);
        continue;
      }

      // Extract pattern type and name
      const { type, name } = this.parseDefault(def);

      // Detect circular dependency
      const key = `${type}/${name}`;
      if (visited.has(key)) {
        throw new CircularDependencyError([...visited, key]);
      }
      visited.add(key);

      // Resolve pattern
      const pattern = await this.resolvePattern(name, type);

      // Recursively resolve pattern's defaults
      if (pattern.defaults) {
        const subResolved = await this.resolve(pattern);
        resolved.push(...subResolved);
      } else {
        resolved.push(pattern);
      }
    }

    // If no _self_ in defaults, add user config last
    if (selfIndex === -1) {
      resolved.push(userConfig);
    }

    return resolved;
  }

  /**
   * Parse default entry to extract type and name
   * @param {string|object} def - Default entry
   * @returns {{type: string, name: string}} Pattern type and name
   */
  parseDefault(def) {
    if (typeof def === 'string') {
      // Simple reference: "workflow-name"
      return { type: 'workflows', name: def };
    }
    if (typeof def === 'object' && !Array.isArray(def)) {
      // Explicit: { workflow: "name" } or { phase: "name" }
      const [[type, name]] = Object.entries(def);
      return { type: `${type}s`, name }; // workflow → workflows
    }
    throw new Error(`Invalid default: ${JSON.stringify(def)}`);
  }

  /**
   * List available patterns of a given type
   * @param {string} patternType - "workflows", "phases", or "documents"
   * @returns {Promise<Array<string>>} List of pattern names
   */
  async listPatterns(patternType) {
    const patterns = [];

    for (const searchPath of this.searchPaths) {
      const dir = path.join(searchPath, patternType);

      if (await fs.pathExists(dir)) {
        const files = await fs.readdir(dir);
        patterns.push(
          ...files
            .filter((f) => f.endsWith('.yaml'))
            .map((f) => f.replace('.yaml', ''))
        );
      }
    }

    return [...new Set(patterns)]; // Deduplicate
  }
}

module.exports = PatternResolver;
