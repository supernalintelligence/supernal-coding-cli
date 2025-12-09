/**
 * Naming Convention Validator for REQ-075
 * Validates document IDs and filenames against naming conventions
 */

const path = require('node:path');

class NamingValidator {
  constructor() {
    this.patterns = {
      evidence: {
        id: /^\d{4}-\d{2}-\d{2}-.+$/,
        filename: /^\d{4}-\d{2}-\d{2}-.+\.md$/,
        description: 'YYYY-MM-DD-{DESCRIPTION}.md'
      },
      problem: {
        id: /^PROB-(USER|ADMIN|OPS|DEV|COMPLIANCE)-\d{3}-.+$/,
        filename: /^prob-(user|admin|ops|dev|compliance)-\d{3}\.md$/,
        description: 'prob-{who}-{number}.md'
      },
      architecture: {
        id: /^ARCH-(PLATFORM|BACKEND|FRONTEND|INTEGRATION)-.+-\d{3}-.+$/,
        filename: /^arch-(platform|backend|frontend|integration)-.+-\d{3}\.md$/,
        description: 'arch-{layer}-{domain}-{number}.md'
      },
      functional_requirement: {
        id: /^REQ-.+-\d{3}-.+$/,
        filename: /^req-.+-\d{3}\.md$/,
        description: 'req-{domain}-{number}.md'
      },
      user_story: {
        id: /^STORY-(BUYER|SELLER|ADMIN|DEVELOPER|AUDITOR)-\d{3}-.+$/,
        filename: /^story-(buyer|seller|admin|developer|auditor)-\d{3}\.md$/,
        description: 'story-{persona}-{number}.md'
      },
      design_document: {
        id: /^DD-\d{3}-.+$/,
        filename: /^dd-\d{3}\.md$/,
        description: 'dd-{number}.md'
      },
      business_case: {
        id: /^BIZ-\d{3}-.+$/,
        filename: /^biz-\d{3}\.md$/,
        description: 'biz-{number}.md'
      }
    };
  }

  /**
   * Validate document ID against naming conventions
   * @param {string} id - Document ID
   * @param {string} documentType - Document type
   * @returns {Object} Validation result
   */
  validateId(id, documentType) {
    const pattern = this.patterns[documentType];

    if (!pattern) {
      return {
        valid: false,
        errors: [`Unknown document type: ${documentType}`],
        suggestions: []
      };
    }

    const valid = pattern.id.test(id);
    const errors = [];
    const suggestions = [];

    if (!valid) {
      errors.push(`ID "${id}" does not match pattern for ${documentType}`);
      suggestions.push(`Expected pattern: ${pattern.description}`);

      // Provide specific suggestions based on common mistakes
      if (documentType === 'problem' && !id.startsWith('PROB-')) {
        suggestions.push('Problem IDs must start with "PROB-"');
      }

      if (documentType === 'functional_requirement' && !id.startsWith('REQ-')) {
        suggestions.push('Requirement IDs must start with "REQ-"');
      }

      if (documentType === 'user_story' && !id.startsWith('STORY-')) {
        suggestions.push('Story IDs must start with "STORY-"');
      }
    }

    return { valid, errors, suggestions };
  }

  /**
   * Validate filename against naming conventions
   * @param {string} filename - Filename
   * @param {string} documentType - Document type
   * @returns {Object} Validation result
   */
  validateFilename(filename, documentType) {
    const pattern = this.patterns[documentType];

    if (!pattern) {
      return {
        valid: false,
        errors: [`Unknown document type: ${documentType}`],
        suggestions: []
      };
    }

    const valid = pattern.filename.test(filename);
    const errors = [];
    const suggestions = [];

    if (!valid) {
      errors.push(
        `Filename "${filename}" does not match pattern for ${documentType}`
      );
      suggestions.push(`Expected pattern: ${pattern.description}`);
    }

    return { valid, errors, suggestions };
  }

