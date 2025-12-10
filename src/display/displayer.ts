/**
 * ConfigDisplayer - Main orchestrator for display/debug commands
 * Part of REQ-REN-004: Config Display & Debug Commands
 */

import fs from 'fs-extra';
import nodePath from 'node:path';
import yaml from 'yaml';
const ConfigLoader = require('../config/loader');
const ConfigValidator = require('../validation/config-validator');
const ConfigTracer = require('./tracer');
const PatternLister = require('./pattern-lister');
const ConfigPrinter = require('./printer');
const FormatHelper = require('./format-helper');

interface ShowOptions {
  configPath?: string;
  format?: 'yaml' | 'json';
  section?: string | null;
  color?: boolean;
  output?: string | null;
}

interface TraceOptions {
  configPath?: string;
}

interface ValidateOptions {
  configPath?: string;
  schema?: string | null;
}

interface ListPatternsOptions {
  usage?: boolean;
}

interface InspectPatternOptions {
  resolve?: boolean;
  format?: 'yaml' | 'json';
}

interface Pattern {
  name: string;
  path: string;
}

interface PatternList {
  shipped: Pattern[];
  userDefined: Pattern[];
}

class ConfigDisplayer {
  protected validator: typeof ConfigValidator;

  constructor() {
    this.validator = new ConfigValidator();
  }

  async show(options: ShowOptions = {}): Promise<string> {
    const {
      configPath = nodePath.join(process.cwd(), '.supernal', 'project.yaml'),
      format = 'yaml',
      section = null,
      color = process.stdout.isTTY,
      output = null
    } = options;

    const loader = new ConfigLoader();
    const config = await loader.load(configPath);

    const data = section
      ? FormatHelper.extractSection(config, section)
      : config;

    if (!data) {
      throw new Error(`Section not found: ${section}`);
    }

    const printer = new ConfigPrinter({ color });
    const formatted = printer.print(data, format);

    if (output) {
      await fs.writeFile(output, formatted, 'utf8');
      return `Config written to ${output}`;
    }

    return formatted;
  }

  async trace(path: string, options: TraceOptions = {}): Promise<unknown> {
    const {
      configPath = nodePath.join(process.cwd(), '.supernal', 'project.yaml')
    } = options;

    const loader = new ConfigLoader();
    const config = await loader.load(configPath);

    const tracer = new ConfigTracer();
    const chain = tracer.trace(path, config, loader.mergeHistory || []);

    return chain;
  }

  async validate(options: ValidateOptions = {}): Promise<unknown> {
    const {
      configPath = nodePath.join(process.cwd(), '.supernal', 'project.yaml'),
      schema = null
    } = options;

    const content = await fs.readFile(configPath, 'utf8');
    const configType = schema || this._inferConfigType(configPath);

    const result = this.validator.validate(content, configType);

    return result;
  }

  async listPatterns(type = 'all', options: ListPatternsOptions = {}): Promise<PatternList> {
    const lister = new PatternLister();
    return lister.listPatterns(type, options);
  }

  async inspectPattern(name: string, options: InspectPatternOptions = {}): Promise<string> {
    const { resolve = false, format = 'yaml' } = options;

    const lister = new PatternLister();
    const patterns: PatternList = await lister.listPatterns('all');

    let pattern: Pattern | undefined;
    for (const category of [patterns.shipped, patterns.userDefined]) {
      pattern = category.find((p) => p.name === name);
      if (pattern) break;
    }

    if (!pattern) {
      throw new Error(`Pattern not found: ${name}`);
    }

    let content = await fs.readFile(pattern.path, 'utf8');

    if (resolve) {
      const loader = new ConfigLoader();
      const parsed = yaml.parse(content);
      const resolved = await loader.resolver.resolve(parsed);
      content = yaml.stringify(resolved);
    }

    if (format === 'json') {
      const parsed = yaml.parse(content);
      content = JSON.stringify(parsed, null, 2);
    }

    return content;
  }

  private _inferConfigType(filePath: string): string {
    const basename = nodePath.basename(filePath);
    if (basename === 'project.yaml') return 'project';
    if (basename === 'family.yaml') return 'family';
    if (basename.includes('workflow')) return 'workflow-pattern';
    return 'project';
  }
}

export default ConfigDisplayer;
module.exports = ConfigDisplayer;
