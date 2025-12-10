// @ts-nocheck
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

  const projectName = path.basename(gitRoot);
  const docsRoot = resolvedPaths.docs || 'docs';

  // Create comprehensive YAML config matching template structure
  const config = {
    // Project metadata
    project: {
      name: projectName,
      description: 'Project managed with Supernal Coding',
      version: '1.0.0'
    },

    // Documentation paths (all relative to project root)
    docs: {
      root: docsRoot,
      features: `${docsRoot}/features`,
      requirements: resolvedPaths.requirements || `${docsRoot}/requirements`,
      architecture: `${docsRoot}/architecture`,
      planning: `${docsRoot}/planning`,
      guides: `${docsRoot}/guides`,
      compliance: `${docsRoot}/compliance`,
      handoffs: `${docsRoot}/handoffs`
    },

    // Git configuration
    git: {
      // Agent commit signing - distinguish AI agent commits from human commits
      // When enabled:
      //   - Human commits: Use user's GPG key (if configured)
      //   - SC commits: Explicitly unsigned + [SC] prefix in message
      signing: {
        enabled: false, // Set true to enable SC signing behavior
        agent_commits: {
          sign: false, // false = unsigned (recommended), true = use agent GPG key
          key_source: 'registry' // 'registry' or 'environment' (SC_AGENT_GPG_KEY)
        },
        human_commits: {
          require_signature: false // If true, SC tools warn on unsigned human commits
        },
        agent_registry: '.supernal/config/agents.yaml'
      }
    },

    // Requirements configuration
    requirements: {
      path: resolvedPaths.requirements || `${docsRoot}/requirements`,
      format: 'gherkin', // 'gherkin' or 'markdown'
      id_prefix: 'REQ',
      categories: ['core', 'infrastructure', 'workflow', 'compliance']
    },

    // Features configuration
    features: {
      path: `${docsRoot}/features`,
      domains: [
        'ai-workflow-system',
        'compliance-framework',
        'developer-tooling',
        'integrations',
        'workflow-management'
      ]
    },

    // Compliance (optional)
    compliance: {
      enabled: false,
      framework: null, // 'hipaa', 'soc2', 'iso27001', or custom
      evidence_path: `${docsRoot}/compliance/evidence`
    },

    // CLI behavior
    cli: {
      verbose: false,
      colors: true,
      confirmDestructive: true
    },

    // Testing configuration
    testing: {
      framework: 'jest', // 'jest', 'vitest', 'mocha'
      coverageThreshold: 80,
      testPaths: ['tests', '__tests__']
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
          wip_registry_check: {
            enabled: true,
            block_on_untracked: true,
            threshold: 5,
            allow_bypass: true
          },
          lint: {
            enabled: true,
            allow_bypass: true
          },
          type_check: {
            enabled: true,
            allow_bypass: true
          }
        }
      },
      pre_push: {
        enabled: true,
        checks: {
          requirement_validation: {
            enabled: true,
            allow_bypass: true
          },
          test_suite: {
            enabled: true,
            skip_env: 'SC_SKIP_TESTS'
          },
          branch_protection: {
            enabled: true,
            protected_branches: ['main', 'master', 'production'],
            skip_env: 'SC_SKIP_BRANCH_PROTECTION'
          }
        }
      },
      bypass_variables: {
        wip_registry: 'SC_SKIP_WIP_CHECK',
        lint: 'SC_SKIP_LINT',
        type_check: 'SC_SKIP_TYPE_CHECK',
        all_hooks: 'SC_SKIP_HOOKS'
      }
    };
  }

  // Monitor section (optional, disabled by default)
  config.monitor = {
    enabled: false,
    repos: [{ path: '.' }],
    pollInterval: 60000
  };

  await fs.writeFile(configPath, yaml.dump(config, { indent: 2 }), 'utf8');
  console.log(chalk.green('  ✓ Created supernal.yaml'));

  if (activeFeatures.gitManagement) {
    console.log(chalk.gray('    • Git hooks configuration included'));
  }
  console.log(chalk.gray('    • Git signing configuration included (disabled by default)'));
}

module.exports = {
  createEnhancedTOMLConfig: createEnhancedYAMLConfig
};
