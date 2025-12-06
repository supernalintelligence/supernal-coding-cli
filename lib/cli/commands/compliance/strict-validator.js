#!/usr/bin/env node

/**
 * Strict Template Validation
 * Marks templates as INVALID if they remain generic/incomplete
 *
 * A template is considered INVALID if:
 * - It contains too many generic template indicators
 * - It lacks specific technical content
 * - It has placeholder cross-references (comp-XXX-XXX)
 * - It has unchecked status items only
 */

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

/**
 * Strict validation criteria
 * Templates must have SPECIFIC content, not just structure
 */
class StrictTemplateValidator {
  constructor() {
    // Generic phrases that indicate incomplete templates
    this.genericIndicators = [
      'Define specific technical and organizational measures',
      'Document procedures and work instructions',
      'Implement technical controls where applicable',
      'Train personnel on procedures',
      'Monitor control effectiveness',
      'Review and update regularly',
      'Related controls will be identified during implementation',
      'comp-soc-XXX: Related SOC2 controls',
      'comp-gdpr-XXX: Related GDPR requirements',
      'comp-iso27001-XXX:',
      'comp-iso27701-XXX:',
      'comp-hipaa-XXX:',
    ];

    // Must have SOME specific content (not just structure)
    this.specificContentRequired = [
      // Technical specifications
      /AES-\d+|RSA-\d+|TLS \d\.\d|SHA-\d+/i, // Crypto specs
      /AWS|Azure|GCP|Splunk|ELK|Datadog/i, // Specific tooling
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
      /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i, // Real URLs

      // Implementation details
      /npm install|pip install|docker run/i, // Commands
      /import |require\(|from .* import/i, // Code imports
      /const |let |var |function |class /i, // Code

      // Specific procedures
      /step \d+:|procedure:|workflow:/i,
      /\d+\. [A-Z].*\n.*\d+\. [A-Z]/s, // Numbered lists with content
    ];
  }

  /**
   * Validate a single template with strict criteria
   */
  async validateTemplate(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath);

      // Extract metadata
      const idMatch = content.match(/^id:\s*(.+)$/m);
      const titleMatch = content.match(/^title:\s*(.+)$/m);
      const id = idMatch ? idMatch[1].trim() : fileName;
      const title = titleMatch ? titleMatch[1].trim() : fileName;

      // Count generic indicators
      let genericCount = 0;
      const foundGenericIndicators = [];

      for (const indicator of this.genericIndicators) {
        if (content.includes(indicator)) {
          genericCount++;
          foundGenericIndicators.push(indicator.substring(0, 60));
        }
      }

      // Check for specific content
      let specificContentCount = 0;
      const foundSpecificContent = [];

      for (const pattern of this.specificContentRequired) {
        const matches = pattern.test(content);
        if (matches) {
          specificContentCount++;
          const match = content.match(pattern);
          if (match) {
            foundSpecificContent.push(match[0].substring(0, 40));
          }
        }
      }

      // Check for placeholder cross-references
      const placeholderXrefs = (content.match(/comp-\w+-XXX/g) || []).length;

      // Check technical context section
      const technicalSection = content.match(
        /## Technical Context\n([\s\S]*?)## Validation Strategy/
      );
      const hasTechnicalContent =
        technicalSection && technicalSection[1].length > 500;

      // Check for code blocks with actual code (not just examples)
      const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
      const hasRealCode = codeBlocks.some((block) => {
        const lines = block.split('\n');
        return lines.length > 10 && !block.includes('// ... more code ...');
      });

      // Determine if template is VALID or INVALID
      const genericScore = (genericCount / this.genericIndicators.length) * 100;
      const specificScore =
        (specificContentCount / this.specificContentRequired.length) * 100;

      let status = 'INVALID';
      let reason = [];

      if (genericScore > 50) {
        reason.push(`High generic content (${Math.round(genericScore)}%)`);
      }

      if (placeholderXrefs > 2) {
        reason.push(`${placeholderXrefs} placeholder cross-references`);
      }

      if (!hasTechnicalContent) {
        reason.push('Insufficient technical context');
      }

      if (specificScore < 10) {
        reason.push(`Low specific content (${Math.round(specificScore)}%)`);
      }

      // Template is VALID if it has:
      // - Low generic indicators (<40%)
      // - Good specific content (>20%)
      // - Few placeholders (<3)
      // - Decent technical content OR real code
      if (
        genericScore < 40 &&
        specificScore > 20 &&
        placeholderXrefs < 3 &&
        (hasTechnicalContent || hasRealCode)
      ) {
        status = 'VALID';
        reason = ['Contains specific implementation details'];
      }

      return {
        filePath,
        fileName,
        id,
        title,
        status,
        reason: reason.join('; '),
        metrics: {
          genericScore: Math.round(genericScore),
          specificScore: Math.round(specificScore),
          placeholderXrefs,
          genericCount,
          specificCount: specificContentCount,
          hasTechnicalContent,
          hasRealCode,
          fileSize: content.length,
        },
        indicators: {
          generic: foundGenericIndicators.slice(0, 3),
          specific: foundSpecificContent.slice(0, 3),
        },
      };
    } catch (error) {
      return {
        filePath,
        status: 'ERROR',
        reason: error.message,
        error: true,
      };
    }
  }

  /**
   * Validate all templates in a framework
   */
  async validateFramework(frameworkPath) {
    const framework = path.basename(frameworkPath);
    const templatesPath = path.join(frameworkPath, 'templates');

    if (!(await fs.pathExists(templatesPath))) {
      return {
        framework,
        error: 'Templates directory not found',
        templates: [],
      };
    }

    const files = await fs.readdir(templatesPath);
    const mdFiles = files.filter(
      (f) => f.endsWith('.md') && f.startsWith('comp-')
    );

    const results = await Promise.all(
      mdFiles.map((file) =>
        this.validateTemplate(path.join(templatesPath, file))
      )
    );

    const stats = {
      total: results.length,
      valid: results.filter((r) => r.status === 'VALID').length,
      invalid: results.filter((r) => r.status === 'INVALID').length,
      errors: results.filter((r) => r.status === 'ERROR').length,
      validRate: 0,
    };

    stats.validRate = Math.round((stats.valid / stats.total) * 100);

    return {
      framework,
      stats,
      templates: results,
    };
  }

  /**
   * Validate all frameworks
   */
  async validateAllFrameworks(
    complianceRoot = 'templates/compliance/frameworks'
  ) {
    const frameworksPath = path.resolve(complianceRoot);

    if (!(await fs.pathExists(frameworksPath))) {
      throw new Error(
        `Compliance frameworks directory not found: ${frameworksPath}`
      );
    }

    const frameworks = await fs.readdir(frameworksPath);
    const frameworkDirs = [];

    for (const fw of frameworks) {
      const fwPath = path.join(frameworksPath, fw);
      const stat = await fs.stat(fwPath);
      if (stat.isDirectory()) {
        frameworkDirs.push(fwPath);
      }
    }

    const results = await Promise.all(
      frameworkDirs.map((dir) => this.validateFramework(dir))
    );

    // Overall statistics
    const overallStats = {
      totalFrameworks: results.length,
      totalTemplates: results.reduce((sum, r) => sum + r.stats.total, 0),
      valid: results.reduce((sum, r) => sum + r.stats.valid, 0),
      invalid: results.reduce((sum, r) => sum + r.stats.invalid, 0),
      errors: results.reduce((sum, r) => sum + r.stats.errors, 0),
      validRate: 0,
    };

    overallStats.validRate = Math.round(
      (overallStats.valid / overallStats.totalTemplates) * 100
    );

    return {
      overall: overallStats,
      frameworks: results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Display validation results
   */
  displayResults(results, options = {}) {
    console.log(chalk.bold('\n🔍 STRICT Template Validation Results\n'));
    console.log(
      chalk.yellow(
        'Templates are marked INVALID if they remain generic/incomplete\n'
      )
    );

    // Overall statistics
    console.log(chalk.bold('Overall Statistics:'));
    console.log(`  Total Templates: ${results.overall.totalTemplates}`);
    console.log(
      `  ${chalk.green('VALID')}: ${results.overall.valid} (${results.overall.validRate}%)`
    );
    console.log(
      `  ${chalk.red('INVALID')}: ${results.overall.invalid} (${100 - results.overall.validRate}%)`
    );
    if (results.overall.errors > 0) {
      console.log(`  ${chalk.gray('ERRORS')}: ${results.overall.errors}`);
    }
    console.log();

    // Framework breakdown
    console.log(chalk.bold('Framework Breakdown:\n'));

    for (const fw of results.frameworks) {
      const statusColor =
        fw.stats.validRate > 50
          ? chalk.green
          : fw.stats.validRate > 20
            ? chalk.yellow
            : chalk.red;

      console.log(`  ${chalk.bold(fw.framework)}: ${fw.stats.total} templates`);
      console.log(`    Valid Rate: ${statusColor(`${fw.stats.validRate}%`)}`);
      console.log(
        `    Valid: ${fw.stats.valid}, Invalid: ${chalk.red(fw.stats.invalid)}, Errors: ${fw.stats.errors}\n`
      );
    }

    // Show invalid templates with reasons
    if (options.showInvalid) {
      console.log(
        chalk.bold.red('\n❌ INVALID Templates (Generic/Incomplete):\n')
      );

      for (const fw of results.frameworks) {
        const invalid = fw.templates.filter((t) => t.status === 'INVALID');
        if (invalid.length > 0) {
          console.log(
            chalk.yellow(`  ${fw.framework} (${invalid.length} invalid):`)
          );
          const limit = options.limit || 10;
          invalid.slice(0, limit).forEach((template) => {
            console.log(`    ${chalk.red('✗')} ${template.id}`);
            console.log(`      ${chalk.gray(template.reason)}`);
            if (options.verbose) {
              console.log(
                `      Generic: ${template.metrics.genericScore}%, Specific: ${template.metrics.specificScore}%`
              );
            }
          });
          if (invalid.length > limit) {
            console.log(
              `    ${chalk.gray(`... and ${invalid.length - limit} more`)}`
            );
          }
          console.log();
        }
      }
    }

    // Summary recommendation
    console.log(chalk.bold('\n📋 Recommendation:\n'));
    if (results.overall.validRate < 10) {
      console.log(chalk.red('  ⚠️  CRITICAL: <10% valid templates'));
      console.log(chalk.yellow('  → Most templates need specific content'));
      console.log(
        chalk.yellow('  → Add technical details, tooling, code examples')
      );
      console.log(chalk.yellow('  → Replace placeholder cross-references\n'));
    } else if (results.overall.validRate < 30) {
      console.log(chalk.yellow('  ⚠️  LOW: <30% valid templates'));
      console.log(chalk.yellow('  → Many templates need enhancement'));
      console.log(chalk.yellow('  → Focus on high-priority controls first\n'));
    } else if (results.overall.validRate < 70) {
      console.log(chalk.blue('  ℹ️  MODERATE: ~50% valid templates'));
      console.log(chalk.blue('  → Continue systematic enhancement'));
      console.log(chalk.blue('  → Good progress\n'));
    } else {
      console.log(chalk.green('  ✅ GOOD: >70% valid templates'));
      console.log(chalk.green('  → Templates have specific content'));
      console.log(chalk.green('  → Ready for deployment\n'));
    }
  }

  /**
   * Generate enhancement report
   */
  async generateEnhancementReport(results, outputPath) {
    const report = {
      summary: results.overall,
      timestamp: results.timestamp,
      invalidTemplates: [],
      enhancementPriorities: [],
    };

    // Collect all invalid templates
    for (const fw of results.frameworks) {
      for (const template of fw.templates) {
        if (template.status === 'INVALID') {
          report.invalidTemplates.push({
            framework: fw.framework,
            id: template.id,
            title: template.title,
            reason: template.reason,
            metrics: template.metrics,
            filePath: template.filePath,
          });
        }
      }
    }

    // Prioritize by framework and generic score
    report.enhancementPriorities = report.invalidTemplates
      .sort((a, b) => b.metrics.genericScore - a.metrics.genericScore)
      .slice(0, 50); // Top 50 most generic

    await fs.writeJson(outputPath, report, { spaces: 2 });
    console.log(chalk.green(`\n✅ Enhancement report saved to ${outputPath}`));

    return report;
  }
}

module.exports = StrictTemplateValidator;

// CLI usage
if (require.main === module) {
  const { program } = require('commander');

  program
    .name('strict-validate')
    .description('Strict validation - mark generic templates as INVALID')
    .option(
      '-p, --path <path>',
      'Path to compliance frameworks',
      'templates/compliance/frameworks'
    )
    .option('-i, --show-invalid', 'Show invalid templates', false)
    .option('-l, --limit <number>', 'Limit invalid templates shown', '20')
    .option('-v, --verbose', 'Verbose output', false)
    .option('-r, --report <file>', 'Generate enhancement report JSON')
    .parse();

  const options = program.opts();

  (async () => {
    try {
      const validator = new StrictTemplateValidator();
      const results = await validator.validateAllFrameworks(options.path);

      validator.displayResults(results, {
        showInvalid: options.showInvalid,
        limit: parseInt(options.limit, 10),
        verbose: options.verbose,
      });

      if (options.report) {
        await validator.generateEnhancementReport(results, options.report);
      }

      // Exit with status code based on valid rate
      process.exit(results.overall.validRate < 10 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  })();
}

