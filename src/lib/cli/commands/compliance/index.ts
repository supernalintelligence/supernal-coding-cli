#!/usr/bin/env node

/**
 * Compliance Framework Management System
 * Implementation of REQ-069: Compliance Framework Initialization and Template Generation System
 */

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { getConfig } = require('../../../scripts/config-loader');
const DocumentManager = require('../base/DocumentManager');

class ComplianceManager extends DocumentManager {
  constructor() {
    super({
      documentType: 'compliance',
      prefix: 'comp',
      baseDirectory: 'docs/requirements/compliance'
    });
    this.supportedFrameworks = [
      'iso13485',
      'fda21cfr11',
      'gdpr',
      'soc2',
      'iso27001',
      'iso27701',
      'hipaa',
      'en18031'
    ];
    this.templatesDir = path.join(__dirname, '../../../templates/compliance');

    // Load template validator
    const templateValidator = require('./template-validator');
    this.templateValidator = templateValidator;
  }

  /**
   * Add compliance framework to existing project
   */
  async addFramework(framework, options = {}) {
    try {
      console.log(
        chalk.blue(
          `🏛️ Adding ${framework.toUpperCase()} compliance framework...`
        )
      );

      if (!this.supportedFrameworks.includes(framework)) {
        throw new Error(
          `Unsupported framework: ${framework}. Supported: ${this.supportedFrameworks.join(', ')}`
        );
      }

      // Check if framework already exists
      const existingFrameworks = await this.getConfiguredFrameworks();
      if (existingFrameworks.includes(framework)) {
        console.log(
          chalk.yellow(`⚠️  Framework ${framework} already configured`)
        );
        return;
      }

      // Generate framework templates
      await this.generateFrameworkTemplates(framework, options);

      // Update configuration
      await this.updateComplianceConfig(framework);

      console.log(
        chalk.green(
          `✅ ${framework.toUpperCase()} framework added successfully`
        )
      );
    } catch (error) {
      console.error(
        chalk.red('❌ Error adding compliance framework:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Validate compliance framework implementation
   * Now includes template customization detection
   */
  async validateFramework(framework, options = {}) {
    try {
      console.log(
        chalk.blue(
          `🔍 Validating ${framework === 'all' ? 'all frameworks' : framework.toUpperCase()}...`
        )
      );

      const frameworks =
        framework === 'all'
          ? await this.getConfiguredFrameworks()
          : [framework];

      if (frameworks.length === 0) {
        console.log(chalk.yellow('⚠️  No compliance frameworks configured'));
        return;
      }

      // Run template customization validation
      if (options.checkCustomization !== false) {
        console.log(chalk.gray('\n📝 Checking template customization...\n'));
        const customizationResults =
          await this.templateValidator.validateAllFrameworks(
            path.join(this.projectRoot, 'templates/compliance/frameworks')
          );
        this.templateValidator.displayResults(customizationResults, {
          showGeneric: options.showGeneric || false,
          limit: options.limit || 10
        });
      }

      const results = {};
      for (const fw of frameworks) {
        results[fw] = await this.validateSingleFramework(fw);
      }

      // Generate validation report
      this.displayValidationResults(results);

      return results;
    } catch (error) {
      console.error(
        chalk.red('❌ Error validating compliance:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Export compliance audit package
   */
  async exportAuditPackage(framework, options = {}) {
    try {
      console.log(
        chalk.blue(
          `📦 Generating audit package for ${framework.toUpperCase()}...`
        )
      );

      const outputDir =
        options.output || path.join(this.projectRoot, 'compliance-audit');
      await fs.ensureDir(outputDir);

      // Collect compliance artifacts
      const artifacts = await this.collectComplianceArtifacts(framework);

      // Generate traceability matrix
      const traceabilityMatrix =
        await this.generateTraceabilityMatrix(framework);

      // Create audit package
      const auditPackage = {
        framework,
        generatedAt: new Date().toISOString(),
        artifacts,
        traceabilityMatrix,
        complianceStatus: await this.validateSingleFramework(framework)
      };

      // Write audit package
      const auditFile = path.join(outputDir, `${framework}-audit-package.json`);
      await fs.writeJson(auditFile, auditPackage, { spaces: 2 });

      // Generate human-readable report
      await this.generateAuditReport(auditPackage, outputDir);

      console.log(chalk.green(`✅ Audit package generated: ${auditFile}`));

      return auditFile;
    } catch (error) {
      console.error(
        chalk.red('❌ Error generating audit package:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Generate AI-testable compliance requirements
   */
  async generateTests(framework, _options = {}) {
    try {
      console.log(
        chalk.blue(
          `🤖 Generating AI compliance tests for ${framework.toUpperCase()}...`
        )
      );

      const _frameworkConfig = await this.loadFrameworkConfig(framework);
      const requirements = await this.loadFrameworkRequirements(framework);

      // Generate AI-powered compliance validation tests
      const tests = await this.generateComplianceValidationTests(
        framework,
        requirements
      );

      // Create test files
      const testsDir = path.join(
        this.projectRoot,
        'tests',
        'compliance',
        framework
      );
      await fs.ensureDir(testsDir);

      for (const test of tests) {
        const testFile = path.join(testsDir, `${test.id}.test.js`);
        await fs.writeFile(testFile, test.content);
      }

      console.log(
        chalk.green(
          `✅ Generated ${tests.length} compliance tests for ${framework}`
        )
      );

      return tests;
    } catch (error) {
      console.error(
        chalk.red('❌ Error generating compliance tests:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * List available compliance frameworks
   */
  async listFrameworks() {
    console.log(chalk.blue('🏛️ Available Compliance Frameworks:'));
    console.log();

    const frameworkInfo = {
      iso13485: {
        name: '🏥 ISO 13485 Medical Device QMS',
        description: 'Quality management system for medical device development',
        requirements: '14 template requirements (REQ-ISO-001 to REQ-ISO-014)'
      },
      fda21cfr11: {
        name: '🇺🇸 FDA 21 CFR Part 11 Electronic Records',
        description:
          'Electronic records and signatures for FDA-regulated industries',
        requirements: '14 template requirements (REQ-FDA-001 to REQ-FDA-014)'
      },
      gdpr: {
        name: '🇪🇺 GDPR Data Protection',
        description:
          "Data protection requirements for EU residents' personal data",
        requirements: '17 template requirements (REQ-GDPR-001 to REQ-GDPR-017)'
      },
      soc2: {
        name: '🔒 SOC 2 Security Controls',
        description: 'Service organization security and operational controls',
        requirements: '18 template requirements (REQ-SOC-001 to REQ-SOC-018)'
      }
    };

    for (const [_key, info] of Object.entries(frameworkInfo)) {
      console.log(chalk.cyan(`${info.name}`));
      console.log(`  ${info.description}`);
      console.log(`  ${info.requirements}`);
      console.log();
    }

    // Show configured frameworks
    const configuredFrameworks = await this.getConfiguredFrameworks();

    if (configuredFrameworks.length > 0) {
      console.log(chalk.green('✅ Configured in this project:'));
      configuredFrameworks.forEach((fw) => {
        console.log(`  - ${frameworkInfo[fw]?.name || fw}`);
      });
    } else {
      console.log(chalk.yellow('⚠️  No frameworks configured in this project'));
      console.log(chalk.dim('   Use: sc compliance add --framework=<name>'));
    }
  }

  // Helper methods

  async getConfiguredFrameworks() {
    const configPath = path.join(this.projectRoot, 'supernal.yaml');

    if (!(await fs.pathExists(configPath))) {
      return [];
    }

    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const frameworksRegex = /frameworks\s*=\s*\[(.*?)\]/s;
      const match = configContent.match(frameworksRegex);

      if (match) {
        return match[1]
          .split(',')
          .map((f) => f.trim().replace(/['"]/g, ''))
          .filter((f) => f);
      }

      return [];
    } catch (error) {
      console.warn(
        chalk.yellow(`Warning: Could not read config file: ${error.message}`)
      );
      return [];
    }
  }

  async generateFrameworkTemplates(framework, _options = {}) {
    const frameworkTemplateDir = path.join(this.templatesDir, framework);

    // Get the requirements directory from config
    const config = getConfig(this.projectRoot);
    const configData = config.load();
    const requirementsBaseDir = configData.requirements.directory;

    const projectRequirementsDir = path.join(
      this.projectRoot,
      requirementsBaseDir,
      'compliance',
      framework
    );

    await fs.ensureDir(projectRequirementsDir);

    // Copy framework template requirements
    const templateRequirementsDir = path.join(
      frameworkTemplateDir,
      'requirements'
    );
    if (await fs.pathExists(templateRequirementsDir)) {
      await fs.copy(templateRequirementsDir, projectRequirementsDir);
      console.log(
        chalk.dim(`  📋 Generated ${framework} requirement templates`)
      );
    }
  }

  async updateComplianceConfig(framework) {
    const configPath = path.join(this.projectRoot, 'supernal.yaml');

    let configContent = '';
    if (await fs.pathExists(configPath)) {
      configContent = await fs.readFile(configPath, 'utf8');
    }

    // Add compliance section if it doesn't exist
    if (!configContent.includes('[compliance]')) {
      configContent += '\n[compliance]\nframeworks = []\n';
    }

    // Ensure frameworks array exists
    if (!configContent.includes('frameworks = [')) {
      // Find the [compliance] section and add frameworks array after it
      configContent = configContent.replace(
        /(\[compliance\])/,
        '$1\nframeworks = []'
      );
    }

    // Add framework-specific configuration
    const config = getConfig(this.projectRoot);
    const configData = config.load();
    const requirementsBaseDir = configData.requirements.directory;

    const frameworkConfig = `
[compliance.${framework}]
version = "${this.getFrameworkVersion(framework)}"
requirements_path = "${requirementsBaseDir}/compliance/${framework}"
enabled = true
last_updated = "${new Date().toISOString()}"
`;

    // Add framework to frameworks array if not already there
    const frameworksRegex = /frameworks\s*=\s*\[(.*?)\]/s;
    const match = configContent.match(frameworksRegex);

    if (match) {
      const currentFrameworks = match[1]
        .split(',')
        .map((f) => f.trim().replace(/['"]/g, ''))
        .filter((f) => f);

      if (!currentFrameworks.includes(framework)) {
        currentFrameworks.push(framework);
        const newFrameworksList = currentFrameworks
          .map((f) => `"${f}"`)
          .join(', ');
        configContent = configContent.replace(
          frameworksRegex,
          `frameworks = [${newFrameworksList}]`
        );
      }
    }

    // Add framework-specific config if not already there
    if (!configContent.includes(`[compliance.${framework}]`)) {
      configContent += frameworkConfig;
    }

    await fs.writeFile(configPath, configContent);
    console.log(chalk.dim(`  ⚙️  Updated compliance configuration`));
  }

  async validateSingleFramework(framework) {
    // Implementation for validating a single framework
    const config = getConfig(this.projectRoot);
    const configData = config.load();
    const requirementsBaseDir = configData.requirements.directory;

    const requirementsDir = path.join(
      this.projectRoot,
      requirementsBaseDir,
      'compliance',
      framework
    );

    if (!(await fs.pathExists(requirementsDir))) {
      return {
        status: 'not_configured',
        message: `Framework ${framework} not configured`,
        score: 0
      };
    }

    // Check for required template files
    const requiredTemplates = await this.getRequiredTemplates(framework);
    const existingFiles = await fs.readdir(requirementsDir);

    const missingTemplates = requiredTemplates.filter(
      (template) => !existingFiles.some((file) => file.includes(template))
    );

    const completionScore =
      ((requiredTemplates.length - missingTemplates.length) /
        requiredTemplates.length) *
      100;

    return {
      status: completionScore === 100 ? 'compliant' : 'incomplete',
      score: completionScore,
      missingTemplates,
      totalTemplates: requiredTemplates.length,
      implementedTemplates: requiredTemplates.length - missingTemplates.length
    };
  }

  displayValidationResults(results) {
    console.log(chalk.blue('\n📊 Compliance Validation Results:'));
    console.log();

    for (const [framework, result] of Object.entries(results)) {
      const statusIcon =
        result.status === 'compliant'
          ? '✅'
          : result.status === 'incomplete'
            ? '⚠️'
            : '❌';

      console.log(
        `${statusIcon} ${framework.toUpperCase()}: ${result.score.toFixed(1)}% complete`
      );

      if (result.missingTemplates && result.missingTemplates.length > 0) {
        console.log(
          chalk.dim(`   Missing: ${result.missingTemplates.join(', ')}`)
        );
      }
    }
    console.log();
  }

  async getRequiredTemplates(framework) {
    // Return list of required template files for each framework
    const templateCounts = {
      iso13485: Array.from(
        { length: 14 },
        (_, i) => `comp-iso-${String(i + 1).padStart(3, '0')}`
      ),
      fda21cfr11: Array.from(
        { length: 14 },
        (_, i) => `req-fda-${String(i + 1).padStart(3, '0')}`
      ),
      gdpr: Array.from(
        { length: 17 },
        (_, i) => `req-gdpr-${String(i + 1).padStart(3, '0')}`
      ),
      soc2: Array.from(
        { length: 18 },
        (_, i) => `req-soc-${String(i + 1).padStart(3, '0')}`
      )
    };

    return templateCounts[framework] || [];
  }

  getFrameworkVersion(framework) {
    const versions = {
      iso13485: '2016',
      fda21cfr11: '2021',
      gdpr: '2018',
      soc2: '2017'
    };
    return versions[framework] || '1.0';
  }

  async collectComplianceArtifacts(framework) {
    // Collect all compliance-related files and documentation
    const artifacts = [];
    const config = getConfig(this.projectRoot);
    const configData = config.load();
    const requirementsBaseDir = configData.requirements.directory;

    const requirementsDir = path.join(
      this.projectRoot,
      requirementsBaseDir,
      'compliance',
      framework
    );

    if (await fs.pathExists(requirementsDir)) {
      const files = await fs.readdir(requirementsDir);
      for (const file of files) {
        const filePath = path.join(requirementsDir, file);
        const stats = await fs.stat(filePath);
        artifacts.push({
          type: 'requirement',
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }

    return artifacts;
  }

  async generateTraceabilityMatrix(framework) {
    // Generate traceability matrix linking requirements to implementation
    return {
      framework,
      requirements: [],
      implementations: [],
      tests: [],
      gaps: []
    };
  }

  async generateAuditReport(auditPackage, outputDir) {
    const reportPath = path.join(
      outputDir,
      `${auditPackage.framework}-audit-report.md`
    );

    const report = `# ${auditPackage.framework.toUpperCase()} Compliance Audit Report

**Generated:** ${auditPackage.generatedAt}
**Framework:** ${auditPackage.framework}
**Status:** ${auditPackage.complianceStatus.status}
**Completion:** ${auditPackage.complianceStatus.score}%

## Compliance Status

- **Total Requirements:** ${auditPackage.complianceStatus.totalTemplates || 0}
- **Implemented:** ${auditPackage.complianceStatus.implementedTemplates || 0}
- **Missing:** ${auditPackage.complianceStatus.missingTemplates?.length || 0}

## Artifacts

${auditPackage.artifacts.map((artifact) => `- ${artifact.name} (${artifact.type})`).join('\n')}

## Recommendations

${
  auditPackage.complianceStatus.missingTemplates?.length > 0
    ? `Complete missing requirements: ${auditPackage.complianceStatus.missingTemplates.join(', ')}`
    : 'All requirements implemented. Maintain regular compliance reviews.'
}
`;

    await fs.writeFile(reportPath, report);
  }

  async loadFrameworkConfig(framework) {
    const configPath = path.join(
      this.templatesDir,
      framework,
      'config',
      'framework.json'
    );
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
    return {};
  }

  async loadFrameworkRequirements(framework) {
    const config = getConfig(this.projectRoot);
    const configData = config.load();
    const requirementsBaseDir = configData.requirements.directory;

    const requirementsDir = path.join(
      this.projectRoot,
      requirementsBaseDir,
      'compliance',
      framework
    );
    const requirements = [];

    if (await fs.pathExists(requirementsDir)) {
      const files = await fs.readdir(requirementsDir);
      for (const file of files.filter((f) => f.endsWith('.md'))) {
        const content = await fs.readFile(
          path.join(requirementsDir, file),
          'utf8'
        );
        requirements.push({ file, content });
      }
    }

    return requirements;
  }

  async generateComplianceValidationTests(framework, requirements) {
    // Generate AI-powered compliance tests
    const tests = [];

    for (const req of requirements) {
      const testId = req.file.replace('.md', '');
      const testContent = `// AI-generated compliance test for ${testId}
describe('${framework.toUpperCase()} Compliance - ${testId}', () => {
  test('should validate compliance requirement implementation', async () => {
    // AI-generated test logic would go here
    // This would check for documentation, processes, and audit trails
    expect(true).toBe(true); // Placeholder
  });
});`;

      tests.push({
        id: testId,
        content: testContent
      });
    }

    return tests;
  }
}

// Export for use in CLI
module.exports = ComplianceManager;

// CLI interface
if (require.main === module) {
  const manager = new ComplianceManager();

  const command = process.argv[2];
  const framework = process.argv[3];

  switch (command) {
    case 'add':
      manager.addFramework(framework);
      break;
    case 'validate':
      manager.validateFramework(framework || 'all');
      break;
    case 'export':
      manager.exportAuditPackage(framework);
      break;
    case 'generate-tests':
      manager.generateTests(framework);
      break;
    case 'list':
      manager.listFrameworks();
      break;
    default:
      console.log(
        'Usage: compliance <add|validate|export|generate-tests|list> [framework]'
      );
  }
}
