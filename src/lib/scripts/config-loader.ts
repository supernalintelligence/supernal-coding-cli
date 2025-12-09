/**
 * Legacy Config Loader - DEPRECATED
 * Use supernal-code-package/lib/cli/utils/config-loader.js instead
 *
 * This file kept for backward compatibility only.
 * Redirects to new YAML-based loader.
 */

const { loadProjectConfig } = require('../cli/utils/config-loader');

/**
 * Load configuration from supernal.yaml
 * @param {string} configFileName - Ignored, always loads supernal.yaml
 * @returns {Object} Configuration object
 */
function load(_configFileName = 'supernal.yaml') {
  const projectRoot = process.cwd();
  console.warn(
    '⚠️  Using deprecated config-loader. Use cli/utils/config-loader instead'
  );
  return loadProjectConfig(projectRoot);
}

module.exports = { load };
