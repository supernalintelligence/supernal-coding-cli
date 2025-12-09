const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { execSync } = require('node:child_process');
const RequirementHelpers = require('./utils/helpers');
const { extractFrontmatter, getSearchContext } = require('./utils/parsers');

/**
 * Handles search and similarity detection for requirements
 */
class SearchManager {
  constructor(requirementManager) {
    this.requirementManager = requirementManager;
  }

  /**
   * Search requirements by keywords
   */
  async searchRequirements(keywords) {
    try {
      if (!keywords || keywords.length === 0) {
        console.log(chalk.yellow('⚠️  Please provide search keywords'));
        console.log(chalk.blue('Usage: sc req search "keyword1 keyword2"'));
        return;
      }

      const searchTerms = Array.isArray(keywords)
        ? keywords.join(' ')
        : keywords;
      console.log(
        chalk.blue(`🔍 Searching requirements for: "${searchTerms}"`)
      );
      console.log(chalk.blue('='.repeat(60)));

      const reqsDir = path.join(
        this.requirementManager.projectRoot,
        'supernal-coding',
        'requirements'
      );
      if (!(await fs.pathExists(reqsDir))) {
        console.log(chalk.yellow('⚠️  No requirements directory found'));
        return;
      }

      // Search in all requirement files
      const searchPattern = searchTerms
        .split(' ')
        .filter((term) => term.length > 2)
        .join('|');

      try {
        const grepCommand = `grep -r -l -i "${searchPattern}" "${reqsDir}" --include="*.md" 2>/dev/null || true`;
        const results = execSync(grepCommand, { encoding: 'utf8' });
        const matchingFiles = results.trim().split('\n').filter(Boolean);

        if (matchingFiles.length === 0) {
          console.log(
            chalk.yellow('📭 No requirements found matching your search')
          );
          console.log(chalk.blue('\n💡 Try:'));
          console.log(
            `  ${chalk.cyan('sc req search "broader terms"')}  # Use broader search terms`
          );
          console.log(
            `  ${chalk.cyan('sc req list')}                    # List all requirements`
          );
          console.log(
            `  ${chalk.cyan('sc req new "Your Feature"')}      # Create new requirement`
          );
          return;
        }

        console.log(
          chalk.green(
            `📋 Found ${matchingFiles.length} matching requirement(s):\n`
          )
        );

        for (const file of matchingFiles) {
          try {
            const content = await fs.readFile(file, 'utf8');
            const frontmatter = extractFrontmatter(content);
            const reqId = frontmatter.id || 'Unknown';
            const title = frontmatter.title || 'No title';
            const status = frontmatter.status || 'Unknown';
            const epic = frontmatter.epic || 'No epic';
            const priority = frontmatter.priority || 'Unknown';

            // Show context lines with search terms highlighted
            const contextLines = getSearchContext(content, searchPattern);

            console.log(
              `${chalk.cyan('●')} ${chalk.bold(reqId)}: ${chalk.white(title)}`
            );
            console.log(
              `  ${chalk.gray('Status:')} ${RequirementHelpers.getColoredStatus(status)} ${chalk.gray('| Priority:')} ${RequirementHelpers.getPriorityColor(priority)} ${chalk.gray('| Epic:')} ${chalk.blue(epic)}`
            );

            if (contextLines.length > 0) {
              console.log(`  ${chalk.gray('Context:')} ${contextLines[0]}`);
            }

            console.log(
              `  ${chalk.gray('File:')} ${chalk.dim(path.relative(this.requirementManager.projectRoot, file))}`
            );
            console.log('');
          } catch (_error) {
            console.log(
              `${chalk.red('●')} Error reading: ${path.relative(this.requirementManager.projectRoot, file)}`
            );
          }
        }

        console.log(chalk.blue('💡 Actions:'));
        console.log(
          `  ${chalk.cyan('sc req show REQ-XXX')}       # View specific requirement`
        );
        console.log(
          `  ${chalk.cyan('sc req start-work REQ-XXX')} # Start working on requirement`
        );
        console.log(
          `  ${chalk.cyan('sc req new "New Feature"')}  # Create new requirement if none match`
        );
      } catch (error) {
        console.log(chalk.red('❌ Search failed:', error.message));
      }
    } catch (error) {
      console.log(chalk.red('❌ Error searching requirements:', error.message));
    }
  }

