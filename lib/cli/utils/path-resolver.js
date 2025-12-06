const fs = require('node:fs');
const path = require('node:path');
const { findGitRoot } = require('./git-utils');
const { loadProjectConfig } = require('./config-loader');

/**
 * Supernal Coding state directory name
 * All state files (workflow, rules, consent, traceability, etc.) go here
 * Default value - should be overridden by supernal.yaml project.state_dir
 */
const DEFAULT_STATE_DIR = '.supernal-coding';

/**
 * Get state directory from config or use default
 * @param {string} projectRoot - Project root directory
 * @returns {string} State directory name
 */
function getStateDir(projectRoot) {
  try {
    const config = loadProjectConfig(projectRoot);
    return config?.project?.state_dir || DEFAULT_STATE_DIR;
  } catch (_error) {
    return DEFAULT_STATE_DIR;
  }
}

/**
 * Repository structure analyzer
 * @param {string} repoPath - Repository root path
 * @returns {Object} - Analyzed structure information
 */
function analyzeRepositoryStructure(repoPath) {
  const structure = {
    type: 'unknown',
    hasRequirements: false,
    hasKanban: false,
    hasWorkflowRules: false,
    hasTemplates: false,
    hasTests: false,
    hasDocs: false,
    directories: {},
    patterns: []
  };

  try {
    const items = fs.readdirSync(repoPath);

    // Detect common directory patterns
    const _commonDirs = [
      'requirements',
      'reqs',
      'specs',
      'docs/requirements',
      'kanban',
      'tasks',
      'workflow',
      'workflow-rules',
      'templates',
      'template',
      'tests',
      'test',
      'spec',
      'docs',
      'documentation',
      'readme'
    ];

    for (const item of items) {
      const itemPath = path.join(repoPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        structure.directories[item] = {
          path: itemPath,
          type: 'directory',
          contents: analyzeDirectoryContents(itemPath)
        };

        // Detect structure patterns
        if (['requirements', 'reqs', 'specs'].includes(item)) {
          structure.hasRequirements = true;
          structure.patterns.push('requirements');
        }

        if (['kanban', 'tasks', 'workflow'].includes(item)) {
          structure.hasKanban = true;
          structure.patterns.push('kanban');
        }

        if (['workflow-rules', 'rules', 'workflow'].includes(item)) {
          structure.hasWorkflowRules = true;
          structure.patterns.push('workflow-rules');
        }

        if (['templates', 'template'].includes(item)) {
          structure.hasTemplates = true;
          structure.patterns.push('templates');
        }

        if (['tests', 'test', 'spec'].includes(item)) {
          structure.hasTests = true;
          structure.patterns.push('tests');
        }

        if (['docs', 'documentation'].includes(item)) {
          structure.hasDocs = true;
          structure.patterns.push('docs');
        }
      }
    }

    // Determine repository type
    structure.type = determineRepositoryType(structure);
  } catch (error) {
    console.warn('Error analyzing repository structure:', error.message);
  }

  return structure;
}

/**
 * Analyze contents of a directory
 * @param {string} dirPath - Directory path
 * @returns {Array} - Directory contents analysis
 */
function analyzeDirectoryContents(dirPath) {
  try {
    const items = fs.readdirSync(dirPath);
    return items.map((item) => {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      return {
        name: item,
        type: stat.isDirectory() ? 'directory' : 'file',
        path: itemPath
      };
    });
  } catch (_error) {
    return [];
  }
}

/**
 * Determine repository type based on structure
 * @param {Object} structure - Repository structure analysis
 * @returns {string} - Repository type
 */
function determineRepositoryType(structure) {
  if (
    structure.hasRequirements &&
    structure.hasKanban &&
    structure.hasWorkflowRules
  ) {
    return 'supernal-coding';
  }

  if (structure.hasRequirements && structure.hasTests) {
    return 'requirements-driven';
  }

  if (structure.hasKanban && structure.hasTemplates) {
    return 'workflow-managed';
  }

  if (structure.hasTests && structure.hasDocs) {
    return 'documented-testing';
  }

  return 'standard';
}

