/**
 * Base Plugin Interface
 * 
 * All plugins must implement this interface to be discovered and used
 * by the `sc connect` command and dashboard.
 */

/**
 * @typedef {Object} PluginCapabilities
 * @property {string[]} auth - Supported auth methods: 'api-token', 'oauth2', 'pat'
 * @property {boolean} browse - Can browse/list content
 * @property {boolean} import - Can import content as iResources
 * @property {boolean} export - Can export/push content
 * @property {boolean} sync - Supports bidirectional sync
 * @property {boolean} webhook - Supports webhook notifications
 */

/**
 * @typedef {Object} PluginCredentials
 * @property {string[]} required - Required credential fields
 * @property {string[]} [optional] - Optional credential fields
 */

/**
 * @typedef {Object} PluginCommand
 * @property {string} description - Command description
 * @property {string[]} [args] - Expected arguments
 * @property {Object} [options] - Command options
 * @property {Function} handler - Command handler function
 */

/**
 * @typedef {Object} Plugin
 * @property {string} id - Unique plugin identifier (lowercase, no spaces)
 * @property {string} name - Display name
 * @property {string} description - Plugin description
 * @property {string} version - Plugin version
 * @property {string} [icon] - Icon name for dashboard
 * @property {PluginCapabilities} capabilities - What the plugin can do
 * @property {Object<string, PluginCommand|Object>} commands - CLI commands
 * @property {PluginCredentials} credentials - Credential requirements
 * @property {Function} [createClient] - Factory for API client
 */

/**
 * Validate that a plugin implements the required interface
 * @param {Object} plugin - Plugin to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePlugin(plugin) {
  const errors = [];
  
  // Required fields
  if (!plugin.id || typeof plugin.id !== 'string') {
    errors.push('Plugin must have a string "id" field');
  }
  if (!plugin.name || typeof plugin.name !== 'string') {
    errors.push('Plugin must have a string "name" field');
  }
  if (!plugin.description || typeof plugin.description !== 'string') {
    errors.push('Plugin must have a string "description" field');
  }
  if (!plugin.commands || typeof plugin.commands !== 'object') {
    errors.push('Plugin must have a "commands" object');
  }
  
  // Validate capabilities if present
  if (plugin.capabilities) {
    if (plugin.capabilities.auth && !Array.isArray(plugin.capabilities.auth)) {
      errors.push('capabilities.auth must be an array');
    }
  }
  
  // Validate credentials if present
  if (plugin.credentials) {
    if (plugin.credentials.required && !Array.isArray(plugin.credentials.required)) {
      errors.push('credentials.required must be an array');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a base plugin with defaults
 * @param {Partial<Plugin>} config - Plugin configuration
 * @returns {Plugin}
 */
function createPlugin(config) {
  return {
    id: config.id,
    name: config.name,
    description: config.description || '',
    version: config.version || '1.0.0',
    icon: config.icon || config.id,
    capabilities: {
      auth: config.capabilities?.auth || [],
      browse: config.capabilities?.browse ?? false,
      import: config.capabilities?.import ?? false,
      export: config.capabilities?.export ?? false,
      sync: config.capabilities?.sync ?? false,
      webhook: config.capabilities?.webhook ?? false,
      ...config.capabilities
    },
    commands: config.commands || {},
    credentials: {
      required: config.credentials?.required || [],
      optional: config.credentials?.optional || [],
      ...config.credentials
    },
    createClient: config.createClient || null
  };
}

module.exports = {
  validatePlugin,
  createPlugin
};

