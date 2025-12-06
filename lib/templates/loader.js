const fs = require('node:fs').promises;
const path = require('node:path');
const yaml = require('yaml');

/**
 * TemplateLoader - Load and manage document templates
 */
class TemplateLoader {
  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates');
    this.cache = new Map();
  }

  /**
   * Load template by name
   * @param {string} templateName - Template name (without .yaml extension)
   * @returns {Promise<Object>} Template definition
   */
  async loadTemplate(templateName) {
    // Check cache
    if (this.cache.has(templateName)) {
      return this.cache.get(templateName);
    }

    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.yaml`);
      const content = await fs.readFile(templatePath, 'utf8');
      const template = yaml.parse(content);

      // Validate template structure
      this.validateTemplateStructure(template);

      // Cache it
      this.cache.set(templateName, template);

      return template;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Template "${templateName}" not found`);
      }
      throw new Error(
        `Failed to load template "${templateName}": ${error.message}`
      );
    }
  }

  /**
   * List all available templates
   * @param {string} type - Optional: filter by document type
   * @returns {Promise<Array<Object>>} Array of template summaries
   */
  async listTemplates(type = null) {
    try {
      const files = await fs.readdir(this.templatesDir);
      const yamlFiles = files.filter((f) => f.endsWith('.yaml'));

      const templates = [];

      for (const file of yamlFiles) {
        const templateName = file.replace('.yaml', '');
        const template = await this.loadTemplate(templateName);

        if (!type || template.type === type) {
          templates.push({
            name: templateName,
            fullName: template.name,
            type: template.type,
            version: template.version,
            description: template.description || ''
          });
        }
      }

      return templates;
    } catch (error) {
      throw new Error(`Failed to list templates: ${error.message}`);
    }
  }

  /**
   * Get template by document type
   * @param {string} type - Document type (e.g., 'architecture', 'decision')
   * @returns {Promise<Array<Object>>} Templates matching type
   */
  async getTemplatesByType(type) {
    return this.listTemplates(type);
  }

  /**
   * Validate template structure
   * @param {Object} template
   * @throws {Error} If template is invalid
   */
  validateTemplateStructure(template) {
    const required = ['name', 'type', 'version'];

    for (const field of required) {
      if (!template[field]) {
        throw new Error(`Template missing required field: ${field}`);
      }
    }

    // Validate sections if present
    if (template.sections) {
      if (!Array.isArray(template.sections)) {
        throw new Error('Template sections must be an array');
      }

      for (const section of template.sections) {
        if (!section.id || !section.name) {
          throw new Error('Template section missing id or name');
        }
      }
    }

    // Validate frontmatter if present
    if (template.frontmatter) {
      if (typeof template.frontmatter !== 'object') {
        throw new Error('Template frontmatter must be an object');
      }
    }
  }

  /**
   * Get required sections for a template
   * @param {string} templateName
   * @returns {Promise<Array<Object>>} Required sections
   */
  async getRequiredSections(templateName) {
    const template = await this.loadTemplate(templateName);
    if (!template.sections) return [];

    return template.sections
      .filter((s) => s.required)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get all sections for a template
   * @param {string} templateName
   * @returns {Promise<Array<Object>>} All sections
   */
  async getAllSections(templateName) {
    const template = await this.loadTemplate(templateName);
    if (!template.sections) return [];

    return template.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get required frontmatter fields
   * @param {string} templateName
   * @returns {Promise<Array<string>>} Required fields
   */
  async getRequiredFrontmatter(templateName) {
    const template = await this.loadTemplate(templateName);
    if (!template.frontmatter || !template.frontmatter.required) return [];

    return template.frontmatter.required;
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Check if template exists
   * @param {string} templateName
   * @returns {Promise<boolean>}
   */
  async exists(templateName) {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.yaml`);
      await fs.access(templatePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { TemplateLoader };
