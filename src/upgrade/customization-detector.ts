/**
 * Customization Detector - Identifies user modifications to SC templates/rules
 * Used by upgrade and sync systems to preserve user customizations
 */

import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import { glob } from 'glob';

interface CustomizationTracking {
  originalHash: string | null;
  currentHash: string | null;
  modified: boolean;
  scManaged?: boolean;
  userCreated?: boolean;
  trackedSince: string;
}

interface CustomizationsData {
  version: string;
  created: string;
  updated: string;
  trackedFiles: Record<string, CustomizationTracking>;
  preservePatterns: string[];
}

interface Customization {
  path: string;
  type: string;
  original?: boolean;
  originalHash?: string | null;
  currentHash?: string | null;
  pattern?: string;
}

interface Customizations {
  modified: Customization[];
  userCreated: Customization[];
  untracked: Customization[];
  preserved: Customization[];
}

interface CustomizationInfo {
  tracked: boolean;
  customized: boolean;
  reason?: string;
  userCreated?: boolean;
  modified?: boolean;
  originalHash?: string | null;
  currentHash?: string | null;
  trackedSince?: string;
}

interface CustomizationReport {
  summary: {
    totalModified: number;
    totalUserCreated: number;
    totalPreserved: number;
    totalUntracked: number;
  };
  details: Customizations;
  recommendations: Array<{
    type: string;
    message: string;
  }>;
}

interface CustomizationDetectorOptions {
  verbose?: boolean;
}

class CustomizationDetector {
  protected customizationsFile: string;
  protected projectRoot: string;
  protected scDir: string;
  protected verbose: boolean;

  constructor(projectRoot: string, options: CustomizationDetectorOptions = {}) {
    this.projectRoot = projectRoot;
    this.scDir = path.join(projectRoot, '.supernal-coding');
    this.customizationsFile = path.join(this.scDir, 'customizations.json');
    this.verbose = options.verbose || false;
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(this.scDir);

    if (!(await fs.pathExists(this.customizationsFile))) {
      await this.createCustomizationsFile();
    }
  }

  async createCustomizationsFile(): Promise<void> {
    const initialData: CustomizationsData = {
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

  async load(): Promise<CustomizationsData> {
    if (!(await fs.pathExists(this.customizationsFile))) {
      await this.initialize();
    }
    return await fs.readJson(this.customizationsFile);
  }

  async save(data: CustomizationsData): Promise<void> {
    data.updated = new Date().toISOString();
    await fs.writeJson(this.customizationsFile, data, { spaces: 2 });
  }

  async trackFile(filePath: string, originalContent: string): Promise<void> {
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

  async updateTracking(filePath: string): Promise<void> {
    const data = await this.load();
    const relativePath = path.relative(this.projectRoot, filePath);

    if (!data.trackedFiles[relativePath]) {
      const currentContent = await fs.readFile(filePath, 'utf8');
      data.trackedFiles[relativePath] = {
        originalHash: null,
        currentHash: this.hashContent(currentContent),
        modified: false,
        userCreated: true,
        trackedSince: new Date().toISOString()
      };
    } else {
      const currentContent = await fs.readFile(filePath, 'utf8');
      const currentHash = this.hashContent(currentContent);
      const tracking = data.trackedFiles[relativePath];

      tracking.currentHash = currentHash;
      tracking.modified = tracking.originalHash !== currentHash;
    }

    await this.save(data);
  }

  async detectCustomizations(): Promise<Customizations> {
    const data = await this.load();
    const customizations: Customizations = {
      modified: [],
      userCreated: [],
      untracked: [],
      preserved: []
    };

    for (const [relativePath, tracking] of Object.entries(data.trackedFiles)) {
      const fullPath = path.join(this.projectRoot, relativePath);

      if (!(await fs.pathExists(fullPath))) {
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

  async findSCFiles(): Promise<string[]> {
    const scPatterns = [
      '.cursor/rules/**/*.mdc',
      'templates/**/*.md',
      'templates/**/*.hbs',
      '.supernal-coding/**/*'
    ];

    const files: string[] = [];
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

  async isCustomized(filePath: string): Promise<boolean> {
    const data = await this.load();
    const relativePath = path.relative(this.projectRoot, filePath);
    const tracking = data.trackedFiles[relativePath];

    if (!tracking) {
      return this.matchesPreservePattern(relativePath, data.preservePatterns);
    }

    if (tracking.userCreated) {
      return true;
    }

    if (!(await fs.pathExists(filePath))) {
      return true;
    }

    const currentContent = await fs.readFile(filePath, 'utf8');
    const currentHash = this.hashContent(currentContent);

    return tracking.originalHash !== currentHash;
  }

  matchesPreservePattern(filePath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      const matcher = new RegExp(
        `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`
      );
      return matcher.test(filePath);
    });
  }

  async getCustomizationInfo(filePath: string): Promise<CustomizationInfo> {
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

  async generateReport(): Promise<CustomizationReport> {
    const customizations = await this.detectCustomizations();

    const report: CustomizationReport = {
      summary: {
        totalModified: customizations.modified.length,
        totalUserCreated: customizations.userCreated.length,
        totalPreserved: customizations.preserved.length,
        totalUntracked: customizations.untracked.length
      },
      details: customizations,
      recommendations: []
    };

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

  hashContent(content: string | null): string | null {
    if (!content) return null;

    const normalized = content.replace(/\r\n/g, '\n');

    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  async syncTracking(): Promise<{ tracked: number; updated: number }> {
    const scFiles = await this.findSCFiles();
    let tracked = 0;
    let updated = 0;

    for (const file of scFiles) {
      const relativePath = path.relative(this.projectRoot, file);
      const data = await this.load();

      if (!data.trackedFiles[relativePath]) {
        const content = await fs.readFile(file, 'utf8');
        await this.trackFile(file, content);
        tracked++;
      } else {
        await this.updateTracking(file);
        updated++;
      }
    }

    return { tracked, updated };
  }

  async markAsOriginal(filePath: string): Promise<void> {
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

  async addPreservePattern(pattern: string): Promise<void> {
    const data = await this.load();
    if (!data.preservePatterns.includes(pattern)) {
      data.preservePatterns.push(pattern);
      await this.save(data);
    }
  }
}

export default CustomizationDetector;
module.exports = CustomizationDetector;
