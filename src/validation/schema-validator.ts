/**
 * Document Schema Validator for REQ-075
 */

import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

interface Frontmatter {
  id?: string;
  title?: string;
  created?: string;
  problem?: string;
  domains?: string[];
  [key: string]: unknown;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface DirectoryValidationResult {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  errors: string[];
  warnings: string[];
  fileResults: Record<string, ValidationResult>;
}

interface ValidateFunction {
  (data: unknown): boolean;
  errors?: Array<{ instancePath?: string; message?: string }>;
}

class SchemaValidator {
  protected ajv: Ajv;
  protected schemas: Record<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    this.schemas = {};
    this.loadSchemas();
  }

  loadSchemas(): void {
    try {
      const schemasPath = path.join(
        __dirname,
        '../schemas/document-schemas.yml'
      );
      const schemasContent = fs.readFileSync(schemasPath, 'utf8');
      const schemas = yaml.load(schemasContent) as Record<string, object>;

      Object.keys(schemas).forEach((schemaName) => {
        this.schemas[schemaName] = this.ajv.compile(schemas[schemaName]);
      });

      console.log(
        `Loaded ${Object.keys(this.schemas).length} document schemas`
      );
    } catch (error) {
      console.error('Failed to load document schemas:', (error as Error).message);
      throw error;
    }
  }

  validateDocument(frontmatter: Frontmatter, documentType: string): ValidationResult {
    const schemaName = `${documentType}_schema`;
    const validator = this.schemas[schemaName];

    if (!validator) {
      return {
        valid: false,
        errors: [`Unknown document type: ${documentType}`],
        warnings: []
      };
    }

    const valid = validator(frontmatter);

    return {
      valid,
      errors: valid
        ? []
        : (validator.errors || []).map(
            (err) => `${err.instancePath || 'root'}: ${err.message}`
          ),
      warnings: this.generateWarnings(frontmatter, documentType)
    };
  }

  generateWarnings(frontmatter: Frontmatter, documentType: string): string[] {
    const warnings: string[] = [];

    if (documentType === 'problem' && !frontmatter.created) {
      warnings.push('Consider adding "created" date for better tracking');
    }

    if (documentType === 'functional_requirement' && !frontmatter.problem) {
      warnings.push(
        'Consider linking to a problem statement for better traceability'
      );
    }

    if (
      documentType === 'user_story' &&
      (!frontmatter.domains || frontmatter.domains.length === 0)
    ) {
      warnings.push(
        'Consider adding domains this story touches for better organization'
      );
    }

    if (frontmatter.title && frontmatter.title.length > 100) {
      warnings.push(
        'Title is quite long - consider shortening for better readability'
      );
    }

    return warnings;
  }

  detectDocumentType(id: string | undefined): string | null {
    if (!id) return null;

    if (id.match(/^\d{4}-\d{2}-\d{2}-.+$/)) return 'evidence';
    if (id.match(/^PROB-.+$/)) return 'problem';
    if (id.match(/^ARCH-.+$/)) return 'architecture';
    if (id.match(/^REQ-.+$/)) return 'functional_requirement';
    if (id.match(/^STORY-.+$/)) return 'user_story';
    if (id.match(/^DD-\d{3}-.+$/)) return 'design_document';
    if (id.match(/^BIZ-\d{3}-.+$/)) return 'business_case';

    return null;
  }

  async validateFile(filePath: string): Promise<ValidationResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) {
        return {
          valid: false,
          errors: ['No frontmatter found in document'],
          warnings: ['Documents should have YAML frontmatter for metadata']
        };
      }

      const frontmatter = yaml.load(frontmatterMatch[1]) as Frontmatter;
      const documentType = this.detectDocumentType(frontmatter.id);

      if (!documentType) {
        return {
          valid: false,
          errors: [`Could not detect document type from ID: ${frontmatter.id}`],
          warnings: []
        };
      }

      return this.validateDocument(frontmatter, documentType);
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to validate file: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  async validateDirectory(dirPath: string, options: { recursive?: boolean } = {}): Promise<DirectoryValidationResult> {
    const results: DirectoryValidationResult = {
      totalFiles: 0,
      validFiles: 0,
      invalidFiles: 0,
      errors: [],
      warnings: [],
      fileResults: {}
    };

    try {
      const files = await this.findMarkdownFiles(
        dirPath,
        options.recursive !== false
      );
      results.totalFiles = files.length;

      for (const file of files) {
        const result = await this.validateFile(file);
        const relativePath = path.relative(dirPath, file);

        results.fileResults[relativePath] = result;

        if (result.valid) {
          results.validFiles++;
        } else {
          results.invalidFiles++;
          results.errors.push(`${relativePath}: ${result.errors.join(', ')}`);
        }

        if (result.warnings.length > 0) {
          results.warnings.push(
            `${relativePath}: ${result.warnings.join(', ')}`
          );
        }
      }
    } catch (error) {
      results.errors.push(`Directory validation failed: ${(error as Error).message}`);
    }

    return results;
  }

  async findMarkdownFiles(dirPath: string, recursive: boolean = true): Promise<string[]> {
    const files: string[] = [];

    const processDir = async (currentDir: string): Promise<void> => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory() && recursive) {
          await processDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    };

    await processDir(dirPath);
    return files;
  }
}

export default SchemaValidator;
module.exports = SchemaValidator;
