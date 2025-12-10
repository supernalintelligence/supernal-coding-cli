#!/usr/bin/env node
// @ts-nocheck

/**
 * Git Assessment Command
 * REQ-011: Git System Evaluation and Enhancement
 *
 * Comprehensive git repository analysis including:
 * - Repository health assessment
 * - Workflow compliance analysis
 * - Requirements integration status
 * - Historical analysis and trends
 * - Performance metrics
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

class GitAssessmentCommand {
  assessment: any;
  config: any;
  projectRoot: any;
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.config = this.loadConfiguration();
    this.assessment = {};
  }

  /**
   * Load configuration from supernal.yaml
   */
  loadConfiguration() {
    const configPath = path.join(this.projectRoot, 'supernal.yaml');

    const defaultConfig = {
      assessment: {
        analyze_history: true,
        track_requirements: true,
        performance_metrics: true,
        detailed_branch_analysis: true,
        commit_pattern_analysis: true
      },
      reporting: {
        include_recommendations: true,
        detailed_output: true,
        export_format: 'json'
      }
    };

    if (!fs.existsSync(configPath)) {
      return defaultConfig;
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      return this.parseConfig(configContent, defaultConfig);
    } catch (_error) {
      return defaultConfig;
    }
  }

  /**
   * Simple YAML parser for configuration
   */
  parseConfig(content, defaultConfig) {
    const config = JSON.parse(JSON.stringify(defaultConfig));

    let currentSection = config;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const section = trimmed.slice(1, -1);
        const parts = section.split('.');

        currentSection = config;
        for (const part of parts) {
          if (!currentSection[part]) currentSection[part] = {};
          currentSection = currentSection[part];
        }
      } else if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();

        let parsedValue = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (value.startsWith('"') && value.endsWith('"')) {
          parsedValue = value.slice(1, -1);
        } else if (!Number.isNaN(value)) {
          parsedValue = Number(value);
        }

        currentSection[key.trim()] = parsedValue;
      }
    }

    return config;
  }

  /**
   * Run comprehensive git assessment
   */
  async runAssessment(options = {}) {
    const { silent = false } = options;

    if (!silent) {
      console.log('🔍 Running Enhanced Git Assessment...\n');
    }

    this.assessment = {
      timestamp: new Date().toISOString(),
      projectRoot: this.projectRoot,
      repository: await this.assessRepository(),
      branches: await this.assessBranches(),
      commits: await this.assessCommits(),
      requirements: await this.assessRequirementsIntegration(),
      workflow: await this.assessWorkflow(),
      performance: await this.assessPerformance(),
      security: await this.assessSecurity(),
      recommendations: []
    };

    // Generate overall score and recommendations
    this.assessment.overallScore = this.calculateOverallScore();
    this.assessment.recommendations = this.generateRecommendations();

    return this.assessment;
  }

  /**
   * Assess basic repository health
   */
  async assessRepository() {
    const repo = {
      hasGitDirectory: false,
      isInitialized: false,
      hasRemote: false,
      remoteUrl: null,
      currentBranch: null,
      hasStash: false,
      isClean: false,
      hasUntracked: false,
      repositorySize: 0,
      gitVersion: null,
      configuration: {}
    };

    try {
      // Check .git directory
      repo.hasGitDirectory = fs.existsSync(path.join(this.projectRoot, '.git'));

      if (!repo.hasGitDirectory) {
        return repo;
      }

      repo.isInitialized = true;

      // Git version
      try {
        repo.gitVersion = execSync('git --version', {
          cwd: this.projectRoot,
          encoding: 'utf8'
        }).trim();
      } catch (_error) {
        // Git not available
      }

      // Current branch
      try {
        repo.currentBranch = execSync('git branch --show-current', {
          cwd: this.projectRoot,
          encoding: 'utf8'
        }).trim();
      } catch (_error) {
        repo.currentBranch = 'detached';
      }

      // Remote information
      try {
        const remoteResult = execSync('git remote -v', {
          cwd: this.projectRoot,
          encoding: 'utf8'
        });

        if (remoteResult.trim()) {
          repo.hasRemote = true;
          const lines = remoteResult.trim().split('\n');
          const firstRemote = lines[0].split('\t');
          repo.remoteUrl = firstRemote[1]?.split(' ')[0];
        }
      } catch (_error) {
        repo.hasRemote = false;
      }

      // Repository status
      try {
        const statusResult = execSync('git status --porcelain', {
          cwd: this.projectRoot,
          encoding: 'utf8'
        });

        repo.isClean = !statusResult.trim();
        repo.hasUntracked = statusResult.includes('??');
      } catch (_error) {
        repo.isClean = false;
      }

      // Repository size
      repo.repositorySize = this.getDirectorySize(
        path.join(this.projectRoot, '.git')
      );

      // Git configuration
      repo.configuration = this.getGitConfiguration();
    } catch (error) {
      repo.error = error.message;
    }

    return repo;
  }

  /**
   * Get git configuration
   */
  getGitConfiguration() {
    const config = {
      user: {},
      core: {},
      remote: {},
      branch: {}
    };

    try {
      const configItems = [
        'user.name',
        'user.email',
        'core.autocrlf',
        'core.editor'
      ];

      for (const item of configItems) {
        try {
          const value = execSync(`git config ${item}`, {
            cwd: this.projectRoot,
            encoding: 'utf8'
          }).trim();

          const [section, key] = item.split('.');
          config[section][key] = value;
        } catch (_error) {
          const [section, key] = item.split('.');
          config[section][key] = null;
        }
      }
    } catch (error) {
      config.error = error.message;
    }

    return config;
  }

  /**
   * Assess branch information and compliance
   */
  async assessBranches() {
    const branches = {
      totalCount: 0,
      localCount: 0,
      remoteCount: 0,
      current: null,
      protected: [],
      feature: [],
      stale: [],
      namingCompliance: {
        compliant: 0,
        nonCompliant: 0,
        percentage: 0
      }
    };

    try {
      // Get all branches
      const branchResult = execSync('git branch -a', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      const branchLines = branchResult
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.includes('HEAD'));

      branches.totalCount = branchLines.length;

      for (const line of branchLines) {
        const isRemote = line.includes('remotes/');
        const isCurrent = line.startsWith('*');
        const branchName = line
          .replace('*', '')
          .replace('remotes/origin/', '')
          .trim();

        if (isRemote) {
          branches.remoteCount++;
        } else {
          branches.localCount++;
        }

        if (isCurrent) {
          branches.current = branchName;
        }

        // Categorize branches
        if (branchName === 'main' || branchName === 'master') {
          branches.protected.push(branchName);
        } else if (branchName.startsWith('feature/')) {
          branches.feature.push(branchName);
        }

        // Check naming compliance
        if (this.isCompliantBranchName(branchName)) {
          branches.namingCompliance.compliant++;
        } else {
          branches.namingCompliance.nonCompliant++;
        }
      }

      // Calculate compliance percentage
      branches.namingCompliance.percentage =
        branches.totalCount > 0
          ? Math.round(
              (branches.namingCompliance.compliant / branches.totalCount) * 100
            )
          : 0;
    } catch (error) {
      branches.error = error.message;
    }

    return branches;
  }

  /**
   * Check if branch name is compliant
   */
  isCompliantBranchName(branchName) {
    const protectedBranches = [
      'main',
      'master',
      'develop',
      'staging',
      'production'
    ];
    if (protectedBranches.includes(branchName)) return true;

    const patterns = [
      /^feature\/req-\d+-.+/,
      /^bugfix\/req-\d+-.+/,
      /^hotfix\/req-\d+-.+/,
      /^feature\/.+/,
      /^bugfix\/.+/,
      /^hotfix\/.+/
    ];

    return patterns.some((pattern) => pattern.test(branchName));
  }

  /**
   * Assess commit history and compliance
   */
  async assessCommits() {
    const commits = {
      totalCount: 0,
      recentCount: 0,
      averagePerDay: 0,
      messageCompliance: {
        compliant: 0,
        nonCompliant: 0,
        percentage: 0
      },
      authors: {},
      requirementTagged: 0,
      patterns: {
        features: 0,
        bugfixes: 0,
        docs: 0,
        refactor: 0,
        other: 0
      },
      firstCommit: null,
      lastCommit: null
    };

    try {
      // Get commit count
      const countResult = execSync('git rev-list --count HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      commits.totalCount = parseInt(countResult.trim(), 10);

      // Get recent commits (last 30 days)
      const recentResult = execSync(
        'git rev-list --count --since="30 days ago" HEAD',
        {
          cwd: this.projectRoot,
          encoding: 'utf8'
        }
      );
      commits.recentCount = parseInt(recentResult.trim(), 10);

      // Get commit history for analysis
      const logResult = execSync(
        'git log --oneline --format="%H|%s|%an|%ad" --date=short -50',
        {
          cwd: this.projectRoot,
          encoding: 'utf8'
        }
      );

      const commitLines = logResult.split('\n').filter((line) => line.trim());

      for (const line of commitLines) {
        const [_hash, message, author, date] = line.split('|');

        // Track authors
        commits.authors[author] = (commits.authors[author] || 0) + 1;

        // Check message compliance
        if (this.isCompliantCommitMessage(message)) {
          commits.messageCompliance.compliant++;
        } else {
          commits.messageCompliance.nonCompliant++;
        }

        // Check for requirement tagging
        if (message.match(/REQ-\d+/)) {
          commits.requirementTagged++;
        }

        // Categorize commits
        if (message.toLowerCase().includes('feature'))
          commits.patterns.features++;
        else if (
          message.toLowerCase().includes('fix') ||
          message.toLowerCase().includes('bug')
        )
          commits.patterns.bugfixes++;
        else if (message.toLowerCase().includes('doc')) commits.patterns.docs++;
        else if (message.toLowerCase().includes('refactor'))
          commits.patterns.refactor++;
        else commits.patterns.other++;

        // Track first and last commits
        if (!commits.firstCommit) commits.lastCommit = date;
        commits.firstCommit = date;
      }

      // Calculate compliance percentage
      const totalAnalyzed =
        commits.messageCompliance.compliant +
        commits.messageCompliance.nonCompliant;
      commits.messageCompliance.percentage =
        totalAnalyzed > 0
          ? Math.round(
              (commits.messageCompliance.compliant / totalAnalyzed) * 100
            )
          : 0;

      // Calculate average commits per day
      if (commits.firstCommit && commits.lastCommit) {
        const firstDate = new Date(commits.firstCommit);
        const lastDate = new Date(commits.lastCommit);
        const daysDiff = Math.max(
          1,
          Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24))
        );
        commits.averagePerDay = (commits.totalCount / daysDiff).toFixed(2);
      }
    } catch (error) {
      commits.error = error.message;
    }

    return commits;
  }

  /**
   * Check if commit message is compliant
   */
  isCompliantCommitMessage(message) {
    // REQ-XXX: format
    if (message.match(/^REQ-\d+:\s.{10,}/)) return true;

    // Standard conventional commit formats
    const conventionalPatterns = [
      /^feat(\(.+\))?:\s.{10,}/,
      /^fix(\(.+\))?:\s.{10,}/,
      /^docs(\(.+\))?:\s.{10,}/,
      /^style(\(.+\))?:\s.{10,}/,
      /^refactor(\(.+\))?:\s.{10,}/,
      /^test(\(.+\))?:\s.{10,}/,
      /^chore(\(.+\))?:\s.{10,}/
    ];

    return conventionalPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Assess requirements system integration
   */
  async assessRequirementsIntegration() {
    const requirements = {
      hasRequirementsDirectory: false,
      requirementFiles: [],
      totalRequirements: 0,
      trackedRequirements: 0,
      integrationScore: 0,
      gitTracking: {
        enabled: false,
        filesWithTracking: 0,
        totalRequirementFiles: 0
      }
    };

    try {
      // Check for requirements directory
      const reqDirs = [
        'supernal-coding/requirements',
        'requirements',
        'docs/requirements'
      ];

      for (const dir of reqDirs) {
        const fullPath = path.join(this.projectRoot, dir);
        if (fs.existsSync(fullPath)) {
          requirements.hasRequirementsDirectory = true;

          // Find requirement files
          const files = this.findRequirementFiles(fullPath);
          requirements.requirementFiles = files;
          requirements.totalRequirements = files.length;

          // Analyze requirement files for git tracking
          let trackedCount = 0;
          for (const file of files) {
            try {
              const content = fs.readFileSync(file, 'utf8');
              if (content.includes('git_tracking:')) {
                trackedCount++;
              }
            } catch (_error) {
              // Unable to read file
            }
          }

          requirements.gitTracking.filesWithTracking = trackedCount;
          requirements.gitTracking.totalRequirementFiles = files.length;
          requirements.gitTracking.enabled = trackedCount > 0;

          break;
        }
      }

      // Check for requirement-tagged commits
      try {
        const reqCommits = execSync('git log --grep="REQ-" --oneline', {
          cwd: this.projectRoot,
          encoding: 'utf8'
        })
          .split('\n')
          .filter((line) => line.trim());

        requirements.trackedRequirements = reqCommits.length;
      } catch (_error) {
        requirements.trackedRequirements = 0;
      }

      // Calculate integration score
      let score = 0;
      if (requirements.hasRequirementsDirectory) score += 40;
      if (requirements.totalRequirements > 0) score += 20;
      if (requirements.gitTracking.enabled) score += 20;
      if (requirements.trackedRequirements > 0) score += 20;

      requirements.integrationScore = score;
    } catch (error) {
      requirements.error = error.message;
    }

    return requirements;
  }

  /**
   * Find requirement files recursively
   */
  findRequirementFiles(directory) {
    const files = [];

    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.findRequirementFiles(fullPath));
        } else if (
          entry.isFile() &&
          (entry.name.includes('req-') || entry.name.includes('requirement')) &&
          entry.name.endsWith('.md')
        ) {
          files.push(fullPath);
        }
      }
    } catch (_error) {
      // Unable to read directory
    }

    return files;
  }

  /**
   * Assess workflow compliance
   */
  async assessWorkflow() {
    const workflow = {
      hasGitHooks: false,
      hasPreCommit: false,
      hasCommitMsg: false,
      hasConfiguration: false,
      workflowScore: 0,
      validationTools: []
    };

    try {
      // Check for git hooks
      const hooksDir = path.join(this.projectRoot, '.git', 'hooks');
      if (fs.existsSync(hooksDir)) {
        workflow.hasGitHooks = true;

        // Check specific hooks
        if (fs.existsSync(path.join(hooksDir, 'pre-commit'))) {
          workflow.hasPreCommit = true;
        }

        if (fs.existsSync(path.join(hooksDir, 'commit-msg'))) {
          workflow.hasCommitMsg = true;
        }
      }

      // Check for configuration file
      const configPath = path.join(this.projectRoot, 'supernal.yaml');
      workflow.hasConfiguration = fs.existsSync(configPath);

      // Check for validation tools
      const validationFiles = [
        'scripts/git-workflow-validator.js',
        'scripts/git-assessment.js'
      ];

      for (const file of validationFiles) {
        if (fs.existsSync(path.join(this.projectRoot, file))) {
          workflow.validationTools.push(file);
        }
      }

      // Calculate workflow score
      let score = 0;
      if (workflow.hasGitHooks) score += 25;
      if (workflow.hasPreCommit) score += 25;
      if (workflow.hasCommitMsg) score += 25;
      if (workflow.hasConfiguration) score += 25;

      workflow.workflowScore = score;
    } catch (error) {
      workflow.error = error.message;
    }

    return workflow;
  }

  /**
   * Assess performance metrics
   */
  async assessPerformance() {
    const performance = {
      repositorySize: 0,
      objectCount: 0,
      packfileCount: 0,
      largeFiles: [],
      cleanupNeeded: false,
      performanceScore: 100
    };

    try {
      // Repository size
      const gitDir = path.join(this.projectRoot, '.git');
      performance.repositorySize = this.getDirectorySize(gitDir);

      // Object count
      try {
        const objectResult = execSync('git count-objects -v', {
          cwd: this.projectRoot,
          encoding: 'utf8'
        });

        const lines = objectResult.split('\n');
        for (const line of lines) {
          if (line.includes('count ')) {
            performance.objectCount = parseInt(line.split(' ')[1], 10);
          }
          if (line.includes('packs ')) {
            performance.packfileCount = parseInt(line.split(' ')[1], 10);
          }
        }
      } catch (_error) {
        // Unable to get object count
      }

      // Check for large files (>10MB)
      try {
        const largeFilesResult = execSync(
          'find . -type f -size +10M -not -path "./.git/*"',
          {
            cwd: this.projectRoot,
            encoding: 'utf8'
          }
        );

        if (largeFilesResult.trim()) {
          performance.largeFiles = largeFilesResult
            .split('\n')
            .filter((line) => line.trim());
        }
      } catch (_error) {
        // Unable to check for large files
      }

      // Determine if cleanup is needed
      performance.cleanupNeeded =
        performance.objectCount > 10000 ||
        performance.repositorySize > 100 * 1024 * 1024 ||
        performance.largeFiles.length > 0;

      // Calculate performance score
      let score = 100;
      if (performance.repositorySize > 100 * 1024 * 1024) score -= 20;
      if (performance.objectCount > 10000) score -= 15;
      if (performance.largeFiles.length > 0) score -= 25;

      performance.performanceScore = Math.max(0, score);
    } catch (error) {
      performance.error = error.message;
    }

    return performance;
  }

  /**
   * Assess security aspects
   */
  async assessSecurity() {
    const security = {
      hasSecureRemote: false,
      hasSignedCommits: false,
      hasCredentialHelper: false,
      sensitiveFiles: [],
      securityScore: 0
    };

    try {
      // Check remote URL security
      if (this.assessment.repository?.remoteUrl) {
        security.hasSecureRemote =
          this.assessment.repository.remoteUrl.startsWith('https://') ||
          this.assessment.repository.remoteUrl.startsWith('git@');
      }

      // Check for signed commits
      try {
        const signedResult = execSync('git log --show-signature -1', {
          cwd: this.projectRoot,
          encoding: 'utf8'
        });
        security.hasSignedCommits =
          signedResult.includes('gpg:') ||
          signedResult.includes('Good signature');
      } catch (_error) {
        security.hasSignedCommits = false;
      }

      // Check credential helper
      try {
        const credentialHelper = execSync('git config credential.helper', {
          cwd: this.projectRoot,
          encoding: 'utf8'
        });
        security.hasCredentialHelper = !!credentialHelper.trim();
      } catch (_error) {
        security.hasCredentialHelper = false;
      }

      // Check for sensitive files
      const sensitivePatterns = [
        '.env',
        '*.key',
        '*.pem',
        'id_rsa',
        'password*',
        'secret*'
      ];

      for (const pattern of sensitivePatterns) {
        try {
          const result = execSync(
            `find . -name "${pattern}" -not -path "./.git/*"`,
            {
              cwd: this.projectRoot,
              encoding: 'utf8'
            }
          );

          if (result.trim()) {
            security.sensitiveFiles.push(
              ...result.split('\n').filter((line) => line.trim())
            );
          }
        } catch (_error) {
          // Pattern not found or error
        }
      }

      // Calculate security score
      let score = 0;
      if (security.hasSecureRemote) score += 40;
      if (security.hasSignedCommits) score += 30;
      if (security.hasCredentialHelper) score += 20;
      if (security.sensitiveFiles.length === 0) score += 10;

      security.securityScore = score;
    } catch (error) {
      security.error = error.message;
    }

    return security;
  }

  /**
   * Calculate overall assessment score
   */
  calculateOverallScore() {
    const weights = {
      repository: 0.2,
      branches: 0.15,
      commits: 0.15,
      requirements: 0.2,
      workflow: 0.15,
      performance: 0.1,
      security: 0.05
    };

    let totalScore = 0;

    // Repository score (0-100)
    const repoScore = this.assessment.repository.isInitialized
      ? this.assessment.repository.hasRemote
        ? 100
        : 80
      : 0;
    totalScore += repoScore * weights.repository;

    // Branches score
    const branchScore =
      this.assessment.branches.namingCompliance.percentage || 0;
    totalScore += branchScore * weights.branches;

    // Commits score
    const commitScore =
      this.assessment.commits.messageCompliance.percentage || 0;
    totalScore += commitScore * weights.commits;

    // Requirements score
    const reqScore = this.assessment.requirements.integrationScore || 0;
    totalScore += reqScore * weights.requirements;

    // Workflow score
    const workflowScore = this.assessment.workflow.workflowScore || 0;
    totalScore += workflowScore * weights.workflow;

    // Performance score
    const perfScore = this.assessment.performance.performanceScore || 0;
    totalScore += perfScore * weights.performance;

    // Security score
    const secScore = this.assessment.security.securityScore || 0;
    totalScore += secScore * weights.security;

    return Math.round(totalScore);
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Branch naming recommendations
    if (this.assessment.branches.namingCompliance.percentage < 80) {
      recommendations.push({
        category: 'branches',
        priority: 'warning',
        message: 'Improve branch naming compliance',
        action:
          'Rename branches to follow naming convention (feature/req-XXX-description)',
        impact: `${this.assessment.branches.namingCompliance.nonCompliant} branches need attention`
      });
    }

    // Commit message recommendations
    if (this.assessment.commits.messageCompliance.percentage < 80) {
      recommendations.push({
        category: 'commits',
        priority: 'warning',
        message: 'Improve commit message format',
        action:
          'Use REQ-XXX: format for commit messages to enable requirement tracking',
        impact: `${this.assessment.commits.messageCompliance.percentage}% compliance rate`
      });
    }

    // Security recommendations
    if (this.assessment.security.sensitiveFiles.length > 0) {
      recommendations.push({
        category: 'security',
        priority: 'warning',
        message: 'Sensitive files detected',
        action: 'Review and secure or remove sensitive files',
        impact: `${this.assessment.security.sensitiveFiles.length} potentially sensitive files found`
      });
    }

    // Performance recommendations
    if (this.assessment.performance.cleanupNeeded) {
      recommendations.push({
        category: 'performance',
        priority: 'info',
        message: 'Repository cleanup recommended',
        action: 'Run git gc or consider cleaning up large files',
        impact: 'Improve repository performance and reduce size'
      });
    }

    // Requirements integration recommendations
    if (this.assessment.requirements.integrationScore < 60) {
      recommendations.push({
        category: 'requirements',
        priority: 'info',
        message: 'Improve requirements integration',
        action:
          'Enable git tracking in requirement files and use REQ-XXX commit format',
        impact: 'Better traceability between requirements and implementation'
      });
    }

    return recommendations;
  }

  /**
   * Get directory size in bytes (cross-platform)
   */
  getDirectorySize(dirPath) {
    try {
      let totalSize = 0;

      const calculateSize = (currentPath) => {
        const stats = fs.statSync(currentPath);

        if (stats.isFile()) {
          totalSize += stats.size;
        } else if (stats.isDirectory()) {
          try {
            const entries = fs.readdirSync(currentPath);
            for (const entry of entries) {
              calculateSize(path.join(currentPath, entry));
            }
          } catch (_error) {
            // Skip directories we can't read
          }
        }
      };

      calculateSize(dirPath);
      return totalSize;
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Generate human-readable report
   */
  generateReport() {
    const report = [];

    report.push('📊 Enhanced Git Assessment Report');
    report.push('=====================================');
    report.push(
      `Generated: ${new Date(this.assessment.timestamp).toLocaleString()}`
    );
    report.push(`Overall Score: ${this.assessment.overallScore}/100`);
    report.push('');

    // Repository section
    report.push('🏗️ Repository Health');
    report.push(
      `   Initialized: ${this.assessment.repository.isInitialized ? '✅' : '❌'}`
    );
    report.push(
      `   Remote: ${this.assessment.repository.hasRemote ? '✅' : '❌'}`
    );
    report.push(
      `   Current Branch: ${this.assessment.repository.currentBranch || 'unknown'}`
    );
    report.push(
      `   Clean Status: ${this.assessment.repository.isClean ? '✅' : '⚠️'}`
    );
    report.push('');

    // Branches section
    report.push('🌿 Branch Analysis');
    report.push(`   Total Branches: ${this.assessment.branches.totalCount}`);
    report.push(
      `   Naming Compliance: ${this.assessment.branches.namingCompliance.percentage}%`
    );
    report.push(`   Stale Branches: ${this.assessment.branches.stale.length}`);
    report.push('');

    // Commits section
    report.push('📝 Commit Analysis');
    report.push(`   Total Commits: ${this.assessment.commits.totalCount}`);
    report.push(`   Recent (30d): ${this.assessment.commits.recentCount}`);
    report.push(
      `   Message Compliance: ${this.assessment.commits.messageCompliance.percentage}%`
    );
    report.push(
      `   Requirement Tagged: ${this.assessment.commits.requirementTagged}`
    );
    report.push('');

    // Requirements section
    report.push('📋 Requirements Integration');
    report.push(
      `   Requirements Directory: ${this.assessment.requirements.hasRequirementsDirectory ? '✅' : '❌'}`
    );
    report.push(
      `   Total Requirements: ${this.assessment.requirements.totalRequirements}`
    );
    report.push(
      `   Git Tracking: ${this.assessment.requirements.gitTracking.enabled ? '✅' : '❌'}`
    );
    report.push(
      `   Integration Score: ${this.assessment.requirements.integrationScore}/100`
    );
    report.push('');

    // Workflow section
    report.push('⚙️ Workflow Analysis');
    report.push(
      `   Git Hooks: ${this.assessment.workflow.hasGitHooks ? '✅' : '❌'}`
    );
    report.push(
      `   Pre-commit: ${this.assessment.workflow.hasPreCommit ? '✅' : '❌'}`
    );
    report.push(
      `   Commit-msg: ${this.assessment.workflow.hasCommitMsg ? '✅' : '❌'}`
    );
    report.push(
      `   Workflow Score: ${this.assessment.workflow.workflowScore}/100`
    );
    report.push('');

    // Performance section
    report.push('⚡ Performance Metrics');
    report.push(
      `   Repository Size: ${Math.round(this.assessment.performance.repositorySize / 1024 / 1024)} MB`
    );
    report.push(`   Object Count: ${this.assessment.performance.objectCount}`);
    report.push(
      `   Large Files: ${this.assessment.performance.largeFiles.length}`
    );
    report.push(
      `   Performance Score: ${this.assessment.performance.performanceScore}/100`
    );
    report.push('');

    // Security section
    report.push('🔒 Security Analysis');
    report.push(
      `   Secure Remote: ${this.assessment.security.hasSecureRemote ? '✅' : '❌'}`
    );
    report.push(
      `   Signed Commits: ${this.assessment.security.hasSignedCommits ? '✅' : '❌'}`
    );
    report.push(
      `   Credential Helper: ${this.assessment.security.hasCredentialHelper ? '✅' : '❌'}`
    );
    report.push(
      `   Security Score: ${this.assessment.security.securityScore}/100`
    );
    report.push('');

    // Recommendations
    if (this.assessment.recommendations.length > 0) {
      report.push('💡 Recommendations');
      this.assessment.recommendations.forEach((rec, index) => {
        report.push(
          `   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`
        );
        if (rec.action) report.push(`      Action: ${rec.action}`);
        if (rec.impact) report.push(`      Impact: ${rec.impact}`);
      });
    } else {
      report.push('✅ No recommendations - repository is in excellent shape!');
    }

    return report.join('\n');
  }

  /**
   * Export assessment data as JSON
   */
  exportJSON() {
    return JSON.stringify(this.assessment, null, 2);
  }

  /**
   * Export key metrics as CSV
   */
  exportCSV() {
    const metrics = [
      ['Metric', 'Value'],
      ['Overall Score', this.assessment.overallScore],
      ['Repository Initialized', this.assessment.repository.isInitialized],
      ['Has Remote', this.assessment.repository.hasRemote],
      ['Current Branch', this.assessment.repository.currentBranch],
      ['Total Branches', this.assessment.branches.totalCount],
      [
        'Branch Naming Compliance',
        `${this.assessment.branches.namingCompliance.percentage}%`
      ],
      ['Total Commits', this.assessment.commits.totalCount],
      [
        'Commit Message Compliance',
        `${this.assessment.commits.messageCompliance.percentage}%`
      ],
      ['Requirement Tagged Commits', this.assessment.commits.requirementTagged],
      [
        'Requirements Directory',
        this.assessment.requirements.hasRequirementsDirectory
      ],
      ['Total Requirements', this.assessment.requirements.totalRequirements],
      [
        'Git Tracking Enabled',
        this.assessment.requirements.gitTracking.enabled
      ],
      ['Workflow Score', this.assessment.workflow.workflowScore],
      ['Performance Score', this.assessment.performance.performanceScore],
      ['Security Score', this.assessment.security.securityScore]
    ];

    return metrics.map((row) => row.join(',')).join('\n');
  }

  /**
   * Export data in specified format
   */
  exportData(format) {
    switch (format.toLowerCase()) {
      case 'json':
        return this.exportJSON();
      case 'csv':
        return this.exportCSV();
      default:
        return this.generateReport();
    }
  }
}

module.exports = GitAssessmentCommand;
