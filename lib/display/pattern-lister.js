/**
 * PatternLister - List and categorize available patterns
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('yaml');

class PatternLister {
  constructor() {
    this.searchPaths = this._getSearchPaths();
  }

  /**
   * List patterns by type
   * @param {string} type - 'workflows', 'phases', 'documents', or 'all'
   * @param {Object} options
   * @param {boolean} options.usage - Include usage examples
   * @returns {Promise<PatternList>}
   */
  async listPatterns(type = 'all', options = {}) {
    const types =
      type === 'all' ? ['workflows', 'phases', 'documents'] : [type];
    const shipped = [];
    const userDefined = [];

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
          const parsed = yaml.parse(content);

          const pattern = {
            name: path.basename(file, path.extname(file)),
            type: patternType,
            path: filePath,
            description: parsed.description || 'No description',
          };

          if (options.usage && parsed.usageExample) {
            pattern.usageExample = parsed.usageExample;
          }

          // Categorize as shipped vs user-defined
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

  /**
   * Get search paths for patterns
   * @private
   */
  _getSearchPaths() {
    return [
      path.join(process.cwd(), '.supernal', 'patterns'), // User patterns
      path.join(__dirname, '..', 'patterns'), // Shipped patterns
    ];
  }
}

module.exports = PatternLister;
