/**
 * Configuration Validation for Monitor
 * 
 * Validates monitor configuration in supernal.yaml
 */

const monitorConfigSchema = {
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
      minimum: 10000, // 10 seconds minimum
      default: 60000  // 1 minute default
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

/**
 * Validate monitor configuration
 * @param {object} config - Monitor configuration object
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateMonitorConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Monitor configuration must be an object'] };
  }

  // Validate repos
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

  // Validate watch actions (optional)
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

        // Validate type enum
        const validTypes = ['push', 'issue-response', 'ci-failure', 'ci-status'];
        if (watch.type && !validTypes.includes(watch.type)) {
          errors.push(
            `monitor.watch[${index}].type must be one of: ${validTypes.join(', ')}`
          );
        }

        // Validate action enum
        const validActions = ['run-tests', 'validate', 'notify', 'create-issue'];
        if (watch.action && !validActions.includes(watch.action)) {
          errors.push(
            `monitor.watch[${index}].action must be one of: ${validActions.join(', ')}`
          );
        }
      });
    }
  }

  // Validate pollInterval (optional)
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

/**
 * Generate example configuration
 * @returns {object}
 */
function generateExampleConfig() {
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
