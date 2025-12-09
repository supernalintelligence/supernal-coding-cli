/**
 * Supernal Code - Main Library Entry Point
 *
 * This module provides programmatic access to supernal-code functionality
 * for use as a library in addition to the CLI interface.
 */

const path = require('node:path');
const fs = require('node:fs');

// Core managers
const RequirementManager = require('./cli/commands/requirement');
const WorkflowManager = require('./cli/commands/kanban/workflow');
const ValidatorManager = require('./cli/commands/validate');
const InitManager = require('./cli/commands/init');

// Version information
const packagePath = path.join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

/**
 * Main Supernal Code class providing programmatic API
 */
class SupernalCode {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.packageRoot = options.packageRoot || path.resolve(__dirname, '..');
    this.version = packageInfo.version;

    // Initialize managers
    this.requirements = new RequirementManager();
    this.workflow = new WorkflowManager();
    this.validator = new ValidatorManager();
    this.init = new InitManager();
  }

  /**
   * Get version information
   */
  getVersion() {
    return {
      version: this.version,
      name: packageInfo.name,
      description: packageInfo.description
    };
  }

  /**
   * Initialize a project with supernal-code
   */
  async initializeProject(options = {}) {
    return this.init.initialize(options);
  }

  /**
   * Validate project health
   */
  async validateProject() {
    return this.validator.validateProject();
  }

  /**
   * Create a new requirement
   */
  async createRequirement(title, options = {}) {
    return this.requirements.createRequirement(title, options);
  }

  /**
   * List requirements
   */
  async listRequirements(filters = {}) {
    return this.requirements.listRequirements(filters);
  }

  /**
   * Get requirement coverage report
   */
  async getCoverageReport() {
    const TestCoverageManager = require('./cli/commands/test-coverage');
    const manager = new TestCoverageManager();
    return manager.generateCoverageReport();
  }

  /**
   * Get project status
   */
  async getProjectStatus() {
    return {
      valid: await this.validator.validateProject(),
      requirements: await this.listRequirements(),
      coverage: await this.getCoverageReport()
    };
  }
}

// Export the main class and individual managers
module.exports = SupernalCode;
module.exports.SupernalCode = SupernalCode;
module.exports.RequirementManager = RequirementManager;
module.exports.WorkflowManager = WorkflowManager;
module.exports.ValidatorManager = ValidatorManager;
module.exports.InitManager = InitManager;
module.exports.version = packageInfo.version;
