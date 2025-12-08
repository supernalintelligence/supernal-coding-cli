const fs = require('fs-extra');
const chalk = require('chalk');
const { execSync } = require('node:child_process');
const RequirementHelpers = require('./utils/helpers');
const {
  extractFrontmatter,
  parseContent,
  reconstructContent
} = require('./utils/parsers');
const { SigningManager } = require('../../../signing');

/**
 * Handles Git integration for requirements
 */
class GitManager {
  constructor(requirementManager) {
    this.requirementManager = requirementManager;
  }

  /**
   * Start work on a requirement (create branch, update status)
   */
  async startWork(reqId) {
    try {
      const reqFile = await this.requirementManager.findRequirementById(reqId);
      if (!reqFile) {
        throw new Error(`Requirement ${reqId} not found`);
      }

      const content = await fs.readFile(reqFile, 'utf8');

      // Extract requirement title for branch name
      const titleMatch = content.match(/title: (.+)/);
      const title = titleMatch ? titleMatch[1] : 'unknown-requirement';
      const kebabName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      // Create git branch - use normalized ID to avoid double prefixes
      const normalizedId = RequirementHelpers.normalizeReqId(reqId);
      const branchName = `feature/req-${normalizedId}-${kebabName}`;

      try {
        // Check if we're on main and have uncommitted changes
        const currentBranch = execSync('git branch --show-current', {
          encoding: 'utf8'
        }).trim();
        const hasUncommitted = this.hasUncommittedChanges();

        if (hasUncommitted && currentBranch === 'main') {
          console.log(
            chalk.yellow('⚠️  You have uncommitted changes on main branch')
          );
          console.log(
            chalk.blue(
              '🔄 Automatically committing requirement to main first...'
            )
          );

          // Auto-commit requirement to main
          await this.autoCommitRequirement(
            reqId,
            'Started work on requirement'
          );
        }

        // Create and switch to feature branch
        execSync(`git checkout -b ${branchName}`, {
          cwd: this.requirementManager.projectRoot,
          stdio: 'pipe'
        });
        console.log(
          chalk.green(`✅ Created and switched to branch: ${branchName}`)
        );

        // Update requirement with branch info
        const frontmatter = extractFrontmatter(content);
        frontmatter.branch = branchName;
        frontmatter.status = 'In Progress';
        frontmatter.updated = new Date().toISOString().split('T')[0];

        const { body } = parseContent(content);
        const updatedContent = reconstructContent(frontmatter, body);
        await fs.writeFile(reqFile, updatedContent);

        console.log(
          chalk.blue(`📝 Updated requirement with branch information`)
        );
        console.log(chalk.green(`🎯 Status changed to: In Progress`));

        console.log(chalk.yellow(`\n🚀 Ready to implement! Next steps:`));
        console.log(
          chalk.yellow(
            `1. Implement the requirement following the acceptance criteria`
          )
        );
        console.log(
          chalk.yellow(`2. Run tests: npm test -- req-${normalizedId}`)
        );
        console.log(
          chalk.yellow(
            `3. Commit with format: "REQ-${normalizedId}: your commit message"`
          )
        );
        console.log(
          chalk.yellow(
            `4. Generate tests: sc req generate-tests ${normalizedId}`
          )
        );
        console.log(chalk.yellow(`5. When complete: sc git-smart merge`));
      } catch (gitError) {
        console.log(chalk.red(`❌ Git error: ${gitError.message}`));
        console.log(
          chalk.yellow(
            `💡 Make sure you're in a git repository and have no uncommitted changes`
          )
        );
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error starting work: ${error.message}`));
      throw error;
    }
  }

  /**
   * Smart workflow automation - combines multiple steps
   */
  async smartStartWork(reqId, _options = {}) {
    try {
      console.log(
        chalk.blue.bold(`🚀 Smart Workflow: Starting work on ${reqId}`)
      );
      console.log(chalk.blue('='.repeat(50)));

      // 1. Auto-commit any requirement changes to main
      const currentBranch = execSync('git branch --show-current', {
        encoding: 'utf8'
      }).trim();
      if (currentBranch === 'main' && this.hasUncommittedChanges()) {
        console.log(
          chalk.blue('📝 Step 1: Committing requirement changes to main...')
        );
        await this.autoCommitRequirement(
          reqId,
          'Updated requirement for development start'
        );
      }

      // 2. Start work (creates branch, updates requirement)
      console.log(
        chalk.blue(
          '🌿 Step 2: Creating feature branch and updating requirement...'
        )
      );
      await this.startWork(reqId);

      // 3. Auto-commit the updated requirement with branch info
      if (this.hasUncommittedChanges()) {
        console.log(
          chalk.blue('💾 Step 3: Committing requirement status update...')
        );
        const normalizedId = RequirementHelpers.normalizeReqId(reqId);
        execSync(`git add .`, { cwd: this.requirementManager.projectRoot });
        execSync(
          `git commit -m "REQ-${normalizedId}: Update status to In Progress and add branch info"`,
          { cwd: this.requirementManager.projectRoot }
        );
        console.log(
          chalk.green('✅ Requirement status committed to feature branch')
        );
      }

      console.log(
        chalk.green.bold('\n🎉 Smart workflow complete! Ready to implement.')
      );
    } catch (error) {
      console.error(chalk.red(`❌ Smart workflow failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Check for uncommitted git changes
   */
  hasUncommittedChanges() {
    try {
      const result = execSync('git status --porcelain', { encoding: 'utf8' });
      return result.trim().length > 0;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Auto-commit requirement changes to main branch
   */
  async autoCommitRequirement(reqId, message) {
    try {
      const normalizedId = RequirementHelpers.normalizeReqId(reqId);
      const reqFile = await this.requirementManager.findRequirementById(reqId);

      if (reqFile) {
        // Add only the requirement file
        execSync(`git add "${reqFile}"`, {
          cwd: this.requirementManager.projectRoot
        });

        // Commit with proper REQ format, agent signing, and [SC] tag
        const commitMessage = `[SC] REQ-${normalizedId}: ${message}`;
        const signingManager = new SigningManager(this.requirementManager.projectRoot);
        const signingFlags = signingManager.getSigningFlags({ isAgentCommit: true });
        execSync(`git commit ${signingFlags} -m "${commitMessage}"`, {
          cwd: this.requirementManager.projectRoot
        });

        console.log(
          chalk.green(`✅ Committed requirement to main: ${commitMessage}`)
        );
      }
    } catch (error) {
      console.log(
        chalk.yellow(`⚠️  Could not auto-commit requirement: ${error.message}`)
      );
      throw error;
    }
  }
}

module.exports = GitManager;
