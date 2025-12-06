/**
 * Document Schema Validator for REQ-075
 * Validates document frontmatter against defined schemas
 */

const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    this.schemas = {};
    this.loadSchemas();
  }

  /**
   * Load document schemas from YAML file
   */
  loadSchemas() {
    try {
      const schemasPath = path.join(
        __dirname,
        '../schemas/document-schemas.yml'
      );
      const schemasContent = fs.readFileSync(schemasPath, 'utf8');
      const schemas = yaml.load(schemasContent);

      // Compile all schemas
      Object.keys(schemas).forEach((schemaName) => {
        this.schemas[schemaName] = this.ajv.compile(schemas[schemaName]);
      });

      console.log(
        `Loaded ${Object.keys(this.schemas).length} document schemas`
      );
    } catch (error) {
      console.error('Failed to load document schemas:', error.message);
      throw error;
    }
  }

  /**
   * Validate document frontmatter against appropriate schema
   * @param {Object} frontmatter - Document frontmatter object
   * @param {string} documentType - Type of document (evidence, problem, etc.)
   * @returns {Object} Validation result
   */
  validateDocument(frontmatter, documentType) {
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
        : validator.errors.map(
            (err) => `${err.instancePath || 'root'}: ${err.message}`
          ),
      warnings: this.generateWarnings(frontmatter, documentType)
    };
  }

  /**
   * Generate warnings for best practices
   * @param {Object} frontmatter - Document frontmatter
   * @param {string} documentType - Document type
   * @returns {Array} Array of warning messages
   */
  generateWarnings(frontmatter, documentType) {
    const warnings = [];

    // Check for missing optional but recommended fields
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

    // Check title length recommendations
    if (frontmatter.title && frontmatter.title.length > 100) {
      warnings.push(
        'Title is quite long - consider shortening for better readability'
      );
    }

    return warnings;
  }

  /**
   * Detect document type from ID pattern
   * @param {string} id - Document ID
   * @returns {string|null} Document type or null if not recognized
   */
  detectDocumentType(id) {
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

  /**
   * Validate a markdown file with frontmatter
   * @param {string} filePath - Path to markdown file
   * @returns {Object} Validation result
   */
  async validateFile(filePath) {
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

      const frontmatter = yaml.load(frontmatterMatch[1]);
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
        errors: [`Failed to validate file: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate all documents in a directory
   * @param {string} dirPath - Directory path
   * @param {Object} options - Validation options
   * @returns {Object} Validation summary
   */
  async validateDirectory(dirPath, options = {}) {
    const results = {
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
      results.errors.push(`Directory validation failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Find all markdown files in directory
   * @param {string} dirPath - Directory path
   * @param {boolean} recursive - Search recursively
   * @returns {Array} Array of file paths
   */
  async findMarkdownFiles(dirPath, recursive = true) {
    const files = [];

    const processDir = async (currentDir) => {
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

module.exports = SchemaValidator;
