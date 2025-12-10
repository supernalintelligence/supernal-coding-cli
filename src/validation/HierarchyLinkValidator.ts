// @ts-nocheck
/**
 * HierarchyLinkValidator - Cross-entity validation for project hierarchy
 *
 * Validates that all items in the hierarchy are properly linked:
 *   - Milestones → Epics → Features → Requirements → Tasks
 *
 * Rules:
 *   1. Features MUST link to at least one epic (epic field required)
 *   2. Requirements MUST link to feature(s) OR epic (if cross-feature)
 *   3. Referenced epics must exist
 *   4. Referenced features must exist
 *   5. Referenced milestones must exist
 */

const path = require('node:path');
const fs = require('node:fs').promises;
const yaml = require('yaml');

class HierarchyLinkValidator {
  cache: any;
  projectRoot: any;
  verbose: any;
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.verbose = options.verbose || false;

    // Cache for loaded entities
    this.cache = {
      milestones: null,
      epics: null,
      features: null,
      requirements: null
    };
  }

  /**
   * Load all milestones from docs/planning/roadmap/milestones/
   */
  async loadMilestones() {
    if (this.cache.milestones) return this.cache.milestones;

    const milestones = new Map();
    const milestonesDir = path.join(
      this.projectRoot,
      'docs',
      'planning',
      'roadmap',
      'milestones'
    );

    try {
      const files = await fs.readdir(milestonesDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(milestonesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const fm = this.parseFrontmatter(content);
        if (fm?.id) {
          milestones.set(fm.id, { ...fm, filePath, fileName: file });
        }
      }
    } catch {
      // Directory might not exist
    }

    // Also check root roadmap dir for milestone files
    const roadmapDir = path.join(
      this.projectRoot,
      'docs',
      'planning',
      'roadmap'
    );
    try {
      const files = await fs.readdir(roadmapDir);
      for (const file of files) {
        if (!file.startsWith('mile-') || !file.endsWith('.md')) continue;
        const filePath = path.join(roadmapDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const fm = this.parseFrontmatter(content);
        if (fm?.id && !milestones.has(fm.id)) {
          milestones.set(fm.id, { ...fm, filePath, fileName: file });
        }
      }
    } catch {
      // Directory might not exist
    }

    this.cache.milestones = milestones;
    return milestones;
  }

  /**
   * Load all epics from docs/planning/epics/
   */
  async loadEpics() {
    if (this.cache.epics) return this.cache.epics;

    const epics = new Map();
    const epicsDir = path.join(this.projectRoot, 'docs', 'planning', 'epics');

    try {
      const files = await fs.readdir(epicsDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(epicsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const fm = this.parseFrontmatter(content);
        if (fm?.id) {
          epics.set(fm.id, { ...fm, filePath, fileName: file });
          // Also index by lowercase and alternative formats
          epics.set(fm.id.toLowerCase(), { ...fm, filePath, fileName: file });
        }
      }
    } catch {
      // Directory might not exist
    }

    this.cache.epics = epics;
    return epics;
  }

  /**
   * Load all features from docs/features/
   */
  async loadFeatures() {
    if (this.cache.features) return this.cache.features;

    const features = new Map();
    const featuresDir = path.join(this.projectRoot, 'docs', 'features');

    await this.scanFeaturesRecursively(featuresDir, features, '');

    this.cache.features = features;
    return features;
  }

  /**
   * Recursively scan features directory
   */
  async scanFeaturesRecursively(dir, features, relativePath) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
        // Skip documentation-only directories that aren't features
        if (
          [
            'archived',
            'archive',
            'planning',
            'design',
            'docs',
            'requirements'
          ].includes(entry.name)
        )
          continue;

        const entryPath = path.join(dir, entry.name);
        const readmePath = path.join(entryPath, 'README.md');
        const featurePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        try {
          const content = await fs.readFile(readmePath, 'utf-8');
          const fm = this.parseFrontmatter(content);
          const featureId = fm?.feature_id || entry.name;

          features.set(featureId, {
            ...fm,
            featureId,
            path: entryPath,
            relativePath: featurePath,
            fileName: 'README.md'
          });

          // Also index by path
          features.set(featurePath, {
            ...fm,
            featureId,
            path: entryPath,
            relativePath: featurePath,
            fileName: 'README.md'
          });
        } catch {
          // No README, might be a grouping folder
        }

        // Recurse
        await this.scanFeaturesRecursively(entryPath, features, featurePath);
      }
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Load all requirements from docs/requirements/
   */
  async loadRequirements() {
    if (this.cache.requirements) return this.cache.requirements;

    const requirements = new Map();
    const requirementsDir = path.join(this.projectRoot, 'docs', 'requirements');

    await this.scanRequirementsRecursively(requirementsDir, requirements);

    this.cache.requirements = requirements;
    return requirements;
  }

  /**
   * Recursively scan requirements directory
   */
  async scanRequirementsRecursively(dir, requirements) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.scanRequirementsRecursively(
            path.join(dir, entry.name),
            requirements
          );
        } else if (entry.name.endsWith('.md')) {
          const filePath = path.join(dir, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const fm = this.parseFrontmatter(content);
          if (fm?.id) {
            requirements.set(fm.id, { ...fm, filePath, fileName: entry.name });
            // Also index by lowercase
            requirements.set(fm.id.toLowerCase(), {
              ...fm,
              filePath,
              fileName: entry.name
            });
          }
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Parse YAML frontmatter from markdown content
   */
  parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    try {
      return yaml.parse(match[1]) || {};
    } catch {
      return null;
    }
  }

  /**
   * Validate all hierarchy links
   * Returns detailed report of issues
   */
  async validateAll() {
    const issues = {
      features: [],
      requirements: [],
      epics: [],
      orphaned: []
    };

    const stats = {
      featuresTotal: 0,
      featuresLinked: 0,
      featuresOrphaned: 0,
      requirementsTotal: 0,
      requirementsLinked: 0,
      requirementsOrphaned: 0,
      epicsTotal: 0,
      epicsLinked: 0,
      epicsOrphaned: 0
    };

    // Load all entities
    const [milestones, epics, features, requirements] = await Promise.all([
      this.loadMilestones(),
      this.loadEpics(),
      this.loadFeatures(),
      this.loadRequirements()
    ]);

    // Validate Features → Epic linkage
    for (const [featureId, feature] of features) {
      // Skip duplicate path entries
      if (featureId.includes('/') && features.has(feature.featureId)) {
        continue;
      }

      stats.featuresTotal++;

      if (!feature.epic) {
        stats.featuresOrphaned++;
        issues.features.push({
          type: 'missing_epic',
          severity: 'error',
          featureId: feature.featureId,
          path: feature.relativePath,
          message: `Feature '${feature.featureId}' is not linked to any epic. Add 'epic: EPIC-XXX' to frontmatter.`
        });
      } else {
        // Check if referenced epic exists
        const epicExists =
          epics.has(feature.epic) ||
          epics.has(feature.epic.toLowerCase()) ||
          epics.has(feature.epic.toUpperCase());

        if (!epicExists) {
          issues.features.push({
            type: 'invalid_epic_ref',
            severity: 'warning',
            featureId: feature.featureId,
            path: feature.relativePath,
            referencedEpic: feature.epic,
            message: `Feature '${feature.featureId}' references non-existent epic '${feature.epic}'.`
          });
        } else {
          stats.featuresLinked++;
        }
      }
    }

    // Validate Requirements → Feature/Epic linkage
    for (const [reqId, req] of requirements) {
      // Skip lowercase duplicates
      if (reqId !== req.id) continue;

      stats.requirementsTotal++;

      const hasFeatureLink = req.feature && req.feature.length > 0;
      const hasEpicLink = req.epic && req.epic.length > 0;

      if (!hasFeatureLink && !hasEpicLink) {
        stats.requirementsOrphaned++;
        issues.requirements.push({
          type: 'unlinked',
          severity: 'error',
          reqId: req.id,
          filePath: req.filePath,
          message: `Requirement '${req.id}' is not linked to any feature or epic. Add 'feature: feature-id' or 'epic: EPIC-XXX' to frontmatter.`
        });
      } else {
        // Validate feature reference if present
        if (hasFeatureLink) {
          const featureRef = Array.isArray(req.feature)
            ? req.feature[0]
            : req.feature;
          const featureExists =
            features.has(featureRef) ||
            features.has(featureRef.toLowerCase()) ||
            Array.from(features.values()).some(
              (f) =>
                f.featureId === featureRef ||
                f.relativePath === featureRef ||
                f.relativePath?.endsWith(featureRef)
            );

          if (!featureExists) {
            issues.requirements.push({
              type: 'invalid_feature_ref',
              severity: 'warning',
              reqId: req.id,
              filePath: req.filePath,
              referencedFeature: featureRef,
              message: `Requirement '${req.id}' references non-existent feature '${featureRef}'.`
            });
          } else {
            stats.requirementsLinked++;
          }
        } else if (hasEpicLink) {
          // Validate epic reference
          const epicRef = Array.isArray(req.epic) ? req.epic[0] : req.epic;
          const epicExists =
            epics.has(epicRef) ||
            epics.has(epicRef.toLowerCase()) ||
            epics.has(epicRef.toUpperCase());

          if (!epicExists) {
            issues.requirements.push({
              type: 'invalid_epic_ref',
              severity: 'warning',
              reqId: req.id,
              filePath: req.filePath,
              referencedEpic: epicRef,
              message: `Requirement '${req.id}' references non-existent epic '${epicRef}'.`
            });
          } else {
            stats.requirementsLinked++;
          }
        }
      }
    }

    // Validate Epics → Milestone linkage
    for (const [epicId, epic] of epics) {
      // Skip lowercase duplicates
      if (epicId !== epic.id) continue;

      stats.epicsTotal++;

      if (!epic.milestone) {
        stats.epicsOrphaned++;
        issues.epics.push({
          type: 'missing_milestone',
          severity: 'warning',
          epicId: epic.id,
          filePath: epic.filePath,
          message: `Epic '${epic.id}' is not linked to any milestone. Add 'milestone: MILE-XXX' to frontmatter.`
        });
      } else {
        // Check if referenced milestone exists
        const milestoneExists =
          milestones.has(epic.milestone) ||
          milestones.has(epic.milestone.toLowerCase()) ||
          milestones.has(epic.milestone.toUpperCase());

        if (!milestoneExists) {
          issues.epics.push({
            type: 'invalid_milestone_ref',
            severity: 'warning',
            epicId: epic.id,
            filePath: epic.filePath,
            referencedMilestone: epic.milestone,
            message: `Epic '${epic.id}' references non-existent milestone '${epic.milestone}'.`
          });
        } else {
          stats.epicsLinked++;
        }
      }
    }

    // Count orphaned items
    issues.orphaned = [
      ...issues.features.filter((i) => i.type === 'missing_epic'),
      ...issues.requirements.filter((i) => i.type === 'unlinked'),
      ...issues.epics.filter((i) => i.type === 'missing_milestone')
    ];

    return {
      valid:
        issues.features.filter((i) => i.severity === 'error').length === 0 &&
        issues.requirements.filter((i) => i.severity === 'error').length === 0,
      issues,
      stats,
      summary: {
        totalIssues:
          issues.features.length +
          issues.requirements.length +
          issues.epics.length,
        errors:
          issues.features.filter((i) => i.severity === 'error').length +
          issues.requirements.filter((i) => i.severity === 'error').length,
        warnings:
          issues.features.filter((i) => i.severity === 'warning').length +
          issues.requirements.filter((i) => i.severity === 'warning').length +
          issues.epics.filter((i) => i.severity === 'warning').length,
        orphanedCount: issues.orphaned.length
      }
    };
  }

  /**
   * Validate a single feature
   */
  async validateFeature(featurePath) {
    const [epics] = await Promise.all([this.loadEpics()]);
    const issues = [];

    const readmePath = path.join(featurePath, 'README.md');
    try {
      const content = await fs.readFile(readmePath, 'utf-8');
      const fm = this.parseFrontmatter(content);

      if (!fm) {
        issues.push({
          type: 'missing_frontmatter',
          severity: 'error',
          message: 'Feature is missing frontmatter.'
        });
        return { valid: false, issues };
      }

      if (!fm.epic) {
        issues.push({
          type: 'missing_epic',
          severity: 'error',
          message:
            "Feature is not linked to any epic. Add 'epic: EPIC-XXX' to frontmatter."
        });
      } else {
        const epicExists =
          epics.has(fm.epic) ||
          epics.has(fm.epic.toLowerCase()) ||
          epics.has(fm.epic.toUpperCase());

        if (!epicExists) {
          issues.push({
            type: 'invalid_epic_ref',
            severity: 'warning',
            referencedEpic: fm.epic,
            message: `Referenced epic '${fm.epic}' does not exist.`
          });
        }
      }
    } catch (error) {
      issues.push({
        type: 'read_error',
        severity: 'error',
        message: `Failed to read feature: ${error.message}`
      });
    }

    return {
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues
    };
  }

  /**
   * Validate a single requirement
   */
  async validateRequirement(reqFilePath) {
    const [epics, features] = await Promise.all([
      this.loadEpics(),
      this.loadFeatures()
    ]);
    const issues = [];

    try {
      const content = await fs.readFile(reqFilePath, 'utf-8');
      const fm = this.parseFrontmatter(content);

      if (!fm) {
        issues.push({
          type: 'missing_frontmatter',
          severity: 'error',
          message: 'Requirement is missing frontmatter.'
        });
        return { valid: false, issues };
      }

      const hasFeatureLink = fm.feature && fm.feature.length > 0;
      const hasEpicLink = fm.epic && fm.epic.length > 0;

      if (!hasFeatureLink && !hasEpicLink) {
        issues.push({
          type: 'unlinked',
          severity: 'error',
          message:
            "Requirement is not linked to any feature or epic. Add 'feature: feature-id' or 'epic: EPIC-XXX' to frontmatter."
        });
      } else {
        if (hasFeatureLink) {
          const featureRef = Array.isArray(fm.feature)
            ? fm.feature[0]
            : fm.feature;
          const featureExists =
            features.has(featureRef) ||
            Array.from(features.values()).some(
              (f) =>
                f.featureId === featureRef ||
                f.relativePath === featureRef ||
                f.relativePath?.endsWith(featureRef)
            );

          if (!featureExists) {
            issues.push({
              type: 'invalid_feature_ref',
              severity: 'warning',
              referencedFeature: featureRef,
              message: `Referenced feature '${featureRef}' does not exist.`
            });
          }
        }

        if (hasEpicLink) {
          const epicRef = Array.isArray(fm.epic) ? fm.epic[0] : fm.epic;
          const epicExists =
            epics.has(epicRef) ||
            epics.has(epicRef.toLowerCase()) ||
            epics.has(epicRef.toUpperCase());

          if (!epicExists) {
            issues.push({
              type: 'invalid_epic_ref',
              severity: 'warning',
              referencedEpic: epicRef,
              message: `Referenced epic '${epicRef}' does not exist.`
            });
          }
        }
      }
    } catch (error) {
      issues.push({
        type: 'read_error',
        severity: 'error',
        message: `Failed to read requirement: ${error.message}`
      });
    }

    return {
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues
    };
  }

  /**
   * Format validation results for console output
   */
  formatResults(results) {
    const lines = [];

    if (results.valid) {
      lines.push('✅ All hierarchy links are valid!');
    } else {
      lines.push('❌ Hierarchy link validation found issues:');
    }

    lines.push('');
    lines.push('📊 Statistics:');
    lines.push(
      `   Features: ${results.stats.featuresLinked}/${results.stats.featuresTotal} linked (${results.stats.featuresOrphaned} orphaned)`
    );
    lines.push(
      `   Requirements: ${results.stats.requirementsLinked}/${results.stats.requirementsTotal} linked (${results.stats.requirementsOrphaned} orphaned)`
    );
    lines.push(
      `   Epics: ${results.stats.epicsLinked}/${results.stats.epicsTotal} linked (${results.stats.epicsOrphaned} orphaned)`
    );

    if (results.summary.totalIssues > 0) {
      lines.push('');
      lines.push(
        `⚠️  Total Issues: ${results.summary.totalIssues} (${results.summary.errors} errors, ${results.summary.warnings} warnings)`
      );

      if (results.issues.features.length > 0) {
        lines.push('');
        lines.push('📦 Feature Issues:');
        for (const issue of results.issues.features.slice(0, 10)) {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          lines.push(`   ${icon} ${issue.message}`);
        }
        if (results.issues.features.length > 10) {
          lines.push(`   ... and ${results.issues.features.length - 10} more`);
        }
      }

      if (results.issues.requirements.length > 0) {
        lines.push('');
        lines.push('📄 Requirement Issues:');
        for (const issue of results.issues.requirements.slice(0, 10)) {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          lines.push(`   ${icon} ${issue.message}`);
        }
        if (results.issues.requirements.length > 10) {
          lines.push(
            `   ... and ${results.issues.requirements.length - 10} more`
          );
        }
      }

      if (results.issues.epics.length > 0) {
        lines.push('');
        lines.push('🎯 Epic Issues:');
        for (const issue of results.issues.epics.slice(0, 10)) {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          lines.push(`   ${icon} ${issue.message}`);
        }
        if (results.issues.epics.length > 10) {
          lines.push(`   ... and ${results.issues.epics.length - 10} more`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Clear the entity cache
   */
  clearCache() {
    this.cache = {
      milestones: null,
      epics: null,
      features: null,
      requirements: null
    };
  }

  /**
   * Suggest appropriate links based on content analysis
   * Returns a list of suggestions that can be applied
   */
  async suggestLinks() {
    const [epics, features, requirements] = await Promise.all([
      this.loadEpics(),
      this.loadFeatures(),
      this.loadRequirements()
    ]);

    const suggestions = {
      features: [],
      requirements: []
    };

    // Build epic keyword map for matching
    const epicKeywords = new Map();
    for (const [epicId, epic] of epics) {
      if (epicId !== epic.id) continue; // Skip lowercase duplicates
      const keywords = this.extractKeywords(epic.title, epic.description);
      epicKeywords.set(epicId, { epic, keywords });
    }

    // Build feature keyword map
    const featureKeywords = new Map();
    for (const [featureId, feature] of features) {
      if (featureId.includes('/') && features.has(feature.featureId)) continue;
      const keywords = this.extractKeywords(feature.title, feature.description);
      featureKeywords.set(feature.featureId, { feature, keywords });
    }

    // Suggest epics for features without epic
    for (const [featureId, feature] of features) {
      if (featureId.includes('/') && features.has(feature.featureId)) continue;
      if (feature.epic) continue; // Already has epic

      const match = this.findBestEpicMatch(feature, epicKeywords);
      if (match) {
        suggestions.features.push({
          featureId: feature.featureId,
          path: feature.path,
          relativePath: feature.relativePath,
          currentEpic: null,
          suggestedEpic: match.epicId,
          confidence: match.confidence,
          reason: match.reason
        });
      }
    }

    // Suggest features/epics for requirements without links
    for (const [reqId, req] of requirements) {
      if (reqId !== req.id) continue;
      const hasFeature = req.feature && req.feature.length > 0;
      const hasEpic = req.epic && req.epic.length > 0;

      if (hasFeature || hasEpic) continue; // Already linked

      // Try to find matching feature first
      const featureMatch = this.findBestFeatureMatch(req, featureKeywords);
      if (featureMatch && featureMatch.confidence > 0.5) {
        suggestions.requirements.push({
          reqId: req.id,
          filePath: req.filePath,
          currentFeature: null,
          currentEpic: null,
          suggestedFeature: featureMatch.featureId,
          suggestedEpic: null,
          confidence: featureMatch.confidence,
          reason: featureMatch.reason
        });
      } else {
        // Fall back to epic match
        const epicMatch = this.findBestEpicMatchForReq(req, epicKeywords);
        if (epicMatch) {
          suggestions.requirements.push({
            reqId: req.id,
            filePath: req.filePath,
            currentFeature: null,
            currentEpic: null,
            suggestedFeature: null,
            suggestedEpic: epicMatch.epicId,
            confidence: epicMatch.confidence,
            reason: epicMatch.reason
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Extract keywords from title and description
   */
  extractKeywords(title, description) {
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'this',
      'that',
      'these',
      'those',
      'it'
    ]);

    return text
      .split(/[\s\-_.,;:!?()[\]{}'"]+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
  }

  /**
   * Find best matching epic for a feature based on keywords and path
   */
  findBestEpicMatch(feature, epicKeywords) {
    const featureWords = this.extractKeywords(
      feature.title,
      feature.relativePath
    );
    let bestMatch = null;
    let bestScore = 0;

    for (const [epicId, { epic, keywords }] of epicKeywords) {
      let score = 0;
      const matchedWords = [];

      // Check keyword overlap
      for (const word of Object.keys(featureWords)) {
        if (keywords[word]) {
          score += featureWords[word] * keywords[word];
          matchedWords.push(word);
        }
      }

      // Boost for domain/category matches
      if (feature.domain && epic.category) {
        const domainMap = {
          'dashboard-platform': ['product', 'dashboard'],
          'developer-tooling': ['infrastructure', 'tooling'],
          'workflow-management': ['workflow', 'operations'],
          'compliance-framework': ['compliance', 'business'],
          'ai-workflow-system': ['product', 'ai']
        };

        const domainCategories = domainMap[feature.domain] || [];
        if (domainCategories.includes(epic.category)) {
          score += 3;
        }
      }

      if (score > bestScore && score >= 2) {
        bestScore = score;
        bestMatch = {
          epicId,
          confidence: Math.min(score / 10, 1),
          reason: `Matched keywords: ${matchedWords.slice(0, 5).join(', ')}`
        };
      }
    }

    return bestMatch;
  }

  /**
   * Find best matching feature for a requirement
   */
  findBestFeatureMatch(req, featureKeywords) {
    const reqWords = this.extractKeywords(req.title, req.category);
    let bestMatch = null;
    let bestScore = 0;

    for (const [featureId, { feature, keywords }] of featureKeywords) {
      let score = 0;
      const matchedWords = [];

      for (const word of Object.keys(reqWords)) {
        if (keywords[word]) {
          score += reqWords[word] * keywords[word];
          matchedWords.push(word);
        }
      }

      // Boost for category matches
      if (req.category && feature.domain) {
        const categoryDomainMap = {
          core: ['dashboard-platform', 'ai-workflow-system'],
          workflow: ['workflow-management', 'developer-tooling'],
          compliance: ['compliance-framework'],
          infrastructure: ['developer-tooling', 'integrations'],
          testing: ['developer-tooling']
        };

        const domains = categoryDomainMap[req.category] || [];
        if (domains.includes(feature.domain)) {
          score += 2;
        }
      }

      if (score > bestScore && score >= 2) {
        bestScore = score;
        bestMatch = {
          featureId,
          confidence: Math.min(score / 8, 1),
          reason: `Matched keywords: ${matchedWords.slice(0, 5).join(', ')}`
        };
      }
    }

    return bestMatch;
  }

  /**
   * Find best matching epic for a requirement (fallback)
   */
  findBestEpicMatchForReq(req, epicKeywords) {
    const reqWords = this.extractKeywords(req.title, req.category);
    let bestMatch = null;
    let bestScore = 0;

    for (const [epicId, { epic, keywords }] of epicKeywords) {
      let score = 0;
      const matchedWords = [];

      for (const word of Object.keys(reqWords)) {
        if (keywords[word]) {
          score += reqWords[word] * keywords[word];
          matchedWords.push(word);
        }
      }

      if (score > bestScore && score >= 1) {
        bestScore = score;
        bestMatch = {
          epicId,
          confidence: Math.min(score / 6, 1),
          reason: `Matched keywords: ${matchedWords.slice(0, 5).join(', ')}`
        };
      }
    }

    return bestMatch;
  }

  /**
   * Apply suggested links to files
   * @param {Object} suggestions - Suggestions from suggestLinks()
   * @param {Object} options - { dryRun: boolean, minConfidence: number }
   * @returns {Object} - Results of applying changes
   */
  async applyLinks(suggestions, options = {}) {
    const { dryRun = false, minConfidence = 0.3 } = options;
    const results = {
      applied: [],
      skipped: [],
      failed: []
    };

    // Apply feature suggestions
    for (const suggestion of suggestions.features) {
      if (suggestion.confidence < minConfidence) {
        results.skipped.push({
          type: 'feature',
          id: suggestion.featureId,
          reason: `Confidence ${(suggestion.confidence * 100).toFixed(0)}% below threshold`
        });
        continue;
      }

      try {
        const readmePath = path.join(suggestion.path, 'README.md');
        if (dryRun) {
          results.applied.push({
            type: 'feature',
            id: suggestion.featureId,
            field: 'epic',
            value: suggestion.suggestedEpic,
            confidence: suggestion.confidence,
            dryRun: true
          });
        } else {
          await this.updateFrontmatter(readmePath, {
            epic: suggestion.suggestedEpic
          });
          results.applied.push({
            type: 'feature',
            id: suggestion.featureId,
            field: 'epic',
            value: suggestion.suggestedEpic,
            confidence: suggestion.confidence
          });
        }
      } catch (error) {
        results.failed.push({
          type: 'feature',
          id: suggestion.featureId,
          error: error.message
        });
      }
    }

    // Apply requirement suggestions
    for (const suggestion of suggestions.requirements) {
      if (suggestion.confidence < minConfidence) {
        results.skipped.push({
          type: 'requirement',
          id: suggestion.reqId,
          reason: `Confidence ${(suggestion.confidence * 100).toFixed(0)}% below threshold`
        });
        continue;
      }

      try {
        const updates = {};
        if (suggestion.suggestedFeature) {
          updates.feature = suggestion.suggestedFeature;
        } else if (suggestion.suggestedEpic) {
          updates.epic = suggestion.suggestedEpic;
        }

        if (Object.keys(updates).length === 0) {
          results.skipped.push({
            type: 'requirement',
            id: suggestion.reqId,
            reason: 'No suggestion available'
          });
          continue;
        }

        if (dryRun) {
          results.applied.push({
            type: 'requirement',
            id: suggestion.reqId,
            field: Object.keys(updates)[0],
            value: Object.values(updates)[0],
            confidence: suggestion.confidence,
            dryRun: true
          });
        } else {
          await this.updateFrontmatter(suggestion.filePath, updates);
          results.applied.push({
            type: 'requirement',
            id: suggestion.reqId,
            field: Object.keys(updates)[0],
            value: Object.values(updates)[0],
            confidence: suggestion.confidence
          });
        }
      } catch (error) {
        results.failed.push({
          type: 'requirement',
          id: suggestion.reqId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Safely update frontmatter in a file
   */
  async updateFrontmatter(filePath, updates) {
    const content = await fs.readFile(filePath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!fmMatch) {
      throw new Error('No frontmatter found');
    }

    let frontmatter;
    try {
      frontmatter = yaml.parse(fmMatch[1]) || {};
    } catch {
      throw new Error('Failed to parse frontmatter');
    }

    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      frontmatter[key] = value;
    }

    // Update the updated timestamp
    frontmatter.updated = new Date().toISOString().split('T')[0];

    // Rebuild content
    const newFrontmatter = yaml.stringify(frontmatter);
    const body = content.slice(fmMatch[0].length);
    const newContent = `---\n${newFrontmatter}---${body}`;

    await fs.writeFile(filePath, newContent, 'utf-8');
  }

  /**
   * Format suggestions for display
   */
  formatSuggestions(suggestions) {
    const lines = [];

    if (
      suggestions.features.length === 0 &&
      suggestions.requirements.length === 0
    ) {
      lines.push('✅ No suggestions needed - all items are linked!');
      return lines.join('\n');
    }

    lines.push('📋 Suggested Links\n');

    if (suggestions.features.length > 0) {
      lines.push('📦 Feature → Epic Suggestions:');
      for (const s of suggestions.features) {
        const confidence = (s.confidence * 100).toFixed(0);
        lines.push(
          `   ${s.featureId} → ${s.suggestedEpic} (${confidence}% confidence)`
        );
        lines.push(`      Reason: ${s.reason}`);
      }
      lines.push('');
    }

    if (suggestions.requirements.length > 0) {
      lines.push('📄 Requirement → Feature/Epic Suggestions:');
      for (const s of suggestions.requirements) {
        const confidence = (s.confidence * 100).toFixed(0);
        const target = s.suggestedFeature || s.suggestedEpic;
        const linkType = s.suggestedFeature ? 'feature' : 'epic';
        lines.push(
          `   ${s.reqId} → ${target} (${linkType}, ${confidence}% confidence)`
        );
        lines.push(`      Reason: ${s.reason}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format apply results for display
   */
  formatApplyResults(results) {
    const lines = [];

    if (results.applied.length > 0) {
      const dryRunLabel = results.applied[0]?.dryRun ? ' (dry run)' : '';
      lines.push(`✅ Applied${dryRunLabel}: ${results.applied.length} changes`);
      for (const r of results.applied.slice(0, 10)) {
        lines.push(`   ${r.type}: ${r.id} → ${r.field}=${r.value}`);
      }
      if (results.applied.length > 10) {
        lines.push(`   ... and ${results.applied.length - 10} more`);
      }
    }

    if (results.skipped.length > 0) {
      lines.push(`\n⏭️  Skipped: ${results.skipped.length} items`);
      for (const r of results.skipped.slice(0, 5)) {
        lines.push(`   ${r.type}: ${r.id} - ${r.reason}`);
      }
      if (results.skipped.length > 5) {
        lines.push(`   ... and ${results.skipped.length - 5} more`);
      }
    }

    if (results.failed.length > 0) {
      lines.push(`\n❌ Failed: ${results.failed.length} items`);
      for (const r of results.failed) {
        lines.push(`   ${r.type}: ${r.id} - ${r.error}`);
      }
    }

    return lines.join('\n');
  }
}

module.exports = HierarchyLinkValidator;
