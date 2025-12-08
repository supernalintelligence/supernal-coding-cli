---
title: "Configuration Management"
sidebar_label: "Configuration Management"
---

# Configuration Management

Supernal Coding uses `supernal.yaml` as the central configuration file for managing project settings, workflows, and git hooks.

## Configuration File Location

The configuration file is located at the project root:

```
supernal.yaml
```

## Viewing Configuration

### Show Full Configuration

```bash
sc config show
```

### Show Specific Section

```bash
sc config show --section git_hooks
sc config show --section documentation
```

### Show as JSON

```bash
sc config show --json
```

## Getting Configuration Values

```bash
# Get a specific value using dot notation
sc config get version
sc config get git_hooks.enabled
sc config get git_hooks.pre_commit.checks.markdown_links.enabled
```

## Setting Configuration Values

```bash
# Set a value using dot notation
sc config set git_hooks.enabled true
sc config set git_hooks.pre_commit.checks.markdown_links.enabled false
sc config set workflow agile-4

# Values are automatically parsed:
# - "true"/"false" → boolean
# - Numbers → number
# - JSON objects/arrays → parsed
# - Everything else → string
```

## Git Hooks Configuration

The git hooks system is fully configurable through `supernal.yaml`:

```bash
# View current hooks configuration
sc config hooks

# View detailed hooks configuration
sc config hooks --verbose

# Enable/disable entire hooks system
sc config set git_hooks.enabled true

# Enable/disable specific checks
sc config set git_hooks.pre_commit.checks.markdown_links.enabled true
sc config set git_hooks.pre_commit.checks.requirements_validation.enabled false

# Configure protected branches
sc config set git_hooks.pre_push.checks.branch_protection.protected_branches "main,master,production"
```

### Available Pre-Commit Checks

| Check                     | Description                                    | Skip Environment Variable    |
| ------------------------- | ---------------------------------------------- | ---------------------------- |
| `requirements_validation` | Validate requirement files structure and links | `SC_SKIP_REQ_VALIDATION`     |
| `markdown_links`          | Check for broken markdown links                | `SC_SKIP_DOC_VALIDATION`     |
| `feature_validation`      | Validate feature structure and status          | `SC_SKIP_FEATURE_VALIDATION` |
| `eslint`                  | Run ESLint on staged files                     | `SC_SKIP_ESLINT`             |

### Available Pre-Push Checks

| Check               | Description                                 | Skip Environment Variable   |
| ------------------- | ------------------------------------------- | --------------------------- |
| `test_suite`        | Run test suite before push                  | `SC_SKIP_TESTS`             |
| `branch_protection` | Prevent direct pushes to protected branches | `SC_SKIP_BRANCH_PROTECTION` |

## Configuration Structure

```yaml
version: '3.0.0'
workflow: 'agile-4'

project:
  name: my-project
  description: Project managed with Supernal Coding
  docs_dir: docs
  requirements_dir: docs/requirements

documentation:
  kanban_dir: docs/planning/kanban
  adr_dir: docs/adr
  planning_dir: docs/planning
  architecture_dir: docs/architecture
  sessions_dir: docs/sessions
  handoffs_dir: docs/handoffs

git_hooks:
  enabled: true
  hooks_dir: .git/hooks
  pre_commit:
    enabled: true
    checks:
      requirements_validation:
        enabled: true
        description: Validate requirement files structure and links
        skip_env: SC_SKIP_REQ_VALIDATION
      markdown_links:
        enabled: true
        description: Check for broken markdown links
        skip_env: SC_SKIP_DOC_VALIDATION
      feature_validation:
        enabled: true
        description: Validate feature structure and status
        skip_env: SC_SKIP_FEATURE_VALIDATION
      eslint:
        enabled: true
        description: Run ESLint on staged files
        skip_env: SC_SKIP_ESLINT
  pre_push:
    enabled: true
    checks:
      test_suite:
        enabled: true
        description: Run test suite before push
        skip_env: SC_SKIP_TESTS
      branch_protection:
        enabled: true
        description: Prevent direct pushes to protected branches
        protected_branches:
          - main
          - master
          - production
        skip_env: SC_SKIP_BRANCH_PROTECTION
```

## Editing Configuration

### Manual Editing

```bash
# Open in your default editor
sc config edit

# Or edit directly
vi supernal.yaml
```

### Programmatic Editing

Use the `sc config set` command for safe, validated updates.

## Validation

```bash
# Validate configuration syntax and structure
sc config validate

# Validate with verbose output
sc config validate --verbose
```

## Dashboard Integration

The dashboard can read and write the `supernal.yaml` configuration:

- **Read-only in Production**: Configuration editing is disabled on Vercel/production
- **Local Development**: Full read/write access
- **Backup**: Automatic backup created before changes (`supernal.yaml.backup`)

### Dashboard API Endpoints

```typescript
// Get configuration
GET / api / [repoId] / config - file;
GET / api / [repoId] / config - schema;

// Update configuration (local only)
POST / api / [repoId] / config - file;
POST / api / [repoId] / config - schema;
```

## Templates and Initialization

When running `sc init`, the configuration is created with defaults based on the preset:

### Minimal Preset

```bash
sc init --minimal
# Creates basic configuration without git hooks
```

### Standard/Full Preset

```bash
sc init --standard
sc init --full
# Creates comprehensive configuration with git hooks enabled
```

## Best Practices

1. **Use `sc config` commands** instead of manual editing to avoid syntax errors
2. **Review changes** with `sc config show` after updates
3. **Validate** after manual edits with `sc config validate`
4. **Backup** important configurations before major changes
5. **Document custom settings** in your project README
6. **Version control** your `supernal.yaml` file
7. **Test git hooks** after configuration changes

## Troubleshooting

### Configuration Not Found

```bash
$ sc config show
⚠️  No supernal.yaml found in current directory

Run: sc init to create configuration
```

**Solution**: Run `sc init` to create a new configuration.

### Invalid Configuration

```bash
$ sc config validate
❌ Configuration validation failed: Invalid YAML syntax
```

**Solution**: Check for syntax errors, or restore from backup.

### Git Hooks Not Working

```bash
# Check if hooks are enabled
sc config get git_hooks.enabled

# Check if hooks are installed
sc git-hooks status

# Reinstall hooks
sc git-hooks install
```

### Dashboard Cannot Update Configuration

**Error**: "Configuration editing is disabled in production/deployed environments"

**Solution**: This is expected. Configuration can only be edited locally for security.

## See Also

- [Git Hooks Documentation](../workflow/sops/general/SOP-0.1.12-git-workflow.md)
- [Fixing Broken Links Guide](./fixing-broken-links.md)
- [Feature Management](../../.cursor/rules/feature-management.mdc)
- See supernal-code-package README

