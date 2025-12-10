import fs from 'fs-extra';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
const RequirementHelpers = require('./utils/helpers');
const {
  extractFrontmatter,
  parseContent,
  reconstructContent
} = require('./utils/parsers');
const { SigningManager } = require('../../../signing');

interface RequirementManagerInterface {
  projectRoot: string;
  findRequirementById(reqId: string): Promise<string | null>;
}

interface StartWorkOptions {
  // placeholder for future options
}

class GitManager {
  protected requirementManager: RequirementManagerInterface;

  constructor(requirementManager: RequirementManagerInterface) {
    this.requirementManager = requirementManager;
  }

  async startWork(reqId: string): Promise<void> {
    try {
      const reqFile = await this.requirementManager.findRequirementById(reqId);
      if (!reqFile) {
        throw new Error(`Requirement ${reqId} not found`);
      }

      const content = await fs.readFile(reqFile, 'utf8');

      const titleMatch = content.match(/title: (.+)/);
      const title = titleMatch ? titleMatch[1] : 'unknown-requirement';
      const kebabName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const normalizedId = RequirementHelpers.normalizeReqId(reqId);
      const branchName = `feature/req-${normalizedId}-${kebabName}`;

      try {
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

          await this.autoCommitRequirement(
            reqId,
            'Started work on requirement'
          );
        }

        execSync(`git checkout -b ${branchName}`, {
          cwd: this.requirementManager.projectRoot,
          stdio: 'pipe'
        });
        console.log(
          chalk.green(`✅ Created and switched to branch: ${branchName}`)
        );

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
        console.log(chalk.red(`❌ Git error: ${(gitError as Error).message}`));
        console.log(
          chalk.yellow(
            `💡 Make sure you're in a git repository and have no uncommitted changes`
          )
        );
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error starting work: ${(error as Error).message}`));
      throw error;
    }
  }

  async smartStartWork(reqId: string, _options: StartWorkOptions = {}): Promise<void> {
    try {
      console.log(
        chalk.blue.bold(`🚀 Smart Workflow: Starting work on ${reqId}`)
      );
      console.log(chalk.blue('='.repeat(50)));

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

      console.log(
        chalk.blue(
          '🌿 Step 2: Creating feature branch and updating requirement...'
        )
      );
      await this.startWork(reqId);

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
      console.error(chalk.red(`❌ Smart workflow failed: ${(error as Error).message}`));
      throw error;
    }
  }

  hasUncommittedChanges(): boolean {
    try {
      const result = execSync('git status --porcelain', { encoding: 'utf8' });
      return result.trim().length > 0;
    } catch (_error) {
      return false;
    }
  }

  async autoCommitRequirement(reqId: string, message: string): Promise<void> {
    try {
      const normalizedId = RequirementHelpers.normalizeReqId(reqId);
      const reqFile = await this.requirementManager.findRequirementById(reqId);

      if (reqFile) {
        execSync(`git add "${reqFile}"`, {
          cwd: this.requirementManager.projectRoot
        });

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
        chalk.yellow(`⚠️  Could not auto-commit requirement: ${(error as Error).message}`)
      );
      throw error;
    }
  }
}

export default GitManager;
module.exports = GitManager;
