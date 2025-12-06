/**
 * Rules Manager
 * Handles reading and managing .cursor/rules/*.mdc files
 *
 * TODO: Full implementation pending
 */

const path = require('node:path');
const fs = require('fs-extra');

class RulesManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.rulesDir = path.join(projectRoot, '.cursor', 'rules');
  }

  /**
   * List all rules
   */
  async list() {
    try {
      if (!(await fs.pathExists(this.rulesDir))) {
        return [];
      }

      const files = await fs.readdir(this.rulesDir);
      return files
        .filter((f) => f.endsWith('.mdc'))
        .map((f) => ({
          name: f.replace('.mdc', ''),
          path: path.join(this.rulesDir, f)
        }));
    } catch (_error) {
      return [];
    }
  }

  /**
   * Read a specific rule
   */
  async read(ruleName) {
    const rulePath = path.join(this.rulesDir, `${ruleName}.mdc`);

    if (!(await fs.pathExists(rulePath))) {
      throw new Error(`Rule not found: ${ruleName}`);
    }

    const content = await fs.readFile(rulePath, 'utf8');
    return {
      name: ruleName,
      content,
      path: rulePath
    };
  }

  /**
   * Validate rules
   */
  async validate() {
    // Stub implementation
    return {
      success: true,
      message: 'Rules validation not yet fully implemented',
      validated: 0
    };
  }
}

module.exports = RulesManager;
