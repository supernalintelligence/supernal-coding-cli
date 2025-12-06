#!/usr/bin/env node

const fs = require('node:fs');
const _path = require('node:path');
const { execSync } = require('node:child_process');
const glob = require('glob');

class RequirementsTrackingInitializer {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      force: options.force || false,
      pattern: options.pattern || null,
      ...options
    };

    this.stats = {
      filesScanned: 0,
      filesUpdated: 0,
      filesSkipped: 0,
      filesWithExisting: 0,
      errors: []
    };
  }

  /**
   * Get current git information for metadata
   */
  getGitInfo() {
    try {
      const currentCommit = execSync('git rev-parse HEAD', {
        encoding: 'utf8'
      }).trim();
      const author = execSync('git config user.name', {
        encoding: 'utf8'
      }).trim();
      const timestamp = new Date().toISOString();

      return {
        currentCommit,
        author,
        timestamp
      };
    } catch (error) {
      throw new Error(`Failed to get git information: ${error.message}`);
    }
  }

  /**
   * Find all requirement markdown files
   */
  findRequirementFiles() {
    const patterns = this.options.pattern
      ? [this.options.pattern]
      : [
          '**/req-*.md',
          '**/requirements/**/*.md',
          '**/specs/**/*.md',
          '**/REQ-*.md'
        ];

    let files = [];
    for (const pattern of patterns) {
      const found = glob.sync(pattern, {
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/dist/**',
          '**/build/**'
        ]
      });
      files = files.concat(found);
    }

    // Remove duplicates and filter for .md files
    const uniqueFiles = [...new Set(files)].filter(
      (file) => file.endsWith('.md') && fs.existsSync(file)
    );

    if (this.options.verbose) {
      console.log(`📁 Found ${uniqueFiles.length} requirement files:`);
      uniqueFiles.forEach((file) => console.log(`  - ${file}`));
    }

    return uniqueFiles;
  }

  /**
   * Check if file has git_tracking in front matter
   */
  hasGitTracking(content) {
    if (!content.startsWith('---\n')) {
      return false;
    }

    const frontMatterEnd = content.indexOf('\n---\n', 4);
    if (frontMatterEnd === -1) {
      return false;
    }

    const frontMatter = content.substring(4, frontMatterEnd);
    return frontMatter.includes('git_tracking:');
  }

  /**
   * Add git_tracking to front matter
   */
  addGitTracking(content, gitInfo) {
    const gitTrackingSection = `git_tracking:
  previous_commit: "${gitInfo.currentCommit}"
  last_modified: "${gitInfo.timestamp}"
  change_count: 1
  last_modified_by: "${gitInfo.author}"`;

    if (!content.startsWith('---\n')) {
      // No front matter, create it
      const newContent = `---
${gitTrackingSection}
---

${content}`;
      return newContent;
    }

    // Has front matter, add git_tracking before closing ---
    let frontMatterEnd = content.indexOf('\n---\n', 4);

    // Handle edge case where --- is followed by content without newline
    if (frontMatterEnd === -1) {
      frontMatterEnd = content.indexOf('\n---', 4);
      if (frontMatterEnd !== -1) {
        // Check if it's actually the end of front matter
        const afterDashes = content.substring(frontMatterEnd + 4);
        if (afterDashes.length === 0 || !afterDashes.startsWith('\n')) {
          // This is a malformed front matter, try to fix it
          const beforeDashes = content.substring(0, frontMatterEnd + 4);
          const afterDashes = content.substring(frontMatterEnd + 4);
          content = `${beforeDashes}\n${afterDashes}`;
          frontMatterEnd = content.indexOf('\n---\n', 4);
        }
      }
    }

    if (frontMatterEnd === -1) {
      throw new Error(
        'Invalid front matter format - could not find closing ---'
      );
    }

    const frontMatter = content.substring(4, frontMatterEnd);
    const body = content.substring(frontMatterEnd + 5);

    const newContent = `---
${frontMatter}
${gitTrackingSection}
---
${body}`;

    return newContent;
  }

  /**
   * Process a single file
   */
  processFile(filePath, gitInfo) {
    this.stats.filesScanned++;

    try {
      const content = fs.readFileSync(filePath, 'utf8');

      if (this.hasGitTracking(content)) {
        this.stats.filesWithExisting++;
        if (this.options.verbose) {
          console.log(`  ⏭️  ${filePath} - Already has git_tracking`);
        }
        if (!this.options.force) {
          this.stats.filesSkipped++;
          return false;
        }
        if (this.options.verbose) {
          console.log(`  🔄 ${filePath} - Forcing update due to --force flag`);
        }
      }

      const updatedContent = this.addGitTracking(content, gitInfo);

      if (this.options.dryRun) {
        console.log(`  🔍 ${filePath} - Would be updated (dry run)`);
        this.stats.filesUpdated++;
        return true;
      }

      fs.writeFileSync(filePath, updatedContent, 'utf8');
      this.stats.filesUpdated++;

      if (this.options.verbose) {
        console.log(`  ✅ ${filePath} - Updated with git_tracking`);
      }

      return true;
    } catch (error) {
      this.stats.errors.push({ file: filePath, error: error.message });
      console.error(`  ❌ ${filePath} - Error: ${error.message}`);
      return false;
    }
  }

  /**
   * Run the initialization process
   */
  async run() {
    console.log('🚀 Initializing git tracking for requirement files...\n');

    try {
      const gitInfo = this.getGitInfo();
      const files = this.findRequirementFiles();

      if (files.length === 0) {
        console.log('📭 No requirement files found.');
        return this.stats;
      }

      console.log(`📋 Processing ${files.length} requirement files...\n`);

      if (this.options.dryRun) {
        console.log('🔍 DRY RUN MODE - No files will be modified\n');
      }

      for (const file of files) {
        this.processFile(file, gitInfo);
      }

      console.log('\n📊 Summary:');
      console.log(`  📁 Files scanned: ${this.stats.filesScanned}`);
      console.log(`  ✅ Files updated: ${this.stats.filesUpdated}`);
      console.log(
        `  ⏭️  Files skipped (already have tracking): ${this.stats.filesWithExisting}`
      );
      console.log(`  ❌ Errors: ${this.stats.errors.length}`);

      if (this.stats.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        this.stats.errors.forEach(({ file, error }) => {
          console.log(`  - ${file}: ${error}`);
        });
      }

      if (!this.options.dryRun && this.stats.filesUpdated > 0) {
        console.log(
          '\n💡 Tip: Run "git add ." and commit the changes to track these updates.'
        );
        console.log(
          '💡 The post-commit hook will handle future automatic updates.'
        );
      }

      return this.stats;
    } catch (error) {
      console.error(`❌ Failed to initialize git tracking: ${error.message}`);
      throw error;
    }
  }
}

/**
 * CLI function for adding git tracking to requirement files
 */
async function initRequirementsTracking(options = {}) {
  const initializer = new RequirementsTrackingInitializer(options);
  return await initializer.run();
}

module.exports = {
  RequirementsTrackingInitializer,
  initRequirementsTracking
};

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--dry-run':
      case '-n':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--pattern':
      case '-p':
        options.pattern = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node init-requirements-tracking.js [options]

Initialize git tracking metadata for requirement markdown files.

Options:
  -n, --dry-run     Show what would be done without making changes
  -v, --verbose     Show detailed progress information
  -f, --force       Update files even if they already have git_tracking
  -p, --pattern     Custom glob pattern for finding files
  -h, --help        Show this help message

Examples:
  node init-requirements-tracking.js
  node init-requirements-tracking.js --dry-run --verbose
  node init-requirements-tracking.js --pattern "**/my-reqs/*.md"
  node init-requirements-tracking.js --force --verbose
`);
        process.exit(0);
        break;
    }
  }

  initRequirementsTracking(options)
    .then((stats) => {
      const exitCode = stats.errors.length > 0 ? 1 : 0;
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error.message);
      process.exit(1);
    });
}
