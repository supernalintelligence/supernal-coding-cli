/**
 * Plugin System Entry Point
 * 
 * Exports the plugin registry for use by CLI and dashboard.
 */

const registry = require('./registry');
const { validatePlugin, createPlugin } = require('./base');

module.exports = {
  registry,
  validatePlugin,
  createPlugin
};

