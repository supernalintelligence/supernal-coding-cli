/**
 * Validation System
 * REQ-003: NPM Package Foundation - Validate Command
 *
 * This is a wrapper that provides the validate command interface
 * expected by REQ-003 tests while delegating to the comprehensive
 * validation system implemented in development/validate.js (901 lines).
 */

import path from 'node:path';

interface ValidateOptions {
  help?: boolean;
  verbose?: boolean;
  requirements?: boolean;
  tests?: boolean;
  config?: boolean;
  all?: boolean;
}

class ValidatorManager {
  protected validatePath: string;

  constructor() {
    this.validatePath = path.join(__dirname, 'development', 'validate.js');
  }

  async execute(options: ValidateOptions = {}): Promise<void> {
    try {
      const ValidationSystem = require('./development/validate');
      await ValidationSystem(options);
    } catch (error) {
      console.error('❌ Validation error:', (error as Error).message);
      throw error;
    }
  }

  showHelp(): void {
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

  static async main(options: ValidateOptions = {}): Promise<void> {
    const manager = new ValidatorManager();

    if (options.help) {
      manager.showHelp();
      return;
    }

    await manager.execute(options);
  }
}

export default ValidatorManager;
module.exports = ValidatorManager;

if (require.main === module) {
  const args = process.argv.slice(2);
  const options: ValidateOptions = {};

  args.forEach((arg) => {
    if (arg === '--help' || arg === '-h') options.help = true;
    if (arg === '--verbose' || arg === '-v') options.verbose = true;
    if (arg === '--requirements') options.requirements = true;
    if (arg === '--tests') options.tests = true;
    if (arg === '--config') options.config = true;
    if (arg === '--all') options.all = true;
  });

  ValidatorManager.main(options).catch((error) => {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  });
}
