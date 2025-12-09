/**
 * DocumentRegistry - Registry of document types and their rules
 */
class DocumentRegistry {
  constructor() {
    this.types = new Map();
    this.initializeDefaultTypes();
  }

  /**
   * Initialize default document types
   */
  initializeDefaultTypes() {
    // Software Architecture Document
    this.registerType({
      id: 'sad',
      name: 'Software Architecture Document',
      template: 'sad',
      category: 'architecture',
      requiredIn: ['architecture', 'design'],
      validationRules: [
        'frontmatter-required',
        'sections-required',
        'architecture-diagram-required'
      ],
      filePattern: '*-architecture.md'
    });

    // Architecture Decision Document
    this.registerType({
      id: 'adr',
      name: 'Architecture Decision Record',
      template: 'adr',
      category: 'decision',
      requiredIn: ['architecture', 'design'],
      validationRules: ['frontmatter-required', 'decision-id-format'],
      filePattern: 'adr-*.md'
    });

    // Standard Operating Procedure
    this.registerType({
      id: 'sop',
      name: 'Standard Operating Procedure',
      template: 'sop',
      category: 'process',
      requiredIn: ['operations', 'deployment'],
      validationRules: ['frontmatter-required', 'sop-id-format'],
      filePattern: 'sop-*.md'
    });

    // Business Requirements Document
    this.registerType({
      id: 'brd',
      name: 'Business Requirements Document',
      template: 'brd',
      category: 'requirements',
      requiredIn: ['requirements'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-requirements.md'
    });

    // Technical Requirements Document
    this.registerType({
      id: 'trd',
      name: 'Technical Requirements Document',
      template: 'trd',
      category: 'requirements',
      requiredIn: ['requirements'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-technical.md'
    });

    // Component Requirements Document
    this.registerType({
      id: 'crd',
      name: 'Component Requirements Document',
      template: 'crd',
      category: 'requirements',
      requiredIn: ['design', 'implementation'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-component.md'
    });

    // Design Document
    this.registerType({
      id: 'dd',
      name: 'Design Document',
      template: 'dd',
      category: 'design',
      requiredIn: ['design'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-design.md'
    });

    // Test Plan
    this.registerType({
      id: 'test-plan',
      name: 'Test Plan',
      template: 'test-plan',
      category: 'testing',
      requiredIn: ['testing', 'validation'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-test-plan.md'
    });

    // Deployment Guide
    this.registerType({
      id: 'deployment-guide',
      name: 'Deployment Guide',
      template: 'deployment-guide',
      category: 'operations',
      requiredIn: ['deployment'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-deployment.md'
    });

    // User Manual
    this.registerType({
      id: 'user-manual',
      name: 'User Manual',
      template: 'user-manual',
      category: 'documentation',
      requiredIn: ['documentation'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-manual.md'
    });
  }

  /**
   * Register a document type
   * @param {Object} typeDefinition
   */
  registerType(typeDefinition) {
    const required = ['id', 'name', 'template'];

    for (const field of required) {
      if (!typeDefinition[field]) {
        throw new Error(`Document type missing required field: ${field}`);
      }
    }

    this.types.set(typeDefinition.id, {
      ...typeDefinition,
      category: typeDefinition.category || 'general',
      requiredIn: typeDefinition.requiredIn || [],
      validationRules: typeDefinition.validationRules || [],
      filePattern: typeDefinition.filePattern || '*.md'
    });
  }

  /**
   * Get document type by ID
   * @param {string} typeId
   * @returns {Object|null}
   */
  getType(typeId) {
    return this.types.get(typeId) || null;
  }

  /**
   * List all registered types
   * @param {string} category - Optional: filter by category
   * @returns {Array<Object>}
   */
  listTypes(category = null) {
    const types = Array.from(this.types.values());

    if (category) {
      return types.filter((t) => t.category === category);
    }

    return types;
  }

  /**
   * Get document types required for a phase
   * @param {string} phaseId
   * @returns {Array<Object>}
   */
  getTypesForPhase(phaseId) {
    const types = Array.from(this.types.values());
    return types.filter((t) => t.requiredIn.includes(phaseId));
  }

  /**
   * Get document types by category
   * @param {string} category
   * @returns {Array<Object>}
   */
  getTypesByCategory(category) {
    return this.listTypes(category);
  }

  /**
   * Get all categories
   * @returns {Array<string>}
   */
  getCategories() {
    const categories = new Set();
    for (const type of this.types.values()) {
      categories.add(type.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get all registered types
   * @returns {Array<Object>}
   */
  getAllTypes() {
    return Array.from(this.types.values());
  }

  /**
   * Check if type exists
   * @param {string} typeId
   * @returns {boolean}
   */
  hasType(typeId) {
    return this.types.has(typeId);
  }

  /**
   * Get template name for document type
   * @param {string} typeId
   * @returns {string|null}
   */
  getTemplateForType(typeId) {
    const type = this.getType(typeId);
    return type ? type.template : null;
  }

  /**
   * Find document type by file pattern
   * @param {string} filename
   * @returns {Object|null}
   */
  findTypeByFilename(filename) {
    for (const type of this.types.values()) {
      // Simple pattern matching (could be enhanced with minimatch)
      const pattern = type.filePattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      const regex = new RegExp(`^${pattern}$`, 'i');

      if (regex.test(filename)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Get type count
   * @returns {number}
   */
  getTypeCount() {
    return this.types.size;
  }
}

module.exports = { DocumentRegistry };
