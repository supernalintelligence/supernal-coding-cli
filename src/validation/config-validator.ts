/**
 * ConfigValidator - Validates project configuration structure
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

import Ajv, { ErrorObject } from 'ajv';
import path from 'node:path';
import fs from 'fs-extra';

interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

interface ConfigSchema {
  type: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

class ConfigValidator {
  protected ajv: Ajv;
  protected schema: ConfigSchema | null;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.schema = null;
  }

  async loadSchema(): Promise<ConfigSchema> {
    if (this.schema) return this.schema;

    const schemaPath = path.join(
      __dirname,
      'schemas',
      'project-config.schema.json'
    );

    if (await fs.pathExists(schemaPath)) {
      this.schema = await fs.readJson(schemaPath);
    } else {
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

  async validate(config: Record<string, unknown>): Promise<ValidationResult> {
    await this.loadSchema();
    const validate = this.ajv.compile(this.schema!);
    const valid = validate(config);

    return {
      valid: !!valid,
      errors: validate.errors || []
    };
  }

  formatErrors(errors: ErrorObject[] | null | undefined): string {
    if (!errors || errors.length === 0) return '';

    return errors
      .map((err) => {
        const path = err.instancePath || '';
        return `  - ${path}: ${err.message}`;
      })
      .join('\n');
  }
}

export default ConfigValidator;
module.exports = ConfigValidator;
