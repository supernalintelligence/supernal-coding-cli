#!/usr/bin/env node

/**
 * SC Search Command
 *
 * Unified search across all content types.
 * Uses @supernal/search for core search logic when available.
 */

import chalk from 'chalk';
import { execSync } from 'child_process';

/** Search result item */
interface SearchResult {
  path: string;
  title?: string;
  [key: string]: unknown;
}

/** Search response */
interface SearchResponse {
  results: SearchResult[];
  count: number;
  query?: string;
  error?: string;
  availableTypes?: string[];
}

/** Search options */
interface SearchOptions {
  json?: boolean;
  showContext?: boolean;
  type?: string;
  help?: boolean;
}

/** Formatter interface */
interface Formatter {
  displayEmptyQueryWarning: () => void;
  displayError: (error: string, availableTypes?: string[]) => void;
  displayJson: (data: unknown) => void;
  displayResults: (response: SearchResponse, options: { showContext: boolean }) => void;
  displayHelp: (types: string[]) => void;
}

/** Search engine interface */
interface SearchEngineInterface {
  search: (query: string, options: SearchOptions) => Promise<SearchResponse>;
}

// Import from shared search package (optional - may not be installed in npm distribution)
let SearchEngine: (new (projectRoot: string) => SearchEngineInterface) | null;
let CONTENT_TYPES: string[];
let formatter: Formatter;

try {
  const searchPkg = require('@supernal/search');
  SearchEngine = searchPkg.SearchEngine;
  CONTENT_TYPES = searchPkg.CONTENT_TYPES;
  formatter = require('@supernal/search/cli');
} catch (_err) {
  // Search package not available - provide stub implementations
  SearchEngine = null;
  CONTENT_TYPES = ['docs', 'requirements', 'features', 'workflow', 'planning', 'compliance'];
  formatter = {
    displayEmptyQueryWarning: () => console.log(chalk.yellow('Please provide a search query')),
    displayError: (error: string) => console.error(chalk.red(`Search error: ${error}`)),
    displayJson: (data: unknown) => console.log(JSON.stringify(data, null, 2)),
    displayResults: (response: SearchResponse, _options: { showContext: boolean }) => {
      if (!response.results?.length) {
        console.log(chalk.yellow('No results found'));
      } else {
        response.results.forEach(r => console.log(chalk.cyan(r.path), '-', r.title || r.path));
      }
    },
    displayHelp: (types: string[]) => {
      console.log(chalk.bold('Search Commands:'));
      console.log('  sc search <query> [--type <type>]');
      console.log(`\nTypes: ${types.join(', ')}`);
    }
  };
}

/**
 * SearchManager - CLI wrapper around SearchEngine
 *
 * Provides CLI-specific behavior while delegating core search to shared package.
 */
class SearchManager {
  protected engine: SearchEngineInterface | null;
  protected projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.engine = SearchEngine ? new SearchEngine(this.projectRoot) : null;
  }

  /**
   * Search content with given query and options
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const { json = false, showContext = true } = options;

    if (!query || query.trim() === '') {
      formatter.displayEmptyQueryWarning();
      return { results: [], count: 0 };
    }

    // If search engine not available, use basic grep-based search
    if (!this.engine) {
      console.log(chalk.yellow('⚠️  Full search requires @supernal/search package'));
      console.log(chalk.gray('   Using basic file search...'));
      return this.basicSearch(query, options);
    }

    const response = await this.engine.search(query, options);

    if (response.error) {
      formatter.displayError(response.error, response.availableTypes);
      return { results: [], count: 0 };
    }

    if (json) {
      formatter.displayJson(response);
    } else {
      formatter.displayResults(response, { showContext });
    }

    return response;
  }

  /**
   * Basic grep-based search fallback
   */
  async basicSearch(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const results: SearchResult[] = [];

    try {
      const grepOutput = execSync(
        `grep -ril "${query}" docs/ 2>/dev/null | head -20`,
        { cwd: this.projectRoot, encoding: 'utf8' }
      );

      const files = grepOutput.trim().split('\n').filter(f => f);
      files.forEach(file => {
        results.push({ path: file, title: file });
      });

      const response: SearchResponse = { results, count: results.length, query };

      if (options.json) {
        formatter.displayJson(response);
      } else {
        formatter.displayResults(response, { showContext: false });
      }

      return response;
    } catch (_error) {
      return { results: [], count: 0, query };
    }
  }

  /**
   * Show help for search command
   */
  showHelp(): void {
    formatter.displayHelp(CONTENT_TYPES);
  }
}

/**
 * CLI handler for search command
 */
async function handleSearchCommand(query: string, options: SearchOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const searchManager = new SearchManager(projectRoot);

  if (options.help || query === 'help') {
    searchManager.showHelp();
    return;
  }

  await searchManager.search(query, options);
}

export {
  SearchManager,
  handleSearchCommand,
  CONTENT_TYPES
};

module.exports = {
  SearchManager,
  handleSearchCommand,
  CONTENT_TYPES
};