  /**
   * Normalize document ID to filename
   * @param {string} id - Document ID
   * @returns {string} Normalized filename
   */
  normalizeIdToFilename(id) {
    if (!id) return null;

    // Evidence documents keep full ID as filename
    if (id.match(/^\d{4}-\d{2}-\d{2}-.+$/)) {
      return `${id}.md`;
    }

    // For other document types, extract the prefix and number
    const patterns = [
      {
        regex: /^PROB-(USER|ADMIN|OPS|DEV|COMPLIANCE)-(\d{3})-.+$/,
        format: (match) => `prob-${match[1].toLowerCase()}-${match[2]}.md`
      },
      {
        regex: /^ARCH-(PLATFORM|BACKEND|FRONTEND|INTEGRATION)-(.+)-(\d{3})-.+$/,
        format: (match) =>
          `arch-${match[1].toLowerCase()}-${match[2].toLowerCase()}-${match[3]}.md`
      },
      {
        regex: /^REQ-(.+)-(\d{3})-.+$/,
        format: (match) => `req-${match[1].toLowerCase()}-${match[2]}.md`
      },
      {
        regex: /^STORY-(BUYER|SELLER|ADMIN|DEVELOPER|AUDITOR)-(\d{3})-.+$/,
        format: (match) => `story-${match[1].toLowerCase()}-${match[2]}.md`
      },
      { regex: /^DD-(\d{3})-.+$/, format: (match) => `dd-${match[1]}.md` },
      { regex: /^BIZ-(\d{3})-.+$/, format: (match) => `biz-${match[1]}.md` }
    ];

    for (const pattern of patterns) {
      const match = id.match(pattern.regex);
      if (match) {
        return pattern.format(match);
      }
    }

    // Fallback: convert to lowercase and add .md
    return `${id.toLowerCase()}.md`;
  }

  /**
   * Extract document ID from filename
   * @param {string} filename - Filename
   * @returns {string|null} Document ID or null if cannot be determined
   */
  extractIdFromFilename(filename) {
    const baseName = path.basename(filename, '.md');

    // Evidence documents
    if (baseName.match(/^\d{4}-\d{2}-\d{2}-.+$/)) {
      return baseName;
    }

    // Other document types - this is more complex as we lose the descriptive part
    // This would need to be looked up from the document content
    return null;
  }

  /**
   * Suggest correct filename for a document ID
   * @param {string} id - Document ID
   * @returns {string} Suggested filename
   */
  suggestFilename(id) {
    return this.normalizeIdToFilename(id);
  }

  /**
   * Validate document ID and filename consistency
   * @param {string} id - Document ID
   * @param {string} filename - Current filename
   * @returns {Object} Validation result
   */
  validateConsistency(id, filename) {
    const expectedFilename = this.normalizeIdToFilename(id);
    const actualFilename = path.basename(filename);

    const consistent = expectedFilename === actualFilename;

    return {
      consistent,
      expectedFilename,
      actualFilename,
      suggestion: consistent ? null : `Rename file to: ${expectedFilename}`
    };
  }

  /**
   * Detect document type from ID
   * @param {string} id - Document ID
   * @returns {string|null} Document type or null
   */
  detectDocumentType(id) {
    if (!id) return null;

    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.id.test(id)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Generate next available ID for a document type
   * @param {string} documentType - Document type
   * @param {string} domain - Domain (for applicable types)
   * @param {Array} existingIds - Array of existing IDs
   * @returns {string} Next available ID
   */
  generateNextId(documentType, domain, existingIds = []) {
    const typePrefix = this.getTypePrefix(documentType, domain);

    if (!typePrefix) {
      throw new Error(
        `Cannot generate ID for unknown document type: ${documentType}`
      );
    }

    // Find highest existing number for this type/domain
    let maxNumber = 0;
    const pattern = new RegExp(
      `^${typePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{3})-`
    );

    existingIds.forEach((id) => {
      const match = id.match(pattern);
      if (match) {
        const number = parseInt(match[1], 10);
        if (number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
    return `${typePrefix}${nextNumber}-PLACEHOLDER`;
  }

  /**
   * Get type prefix for ID generation
   * @param {string} documentType - Document type
   * @param {string} domain - Domain
   * @returns {string} Type prefix
   */
  getTypePrefix(documentType, domain) {
    switch (documentType) {
      case 'problem':
        return `PROB-${domain.toUpperCase()}-`;
      case 'architecture':
        // Would need layer and domain for architecture
        return null;
      case 'functional_requirement':
        return `REQ-${domain.toUpperCase()}-`;
      case 'user_story':
        return `STORY-${domain.toUpperCase()}-`;
      case 'design_document':
        return 'DD-';
      case 'business_case':
        return 'BIZ-';
      default:
        return null;
    }
  }
}

module.exports = NamingValidator;
