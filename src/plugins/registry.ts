/**
 * Plugin Registry
 * 
 * Auto-discovers and manages plugins for the `sc connect` command.
 * Plugins are discovered from subdirectories of lib/plugins/.
 */

const fs = require('fs');
const path = require('path');
const { validatePlugin } = require('./base');

class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.pluginsDir = __dirname;
    this.initialized = false;
  }

  /**
   * Auto-discover plugins from the plugins directory
   * Each subdirectory with an index.js is treated as a plugin
   */
  discover() {
    if (this.initialized) {
      return this.plugins;
    }

    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip non-directories and internal files
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('_')) continue;
      if (entry.name === 'node_modules') continue;

      const pluginPath = path.join(this.pluginsDir, entry.name);
      const indexPath = path.join(pluginPath, 'index.js');

      // Check if plugin has an index.js
      if (!fs.existsSync(indexPath)) continue;

      try {
        const plugin = require(indexPath);
        const validation = validatePlugin(plugin);

        if (validation.valid) {
          this.plugins.set(plugin.id, {
            ...plugin,
            _path: pluginPath
          });
        } else {
          console.warn(
            `Plugin "${entry.name}" failed validation:`,
            validation.errors.join(', ')
          );
        }
      } catch (err) {
        // Only warn if it looks like a real plugin (has package.json or other plugin files)
        const hasPackageJson = fs.existsSync(path.join(pluginPath, 'package.json'));
        const hasCommands = fs.existsSync(path.join(pluginPath, 'commands'));
        
        if (hasPackageJson || hasCommands) {
          console.warn(`Failed to load plugin from "${entry.name}":`, err.message);
        }
      }
    }

    this.initialized = true;
    return this.plugins;
  }

  /**
   * Get a plugin by ID
   * @param {string} id - Plugin ID
   * @returns {Object|undefined}
   */
  get(id) {
    this.discover();
    return this.plugins.get(id);
  }

  /**
   * Check if a plugin exists
   * @param {string} id - Plugin ID
   * @returns {boolean}
   */
  has(id) {
    this.discover();
    return this.plugins.has(id);
  }

  /**
   * List all discovered plugins
   * @returns {Object[]}
   */
  list() {
    this.discover();
    return Array.from(this.plugins.values()).map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      version: plugin.version,
      capabilities: plugin.capabilities
    }));
  }

  /**
   * Get plugin IDs
   * @returns {string[]}
   */
  ids() {
    this.discover();
    return Array.from(this.plugins.keys());
  }

  /**
   * Get plugins that support a specific capability
   * @param {string} capability - Capability name (browse, import, sync, etc.)
   * @returns {Object[]}
   */
  withCapability(capability) {
    this.discover();
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.capabilities && plugin.capabilities[capability]
    );
  }

  /**
   * Reset the registry (useful for testing)
   */
  reset() {
    this.plugins.clear();
    this.initialized = false;
  }
}

// Export singleton instance
const registry = new PluginRegistry();

module.exports = registry;
module.exports.PluginRegistry = PluginRegistry;

