/**
 * Main Init System Entry Point
 *
 * This file serves as the main entry point for the initialization system.
 * It uses the new modular structure and exports all functions needed by tests.
 */

const { initCommand } = require('./init/index');

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

export {
  initCommand,
  analyzeMergeCompatibility,
  analyzeScriptsDirectoryMerge,
  analyzeTemplatesDirectoryMerge,
  analyzeConfigurationMerge,
  analyzeCursorRulesMerge,
  detectFunctionalConflicts,
  findSourceTemplatesDir,
  findSourceScriptsDir
};

module.exports = {
  initCommand,
  analyzeMergeCompatibility,
  analyzeScriptsDirectoryMerge,
  analyzeTemplatesDirectoryMerge,
  analyzeConfigurationMerge,
  analyzeCursorRulesMerge,
  detectFunctionalConflicts,
  findSourceTemplatesDir,
  findSourceScriptsDir
};
