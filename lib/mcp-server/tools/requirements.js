/**
 * Requirements Manager for MCP Server
 *
 * Handles requirement operations via MCP tools
 */

const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');
const yaml = require('yaml');

class RequirementsManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.requirementsDir = path.join(
      projectRoot,
      'supernal-coding',
      'requirements'
    );
  }

  /**
   * List all requirements with optional filtering
   */
  async list(filters = {}) {
    const requirements = [];
    const categories = await this.getCategories();

    for (const category of categories) {
      const categoryPath = path.join(this.requirementsDir, category);
      const files = await fs.readdir(categoryPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const reqPath = path.join(categoryPath, file);
        const req = await this.parseRequirement(reqPath);

        // Apply filters
        if (filters.status && req.status !== filters.status) continue;
        if (filters.epic && req.epic !== filters.epic) continue;
        if (filters.priority && req.priority !== filters.priority) continue;
        if (filters.category && category !== filters.category) continue;

        requirements.push({
          id: req.id,
          title: req.title,
          status: req.status,
          priority: req.priority,
          epic: req.epic,
          category,
          path: reqPath
        });
      }
    }

    return requirements;
  }

  /**
   * Read a specific requirement
   */
  async read(id) {
    const reqPath = await this.findRequirement(id);
    if (!reqPath) {
      throw new Error(`Requirement ${id} not found`);
    }

    const content = await fs.readFile(reqPath, 'utf8');
    const parsed = await this.parseRequirement(reqPath);

    return {
      ...parsed,
      content,
      path: reqPath
    };
  }

  /**
   * Validate a requirement
   */
  async validate(id) {
    try {
      const result = execSync(`sc req validate ${id}`, {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      return {
        success: true,
        output: result,
        id
      };
    } catch (error) {
      return {
        success: false,
        output: error.stdout || error.message,
        error: error.stderr,
        id
      };
    }
  }

  /**
   * Create a new requirement
   */
  async create(data) {
    const args = [
      'req',
      'new',
      `"${data.title}"`,
      data.epic && `--epic=${data.epic}`,
      data.priority && `--priority=${data.priority}`,
      data.category && `--category=${data.category}`
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const result = execSync(`sc ${args}`, {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      // Extract requirement ID from output
      const match = result.match(/REQ-\d+/);
      if (match) {
        return await this.read(match[0]);
      }

      return {
        success: true,
        output: result
      };
    } catch (error) {
      throw new Error(`Failed to create requirement: ${error.message}`);
    }
  }

  /**
   * Get list of requirement categories
   */
  async getCategories() {
    const categories = await fs.readdir(this.requirementsDir);
    return categories.filter((name) => {
      const stat = fs.statSync(path.join(this.requirementsDir, name));
      return stat.isDirectory();
    });
  }

  /**
   * Find requirement file by ID
   */
  async findRequirement(id) {
    const categories = await this.getCategories();

    for (const category of categories) {
      const categoryPath = path.join(this.requirementsDir, category);
      const files = await fs.readdir(categoryPath);

      for (const file of files) {
        if (file.includes(id.toLowerCase())) {
          return path.join(categoryPath, file);
        }
      }
    }

    return null;
  }

  /**
   * Parse requirement markdown file
   */
  async parseRequirement(filePath) {
    const content = await fs.readFile(filePath, 'utf8');

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('Invalid requirement format: missing frontmatter');
    }

    const frontmatter = yaml.parse(frontmatterMatch[1]);

    // Extract Gherkin scenarios
    const gherkinMatch = content.match(/```gherkin\n([\s\S]+?)```/);
    const scenarios = gherkinMatch ? gherkinMatch[1] : null;

    return {
      ...frontmatter,
      scenarios,
      hasScenarios: !!scenarios
    };
  }
}

module.exports = RequirementsManager;
