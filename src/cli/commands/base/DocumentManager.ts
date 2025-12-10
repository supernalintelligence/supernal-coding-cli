'use strict';

/**
 * @fileoverview DocumentManager Base Class
 * 
 * Type definitions available at: lib/types/documents/index.ts
 */

import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { loadProjectConfig, getDocPaths } from '../../utils/config-loader';
import type { RawSupernalConfig, DocPaths } from '../../../types/config';

// TemplateResolver is still JS, use require
const TemplateResolver = require('../../../utils/template-resolver');

/** Options for DocumentManager constructor */
export interface DocumentManagerOptions {
  documentType?: string;
  prefix?: string;
  baseDirectory?: string;
}

/** Result of document creation */
export interface CreateDocumentResult {
  id: string;
  path: string;
  filename: string;
}

/** Result of document update */
export interface UpdateDocumentResult {
  id: string | number;
  path: string;
}

/** Result of document deletion */
export interface DeleteDocumentResult {
  id: string | number;
  deleted: boolean;
  archived: boolean;
}

/** Template data */
export interface TemplateData {
  content: string;
  path: string | null;
  version: string;
  name: string;
}

/** Document filters */
export interface DocumentFilters {
  status?: string;
  category?: string;
  [key: string]: string | undefined;
}

/** Document data for creation */
export interface DocumentCreateData {
  id?: number | string;
  title: string;
  category?: string;
  templateName?: string;
  created_from_template?: string;
  version?: string;
  created?: string;
  date?: string;
  [key: string]: unknown;
}

/**
 * DocumentManager Base Class
 *
 * Provides common CRUD operations for document-based entities (requirements, compliance, features, etc.)
 * Eliminates ~60% code duplication between RequirementManager and ComplianceManager
 *
 * See: docs/features/compliance-framework/framework-expansion/design/adrs/adr-architecture-003-framework-base-class.md
 */
class DocumentManager {
  protected baseDirectory: string;
  protected config: RawSupernalConfig | null;
  protected documentType: string;
  protected paths: DocPaths;
  protected prefix: string;
  protected projectRoot: string;
  protected templateResolver: InstanceType<typeof TemplateResolver>;

  constructor(options: DocumentManagerOptions = {}) {
    this.projectRoot = this.findProjectRoot();
    this.config = loadProjectConfig(this.projectRoot);
    this.paths = getDocPaths(this.config);
    this.templateResolver = new TemplateResolver(this.projectRoot);

    // Subclasses can override these
    this.documentType = options.documentType || 'document';
    this.prefix = options.prefix || 'doc';
    this.baseDirectory = options.baseDirectory || 'docs';
  }

  /**
   * Find the project root by looking for supernal.yaml
   * Prioritizes configs that have requirements defined
   */
  findProjectRoot(): string {
    let currentDir = process.cwd();
    let fallbackRoot = null;

    while (currentDir !== path.dirname(currentDir)) {
      const configPath = path.join(currentDir, 'supernal.yaml');
      if (fs.existsSync(configPath)) {
        try {
          const configContent = fs.readFileSync(configPath, 'utf8');
          if (
            configContent.includes('directory = "docs/requirements"') ||
            configContent.includes("directory = 'docs/requirements'")
          ) {
            return currentDir;
          }
          if (!fallbackRoot) {
            fallbackRoot = currentDir;
          }
        } catch (_error) {
          // Skip unreadable configs
        }
      }
      currentDir = path.dirname(currentDir);
    }

    return fallbackRoot || process.cwd();
  }

  /**
   * Get next available document ID
   */
  async getNextDocumentId(): Promise<number> {
    const docFiles = await this.getAllDocumentFiles();
    let highestId = 0;

    for (const file of docFiles) {
      const match = file.match(new RegExp(`${this.prefix}-(\\d+)`));
      if (match) {
        const id = parseInt(match[1], 10);
        if (id > highestId) {
          highestId = id;
        }
      }
    }

    return highestId + 1;
  }

