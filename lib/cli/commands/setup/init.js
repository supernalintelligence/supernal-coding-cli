/**
 * Main Init System Entry Point
 *
 * This file serves as the main entry point for the initialization system.
 * It uses the new modular structure and exports all functions needed by tests.
 */

// Import the new modular implementation
const { initCommand } = require('./init/index');

// Import conflict detection functions from modular structure
const {
  analyzeMergeCompatibility,
  analyzeScriptsDirectoryMerge,
  analyzeTemplatesDirectoryMerge,
  analyzeConfigurationMerge,
  analyzeCursorRulesMerge,
  detectFunctionalConflicts,
  findSourceTemplatesDir,
  findSourceScriptsDir
} = require('./init/conflict-detection');

// Main exports - use new modular version
module.exports = {
  initCommand
};

// Export functions for tests - now from modular structure
module.exports.analyzeMergeCompatibility = analyzeMergeCompatibility;
module.exports.analyzeScriptsDirectoryMerge = analyzeScriptsDirectoryMerge;
module.exports.analyzeTemplatesDirectoryMerge = analyzeTemplatesDirectoryMerge;
module.exports.analyzeConfigurationMerge = analyzeConfigurationMerge;
module.exports.analyzeCursorRulesMerge = analyzeCursorRulesMerge;
module.exports.detectFunctionalConflicts = detectFunctionalConflicts;
module.exports.findSourceTemplatesDir = findSourceTemplatesDir;
module.exports.findSourceScriptsDir = findSourceScriptsDir;
