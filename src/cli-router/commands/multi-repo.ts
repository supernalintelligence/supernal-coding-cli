/**
 * Multi-Repo CLI Commands
 * Commands for multi-repository management
 */

import { Command } from 'commander';
import { findProjectRoot } from '../utils/project-finder';
import {
  formatSuccess,
  formatError,
  formatTable
} from '../utils/formatters';

const { RepoDiscovery, RepoAggregator } = require('../../multi-repo');

/** Discover options */
interface DiscoverOptions {
  depth: string;
  exclude?: string;
}

/** Aggregate options */
interface AggregateOptions {
  type: string;
  status?: string;
}

/** Repository info */
interface RepoInfo {
  name: string;
  path: string;
  workflow?: string;
  currentPhase?: string;
  requirements?: unknown[];
}

/** Aggregated requirement/task */
interface AggregatedItem {
  repo: string;
  id: string;
  title: string;
  status?: string;
}

/** Aggregated document */
interface AggregatedDocument {
  repo: string;
  type: string;
  path: string;
}

function registerMultiRepoCommands(program: Command): void {
  const multiRepo = program
    .command('multi-repo')
    .alias('mr')
    .description('Multi-repository management commands');

  // sc multi-repo discover
  multiRepo
    .command('discover')
    .description('Discover sub-repositories')
    .option('--depth <n>', 'Maximum search depth', '5')
    .option('--exclude <patterns>', 'Comma-separated exclude patterns')
    .action(async (options: DiscoverOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        const discovery = new RepoDiscovery({
          maxDepth: parseInt(options.depth, 10),
          exclude: options.exclude ? options.exclude.split(',') : undefined
        });

        const repos: RepoInfo[] = await discovery.discover(projectRoot);

        if (repos.length === 0) {
          console.log('No sub-repositories found');
          return;
        }

        const rows = repos.map((repo) => [
          repo.name,
          repo.path.replace(projectRoot, '.'),
          repo.workflow || 'None'
        ]);

        console.log(`\n${formatTable(rows as unknown[][], ['Name', 'Path', 'Workflow'])}`);
        console.log(
          `\nFound ${repos.length} sub-repositor${repos.length === 1 ? 'y' : 'ies'}`
        );
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc multi-repo aggregate
  multiRepo
    .command('aggregate')
    .description('Aggregate data across repositories')
    .option(
      '--type <type>',
      'Data type to aggregate (requirements|tasks|documents)',
      'requirements'
    )
    .option('--status <status>', 'Filter by status')
    .action(async (options: AggregateOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        const discovery = new RepoDiscovery();
        const repos: RepoInfo[] = await discovery.discover(projectRoot);

        if (repos.length === 0) {
          console.log('No sub-repositories found');
          return;
        }

        const aggregator = new RepoAggregator(repos);
        let data: (AggregatedItem | AggregatedDocument)[];

        switch (options.type) {
          case 'requirements':
            data = await aggregator.aggregateRequirements({
              status: options.status
            });
            break;
          case 'tasks':
            data = await aggregator.aggregateTasks({
              status: options.status
            });
            break;
          case 'documents':
            data = await aggregator.aggregateDocuments();
            break;
          default:
            throw new Error(`Unknown type: ${options.type}`);
        }

        if (data.length === 0) {
          console.log(`No ${options.type} found`);
          return;
        }

        // Format based on type
        let rows: unknown[][];
        let headers: string[];

        if (options.type === 'requirements') {
          rows = (data as AggregatedItem[]).map((item) => [
            item.repo,
            item.id,
            item.title,
            item.status || 'N/A'
          ]);
          headers = ['Repository', 'ID', 'Title', 'Status'];
        } else if (options.type === 'tasks') {
          rows = (data as AggregatedItem[]).map((item) => [
            item.repo,
            item.id,
            item.title,
            item.status || 'N/A'
          ]);
          headers = ['Repository', 'ID', 'Title', 'Status'];
        } else {
          rows = (data as AggregatedDocument[]).map((item) => [item.repo, item.type, item.path]);
          headers = ['Repository', 'Type', 'Path'];
        }

        console.log(`\n${formatTable(rows, headers)}`);
        console.log(`\nTotal: ${data.length} ${options.type}`);
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });

  // sc multi-repo status
  multiRepo
    .command('status')
    .description('Show status of all repositories')
    .action(async () => {
      try {
        const projectRoot = await findProjectRoot();
        const discovery = new RepoDiscovery();
        const repos: RepoInfo[] = await discovery.discover(projectRoot);

        if (repos.length === 0) {
          console.log('No sub-repositories found');
          return;
        }

        const rows = repos.map((repo) => [
          repo.name,
          repo.workflow || 'None',
          repo.currentPhase || 'N/A',
          `${repo.requirements?.length || 0} reqs`
        ]);

        console.log(
          '\n' +
            formatTable(rows as unknown[][], [
              'Repository',
              'Workflow',
              'Phase',
              'Requirements'
            ])
        );
        console.log();
      } catch (error) {
        console.error(formatError(error as Error));
        process.exit(1);
      }
    });
}

export default registerMultiRepoCommands;
module.exports = registerMultiRepoCommands;
