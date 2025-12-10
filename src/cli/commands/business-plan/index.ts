#!/usr/bin/env node
// @ts-nocheck

const chalk = require('chalk');
const BusinessPlanManager = require('./BusinessPlanManager');
const { getConfig } = require('../../../scripts/config-loader');

/**
 * Business Plan Command Handler
 * CLI interface for business plan management
 */
class BusinessPlanCommandHandler {
  manager: any;
  projectRoot: any;
  constructor() {
    this.projectRoot = this.findProjectRoot();
    const config = getConfig(this.projectRoot);
    config.load();
    this.manager = new BusinessPlanManager(this.projectRoot);
  }

  /**
   * Find the project root
   */
  findProjectRoot() {
    const fs = require('fs-extra');
    const path = require('node:path');
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      const configPath = path.join(currentDir, 'supernal.yaml');
      if (fs.existsSync(configPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    return process.cwd();
  }

  /**
   * Handle business plan command
   */
  async handleCommand(action, ...args) {
    try {
      if (!action) {
        await this.listPlans();
        return;
      }

      switch (action) {
        case 'create':
        case 'new': {
          if (args.length < 2) {
            console.error(chalk.red('❌ Plan ID and title are required'));
            console.log(
              chalk.blue(
                'Usage: sc business-plan create demo-backend "Demo Backend Plan"'
              )
            );
            process.exit(1);
          }
          const planId = args[0];
          const title = args[1];
          const options = this.parseOptions(args.slice(2));
          await this.manager.createBusinessPlan(planId, title, options);
          break;
        }

        case 'list':
        case 'ls': {
          const filterOptions = this.parseOptions(args);
          await this.listPlans(filterOptions);
          break;
        }

        case 'show':
        case 'get': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Plan ID is required'));
            console.log(
              chalk.blue('Usage: sc business-plan show demo-backend')
            );
            process.exit(1);
          }
          await this.showPlan(args[0]);
          break;
        }

        case 'link-req':
        case 'link-requirement': {
          if (args.length < 3) {
            console.error(
              chalk.red('❌ Plan ID, requirement ID, and title are required')
            );
            console.log(
              chalk.blue(
                'Usage: sc business-plan link-req demo-backend REQ-AUTH-001 "User Authentication"'
              )
            );
            process.exit(1);
          }
          await this.manager.linkRequirement(args[0], args[1], args[2]);
          break;
        }

        case 'link-subreq':
        case 'link-sub-requirement': {
          if (args.length < 4) {
            console.error(
              chalk.red(
                '❌ Plan ID, sub-requirement ID, title, and parent requirement ID are required'
              )
            );
            console.log(
              chalk.blue(
                'Usage: sc business-plan link-subreq demo-backend SUB-REQ-AUTH-001.A "Email Validation" REQ-AUTH-001'
              )
            );
            process.exit(1);
          }
          await this.manager.linkSubRequirement(
            args[0],
            args[1],
            args[2],
            args[3]
          );
          break;
        }

        case 'unlink-req':
        case 'unlink-requirement': {
          if (args.length < 2) {
            console.error(
              chalk.red('❌ Plan ID and requirement ID are required')
            );
            console.log(
              chalk.blue(
                'Usage: sc business-plan unlink-req demo-backend REQ-AUTH-001'
              )
            );
            process.exit(1);
          }
          await this.manager.unlinkRequirement(args[0], args[1]);
          break;
        }

        case 'status': {
          if (args.length < 2) {
            console.error(chalk.red('❌ Plan ID and new status are required'));
            console.log(
              chalk.blue(
                'Usage: sc business-plan status demo-backend in-progress'
              )
            );
            process.exit(1);
          }
          await this.manager.updateStatus(args[0], args[1]);
          break;
        }

        case 'progress': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Plan ID is required'));
            console.log(
              chalk.blue('Usage: sc business-plan progress demo-backend')
            );
            process.exit(1);
          }
          await this.showProgress(args[0]);
          break;
        }

        case 'delete': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Plan ID is required'));
            console.log(
              chalk.blue('Usage: sc business-plan delete demo-backend')
            );
            process.exit(1);
          }
          await this.manager.deleteBusinessPlan(args[0]);
          break;
        }

        case 'help':
          this.showHelp();
          break;

        default:
          console.log(chalk.red(`❌ Unknown action: "${action}"`));
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Command failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * List all business plans
   */
  async listPlans(filterOptions = {}) {
    const plans = await this.manager.listBusinessPlans(filterOptions);

    if (plans.length === 0) {
      console.log(chalk.yellow('No business plans found'));
      console.log(
        chalk.blue('Create a plan with: sc business-plan create <id> <title>')
      );
      return;
    }

    console.log(chalk.bold(`\n🎯 Business Plans (${plans.length}):\n`));

    // Group by category
    const byCategory = {};
    for (const plan of plans) {
      const cat = plan.category || 'general';
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(plan);
    }

    for (const [category, categoryPlans] of Object.entries(byCategory)) {
      console.log(chalk.cyan(`\n  ${category.toUpperCase()}`));
      console.log(chalk.gray(`  ${'─'.repeat(50)}`));

      for (const plan of categoryPlans) {
        const statusIcon =
          {
            planning: '📝',
            'in-progress': '🔨',
            'demo-ready': '🎬',
            completed: '✅',
            cancelled: '❌'
          }[plan.status] || '📋';

        const priorityIcon =
          {
            high: '🔴',
            medium: '🟡',
            low: '🟢'
          }[plan.priority] || '⚪';

        console.log(
          chalk.white(
            `  ${statusIcon} ${priorityIcon} ${plan.id}: ${plan.title}`
          )
        );
        console.log(
          chalk.gray(
            `     Status: ${plan.status} | Business Value: ${plan.businessValue || 'medium'}`
          )
        );
        if (plan.demoDate) {
          console.log(chalk.gray(`     Demo Date: ${plan.demoDate}`));
        }
      }
    }
    console.log();
  }

  /**
   * Show business plan details
   */
  async showPlan(planId) {
    const plan = await this.manager.getBusinessPlan(planId);

    console.log(chalk.bold(`\n🎯 ${plan.title} (${plan.id})\n`));
    console.log(chalk.gray(`Status: ${plan.status}`));
    console.log(chalk.gray(`Priority: ${plan.priority}`));
    console.log(chalk.gray(`Category: ${plan.category}`));
    console.log(
      chalk.gray(`Business Value: ${plan.businessValue || 'medium'}`)
    );

    if (plan.owner) {
      console.log(chalk.gray(`Owner: ${plan.owner}`));
    }

    if (plan.demoDate) {
      console.log(chalk.gray(`Demo Date: ${plan.demoDate}`));
    }

    if (plan.requirements && plan.requirements.length > 0) {
      console.log(
        chalk.cyan(`\nLinked Requirements (${plan.requirements.length}):`)
      );
      for (const reqId of plan.requirements) {
        console.log(chalk.white(`  • ${reqId}`));
      }
    }

    if (plan.subRequirements && plan.subRequirements.length > 0) {
      console.log(
        chalk.cyan(
          `\nLinked Sub-Requirements (${plan.subRequirements.length}):`
        )
      );
      for (const subReq of plan.subRequirements) {
        console.log(
          chalk.white(
            `  • ${subReq.id} - ${subReq.title} (parent: ${subReq.parent})`
          )
        );
      }
    }

    console.log(chalk.gray(`\nCreated: ${plan.created}`));
    console.log(chalk.gray(`Updated: ${plan.updated}\n`));
  }

  /**
   * Show progress for a plan
   */
  async showProgress(planId) {
    const progress = await this.manager.getProgress(planId);

    console.log(chalk.bold(`\n📊 Progress for ${planId}:\n`));
    console.log(chalk.cyan(`Total Items: ${progress.total}`));
    console.log(chalk.cyan(`  Requirements: ${progress.requirements}`));
    console.log(chalk.cyan(`  Sub-Requirements: ${progress.subRequirements}`));
    console.log(chalk.green(`Completed: ${progress.completed}`));
    console.log(chalk.blue(`Progress: ${progress.percentage}%\n`));
  }

  /**
   * Parse command options
   */
  parseOptions(args) {
    const options = {};
    for (const arg of args) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        if (key === 'stakeholders' || key === 'tags') {
          options[key] = value ? value.split(',') : [];
        } else {
          options[key] = value || true;
        }
      }
    }
    return options;
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(chalk.bold('\n🎯 Business Plan Management\n'));
    console.log(chalk.cyan('Plan Management:'));
    console.log(
      '  create <id> <title> [options]    Create a new business plan'
    );
    console.log('  list [--status=X]                List all business plans');
    console.log('  show <id>                        Show plan details');
    console.log('  delete <id>                      Delete a plan');
    console.log('  status <id> <status>             Update plan status\n');

    console.log(chalk.cyan('Linking:'));
    console.log(
      '  link-req <plan-id> <req-id> <title>         Link requirement'
    );
    console.log(
      '  link-subreq <plan-id> <subreq-id> <title> <parent-req>  Link sub-requirement'
    );
    console.log(
      '  unlink-req <plan-id> <req-id>                Unlink requirement\n'
    );

    console.log(chalk.cyan('Tracking:'));
    console.log('  progress <id>                    Show plan progress\n');

    console.log(chalk.cyan('Options:'));
    console.log(
      '  --category=<cat>          Plan category (demo|compliance|etc)'
    );
    console.log('  --priority=<pri>          Priority (high|medium|low)');
    console.log('  --owner=<name>            Plan owner');
    console.log('  --demoDate=<date>         Target demo date');
    console.log('  --businessValue=<val>     Business value (high|medium|low)');
    console.log(
      '  --stakeholders=<list>     Comma-separated stakeholder list\n'
    );

    console.log(chalk.cyan('Examples:'));
    console.log(
      chalk.gray(
        '  sc business-plan create demo-backend "Demo Backend" --category=demo --demoDate=2024-12-01'
      )
    );
    console.log(
      chalk.gray(
        '  sc business-plan link-req demo-backend REQ-AUTH-001 "User Authentication"'
      )
    );
    console.log(
      chalk.gray('  sc business-plan status demo-backend in-progress')
    );
    console.log(chalk.gray('  sc business-plan progress demo-backend'));
    console.log();
  }
}

// CLI Interface
async function handleBusinessPlanCommand(action, ...args) {
  const handler = new BusinessPlanCommandHandler();
  await handler.handleCommand(action, ...args);
}

module.exports = {
  BusinessPlanCommandHandler,
  handleBusinessPlanCommand
};

// If called directly
if (require.main === module) {
  const [, , action, ...args] = process.argv;
  handleBusinessPlanCommand(action, ...args);
}
