/**
 * ConfigDisplayer - Main orchestrator for display/debug commands
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

const ConfigLoader = require('../config/loader');
const ConfigValidator = require('../validation/config-validator');
const ConfigTracer = require('./tracer');
const PatternLister = require('./pattern-lister');
const ConfigPrinter = require('./printer');
const FormatHelper = require('./format-helper');
const fs = require('fs-extra');
const path = require('node:path');

class ConfigDisplayer {
  constructor() {
    this.validator = new ConfigValidator();
  }

  /**
   * Display resolved configuration
   * @param {Object} options
   * @param {string} options.configPath - Path to project.yaml
   * @param {string} options.format - 'yaml' or 'json'
   * @param {string} options.section - Optional dot-path to section
   * @param {boolean} options.color - Colorize output (default: auto-detect TTY)
   * @param {string} options.output - Write to file instead of stdout
   * @returns {Promise<string>} Formatted config
   */
  async show(options = {}) {
    const {
      configPath = path.join(process.cwd(), '.supernal', 'project.yaml'),
      format = 'yaml',
      section = null,
      color = process.stdout.isTTY,
      output = null
    } = options;

    // Load and resolve config
    const loader = new ConfigLoader();
    const config = await loader.load(configPath);

    // Extract section if specified
    const data = section
      ? FormatHelper.extractSection(config, section)
      : config;

    if (!data) {
      throw new Error(`Section not found: ${section}`);
    }

    // Format output
    const printer = new ConfigPrinter({ color });
    const formatted = printer.print(data, format);

    // Write to file or stdout
    if (output) {
      await fs.writeFile(output, formatted, 'utf8');
      return `Config written to ${output}`;
    }

    return formatted;
  }

  /**
   * Trace value resolution chain
   * @param {string} path - Dot-notation path (e.g., 'workflow.startPhase')
   * @param {Object} options
   * @param {string} options.configPath - Path to project.yaml
   * @returns {Promise<ResolutionChain>}
   */
  async trace(path, options = {}) {
    const {
      configPath = path.join(process.cwd(), '.supernal', 'project.yaml')
    } = options;

    const loader = new ConfigLoader();
    const config = await loader.load(configPath);

    // ConfigTracer needs access to merge history, which we'll add to loader
    const tracer = new ConfigTracer();
    const chain = tracer.trace(path, config, loader.mergeHistory || []);

    return chain;
  }

  /**
   * Validate configuration
   * @param {Object} options
   * @param {string} options.configPath - Path to project.yaml
   * @param {string} options.schema - Optional specific schema to validate
   * @returns {Promise<ValidationResult>}
   */
  async validate(options = {}) {
    const {
      configPath = path.join(process.cwd(), '.supernal', 'project.yaml'),
      schema = null
    } = options;

    const content = await fs.readFile(configPath, 'utf8');
    const configType = schema || this._inferConfigType(configPath);

    const result = this.validator.validate(content, configType);

    return result;
  }

  /**
   * List available patterns
   * @param {string} type - 'workflows', 'phases', 'documents', or 'all'
   * @param {Object} options
   * @param {boolean} options.usage - Include usage examples
   * @returns {Promise<PatternList>}
   */
  async listPatterns(type = 'all', options = {}) {
    const lister = new PatternLister();
    return lister.listPatterns(type, options);
  }

  /**
   * Inspect pattern contents
   * @param {string} name - Pattern name (e.g., 'agile-4')
   * @param {Object} options
   * @param {boolean} options.resolve - Resolve defaults
   * @param {string} options.format - 'yaml' or 'json'
   * @returns {Promise<string>} Pattern contents
   */
  async inspectPattern(name, options = {}) {
    const { resolve = false, format = 'yaml' } = options;

    const lister = new PatternLister();
    const patterns = await lister.listPatterns('all');

    // Find pattern
    let pattern = null;
    for (const category of [patterns.shipped, patterns.userDefined]) {
      pattern = category.find((p) => p.name === name);
      if (pattern) break;
    }

    if (!pattern) {
      throw new Error(`Pattern not found: ${name}`);
    }

    // Read pattern file
    let content = await fs.readFile(pattern.path, 'utf8');

    // Resolve if requested
    if (resolve) {
      const loader = new ConfigLoader();
      const yaml = require('yaml');
      const parsed = yaml.parse(content);
      const resolved = await loader.resolver.resolve(parsed);
      content = yaml.stringify(resolved);
    }

    // Format output
    if (format === 'json') {
      const yaml = require('yaml');
      const parsed = yaml.parse(content);
      content = JSON.stringify(parsed, null, 2);
    }

    return content;
  }

  /**
   * Infer config type from file path
   * @private
   */
  _inferConfigType(filePath) {
    const basename = path.basename(filePath);
    if (basename === 'project.yaml') return 'project';
    if (basename === 'family.yaml') return 'family';
    if (basename.includes('workflow')) return 'workflow-pattern';
    return 'project';
  }
}

module.exports = ConfigDisplayer;
