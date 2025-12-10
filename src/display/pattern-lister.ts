/**
 * PatternLister - List and categorize available patterns
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'yaml';

interface Pattern {
  name: string;
  type: string;
  path: string;
  description: string;
  usageExample?: string;
}

interface PatternList {
  shipped: Pattern[];
  userDefined: Pattern[];
}

interface ListOptions {
  usage?: boolean;
}

class PatternLister {
  protected searchPaths: string[];

  constructor() {
    this.searchPaths = this._getSearchPaths();
  }

  async listPatterns(type: string = 'all', options: ListOptions = {}): Promise<PatternList> {
    const types =
      type === 'all' ? ['workflows', 'phases', 'documents'] : [type];
    const shipped: Pattern[] = [];
    const userDefined: Pattern[] = [];

    for (const patternType of types) {
      for (const searchPath of this.searchPaths) {
        const patternDir = path.join(searchPath, patternType);
        if (!fs.existsSync(patternDir)) continue;

        const files = await fs.readdir(patternDir);
        const yamlFiles = files.filter(
          (f) => f.endsWith('.yaml') || f.endsWith('.yml')
        );

        for (const file of yamlFiles) {
          const filePath = path.join(patternDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const parsed = yaml.parse(content) as Record<string, unknown>;

          const pattern: Pattern = {
            name: path.basename(file, path.extname(file)),
            type: patternType,
            path: filePath,
            description: (parsed.description as string) || 'No description',
          };

          if (options.usage && parsed.usageExample) {
            pattern.usageExample = parsed.usageExample as string;
          }

          if (searchPath.includes('lib/patterns')) {
            shipped.push(pattern);
          } else {
            userDefined.push(pattern);
          }
        }
      }
    }

    return { shipped, userDefined };
  }

  private _getSearchPaths(): string[] {
    return [
      path.join(process.cwd(), '.supernal', 'patterns'),
      path.join(__dirname, '..', 'patterns'),
    ];
  }
}

export default PatternLister;
module.exports = PatternLister;
