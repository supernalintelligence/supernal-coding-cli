#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('node:path');
const crypto = require('node:crypto');
const chalk = require('chalk');
const { getConfig } = require('../../../scripts/config-loader');

/**
 * Rule Submission Client
 * REQ-065: Active Rules Reporting System with Automatic PR Submission
 *
 * Handles secure submission of rule changes to backend API,
 * including data sanitization, privacy compliance, and PR creation.
 */

class RuleSubmissionClient {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.config = null;
    this.submissionQueue = [];
  }

  /**
   * Load configuration
   */
  async loadConfig() {
    try {
      const configLoader = new (require('../../../scripts/config-loader'))(
        this.projectRoot
      );
      this.config = configLoader.load();
    } catch (_error) {
      // Fallback configuration
      this.config = {
        rules: {
          reporting: {
            backend_api_endpoint: 'https://api.supernal-coding.dev/rules',
            api_key_env: 'SUPERNAL_RULES_API_KEY',
            timeout_seconds: 30,
            retry_attempts: 3,
            privacy: {
              anonymize_sensitive_data: true,
              strip_personal_info: true,
              gdpr_compliant: true,
            },
          },
        },
      };
    }
  }

  /**
   * Sanitize rule content for privacy compliance
   */
  sanitizeRuleContent(content, _filePath) {
    if (!content) return content;

    let sanitized = content;

    // Remove potential personal information
    const sensitivePatterns = [
      // Email addresses
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      // Potential API keys (long alphanumeric strings, including underscores)
      /\b[A-Za-z0-9_]{32,}\b/g,
      // File paths that might contain usernames
      /\/Users\/[^/\s]+/g,
      /\/home\/[^/\s]+/g,
      /C:\\Users\\[^\\/\s]+/g,
      // IP addresses
      /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      // URLs with potential sensitive info
      /https?:\/\/[^\s]+/g,
    ];

    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // Remove comments that might contain sensitive info
    sanitized = sanitized.replace(
      /<!--[\s\S]*?-->/g,
      '<!-- [COMMENT REDACTED] -->'
    );

    return sanitized;
  }

  /**
   * Extract metadata from rule file
   */
  async extractRuleMetadata(change) {
    const metadata = {
      type: change.file?.type || 'unknown',
      size: change.file?.size || 0,
      change_type: change.type,
      timestamp: change.timestamp,
      file_extension: path.extname(change.path),
      relative_path: change.path,
    };

    // Add rule-specific metadata
    if (change.file?.type === 'cursor') {
      try {
        const fullPath = path.join(this.projectRoot, change.path);
        const content = await fs.readFile(fullPath, 'utf8');

        // Extract frontmatter if present
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          try {
            const yaml = require('js-yaml');
            const frontmatter = yaml.load(frontmatterMatch[1]);
            metadata.frontmatter = {
              description: frontmatter.description || null,
              globs: frontmatter.globs || null,
              alwaysApply: frontmatter.alwaysApply || false,
            };
          } catch (_yamlError) {
            // Ignore YAML parsing errors
          }
        }

        // Count rules/patterns
        const ruleCount = (content.match(/^-\s+\*\*/gm) || []).length;
        metadata.rule_count = ruleCount;
      } catch (_error) {
        // File might be deleted or inaccessible
      }
    }

    return metadata;
  }

  /**
   * Prepare submission payload
   */
  async prepareSubmissionPayload(changes, context) {
    const payload = {
      submission_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      context: {
        command: context.command_context,
        consent_mode: context.consent.mode,
        project_type: 'unknown', // Will be detected from config
      },
      changes: [],
    };

    // Add project type if available
    if (this.config?.project?.type) {
      payload.context.project_type = this.config.project.type;
    }

    // Process each change
    for (const change of changes) {
      const changePayload = {
        id: crypto.randomUUID(),
        type: change.type,
        path: change.path,
        metadata: await this.extractRuleMetadata(change),
      };

      // Include sanitized content for added/modified files
      if (['added', 'modified'].includes(change.type)) {
        try {
          const fullPath = path.join(this.projectRoot, change.path);
          const rawContent = await fs.readFile(fullPath, 'utf8');
          changePayload.content = this.sanitizeRuleContent(
            rawContent,
            change.path
          );
        } catch (_error) {
          changePayload.content = null;
          changePayload.error = 'Could not read file content';
        }
      }

      payload.changes.push(changePayload);
    }

    return payload;
  }

  /**
   * Submit to backend API
   */
  async submitToAPI(payload) {
    const config = this.config.rules.reporting;
    const endpoint = config.backend_api_endpoint;
    const timeout = (config.timeout_seconds || 30) * 1000;

    // Get API key from environment
    const apiKey = process.env[config.api_key_env || 'SUPERNAL_RULES_API_KEY'];

    if (!apiKey) {
      throw new Error(
        `API key not found in environment variable: ${config.api_key_env}`
      );
    }

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'supernal-coding-cli/1.0.0',
        'X-Submission-ID': payload.submission_id,
      },
      body: JSON.stringify(payload),
      timeout: timeout,
    };

    // Use node-fetch or built-in fetch
    let fetch;
    try {
      // Try to use built-in fetch (Node 18+)
      fetch = globalThis.fetch;
    } catch {
      // Fallback to node-fetch
      fetch = require('node-fetch');
    }

    const response = await fetch(endpoint, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    return result;
  }

  /**
   * Submit rule changes with retry logic
   */
  async submitRuleChanges(changes, context) {
    await this.loadConfig();

    const config = this.config.rules.reporting;
    const maxRetries = config.retry_attempts || 3;

    // Prepare payload
    const payload = await this.prepareSubmissionPayload(changes, context);

    // Log submission attempt
    if (process.env.SC_DEBUG) {
      console.log(chalk.dim(`🔄 Submitting ${changes.length} rule changes...`));
    }

    let lastError;

    // Retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.submitToAPI(payload);

        // Log success
        if (process.env.SC_DEBUG) {
          console.log(
            chalk.dim(`✅ Rules submitted successfully (attempt ${attempt})`)
          );
          if (result.pr_url) {
            console.log(chalk.dim(`🔗 PR created: ${result.pr_url}`));
          }
        }

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = 2 ** attempt * 1000; // Exponential backoff
          if (process.env.SC_DEBUG) {
            console.log(
              chalk.dim(
                `⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`
              )
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed to submit rules after ${maxRetries} attempts: ${lastError.message}`
    );
  }

  /**
   * Queue submission for later (offline support)
   */
  async queueSubmission(changes, context) {
    const queueFile = path.join(
      this.projectRoot,
      '.supernal-coding',
      'submission-queue.json'
    );

    try {
      let queue = [];
      if (await fs.pathExists(queueFile)) {
        queue = await fs.readJson(queueFile);
      }

      const submission = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        changes: changes,
        context: context,
        status: 'queued',
      };

      queue.push(submission);

      await fs.ensureDir(path.dirname(queueFile));
      await fs.writeJson(queueFile, queue, { spaces: 2 });

      console.log(
        chalk.blue('📥 Rule changes queued for submission when online')
      );
    } catch (error) {
      console.warn(
        chalk.yellow(`Warning: Could not queue submission: ${error.message}`)
      );
    }
  }

  /**
   * Process queued submissions
   */
  async processQueuedSubmissions() {
    const queueFile = path.join(
      this.projectRoot,
      '.supernal-coding',
      'submission-queue.json'
    );

    if (!(await fs.pathExists(queueFile))) {
      return { processed: 0, failed: 0 };
    }

    try {
      const queue = await fs.readJson(queueFile);
      const pendingSubmissions = queue.filter((s) => s.status === 'queued');

      let processed = 0;
      let failed = 0;

      for (const submission of pendingSubmissions) {
        try {
          await this.submitRuleChanges(submission.changes, submission.context);
          submission.status = 'submitted';
          submission.submitted_at = new Date().toISOString();
          processed++;
        } catch (error) {
          submission.status = 'failed';
          submission.error = error.message;
          failed++;
        }
      }

      // Update queue file
      await fs.writeJson(queueFile, queue, { spaces: 2 });

      return { processed, failed };
    } catch (error) {
      console.warn(
        chalk.yellow(
          `Warning: Could not process submission queue: ${error.message}`
        )
      );
      return { processed: 0, failed: 0 };
    }
  }
}

module.exports = RuleSubmissionClient;
