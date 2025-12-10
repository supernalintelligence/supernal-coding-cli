import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';

interface TemplateSection {
  id: string;
  name: string;
  required?: boolean;
  order?: number;
}

interface TemplateFrontmatter {
  required?: string[];
  [key: string]: unknown;
}

interface Template {
  name: string;
  type: string;
  version: string;
  description?: string;
  sections?: TemplateSection[];
  frontmatter?: TemplateFrontmatter;
}

interface TemplateSummary {
  name: string;
  fullName: string;
  type: string;
  version: string;
  description: string;
}

class TemplateLoader {
  protected templatesDir: string;
  protected cache: Map<string, Template>;

  constructor() {
    this.templatesDir = path.join(__dirname, '..', 'templates');
    this.cache = new Map();
  }

  async loadTemplate(templateName: string): Promise<Template> {
    if (this.cache.has(templateName)) {
      return this.cache.get(templateName)!;
    }

    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.yaml`);
      const content = await fs.readFile(templatePath, 'utf8');
      const template: Template = yaml.parse(content);

      this.validateTemplateStructure(template);

      this.cache.set(templateName, template);

      return template;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Template "${templateName}" not found`);
      }
      throw new Error(
        `Failed to load template "${templateName}": ${(error as Error).message}`
      );
    }
  }

  async listTemplates(type: string | null = null): Promise<TemplateSummary[]> {
    try {
      const files = await fs.readdir(this.templatesDir);
      const yamlFiles = files.filter((f) => f.endsWith('.yaml'));

      const templates: TemplateSummary[] = [];

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
      throw new Error(`Failed to list templates: ${(error as Error).message}`);
    }
  }

  async getTemplatesByType(type: string): Promise<TemplateSummary[]> {
    return this.listTemplates(type);
  }

  validateTemplateStructure(template: Template): void {
    const required: Array<keyof Template> = ['name', 'type', 'version'];

    for (const field of required) {
      if (!template[field]) {
        throw new Error(`Template missing required field: ${field}`);
      }
    }

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

    if (template.frontmatter) {
      if (typeof template.frontmatter !== 'object') {
        throw new Error('Template frontmatter must be an object');
      }
    }
  }

  async getRequiredSections(templateName: string): Promise<TemplateSection[]> {
    const template = await this.loadTemplate(templateName);
    if (!template.sections) return [];

    return template.sections
      .filter((s) => s.required)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getAllSections(templateName: string): Promise<TemplateSection[]> {
    const template = await this.loadTemplate(templateName);
    if (!template.sections) return [];

    return template.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getRequiredFrontmatter(templateName: string): Promise<string[]> {
    const template = await this.loadTemplate(templateName);
    if (!template.frontmatter || !template.frontmatter.required) return [];

    return template.frontmatter.required;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async exists(templateName: string): Promise<boolean> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.yaml`);
      await fs.access(templatePath);
      return true;
    } catch {
      return false;
    }
  }
}

export { TemplateLoader };
module.exports = { TemplateLoader };
