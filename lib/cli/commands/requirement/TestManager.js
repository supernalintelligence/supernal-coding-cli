const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const RequirementHelpers = require('./utils/helpers');
const RequirementTemplates = require('./utils/templates');

/**
 * Handles test generation and coverage for requirements
 */
class TestManager {
  constructor(requirementManager) {
    this.requirementManager = requirementManager;
  }

  /**
   * Generate test files from requirement Gherkin scenarios
   */
  async generateTests(reqId) {
    try {
      const reqFile = await this.requirementManager.findRequirementById(reqId);
      if (!reqFile) {
        throw new Error(`Requirement ${reqId} not found`);
      }

      const content = await fs.readFile(reqFile, 'utf8');
      const normalizedIdForTestDir = RequirementHelpers.normalizeReqId(reqId);
      const testDir = path.join(
        this.requirementManager.projectRoot,
        'tests',
        'requirements',
        `req-${normalizedIdForTestDir}`
      );

      // Create test directory
      await fs.ensureDir(testDir);

      // Create test files
      const normalizedId = RequirementHelpers.normalizeReqId(reqId);
      const featureFile = path.join(testDir, `req-${normalizedId}.feature`);
      const stepsFile = path.join(testDir, `req-${normalizedId}.steps.js`);
      const unitTestFile = path.join(
        testDir,
        `req-${normalizedId}.unit.test.js`
      );
      const e2eTestFile = path.join(testDir, `req-${normalizedId}.e2e.test.js`);

      // Extract and create feature file from Gherkin scenarios
      const gherkinMatches = content.match(/```gherkin\n([\s\S]*?)\n```/g);
      if (gherkinMatches && gherkinMatches.length > 0) {
        const gherkinContent = gherkinMatches
          .map((match) =>
            match.replace(/```gherkin\n/, '').replace(/\n```/, '')
          )
          .join('\n\n');

        await fs.writeFile(featureFile, gherkinContent);
      }

      // Create test templates
      await fs.writeFile(
        stepsFile,
        RequirementTemplates.createStepsTemplate(normalizedId)
      );
      await fs.writeFile(
        unitTestFile,
        RequirementTemplates.createUnitTestTemplate(normalizedId)
      );
      await fs.writeFile(
        e2eTestFile,
        RequirementTemplates.createE2ETestTemplate(normalizedId)
      );

      console.log(
        chalk.green(`✅ Test files generated for REQ-${normalizedId}`)
      );
      console.log(chalk.blue(`📁 Test directory: ${testDir}`));
      console.log(chalk.blue(`📝 Files created:`));
      console.log(chalk.blue(`   - req-${normalizedId}.feature`));
      console.log(chalk.blue(`   - req-${normalizedId}.steps.js`));
      console.log(chalk.blue(`   - req-${normalizedId}.unit.test.js`));
      console.log(chalk.blue(`   - req-${normalizedId}.e2e.test.js`));
    } catch (error) {
      console.error(chalk.red(`❌ Error generating tests: ${error.message}`));
      throw error;
    }
  }

  /**
   * Validate test coverage for a specific requirement
   */
  async validateCoverage(reqId) {
    const TestCoverageManager = require('./test-coverage');
    const manager = new TestCoverageManager();

    try {
      const coverage = await manager.analyzeCoverage(reqId);
      manager.displayCoverageResults(coverage);
    } catch (error) {
      console.error(chalk.red('❌ Coverage validation failed:', error.message));
      process.exit(1);
    }
  }

  /**
   * Generate comprehensive coverage report for all requirements
   */
  async generateCoverageReport() {
    const TestCoverageManager = require('./test-coverage');
    const manager = new TestCoverageManager();

    try {
      const report = await manager.generateCoverageReport();
      manager.displayCoverageReport(report);
    } catch (error) {
      console.error(
        chalk.red('❌ Coverage report generation failed:', error.message)
      );
      process.exit(1);
    }
  }
}

module.exports = TestManager;
