/**
 * Configuration Validation for Monitor
 *
 * Validates monitor configuration in supernal.yaml
 */

export type WatchType = 'push' | 'issue-response' | 'ci-failure' | 'ci-status';
export type WatchAction = 'run-tests' | 'validate' | 'notify' | 'create-issue';

export interface RepoConfig {
  path: string;
  name?: string;
}

export interface WatchConfig {
  type: WatchType;
  action: WatchAction;
  config?: Record<string, unknown>;
}

export interface GithubIssuesConfig {
  labels?: string[];
  state?: 'open' | 'closed' | 'all';
}

export interface GithubConfig {
  issues?: GithubIssuesConfig;
}

export interface MonitorConfig {
  repos: RepoConfig[];
  watch?: WatchConfig[];
  pollInterval?: number;
  github?: GithubConfig;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const monitorConfigSchema = {
  type: 'object',
  required: ['repos'],
  properties: {
    repos: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            minLength: 1
          },
          name: {
            type: 'string'
          }
        }
      }
    },
    watch: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'action'],
        properties: {
          type: {
            type: 'string',
            enum: ['push', 'issue-response', 'ci-failure', 'ci-status']
          },
          action: {
            type: 'string',
            enum: ['run-tests', 'validate', 'notify', 'create-issue']
          },
          config: {
            type: 'object'
          }
        }
      }
    },
    pollInterval: {
      type: 'number',
      minimum: 10000,
      default: 60000
    },
    github: {
      type: 'object',
      properties: {
        issues: {
          type: 'object',
          properties: {
            labels: {
              type: 'array',
              items: { type: 'string' }
            },
            state: {
              type: 'string',
              enum: ['open', 'closed', 'all']
            }
          }
        }
      }
    }
  }
};

export function validateMonitorConfig(config: MonitorConfig | null | undefined): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Monitor configuration must be an object'] };
  }

  if (!config.repos || !Array.isArray(config.repos)) {
    errors.push('monitor.repos must be an array');
  } else if (config.repos.length === 0) {
    errors.push('monitor.repos cannot be empty');
  } else {
    config.repos.forEach((repo, index) => {
      if (!repo.path) {
        errors.push(`monitor.repos[${index}] must have a path`);
      }
      if (typeof repo.path !== 'string') {
        errors.push(`monitor.repos[${index}].path must be a string`);
      }
    });
  }

  if (config.watch !== undefined) {
    if (!Array.isArray(config.watch)) {
      errors.push('monitor.watch must be an array');
    } else {
      config.watch.forEach((watch, index) => {
        if (!watch.type) {
          errors.push(`monitor.watch[${index}] must have a type`);
        }
        if (!watch.action) {
          errors.push(`monitor.watch[${index}] must have an action`);
        }

        const validTypes: WatchType[] = ['push', 'issue-response', 'ci-failure', 'ci-status'];
        if (watch.type && !validTypes.includes(watch.type)) {
          errors.push(
            `monitor.watch[${index}].type must be one of: ${validTypes.join(', ')}`
          );
        }

        const validActions: WatchAction[] = ['run-tests', 'validate', 'notify', 'create-issue'];
        if (watch.action && !validActions.includes(watch.action)) {
          errors.push(
            `monitor.watch[${index}].action must be one of: ${validActions.join(', ')}`
          );
        }
      });
    }
  }

  if (config.pollInterval !== undefined) {
    if (typeof config.pollInterval !== 'number') {
      errors.push('monitor.pollInterval must be a number');
    } else if (config.pollInterval < 10000) {
      errors.push('monitor.pollInterval must be at least 10000ms (10 seconds)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function generateExampleConfig(): { monitor: MonitorConfig } {
  return {
    monitor: {
      repos: [
        { path: '.' },
        { path: 'apps/supernal-dashboard' }
      ],
      watch: [
        {
          type: 'push',
          action: 'run-tests'
        },
        {
          type: 'issue-response',
          action: 'validate'
        },
        {
          type: 'ci-failure',
          action: 'create-issue'
        }
      ],
      pollInterval: 60000,
      github: {
        issues: {
          labels: ['agent-request'],
          state: 'open'
        }
      }
    }
  };
}

module.exports = {
  monitorConfigSchema,
  validateMonitorConfig,
  generateExampleConfig
};
