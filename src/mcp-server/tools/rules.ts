/**
 * Rules Manager
 * Handles reading and managing .cursor/rules/*.mdc files
 *
 * TODO: Full implementation pending
 */

import path from 'node:path';
import fs from 'fs-extra';

interface RuleInfo {
  name: string;
  path: string;
}

interface RuleContent {
  name: string;
  content: string;
  path: string;
}

interface ValidationResult {
  success: boolean;
  message: string;
  validated: number;
}

class RulesManager {
  protected projectRoot: string;
  protected rulesDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.rulesDir = path.join(projectRoot, '.cursor', 'rules');
  }

  async list(): Promise<RuleInfo[]> {
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

  async read(ruleName: string): Promise<RuleContent> {
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

  async validate(): Promise<ValidationResult> {
    return {
      success: true,
      message: 'Rules validation not yet fully implemented',
      validated: 0
    };
  }
}

export default RulesManager;
module.exports = RulesManager;
