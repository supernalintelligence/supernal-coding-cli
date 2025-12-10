#!/usr/bin/env node
// @ts-nocheck

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { findGitRoot } = require('../../utils/git-utils');
const { getConfig } = require('../../../scripts/config-loader');

/**
 * Multi-Repository Rule Discovery System
 * REQ-047: Multi-Repository Rule Discovery and Sharing System
 *
 * Discovers, catalogs, and reports existing rules across different types:
 * - Cursor rules (.cursor/rules/)
 * - Workflow rules (workflow-rules/, supernal-coding/workflow-rules/)
 * - Git rules (.git/hooks/, scripts/)
 * - Configuration rules (config files)
 * - Custom project rules
 */

class RuleDiscovery {
  config: any;
  discoveredRules: any;
  gitRoot: any;
  projectRoot: any;
  verbose: any;
  verboseLogFile: any;
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.gitRoot = findGitRoot(this.projectRoot);
    this.verbose = options.verbose || false;
    this.config = null;
    this.discoveredRules = [];
    this.verboseLogFile = this.verbose ? [] : null;
  }

  /**
   * Load configuration with fallback handling
   */
  async loadConfig() {
    try {
      this.config = getConfig(this.gitRoot || this.projectRoot);
      this.config.load();
    } catch (_error) {
      if (this.verbose) {
        console.log(
          chalk.yellow(
            '⚠️  No config found, using default rule discovery paths'
          )
        );
      }
      this.config = {
        rules: {
          scan_paths: [
            '.cursor/rules/',
            'workflow-rules/',
            'supernal-coding/workflow-rules/',
            '.git/hooks/',
            'scripts/',
            '.',
          ],
          rule_types: ['cursor', 'workflow', 'git', 'config', 'custom'],
        },
      };
    }
  }

  /**
   * Discover all rule files in the repository
   */
  async discoverRules() {
    await this.loadConfig();

    const ruleCategories = {
      cursor: [],
      workflow: [],
      git: [],
      config: [],
      custom: [],
    };

    const scanPaths = this.config.rules?.scan_paths || [
      '.cursor/rules/',
      'workflow-rules/',
      'supernal-coding/workflow-rules/',
      '.git/hooks/',
      'scripts/',
      '.',
    ];

    for (const scanPath of scanPaths) {
      const fullPath = path.resolve(this.gitRoot || this.projectRoot, scanPath);

      if (await fs.pathExists(fullPath)) {
        const rules = await this.scanDirectory(fullPath, scanPath);
        this.categorizeRules(rules, ruleCategories);
      }
    }

    this.discoveredRules = ruleCategories;
    return ruleCategories;
  }

  /**
   * Scan a directory for rule files
   */
  async scanDirectory(dirPath, relativePath) {
    const rules = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // Recursively scan subdirectories
          const subRules = await this.scanDirectory(
            path.join(dirPath, entry.name),
            path.join(relativePath, entry.name)
          );
          rules.push(...subRules);
        } else if (entry.isFile()) {
          const rule = await this.analyzeRuleFile(
            dirPath,
            entry.name,
            relativePath
          );
          if (rule) {
            rules.push(rule);
          }
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.log(
          chalk.yellow(`⚠️  Could not scan ${dirPath}: ${error.message}`)
        );
      }
    }

    return rules;
  }

  /**
   * Analyze a file to determine if it's a rule and extract metadata
   */
  async analyzeRuleFile(dirPath, fileName, relativePath) {
    const filePath = path.join(dirPath, fileName);
    const relativeFilePath = path.join(relativePath, fileName);

    // Skip common non-rule files
    if (this.shouldSkipFile(fileName)) {
      return null;
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);

      const rule = {
        name: fileName,
        path: relativeFilePath,
        fullPath: filePath,
        type: this.determineRuleType(relativePath, fileName, content),
        size: stats.size,
        modified: stats.mtime,
        description: this.extractDescription(content),
        version: this.extractVersion(content),
        tags: this.extractTags(content),
        dependencies: this.extractDependencies(content),
        effectiveness: this.calculateEffectiveness(content),
      };

      return rule;
    } catch (error) {
      // Log errors to verbose log file instead of console
      if (this.verbose && this.verboseLogFile) {
        this.verboseLogFile.push(
          `⚠️  Could not analyze ${filePath}: ${error.message}`
        );
      }
      return null;
    }
  }

  /**
   * Determine if a file should be skipped
   */
  shouldSkipFile(fileName) {
    const skipPatterns = [
      /^\./, // Hidden files
      /README/i,
      /CHANGELOG/i,
      /LICENSE/i,
      /package(-lock)?\.json$/,
      /node_modules/,
      /\.git$/,
      /\.log$/,
      /\.tmp$/,
      /\.cache$/,
      /dist\//,
      /build\//,
      /coverage\//,
    ];

    return skipPatterns.some((pattern) => pattern.test(fileName));
  }

  /**
   * Determine the type of rule based on location and content
   */
  determineRuleType(relativePath, fileName, content) {
    if (relativePath.includes('.cursor/rules')) return 'cursor';
    if (relativePath.includes('workflow-rules')) return 'workflow';
    if (relativePath.includes('.git/hooks') || fileName.includes('hook'))
      return 'git';
    if (
      fileName.endsWith('.yaml') ||
      fileName.endsWith('.yml') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.yml')
    )
      return 'config';
    if (content.includes('## Rules') || content.includes('### Rule'))
      return 'workflow';
    if (content.includes('cursor') || content.includes('Cursor'))
      return 'cursor';
    return 'custom';
  }

  /**
   * Extract description from rule content
   */
  extractDescription(content) {
    // Look for description patterns
    const patterns = [
      /description:\s*(.+)/i,
      /# (.+)/,
      /\/\*\*([\s\S]*?)\*\//,
      /^\s*(.+)/m,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 200); // Limit length
      }
    }

    return 'No description available';
  }

  /**
   * Extract version information
   */
  extractVersion(content) {
    const versionPattern = /version:\s*([^\n]+)/i;
    const match = content.match(versionPattern);
    return match ? match[1].trim() : '1.0.0';
  }

  /**
   * Extract tags from rule content
   */
  extractTags(content) {
    const tagPatterns = [/tags:\s*\[(.*?)\]/, /#(\w+)/g];

    const tags = [];
    for (const pattern of tagPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          tags.push(
            ...match[1].split(',').map((t) => t.trim().replace(/"/g, ''))
          );
        }
      }
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Extract dependencies from rule content
   */
  extractDependencies(content) {
    const depPattern = /dependencies:\s*\[(.*?)\]/;
    const match = content.match(depPattern);

    if (match) {
      return match[1].split(',').map((dep) => dep.trim().replace(/"/g, ''));
    }

    return [];
  }

  /**
   * Calculate rule effectiveness score (placeholder)
   */
  calculateEffectiveness(content) {
    // Simple heuristic based on content quality
    let score = 0;

    if (content.includes('description')) score += 20;
    if (content.includes('example') || content.includes('Example')) score += 15;
    if (content.includes('DO') && content.includes("DON'T")) score += 25;
    if (content.length > 500) score += 20;
    if (content.includes('version')) score += 10;
    if (content.includes('test') || content.includes('Test')) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Categorize discovered rules
   */
  categorizeRules(rules, categories) {
    for (const rule of rules) {
      if (categories[rule.type]) {
        categories[rule.type].push(rule);
      } else {
        categories.custom.push(rule);
      }
    }
  }

  /**
   * Generate discovery report
   */
  generateReport() {
    const report = {
      repository: {
        path: this.gitRoot || this.projectRoot,
        hasGit: !!this.gitRoot,
        timestamp: new Date().toISOString(),
      },
      summary: {
        totalRules: 0,
        categories: {},
        effectiveness: {
          high: 0, // 80-100
          medium: 0, // 50-79
          low: 0, // 0-49
        },
      },
      rules: this.discoveredRules,
      recommendations: [],
      verboseLog: this.verboseLogFile || [],
    };

    // Calculate summary statistics
    for (const [category, rules] of Object.entries(this.discoveredRules)) {
      report.summary.categories[category] = rules.length;
      report.summary.totalRules += rules.length;

      // Calculate effectiveness distribution
      for (const rule of rules) {
        if (rule.effectiveness >= 80) report.summary.effectiveness.high++;
        else if (rule.effectiveness >= 50)
          report.summary.effectiveness.medium++;
        else report.summary.effectiveness.low++;
      }
    }

    // Generate recommendations
    this.generateRecommendations(report);

    return report;
  }

  /**
   * Generate recommendations based on discovered rules
   */
  generateRecommendations(report) {
    const recommendations = [];

    // Check for missing rule categories
    if (report.summary.categories.cursor === 0) {
      recommendations.push({
        type: 'missing_category',
        priority: 'medium',
        message:
          'No Cursor rules found. Consider adding .cursor/rules/ for IDE integration.',
        action: 'sc init --cursor-rules',
      });
    }

    if (report.summary.categories.workflow === 0) {
      recommendations.push({
        type: 'missing_category',
        priority: 'high',
        message:
          'No workflow rules found. Consider adding workflow automation rules.',
        action: 'sc workflow init',
      });
    }

    // Check rule effectiveness
    const lowEffectiveness = report.summary.effectiveness.low;
    const totalRules = report.summary.totalRules;

    if (lowEffectiveness > totalRules * 0.3) {
      recommendations.push({
        type: 'effectiveness',
        priority: 'medium',
        message: `${lowEffectiveness} rules have low effectiveness scores. Consider improving documentation.`,
        action: 'Review and enhance rule descriptions and examples',
      });
    }

    // Check for outdated rules
    const now = Date.now();
    const oldRules = Object.values(report.rules)
      .flat()
      .filter((rule) => {
        return (
          now - new Date(rule.modified).getTime() > 365 * 24 * 60 * 60 * 1000
        ); // 1 year
      });

    if (oldRules.length > 0) {
      recommendations.push({
        type: 'maintenance',
        priority: 'low',
        message: `${oldRules.length} rules haven't been updated in over a year.`,
        action: 'Review and update outdated rules',
      });
    }

    report.recommendations = recommendations;
  }

  /**
   * Format report for display
   */
  formatReport(report, format = 'console') {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    let output = '';

    output += chalk.blue('🔍 Rule Discovery Report\n');
    output += `${chalk.blue('='.repeat(50))}\n\n`;

    output += chalk.green('📊 Summary:\n');
    output += `  Repository: ${report.repository.path}\n`;
    output += `  Total Rules: ${report.summary.totalRules}\n`;
    output += `  Git Repository: ${report.repository.hasGit ? '✅' : '❌'}\n\n`;

    output += chalk.yellow('📂 Rule Categories:\n');
    for (const [category, count] of Object.entries(report.summary.categories)) {
      if (count > 0) {
        output += `  ${category}: ${count} rules\n`;
      }
    }
    output += '\n';

    output += chalk.cyan('📈 Effectiveness Distribution:\n');
    output += `  High (80-100): ${report.summary.effectiveness.high} rules\n`;
    output += `  Medium (50-79): ${report.summary.effectiveness.medium} rules\n`;
    output += `  Low (0-49): ${report.summary.effectiveness.low} rules\n\n`;

    if (report.recommendations.length > 0) {
      output += chalk.magenta('💡 Recommendations:\n');
      report.recommendations.forEach((rec, _index) => {
        const priority =
          rec.priority === 'high'
            ? '🔴'
            : rec.priority === 'medium'
              ? '🟡'
              : '🟢';
        output += `  ${priority} ${rec.message}\n`;
        if (rec.action) {
          output += chalk.gray(`     Action: ${rec.action}\n`);
        }
      });
    }

    return output;
  }

  /**
   * Export rules for sharing (placeholder for multi-repo system)
   */
  async exportForSharing(outputPath) {
    const report = this.generateReport();

    const exportData = {
      source: {
        repository: path.basename(this.gitRoot || this.projectRoot),
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
      rules: this.discoveredRules,
      metadata: {
        totalRules: report.summary.totalRules,
        categories: report.summary.categories,
        effectiveness: report.summary.effectiveness,
      },
    };

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
    console.log(chalk.green(`✅ Rules exported to: ${outputPath}`));

    return exportData;
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'discover';

  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    format: args.includes('--json') ? 'json' : 'console',
    output: args.find((arg) => arg.startsWith('--output='))?.split('=')[1],
  };

  const discovery = new RuleDiscovery(options);

  try {
    switch (action) {
      case 'discover':
      case 'scan': {
        console.log(chalk.blue('🔍 Discovering rules in repository...'));
        await discovery.discoverRules();
        const report = discovery.generateReport();

        if (options.output) {
          await fs.writeFile(
            options.output,
            discovery.formatReport(report, 'json')
          );
          console.log(chalk.green(`✅ Report saved to: ${options.output}`));
        } else {
          console.log(discovery.formatReport(report, options.format));
        }
        break;
      }

      case 'export': {
        const exportPath = options.output || './rules-export.json';
        await discovery.discoverRules();
        await discovery.exportForSharing(exportPath);
        break;
      }

      case 'help':
        console.log(`
${chalk.blue('Rule Discovery System')}

Usage: node rule-discovery.js [action] [options]

Actions:
  discover, scan    Discover and report rules (default)
  export           Export rules for sharing
  help             Show this help

Options:
  --verbose, -v    Show detailed information
  --json           Output in JSON format
  --output=<file>  Save report to file

Examples:
  node rule-discovery.js discover --verbose
  node rule-discovery.js export --output=./my-rules.json
  node rule-discovery.js scan --json --output=./report.json
        `);
        break;

      default:
        console.error(chalk.red(`❌ Unknown action: ${action}`));
        console.log('Use "help" to see available actions');
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`❌ Error: ${error.message}`));
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Rule-to-Phase Mapping for Workflow Integration
 * Maps cursor rules to the 12-phase development workflow
 */
const RULE_PHASE_MAP = {
  // Phase 1-3: Discovery/Research/Design (always active)
  'all-phases': [
    'agent-on-board.mdc',
    'agent-hand-off.mdc',
    'autonomy-policy.mdc',
    'be-succinct.mdc',
    'dont-bs.mdc',
    'dont-yes-everything.mdc',
    'dont-be-over-confident.mdc',
    'dont-be-repetitious.mdc',
    'dont-waste-space.mdc',
    'do-dont-say.mdc',
    'do-not-echo.mdc',
    'intelligent-triage.md',
    'self_improve.mdc',
    'single-handoff-management.md',
    'stop-if-corruption.mdc',
    'supernal-cli-commands.mdc',
    'cursor_rules.mdc',
  ],

  // Phase 4-5: Planning/Requirements
  'phase-4-planning': [
    'feature-management.mdc',
    'documentation-navigation.mdc',
  ],
  'phase-5-requirements': [
    'add-requirement.mdc',
    'documentation-processor.mdc',
    'requirement-change-reprioritization.md',
    'document-smart.mdc',
  ],

  // Phase 6: Tests
  'phase-6-tests': [
    'dont-cheat-tests.mdc',
    'test-completion-approval.md',
    'do-not-commit-untested-code.mdc',
    'never-complete-until-tested.md',
  ],

  // Phase 7: Build/Implementation
  'phase-7-build': [
    'avoid-anti-patterns.mdc',
    'avoid-experimental-coding.mdc',
    'avoid-magic-strings.mdc',
    'avoid-name-changing.mdc',
    'avoid-type-as-any-forcing.mdc',
    'change-only-what-is-asked.mdc',
    'copy-thoughtfully.mdc',
    'deprecate-safely.mdc',
    'design-guidelines.mdc',
    'do-not-legacy.mdc',
    'do-not-repeat-yourself.mdc',
    'do-undo-if-bad.mdc',
    'follow-through-implementation.mdc',
    'grep-smart.mdc',
    'dont-grep-and-head-or-tail.mdc',
    'import-properly.mdc',
    'name-it-properly-to-begin-with.mdc',
    'no-naked-echo.mdc',
    'never-softlink.mdc',
    'use-tree-not-ls.mdc',
  ],

  // Phase 8: Integration/Git
  'phase-8-integration': [
    'git-smart.mdc',
    'git-commit-smart.mdc',
    'git-merge-strategy.mdc',
    'git-move-if-moving.mdc',
    'never-git-add-all.mdc',
    'do-not-commit-unless-asked.mdc',
    'document-and-commit.mdc',
    'wip-registry.mdc',
    'template-sync-policy.mdc',
  ],
};

/**
 * Generate workflow map for rules
 */
function generateRuleWorkflowMap(format = 'ascii') {
  const phases = [
    { id: 'all-phases', name: 'All Phases', description: 'AI Agent Behavior' },
    { id: 'phase-4-planning', name: 'Phase 4', description: 'Planning' },
    {
      id: 'phase-5-requirements',
      name: 'Phase 5',
      description: 'Requirements',
    },
    { id: 'phase-6-tests', name: 'Phase 6', description: 'Tests' },
    { id: 'phase-7-build', name: 'Phase 7', description: 'Build' },
    { id: 'phase-8-integration', name: 'Phase 8', description: 'Integration' },
  ];

  if (format === 'json') {
    return JSON.stringify({ phases, rulePhaseMap: RULE_PHASE_MAP }, null, 2);
  }

  if (format === 'markdown') {
    let md = '# Cursor Rules Workflow Map\n\n';
    md += 'Maps cursor rules to the 12-phase development workflow.\n\n';

    for (const phase of phases) {
      const rules = RULE_PHASE_MAP[phase.id] || [];
      md += `## ${phase.name}: ${phase.description}\n\n`;
      if (rules.length === 0) {
        md += '_No rules mapped to this phase._\n\n';
      } else {
        md += '| Rule | Description |\n';
        md += '|------|-------------|\n';
        for (const rule of rules) {
          const name = rule.replace('.mdc', '').replace('.md', '');
          md += `| \`${name}\` | See \`.cursor/rules/${rule}\` |\n`;
        }
        md += '\n';
      }
    }
    return md;
  }

  // ASCII format (default)
  let output = chalk.blue('📋 Cursor Rules Workflow Map\n\n');

  for (const phase of phases) {
    const rules = RULE_PHASE_MAP[phase.id] || [];
    output += chalk.cyan(`${phase.name}: ${phase.description}\n`);
    if (rules.length === 0) {
      output += chalk.gray('  (no rules)\n');
    } else {
      for (const rule of rules) {
        output += `  • ${rule.replace('.mdc', '').replace('.md', '')}\n`;
      }
    }
    output += '\n';
  }

  output += chalk.gray(
    `\nTotal: ${Object.values(RULE_PHASE_MAP).flat().length} rules mapped\n`
  );
  return output;
}

/**
 * Handler for sc rules command (called from program.js)
 */
async function handleRulesCommand(action, args, options) {
  const discovery = new RuleDiscovery({
    verbose: options.verbose,
    format: options.json ? 'json' : 'console',
    output: options.output,
  });

  switch (action) {
    case 'list':
    case 'discover':
    case 'scan': {
      console.log(chalk.blue('🔍 Discovering rules in repository...'));
      await discovery.discoverRules();
      const report = discovery.generateReport();

      if (options.output) {
        await fs.writeFile(
          options.output,
          discovery.formatReport(report, 'json')
        );
        console.log(chalk.green(`✅ Report saved to: ${options.output}`));
      } else {
        console.log(
          discovery.formatReport(report, options.json ? 'json' : 'console')
        );
      }
      break;
    }

    case 'workflow-map': {
      const format = options.json
        ? 'json'
        : options.markdown
          ? 'markdown'
          : 'ascii';
      const output = generateRuleWorkflowMap(format);

      if (options.output) {
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`✅ Workflow map saved to: ${options.output}`));
      } else {
        console.log(output);
      }
      break;
    }

    case 'export': {
      const exportPath = options.output || './rules-export.json';
      await discovery.discoverRules();
      await discovery.exportForSharing(exportPath);
      break;
    }

    case 'add': {
      const ruleName = args[0];
      if (!ruleName) {
        throw new Error('Rule name required: sc rules add <name>');
      }
      console.log(
        chalk.yellow(`📝 Rule creation not yet implemented: ${ruleName}`)
      );
      console.log(chalk.gray('  Create manually in .cursor/rules/'));
      break;
    }

    case 'remove': {
      const ruleName = args[0];
      if (!ruleName) {
        throw new Error('Rule name required: sc rules remove <name>');
      }
      console.log(
        chalk.yellow(`🗑️  Rule removal not yet implemented: ${ruleName}`)
      );
      break;
    }
    default:
      console.log(`
${chalk.blue('Rule Management')}

Usage: sc rules <action> [options]

Actions:
  list, discover    Discover and report rules
  workflow-map      Show rules mapped to workflow phases
  export            Export rules for sharing
  add <name>        Add a new rule (coming soon)
  remove <name>     Remove a rule (coming soon)

Options:
  --verbose, -v     Show detailed information
  --json            Output in JSON format
  --markdown        Output in markdown format (workflow-map only)
  --output <file>   Save output to file

Examples:
  sc rules list --verbose
  sc rules workflow-map
  sc rules workflow-map --markdown --output docs/reference/RULE-WORKFLOW-MAP.md
  sc rules export --output ./my-rules.json
      `);
      break;
  }
}

module.exports = {
  RuleDiscovery,
  handleRulesCommand,
  RULE_PHASE_MAP,
  generateRuleWorkflowMap,
};

// Run if called directly
if (require.main === module) {
  main();
}
