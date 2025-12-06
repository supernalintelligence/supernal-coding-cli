#!/usr/bin/env node

/**
 * Validation System
 * REQ-003: NPM Package Foundation - Validate Command
 *
 * This is a wrapper that provides the validate command interface
 * expected by REQ-003 tests while delegating to the comprehensive
 * validation system implemented in development/validate.js (901 lines).
 */

const path = require('node:path');

class ValidatorManager {
  constructor() {
    this.validatePath = path.join(__dirname, 'development', 'validate.js');
  }

  async execute(options = {}) {
    try {
      // Import the comprehensive validation system
      const ValidationSystem = require('./development/validate');

      // Execute validation with provided options
      await ValidationSystem(options);
    } catch (error) {
      console.error('❌ Validation error:', error.message);
      throw error;
    }
  }

  // Show help text that matches REQ-003 test expectations
  showHelp() {
    console.log('Usage: sc validate [options]');
    console.log('Validate current installation');
    console.log('');
    console.log('Options:');
    console.log('  -v, --verbose       Show detailed validation information');
    console.log('  --requirements      Validate requirements files');
    console.log('  --tests            Validate test files');
    console.log('  --config           Validate configuration');
    console.log('  --all              Validate everything');
    console.log('  -h, --help         display help for command');
  }

  // Static method for direct execution (used by CLI)
  static async main(options = {}) {
    const manager = new ValidatorManager();

    // Handle help request
    if (options.help) {
      manager.showHelp();
      return;
    }

    await manager.execute(options);
  }
}

// Export for CLI usage
module.exports = ValidatorManager;

// If run directly, execute with command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse basic command line arguments
  args.forEach((arg) => {
    if (arg === '--help' || arg === '-h') options.help = true;
    if (arg === '--verbose' || arg === '-v') options.verbose = true;
    if (arg === '--requirements') options.requirements = true;
    if (arg === '--tests') options.tests = true;
    if (arg === '--config') options.config = true;
    if (arg === '--all') options.all = true;
  });

  ValidatorManager.main(options).catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}
