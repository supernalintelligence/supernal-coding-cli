/**
 * CLI for validating compliance template customization
 * Usage: node validate-templates.js [options]
 */

import path from 'node:path';
import { Command } from 'commander';
const {
  validateAllFrameworks,
  displayResults,
  saveResults
} = require('./template-validator');

interface ValidateOptions {
  path: string;
  output?: string;
  showGeneric: boolean;
  limit: string;
  verbose: boolean;
}

interface ValidationResults {
  overall: {
    customizationRate: number;
  };
}

const program = new Command();

program
  .name('validate-compliance-templates')
  .description('Validate compliance template customization status')
  .option(
    '-p, --path <path>',
    'Path to compliance frameworks',
    'templates/compliance/frameworks'
  )
  .option('-o, --output <file>', 'Save results to JSON file')
  .option('-g, --show-generic', 'Show list of generic templates', false)
  .option(
    '-l, --limit <number>',
    'Limit number of generic templates shown',
    '10'
  )
  .option('-v, --verbose', 'Verbose output', false)
  .parse();

const options = program.opts<ValidateOptions>();

async function main(): Promise<void> {
  try {
    console.log('🔍 Validating compliance templates...\n');

    const results: ValidationResults = await validateAllFrameworks(options.path);

    displayResults(results, {
      showGeneric: options.showGeneric,
      limit: parseInt(options.limit, 10),
      verbose: options.verbose
    });

    if (options.output) {
      const outputPath = path.resolve(options.output);
      await saveResults(results, outputPath);
    }

    const customizationRate = results.overall.customizationRate;
    if (customizationRate < 10) {
      console.log('\n⚠️  Warning: Very low customization rate (<10%)');
      process.exit(1);
    } else if (customizationRate < 30) {
      console.log('\n⚠️  Warning: Low customization rate (<30%)');
    } else {
      console.log('\n✅ Good customization rate');
    }
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    if (options.verbose) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
