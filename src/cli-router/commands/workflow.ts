/**
 * Workflow CLI Commands
 * Commands for workflow management
 */

const { WorkflowLoader } = require('../../lib/workflow');
const { findProjectRoot } = require('../utils/project-finder');
const {
  formatSuccess,
  formatError,
  formatYAML,
  formatTable
} = require('../utils/formatters');

function registerWorkflowCommands(program) {
  const workflow = program
    .command('workflow')
    .description('Workflow management commands');

  // sc workflow status
  workflow
    .command('status')
    .description('Show current workflow status')
    .action(async () => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = await WorkflowLoader.load(projectRoot);
        const status = loader.getStatus();

        console.log(`\n${formatYAML(status)}`);
        console.log();
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });

  // sc workflow next
  workflow
    .command('next')
    .description('Move to next phase')
    .option('--force', 'Force transition without validation')
    .option('--reason <text>', 'Reason for transition')
    .action(async (options) => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = await WorkflowLoader.load(projectRoot);

        const context = {
          forced: options.force || false,
          reason: options.reason
        };

        await loader.next(context);
        const status = loader.getStatus();

        console.log(
          formatSuccess(`Transitioned to: ${status.currentPhase.name}`)
        );
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });

  // sc workflow previous
  workflow
    .command('previous')
    .alias('prev')
    .description('Move to previous phase')
    .action(async () => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = await WorkflowLoader.load(projectRoot);

        await loader.previous();
        const status = loader.getStatus();

        console.log(
          formatSuccess(`Moved back to: ${status.currentPhase.name}`)
        );
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });

  // sc workflow jump
  workflow
    .command('jump')
    .description('Jump to specific phase')
    .requiredOption('--phase <name>', 'Phase name or ID to jump to')
    .option('--force', 'Force jump without validation')
    .action(async (options) => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = await WorkflowLoader.load(projectRoot);

        await loader.jumpTo(options.phase, { forced: options.force });
        const status = loader.getStatus();

        console.log(formatSuccess(`Jumped to: ${status.currentPhase.name}`));
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });

  // sc workflow history
  workflow
    .command('history')
    .description('Show workflow history')
    .option('--limit <n>', 'Limit number of entries', '10')
    .action(async (options) => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = await WorkflowLoader.load(projectRoot);
        const state = loader.state;

        const history = state.phaseHistory.slice(-parseInt(options.limit, 10));

        if (history.length === 0) {
          console.log('No history available');
          return;
        }

        const rows = history.map((entry) => [
          entry.phase,
          entry.completedAt
            ? new Date(entry.completedAt).toLocaleString()
            : 'In Progress',
          entry.forced ? 'Yes' : 'No'
        ]);

        console.log(`\n${formatTable(rows, ['Phase', 'Completed', 'Forced'])}`);
        console.log();
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });

  // sc workflow phases
  workflow
    .command('phases')
    .description('List all phases in workflow')
    .action(async () => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = await WorkflowLoader.load(projectRoot);
        const phases = loader.phaseManager.getAllPhases();
        const current = loader.state.currentPhase;

        const rows = phases.map((phase) => [
          phase.id === current ? '▶' : ' ',
          phase.id,
          phase.name,
          phase.description || ''
        ]);

        console.log(
          `\n${formatTable(rows, ['', 'ID', 'Name', 'Description'])}`
        );
        console.log();
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });

  // sc workflow init
  workflow
    .command('init')
    .description('Initialize workflow for project')
    .requiredOption(
      '--pattern <name>',
      'Workflow pattern (minimal, agile-4, comprehensive-16, medical-csv)'
    )
    .action(async (options) => {
      try {
        const projectRoot = await findProjectRoot();
        const loader = await WorkflowLoader.initialize(
          projectRoot,
          options.pattern
        );

        console.log(formatSuccess(`Initialized workflow: ${options.pattern}`));
        console.log(
          formatSuccess(`Starting phase: ${loader.state.currentPhase}`)
        );
      } catch (error) {
        console.error(formatError(error));
        process.exit(1);
      }
    });
}

module.exports = registerWorkflowCommands;
