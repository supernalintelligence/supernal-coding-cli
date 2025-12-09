/**
 * SC Telemetry System - Privacy-first learning and improvement
 * Opt-in telemetry for understanding real-world SC usage patterns
 */

const fs = require('fs-extra');
const path = require('node:path');
const crypto = require('node:crypto');

class TelemetryService {
  constructor() {
    this.projectRoot = process.cwd();
    this.scDir = path.join(this.projectRoot, '.supernal-coding');
    this.telemetryDir = path.join(this.scDir, 'telemetry');
    this.configFile = path.join(this.telemetryDir, 'config.json');
    this.cacheFile = path.join(this.telemetryDir, 'pending-events.json');

    this._config = null;
    this._initialized = false;
  }

  /**
   * Initialize telemetry service
   */
  async init() {
    if (this._initialized) return;

    await fs.ensureDir(this.telemetryDir);

    // Load or create config
    if (await fs.pathExists(this.configFile)) {
      this._config = await fs.readJson(this.configFile);
    } else {
      this._config = this.getDefaultConfig();
      await this.saveConfig();
    }

    this._initialized = true;
  }

  /**
   * Check if telemetry is enabled
   */
  async isEnabled() {
    await this.init();
    return this._config.enabled && this._config.consent.given;
  }

  /**
   * Get default telemetry configuration
   */
  getDefaultConfig() {
    return {
      enabled: false,
      consent: {
        given: false,
        timestamp: null,
        version: '1.0'
      },
      collection: {
        commands: true,
        rules: true,
        validation: true,
        performance: true,
        errors: true
      },
      sync: {
        enabled: false,
        frequency: 'daily',
        endpoint: 'https://telemetry.supernal-coding.com/events',
        batchSize: 100
      },
      privacy: {
        anonymizeFilePaths: true,
        anonymizeProjectInfo: true,
        includeSystemInfo: true,
        saltForHashing: crypto.randomBytes(32).toString('hex')
      },
      localLearning: {
        enabled: true,
        insightsEnabled: true,
        retentionDays: 90
      }
    };
  }

  /**
   * Save configuration
   */
  async saveConfig() {
    await fs.writeJson(this.configFile, this._config, { spaces: 2 });
  }

  /**
   * Enable telemetry with user consent
   */
  async enable() {
    await this.init();

    this._config.enabled = true;
    this._config.consent.given = true;
    this._config.consent.timestamp = new Date().toISOString();

    await this.saveConfig();
  }

  /**
   * Disable telemetry
   */
  async disable() {
    await this.init();

    this._config.enabled = false;
    this._config.consent.given = false;

    await this.saveConfig();
  }

  /**
   * Record a telemetry event
   */
  async recordEvent(eventType, data) {
    if (!(await this.isEnabled())) return;

    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: eventType,
      data: await this.anonymizeData(data),
      scVersion: await this.getSCVersion()
    };

