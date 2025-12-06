/**
 * Customization Detector - Identifies user modifications to SC templates/rules
 * Used by upgrade and sync systems to preserve user customizations
 */

const fs = require('fs-extra');
const path = require('node:path');
const crypto = require('node:crypto');
const glob = require('glob');

class CustomizationDetector {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.scDir = path.join(projectRoot, '.supernal-coding');
    this.customizationsFile = path.join(this.scDir, 'customizations.json');
    this.verbose = options.verbose || false;
  }

  /**
   * Initialize customization tracking
   */
  async initialize() {
    await fs.ensureDir(this.scDir);

    if (!(await fs.pathExists(this.customizationsFile))) {
      await this.createCustomizationsFile();
    }
  }

  /**
   * Create initial customizations tracking file
   */
  async createCustomizationsFile() {
    const initialData = {
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      trackedFiles: {},
      preservePatterns: [
        '.cursor/rules/custom-*.mdc',
        'templates/custom-*.md',
        '.supernal-coding/*.local.*'
      ]
    };

    await fs.writeJson(this.customizationsFile, initialData, { spaces: 2 });
  }

  /**
   * Load customizations data
   */
  async load() {
    if (!(await fs.pathExists(this.customizationsFile))) {
      await this.initialize();
    }
    return await fs.readJson(this.customizationsFile);
  }

  /**
   * Save customizations data
   */
  async save(data) {
    data.updated = new Date().toISOString();
    await fs.writeJson(this.customizationsFile, data, { spaces: 2 });
  }

  /**
   * Track a file's baseline (original) state
   */
  async trackFile(filePath, originalContent) {
    const data = await this.load();
    const relativePath = path.relative(this.projectRoot, filePath);

    data.trackedFiles[relativePath] = {
      originalHash: this.hashContent(originalContent),
      currentHash: this.hashContent(originalContent),
      modified: false,
      scManaged: true,
      trackedSince: new Date().toISOString()
    };

    await this.save(data);
  }

  /**
   * Update tracking for a file
   */
  async updateTracking(filePath) {
    const data = await this.load();
    const relativePath = path.relative(this.projectRoot, filePath);

    if (!data.trackedFiles[relativePath]) {
      // File not tracked - mark as user-created
      const currentContent = await fs.readFile(filePath, 'utf8');
      data.trackedFiles[relativePath] = {
        originalHash: null,
        currentHash: this.hashContent(currentContent),
        modified: false,
        userCreated: true,
        trackedSince: new Date().toISOString()
      };
    } else {
      // Update current hash
      const currentContent = await fs.readFile(filePath, 'utf8');
      const currentHash = this.hashContent(currentContent);
      const tracking = data.trackedFiles[relativePath];

      tracking.currentHash = currentHash;
      tracking.modified = tracking.originalHash !== currentHash;
    }

    await this.save(data);
  }

  /**
   * Detect all customizations in tracked files
   */
  async detectCustomizations() {
    const data = await this.load();
    const customizations = {
      modified: [],
      userCreated: [],
      untracked: [],
      preserved: []
    };

    // Check tracked files
    for (const [relativePath, tracking] of Object.entries(data.trackedFiles)) {
      const fullPath = path.join(this.projectRoot, relativePath);

      if (!(await fs.pathExists(fullPath))) {
        // File was deleted
        customizations.modified.push({
          path: relativePath,
          type: 'deleted',
          original: true
        });
        continue;
      }

      const currentContent = await fs.readFile(fullPath, 'utf8');
      const currentHash = this.hashContent(currentContent);

      if (tracking.userCreated) {
        customizations.userCreated.push({
          path: relativePath,
          type: 'user-file'
        });
      } else if (tracking.originalHash !== currentHash) {
        customizations.modified.push({
          path: relativePath,
          type: 'modified',
          originalHash: tracking.originalHash,
          currentHash
        });
      }
    }

    // Check for files matching preserve patterns
    for (const pattern of data.preservePatterns) {
      const matches = glob.sync(pattern, { cwd: this.projectRoot });
      matches.forEach((match) => {
        if (!data.trackedFiles[match]) {
          customizations.preserved.push({
            path: match,
            type: 'preserved-pattern',
            pattern
          });
        }
      });
    }

    // Scan for untracked SC files
    const scFiles = await this.findSCFiles();
    scFiles.forEach((file) => {
      const relativePath = path.relative(this.projectRoot, file);
      if (!data.trackedFiles[relativePath]) {
        customizations.untracked.push({
          path: relativePath,
          type: 'untracked'
        });
      }
    });

    return customizations;
  }

  /**
   * Find all SC-managed files
   */
  async findSCFiles() {
    const scPatterns = [
      '.cursor/rules/**/*.mdc',
      'templates/**/*.md',
      'templates/**/*.hbs',
      '.supernal-coding/**/*'
    ];

    const files = [];
    for (const pattern of scPatterns) {
      const matches = glob.sync(pattern, {
        cwd: this.projectRoot,
        absolute: true,
        nodir: true
      });
      files.push(...matches);
    }

    return files;
  }

  /**
   * Check if a file has been customized
   */
  async isCustomized(filePath) {
    const data = await this.load();
    const relativePath = path.relative(this.projectRoot, filePath);
    const tracking = data.trackedFiles[relativePath];

    if (!tracking) {
      // Not tracked - check if matches preserve pattern
      return this.matchesPreservePattern(relativePath, data.preservePatterns);
    }

    if (tracking.userCreated) {
      return true;
    }

    // Check if content changed
    if (!(await fs.pathExists(filePath))) {
      return true; // Deleted = customization
    }

    const currentContent = await fs.readFile(filePath, 'utf8');
    const currentHash = this.hashContent(currentContent);

    return tracking.originalHash !== currentHash;
  }

  /**
   * Check if file matches any preserve pattern
   */
  matchesPreservePattern(filePath, patterns) {
    return patterns.some((pattern) => {
      const matcher = new RegExp(
        `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`
      );
      return matcher.test(filePath);
    });
  }

  /**
   * Get customization info for a file
   */
  async getCustomizationInfo(filePath) {
    const data = await this.load();
    const relativePath = path.relative(this.projectRoot, filePath);
    const tracking = data.trackedFiles[relativePath];

    if (!tracking) {
      return {
        tracked: false,
        customized: this.matchesPreservePattern(
          relativePath,
          data.preservePatterns
        ),
        reason: 'untracked'
      };
    }

    const isCustomized = await this.isCustomized(filePath);

    return {
      tracked: true,
      customized: isCustomized,
      userCreated: tracking.userCreated || false,
      modified: tracking.modified || false,
      originalHash: tracking.originalHash,
      currentHash: tracking.currentHash,
      trackedSince: tracking.trackedSince
    };
  }

  /**
   * Generate customization report
   */
  async generateReport() {
    const customizations = await this.detectCustomizations();

    const report = {
      summary: {
        totalModified: customizations.modified.length,
        totalUserCreated: customizations.userCreated.length,
        totalPreserved: customizations.preserved.length,
        totalUntracked: customizations.untracked.length
      },
      details: customizations,
      recommendations: []
    };

    // Add recommendations
    if (customizations.modified.length > 0) {
      report.recommendations.push({
        type: 'warning',
        message: `${customizations.modified.length} tracked files have been modified. These customizations will be preserved during upgrade.`
      });
    }

    if (customizations.untracked.length > 0) {
      report.recommendations.push({
        type: 'info',
        message: `${customizations.untracked.length} SC files are not being tracked. Run 'sc upgrade sync-tracking' to track them.`
      });
    }

    return report;
  }

  /**
   * Hash content for comparison
   */
  hashContent(content) {
    if (!content) return null;

    // Normalize line endings for consistent hashing
    const normalized = content.replace(/\r\n/g, '\n');

    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Sync tracking with current state
   */
  async syncTracking() {
    const scFiles = await this.findSCFiles();
    let tracked = 0;
    let updated = 0;

    for (const file of scFiles) {
      const relativePath = path.relative(this.projectRoot, file);
      const data = await this.load();

      if (!data.trackedFiles[relativePath]) {
        // Start tracking this file
        const content = await fs.readFile(file, 'utf8');
        await this.trackFile(file, content);
        tracked++;
      } else {
        // Update existing tracking
        await this.updateTracking(file);
        updated++;
      }
    }

    return { tracked, updated };
  }

  /**
   * Mark file as SC-managed (original)
   */
  async markAsOriginal(filePath) {
    const data = await this.load();
    const relativePath = path.relative(this.projectRoot, filePath);
    const content = await fs.readFile(filePath, 'utf8');
    const hash = this.hashContent(content);

    data.trackedFiles[relativePath] = {
      originalHash: hash,
      currentHash: hash,
      modified: false,
      scManaged: true,
      trackedSince: new Date().toISOString()
    };

    await this.save(data);
  }

  /**
   * Add preserve pattern
   */
  async addPreservePattern(pattern) {
    const data = await this.load();
    if (!data.preservePatterns.includes(pattern)) {
      data.preservePatterns.push(pattern);
      await this.save(data);
    }
  }
}

module.exports = CustomizationDetector;
