/**
 * FormatHelper - Format conversion and section extraction
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

const yaml = require('yaml');

class FormatHelper {
  /**
   * Extract section from object by dot path
   * @param {Object} obj - Source object
   * @param {string} path - Dot-notation path
   * @returns {any} Extracted value or null
   */
  static extractSection(obj, path) {
    return path.split('.').reduce((current, key) => {
      // Handle array access
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, prop, index] = arrayMatch;
        return current?.[prop]?.[parseInt(index, 10)];
      }
      return current?.[key];
    }, obj);
  }

  /**
   * Convert object to YAML
   * @param {Object} obj - Object to convert
   * @param {Object} options - YAML options
   * @returns {string} YAML string
   */
  static toYAML(obj, options = {}) {
    return yaml.stringify(obj, {
      indent: 2,
      lineWidth: 80,
      ...options
    });
  }

  /**
   * Convert object to JSON
   * @param {Object} obj - Object to convert
   * @param {Object} options - JSON options
   * @returns {string} JSON string
   */
  static toJSON(obj, options = {}) {
    const indent = options.indent || 2;
    return JSON.stringify(obj, null, indent);
  }
}

module.exports = FormatHelper;