    await this.appendToCache(event);
  }

  /**
   * Record command execution
   */
  async recordCommand(command, subcommand, flags, result) {
    if (!this._config.collection.commands) return;

    await this.recordEvent('command_executed', {
      command,
      subcommand,
      flags,
      success: result.success,
      duration_ms: result.duration,
      errorType: result.error ? result.error.type : null
    });
  }

  /**
   * Record rule validation
   */
  async recordRuleCheck(ruleId, violated, severity, contextType) {
    if (!this._config.collection.rules) return;

    await this.recordEvent('rule_check', {
      ruleId,
      violated,
      severity,
      contextType
    });
  }

  /**
   * Record validation results
   */
  async recordValidation(validator, stats) {
    if (!this._config.collection.validation) return;

    await this.recordEvent('validation_run', {
      validator,
      itemsChecked: stats.total,
      issuesFound: stats.errors,
      issueTypes: stats.errorTypes,
      autoFixed: stats.autoFixed
    });
  }

  /**
   * Record performance metric
   */
  async recordPerformance(operation, duration, metadata) {
    if (!this._config.collection.performance) return;

    await this.recordEvent('performance_metric', {
      operation,
      duration_ms: duration,
      ...metadata
    });
  }

  /**
   * Anonymize sensitive data
   */
  async anonymizeData(data) {
    const anonymized = { ...data };

    if (this._config.privacy.anonymizeFilePaths && data.filePath) {
      // Replace actual paths with hashed versions
      anonymized.filePath = this.hashValue(data.filePath);
    }

    if (this._config.privacy.anonymizeProjectInfo && data.projectName) {
      anonymized.projectName = this.hashValue(data.projectName);
    }

    // Remove any potential PII
    delete anonymized.username;
    delete anonymized.email;
    delete anonymized.ipAddress;

    return anonymized;
  }

  /**
   * Hash a value for anonymization
   */
  hashValue(value) {
    return crypto
      .createHmac('sha256', this._config.privacy.saltForHashing)
      .update(value)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Append event to cache
   */
  async appendToCache(event) {
    let cache = [];

    if (await fs.pathExists(this.cacheFile)) {
      cache = await fs.readJson(this.cacheFile);
    }

    cache.push(event);

    // Limit cache size
    if (cache.length > 1000) {
      cache = cache.slice(-1000);
    }

    await fs.writeJson(this.cacheFile, cache, { spaces: 2 });
  }

  /**
   * Get pending events for sync
   */
  async getPendingEvents() {
    if (!(await fs.pathExists(this.cacheFile))) {
      return [];
    }

    return await fs.readJson(this.cacheFile);
  }

  /**
   * Clear pending events after successful sync
   */
  async clearCache() {
    if (await fs.pathExists(this.cacheFile)) {
      await fs.remove(this.cacheFile);
    }
  }

  /**
   * Get local insights from cached events
   */
  async getInsights() {
    const events = await this.getPendingEvents();

    if (events.length === 0) {
      return {
        message:
          'No data collected yet. Continue using SC to generate insights.',
        stats: {}
      };
    }

    // Analyze command usage
    const commandCounts = {};
    events
      .filter((e) => e.type === 'command_executed')
      .forEach((e) => {
        const cmd = e.data.subcommand
          ? `${e.data.command} ${e.data.subcommand}`
          : e.data.command;
        commandCounts[cmd] = (commandCounts[cmd] || 0) + 1;
      });

    const sortedCommands = Object.entries(commandCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // Analyze common issues
    const issueTypes = {};
    events
      .filter((e) => e.type === 'validation_run')
      .forEach((e) => {
        if (e.data.issueTypes) {
          e.data.issueTypes.forEach((type) => {
            issueTypes[type] = (issueTypes[type] || 0) + 1;
          });
        }
      });

    const sortedIssues = Object.entries(issueTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return {
      totalEvents: events.length,
      dateRange: {
        start: events[0]?.timestamp,
        end: events[events.length - 1]?.timestamp
      },
      mostUsedCommands: sortedCommands,
      commonIssues: sortedIssues,
      averageCommandDuration: this.calculateAverageDuration(events)
    };
  }

  /**
   * Calculate average command duration
   */
  calculateAverageDuration(events) {
    const durations = events
      .filter((e) => e.type === 'command_executed' && e.data.duration_ms)
      .map((e) => e.data.duration_ms);

    if (durations.length === 0) return 0;

    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  /**
   * Get SC version
   */
  async getSCVersion() {
    try {
      const packageJson = path.join(__dirname, '../../package.json');
      const pkg = await fs.readJson(packageJson);
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get telemetry service instance
 */
function getTelemetryService() {
  if (!instance) {
    instance = new TelemetryService();
  }
  return instance;
}

module.exports = {
  TelemetryService,
  getTelemetryService,

  // Convenience methods
  isEnabled: async () => await getTelemetryService().isEnabled(),
  recordCommand: async (...args) =>
    await getTelemetryService().recordCommand(...args),
  recordRuleCheck: async (...args) =>
    await getTelemetryService().recordRuleCheck(...args),
  recordValidation: async (...args) =>
    await getTelemetryService().recordValidation(...args),
  recordPerformance: async (...args) =>
    await getTelemetryService().recordPerformance(...args)
};
