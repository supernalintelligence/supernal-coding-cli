/**
 * ConfigMerger - Deep merge configurations with override strategy
 *
 * Responsibilities:
 * - Deep merge nested objects
 * - Handle array merge strategies (append vs replace)
 * - Last-wins for scalar values
 */
class ConfigMerger {
  constructor(strategy = 'deep') {
    this.strategy = strategy;
  }

  /**
   * Merge configs in order (first to last)
   * @param {Array<object>} configs - Ordered configs to merge
   * @returns {object} Final merged config
   */
  merge(configs) {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, {});
  }

  /**
   * Deep merge two objects
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} Merged result
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (this.isPlainObject(value) && this.isPlainObject(result[key])) {
        // Recurse for objects
        result[key] = this.deepMerge(result[key], value);
      } else if (Array.isArray(value) && Array.isArray(result[key])) {
        // Array merge strategy
        result[key] = this.mergeArrays(result[key], value);
      } else {
        // Scalar: last wins
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Merge arrays based on strategy
   * @param {Array} target - Target array
   * @param {Array} source - Source array
   * @returns {Array} Merged array
   */
  mergeArrays(target, source) {
    // Check for merge strategy marker
    if (source.length > 0 && source[0] === '__replace__') {
      return source.slice(1); // Replace, skip marker
    }
    // Default: append
    return [...target, ...source];
  }

  /**
   * Check if value is a plain object
   * @param {*} value - Value to check
   * @returns {boolean} True if plain object
   */
  isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
}

module.exports = ConfigMerger;
