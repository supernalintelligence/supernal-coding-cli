import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';

/**
 * Test Coverage Manager for Requirement-to-Test Traceability
 * Implements REQ-038: Comprehensive Requirement-to-Test Traceability System
 */

interface Criterion {
  id: string;
  text: string;
  testable: boolean;
  hasTest: boolean;
}

interface CoverageAnalysis {
  reqId: string;
  totalCriteria: number;
  testedCriteria: number;
  coveragePercentage: number;
  criteria: Criterion[];
  testDir: string | null;
  testFiles: string[];
}

interface CoverageSummary {
  totalRequirements: number;
  totalCriteria: number;
  totalTestedCriteria: number;
  overallCoverage: number;
  fullyTestedRequirements: number;
}

interface CoverageReport {
  summary: CoverageSummary;
  requirements: CoverageAnalysis[];
  timestamp: string;
}

class TestCoverageManager {
  readonly projectRoot: string;
  readonly requirementsDir: string;
  readonly testsDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.requirementsDir = path.join(
      this.projectRoot,
      'supernal-coding',
      'requirements'
    );
    this.testsDir = path.join(this.projectRoot, 'tests', 'requirements');
  }

  /**
   * Parse acceptance criteria from requirement file
   */
  parseAcceptanceCriteria(requirementContent: string): Criterion[] {
    const criteria: Criterion[] = [];

    // Look for acceptance criteria after Gherkin scenarios
    const sections = requirementContent.split('## ');
    let acceptanceCriteriaSection = '';

    for (const section of sections) {
      if (
        section.toLowerCase().includes('definition of done') ||
        section.toLowerCase().includes('acceptance criteria')
      ) {
        acceptanceCriteriaSection = section;
        break;
      }
    }

    if (!acceptanceCriteriaSection) {
      return criteria;
    }

    // Extract bullet points that look like acceptance criteria
    const lines = acceptanceCriteriaSection.split('\n');
    let criteriaId = 1;

    for (const line of lines) {
      const trimmed = line.trim();

      // Look for bullet points or checkboxes
      if (
        trimmed.match(/^[-*•]\s+/) ||
        trimmed.match(/^-\s*\[\s*[x\s]*\]\s+/)
      ) {
        const text = trimmed
          .replace(/^[-*•]\s+/, '')
          .replace(/^-\s*\[\s*[x\s]*\]\s+/, '')
          .trim();

        if (text && text.length > 10) {
          // Filter out very short items
          criteria.push({
            id: `ac-${criteriaId.toString().padStart(2, '0')}`,
            text: text,
            testable: this.isTestable(text),
            hasTest: false // Will be determined later
          });
          criteriaId++;
        }
      }
    }

    return criteria;
  }

  /**
   * Determine if a criteria is testable
   */
  isTestable(text: string): boolean {
    const testableIndicators = [
      'should',
      'must',
      'will',
      'can',
      'validates',
      'checks',
      'verifies',
      'when',
      'then',
      'given',
      'if',
      'executes',
      'returns',
      'displays',
      'creates',
      'updates',
      'deletes',
      'shows',
      'hides',
      'enables',
      'disables'
    ];

    const lowerText = text.toLowerCase();
    return testableIndicators.some((indicator) =>
      lowerText.includes(indicator)
    );
  }

  /**
   * Analyze test coverage for a specific requirement
   */
  async analyzeCoverage(reqId: string): Promise<CoverageAnalysis> {
    const reqIdPadded = reqId.toString().padStart(3, '0');

    // Find requirement file
    const reqFile = await this.findRequirementFile(reqIdPadded);
    if (!reqFile) {
      throw new Error(`Requirement REQ-${reqIdPadded} not found`);
    }

    // Parse requirement content
    const content = await fs.readFile(reqFile, 'utf8');
    const criteria = this.parseAcceptanceCriteria(content);

    // Check for existing tests
    const testDir = path.join(this.testsDir, `req-${reqIdPadded}`);
    const hasTestDir = await fs.pathExists(testDir);

    let testFiles: string[] = [];
    if (hasTestDir) {
      testFiles = await fs.readdir(testDir);
    }

    // Analyze which criteria have tests
    for (const criterion of criteria) {
      criterion.hasTest = this.checkCriterionHasTest(
        criterion,
        testFiles,
        testDir
      );
    }

    // Calculate coverage
    const totalCriteria = criteria.length;
    const testedCriteria = criteria.filter((c) => c.hasTest).length;
    const coveragePercentage =
      totalCriteria > 0 ? (testedCriteria / totalCriteria) * 100 : 0;

    return {
      reqId: `REQ-${reqIdPadded}`,
      totalCriteria,
      testedCriteria,
      coveragePercentage: Math.round(coveragePercentage * 100) / 100,
      criteria,
      testDir: hasTestDir ? testDir : null,
      testFiles
    };
  }

  /**
   * Check if a specific criterion has a test
   */
  checkCriterionHasTest(
    criterion: Criterion,
    testFiles: string[],
    testDir: string
  ): boolean {
    // Look for test files that might cover this criterion
    const criterionId = criterion.id;
    const keywords = this.extractKeywords(criterion.text);

    // Check for dedicated criterion test file
    if (testFiles.some((file) => file.includes(criterionId))) {
      return true;
    }

    // Check if any test file mentions this criterion (basic content search)
    for (const testFile of testFiles) {
      if (testFile.endsWith('.test.js') || testFile.endsWith('.spec.js')) {
        try {
          const testContent = fs.readFileSync(
            path.join(testDir, testFile),
            'utf8'
          );

          // Look for criterion ID or keywords in test content
          if (
            testContent.includes(criterionId) ||
            keywords.some((keyword) =>
              testContent.toLowerCase().includes(keyword.toLowerCase())
            )
          ) {
            return true;
          }
        } catch (_error) {
          // Ignore file read errors
        }
      }
    }

    return false;
  }

  /**
   * Extract key testable words from criteria text
   */
  extractKeywords(text: string): string[] {
    // Extract meaningful words, excluding common words
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            'should',
            'must',
            'will',
            'when',
            'then',
            'given',
            'that',
            'this',
            'with'
          ].includes(word)
      );

    return words.slice(0, 5); // Take top 5 keywords
  }

  /**
   * Find requirement file by ID
   */
  async findRequirementFile(reqIdPadded: string): Promise<string | null> {
    const categories = [
      'core',
      'infrastructure',
      'workflow',
      'testing',
      'integration'
    ];

    for (const category of categories) {
      const categoryDir = path.join(this.requirementsDir, category);

      if (await fs.pathExists(categoryDir)) {
        const files = await fs.readdir(categoryDir);
        const matchingFile = files.find(
          (file) =>
            file.startsWith(`req-${reqIdPadded}-`) && file.endsWith('.md')
        );
        if (matchingFile) {
          return path.join(categoryDir, matchingFile);
        }
      }
    }

    return null;
  }

  /**
   * Generate comprehensive coverage report
   */
  async generateCoverageReport(): Promise<CoverageReport> {
    console.log(chalk.blue('[i] Analyzing requirement-to-test coverage...'));

    const requirements = await this.findAllRequirements();
    const results: CoverageAnalysis[] = [];

    for (const reqPath of requirements) {
      const reqId = this.extractReqIdFromPath(reqPath);
      if (reqId) {
        try {
          const coverage = await this.analyzeCoverage(reqId);
          results.push(coverage);
        } catch (error) {
          const err = error as Error;
          console.warn(chalk.yellow(`[!] Skipping ${reqId}: ${err.message}`));
        }
      }
    }

    // Calculate overall statistics
    const totalRequirements = results.length;
    const totalCriteria = results.reduce((sum, r) => sum + r.totalCriteria, 0);
    const totalTestedCriteria = results.reduce(
      (sum, r) => sum + r.testedCriteria,
      0
    );
    const overallCoverage =
      totalCriteria > 0 ? (totalTestedCriteria / totalCriteria) * 100 : 0;

    return {
      summary: {
        totalRequirements,
        totalCriteria,
        totalTestedCriteria,
        overallCoverage: Math.round(overallCoverage * 100) / 100,
        fullyTestedRequirements: results.filter(
          (r) => r.coveragePercentage === 100
        ).length
      },
      requirements: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Find all requirement files
   */
  async findAllRequirements(): Promise<string[]> {
    const requirements: string[] = [];
    const categories = ['core', 'infrastructure', 'workflow', 'testing'];

    for (const category of categories) {
      const categoryDir = path.join(this.requirementsDir, category);
      if (await fs.pathExists(categoryDir)) {
        const files = await fs.readdir(categoryDir);
        const reqFiles = files.filter(
          (file) => file.startsWith('req-') && file.endsWith('.md')
        );

        for (const file of reqFiles) {
          requirements.push(path.join(categoryDir, file));
        }
      }
    }

    return requirements;
  }

  /**
   * Extract requirement ID from file path
   */
  extractReqIdFromPath(filePath: string): string | null {
    const filename = path.basename(filePath);
    const match = filename.match(/req-(\d{3})/);
    return match ? match[1] : null;
  }

  /**
   * Display coverage analysis results
   */
  displayCoverageResults(coverage: CoverageAnalysis): void {
    console.log(chalk.blue(`\n[i] Coverage Analysis: ${coverage.reqId}`));
    console.log(chalk.blue('-'.repeat(50)));

    console.log(
      `[i] Overall Coverage: ${this.getColoredPercentage(coverage.coveragePercentage)}%`
    );
    console.log(`[i] Total Criteria: ${coverage.totalCriteria}`);
    console.log(`[OK] Tested Criteria: ${coverage.testedCriteria}`);
    console.log(
      `[X] Untested Criteria: ${coverage.totalCriteria - coverage.testedCriteria}`
    );

    if (coverage.criteria.length > 0) {
      console.log(chalk.blue('\n[i] Acceptance Criteria Details:'));

      coverage.criteria.forEach((criterion, _index) => {
        const status = criterion.hasTest ? chalk.green('[OK]') : chalk.red('[X]');
        const testable = criterion.testable
          ? ''
          : chalk.yellow(' (may not be testable)');
        console.log(
          `  ${status} ${criterion.id}: ${criterion.text.substring(0, 80)}...${testable}`
        );
      });
    }

    if (coverage.testDir) {
      console.log(chalk.blue(`\n[i] Test Directory: ${coverage.testDir}`));
      console.log(chalk.blue(`[i] Test Files: ${coverage.testFiles.length}`));
    } else {
      console.log(chalk.red('\n[i] No test directory found'));
      console.log(
        chalk.yellow(
          `[i] Run: sc req generate-tests ${coverage.reqId.replace('REQ-', '')}`
        )
      );
    }
  }

  /**
   * Get colored percentage based on coverage level
   */
  getColoredPercentage(percentage: number): string {
    if (percentage >= 90) return chalk.green(String(percentage));
    if (percentage >= 70) return chalk.yellow(String(percentage));
    return chalk.red(String(percentage));
  }

  /**
   * Display full coverage report
   */
  displayCoverageReport(report: CoverageReport): void {
    console.log(chalk.blue('\n[i] PROJECT-WIDE COVERAGE REPORT'));
    console.log(chalk.blue('='.repeat(60)));

    const { summary } = report;
    console.log(
      `[i] Overall Coverage: ${this.getColoredPercentage(summary.overallCoverage)}%`
    );
    console.log(`[i] Total Requirements: ${summary.totalRequirements}`);
    console.log(`[i] Total Acceptance Criteria: ${summary.totalCriteria}`);
    console.log(`[OK] Tested Criteria: ${summary.totalTestedCriteria}`);
    console.log(
      `[>] Fully Tested Requirements: ${summary.fullyTestedRequirements}/${summary.totalRequirements}`
    );

    console.log(chalk.blue('\n[i] REQUIREMENTS BREAKDOWN:'));
    console.log(chalk.blue('-'.repeat(60)));

    // Sort by coverage percentage (worst first)
    const sortedReqs = report.requirements.sort(
      (a, b) => a.coveragePercentage - b.coveragePercentage
    );

    sortedReqs.forEach((req) => {
      const coverage = this.getColoredPercentage(req.coveragePercentage);
      const status =
        req.coveragePercentage === 100
          ? '[>]'
          : req.coveragePercentage >= 70
            ? '[!]'
            : '[X]';
      console.log(
        `  ${status} ${req.reqId}: ${coverage}% (${req.testedCriteria}/${req.totalCriteria})`
      );
    });

    // Show action items
    const untestedReqs = sortedReqs.filter(
      (req) => req.coveragePercentage < 100
    );
    if (untestedReqs.length > 0) {
      console.log(chalk.yellow('\n[>] ACTION ITEMS:'));
      untestedReqs.slice(0, 5).forEach((req) => {
        console.log(
          chalk.yellow(
            `  * Complete testing for ${req.reqId} (${req.coveragePercentage}% coverage)`
          )
        );
      });
    }
  }
}

export default TestCoverageManager;

// CLI interface
if (require.main === module) {
  const manager = new TestCoverageManager();

  const command = process.argv[2];
  const reqId = process.argv[3];

  switch (command) {
    case 'analyze':
      if (!reqId) {
        console.error(
          chalk.red('[X] Please provide requirement ID: sc test analyze 038')
        );
        process.exit(1);
      }
      manager
        .analyzeCoverage(reqId)
        .then((coverage) => manager.displayCoverageResults(coverage))
        .catch((error) => {
          console.error(chalk.red('[X] Error:', error.message));
          process.exit(1);
        });
      break;

    case 'report':
      manager
        .generateCoverageReport()
        .then((report) => manager.displayCoverageReport(report))
        .catch((error) => {
          console.error(chalk.red('[X] Error:', error.message));
          process.exit(1);
        });
      break;

    default:
      console.log(chalk.blue('[i] Test Coverage Manager (REQ-038)'));
      console.log(chalk.blue('Usage:'));
      console.log(
        '  sc test-coverage analyze 038   # Analyze specific requirement'
      );
      console.log('  sc test-coverage report        # Full project report');
      break;
  }
}
