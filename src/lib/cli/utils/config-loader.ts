/**
 * Unified Configuration Loader
 *
 * Loads supernal.yaml (Renaissance config system)
 * NO magic strings - all paths from configuration
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Load project configuration from supernal.yaml
 * @param {string} projectRoot - Project root directory
 * @param {Object} options - Options { silent: boolean }
 * @returns {Object|null} Configuration object or null
 */
function loadProjectConfig(projectRoot, options = {}) {
  const supernalPath = path.join(projectRoot, 'supernal.yaml');
  if (fs.existsSync(supernalPath)) {
    try {
      const yaml = require('js-yaml');
      const content = fs.readFileSync(supernalPath, 'utf8');
      const config = yaml.load(content);
      config._source = 'supernal.yaml';
      return config;
    } catch (error) {
      console.error('Failed to parse supernal.yaml:', error.message);
      throw error;
    }
  }

  // No configuration found - only show error if not silent
  if (!options.silent) {
    console.error('');
    console.error('❌ No supernal.yaml configuration found');
    console.error('   Run: sc init to create configuration');
    console.error('');
  }
  return null;
}

/**
 * Normalize a path from config - converts absolute paths to relative
 * IMPORTANT: path.join does NOT handle absolute second arguments correctly!
 * path.join('/a', '/b') returns '/a/b', NOT '/b'
 * This function ensures paths are relative so path.join works correctly.
 * @param {string} configPath - Path from config (could be absolute or relative)
 * @param {string} defaultPath - Default relative path
 * @returns {string} Relative path
 */
function normalizeConfigPath(configPath, defaultPath) {
  if (!configPath) return defaultPath;

  // If path is absolute, warn and extract just the relative portion
  if (path.isAbsolute(configPath)) {
    // Extract the last meaningful part (after last occurrence of common prefixes)
    // For '/Users/foo/git/project/docs' -> 'docs'
    const parts = configPath.split(path.sep);
    // Find 'docs', 'requirements', etc. in the path
    const knownDirs = [
      'docs',
      'requirements',
      'kanban',
      'adr',
      'planning',
      'architecture',
      'sessions',
      'handoffs',
      'compliance',
      'features'
    ];
    for (let i = parts.length - 1; i >= 0; i--) {
      if (knownDirs.includes(parts[i])) {
        const relativePath = parts.slice(i).join(path.sep);
        console.warn(`⚠️  Config contains absolute path: ${configPath}`);
        console.warn(`   Converted to relative: ${relativePath}`);
        console.warn(
          `   Fix: Update supernal.yaml to use relative paths (e.g., '${relativePath}')`
        );
        return relativePath;
      }
    }
    // Fallback: just use the last segment
    const lastSegment = parts[parts.length - 1];
    console.warn(`⚠️  Config contains absolute path: ${configPath}`);
    console.warn(`   Using last segment: ${lastSegment}`);
    return lastSegment;
  }

  return configPath;
}

/**
 * Get documentation paths from config (supernal.yaml)
 * @param {Object} config - Configuration object from loadProjectConfig
 * @returns {Object} Paths object (always relative paths)
 */
function getDocPaths(config) {
  if (!config) {
    // No config, return defaults
    return {
      docs: 'docs',
      requirements: 'docs/requirements',
      kanban: 'docs/planning/kanban',
      adr: 'docs/adr',
      planning: 'docs/planning',
      architecture: 'docs/architecture',
      sessions: 'docs/sessions',
      handoffs: 'docs/handoffs'
    };
  }

  if (config.documentation && config._source === 'supernal.yaml') {
    // New supernal.yaml format (ADR-001)
    // Normalize all paths to relative (absolute paths break path.join!)
    return {
      docs: normalizeConfigPath(config.project?.docs_dir, 'docs'),
      requirements: normalizeConfigPath(
        config.project?.requirements_dir,
        'docs/requirements'
      ),
      kanban: normalizeConfigPath(
        config.documentation.kanban_dir,
        'docs/planning/kanban'
      ),
      adr: normalizeConfigPath(config.documentation.adr_dir, 'docs/adr'),
      planning: normalizeConfigPath(
        config.documentation.planning_dir,
        'docs/planning'
      ),
      architecture: normalizeConfigPath(
        config.documentation.architecture_dir,
        'docs/architecture'
      ),
      sessions: normalizeConfigPath(
        config.documentation.sessions_dir,
        'docs/sessions'
      ),
      handoffs: normalizeConfigPath(
        config.documentation.handoffs_dir,
        'docs/handoffs'
      )
    };
  }

  // Fallback defaults
  return {
    docs: 'docs',
    requirements: 'docs/requirements',
    kanban: 'docs/planning/kanban',
    adr: 'docs/adr',
    planning: 'docs/planning',
    architecture: 'docs/architecture',
    sessions: 'docs/sessions',
    handoffs: 'docs/handoffs'
  };
}

/**
 * Get all planning phase paths from config
 * @param {Object} config - Configuration object
 * @returns {Object} Planning phase paths
 */
function getPlanningPhasePaths(config) {
  if (
    config?.documentation?.planning_phases &&
    config._source === 'supernal.yaml'
  ) {
    return config.documentation.planning_phases;
  }

  // Defaults per ADR-001
  return {
    startup: 'docs/planning/startup',
    demo: 'docs/planning/demo',
    mvp: 'docs/planning/mvp',
    production: 'docs/planning/production',
    templates: 'docs/planning/templates'
  };
}

/**
 * Get planning lifecycle paths from config
 * @param {Object} config - Configuration object
 * @returns {Object} Planning lifecycle paths
 */
function getPlanningLifecyclePaths(config) {
  if (
    config?.documentation?.planning_lifecycle &&
    config._source === 'supernal.yaml'
  ) {
    return config.documentation.planning_lifecycle;
  }

  // Defaults
  return {
    backlog: 'docs/planning/backlog',
    review: 'docs/planning/review',
    active: 'docs/planning/active',
    complete: 'docs/planning/complete',
    archive: 'docs/planning/archive'
  };
}

/**
 * Get root whitelist from config
 * @param {Object} config - Configuration object
 * @returns {string[]} Whitelist array
 */
function getRootWhitelist(config) {
  if (
    config?.documentation?.root_whitelist &&
    config._source === 'supernal.yaml'
  ) {
    return config.documentation.root_whitelist;
  }

  // Default whitelist per ADR-001
  return [
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'LICENSE'
  ];
}

/**
 * Get workflow name from config
 * @param {Object} config - Configuration object
 * @returns {string|null} Workflow name
 */
function getWorkflowName(config) {
  if (config) {
    return config.workflow || null;
  }
  return null;
}

/**
 * Get project info from config
 * @param {Object} config - Configuration object
 * @returns {Object} Project info
 */
function getProjectInfo(config) {
  if (!config) {
    return {
      name: 'supernal-coding',
      description: ''
    };
  }

  if (config._source === 'supernal.yaml') {
    return {
      name: config.project?.name || 'supernal-coding',
      description: config.project?.description || '',
      version: config.version || '1.0.0'
    };
  }

  // Fallback defaults
  return {
    name: config.project?.name || 'supernal-coding',
    description: config.project?.description || '',
    version: '1.0.0'
  };
}

module.exports = {
  loadProjectConfig,
  getDocPaths,
  getPlanningPhasePaths,
  getPlanningLifecyclePaths,
  getRootWhitelist,
  getWorkflowName,
  getProjectInfo
};
