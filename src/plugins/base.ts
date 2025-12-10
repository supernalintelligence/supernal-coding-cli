/**
 * Base Plugin Interface
 *
 * All plugins must implement this interface to be discovered and used
 * by the `sc connect` command and dashboard.
 */

export interface PluginCapabilities {
  auth: string[];
  browse: boolean;
  import: boolean;
  export: boolean;
  sync: boolean;
  webhook: boolean;
  [key: string]: unknown;
}

export interface PluginCredentials {
  required: string[];
  optional: string[];
  [key: string]: unknown;
}

export interface PluginCommand {
  description?: string;
  args?: string[];
  options?: Record<string, unknown>;
  handler?: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  capabilities: PluginCapabilities;
  commands: Record<string, PluginCommand | Record<string, PluginCommand>>;
  credentials: PluginCredentials;
  createClient?: ((...args: unknown[]) => unknown) | null;
}

export interface PluginConfig {
  id: string;
  name: string;
  description?: string;
  version?: string;
  icon?: string;
  capabilities?: Partial<PluginCapabilities>;
  commands?: Record<string, PluginCommand | Record<string, PluginCommand>>;
  credentials?: Partial<PluginCredentials>;
  createClient?: ((...args: unknown[]) => unknown) | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that a plugin implements the required interface
 */
export function validatePlugin(plugin: Partial<Plugin>): ValidationResult {
  const errors: string[] = [];

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

  if (plugin.capabilities) {
    if (plugin.capabilities.auth && !Array.isArray(plugin.capabilities.auth)) {
      errors.push('capabilities.auth must be an array');
    }
  }

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
 */
export function createPlugin(config: PluginConfig): Plugin {
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
