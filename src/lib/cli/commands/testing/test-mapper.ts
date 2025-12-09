#!/usr/bin/env node

/**
 * Test Mapper Command - Comprehensive test discovery and mapping system
 *
 * This command discovers, categorizes, and maps all tests in the project
 * to provide a unified view of test coverage and execution capabilities.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

class TestMapperCommand {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.testMap = {
      summary: {
        totalFiles: 0,
        totalTests: 0,
        coverage: {
          requirements: { total: 0, covered: 0, percentage: 0 },
          components: { total: 0, covered: 0, percentage: 0 },
          integration: { total: 0, covered: 0, percentage: 0 }
        },
        frameworks: {},
        categories: {}
      },
      tests: [],
      requirements: {},
      frameworks: {},
      recommendations: []
    };
  }

  /**
   * Main test discovery and mapping
   */
  async discover() {
    console.log('🔍 Discovering and mapping all tests...\n');

    // Find all test files
    const testFiles = this.findTestFiles();
    this.testMap.summary.totalFiles = testFiles.length;

    // Analyze each test file
    for (const testFile of testFiles) {
      const testInfo = await this.analyzeTestFile(testFile);
      this.testMap.tests.push(testInfo);
    }

    // Map requirements to tests
    await this.mapRequirementsToTests();

    // Analyze test frameworks
    this.analyzeFrameworks();

    // Generate recommendations
    this.generateRecommendations();

    // Calculate summary statistics
    this.calculateSummaryStats();

    return this.testMap;
  }

  /**
   * Find all test files in the project
   */
  findTestFiles() {
    const _testFiles = [];
    const _searchPatterns = [
      '**/*.test.js',
      '**/*.spec.js',
      '**/*.e2e.js',
      '**/*.unit.js',
      '**/*.integration.js'
    ];

    const excludePatterns = [
      'node_modules',
      '.git',
      'coverage',
      'dist',
      'build'
    ];

    const findFilesRecursively = (dir, currentFiles = []) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (
              !excludePatterns.some((pattern) => fullPath.includes(pattern))
            ) {
              findFilesRecursively(fullPath, currentFiles);
            }
          } else if (entry.isFile()) {
            if (this.isTestFile(entry.name)) {
              currentFiles.push(fullPath);
            }
          }
        }
      } catch (_error) {
        // Skip directories we can't read
      }

      return currentFiles;
    };

    return findFilesRecursively(this.projectRoot);
  }

  /**
   * Check if file is a test file
   */
  isTestFile(filename) {
    const testPatterns = [
      /\.test\.js$/,
      /\.spec\.js$/,
      /\.e2e\.js$/,
      /\.unit\.js$/,
      /\.integration\.js$/
    ];

    return testPatterns.some((pattern) => pattern.test(filename));
  }

  /**
   * Analyze individual test file
   */
  async analyzeTestFile(testFile) {
    const relativePath = path.relative(this.projectRoot, testFile);
    const content = fs.readFileSync(testFile, 'utf8');

    const testInfo = {
      file: relativePath,
      absolutePath: testFile,
      category: this.categorizeTest(relativePath),
      framework: this.detectFramework(content),
      type: this.detectTestType(relativePath),
      requirement: this.extractRequirement(relativePath),
      size: fs.statSync(testFile).size,
      lines: content.split('\n').length,
      tests: this.countTests(content),
      describes: this.countDescribes(content),
      scenarios: this.countScenarios(content),
      hasBeforeAfter: this.hasBeforeAfterHooks(content),
      hasRealImplementation: this.detectRealImplementation(content),
      lastModified: fs.statSync(testFile).mtime,
      dependencies: this.extractDependencies(content)
    };

    return testInfo;
  }

  /**
   * Categorize test based on path
   */
  categorizeTest(testPath) {
    if (testPath.includes('requirements/')) {
      const reqMatch = testPath.match(/req-(\d+)/);
      return reqMatch ? `requirement-${reqMatch[1]}` : 'requirement-unknown';
    }

    if (testPath.includes('e2e/')) return 'e2e';
    if (testPath.includes('unit/')) return 'unit';
    if (testPath.includes('integration/')) return 'integration';
    if (testPath.includes('component/')) return 'component';

    return 'other';
  }

  /**
   * Detect test framework
   */
  detectFramework(content) {
    if (content.includes('@playwright/test') || content.includes('playwright'))
      return 'playwright';
    if (content.includes('jest') || content.includes('@jest/globals'))
      return 'jest';
    if (content.includes('mocha')) return 'mocha';
    if (content.includes('cypress')) return 'cypress';
    if (content.includes('gherkin') || content.includes('cucumber'))
      return 'gherkin';

    return 'unknown';
  }

  /**
   * Detect test type
   */
  detectTestType(testPath) {
    if (testPath.includes('.e2e.')) return 'e2e';
    if (testPath.includes('.unit.')) return 'unit';
    if (testPath.includes('.integration.')) return 'integration';
    if (testPath.includes('.spec.')) return 'spec';

    return 'test';
  }

  /**
   * Extract requirement ID from path
   */
  extractRequirement(testPath) {
    const reqMatch = testPath.match(/req-(\d+)/);
    return reqMatch ? `REQ-${reqMatch[1]}` : null;
  }

  /**
   * Count test cases
   */
  countTests(content) {
    const testPatterns = [/\bit\s*\(/g, /\btest\s*\(/g, /\bScenario:/g];

    let totalTests = 0;
    for (const pattern of testPatterns) {
      const matches = content.match(pattern);
      if (matches) totalTests += matches.length;
    }

    return totalTests;
  }

  /**
   * Count describe blocks
   */
  countDescribes(content) {
    const matches = content.match(/\bdescribe\s*\(/g);
    return matches ? matches.length : 0;
  }

  /**
   * Count Gherkin scenarios
   */
  countScenarios(content) {
    const matches = content.match(/\bScenario:/g);
    return matches ? matches.length : 0;
  }

  /**
   * Check for before/after hooks
   */
  hasBeforeAfterHooks(content) {
    const hookPatterns = [
      /\bbefore(Each|All)?\s*\(/,
      /\bafter(Each|All)?\s*\(/,
      /\bsetup\s*\(/,
      /\bteardown\s*\(/
    ];

    return hookPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Detect if test uses real implementation vs mocks
   */
  detectRealImplementation(content) {
    // Look for real class instantiation and actual file imports
    const realImplementationIndicators = [
      /require\(['"]\.\.\/.*\.js['"]\)/,
      /new\s+[A-Z][a-zA-Z]+\(/,
      /execSync\(/,
      /runCommand\(/,
      /process\.cwd\(/
    ];

    const mockIndicators = [
      /jest\.mock\(/,
      /sinon\./,
      /\.mockImplementation\(/,
      /\.mockReturnValue\(/
    ];

    const hasRealIndicators = realImplementationIndicators.some((pattern) =>
      pattern.test(content)
    );
    const hasMockIndicators = mockIndicators.some((pattern) =>
      pattern.test(content)
    );

    if (hasRealIndicators && !hasMockIndicators) return 'real';
    if (hasMockIndicators && !hasRealIndicators) return 'mocked';
    if (hasRealIndicators && hasMockIndicators) return 'mixed';

    return 'unknown';
  }

  /**
   * Extract test dependencies
   */
  extractDependencies(content) {
    const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
    const importMatches =
      content.match(/import .+ from ['"]([^'"]+)['"]/g) || [];

    const dependencies = [];

    requireMatches.forEach((match) => {
      const dep = match.match(/require\(['"]([^'"]+)['"]\)/)[1];
      if (!dep.startsWith('.')) dependencies.push(dep);
    });

    importMatches.forEach((match) => {
      const dep = match.match(/from ['"]([^'"]+)['"]/)[1];
      if (!dep.startsWith('.')) dependencies.push(dep);
    });

    return [...new Set(dependencies)];
  }

  /**
   * Map requirements to their tests
   */
  async mapRequirementsToTests() {
    // Find all requirement files
    const reqFiles = this.findRequirementFiles();

    for (const reqFile of reqFiles) {
      const reqId = this.extractRequirementFromPath(reqFile);
      if (reqId) {
        this.testMap.requirements[reqId] = {
          file: path.relative(this.projectRoot, reqFile),
          tests: this.testMap.tests.filter(
            (test) => test.requirement === reqId
          ),
          hasTests: false,
          coverage: 'none'
        };

        const req = this.testMap.requirements[reqId];
        req.hasTests = req.tests.length > 0;

        if (req.tests.length === 0) req.coverage = 'none';
        else if (req.tests.some((t) => t.type === 'e2e'))
          req.coverage = 'comprehensive';
        else if (req.tests.some((t) => t.type === 'unit'))
          req.coverage = 'basic';
        else req.coverage = 'minimal';
      }
    }
  }

  /**
   * Find requirement files
   */
  findRequirementFiles() {
    const reqFiles = [];
    const reqDirs = [
      'supernal-coding/requirements',
      'docs/requirements',
      'requirements'
    ];

    for (const reqDir of reqDirs) {
      const fullReqDir = path.join(this.projectRoot, reqDir);
      if (fs.existsSync(fullReqDir)) {
        this.findFilesRecursively(fullReqDir, reqFiles, /req-\d+.*\.md$/);
      }
    }

    return reqFiles;
  }

  /**
   * Helper to find files recursively
   */
  findFilesRecursively(dir, files, pattern) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          this.findFilesRecursively(fullPath, files, pattern);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (_error) {
      // Skip directories we can't read
    }
  }

  /**
   * Extract requirement ID from file path
   */
  extractRequirementFromPath(reqPath) {
    const match = reqPath.match(/req-(\d+)/);
    return match ? `REQ-${match[1]}` : null;
  }

  /**
   * Analyze test frameworks usage
   */
  analyzeFrameworks() {
    this.testMap.frameworks = {};

    this.testMap.tests.forEach((test) => {
      const framework = test.framework;
      if (!this.testMap.frameworks[framework]) {
        this.testMap.frameworks[framework] = {
          count: 0,
          tests: [],
          totalTestCases: 0
        };
      }

      this.testMap.frameworks[framework].count++;
      this.testMap.frameworks[framework].tests.push(test.file);
      this.testMap.frameworks[framework].totalTestCases += test.tests;
    });
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Check for requirements without tests
    const untestedRequirements = Object.entries(this.testMap.requirements)
      .filter(([_id, req]) => !req.hasTests)
      .map(([id]) => id);

    if (untestedRequirements.length > 0) {
      recommendations.push({
        type: 'missing-tests',
        priority: 'high',
        message: `${untestedRequirements.length} requirements have no tests`,
        requirements: untestedRequirements
      });
    }

    // Check for tests using mocks instead of real implementation
    const mockedTests = this.testMap.tests.filter(
      (test) => test.hasRealImplementation === 'mocked'
    );
    if (mockedTests.length > 0) {
      recommendations.push({
        type: 'mocked-tests',
        priority: 'medium',
        message: `${mockedTests.length} tests use mocks instead of real implementation`,
        files: mockedTests.map((t) => t.file)
      });
    }

    // Check for framework consistency
    const frameworks = Object.keys(this.testMap.frameworks);
    if (frameworks.length > 3) {
      recommendations.push({
        type: 'framework-fragmentation',
        priority: 'low',
        message: `${frameworks.length} different test frameworks detected - consider standardization`,
        frameworks: frameworks
      });
    }

    this.testMap.recommendations = recommendations;
  }

  /**
   * Calculate summary statistics
   */
  calculateSummaryStats() {
    const { tests, requirements } = this.testMap;

    // Total test cases
    this.testMap.summary.totalTests = tests.reduce(
      (sum, test) => sum + test.tests,
      0
    );

    // Requirements coverage
    const totalReqs = Object.keys(requirements).length;
    const coveredReqs = Object.values(requirements).filter(
      (req) => req.hasTests
    ).length;

    this.testMap.summary.coverage.requirements = {
      total: totalReqs,
      covered: coveredReqs,
      percentage:
        totalReqs > 0 ? Math.round((coveredReqs / totalReqs) * 100) : 0
    };

    // Framework statistics
    this.testMap.summary.frameworks = Object.entries(
      this.testMap.frameworks
    ).reduce((acc, [name, data]) => {
      acc[name] = data.count;
      return acc;
    }, {});

    // Category statistics
    this.testMap.summary.categories = tests.reduce((acc, test) => {
      acc[test.category] = (acc[test.category] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const report = [];

    report.push('📊 Comprehensive Test Mapping Report');
    report.push('====================================');
    report.push(`Generated: ${new Date().toLocaleString()}`);
    report.push('');

    // Summary
    report.push('📈 Summary Statistics');
    report.push(`   Test Files: ${this.testMap.summary.totalFiles}`);
    report.push(`   Test Cases: ${this.testMap.summary.totalTests}`);
    report.push(
      `   Requirements Coverage: ${this.testMap.summary.coverage.requirements.covered}/${this.testMap.summary.coverage.requirements.total} (${this.testMap.summary.coverage.requirements.percentage}%)`
    );
    report.push('');

    // Frameworks
    report.push('🔧 Test Frameworks');
    Object.entries(this.testMap.summary.frameworks).forEach(([name, count]) => {
      report.push(`   ${name}: ${count} files`);
    });
    report.push('');

    // Categories
    report.push('📂 Test Categories');
    Object.entries(this.testMap.summary.categories).forEach(([name, count]) => {
      report.push(`   ${name}: ${count} files`);
    });
    report.push('');

    // Requirements
    report.push('📋 Requirements Test Coverage');
    Object.entries(this.testMap.requirements).forEach(([id, req]) => {
      const status = req.hasTests ? '✅' : '❌';
      const testCount = req.tests.length;
      report.push(
        `   ${status} ${id}: ${testCount} test files (${req.coverage})`
      );
    });
    report.push('');

    // Recommendations
    if (this.testMap.recommendations.length > 0) {
      report.push('💡 Recommendations');
      this.testMap.recommendations.forEach((rec, index) => {
        report.push(
          `   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`
        );
      });
      report.push('');
    }

    return report.join('\n');
  }

  /**
   * Export test map as JSON
   */
  exportJSON() {
    return JSON.stringify(this.testMap, null, 2);
  }

  /**
   * Export test execution commands
   */
  generateTestCommands() {
    const commands = {
      all: 'npm test',
      unit: 'npm test -- --testPathPattern="unit"',
      e2e: 'npm test -- --testPathPattern="e2e"',
      requirements: 'npm test -- tests/requirements/',
      frameworks: {}
    };

    // Framework-specific commands
    Object.keys(this.testMap.frameworks).forEach((framework) => {
      switch (framework) {
        case 'jest':
          commands.frameworks[framework] = 'npm test';
          break;
        case 'playwright':
          commands.frameworks[framework] = 'npx playwright test';
          break;
        case 'cypress':
          commands.frameworks[framework] = 'npx cypress run';
          break;
      }
    });

    // Requirement-specific commands
    commands.requirements = {};
    Object.keys(this.testMap.requirements).forEach((reqId) => {
      const reqNumber = reqId.replace('REQ-', '');
      commands.requirements[reqId] =
        `npm test -- tests/requirements/req-${reqNumber}/`;
    });

    return commands;
  }

  /**
   * Get quick statistics
   */
  getStats() {
    return {
      totalFiles: this.testMap.summary.totalFiles,
      totalTests: this.testMap.summary.totalTests,
      coveragePercentage: this.testMap.summary.coverage.requirements.percentage
    };
  }
}

module.exports = TestMapperCommand;
