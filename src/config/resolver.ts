import yaml from 'js-yaml';
import fs from 'fs-extra';
import path from 'node:path';
import { PatternNotFoundError, CircularDependencyError } from './errors';

export interface ParsedDefault {
  type: string;
  name: string;
}

export interface PatternConfig {
  defaults?: (string | Record<string, string>)[];
  [key: string]: unknown;
}

/**
 * PatternResolver - Resolve pattern references from shipped/user patterns
 *
 * Responsibilities:
 * - Search for patterns in order (user → shipped)
 * - Resolve `defaults` list recursively
 * - Detect circular dependencies
 * - Suggest similar patterns when not found
 */
class PatternResolver {
  protected patterns: Map<string, PatternConfig>;
  protected searchPaths: string[];

  constructor(searchPaths: string[]) {
    this.searchPaths = searchPaths;
    this.patterns = new Map();
  }

  async resolvePattern(patternName: string, patternType = 'workflows'): Promise<PatternConfig> {
    const cacheKey = `${patternType}/${patternName}`;

    if (this.patterns.has(cacheKey)) {
      return this.patterns.get(cacheKey)!;
    }

    for (const searchPath of this.searchPaths) {
      const patternPath = path.join(
        searchPath,
        patternType,
        `${patternName}.yaml`
      );

      if (await fs.pathExists(patternPath)) {
        const pattern = await this.loadPattern(patternPath);
        this.patterns.set(cacheKey, pattern);
        return pattern;
      }
    }

    const availablePatterns = await this.listPatterns(patternType);
    throw new PatternNotFoundError(patternName, patternType, availablePatterns);
  }

  async loadPattern(patternPath: string): Promise<PatternConfig> {
    const content = await fs.readFile(patternPath, 'utf8');
    return yaml.load(content, { filename: patternPath }) as PatternConfig;
  }

  async resolve(userConfig: PatternConfig): Promise<PatternConfig[]> {
    const resolved: PatternConfig[] = [];
    const visited = new Set<string>();

    const defaults = userConfig.defaults || [];
    const selfIndex = defaults.indexOf('_self_');

    for (let i = 0; i < defaults.length; i++) {
      const def = defaults[i];

      if (def === '_self_') {
        resolved.push(userConfig);
        continue;
      }

      const { type, name } = this.parseDefault(def);

      const key = `${type}/${name}`;
      if (visited.has(key)) {
        throw new CircularDependencyError([...visited, key]);
      }
      visited.add(key);

      const pattern = await this.resolvePattern(name, type);

      if (pattern.defaults) {
        const subResolved = await this.resolve(pattern);
        resolved.push(...subResolved);
      } else {
        resolved.push(pattern);
      }
    }

    if (selfIndex === -1) {
      resolved.push(userConfig);
    }

    return resolved;
  }

  parseDefault(def: string | Record<string, string>): ParsedDefault {
    if (typeof def === 'string') {
      return { type: 'workflows', name: def };
    }
    if (typeof def === 'object' && !Array.isArray(def)) {
      const [[type, name]] = Object.entries(def);
      return { type: `${type}s`, name };
    }
    throw new Error(`Invalid default: ${JSON.stringify(def)}`);
  }

  async listPatterns(patternType: string): Promise<string[]> {
    const patterns: string[] = [];

    for (const searchPath of this.searchPaths) {
      const dir = path.join(searchPath, patternType);

      if (await fs.pathExists(dir)) {
        const files = await fs.readdir(dir);
        patterns.push(
          ...files
            .filter((f) => f.endsWith('.yaml'))
            .map((f) => f.replace('.yaml', ''))
        );
      }
    }

    return [...new Set(patterns)];
  }
}

export default PatternResolver;
module.exports = PatternResolver;