  /**
   * Get all document files recursively
   */
  async getAllDocumentFiles(): Promise<string[]> {
    const files = [];
    const basePath = path.join(this.projectRoot, this.baseDirectory);
    const prefix = this.prefix; // Capture prefix in closure

    async function scanDir(dir) {
      if (!(await fs.pathExists(dir))) return;

      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          await scanDir(fullPath);
        } else if (
          item.name.endsWith('.md') &&
          item.name.includes(`${prefix}-`)
        ) {
          files.push(item.name);
        }
      }
    }

    await scanDir(basePath);
    return files;
  }

  /**
   * Load template file using TemplateResolver (finds in SC package or project override)
   * Subclasses should override getDefaultTemplate()
   */
  async loadTemplate(templateName: string | null = null): Promise<TemplateData> {
    if (templateName) {
      try {
        // Use TemplateResolver to find template (checks project override first, then package)
        const templatePath = this.templateResolver.resolve(templateName);
        if (await fs.pathExists(templatePath)) {
          const content = await fs.readFile(templatePath, 'utf8');
          const templateVersion = this.extractTemplateVersion(content);

          return {
            content,
            path: templatePath,
            version: templateVersion || '1.0.0',
            name: templateName
          };
        }
      } catch (_error) {
        // Template not found via resolver, fall back to default
      }
    }

    // Fallback to default template from subclass
    const defaultContent = this.getDefaultTemplate();
    return {
      content: defaultContent,
      path: null,
      version: '1.0.0',
      name: 'default'
    };
  }

  /**
   * Extract version from template frontmatter
   */
  extractTemplateVersion(content: string): string | null {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return null;

    const versionMatch = match[1].match(/version:\s*["']?([^"'\n]+)["']?/);
    return versionMatch ? versionMatch[1].trim() : null;
  }

  /**
   * Subclasses must override this to provide default template
   */
  getDefaultTemplate(): string {
    throw new Error('Subclass must implement getDefaultTemplate()');
  }

  /**
   * Populate template with values
   * Subclasses can override for custom placeholder handling
   */
  populateTemplate(template: string, values: Record<string, unknown>): string {
    let result = template;

    for (const [key, value] of Object.entries(values)) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    }

    return result;
  }

  /**
   * Create a new document
   */
  async createDocument(data: DocumentCreateData): Promise<CreateDocumentResult> {
    try {
      // Generate ID if not provided
      if (!data.id) {
        data.id = await this.getNextDocumentId();
      }

      // Determine category/subdirectory
      const category = this.determineCategory(data);

      // Format ID
      const formattedId = String(data.id).padStart(3, '0');

      // Generate filename
      const filename = this.generateFilename(formattedId, data.title, category);
      const filePath = path.join(
        this.projectRoot,
        this.baseDirectory,
        category || '',
        filename
      );

      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      // Load and populate template
      const templateData = await this.loadTemplate(data.templateName);

      // Add template provenance to the data
      const dataWithProvenance = {
        ...data,
        id: formattedId,
        date: new Date().toISOString().split('T')[0]
      };

      // Add template tracking if template was loaded successfully
      if (templateData.path) {
        const relativePath = path.relative(
          path.dirname(filePath),
          templateData.path
        );
        dataWithProvenance.created_from_template = `${relativePath}@${templateData.version}`;
        dataWithProvenance.version = '1.0.0'; // Initial version for new document
        dataWithProvenance.created = dataWithProvenance.date;
      }

      const content = this.populateTemplate(
        templateData.content,
        dataWithProvenance
      );

      // Write file
      await fs.writeFile(filePath, content);

      // Log creation (subclasses can override)
      this.logCreation(formattedId, filename);

      return {
        id: formattedId,
        path: filePath,
        filename
      };
    } catch (error) {
      console.error(
        chalk.red(`❌ Error creating ${this.documentType}:`),
        error.message
      );
      throw error;
    }
  }

  /**
   * List documents with optional filtering
   */
  async listDocuments(filters: DocumentFilters = {}): Promise<Array<Record<string, unknown>>> {
    const files = await this.getAllDocumentFiles();
    const documents = [];

    for (const file of files) {
      const filePath = await this.findDocumentById(
        file.match(new RegExp(`${this.prefix}-(\\d+)`))?.[1]
      );
      if (filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        const metadata = this.extractMetadata(content);

        // Apply filters
        if (filters.status && metadata.status !== filters.status) continue;
        if (filters.category && metadata.category !== filters.category)
          continue;

        documents.push({
          file,
          path: filePath,
          ...metadata
        });
      }
    }

    return documents;
  }

  /**
   * Update document
   */
  async updateDocument(id: string | number, updates: Record<string, unknown>): Promise<UpdateDocumentResult> {
    const filePath = await this.findDocumentById(id);
    if (!filePath) {
      throw new Error(`${this.documentType} ${id} not found`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    const { frontmatter, body } = this.parseContent(content);

    // Merge updates into frontmatter
    const updatedFrontmatter = { ...frontmatter, ...updates };

    // Reconstruct content
    const updatedContent = this.reconstructContent(updatedFrontmatter, body);

    // Write back
    await fs.writeFile(filePath, updatedContent);

    return { id, path: filePath };
  }

  /**
   * Delete or archive document
   */
  async deleteDocument(id: string | number, options: { archive?: boolean } = {}): Promise<DeleteDocumentResult> {
    const filePath = await this.findDocumentById(id);
    if (!filePath) {
      throw new Error(`${this.documentType} ${id} not found`);
    }

    if (options.archive) {
      const archivePath = path.join(
        this.projectRoot,
        'archive',
        new Date().toISOString().split('T')[0],
        path.basename(filePath)
      );
      await fs.ensureDir(path.dirname(archivePath));
      await fs.move(filePath, archivePath);
      console.log(
        chalk.yellow(`📦 Archived ${this.documentType} ${id} to ${archivePath}`)
      );
    } else {
      await fs.remove(filePath);
      console.log(chalk.red(`🗑️  Deleted ${this.documentType} ${id}`));
    }

    return { id, deleted: !options.archive, archived: options.archive };
  }

  /**
   * Find document file by ID
   */
  async findDocumentById(id: string | number | undefined): Promise<string | null> {
    const formattedId = String(id).padStart(3, '0');
    const basePath = path.join(this.projectRoot, this.baseDirectory);

    async function searchDir(dir) {
      if (!(await fs.pathExists(dir))) return null;

      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          const found = await searchDir(fullPath);
          if (found) return found;
        } else if (item.name.includes(`${this.prefix}-${formattedId}`)) {
          return fullPath;
        }
      }
      return null;
    }

    return await searchDir(basePath);
  }

  /**
   * Extract metadata from document frontmatter
   */
  extractMetadata(content: string): Record<string, string> {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return {};

    const frontmatter = frontmatterMatch[1];
    const metadata = {};

    frontmatter.split('\n').forEach((line) => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        metadata[match[1]] = match[2].trim();
      }
    });

    return metadata;
  }

  /**
   * Parse document content into frontmatter and body
   */
  parseContent(content: string): { frontmatter: Record<string, string>; body: string } {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return { frontmatter: {}, body: content };
    }

    const frontmatter = {};
    frontmatterMatch[1].split('\n').forEach((line) => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        frontmatter[match[1]] = match[2].trim();
      }
    });

    return {
      frontmatter,
      body: frontmatterMatch[2]
    };
  }

  /**
   * Reconstruct content from frontmatter and body
   */
  reconstructContent(frontmatter: Record<string, unknown>, body: string): string {
    const frontmatterLines = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return `---\n${frontmatterLines}\n---\n${body}`;
  }

  // Methods that subclasses should override

  /**
   * Determine category/subdirectory for document
   * Override in subclasses for custom logic
   */
  determineCategory(data: DocumentCreateData): string {
    return data.category || '';
  }

  /**
   * Generate filename for document
   * Override in subclasses for custom naming
   */
  generateFilename(id: string, title: string, _category: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${this.prefix}-${id}-${slug}.md`;
  }

  /**
   * Log document creation
   * Override in subclasses for custom messages
   */
  logCreation(id: string, filename: string): void {
    console.log(
      chalk.green(`✅ Created ${this.documentType} ${id}: ${filename}`)
    );
  }
}

export default DocumentManager;
module.exports = DocumentManager;
