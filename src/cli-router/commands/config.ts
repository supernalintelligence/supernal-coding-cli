/**
 * Config CLI Commands
 * Commands for configuration management
 */

import { Command } from 'commander';
import { findProjectRoot } from '../utils/project-finder';
import {
  formatSuccess,
  formatError,
  formatTable
} from '../utils/formatters';

const { ConfigLoader } = require('../../config');
const { ConfigDisplayer } = require('../../display');
const { ConfigValidator } = require('../../validation/config-validator');

/** Show options */
interface ShowOptions {
  section?: string;
}

/** Validate options */
interface ValidateOptions {
  type: string;
}

/** List patterns options */
interface ListPatternsOptions {
  type: string;
}

/** Inspect pattern options */
interface InspectPatternOptions {
  name: string;
  type: string;
}

/** Validation result */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Pattern info */
interface PatternInfo {
  name: string;
  type: string;
  description?: string;
  source?: string;
}

/** Patterns result */
interface PatternsResult {
  shipped: PatternInfo[];
  userDefined: PatternInfo[];
}

function registerConfigCommands(program: Command): void {
  const config = program
    .command('config')
    .alias('cfg')
    .description('Configuration management commands');

  // sc config show
  config
    .command('show')
    .description('Show resolved configuration')
    .option('--section <name>', 'Show specific section only')
    .action(async (options: ShowOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = new ConfigLoader({ projectRoot });
        const displayer = new ConfigDisplayer(loader);

        const output = await displayer.show(options.section);
        console.log(`\n${output}`);
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc config trace
  config
    .command('trace')
    .description('Show configuration resolution path')
    .action(async () => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = new ConfigLoader({ projectRoot });
        const displayer = new ConfigDisplayer(loader);

        const output = await displayer.trace();
        console.log(`\n${output}`);
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc config validate
  config
    .command('validate')
    .description('Validate configuration')
    .option('--type <type>', 'Config type (project|workflow)', 'project')
    .action(async (options: ValidateOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = new ConfigLoader({ projectRoot });
        const cfg = await loader.load();

        const validator = new ConfigValidator();
        const result: ValidationResult = validator.validate(cfg, options.type);

        if (result.valid) {
          console.log(formatSuccess('Configuration is valid'));
        } else {
          console.error(
            formatError(new Error('Configuration validation failed'))
          );
          result.errors.forEach((err) => console.error(`  - ${err}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc config list-patterns
  config
    .command('list-patterns')
    .alias('ls-patterns')
    .description('List available patterns')
    .option(
      '--type <type>',
      'Pattern type (workflows|phases|documents)',
      'workflows'
    )
    .action(async (options: ListPatternsOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = new ConfigLoader({ projectRoot });
        const displayer = new ConfigDisplayer(loader);

        const patterns: PatternsResult = await displayer.listPatterns(options.type);

        // Format the output
        const allPatterns: (PatternInfo & { source: string })[] = [
          ...patterns.shipped.map((p) => ({ ...p, source: 'Shipped' })),
          ...patterns.userDefined.map((p) => ({ ...p, source: 'User' }))
        ];

        if (allPatterns.length === 0) {
          console.log(`No ${options.type} patterns found`);
          return;
        }

        const rows = allPatterns.map((p) => [
          p.name,
          p.type,
          p.source,
          p.description || 'N/A'
        ]);

        console.log(
          `\n${formatTable(rows as unknown[][], ['Name', 'Type', 'Source', 'Description'])}`
        );
        console.log();
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc config inspect-pattern
  config
    .command('inspect-pattern')
    .description('Inspect a specific pattern')
    .requiredOption('--name <name>', 'Pattern name')
    .option(
      '--type <type>',
      'Pattern type (workflows|phases|documents)',
      'workflows'
    )
    .action(async (options: InspectPatternOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = new ConfigLoader({ projectRoot });
        const displayer = new ConfigDisplayer(loader);

        const output = await displayer.inspectPattern(
          options.name,
          options.type
        );
        console.log(`\n${output}`);
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });
}

export default registerConfigCommands;
module.exports = registerConfigCommands;
