/**
 * Legacy Config Loader - DEPRECATED
 * Use supernal-code-package/lib/cli/utils/config-loader.js instead
 *
 * This file kept for backward compatibility only.
 * Redirects to new YAML-based loader.
 */

import { loadProjectConfig } from '../cli/utils/config-loader';
import type { RawSupernalConfig } from '../types/config';

/**
 * Load configuration from supernal.yaml
 * @deprecated Use cli/utils/config-loader instead
 */
export function load(_configFileName = 'supernal.yaml'): RawSupernalConfig | null {
  const projectRoot = process.cwd();
  console.warn(
    '⚠️  Using deprecated config-loader. Use cli/utils/config-loader instead'
  );
  return loadProjectConfig(projectRoot);
}

/**
 * Get config object with load method
 * @deprecated Use cli/utils/config-loader instead
 */
export function getConfig(_projectRoot?: string): { load: () => RawSupernalConfig | null } {
  return {
    load: () => load()
  };
}

module.exports = { load, getConfig };