/**
 * Find directory by pattern
 * @param {string} repoPath - Repository root path
 * @param {Array} patterns - Array of possible directory names
 * @returns {string|null} - Found directory path or null
 */
function findDirectoryByPattern(repoPath, patterns) {
  for (const pattern of patterns) {
    const dirPath = path.join(repoPath, pattern);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      return dirPath;
    }
  }
  return null;
}

/**
 * Resolve path dynamically based on repository structure
 * @param {string} pathType - Type of path to resolve
 * @param {string} repoPath - Repository root path (optional)
 * @returns {string|null} - Resolved path or null
 */
function resolvePath(pathType, repoPath = null) {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) {
    return null;
  }

  const _structure = analyzeRepositoryStructure(gitRoot);

  switch (pathType) {
    case 'requirements':
      return findDirectoryByPattern(gitRoot, [
        'requirements',
        'reqs',
        'specs',
        'docs/requirements',
        'supernal-coding/requirements'
      ]);

    case 'kanban':
      return findDirectoryByPattern(gitRoot, [
        'kanban',
        'tasks',
        'workflow',
        'supernal-coding/kanban'
      ]);

    case 'workflow-rules':
      return findDirectoryByPattern(gitRoot, [
        'workflow-rules',
        'rules',
        'workflow',
        'supernal-coding/workflow-rules'
      ]);

    case 'templates':
      return findDirectoryByPattern(gitRoot, [
        'templates',
        'template',
        'supernal-coding/templates'
      ]);

    case 'tests':
      return findDirectoryByPattern(gitRoot, [
        'tests',
        'test',
        'spec',
        'tests/requirements'
      ]);

    case 'docs':
      return findDirectoryByPattern(gitRoot, [
        'docs',
        'documentation',
        'supernal-coding/docs'
      ]);

    case 'config':
      return findDirectoryByPattern(gitRoot, [
        'supernal-coding',
        'config',
        getStateDir(gitRoot)
      ]);

    default:
      return null;
  }
}

/**
 * Get all resolved paths for a repository
 * @param {string} repoPath - Repository root path (optional)
 * @returns {Object} - All resolved paths
 */
function getAllResolvedPaths(repoPath = null) {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) {
    return null;
  }

  return {
    gitRoot,
    requirements: resolvePath('requirements', gitRoot),
    kanban: resolvePath('kanban', gitRoot),
    workflowRules: resolvePath('workflow-rules', gitRoot),
    templates: resolvePath('templates', gitRoot),
    tests: resolvePath('tests', gitRoot),
    docs: resolvePath('docs', gitRoot),
    config: resolvePath('config', gitRoot)
  };
}

/**
 * Create directory structure if it doesn't exist
 * @param {string} dirPath - Directory path to create
 * @param {boolean} recursive - Create parent directories
 * @returns {boolean} - Success status
 */
function ensureDirectoryExists(dirPath, recursive = true) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive });
    }
    return true;
  } catch (error) {
    console.error('Error creating directory:', error.message);
    return false;
  }
}

/**
 * Validate path resolution
 * @param {Object} paths - Resolved paths object
 * @returns {Object} - Validation results
 */
function validatePathResolution(paths) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    missing: []
  };

  if (!paths) {
    validation.isValid = false;
    validation.errors.push('No paths provided');
    return validation;
  }

  const requiredPaths = ['gitRoot', 'requirements', 'kanban'];
  const optionalPaths = ['workflowRules', 'templates', 'tests', 'docs'];

  // Check required paths
  for (const pathType of requiredPaths) {
    if (!paths[pathType]) {
      validation.isValid = false;
      validation.errors.push(`Missing required path: ${pathType}`);
      validation.missing.push(pathType);
    }
  }

  // Check optional paths
  for (const pathType of optionalPaths) {
    if (!paths[pathType]) {
      validation.warnings.push(`Missing optional path: ${pathType}`);
      validation.missing.push(pathType);
    }
  }

  return validation;
}

module.exports = {
  DEFAULT_STATE_DIR,
  getStateDir,
  analyzeRepositoryStructure,
  findDirectoryByPattern,
  resolvePath,
  getAllResolvedPaths,
  ensureDirectoryExists,
  validatePathResolution,
  determineRepositoryType
};