  /**
   * Check for similar existing requirements before creating new ones
   */
  async checkForSimilarRequirements(title, options = {}) {
    try {
      console.log(
        chalk.blue('🔍 Checking for similar existing requirements...')
      );

      // Validate title parameter
      if (typeof title !== 'string' || title.trim() === '') {
        console.warn(
          chalk.yellow('⚠️  Invalid title provided, skipping similarity check')
        );
        return;
      }

      // Extract keywords from title and epic
      const keywords = [];
      keywords.push(
        ...title
          .toLowerCase()
          .split(' ')
          .filter((word) => word.length > 3)
      );
      if (options.epic) {
        keywords.push(...options.epic.toLowerCase().split('-'));
      }

      if (keywords.length === 0) return;

      const uniqueKeywords = [...new Set(keywords)];
      const searchResults = await this.performSimilaritySearch(
        uniqueKeywords.join(' '),
        true
      );

      if (searchResults.length > 0) {
        console.log(chalk.yellow('\n⚠️  POTENTIAL DUPLICATES FOUND!'));
        console.log(chalk.yellow('='.repeat(50)));
        console.log(
          chalk.red(
            `\n🚨 Found ${searchResults.length} similar requirement(s) that might already cover this functionality:`
          )
        );

        searchResults.slice(0, 5).forEach((result, index) => {
          console.log(
            `\n${chalk.cyan(`${index + 1}.`)} ${chalk.bold(result.id)}: ${chalk.white(result.title)}`
          );
          console.log(
            `   ${chalk.gray('Status:')} ${RequirementHelpers.getColoredStatus(result.status)} ${chalk.gray('| Epic:')} ${chalk.blue(result.epic)}`
          );
          if (result.context) {
            console.log(`   ${chalk.gray('Context:')} ${result.context}`);
          }
        });

        console.log(chalk.yellow('\n💡 Consider:'));
        console.log(
          `   ${chalk.cyan('sc req show REQ-XXX')}        # Review existing requirements`
        );
        console.log(
          `   ${chalk.cyan('sc req update REQ-XXX')}      # Enhance existing requirement instead`
        );
        console.log(
          `   ${chalk.cyan('# Press Ctrl+C to cancel')}   # Cancel if duplicate found`
        );

        // Give user time to consider
        console.log(
          chalk.blue(
            '\n⏱️  Continuing in 5 seconds... (Press Ctrl+C to cancel)'
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        console.log(
          chalk.green('✅ Proceeding with new requirement creation...\n')
        );
      }
    } catch (error) {
      console.log(
        chalk.yellow(
          '⚠️  Could not check for similar requirements:',
          error.message
        )
      );
    }
  }

  /**
   * Perform similarity search (internal method)
   */
  async performSimilaritySearch(searchTerms, _skipOutput = false) {
    const reqsDir = path.join(
      this.requirementManager.projectRoot,
      'supernal-coding',
      'requirements'
    );
    if (!(await fs.pathExists(reqsDir))) return [];

    const searchPattern = searchTerms
      .split(' ')
      .filter((term) => term.length > 2)
      .join('|');

    try {
      const grepCommand = `grep -r -l -i "${searchPattern}" "${reqsDir}" --include="*.md" 2>/dev/null || true`;
      const results = execSync(grepCommand, { encoding: 'utf8' });
      const matchingFiles = results.trim().split('\n').filter(Boolean);

      if (matchingFiles.length === 0) return [];

      const searchResults = [];
      for (const file of matchingFiles.slice(0, 10)) {
        // Limit for performance
        try {
          const content = await fs.readFile(file, 'utf8');
          const frontmatter = extractFrontmatter(content);
          const reqId = frontmatter.id || 'Unknown';
          const title = frontmatter.title || 'No title';
          const status = frontmatter.status || 'Unknown';
          const epic = frontmatter.epic || 'No epic';

          const contextLines = getSearchContext(content, searchPattern);

          searchResults.push({
            id: reqId,
            title,
            status,
            epic,
            context: contextLines[0] || '',
            file: path.relative(this.requirementManager.projectRoot, file),
          });
        } catch (_error) {
          // Skip files with errors
        }
      }

      return searchResults;
    } catch (_error) {
      return [];
    }
  }
}

module.exports = SearchManager;
