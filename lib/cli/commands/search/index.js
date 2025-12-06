#!/usr/bin/env node

/**
 * SC Search Command
 *
 * Unified search across all content types.
 * Uses @supernal/search for core search logic when available.
 */

const _path = require('node:path');
const chalk = require('chalk');

// Import from shared search package (optional - may not be installed in npm distribution)
let SearchEngine, CONTENT_TYPES, formatter;
try {
  const searchPkg = require('@supernal/search');
  SearchEngine = searchPkg.SearchEngine;
  CONTENT_TYPES = searchPkg.CONTENT_TYPES;
  formatter = require('@supernal/search/cli');
} catch (err) {
  // Search package not available - provide stub implementations
  SearchEngine = null;
  CONTENT_TYPES = ['docs', 'requirements', 'features', 'workflow', 'planning', 'compliance'];
  formatter = {
    displayEmptyQueryWarning: () => console.log(chalk.yellow('Please provide a search query')),
    displayError: (error) => console.error(chalk.red(`Search error: ${error}`)),
    displayJson: (data) => console.log(JSON.stringify(data, null, 2)),
    displayResults: (response, _options) => {
      if (response.results?.length === 0) {
        console.log(chalk.yellow('No results found'));
      } else {
        response.results?.forEach(r => console.log(chalk.cyan(r.path), '-', r.title || r.path));
      }
    },
    displayHelp: (types) => {
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
  constructor(projectRoot) {
    this.projectRoot = projectRoot || process.cwd();
    this.engine = SearchEngine ? new SearchEngine(this.projectRoot) : null;
  }

  /**
   * Search content with given query and options
   */
  async search(query, options = {}) {
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
  async basicSearch(query, options = {}) {
    const { execSync } = require('child_process');
    const results = [];
    
    try {
      const grepOutput = execSync(
        `grep -ril "${query}" docs/ 2>/dev/null | head -20`,
        { cwd: this.projectRoot, encoding: 'utf8' }
      );
      
      const files = grepOutput.trim().split('\n').filter(f => f);
      files.forEach(file => {
        results.push({ path: file, title: file });
      });
      
      const response = { results, count: results.length, query };
      
      if (options.json) {
        formatter.displayJson(response);
      } else {
        formatter.displayResults(response, { showContext: false });
      }
      
      return response;
    } catch (error) {
      return { results: [], count: 0, query };
    }
  }

  /**
   * Show help for search command
   */
  showHelp() {
    formatter.displayHelp(CONTENT_TYPES);
  }
}

/**
 * CLI handler for search command
 */
async function handleSearchCommand(query, options = {}) {
  const projectRoot = process.cwd();
  const searchManager = new SearchManager(projectRoot);

  if (options.help || query === 'help') {
    searchManager.showHelp();
    return;
  }

  await searchManager.search(query, options);
}

module.exports = {
  SearchManager,
  handleSearchCommand,
  CONTENT_TYPES
};
