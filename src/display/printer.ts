/**
 * ConfigPrinter - Pretty-print configs with optional colors
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

const yaml = require('yaml');

class ConfigPrinter {
  constructor(options = {}) {
    this.color = options.color !== false;
  }

  /**
   * Print config in specified format
   * @param {Object} config - Config object
   * @param {string} format - 'yaml' or 'json'
   * @returns {string} Formatted output
   */
  print(config, format = 'yaml') {
    let output;

    if (format === 'json') {
      output = JSON.stringify(config, null, 2);
    } else {
      output = yaml.stringify(config, {
        indent: 2,
        lineWidth: 80,
        minContentWidth: 0
      });
    }

    if (this.color && format === 'yaml') {
      output = this._colorizeYAML(output);
    }

    return output;
  }

  /**
   * Colorize YAML output for terminal
   * @private
   */
  _colorizeYAML(yamlString) {
    // Simple colorization without external deps
    // For now, return as-is. In real implementation, use chalk or similar
    return yamlString;
  }
}

module.exports = ConfigPrinter;
