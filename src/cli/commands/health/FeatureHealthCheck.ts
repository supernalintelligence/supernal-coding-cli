// @ts-nocheck
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');

/**
 * Feature Health Check System
 * Non-blocking health monitoring for feature documentation compliance
 */
class FeatureHealthCheck {
  cacheFile: any;
  featuresDir: any;
  projectRoot: any;
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.featuresDir = path.join(projectRoot, 'docs', 'features');
    this.cacheFile = path.join(
      projectRoot,
      '.supernal-coding',
      'health-cache.json'
    );
  }

  /**
   * Run comprehensive feature health check
   */
  async check(options = {}) {
    const results = {
      total: 0,
      compliant: 0,
      warnings: [],
      errors: [],
      features: []
    };

    // Find all features
    const features = await this.findFeatures();
    results.total = features.length;

    if (features.length === 0) {
      return {
        ...results,
        summary: 'No features found',
        hasIssues: false
      };
    }

    // Validate each feature
    for (const feature of features) {
      const validation = await this.validateFeature(feature);
      results.features.push(validation);

      if (validation.compliant) {
        results.compliant++;
      }

      results.warnings.push(...validation.warnings);
      results.errors.push(...validation.errors);
    }

    // Generate summary
    results.summary = this.generateSummary(results);
    results.hasIssues =
      results.errors.length > 0 || results.warnings.length > 0;

    // Cache results
    if (!options.noCache) {
      await this.cacheResults(results);
    }

    return results;
  }

  /**
   * Find all feature directories
   */
  async findFeatures() {
    const features = [];

    if (!(await fs.pathExists(this.featuresDir))) {
      return features;
    }

    // Directories that are feature subdirectories, not features themselves
    const FEATURE_SUBDIRS = [
      'planning',
      'design',
      'requirements',
      'tests',
      'research',
      'implementation',
      'archive'
    ];

    const domains = await fs.readdir(this.featuresDir);

    for (const domain of domains) {
      const domainPath = path.join(this.featuresDir, domain);
      const stat = await fs.stat(domainPath);

      if (!stat.isDirectory() || domain === 'archive' || domain === 'archived')
        continue;

      // Look for features in this domain
      const items = await fs.readdir(domainPath);

      for (const item of items) {
        // Skip feature subdirectories (planning, design, etc.)
        if (FEATURE_SUBDIRS.includes(item)) continue;

        const itemPath = path.join(domainPath, item);
        const itemStat = await fs.stat(itemPath);

        if (!itemStat.isDirectory()) continue;

        // Check if it has a README.md
        const readmePath = path.join(itemPath, 'README.md');
        if (await fs.pathExists(readmePath)) {
          features.push({
            name: item,
            domain: domain,
            path: path.relative(this.projectRoot, itemPath),
            readmePath: readmePath
          });
        }
      }
    }

    return features;
  }

  /**
   * Validate a single feature
   */
  async validateFeature(feature) {
    const validation = {
      name: feature.name,
      domain: feature.domain,
      path: feature.path,
      compliant: true,
      warnings: [],
      errors: [],
      checks: {}
    };

    // Check frontmatter
    const frontmatter = await this.checkFrontmatter(feature);
    validation.checks.frontmatter = frontmatter;
    if (!frontmatter.valid) {
      validation.compliant = false;
      validation.errors.push(...frontmatter.errors);
    }

    // Check required directories
    const directories = await this.checkDirectories(feature, frontmatter.phase);
    validation.checks.directories = directories;
    if (directories.missing.length > 0) {
      validation.warnings.push(
        `${feature.name}: Missing directories: ${directories.missing.join(', ')}`
      );
    }

    // Check test connections (skip if tests_pending is true)
    const tests = await this.checkTestConnections(feature);
    validation.checks.tests = tests;
    const testsPending =
      frontmatter.data &&
      (frontmatter.data.tests_pending === true ||
        frontmatter.data.tests_pending === 'true');
    if (!tests.connected && !testsPending) {
      // Only warn for complete/implementing features without test connections
      const phase = frontmatter.data?.phase || frontmatter.data?.status;
      if (
        phase === 'complete' ||
        phase === 'implementing' ||
        phase === 'testing'
      ) {
        validation.warnings.push(
          `${feature.name}: No test connections found (expected in tests/ or symlinks)`
        );
      }
    }

    return validation;
  }

  /**
   * Check feature frontmatter
   */
  async checkFrontmatter(feature) {
    const result = {
      valid: true,
      errors: [],
      phase: null,
      data: {}
    };

    try {
      const content = await fs.readFile(feature.readmePath, 'utf8');
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) {
        result.valid = false;
        result.errors.push(`${feature.name}: Missing frontmatter`);
        return result;
      }

      // Parse frontmatter (simple YAML-like parsing)
      const frontmatterText = frontmatterMatch[1];
      const lines = frontmatterText.split('\n');

      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          result.data[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
      }

      // Check required fields
      if (!result.data.title && !result.data.feature_id) {
        result.valid = false;
        result.errors.push(`${feature.name}: Missing title or feature_id`);
      }

      result.phase = result.data.status || result.data.phase;
    } catch (error) {
      result.valid = false;
      result.errors.push(
        `${feature.name}: Error reading frontmatter: ${error.message}`
      );
    }

    return result;
  }

  /**
   * Check required directories based on phase
   */
  async checkDirectories(feature, phase) {
    const featurePath = path.join(this.projectRoot, feature.path);
    const result = {
      existing: [],
      missing: []
    };

    // Define required directories by phase
    const requiredDirs = {
      planning: ['planning'],
      drafting: ['planning', 'requirements'],
      implementing: ['design', 'planning', 'requirements', 'tests'],
      testing: ['design', 'planning', 'requirements', 'tests'],
      complete: ['design', 'requirements', 'tests']
    };

    const required = requiredDirs[phase] || [];

    for (const dir of required) {
      const dirPath = path.join(featurePath, dir);
      const mdPath = path.join(featurePath, `${dir}.md`);

      if ((await fs.pathExists(dirPath)) || (await fs.pathExists(mdPath))) {
        result.existing.push(dir);
      } else {
        result.missing.push(dir);
      }
    }

    return result;
  }

  /**
   * Check test connections
   * Tests can be connected via:
   * 1. Feature's tests/ subdirectory (symlink or actual)
   * 2. Corresponding tests/{feature-name}/ directory
   * 3. Requirements linked in frontmatter → tests/requirements/{req-id}/
   */
  async checkTestConnections(feature) {
    const featurePath = path.join(this.projectRoot, feature.path);
    const result = {
      connected: false,
      testDirs: [],
      symlinks: [],
      requirementTests: []
    };

    // Check for tests/ directory or symlink in feature
    const testsPath = path.join(featurePath, 'tests');
    if (await fs.pathExists(testsPath)) {
      const stat = await fs.lstat(testsPath);
      if (stat.isSymbolicLink()) {
        result.symlinks.push(testsPath);
        result.connected = true;
      } else if (stat.isDirectory()) {
        const files = await fs.readdir(testsPath);
        if (files.length > 0) {
          result.testDirs.push(testsPath);
          result.connected = true;
        }
      }
    }

    // Check for corresponding tests/{feature-name}/ directory
    const testPath = path.join(
      this.projectRoot,
      'tests',
      feature.name.replace(/-/g, '_')
    );
    if (await fs.pathExists(testPath)) {
      result.testDirs.push(testPath);
      result.connected = true;
    }

    // Check if feature has requirements linked, and those requirements have tests
    // This is the primary test connection method in this codebase
    const frontmatter = await this.checkFrontmatter(feature);
    if (frontmatter.data?.requirements) {
      let requirements = frontmatter.data.requirements;
      // Handle YAML array format
      if (typeof requirements === 'string') {
        requirements = requirements
          .replace(/[[\]']/g, '')
          .split(',')
          .map((r) => r.trim());
      }

      for (const reqId of requirements) {
        // Normalize requirement ID format (req-xxx, REQ-xxx, req-infra-070, req-workflow-004, etc.)
        // Extract just the numeric part
        const normalizedId = reqId.toLowerCase();

        // Try multiple formats:
        // 1. Extract numeric suffix (req-workflow-004 -> 004, req-infra-070 -> 070)
        const numericMatch = normalizedId.match(/(\d+)$/);
        if (numericMatch) {
          const numericId = numericMatch[1].padStart(3, '0');
          const reqTestPath = path.join(
            this.projectRoot,
            'tests',
            'requirements',
            `req-${numericId}`
          );

          if (await fs.pathExists(reqTestPath)) {
            result.requirementTests.push(reqTestPath);
            result.connected = true;
            continue;
          }
        }

        // 2. Try exact match after removing 'req-' prefix
        const exactId = normalizedId.replace(/^req-/, '');
        const exactTestPath = path.join(
          this.projectRoot,
          'tests',
          'requirements',
          `req-${exactId}`
        );
        if (await fs.pathExists(exactTestPath)) {
          result.requirementTests.push(exactTestPath);
          result.connected = true;
        }
      }
    }

    return result;
  }

  /**
   * Generate summary message
   */
  generateSummary(results) {
    const complianceRate =
      results.total > 0
        ? Math.round((results.compliant / results.total) * 100)
        : 0;

    return (
      `${results.compliant}/${results.total} features compliant (${complianceRate}%), ` +
      `${results.errors.length} errors, ${results.warnings.length} warnings`
    );
  }

  /**
   * Display results
   */
  display(results, options = {}) {
    if (options.quiet) {
      // Quiet mode: only show summary if there are issues
      if (results.hasIssues) {
        console.log(chalk.yellow('⚠️  Feature Health Issues'));
        console.log(chalk.yellow(`   ${results.summary}`));
        console.log(chalk.blue('   Run: sc health features (for details)'));
      }
      return;
    }

    // Full display
    console.log(chalk.blue('\n🏥 Feature Health Check\n'));
    console.log(chalk.blue('─'.repeat(60)));

    // Summary
    const complianceRate =
      results.total > 0 ? (results.compliant / results.total) * 100 : 0;

    console.log(chalk.white(`Total Features: ${results.total}`));
    console.log(
      complianceRate >= 80
        ? chalk.green(
            `Compliant: ${results.compliant} (${complianceRate.toFixed(0)}%)`
          )
        : chalk.yellow(
            `Compliant: ${results.compliant} (${complianceRate.toFixed(0)}%)`
          )
    );
    console.log(chalk.red(`Errors: ${results.errors.length}`));
    console.log(chalk.yellow(`Warnings: ${results.warnings.length}`));

    // Show errors
    if (results.errors.length > 0) {
      console.log(chalk.red('\n❌ Errors:\n'));
      results.errors.slice(0, 10).forEach((error) => {
        console.log(chalk.red(`   • ${error}`));
      });
      if (results.errors.length > 10) {
        console.log(
          chalk.gray(`   ... and ${results.errors.length - 10} more`)
        );
      }
    }

    // Show warnings
    if (results.warnings.length > 0 && !options.errorsOnly) {
      console.log(chalk.yellow('\n⚠️  Warnings:\n'));
      results.warnings.slice(0, 10).forEach((warning) => {
        console.log(chalk.yellow(`   • ${warning}`));
      });
      if (results.warnings.length > 10) {
        console.log(
          chalk.gray(`   ... and ${results.warnings.length - 10} more`)
        );
      }
    }

    // Recommendations
    console.log(chalk.blue('\n💡 Recommendations:\n'));
    if (results.errors.length > 0) {
      console.log(
        chalk.white(
          '   1. Fix missing frontmatter: sc feature validate --all --fix'
        )
      );
    }
    if (results.warnings.length > 0) {
      console.log(
        chalk.white('   2. Create missing directories per SOP-0.1.18')
      );
      console.log(
        chalk.white('   3. Link tests: sc feature link-tests <feature-name>')
      );
    }
    console.log(
      chalk.white(
        '   4. See full plan: docs/planning/analysis/2025-12-02-feature-cleanup-and-integration-plan.md'
      )
    );

    console.log();
  }

  /**
   * Cache results for fast checks
   */
  async cacheResults(results) {
    try {
      const cache = {
        timestamp: new Date().toISOString(),
        summary: results.summary,
        hasIssues: results.hasIssues,
        complianceRate:
          results.total > 0
            ? Math.round((results.compliant / results.total) * 100)
            : 0
      };

      await fs.ensureDir(path.dirname(this.cacheFile));
      await fs.writeJson(this.cacheFile, cache, { spaces: 2 });
    } catch (_error) {
      // Silent fail on cache write
    }
  }

  /**
   * Get cached results
   */
  async getCachedResults() {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        const cache = await fs.readJson(this.cacheFile);
        const cacheAge = Date.now() - new Date(cache.timestamp).getTime();

        // Cache valid for 1 hour
        if (cacheAge < 3600000) {
          return cache;
        }
      }
    } catch (_error) {
      // Silent fail
    }
    return null;
  }
}

module.exports = FeatureHealthCheck;
