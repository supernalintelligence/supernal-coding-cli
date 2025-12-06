const handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

/**
 * Template engine for generating files from Handlebars templates
 */
class TemplateEngine {
  constructor() {
    this.templatesDir = path.join(__dirname);
    this.setupHelpers();
  }

  /**
   * Setup Handlebars helpers
   */
  setupHelpers() {
    // Date formatting helper
    handlebars.registerHelper('formatDate', (date, format) => {
      if (!date) date = new Date();
      if (typeof date === 'string') date = new Date(date);

      switch (format) {
        case 'year':
          return date.getFullYear();
        case 'iso':
          return date.toISOString();
        default:
          return date.toLocaleDateString();
      }
    });

    // String transformation helpers
    handlebars.registerHelper('lowercase', (str) => str.toLowerCase());
    handlebars.registerHelper('uppercase', (str) => str.toUpperCase());
    handlebars.registerHelper('camelCase', (str) =>
      str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    );
    handlebars.registerHelper('kebabCase', (str) =>
      str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    );
    handlebars.registerHelper('pascalCase', (str) =>
      str.replace(/(^|-)([a-z])/g, (g) => g.slice(-1).toUpperCase())
    );

    // Array helpers
    handlebars.registerHelper('join', (array, separator = ', ') => {
      if (!Array.isArray(array)) return '';
      return array.join(separator);
    });

    handlebars.registerHelper('length', (array) => {
      if (!Array.isArray(array)) return 0;
      return array.length;
    });

    // Conditional helpers
    handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    handlebars.registerHelper('ifContains', function (array, value, options) {
      if (!Array.isArray(array)) return options.inverse(this);
      return array.includes(value) ? options.fn(this) : options.inverse(this);
    });

    // Package.json helpers
    handlebars.registerHelper('dependenciesObject', (dependencies) => {
      if (!Array.isArray(dependencies)) return '{}';

      const deps = {};
      dependencies.forEach((dep) => {
        if (typeof dep === 'string') {
          deps[dep] = '^1.0.0'; // Default version
        } else if (dep.name) {
          deps[dep.name] = dep.version || '^1.0.0';
        }
      });

      return JSON.stringify(deps, null, 2).split('\n').slice(1, -1).join('\n');
    });

    // Scripts helpers
    handlebars.registerHelper('scriptsObject', (scripts) => {
      if (!scripts || typeof scripts !== 'object') return '{}';
      return JSON.stringify(scripts, null, 2)
        .split('\n')
        .slice(1, -1)
        .join('\n');
    });
  }

  /**
   * Generate a file from template
   */
  async generateTemplate(templatePath, variables = {}) {
    try {
      const fullTemplatePath = path.join(this.templatesDir, templatePath);

      if (!(await fs.pathExists(fullTemplatePath))) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      const templateContent = await fs.readFile(fullTemplatePath, 'utf8');
      const template = handlebars.compile(templateContent);

      return template(variables);
    } catch (error) {
      console.error(
        chalk.red(`❌ Template generation failed for ${templatePath}:`),
        error.message
      );
      throw error;
    }
  }

  /**
   * Generate and write template to file
   */
  async generateTemplateToFile(templatePath, outputPath, variables = {}) {
    try {
      const content = await this.generateTemplate(templatePath, variables);
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, content);

      return content;
    } catch (error) {
      console.error(
        chalk.red(`❌ Failed to generate ${templatePath} to ${outputPath}:`),
        error.message
      );
      throw error;
    }
  }

  /**
   * Generate multiple templates
   */
  async generateTemplates(templates, variables = {}) {
    const results = {};

    for (const [name, templatePath] of Object.entries(templates)) {
      try {
        results[name] = await this.generateTemplate(templatePath, variables);
      } catch (error) {
        console.error(
          chalk.red(
            `❌ Failed to generate template ${name} (${templatePath}):`
          ),
          error.message
        );
        throw error;
      }
    }

    return results;
  }

  /**
   * Check if template exists
   */
  async templateExists(templatePath) {
    const fullPath = path.join(this.templatesDir, templatePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * List available templates
   */
  async listTemplates(directory = '') {
    const searchDir = path.join(this.templatesDir, directory);

    if (!(await fs.pathExists(searchDir))) {
      return [];
    }

    const files = await fs.readdir(searchDir, { withFileTypes: true });
    const templates = [];

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.hbs')) {
        templates.push(path.join(directory, file.name));
      } else if (file.isDirectory()) {
        const subTemplates = await this.listTemplates(
          path.join(directory, file.name)
        );
        templates.push(...subTemplates);
      }
    }

    return templates;
  }
}

// Create singleton instance
const templateEngine = new TemplateEngine();

// Export main functions
module.exports = {
  generateTemplate: templateEngine.generateTemplate.bind(templateEngine),
  generateTemplateToFile:
    templateEngine.generateTemplateToFile.bind(templateEngine),
  generateTemplates: templateEngine.generateTemplates.bind(templateEngine),
  templateExists: templateEngine.templateExists.bind(templateEngine),
  listTemplates: templateEngine.listTemplates.bind(templateEngine),
  engine: templateEngine
};
