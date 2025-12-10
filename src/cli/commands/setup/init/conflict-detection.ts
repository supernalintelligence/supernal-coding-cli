// @ts-nocheck
const _chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');

/**
 * Get directory contents recursively
 * @param {string} dirPath - Directory path
 * @returns {Promise<Array>} Array of file objects with name and path
 */
async function getDirectoryContentsRecursive(dirPath) {
  if (!(await fs.pathExists(dirPath))) {
    return [];
  }

  const files = [];
  const items = await fs.readdir(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = await fs.stat(itemPath);

    if (stat.isFile()) {
      files.push({
        name: item,
        path: itemPath,
        relativePath: path.relative(dirPath, itemPath),
      });
    } else if (stat.isDirectory()) {
      const subFiles = await getDirectoryContentsRecursive(itemPath);
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * Detect installation conflicts with existing files and directories
 * @param {string} targetDir - Target installation directory
 * @param {Object} activeFeatures - Active features configuration
 * @returns {Promise<Object>} Conflict detection results
 */
async function detectInstallationConflicts(targetDir, _activeFeatures) {
  const conflicts = [];

  // Check for existing MCP configuration
  const mcpConfigPath = path.join(targetDir, '.cursor/mcp.json');
  if (await fs.pathExists(mcpConfigPath)) {
    const existingMcp = await fs.readJSON(mcpConfigPath);
    if (existingMcp.mcpServers) {
      // Check for conflicting MCP servers
      const ourServers = [
        'supernal-coding',
        'playwright',
        'testing-tools',
        'test-runner',
      ];
      const conflictingServers = ourServers.filter(
        (server) => existingMcp.mcpServers[server]
      );

      if (conflictingServers.length > 0) {
        conflicts.push({
          type: 'MCP Server',
          path: mcpConfigPath,
          description: `MCP servers already configured: ${conflictingServers.join(', ')}`,
          severity: 'warning',
          canOverwrite: true,
        });
      }
    }
  }

  // Check for global MCP configuration conflicts
  try {
    const os = require('node:os');
    const globalMcpPath = path.join(os.homedir(), '.cursor/mcp.json');
    if (await fs.pathExists(globalMcpPath)) {
      const globalMcp = await fs.readJSON(globalMcpPath);
      if (globalMcp.mcpServers?.['supernal-coding']) {
        conflicts.push({
          type: 'Global MCP Server',
          path: globalMcpPath,
          description: 'supernal-coding MCP server already configured globally',
          severity: 'error',
          canOverwrite: false,
        });
      }
    }
  } catch (_error) {
    // Global MCP check failed, but don't block installation
    // This might happen in restricted environments
  }

  // Check for existing cursor rules
  const cursorRulesPath = path.join(targetDir, '.cursor/rules');
  if (await fs.pathExists(cursorRulesPath)) {
    const existingRules = await fs.readdir(cursorRulesPath);
    if (existingRules.length > 0) {
      conflicts.push({
        type: 'Cursor Rules',
        path: cursorRulesPath,
        description: `${existingRules.length} existing cursor rules found`,
        severity: 'warning',
        canOverwrite: true,
        details: existingRules.slice(0, 5), // Show first 5 files
      });
    }
  }

  // Check for existing configuration files
  const configFiles = [
    '.supernal-config.json',
    'supernal.yaml',
    '.supernal-coding/config.json',
  ];

  for (const configFile of configFiles) {
    const configPath = path.join(targetDir, configFile);
    if (await fs.pathExists(configPath)) {
      conflicts.push({
        type: 'Configuration',
        path: configPath,
        description: `Configuration file already exists: ${configFile}`,
        severity: 'error',
        canOverwrite: true,
      });
    }
  }

  // Special handling for package.json - only conflict for merge analysis, not blocking
  // (package.json is expected to exist in projects, we just need to analyze it for --merge)
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const pkg = await fs.readJSON(packageJsonPath);
      // Only report as conflict if it has scripts that might conflict with ours
      if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
        conflicts.push({
          type: 'Configuration',
          path: packageJsonPath,
          description: `package.json with ${Object.keys(pkg.scripts).length} scripts exists`,
          severity: 'warning', // Warning not error - package.json should exist
          canOverwrite: true,
        });
      }
    } catch (_error) {
      // Ignore invalid package.json
    }
  }

  // Check for existing directories with content
  const directories = ['scripts', 'templates', 'tests'];
  for (const dir of directories) {
    const dirPath = path.join(targetDir, dir);
    if (await fs.pathExists(dirPath)) {
      const contents = await fs.readdir(dirPath);
      if (contents.length > 0) {
        conflicts.push({
          type: 'Directory',
          path: dirPath,
          description: `Non-empty directory: ${dir} (${contents.length} files)`,
          severity: 'warning',
          canOverwrite: false,
          details: contents.slice(0, 3), // Show first 3 files
        });
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    warnings: conflicts.filter((c) => c.severity === 'warning'),
    errors: conflicts.filter((c) => c.severity === 'error'),
  };
}

/**
 * Analyze merge compatibility for conflicts
 * @param {string} targetDir - Target directory
 * @param {Array} conflicts - Array of conflicts
 * @param {Object} activeFeatures - Active features
 * @returns {Promise<Object>} Merge analysis results
 */
async function analyzeMergeCompatibility(targetDir, conflicts, activeFeatures) {
  const analysis = {
    canMerge: true,
    mergeActions: [],
    warnings: [],
    blockingConflicts: [],
  };

  // Get what supernal-code would install
  const sourceTemplatesDir = await findSourceTemplatesDir();
  const sourceScriptsDir = await findSourceScriptsDir();

  for (const conflict of conflicts) {
    const conflictPath = conflict.path;
    const relativePath = path.relative(targetDir, conflictPath);

    switch (conflict.type) {
      case 'Directory':
        if (relativePath === 'scripts') {
          const scriptsAnalysis = await analyzeScriptsDirectoryMerge(
            conflictPath,
            sourceScriptsDir
          );
          if (scriptsAnalysis.canMerge) {
            analysis.mergeActions.push({
              type: 'Scripts Merge',
              description: `Merge scripts directory (${scriptsAnalysis.newFiles.length} new files)`,
              details: scriptsAnalysis,
            });
            analysis.warnings.push(...scriptsAnalysis.warnings);
          } else {
            analysis.blockingConflicts.push({
              type: 'Scripts Conflict',
              description: scriptsAnalysis.reason,
              path: conflictPath,
            });
            analysis.canMerge = false;
          }
        } else if (relativePath === 'templates') {
          const templatesAnalysis = await analyzeTemplatesDirectoryMerge(
            conflictPath,
            sourceTemplatesDir
          );
          if (templatesAnalysis.canMerge) {
            analysis.mergeActions.push({
              type: 'Templates Merge',
              description: `Merge templates directory (${templatesAnalysis.newFiles.length} new files)`,
              details: templatesAnalysis,
            });
            analysis.warnings.push(...templatesAnalysis.warnings);
          } else {
            analysis.blockingConflicts.push({
              type: 'Templates Conflict',
              description: templatesAnalysis.reason,
              path: conflictPath,
            });
            analysis.canMerge = false;
          }
        } else if (['tests', 'kanban', 'requirements'].includes(relativePath)) {
          // Protected directories - always preserved during merge
          analysis.mergeActions.push({
            type: 'Protected Directory',
            description: `${relativePath}/ will be preserved`,
            path: conflictPath,
          });
        }
        break;

      case 'Configuration': {
        const configAnalysis = await analyzeConfigurationMerge(conflictPath);
        if (configAnalysis.canMerge) {
          analysis.mergeActions.push({
            type: 'Configuration Merge',
            description: configAnalysis.description,
            details: configAnalysis,
          });
          analysis.warnings.push(...configAnalysis.warnings);
        } else {
          analysis.blockingConflicts.push({
            type: 'Configuration Conflict',
            description: configAnalysis.reason,
            path: conflictPath,
          });
          analysis.canMerge = false;
        }
        break;
      }

      case 'Cursor Rules': {
        const rulesAnalysis = await analyzeCursorRulesMerge(
          conflictPath,
          activeFeatures
        );
        analysis.mergeActions.push({
          type: 'Cursor Rules Merge',
          description: rulesAnalysis.description,
          details: rulesAnalysis,
        });
        analysis.warnings.push(...rulesAnalysis.warnings);
        break;
      }

      case 'MCP Server':
        analysis.mergeActions.push({
          type: 'MCP Server Merge',
          description: 'Merge MCP server configurations',
          details: conflict,
        });
        analysis.warnings.push(
          'Existing MCP servers will be preserved, new ones will be added'
        );
        break;
    }
  }

  return analysis;
}

/**
 * Analyze scripts directory merge compatibility
 * @param {string} existingScriptsDir - Existing scripts directory
 * @param {string} sourceScriptsDir - Source scripts directory
 * @returns {Promise<Object>} Scripts merge analysis
 */
async function analyzeScriptsDirectoryMerge(
  existingScriptsDir,
  sourceScriptsDir
) {
  if (!sourceScriptsDir || !(await fs.pathExists(sourceScriptsDir))) {
    return {
      canMerge: true,
      newFiles: [],
      existingFiles: [],
      warnings: [
        'No source scripts directory found - no scripts will be added',
      ],
    };
  }

  const existingFiles = await getDirectoryContentsRecursive(existingScriptsDir);
  const sourceFiles = await getDirectoryContentsRecursive(sourceScriptsDir);

  // Check for name conflicts
  const existingNames = new Set(existingFiles.map((f) => f.name));
  const conflictingFiles = sourceFiles.filter((f) => existingNames.has(f.name));

  if (conflictingFiles.length > 0) {
    // Check for functional conflicts
    const functionalConflicts = detectFunctionalConflicts(
      existingFiles,
      sourceFiles
    );

    return {
      canMerge: false,
      reason: `Script name conflicts: ${conflictingFiles.map((f) => f.name).join(', ')}`,
      conflicts: conflictingFiles.map((f) => f.name),
      conflictingFiles,
      functionalConflicts,
      existingFiles,
      sourceFiles,
    };
  }

  // Check for functional conflicts even when no name conflicts
  const functionalConflicts = detectFunctionalConflicts(
    existingFiles,
    sourceFiles
  );

  return {
    canMerge: true,
    newFiles: sourceFiles,
    existingFiles,
    conflicts: [],
    warnings:
      functionalConflicts.length > 0
        ? [
            `Potential functional conflicts detected: ${functionalConflicts.join('; ')}`,
          ]
        : [],
  };
}

/**
 * Analyze templates directory merge compatibility
 * @param {string} existingTemplatesDir - Existing templates directory
 * @param {string} sourceTemplatesDir - Source templates directory
 * @returns {Promise<Object>} Templates merge analysis
 */
async function analyzeTemplatesDirectoryMerge(
  existingTemplatesDir,
  sourceTemplatesDir
) {
  if (!sourceTemplatesDir || !(await fs.pathExists(sourceTemplatesDir))) {
    return {
      canMerge: true,
      newFiles: [],
      existingFiles: [],
      warnings: [
        'No source templates directory found - no templates will be added',
      ],
    };
  }

  const existingFiles =
    await getDirectoryContentsRecursive(existingTemplatesDir);
  const sourceFiles = await getDirectoryContentsRecursive(sourceTemplatesDir);

  // Check for name conflicts
  const existingNames = new Set(existingFiles.map((f) => f.name));
  const conflictingFiles = sourceFiles.filter((f) => existingNames.has(f.name));

  if (conflictingFiles.length > 0) {
    return {
      canMerge: false,
      reason: `Template name conflicts: ${conflictingFiles.map((f) => f.name).join(', ')}`,
      conflicts: conflictingFiles.map((f) => f.name),
      conflictingFiles,
      existingFiles,
      sourceFiles,
    };
  }

  return {
    canMerge: true,
    newFiles: sourceFiles,
    existingFiles,
    conflicts: [],
    warnings: [],
  };
}

/**
 * Analyze configuration file merge compatibility
 * @param {string} configPath - Configuration file path
 * @returns {Promise<Object>} Configuration merge analysis
 */
async function analyzeConfigurationMerge(configPath) {
  const fileName = path.basename(configPath);

  switch (fileName) {
    case 'package.json':
      // Check if package.json exists and analyze for conflicts
      if (await fs.pathExists(configPath)) {
        try {
          const pkg = await fs.readJson(configPath);
          const warnings = [];

          if (pkg.scripts) {
            warnings.push(
              'Existing scripts section will be preserved and merged with supernal-code scripts'
            );
          }
          if (pkg.dependencies || pkg.devDependencies) {
            warnings.push('Existing dependencies will be preserved');
          }

          return {
            canMerge: true,
            description: 'package.json can be merged safely',
            warnings,
            existingPackage: pkg,
          };
        } catch (error) {
          return {
            canMerge: false,
            reason: `Invalid package.json format: ${error.message}`,
          };
        }
      }
      break;

    case 'supernal.yaml':
    case '.supernal-config.json':
      // In merge mode, preserve existing config and continue installation
      return {
        canMerge: true,
        description: `${fileName} already exists and will be preserved`,
        warnings: [
          `Existing ${fileName} will be used (not overwritten)`,
          'Installation will continue to add missing directories and templates',
        ],
        action: 'preserve',
      };

    default:
      return {
        canMerge: true,
        description: `Configuration file ${fileName} can be overwritten`,
        warnings: [`Existing ${fileName} will be backed up`],
      };
  }

  return {
    canMerge: true,
    description: 'Configuration can be merged',
    warnings: [],
  };
}

/**
 * Analyze cursor rules merge compatibility
 * @param {string} cursorRulesPath - Cursor rules directory path
 * @param {Object} activeFeatures - Active features
 * @returns {Promise<Object>} Cursor rules merge analysis
 */
async function analyzeCursorRulesMerge(cursorRulesPath, _activeFeatures) {
  if (!(await fs.pathExists(cursorRulesPath))) {
    return {
      canMerge: true,
      description: 'Cursor rules directory will be created',
      conflictingRules: [],
      warnings: [],
    };
  }

  // Get existing rules
  const existingRules = await fs.readdir(cursorRulesPath);
  const existingRuleFiles = existingRules.filter(
    (file) => file.endsWith('.md') || file.endsWith('.mdc')
  );

  // Common supernal-code rule files that might conflict
  const supernalRules = [
    'agent-hand-off.mdc',
    'dev_workflow.mdc',
    'avoid-anti-patterns.mdc',
    'testing-strategy.mdc',
    'self-improve.mdc',
  ];

  const conflictingRules = supernalRules.filter((rule) =>
    existingRuleFiles.includes(rule)
  );

  return {
    canMerge: true,
    description: `Can merge cursor rules (${conflictingRules.length} potential conflicts)`,
    conflictingRules,
    warnings:
      conflictingRules.length > 0
        ? [`Existing rules will be preserved: ${conflictingRules.join(', ')}`]
        : [],
  };
}

/**
 * Detect functional conflicts between existing and new files
 * @param {Array} existingFiles - Array of existing file objects
 * @param {Array} sourceFiles - Array of source file objects
 * @returns {Array} Array of functional conflict descriptions
 */
function detectFunctionalConflicts(existingFiles, sourceFiles) {
  // Simple heuristic: look for scripts with similar purposes based on names
  const functionalPatterns = {
    test: /test|spec/i,
    build: /build|compile/i,
    deploy: /deploy|publish/i,
    setup: /setup|install|init/i,
    validation: /validate|check|verify/i,
  };

  const conflicts = [];
  const existingCategories = new Set();

  // Categorize existing files
  existingFiles.forEach((file) => {
    for (const [category, pattern] of Object.entries(functionalPatterns)) {
      if (pattern.test(file.name)) {
        existingCategories.add(category);
      }
    }
  });

  // Check if new files would conflict functionally
  sourceFiles.forEach((file) => {
    for (const [category, pattern] of Object.entries(functionalPatterns)) {
      if (pattern.test(file.name) && existingCategories.has(category)) {
        conflicts.push(`${category} scripts`);
      }
    }
  });

  return [...new Set(conflicts)]; // Remove duplicates
}

/**
 * Resolve path to project root templates/scripts
 * This uses the SAME logic as docs-structure.js and other install modules
 * @param {string} subpath - Subpath within project (e.g., 'templates', 'scripts')
 * @returns {Promise<string|null>} Resolved path or null
 */
async function resolveProjectResourcePath(subpath) {
  // Standard path resolution from supernal-code-package/lib/cli/commands/setup/init
  // Going up to project root: init/ -> setup/ -> commands/ -> cli/ -> lib/ -> supernal-code-package/ -> PROJECT_ROOT
  const possiblePaths = [
    path.join(__dirname, '../../../../../../', subpath), // 6 levels up (correct for project root)
    path.join(__dirname, '../../../../../', subpath), // 5 levels up (supernal-code-package/)
    path.join(__dirname, '../../../../../../../', subpath), // 7 levels up (one more for safety)
  ];

  for (const possiblePath of possiblePaths) {
    if (await fs.pathExists(possiblePath)) {
      return possiblePath;
    }
  }

  return null;
}

/**
 * Find source templates directory
 * @returns {Promise<string|null>} Path to templates directory or null
 */
async function findSourceTemplatesDir() {
  return resolveProjectResourcePath('templates');
}

/**
 * Find source scripts directory
 * @returns {Promise<string|null>} Path to scripts directory or null
 */
async function findSourceScriptsDir() {
  return resolveProjectResourcePath('scripts');
}

module.exports = {
  detectInstallationConflicts,
  analyzeMergeCompatibility,
  analyzeScriptsDirectoryMerge,
  analyzeTemplatesDirectoryMerge,
  analyzeConfigurationMerge,
  analyzeCursorRulesMerge,
  detectFunctionalConflicts,
  findSourceTemplatesDir,
  findSourceScriptsDir,
  getDirectoryContentsRecursive,
};
