import yaml from 'js-yaml';
import fs from 'fs-extra';
import path from 'node:path';
import { YAMLSyntaxError } from './errors';

export interface ConfigLoaderOptions {
  searchPaths?: string[];
  cache?: Map<string, unknown>;
}

/**
 * ConfigLoader - Main entry point for loading and resolving configurations
 *
 * Responsibilities:
 * - Parse YAML files with error context
 * - Orchestrate pattern resolution
 * - Merge resolved configs
 * - Cache results
 */
class ConfigLoader {
  protected cache: Map<string, unknown>;
  protected merger: unknown;
  protected resolver: unknown;
  protected searchPaths: string[];

  constructor(options: ConfigLoaderOptions = {}) {
    this.searchPaths = options.searchPaths || this.getDefaultSearchPaths();
    this.cache = options.cache || new Map();
    this.resolver = null;
    this.merger = null;
  }

  getDefaultSearchPaths(): string[] {
    return [
      path.join(process.cwd(), '.supernal', 'patterns'),
      path.join(__dirname, '..', 'patterns'),
    ];
  }

  async load(configPath: string): Promise<Record<string, unknown>> {
    const userConfig = await this.parseYAML(configPath);

    if (!this.resolver) {
      const PatternResolver = require('./resolver');
      this.resolver = new PatternResolver(this.searchPaths);
    }
    const resolved = await (this.resolver as any).resolve(userConfig);

    if (!this.merger) {
      const ConfigMerger = require('./merger');
      this.merger = new ConfigMerger();
    }
    const merged = (this.merger as any).merge(resolved);

    this.cache.set(configPath, merged);

    return merged;
  }

  async parseYAML(filePath: string): Promise<Record<string, unknown>> {
    const content = await fs.readFile(filePath, 'utf8');
    try {
      return yaml.load(content, { filename: filePath }) as Record<string, unknown>;
    } catch (error) {
      throw new YAMLSyntaxError(error as Error, filePath, content);
    }
  }

  async get(configPath: string): Promise<Record<string, unknown>> {
    if (this.cache.has(configPath)) {
      return this.cache.get(configPath) as Record<string, unknown>;
    }
    return this.load(configPath);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export default ConfigLoader;
module.exports = ConfigLoader;
