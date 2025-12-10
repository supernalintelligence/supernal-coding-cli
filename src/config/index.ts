/**
 * Configuration module
 * Provides config loading, pattern resolution, and merging
 */

// These are still JS internally
const ConfigLoader = require('./loader');
const PatternResolver = require('./resolver');
const ConfigMerger = require('./merger');
const {
  YAMLSyntaxError,
  PatternNotFoundError,
  CircularDependencyError
} = require('./errors');

export {
  ConfigLoader,
  PatternResolver,
  ConfigMerger,
  YAMLSyntaxError,
  PatternNotFoundError,
  CircularDependencyError
};

module.exports = {
  ConfigLoader,
  PatternResolver,
  ConfigMerger,
  YAMLSyntaxError,
  PatternNotFoundError,
  CircularDependencyError
};
