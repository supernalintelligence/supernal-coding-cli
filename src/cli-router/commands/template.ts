/**
 * Template CLI Commands
 * Commands for template management
 */

const {
  TemplateLoader,
  DocumentValidator,
  DocumentRegistry
} = require('../../lib/templates');
const { findProjectRoot } = require('../utils/project-finder');
const {
  formatSuccess,
  formatError,
  formatTable,
  formatYAML
} = require('../utils/formatters');
const _fs = require('node:fs').promises;
const path = require('node:path');

function registerTemplateCommands(program) {
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
        const templates = await loader.listTemplates();

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
          `\n${formatTable(rows, ['Template', 'Category', 'Phases'])}`
        );
        console.log();
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });

  // sc template validate
  template
    .command('validate')
    .description('Validate document against template')
    .requiredOption('--document <path>', 'Path to document to validate')
    .requiredOption('--template <name>', 'Template name')
    .action(async (options) => {
      try {
        const projectRoot = await findProjectRoot();
        const docPath = path.resolve(projectRoot, options.document);

        const validator = new DocumentValidator();
        const result = await validator.validate(docPath, options.template);

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
        console.error(formatError(error));
        process.exit(1);
      }
    });

  // sc template inspect
  template
    .command('inspect')
    .description('Show template details')
    .requiredOption('--name <name>', 'Template name')
    .action(async (options) => {
      try {
        const loader = new TemplateLoader();
        const tmpl = await loader.loadTemplate(options.name);

        console.log(`\n${formatYAML(tmpl)}`);
        console.log();
      } catch (error) {
        console.error(formatError(error));
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
        const types = registry.getAllTypes();

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
          `\n${formatTable(rows, ['Type', 'Category', 'Templates'])}`
        );
        console.log();
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });
}

module.exports = registerTemplateCommands;
