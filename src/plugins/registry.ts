/**
 * Plugin Registry
 *
 * Auto-discovers and manages plugins for the `sc connect` command.
 * Plugins are discovered from subdirectories of lib/plugins/.
 */

import fs from 'node:fs';
import path from 'node:path';
const { validatePlugin } = require('./base');

interface PluginCapabilities {
  auth?: string[];
  browse?: boolean;
  import?: boolean;
  export?: boolean;
  sync?: boolean;
  webhook?: boolean;
}

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: PluginCapabilities;
  _path?: string;
}

interface PluginInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: PluginCapabilities;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

class PluginRegistry {
  protected plugins: Map<string, Plugin>;
  protected pluginsDir: string;
  protected initialized: boolean;

  constructor() {
    this.plugins = new Map();
    this.pluginsDir = __dirname;
    this.initialized = false;
  }

  discover(): Map<string, Plugin> {
    if (this.initialized) {
      return this.plugins;
    }

    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('_')) continue;
      if (entry.name === 'node_modules') continue;

      const pluginPath = path.join(this.pluginsDir, entry.name);
      const indexPath = path.join(pluginPath, 'index.js');

      if (!fs.existsSync(indexPath)) continue;

      try {
        const plugin = require(indexPath);
        const validation: ValidationResult = validatePlugin(plugin);

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
        const hasPackageJson = fs.existsSync(path.join(pluginPath, 'package.json'));
        const hasCommands = fs.existsSync(path.join(pluginPath, 'commands'));

        if (hasPackageJson || hasCommands) {
          console.warn(`Failed to load plugin from "${entry.name}":`, (err as Error).message);
        }
      }
    }

    this.initialized = true;
    return this.plugins;
  }

  get(id: string): Plugin | undefined {
    this.discover();
    return this.plugins.get(id);
  }

  has(id: string): boolean {
    this.discover();
    return this.plugins.has(id);
  }

  list(): PluginInfo[] {
    this.discover();
    return Array.from(this.plugins.values()).map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      version: plugin.version,
      capabilities: plugin.capabilities
    }));
  }

  ids(): string[] {
    this.discover();
    return Array.from(this.plugins.keys());
  }

  withCapability(capability: keyof PluginCapabilities): Plugin[] {
    this.discover();
    return Array.from(this.plugins.values()).filter(
      (plugin) => plugin.capabilities && plugin.capabilities[capability]
    );
  }

  reset(): void {
    this.plugins.clear();
    this.initialized = false;
  }
}

const registry = new PluginRegistry();

export default registry;
export { PluginRegistry };

module.exports = registry;
module.exports.PluginRegistry = PluginRegistry;
