/**
 * Requirements Manager for MCP Server
 *
 * Handles requirement operations via MCP tools
 */

import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'node:child_process';
import yaml from 'yaml';

interface RequirementFilters {
  status?: string;
  epic?: string;
  priority?: string;
  category?: string;
}

interface RequirementSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  epic: string;
  category: string;
  path: string;
}

interface RequirementFull extends RequirementSummary {
  content: string;
  scenarios: string | null;
  hasScenarios: boolean;
}

interface ParsedRequirement {
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  epic?: string;
  scenarios: string | null;
  hasScenarios: boolean;
  [key: string]: unknown;
}

interface ValidateResult {
  success: boolean;
  output: string;
  error?: string;
  id: string;
}

interface CreateRequirementData {
  title: string;
  epic?: string;
  priority?: string;
  category?: string;
}

class RequirementsManager {
  protected projectRoot: string;
  protected requirementsDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.requirementsDir = path.join(
      projectRoot,
      'supernal-coding',
      'requirements'
    );
  }

  async list(filters: RequirementFilters = {}): Promise<RequirementSummary[]> {
    const requirements: RequirementSummary[] = [];
    const categories = await this.getCategories();

    for (const category of categories) {
      const categoryPath = path.join(this.requirementsDir, category);
      const files = await fs.readdir(categoryPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const reqPath = path.join(categoryPath, file);
        const req = await this.parseRequirement(reqPath);

        if (filters.status && req.status !== filters.status) continue;
        if (filters.epic && req.epic !== filters.epic) continue;
        if (filters.priority && req.priority !== filters.priority) continue;
        if (filters.category && category !== filters.category) continue;

        requirements.push({
          id: req.id || '',
          title: req.title || '',
          status: req.status || '',
          priority: req.priority || '',
          epic: req.epic || '',
          category,
          path: reqPath
        });
      }
    }

    return requirements;
  }

  async read(id: string): Promise<RequirementFull> {
    const reqPath = await this.findRequirement(id);
    if (!reqPath) {
      throw new Error(`Requirement ${id} not found`);
    }

    const content = await fs.readFile(reqPath, 'utf8');
    const parsed = await this.parseRequirement(reqPath);

    return {
      id: parsed.id || '',
      title: parsed.title || '',
      status: parsed.status || '',
      priority: parsed.priority || '',
      epic: parsed.epic || '',
      category: path.basename(path.dirname(reqPath)),
      content,
      path: reqPath,
      scenarios: parsed.scenarios,
      hasScenarios: parsed.hasScenarios
    };
  }

  async validate(id: string): Promise<ValidateResult> {
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
      const err = error as { stdout?: string; stderr?: string; message: string };
      return {
        success: false,
        output: err.stdout || err.message,
        error: err.stderr,
        id
      };
    }
  }

  async create(data: CreateRequirementData): Promise<RequirementFull | { success: boolean; output: string }> {
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

      const match = result.match(/REQ-\d+/);
      if (match) {
        return await this.read(match[0]);
      }

      return {
        success: true,
        output: result
      };
    } catch (error) {
      throw new Error(`Failed to create requirement: ${(error as Error).message}`);
    }
  }

  async getCategories(): Promise<string[]> {
    const categories = await fs.readdir(this.requirementsDir);
    return categories.filter((name) => {
      const stat = fs.statSync(path.join(this.requirementsDir, name));
      return stat.isDirectory();
    });
  }

  async findRequirement(id: string): Promise<string | null> {
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

  async parseRequirement(filePath: string): Promise<ParsedRequirement> {
    const content = await fs.readFile(filePath, 'utf8');

    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('Invalid requirement format: missing frontmatter');
    }

    const frontmatter = yaml.parse(frontmatterMatch[1]);

    const gherkinMatch = content.match(/```gherkin\n([\s\S]+?)```/);
    const scenarios = gherkinMatch ? gherkinMatch[1] : null;

    return {
      ...frontmatter,
      scenarios,
      hasScenarios: !!scenarios
    };
  }
}

export default RequirementsManager;
module.exports = RequirementsManager;
