/**
 * Template CLI Commands
 * Commands for template management
 */

import { Command } from 'commander';
import path from 'node:path';
import { findProjectRoot } from '../utils/project-finder';
import {
  formatSuccess,
  formatError,
  formatTable,
  formatYAML
} from '../utils/formatters';

const {
  TemplateLoader,
  DocumentValidator,
  DocumentRegistry
} = require('../../templates');

/** Template info */
interface TemplateInfo {
  name: string;
  category?: string;
  phases?: string[];
  [key: string]: unknown;
}

/** Validation result */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Document type info */
interface DocumentTypeInfo {
  name: string;
  category: string;
  template?: string;
  templates?: string[];
}

/** Validate options */
interface ValidateOptions {
  document: string;
  template: string;
}

/** Inspect options */
interface InspectOptions {
  name: string;
}

function registerTemplateCommands(program: Command): void {
  const template = program
    .command('template')
    .alias('tmpl')
    .description('Template management commands');

  // sc template list
  template
    .command('list')
    .alias('ls')
    .description('List available templates')
    .action(async () => {
      try {
        const loader = new TemplateLoader();
        const templates: TemplateInfo[] = await loader.listTemplates();

        if (templates.length === 0) {
          console.log('No templates found');
          return;
        }

        const rows = templates.map((t) => [
          t.name,
          t.category || 'N/A',
          t.phases?.join(', ') || 'Any'
        ]);

        console.log(
          `\n${formatTable(rows as unknown[][], ['Template', 'Category', 'Phases'])}`
        );
        console.log();
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc template validate
  template
    .command('validate')
    .description('Validate document against template')
    .requiredOption('--document <path>', 'Path to document to validate')
    .requiredOption('--template <name>', 'Template name')
    .action(async (options: ValidateOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        const docPath = path.resolve(projectRoot, options.document);

        const validator = new DocumentValidator();
        const result: ValidationResult = await validator.validate(docPath, options.template);

        if (result.valid) {
          console.log(formatSuccess('Document is valid'));
        } else {
          console.error(formatError(new Error('Document validation failed')));
          console.error('\nErrors:');
          result.errors.forEach((err) => console.error(`  - ${err}`));

          if (result.warnings.length > 0) {
            console.log('\nWarnings:');
            result.warnings.forEach((warn) => console.log(`  - ${warn}`));
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc template inspect
  template
    .command('inspect')
    .description('Show template details')
    .requiredOption('--name <name>', 'Template name')
    .action(async (options: InspectOptions) => {
      try {
        const loader = new TemplateLoader();
        const tmpl = await loader.loadTemplate(options.name);

        console.log(`\n${formatYAML(tmpl)}`);
        console.log();
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc template registry
  template
    .command('registry')
    .description('Show document type registry')
    .action(async () => {
      try {
        const registry = new DocumentRegistry();
        const types: DocumentTypeInfo[] = registry.getAllTypes();

        if (types.length === 0) {
          console.log('No document types registered');
          return;
        }

        const rows = types.map((t) => [
          t.name,
          t.category,
          typeof t.template === 'string'
            ? t.template
            : t.templates?.join(', ') || 'N/A'
        ]);

        console.log(
          `\n${formatTable(rows as unknown[][], ['Type', 'Category', 'Templates'])}`
        );
        console.log();
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });
}

export default registerTemplateCommands;
module.exports = registerTemplateCommands;
