/**
 * ConfigValidator - Validates project configuration structure
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

const Ajv = require('ajv');
const path = require('node:path');
const fs = require('fs-extra');

class ConfigValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.schema = null;
  }

  /**
   * Load and compile the project config schema
   */
  async loadSchema() {
    if (this.schema) return this.schema;

    const schemaPath = path.join(
      __dirname,
      'schemas',
      'project-config.schema.json'
    );

    if (await fs.pathExists(schemaPath)) {
      this.schema = await fs.readJson(schemaPath);
    } else {
      // Minimal fallback schema
      this.schema = {
        type: 'object',
        properties: {
          project: { type: 'object' },
          paths: { type: 'object' },
          workflow: { type: 'object' }
        }
      };
    }

    return this.schema;
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration to validate
   * @returns {Object} { valid: boolean, errors: Array }
   */
  async validate(config) {
    await this.loadSchema();
    const validate = this.ajv.compile(this.schema);
    const valid = validate(config);

    return {
      valid,
      errors: validate.errors || []
    };
  }

  /**
   * Format validation errors for display
   * @param {Array} errors - AJV errors
   * @returns {string} Formatted error messages
   */
  formatErrors(errors) {
    if (!errors || errors.length === 0) return '';

    return errors
      .map((err) => {
        const path = err.instancePath || err.dataPath || '';
        return `  - ${path}: ${err.message}`;
      })
      .join('\n');
  }
}

module.exports = ConfigValidator;
