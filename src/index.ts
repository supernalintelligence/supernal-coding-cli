/**
 * Supernal Code - Main Library Entry Point
 *
 * This module provides programmatic access to supernal-code functionality
 * for use as a library in addition to the CLI interface.
 */

import path from 'node:path';
import fs from 'node:fs';

const RequirementManager = require('./cli/commands/requirement');
const WorkflowManager = require('./cli/commands/kanban/workflow');
const ValidatorManager = require('./cli/commands/validate');
const InitManager = require('./cli/commands/init');

const packagePath = path.join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

interface SupernalCodeOptions {
  projectRoot?: string;
  packageRoot?: string;
}

interface RequirementFilters {
  status?: string;
  epic?: string;
  priority?: string;
}

interface RequirementOptions {
  epic?: string;
  priority?: string;
  category?: string;
}

interface InitOptions {
  force?: boolean;
}

/**
 * Main Supernal Code class providing programmatic API
 */
class SupernalCode {
  public projectRoot: string;
  public packageRoot: string;
  public version: string;
  public requirements: typeof RequirementManager;
  public workflow: typeof WorkflowManager;
  public validator: typeof ValidatorManager;
  public init: typeof InitManager;

  constructor(options: SupernalCodeOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.packageRoot = options.packageRoot || path.resolve(__dirname, '..');
    this.version = packageInfo.version;

    this.requirements = new RequirementManager();
    this.workflow = new WorkflowManager();
    this.validator = new ValidatorManager();
    this.init = new InitManager();
  }

  getVersion(): { version: string; name: string; description: string } {
    return {
      version: this.version,
      name: packageInfo.name,
      description: packageInfo.description
    };
  }

  async initializeProject(options: InitOptions = {}): Promise<unknown> {
    return this.init.initialize(options);
  }

  async validateProject(): Promise<unknown> {
    return this.validator.validateProject();
  }

  async createRequirement(title: string, options: RequirementOptions = {}): Promise<unknown> {
    return this.requirements.createRequirement(title, options);
  }

  async listRequirements(filters: RequirementFilters = {}): Promise<unknown> {
    return this.requirements.listRequirements(filters);
  }

  async getCoverageReport(): Promise<unknown> {
    const TestCoverageManager = require('./cli/commands/test-coverage');
    const manager = new TestCoverageManager();
    return manager.generateCoverageReport();
  }

  async getProjectStatus(): Promise<{ valid: unknown; requirements: unknown; coverage: unknown }> {
    return {
      valid: await this.validator.validateProject(),
      requirements: await this.listRequirements(),
      coverage: await this.getCoverageReport()
    };
  }
}

export default SupernalCode;
export { SupernalCode, RequirementManager, WorkflowManager, ValidatorManager, InitManager };

module.exports = SupernalCode;
module.exports.SupernalCode = SupernalCode;
module.exports.RequirementManager = RequirementManager;
module.exports.WorkflowManager = WorkflowManager;
module.exports.ValidatorManager = ValidatorManager;
module.exports.InitManager = InitManager;
module.exports.version = packageInfo.version;
