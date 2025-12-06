#!/usr/bin/env node

/**
 * Traceability Matrix System
 * Implementation of REQ-070: Traceability Matrix Implementation
 *
 * Provides comprehensive bidirectional traceability between:
 * - Compliance frameworks
 * - Requirements
 * - Git branches
 * - Tests
 * - Implementation code
 */

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const { loadProjectConfig, getDocPaths } = require('../utils/config-loader');

class TraceabilityMatrix {
  constructor() {
    this.projectRoot = process.cwd();
    this.matrixPath = path.join(
      this.projectRoot,
      '.supernal-coding',
      'traceability-matrix.json'
    );

    // Load config to get correct requirements path
    const config = loadProjectConfig(this.projectRoot);
    const paths = getDocPaths(config);
    this.requirementsPath = path.join(this.projectRoot, paths.requirements);
    this.testsPath = path.join(this.projectRoot, 'tests');
    this.complianceMappingPath = path.join(
      this.projectRoot,
      paths.compliance || 'docs/compliance'
    );
    this.featuresPath = path.join(this.projectRoot, 'docs', 'features');
  }

  /**
   * Generate comprehensive traceability matrix
   */
  async generate(_options = {}) {
    try {
      console.log(chalk.blue('🔗 Generating traceability matrix...'));

      const matrix = {
        metadata: {
          generated: new Date().toISOString(),
          generatedBy: 'sc-traceability-system',
          version: '1.1.0',
        },
        requirements: await this.scanRequirements(),
        tests: await this.scanTests(),
        gitBranches: await this.scanGitBranches(),
        complianceFrameworks: await this.loadComplianceFrameworks(),
        features: await this.scanFeatures(),
        traceabilityLinks: {},
        coverage: {},
      };

      // Build traceability links
      matrix.traceabilityLinks = await this.buildTraceabilityLinks(matrix);

      // Calculate coverage metrics
      matrix.coverage = await this.calculateCoverage(matrix);

      // Add cryptographic signature for audit trail
      matrix.auditTrail = {
        signature: this.generateSignature(matrix),
        timestamp: new Date().toISOString(),
      };

      // Ensure directory exists
      await fs.ensureDir(path.dirname(this.matrixPath));

      // Save matrix
      await fs.writeJson(this.matrixPath, matrix, { spaces: 2 });

      console.log(chalk.green('✅ Traceability matrix generated successfully'));
      console.log(chalk.blue(`📁 Saved to: ${this.matrixPath}`));

      // Display summary
      this.displayMatrixSummary(matrix);

      return matrix;
    } catch (error) {
      console.error(
        chalk.red('❌ Error generating traceability matrix:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Validate traceability for specific requirement
   */
  async validate(requirementId, _options = {}) {
    try {
      console.log(
        chalk.blue(`🔍 Validating traceability for ${requirementId}...`)
      );

      // Load existing matrix or generate new one
      let matrix;
      if (await fs.pathExists(this.matrixPath)) {
        matrix = await fs.readJson(this.matrixPath);
      } else {
        console.log(
          chalk.yellow('⚠️  No existing matrix found, generating...')
        );
        matrix = await this.generate();
      }

      const requirement = matrix.requirements[requirementId];
      if (!requirement) {
        console.log(chalk.red(`❌ Requirement ${requirementId} not found`));
        return false;
      }

      console.log(chalk.green(`\n📋 ${requirementId}: ${requirement.title}`));

      // Show traceability links
      const links = matrix.traceabilityLinks[requirementId] || {};

      console.log(chalk.blue('\n🔗 Traceability Links:'));
      console.log(`  📝 Tests: ${links.tests?.length || 0}`);
      if (links.tests?.length > 0) {
        links.tests.forEach((test) => console.log(`    - ${test}`));
      }

      console.log(`  🌿 Git Branches: ${links.branches?.length || 0}`);
      if (links.branches?.length > 0) {
        links.branches.forEach((branch) => console.log(`    - ${branch}`));
      }

      console.log(
        `  📄 Implementation Files: ${links.implementationFiles?.length || 0}`
      );
      if (links.implementationFiles?.length > 0) {
        links.implementationFiles.forEach((file) =>
          console.log(`    - ${file}`)
        );
      }

      console.log(
        `  🏛️ Compliance Frameworks: ${links.complianceFrameworks?.length || 0}`
      );
      if (links.complianceFrameworks?.length > 0) {
        links.complianceFrameworks.forEach((framework) => {
          console.log(
            `    - ${framework.framework}: ${framework.clauses?.join(', ') || 'N/A'}`
          );
        });
      }

      // Calculate coverage for this requirement
      const coverage = this.calculateRequirementCoverage(requirementId, matrix);
      console.log(chalk.blue(`\n📊 Coverage: ${coverage.percentage}%`));

      if (coverage.gaps.length > 0) {
        console.log(chalk.yellow('\n⚠️  Coverage Gaps:'));
        coverage.gaps.forEach((gap) => console.log(`  - ${gap}`));
      }

      return coverage.percentage >= 80; // 80% coverage threshold
    } catch (error) {
      console.error(
        chalk.red('❌ Error validating traceability:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Generate audit export package
   */
  async auditExport(options = {}) {
    try {
      console.log(chalk.blue('📦 Generating audit export package...'));

      const outputDir =
        options.output || path.join(this.projectRoot, 'audit-export');
      await fs.ensureDir(outputDir);

      // Load matrix
      let matrix;
      if (await fs.pathExists(this.matrixPath)) {
        matrix = await fs.readJson(this.matrixPath);
      } else {
        matrix = await this.generate();
      }

      // Generate audit reports
      await this.generateAuditReports(matrix, outputDir);

      console.log(chalk.green('✅ Audit export package generated'));
      console.log(chalk.blue(`📁 Location: ${outputDir}`));

      return outputDir;
    } catch (error) {
      console.error(
        chalk.red('❌ Error generating audit export:'),
        error.message
      );
      throw error;
    }
  }

  /**
   * Scan all requirements files
   */
  async scanRequirements() {
    const requirements = {};

    try {
      const reqFiles = await this.findFiles(
        this.requirementsPath,
        /req-.*\.md$/
      );

      for (const file of reqFiles) {
        const content = await fs.readFile(file, 'utf8');
        const frontmatter = this.parseFrontmatter(content);

        if (frontmatter.id) {
          requirements[frontmatter.id] = {
            title: frontmatter.title || 'Untitled',
            epic: frontmatter.epic,
            status: frontmatter.status,
            priority: frontmatter.priority,
            complianceStandards: frontmatter.complianceStandards || [],
            dependencies: frontmatter.dependencies || [],
            filePath: file,
            lastModified: (await fs.stat(file)).mtime.toISOString(),
          };
        }
      }
    } catch (error) {
      console.warn(
        chalk.yellow('⚠️  Warning: Could not scan requirements:'),
        error.message
      );
    }

    return requirements;
  }

  /**
   * Scan test files for requirement references
   */
  async scanTests() {
    const tests = {};

    try {
      const testFiles = await this.findFiles(
        this.testsPath,
        /\.(test|spec)\.(js|ts)$/
      );

      for (const file of testFiles) {
        const content = await fs.readFile(file, 'utf8');
        const reqReferences = this.extractRequirementReferences(content);

        if (reqReferences.length > 0) {
          tests[file] = {
            requirements: reqReferences,
            lastModified: (await fs.stat(file)).mtime.toISOString(),
          };
        }
      }
    } catch (error) {
      console.warn(
        chalk.yellow('⚠️  Warning: Could not scan tests:'),
        error.message
      );
    }

    return tests;
  }

  /**
   * Scan git branches for requirement patterns
   */
  async scanGitBranches() {
    const branches = {};

    try {
      const branchOutput = execSync('git branch -a', {
        encoding: 'utf8',
        cwd: this.projectRoot,
      });
      const branchLines = branchOutput
        .split('\n')
        .filter((line) => line.trim());

      for (const line of branchLines) {
        const branchName = line
          .replace(/^\*?\s+/, '')
          .replace(/^remotes\/[^/]+\//, '');
        const reqMatch = branchName.match(/req-(\d+)/i);

        if (reqMatch) {
          const reqId = `REQ-${reqMatch[1].padStart(3, '0')}`;
          if (!branches[reqId]) {
            branches[reqId] = [];
          }
          branches[reqId].push(branchName);
        }
      }
    } catch (error) {
      console.warn(
        chalk.yellow('⚠️  Warning: Could not scan git branches:'),
        error.message
      );
    }

    return branches;
  }

  /**
   * Load compliance framework mappings
   */
  async loadComplianceFrameworks() {
    const frameworks = {};

    try {
      const mappingFile = path.join(
        this.complianceMappingPath,
        'req-to-compliance.json'
      );
      if (await fs.pathExists(mappingFile)) {
        const mappingData = await fs.readJson(mappingFile);

        // Process framework coverage data
        if (mappingData.framework_coverage) {
          Object.entries(mappingData.framework_coverage).forEach(
            ([framework, data]) => {
              frameworks[framework] = data;
            }
          );
        }
      }
    } catch (error) {
      console.warn(
        chalk.yellow('⚠️  Warning: Could not load compliance frameworks:'),
        error.message
      );
    }

    return frameworks;
  }

  /**
   * Scan features from docs/features/
   */
  async scanFeatures() {
    const features = {};

    try {
      if (!(await fs.pathExists(this.featuresPath))) {
        return features;
      }

      // Valid domains
      const validDomains = [
        'ai-workflow-system',
        'developer-tooling',
        'compliance-framework',
        'dashboard-platform',
        'workflow-management',
        'content-management',
        'integrations',
        'admin-operations',
        'documentation-platform',
      ];

      // Feature subdirectories to skip
      const skipDirs = [
        'planning',
        'design',
        'requirements',
        'tests',
        'research',
        'implementation',
        'archive',
      ];

      const domains = await fs.readdir(this.featuresPath);

      for (const domain of domains) {
        const domainPath = path.join(this.featuresPath, domain);
        const stat = await fs.stat(domainPath);

        if (!stat.isDirectory()) continue;
        if (!validDomains.includes(domain)) continue;

        const items = await fs.readdir(domainPath);

        for (const item of items) {
          if (skipDirs.includes(item)) continue;

          const itemPath = path.join(domainPath, item);
          const itemStat = await fs.stat(itemPath);

          if (!itemStat.isDirectory()) continue;

          const readmePath = path.join(itemPath, 'README.md');
          if (await fs.pathExists(readmePath)) {
            const frontmatter = await this.parseFeatureFrontmatter(readmePath);

            features[item] = {
              domain: domain,
              path: path.relative(this.projectRoot, itemPath),
              title: frontmatter.title || item,
              phase: frontmatter.phase || frontmatter.status || 'unknown',
              requirements: frontmatter.requirements || [],
              epic: frontmatter.epic || '',
              priority: frontmatter.priority || 'medium',
              tests_pending: frontmatter.tests_pending || false,
            };
          }
        }
      }
    } catch (error) {
      console.warn(
        chalk.yellow('⚠️  Warning: Could not scan features:'),
        error.message
      );
    }

    return features;
  }

  /**
   * Parse frontmatter from feature README.md
   */
  async parseFeatureFrontmatter(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);

      if (!match) return {};

      // Simple YAML parsing
      const yaml = require('js-yaml');
      return yaml.load(match[1]) || {};
    } catch (_error) {
      return {};
    }
  }

  /**
   * Find implementation files for a requirement via git commits
   */
  async findImplementationFiles(reqId) {
    const implementationFiles = [];

    try {
      // Search git log for commits mentioning this requirement
      const gitLogOutput = execSync(
        `git log --name-only --pretty=format: --grep="${reqId}" | grep -v "^$" | sort | uniq`,
        { encoding: 'utf8', cwd: this.projectRoot }
      );

      if (gitLogOutput.trim()) {
        const files = gitLogOutput.trim().split('\n');

        // Filter for implementation files (exclude docs, tests, etc.)
        const implementationPatterns = [
          /^supernal-code-package\/lib\//,
          /^src\//,
          /^lib\//,
          /\.js$/,
          /\.ts$/,
          /\.jsx$/,
          /\.tsx$/,
          /\.py$/,
          /\.go$/,
          /\.rs$/,
        ];

        const excludePatterns = [
          /\/test\//,
          /\/tests\//,
          /\.test\./,
          /\.spec\./,
          /\/docs?\//,
          /\/documentation\//,
          /README/,
          /\.md$/,
        ];

        files.forEach((file) => {
          const isImplementation = implementationPatterns.some((pattern) =>
            pattern.test(file)
          );
          const isExcluded = excludePatterns.some((pattern) =>
            pattern.test(file)
          );

          if (isImplementation && !isExcluded) {
            implementationFiles.push(file); // Use relative path, not absolute
          }
        });
      }
    } catch (_error) {
      // Silently handle git log errors (e.g., no commits found)
    }

    return implementationFiles;
  }

  /**
   * Build traceability links between all artifacts
   */
  async buildTraceabilityLinks(matrix) {
    const links = {};

    // For each requirement, find its links
    for (const reqId of Object.keys(matrix.requirements)) {
      links[reqId] = {
        tests: [],
        branches: matrix.gitBranches[reqId] || [],
        implementationFiles: [],
        complianceFrameworks: [],
        features: [],
      };

      // Find tests that reference this requirement
      Object.entries(matrix.tests).forEach(([testFile, testData]) => {
        if (testData.requirements.includes(reqId)) {
          links[reqId].tests.push(testFile);
        }
      });

      // Find implementation files via git commits
      links[reqId].implementationFiles =
        await this.findImplementationFiles(reqId);

      // Find compliance framework mappings
      const requirement = matrix.requirements[reqId];
      if (requirement.complianceStandards) {
        requirement.complianceStandards.forEach((standard) => {
          if (matrix.complianceFrameworks[standard]) {
            links[reqId].complianceFrameworks.push({
              framework: standard,
              ...matrix.complianceFrameworks[standard],
            });
          }
        });
      }

      // Find features that reference this requirement
      Object.entries(matrix.features).forEach(([featureName, featureData]) => {
        const featureReqs = featureData.requirements || [];
        // Normalize requirement IDs for comparison
        const normalizedReqId = reqId.toLowerCase();
        const matches = featureReqs.some((r) => {
          const normalizedR = r.toLowerCase();
          // Match exact or partial (e.g., req-044 matches REQ-044)
          return (
            normalizedR === normalizedReqId ||
            normalizedR.endsWith(normalizedReqId.replace(/^req-/, '')) ||
            normalizedReqId.endsWith(normalizedR.replace(/^req-/, ''))
          );
        });

        if (matches) {
          links[reqId].features.push({
            name: featureName,
            domain: featureData.domain,
            phase: featureData.phase,
          });
        }
      });
    }

    return links;
  }

  /**
   * Calculate coverage metrics
   */
  async calculateCoverage(matrix) {
    const totalRequirements = Object.keys(matrix.requirements).length;
    const testedRequirements = Object.keys(matrix.traceabilityLinks).filter(
      (reqId) => matrix.traceabilityLinks[reqId].tests.length > 0
    ).length;

    // Calculate feature coverage
    const totalFeatures = Object.keys(matrix.features).length;
    const featuresWithRequirements = Object.values(matrix.features).filter(
      (f) => f.requirements && f.requirements.length > 0
    ).length;
    const featuresWithTests = Object.values(matrix.features).filter((f) => {
      // Feature has tests if any of its requirements have tests
      if (!f.requirements || f.requirements.length === 0) return false;
      return f.requirements.some((reqId) => {
        const normalizedReqId = reqId.toUpperCase();
        const links = matrix.traceabilityLinks[normalizedReqId];
        return links?.tests && links.tests.length > 0;
      });
    }).length;

    const coverage = {
      requirements: {
        total: totalRequirements,
        tested: testedRequirements,
        percentage:
          totalRequirements > 0
            ? Math.round((testedRequirements / totalRequirements) * 100)
            : 0,
      },
      features: {
        total: totalFeatures,
        withRequirements: featuresWithRequirements,
        withTests: featuresWithTests,
        requirementsPercentage:
          totalFeatures > 0
            ? Math.round((featuresWithRequirements / totalFeatures) * 100)
            : 0,
        testsPercentage:
          totalFeatures > 0
            ? Math.round((featuresWithTests / totalFeatures) * 100)
            : 0,
      },
      complianceFrameworks: {},
    };

    // Calculate compliance framework coverage
    Object.entries(matrix.complianceFrameworks).forEach(([framework, data]) => {
      coverage.complianceFrameworks[framework] = {
        totalClauses: data.total_clauses || 0,
        coveredClauses: data.covered_clauses || 0,
        percentage: data.coverage_percentage || 0,
      };
    });

    return coverage;
  }

  /**
   * Calculate coverage for specific requirement
   */
  calculateRequirementCoverage(reqId, matrix) {
    const links = matrix.traceabilityLinks[reqId] || {};
    const gaps = [];
    let score = 0;
    const maxScore = 4;

    // Test coverage
    if (links.tests && links.tests.length > 0) {
      score += 1;
    } else {
      gaps.push('No test coverage');
    }

    // Git branch coverage
    if (links.branches && links.branches.length > 0) {
      score += 1;
    } else {
      gaps.push('No git branch tracking');
    }

    // Implementation coverage
    if (links.implementationFiles && links.implementationFiles.length > 0) {
      score += 1;
    } else {
      gaps.push('No implementation files identified');
    }

    // Compliance coverage
    if (links.complianceFrameworks && links.complianceFrameworks.length > 0) {
      score += 1;
    } else {
      gaps.push('No compliance framework mapping');
    }

    return {
      percentage: Math.round((score / maxScore) * 100),
      gaps,
    };
  }

  /**
   * Display matrix summary
   */
  displayMatrixSummary(matrix) {
    console.log(chalk.blue('\n📊 Traceability Matrix Summary:'));
    console.log(
      `  📋 Requirements: ${Object.keys(matrix.requirements).length}`
    );
    console.log(`  📝 Test Files: ${Object.keys(matrix.tests).length}`);
    console.log(
      `  🌿 Git Branches: ${Object.values(matrix.gitBranches).flat().length}`
    );
    console.log(
      `  🏛️ Compliance Frameworks: ${Object.keys(matrix.complianceFrameworks).length}`
    );
    console.log(`  📦 Features: ${Object.keys(matrix.features).length}`);

    console.log(chalk.blue('\n📈 Coverage Metrics:'));
    console.log(
      `  📋 Requirements with Tests: ${matrix.coverage.requirements.tested}/${matrix.coverage.requirements.total} (${matrix.coverage.requirements.percentage}%)`
    );

    // Feature coverage
    if (matrix.coverage.features) {
      console.log(
        `  📦 Features with Requirements: ${matrix.coverage.features.withRequirements}/${matrix.coverage.features.total} (${matrix.coverage.features.requirementsPercentage}%)`
      );
      console.log(
        `  📦 Features with Tests: ${matrix.coverage.features.withTests}/${matrix.coverage.features.total} (${matrix.coverage.features.testsPercentage}%)`
      );
    }

    Object.entries(matrix.coverage.complianceFrameworks).forEach(
      ([framework, coverage]) => {
        console.log(
          `  🏛️ ${framework}: ${coverage.coveredClauses}/${coverage.totalClauses} (${coverage.percentage}%)`
        );
      }
    );

    // Show feature details if any
    if (Object.keys(matrix.features).length > 0) {
      console.log(chalk.blue('\n📦 Features by Domain:'));
      const byDomain = {};
      Object.entries(matrix.features).forEach(([name, data]) => {
        if (!byDomain[data.domain]) byDomain[data.domain] = [];
        byDomain[data.domain].push({ name, ...data });
      });

      Object.entries(byDomain).forEach(([domain, features]) => {
        console.log(chalk.cyan(`  ${domain}:`));
        features.forEach((f) => {
          const reqCount = f.requirements?.length || 0;
          const status = f.tests_pending
            ? chalk.yellow('⏳')
            : reqCount > 0
              ? chalk.green('✅')
              : chalk.gray('○');
          console.log(
            `    ${status} ${f.name} (${f.phase}) - ${reqCount} req(s)`
          );
        });
      });
    }
  }

  /**
   * Generate audit reports
   */
  async generateAuditReports(matrix, outputDir) {
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(matrix);
    await fs.writeFile(
      path.join(outputDir, 'traceability-matrix.html'),
      htmlReport
    );

    // Generate CSV export
    const csvReport = this.generateCsvReport(matrix);
    await fs.writeFile(
      path.join(outputDir, 'traceability-matrix.csv'),
      csvReport
    );

    // Generate JSON export
    await fs.writeJson(
      path.join(outputDir, 'traceability-matrix.json'),
      matrix,
      { spaces: 2 }
    );

    // Generate compliance summary
    const complianceSummary = this.generateComplianceSummary(matrix);
    await fs.writeFile(
      path.join(outputDir, 'compliance-summary.md'),
      complianceSummary
    );
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(matrix) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Traceability Matrix Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .coverage-high { background-color: #d4edda; }
        .coverage-medium { background-color: #fff3cd; }
        .coverage-low { background-color: #f8d7da; }
    </style>
</head>
<body>
    <h1>Traceability Matrix Report</h1>
    <p>Generated: ${matrix.metadata.generated}</p>
    
    <h2>Coverage Summary</h2>
    <p>Requirements with Tests: ${matrix.coverage.requirements.tested}/${matrix.coverage.requirements.total} (${matrix.coverage.requirements.percentage}%)</p>
    
    <h2>Requirements Traceability</h2>
    <table>
        <tr>
            <th>Requirement ID</th>
            <th>Title</th>
            <th>Tests</th>
            <th>Branches</th>
            <th>Compliance</th>
            <th>Coverage</th>
        </tr>
        ${Object.entries(matrix.requirements)
          .map(([reqId, req]) => {
            const links = matrix.traceabilityLinks[reqId] || {};
            const coverage = this.calculateRequirementCoverage(reqId, matrix);
            const coverageClass =
              coverage.percentage >= 80
                ? 'coverage-high'
                : coverage.percentage >= 50
                  ? 'coverage-medium'
                  : 'coverage-low';

            return `
            <tr class="${coverageClass}">
                <td>${reqId}</td>
                <td>${req.title}</td>
                <td>${links.tests?.length || 0}</td>
                <td>${links.branches?.length || 0}</td>
                <td>${links.complianceFrameworks?.length || 0}</td>
                <td>${coverage.percentage}%</td>
            </tr>
          `;
          })
          .join('')}
    </table>
</body>
</html>
    `;
  }

  /**
   * Generate CSV report
   */
  generateCsvReport(matrix) {
    const headers = [
      'Requirement ID',
      'Title',
      'Status',
      'Tests',
      'Branches',
      'Compliance Frameworks',
      'Coverage %',
    ];
    const rows = [headers.join(',')];

    Object.entries(matrix.requirements).forEach(([reqId, req]) => {
      const links = matrix.traceabilityLinks[reqId] || {};
      const coverage = this.calculateRequirementCoverage(reqId, matrix);

      const row = [
        reqId,
        `"${req.title}"`,
        req.status,
        links.tests?.length || 0,
        links.branches?.length || 0,
        links.complianceFrameworks?.length || 0,
        coverage.percentage,
      ];

      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Generate compliance summary
   */
  generateComplianceSummary(matrix) {
    let summary = '# Compliance Traceability Summary\n\n';
    summary += `Generated: ${matrix.metadata.generated}\n\n`;

    summary += '## Coverage Overview\n\n';
    summary += `- Total Requirements: ${Object.keys(matrix.requirements).length}\n`;
    summary += `- Requirements with Tests: ${matrix.coverage.requirements.tested} (${matrix.coverage.requirements.percentage}%)\n\n`;

    summary += '## Compliance Framework Coverage\n\n';
    Object.entries(matrix.coverage.complianceFrameworks).forEach(
      ([framework, coverage]) => {
        summary += `### ${framework}\n`;
        summary += `- Covered Clauses: ${coverage.coveredClauses}/${coverage.totalClauses} (${coverage.percentage}%)\n\n`;
      }
    );

    return summary;
  }

  /**
   * Utility functions
   */
  async findFiles(dir, pattern) {
    const files = [];

    if (!(await fs.pathExists(dir))) {
      return files;
    }

    const walk = async (currentDir) => {
      const items = await fs.readdir(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await walk(fullPath);
        } else if (pattern.test(item)) {
          files.push(fullPath);
        }
      }
    };

    await walk(dir);
    return files;
  }

  parseFrontmatter(content) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return {};

    const frontmatter = {};
    const lines = frontmatterMatch[1].split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        let value = match[2].trim();

        // Parse arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value
            .slice(1, -1)
            .split(',')
            .map((v) => v.trim().replace(/['"]/g, ''));
        }

        frontmatter[match[1]] = value;
      }
    }

    return frontmatter;
  }

  extractRequirementReferences(content) {
    const reqPattern = /REQ-\d{3}/g;
    const matches = content.match(reqPattern) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  generateSignature(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data, null, 2));
    return hash.digest('hex');
  }
}

// CLI Interface
async function handleTraceabilityCommand(action, ...args) {
  const matrix = new TraceabilityMatrix();

  try {
    switch (action) {
      case 'generate':
      case 'gen': {
        const options = parseOptions(args);
        await matrix.generate(options);
        break;
      }

      case 'validate': {
        if (args.length === 0) {
          console.error(
            chalk.red('❌ Requirement ID is required for validation')
          );
          process.exit(1);
        }
        const reqId = args[0];
        const options = parseOptions(args.slice(1));
        const isValid = await matrix.validate(reqId, options);
        process.exit(isValid ? 0 : 1);
        break; // eslint-disable-line no-unreachable
      }

      case 'audit-export':
      // falls through
      case 'export': {
        const options = parseOptions(args);
        await matrix.auditExport(options);
        break;
      }

      case 'coverage': {
        const options = parseOptions(args);
        const matrixData = await matrix.generate(options);
        console.log(chalk.blue('\n📊 Coverage Report:'));
        matrix.displayMatrixSummary(matrixData);
        break;
      }

      default:
        console.log(chalk.blue('🔗 Traceability Matrix Commands:'));
        console.log('  generate     Generate traceability matrix');
        console.log('  validate     Validate requirement traceability');
        console.log('  audit-export Export audit package');
        console.log('  coverage     Show coverage report');
        console.log('\nExample: sc traceability generate');
        break;
    }
  } catch (error) {
    console.error(chalk.red('❌ Command failed:'), error.message);
    process.exit(1);
  }
}

function parseOptions(args) {
  const options = {};

  if (!Array.isArray(args)) {
    return options;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg?.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];

      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++; // Skip the value in next iteration
      } else {
        options[key] = true;
      }
    }
  }

  return options;
}

module.exports = {
  TraceabilityMatrix,
  handleTraceabilityCommand,
};

// If called directly
if (require.main === module) {
  const [, , action, ...args] = process.argv;
  handleTraceabilityCommand(action, ...args);
}
