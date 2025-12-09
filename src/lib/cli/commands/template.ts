const chalk = require('chalk');
const _fs = require('fs-extra');
const _path = require('node:path');
const TemplateResolver = require('../../utils/template-resolver');

/**
 * Template command handler
 * Manages project templates
 */
async function handleTemplateCommand(action, options) {
  switch (action) {
    case 'list':
      await listTemplates(options);
      break;
    case 'registry':
      await showRegistry(options);
      break;
    default:
      console.log(chalk.yellow(`Unknown template action: ${action}`));
      console.log(chalk.blue('\nAvailable actions:'));
      console.log(
        `${chalk.cyan('  sc template list     ')}- List available templates`
      );
      console.log(
        `${chalk.cyan('  sc template registry ')}- Show template registry`
      );
      break;
  }
}

async function listTemplates(_options) {
  console.log(chalk.blue('📋 Available Templates:'));

  const resolver = new TemplateResolver();
  const templates = resolver.list();

  if (templates.length > 0) {
    templates.forEach((template) => {
      const source =
        template.source === 'package' ? '(SC package)' : '(customized)';
      console.log(chalk.cyan(`  - ${template.path} `) + chalk.gray(source));
    });
  } else {
    console.log(chalk.yellow('  No templates found'));
  }
}

async function showRegistry(_options) {
  console.log(chalk.blue('📚 Template Registry:'));
  console.log(chalk.cyan('\n  Type: Core Templates (ME.sh Convention)'));
  console.log(chalk.white('    - BUILDME.sh - Build automation script'));
  console.log(chalk.white('    - TESTME.sh - Test execution script'));
  console.log(chalk.white('    - RUNME.sh - Development server script'));
  console.log(chalk.white('    - README.md - Project documentation'));

  console.log(chalk.cyan('\n  Type: Requirement Templates'));
  console.log(chalk.white('    - requirement.md - Requirement specification'));
  console.log(chalk.white('    - story.md - User story template'));

  console.log(chalk.cyan('\n  Type: Documentation Templates'));
  console.log(chalk.white('    - handoff.md - Knowledge transfer document'));
  console.log(chalk.white('    - decision.md - Architecture decision record'));
}

module.exports = { handleTemplateCommand };
