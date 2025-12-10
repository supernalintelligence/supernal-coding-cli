/**
 * DocumentRegistry - Registry of document types and their rules
 */

interface DocumentTypeDefinition {
  id: string;
  name: string;
  template: string;
  category?: string;
  requiredIn?: string[];
  validationRules?: string[];
  filePattern?: string;
}

interface DocumentType extends DocumentTypeDefinition {
  category: string;
  requiredIn: string[];
  validationRules: string[];
  filePattern: string;
}

class DocumentRegistry {
  protected types: Map<string, DocumentType>;

  constructor() {
    this.types = new Map();
    this.initializeDefaultTypes();
  }

  initializeDefaultTypes(): void {
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

    this.registerType({
      id: 'adr',
      name: 'Architecture Decision Record',
      template: 'adr',
      category: 'decision',
      requiredIn: ['architecture', 'design'],
      validationRules: ['frontmatter-required', 'decision-id-format'],
      filePattern: 'adr-*.md'
    });

    this.registerType({
      id: 'sop',
      name: 'Standard Operating Procedure',
      template: 'sop',
      category: 'process',
      requiredIn: ['operations', 'deployment'],
      validationRules: ['frontmatter-required', 'sop-id-format'],
      filePattern: 'sop-*.md'
    });

    this.registerType({
      id: 'brd',
      name: 'Business Requirements Document',
      template: 'brd',
      category: 'requirements',
      requiredIn: ['requirements'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-requirements.md'
    });

    this.registerType({
      id: 'trd',
      name: 'Technical Requirements Document',
      template: 'trd',
      category: 'requirements',
      requiredIn: ['requirements'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-technical.md'
    });

    this.registerType({
      id: 'crd',
      name: 'Component Requirements Document',
      template: 'crd',
      category: 'requirements',
      requiredIn: ['design', 'implementation'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-component.md'
    });

    this.registerType({
      id: 'dd',
      name: 'Design Document',
      template: 'dd',
      category: 'design',
      requiredIn: ['design'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-design.md'
    });

    this.registerType({
      id: 'test-plan',
      name: 'Test Plan',
      template: 'test-plan',
      category: 'testing',
      requiredIn: ['testing', 'validation'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-test-plan.md'
    });

    this.registerType({
      id: 'deployment-guide',
      name: 'Deployment Guide',
      template: 'deployment-guide',
      category: 'operations',
      requiredIn: ['deployment'],
      validationRules: ['frontmatter-required'],
      filePattern: '*-deployment.md'
    });

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

  registerType(typeDefinition: DocumentTypeDefinition): void {
    const required: Array<keyof DocumentTypeDefinition> = ['id', 'name', 'template'];

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

  getType(typeId: string): DocumentType | null {
    return this.types.get(typeId) || null;
  }

  listTypes(category: string | null = null): DocumentType[] {
    const types = Array.from(this.types.values());

    if (category) {
      return types.filter((t) => t.category === category);
    }

    return types;
  }

  getTypesForPhase(phaseId: string): DocumentType[] {
    const types = Array.from(this.types.values());
    return types.filter((t) => t.requiredIn.includes(phaseId));
  }

  getTypesByCategory(category: string): DocumentType[] {
    return this.listTypes(category);
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    for (const type of this.types.values()) {
      categories.add(type.category);
    }
    return Array.from(categories).sort();
  }

  getAllTypes(): DocumentType[] {
    return Array.from(this.types.values());
  }

  hasType(typeId: string): boolean {
    return this.types.has(typeId);
  }

  getTemplateForType(typeId: string): string | null {
    const type = this.getType(typeId);
    return type ? type.template : null;
  }

  findTypeByFilename(filename: string): DocumentType | null {
    for (const type of this.types.values()) {
      const pattern = type.filePattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      const regex = new RegExp(`^${pattern}$`, 'i');

      if (regex.test(filename)) {
        return type;
      }
    }
    return null;
  }

  getTypeCount(): number {
    return this.types.size;
  }
}

export { DocumentRegistry };
module.exports = { DocumentRegistry };
