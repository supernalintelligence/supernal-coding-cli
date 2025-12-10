import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'js-yaml';

interface ResolvedPaths {
  docs?: string;
  requirements?: string;
}

interface GitHooksConfig {
  enabled: boolean;
  hooks_dir: string;
  pre_commit: {
    enabled: boolean;
    checks: {
      wip_registry_check: {
        enabled: boolean;
        block_on_untracked: boolean;
        threshold: number;
        allow_bypass: boolean;
      };
      lint: {
        enabled: boolean;
        allow_bypass: boolean;
      };
      type_check: {
        enabled: boolean;
        allow_bypass: boolean;
      };
    };
  };
  pre_push: {
    enabled: boolean;
    checks: {
      requirement_validation: {
        enabled: boolean;
        allow_bypass: boolean;
      };
      test_suite: {
        enabled: boolean;
        skip_env: string;
      };
      branch_protection: {
        enabled: boolean;
        protected_branches: string[];
        skip_env: string;
      };
    };
  };
  bypass_variables: {
    wip_registry: string;
    lint: string;
    type_check: string;
    all_hooks: string;
  };
}

interface SupernalConfig {
  project: {
    name: string;
    description: string;
    version: string;
  };
  docs: {
    root: string;
    features: string;
    requirements: string;
    architecture: string;
    planning: string;
    guides: string;
    compliance: string;
    handoffs: string;
  };
  git: {
    signing: {
      enabled: boolean;
      agent_commits: {
        sign: boolean;
        key_source: string;
      };
      human_commits: {
        require_signature: boolean;
      };
      agent_registry: string;
    };
  };
  requirements: {
    path: string;
    format: string;
    id_prefix: string;
    categories: string[];
  };
  features: {
    path: string;
    domains: string[];
  };
  compliance: {
    enabled: boolean;
    framework: string | null;
    evidence_path: string;
  };
  cli: {
    verbose: boolean;
    colors: boolean;
    confirmDestructive: boolean;
  };
  testing: {
    framework: string;
    coverageThreshold: number;
    testPaths: string[];
  };
  git_hooks?: GitHooksConfig;
  monitor: {
    enabled: boolean;
    repos: Array<{ path: string }>;
    pollInterval: number;
  };
}

interface ActiveFeatures {
  gitManagement?: boolean;
}

async function createEnhancedYAMLConfig(
  gitRoot: string,
  resolvedPaths: ResolvedPaths,
  _structure: unknown,
  _gitInfo: unknown,
  activeFeatures: ActiveFeatures = {}
): Promise<void> {
  console.log(chalk.blue('📝 Creating supernal.yaml configuration...'));

  const configPath = path.join(gitRoot, 'supernal.yaml');

  if (await fs.pathExists(configPath)) {
    console.log(chalk.gray('  ✓ supernal.yaml already exists, skipping'));
    return;
  }

  const projectName = path.basename(gitRoot);
  const docsRoot = resolvedPaths.docs || 'docs';

  const config: SupernalConfig = {
    project: {
      name: projectName,
      description: 'Project managed with Supernal Coding',
      version: '1.0.0'
    },

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

    git: {
      signing: {
        enabled: false,
        agent_commits: {
          sign: false,
          key_source: 'registry'
        },
        human_commits: {
          require_signature: false
        },
        agent_registry: '.supernal/config/agents.yaml'
      }
    },

    requirements: {
      path: resolvedPaths.requirements || `${docsRoot}/requirements`,
      format: 'gherkin',
      id_prefix: 'REQ',
      categories: ['core', 'infrastructure', 'workflow', 'compliance']
    },

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

    compliance: {
      enabled: false,
      framework: null,
      evidence_path: `${docsRoot}/compliance/evidence`
    },

    cli: {
      verbose: false,
      colors: true,
      confirmDestructive: true
    },

    testing: {
      framework: 'jest',
      coverageThreshold: 80,
      testPaths: ['tests', '__tests__']
    },

    monitor: {
      enabled: false,
      repos: [{ path: '.' }],
      pollInterval: 60000
    }
  };

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

  await fs.writeFile(configPath, yaml.dump(config, { indent: 2 }), 'utf8');
  console.log(chalk.green('  ✓ Created supernal.yaml'));

  if (activeFeatures.gitManagement) {
    console.log(chalk.gray('    • Git hooks configuration included'));
  }
  console.log(chalk.gray('    • Git signing configuration included (disabled by default)'));
}

export { createEnhancedYAMLConfig as createEnhancedTOMLConfig };
module.exports = {
  createEnhancedTOMLConfig: createEnhancedYAMLConfig
};
