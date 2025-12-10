import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

interface CheckConfig {
  enabled?: boolean;
  block_on_errors?: boolean;
  block_on_failures?: boolean;
  allow_bypass?: boolean;
  skip_for_protected_branches?: boolean;
  update_git_tracking?: boolean;
  auto_stage_updates?: boolean;
  check_only_staged?: boolean;
}

interface PreCommitConfig {
  enabled?: boolean;
  checks?: Record<string, CheckConfig>;
}

interface PrePushConfig {
  enabled?: boolean;
  checks?: Record<string, CheckConfig>;
}

interface BypassVariables {
  date_validation?: string;
  documentation_validation?: string;
  all_hooks?: string;
  [key: string]: string | undefined;
}

interface GitHooksConfig {
  enabled?: boolean;
  pre_commit?: PreCommitConfig;
  pre_push?: PrePushConfig;
  bypass_variables?: BypassVariables;
}

interface Config {
  git_hooks: GitHooksConfig;
}

class HookConfigLoader {
  protected config: Config | null;
  protected projectRoot: string;

  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = null;
  }

  loadConfig(): Config {
    if (this.config) {
      return this.config;
    }

    const supernalPath = path.join(this.projectRoot, 'supernal.yaml');

    const defaultConfig: Config = {
      git_hooks: {
        enabled: true,
        pre_commit: {
          enabled: true,
          checks: {
            branch_naming: { enabled: true, skip_for_protected_branches: true },
            requirement_metadata: {
              enabled: true,
              update_git_tracking: true,
              auto_stage_updates: true
            },
            date_validation: {
              enabled: true,
              block_on_errors: true,
              allow_bypass: true
            },
            documentation_validation: {
              enabled: true,
              block_on_errors: true,
              allow_bypass: true
            },
            markdown_links: {
              enabled: true,
              block_on_errors: true,
              allow_bypass: true,
              check_only_staged: true
            },
            type_duplications: {
              enabled: false,
              block_on_errors: false,
              allow_bypass: true
            }
          }
        },
        pre_push: {
          enabled: false,
          checks: {
            test_suite: { enabled: false, block_on_failures: true },
            lint_check: { enabled: false, block_on_failures: false }
          }
        },
        bypass_variables: {
          date_validation: 'SC_SKIP_DATE_VALIDATION',
          documentation_validation: 'SC_SKIP_DOC_VALIDATION',
          all_hooks: 'SC_SKIP_HOOKS'
        }
      }
    };

    if (!fs.existsSync(supernalPath)) {
      this.config = defaultConfig;
      return this.config;
    }

    try {
      const content = fs.readFileSync(supernalPath, 'utf8');
      const yamlConfig = yaml.parse(content) as Partial<Config>;

      this.config = this.mergeConfig(defaultConfig, yamlConfig);
      return this.config;
    } catch (error) {
      console.error(
        'Warning: Failed to parse supernal.yaml, using defaults:',
        (error as Error).message
      );
      this.config = defaultConfig;
      return this.config;
    }
  }

  mergeConfig(defaults: Config, custom: Partial<Config> | null): Config {
    const result = { ...defaults } as any;

    if (!custom) return result;

    for (const key in custom) {
      const customValue = (custom as any)[key];
      if (
        customValue &&
        typeof customValue === 'object' &&
        !Array.isArray(customValue)
      ) {
        result[key] = this.mergeConfig((defaults as any)[key] || {}, customValue);
      } else {
        result[key] = customValue;
      }
    }

    return result;
  }

  areHooksEnabled(): boolean {
    const config = this.loadConfig();

    if (
      process.env[
        config.git_hooks.bypass_variables?.all_hooks || 'SC_SKIP_HOOKS'
      ]
    ) {
      return false;
    }

    return config.git_hooks?.enabled !== false;
  }

  getPreCommitConfig(): PreCommitConfig {
    const config = this.loadConfig();
    return config.git_hooks?.pre_commit || {};
  }

  isCheckEnabled(checkName: string): boolean {
    if (!this.areHooksEnabled()) {
      return false;
    }

    const preCommit = this.getPreCommitConfig();
    if (!preCommit.enabled) {
      return false;
    }

    const check = preCommit.checks?.[checkName];
    if (!check) {
      return false;
    }

    if (check.allow_bypass) {
      const config = this.loadConfig();
      const bypassVar = config.git_hooks.bypass_variables?.[checkName];
      if (bypassVar && process.env[bypassVar]) {
        return false;
      }
    }

    return check.enabled !== false;
  }

  getCheckConfig(checkName: string): CheckConfig {
    const preCommit = this.getPreCommitConfig();
    return preCommit.checks?.[checkName] || {};
  }

  shouldBlockOnErrors(checkName: string): boolean {
    const check = this.getCheckConfig(checkName);
    return check.block_on_errors !== false && check.block_on_failures !== false;
  }

  getBypassVariable(checkName: string): string | null {
    const config = this.loadConfig();
    return config.git_hooks.bypass_variables?.[checkName] || null;
  }

  generateReport(): string {
    const lines: string[] = [];

    lines.push('Git Hooks Configuration');
    lines.push('======================');
    lines.push('');

    if (!this.areHooksEnabled()) {
      lines.push('[DISABLED] Git hooks are DISABLED');
      lines.push('');
      return lines.join('\n');
    }

    lines.push('[OK] Git hooks are enabled');
    lines.push('');

    const preCommit = this.getPreCommitConfig();
    lines.push('Pre-commit Checks:');
    lines.push('------------------');

    for (const [checkName, checkConfig] of Object.entries(
      preCommit.checks || {}
    )) {
      const enabled = this.isCheckEnabled(checkName);
      const status = enabled ? '[OK]' : '[OFF]';
      const bypassVar = this.getBypassVariable(checkName);

      lines.push(`${status} ${checkName}`);
      if (enabled && checkConfig.block_on_errors) {
        lines.push(`   Blocks commits on errors`);
      }
      if (bypassVar) {
        lines.push(`   Bypass with: ${bypassVar}=true`);
      }
    }

    return lines.join('\n');
  }

  static showHelp(): void {
    console.log(`
Git Hooks Configuration
=======================

Configuration is loaded from supernal.yaml in your project root.

Example configuration:

git_hooks:
  enabled: true
  pre_commit:
    enabled: true
    checks:
      branch_naming:
        enabled: true
        skip_for_protected_branches: true
      requirement_metadata:
        enabled: true
        update_git_tracking: true
      date_validation:
        enabled: true
        block_on_errors: true
        allow_bypass: true
      documentation_validation:
        enabled: true
        block_on_errors: true
        allow_bypass: true
      markdown_links:
        enabled: true
        block_on_errors: true
        allow_bypass: true
      type_duplications:
        enabled: false
        block_on_errors: false

Environment Variables (Bypass):
  SC_SKIP_HOOKS=true              Disable all hooks
  SC_SKIP_DATE_VALIDATION=true    Skip date validation
  SC_SKIP_DOC_VALIDATION=true     Skip documentation validation

Commands:
  sc git-hooks show-config         Show current configuration
  sc git-hooks install             Install hooks with config
  sc git-hooks status              Show hook status

Documentation:
  See docs/guides/git-hooks-configuration.md
`);
  }
}

export default HookConfigLoader;
module.exports = HookConfigLoader;
