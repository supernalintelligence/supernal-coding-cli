const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const FeatureManager = require('./FeatureManager');

/**
 * FeatureDocumentSync
 *
 * Synchronizes feature registry (.supernal/features.yaml) with
 * feature documentation (docs/features/{domain}/{feature}/).
 *
 * Provides bidirectional sync:
 * - Registry → Docs: Create missing documentation structures
 * - Docs → Registry: Update registry from documentation changes
 */
class FeatureDocumentSync {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.featureManager = new FeatureManager(projectRoot);
    this.featuresDir = path.join(projectRoot, 'docs', 'features');
    this.templatesDir = path.join(
      projectRoot,
      'supernal-code-package',
      'templates'
    );
  }

  /**
   * Valid domains for feature organization
   */
  static VALID_DOMAINS = [
    'ai-workflow-system',
    'developer-tooling',
    'compliance-framework',
    'dashboard-platform',
    'workflow-management',
    'content-management',
    'integrations',
    'admin-operations',
    'documentation-platform'
  ];

  /**
   * Feature subdirectories to create
   */
  static FEATURE_SUBDIRS = [
    'design',
    'planning',
    'requirements',
    'tests',
    'research',
    'implementation'
  ];

  /**
   * Sync registry with documentation
   * @param {object} options - { dryRun, verbose }
   * @returns {object} Sync results
   */
  async sync(options = {}) {
    const results = {
      registryFeatures: [],
      docFeatures: [],
      synced: [],
      created: [],
      updated: [],
      mismatches: [],
      errors: []
    };

    // Load registry features
    const registry = await this.featureManager.loadRegistry();
    results.registryFeatures = registry.features.map((f) => f.name);

    // Scan documentation features
    const docFeatures = await this.scanDocFeatures();
    results.docFeatures = docFeatures.map((f) => f.name);

    // Find mismatches
    const registrySet = new Set(results.registryFeatures);
    const docSet = new Set(results.docFeatures);

    // Features in docs but not in registry
    for (const docFeature of docFeatures) {
      if (!registrySet.has(docFeature.name)) {
        results.mismatches.push({
          type: 'doc-only',
          name: docFeature.name,
          domain: docFeature.domain,
          message: `Feature '${docFeature.name}' exists in docs but not in registry`
        });

        // Auto-add to registry if not dry run
        if (!options.dryRun) {
          try {
            await this.addDocFeatureToRegistry(docFeature);
            results.synced.push(docFeature.name);
          } catch (error) {
            results.errors.push({
              name: docFeature.name,
              error: error.message
            });
          }
        }
      }
    }

    // Features in registry but not in docs
    for (const regFeature of registry.features) {
      if (!docSet.has(regFeature.name)) {
        results.mismatches.push({
          type: 'registry-only',
          name: regFeature.name,
          message: `Feature '${regFeature.name}' exists in registry but not in docs`
        });

        // Note: We don't auto-create docs - that requires domain selection
      }
    }

    // Check for metadata mismatches
    for (const docFeature of docFeatures) {
      const regFeature = registry.features.find(
        (f) => f.name === docFeature.name
      );
      if (regFeature) {
        const mismatches = await this.checkMetadataMismatch(
          docFeature,
          regFeature
        );
        if (mismatches.length > 0) {
          results.mismatches.push({
            type: 'metadata-mismatch',
            name: docFeature.name,
            mismatches
          });
        }
      }
    }

    return results;
  }

  /**
   * Scan docs/features/ for feature documentation
   * @returns {Array} Feature documentation entries
   */
  async scanDocFeatures() {
    const features = [];

    if (!(await fs.pathExists(this.featuresDir))) {
      return features;
    }

    const domains = await fs.readdir(this.featuresDir);

    for (const domain of domains) {
      const domainPath = path.join(this.featuresDir, domain);
      const stat = await fs.stat(domainPath);

      if (!stat.isDirectory() || domain === 'archive' || domain === 'archived')
        continue;

      // Skip non-domain directories
      if (!FeatureDocumentSync.VALID_DOMAINS.includes(domain)) continue;

      const items = await fs.readdir(domainPath);

      for (const item of items) {
        // Skip feature subdirectories
        if (FeatureDocumentSync.FEATURE_SUBDIRS.includes(item)) continue;

        const itemPath = path.join(domainPath, item);
        const itemStat = await fs.stat(itemPath);

        if (!itemStat.isDirectory()) continue;

        const readmePath = path.join(itemPath, 'README.md');
        if (await fs.pathExists(readmePath)) {
          const frontmatter = await this.parseFrontmatter(readmePath);
          features.push({
            name: item,
            domain: domain,
            path: path.relative(this.projectRoot, itemPath),
            readmePath: readmePath,
            frontmatter: frontmatter
          });
        }
      }
    }

    return features;
  }

  /**
   * Parse frontmatter from README.md
   * @param {string} filePath - Path to README.md
   * @returns {object} Frontmatter data
   */
  async parseFrontmatter(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);

      if (!match) return {};

      return yaml.load(match[1]) || {};
    } catch (_error) {
      return {};
    }
  }

  /**
   * Add a doc feature to the registry
   * @param {object} docFeature - Feature from docs scan
   */
  async addDocFeatureToRegistry(docFeature) {
    const fm = docFeature.frontmatter;

    await this.featureManager.addFeature(docFeature.name, {
      description: fm.title || docFeature.name,
      requirements: fm.requirements || [],
      owner: fm.assignee || ''
    });
  }

  /**
   * Check for metadata mismatches between doc and registry
   * @param {object} docFeature - Feature from docs
   * @param {object} regFeature - Feature from registry
   * @returns {Array} List of mismatches
   */
  async checkMetadataMismatch(docFeature, regFeature) {
    const mismatches = [];
    const fm = docFeature.frontmatter;

    // Check requirements
    const docReqs = fm.requirements || [];
    const regReqs = regFeature.requirements || [];

    if (JSON.stringify(docReqs.sort()) !== JSON.stringify(regReqs.sort())) {
      mismatches.push({
        field: 'requirements',
        doc: docReqs,
        registry: regReqs
      });
    }

    // Check owner/assignee
    const docOwner = fm.assignee || fm.owner || '';
    const regOwner = regFeature.owner || '';

    if (docOwner !== regOwner) {
      mismatches.push({
        field: 'owner',
        doc: docOwner,
        registry: regOwner
      });
    }

    return mismatches;
  }

  /**
   * Create feature in BOTH registry and docs
   * @param {string} name - Feature name
   * @param {string} domain - Domain name
   * @param {object} options - { title, epic, priority, phase, owner, requirements }
   */
  async createFeature(name, domain, options = {}) {
    // Validate name
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error(
        'Feature name must be lowercase alphanumeric with hyphens only'
      );
    }

    // Validate domain
    if (!FeatureDocumentSync.VALID_DOMAINS.includes(domain)) {
      throw new Error(
        `Invalid domain '${domain}'. Valid domains: ${FeatureDocumentSync.VALID_DOMAINS.join(', ')}`
      );
    }

    // Check if already exists
    const featurePath = path.join(this.featuresDir, domain, name);
    if (await fs.pathExists(featurePath)) {
      throw new Error(`Feature directory already exists: ${featurePath}`);
    }

    // Create in registry first
    await this.featureManager.addFeature(name, {
      description: options.title || name,
      requirements: options.requirements || [],
      owner: options.owner || ''
    });

    // Create documentation structure
    await this.createFeatureStructure(name, domain, options);

    return {
      name,
      domain,
      path: path.relative(this.projectRoot, featurePath),
      registryPath: this.featureManager.registryPath
    };
  }

  /**
   * Create feature documentation structure
   * @param {string} name - Feature name
   * @param {string} domain - Domain name
   * @param {object} options - Feature options
   */
  async createFeatureStructure(name, domain, options = {}) {
    const featurePath = path.join(this.featuresDir, domain, name);

    // Create main directory
    await fs.ensureDir(featurePath);

    // Create subdirectories
    for (const subdir of FeatureDocumentSync.FEATURE_SUBDIRS) {
      await fs.ensureDir(path.join(featurePath, subdir));
    }

    // Generate README.md from template
    const readmeContent = this.generateReadme(name, domain, options);
    await fs.writeFile(path.join(featurePath, 'README.md'), readmeContent);

    return featurePath;
  }

  /**
   * Generate README.md content
   * @param {string} name - Feature name
   * @param {string} domain - Domain name
   * @param {object} options - Feature options
   */
  generateReadme(name, domain, options = {}) {
    const title = options.title || this.toTitleCase(name);
    const today = new Date().toISOString().split('T')[0];

    const frontmatter = {
      feature_id: name,
      title: title,
      domain: domain,
      phase: options.phase || 'planning',
      status: 'active',
      priority: options.priority || 'medium',
      created: today,
      updated: today,
      epic: options.epic || '',
      requirements: options.requirements || [],
      tests_pending: true
    };

    const yamlFrontmatter = yaml
      .dump(frontmatter, {
        indent: 2,
        quotingType: "'",
        forceQuotes: true
      })
      .trim();

    return `---
${yamlFrontmatter}
---

# ${title}

Brief description of the feature.

## Overview

Detailed overview of what this feature does and why it exists.

## Purpose

Enable:
- Key capability 1
- Key capability 2
- Key capability 3

## Key Features

- **Feature 1**: Description
- **Feature 2**: Description
- **Feature 3**: Description

## Current Status

- ⏳ Planning phase
- ⏳ Requirements definition
- ⏳ Design
- ⏳ Implementation
- ⏳ Testing

## Related

- Epic: ${options.epic || 'TBD'}
- Domain: ${domain}
- Requirements: ${options.requirements?.length ? options.requirements.join(', ') : 'TBD'}

## Next Steps

1. Define requirements
2. Create design documents
3. Implement feature
4. Write tests
5. Document usage

## Documentation

- \`design/\` - Architecture and ADRs
- \`planning/\` - Implementation plans
- \`requirements/\` - Gherkin specs
- \`tests/\` - Test references
- \`research/\` - Research and analysis
- \`implementation/\` - Implementation notes
`;
  }

  /**
   * Convert kebab-case to Title Case
   * @param {string} str - Kebab-case string
   */
  toTitleCase(str) {
    return str
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Display sync results
   * @param {object} results - Sync results
   * @param {object} options - Display options
   */
  displayResults(results, options = {}) {
    console.log(chalk.blue('\n📦 Feature Registry ↔ Documentation Sync\n'));
    console.log(chalk.blue('─'.repeat(60)));

    console.log(
      chalk.white(`Registry Features: ${results.registryFeatures.length}`)
    );
    console.log(
      chalk.white(`Documentation Features: ${results.docFeatures.length}`)
    );

    if (results.synced.length > 0) {
      console.log(chalk.green(`\n✅ Synced: ${results.synced.length}`));
      results.synced.forEach((name) => {
        console.log(chalk.green(`   • ${name}`));
      });
    }

    if (results.mismatches.length > 0) {
      console.log(
        chalk.yellow(`\n⚠️  Mismatches: ${results.mismatches.length}`)
      );
      results.mismatches.forEach((m) => {
        if (m.type === 'doc-only') {
          console.log(
            chalk.yellow(
              `   • ${m.name}: In docs (${m.domain}) but not registry`
            )
          );
        } else if (m.type === 'registry-only') {
          console.log(chalk.yellow(`   • ${m.name}: In registry but no docs`));
        } else if (m.type === 'metadata-mismatch') {
          console.log(chalk.yellow(`   • ${m.name}: Metadata differs`));
          if (options.verbose) {
            m.mismatches.forEach((mm) => {
              console.log(
                chalk.gray(
                  `     ${mm.field}: doc=${JSON.stringify(mm.doc)}, reg=${JSON.stringify(mm.registry)}`
                )
              );
            });
          }
        }
      });
    }

    if (results.errors.length > 0) {
      console.log(chalk.red(`\n❌ Errors: ${results.errors.length}`));
      results.errors.forEach((e) => {
        console.log(chalk.red(`   • ${e.name}: ${e.error}`));
      });
    }

    console.log();
  }
}

module.exports = FeatureDocumentSync;
