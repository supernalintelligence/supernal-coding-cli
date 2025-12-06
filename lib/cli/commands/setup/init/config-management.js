const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const yaml = require('js-yaml');

/**
 * Create supernal.yaml configuration file
 * @param {string} gitRoot - Git repository root
 * @param {Object} resolvedPaths - Resolved paths configuration
 * @param {Object} structure - Repository structure analysis
 * @param {Object} gitInfo - Git repository information
 * @param {Object} activeFeatures - Active features configuration
 */
async function createEnhancedYAMLConfig(
  gitRoot,
  resolvedPaths,
  _structure,
  _gitInfo,
  activeFeatures = {}
) {
  console.log(chalk.blue('📝 Creating supernal.yaml configuration...'));

  const configPath = path.join(gitRoot, 'supernal.yaml');

  // Check if config already exists
  if (await fs.pathExists(configPath)) {
    console.log(chalk.gray('  ✓ supernal.yaml already exists, skipping'));
    return;
  }

  // Create comprehensive YAML config with git hooks if git management is active
  const config = {
    version: '3.0.0',
    workflow: 'agile-4',
    project: {
      name: path.basename(gitRoot),
      description: 'Project managed with Supernal Coding',
      docs_dir: resolvedPaths.docs || 'docs',
      requirements_dir: resolvedPaths.requirements || 'docs/requirements'
    },
    documentation: {
      kanban_dir: resolvedPaths.kanban || 'docs/planning/kanban',
      adr_dir: 'docs/adr',
      planning_dir: 'docs/planning',
      architecture_dir: 'docs/architecture',
      sessions_dir: 'docs/sessions',
      handoffs_dir: 'docs/handoffs'
    }
  };

  // Add git hooks configuration if git management is enabled
  if (activeFeatures.gitManagement) {
    config.git_hooks = {
      enabled: true,
      hooks_dir: '.git/hooks',
      pre_commit: {
        enabled: true,
        checks: {
          requirements_validation: {
            enabled: true,
            description: 'Validate requirement files structure and links',
            skip_env: 'SC_SKIP_REQ_VALIDATION'
          },
          markdown_links: {
            enabled: true,
            description: 'Check for broken markdown links',
            skip_env: 'SC_SKIP_DOC_VALIDATION'
          },
          feature_validation: {
            enabled: true,
            description: 'Validate feature structure and status',
            skip_env: 'SC_SKIP_FEATURE_VALIDATION'
          },
          eslint: {
            enabled: true,
            description: 'Run ESLint on staged files',
            skip_env: 'SC_SKIP_ESLINT'
          }
        }
      },
      pre_push: {
        enabled: true,
        checks: {
          test_suite: {
            enabled: true,
            description: 'Run test suite before push',
            skip_env: 'SC_SKIP_TESTS'
          },
          branch_protection: {
            enabled: true,
            description: 'Prevent direct pushes to protected branches',
            protected_branches: ['main', 'master', 'production'],
            skip_env: 'SC_SKIP_BRANCH_PROTECTION'
          }
        }
      }
    };
  }

  await fs.writeFile(configPath, yaml.dump(config), 'utf8');
  console.log(chalk.green('  ✓ Created supernal.yaml'));

  if (activeFeatures.gitManagement) {
    console.log(chalk.gray('    • Git hooks configuration included'));
  }
}

module.exports = {
  createEnhancedTOMLConfig: createEnhancedYAMLConfig
};
