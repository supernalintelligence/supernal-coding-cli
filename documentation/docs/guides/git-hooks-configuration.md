---
title: "Git Hooks Configuration Guide"
sidebar_label: "Git Hooks Configuration Guide"
---

# Git Hooks Configuration Guide

## Overview

Supernal Coding's git hooks are **fully configurable** through `supernal.yaml`. Each developer can customize which validations run, and projects can enforce team-wide standards.

## Quick Start

### View Current Configuration

```bash
sc git-hooks show-config
```

### Configure in supernal.yaml

```yaml
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
        auto_stage_updates: true
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
        check_only_staged: true
      type_duplications:
        enabled: false # Disabled by default (can be slow)
        block_on_errors: false
```

## Configuration Options

### Global Settings

#### `git_hooks.enabled`

- **Type:** Boolean
- **Default:** `true`
- **Description:** Master switch for all git hooks
- **Bypass:** `SC_SKIP_HOOKS=true git commit`

#### `git_hooks.pre_commit.enabled`

- **Type:** Boolean
- **Default:** `true`
- **Description:** Enable/disable pre-commit hook entirely

### Individual Check Configuration

Each check supports these common options:

- **`enabled`**: Boolean - Enable/disable the check
- **`block_on_errors`**: Boolean - Should errors prevent commits?
- **`allow_bypass`**: Boolean - Allow environment variable bypass?

### Available Checks

#### 1. Branch Naming Validation

```yaml
branch_naming:
  enabled: true
  skip_for_protected_branches: true
```

**What it does:**

- Validates branch names follow convention: `feature/req-XXX-description`
- Skips validation for `main`, `master`, `develop` if configured

**When to disable:**

- Working on personal forks
- Rapid prototyping without requirements

#### 2. Requirement Metadata

```yaml
requirement_metadata:
  enabled: true
  update_git_tracking: true
  auto_stage_updates: true
```

**What it does:**

- Auto-updates `git_tracking` section in requirement files
- Tracks: commit hash, timestamp, author, change count
- Re-stages files after updating

**When to disable:**

- Non-requirement work
- Importing external requirements

#### 3. Date Validation

```yaml
date_validation:
  enabled: true
  block_on_errors: true
  allow_bypass: true
```

**What it does:**

- Prevents hardcoded dates that don't match file modification dates
- Catches AI hallucinated timestamps

**Bypass:** `SC_SKIP_DATE_VALIDATION=true git commit`

**When to disable:**

- Historical documentation
- Date references are intentional

#### 4. Documentation Validation

```yaml
documentation_validation:
  enabled: true
  block_on_errors: true
  allow_bypass: true
```

**What it does:**

- Validates documentation structure
- Checks for duplicate filenames
- Validates file references
- Checks ID/filename consistency

**Bypass:** `SC_SKIP_DOC_VALIDATION=true git commit`

**When to disable:**

- Experimental documentation
- Large documentation imports

#### 5. Markdown Links

```yaml
markdown_links:
  enabled: true
  block_on_errors: true
  allow_bypass: true
  check_only_staged: true
```

**What it does:**

- Checks for broken relative links in markdown files
- Only checks staged files (fast)
- Suggests `sc docs links --fix` for auto-fixable issues

**Bypass:** `SC_SKIP_DOC_VALIDATION=true git commit`

**When to disable:**

- Working on archived documentation
- External link references

#### 6. Type Duplications

```yaml
type_duplications:
  enabled: false # Disabled by default
  block_on_errors: false
  allow_bypass: true
```

**What it does:**

- Detects duplicate TypeScript type definitions
- Can be slow on large codebases

**When to enable:**

- TypeScript projects
- Type safety is critical
- After refactoring

## Configuration Levels

### 1. Project-Wide Configuration (`supernal.yaml`)

Committed to repository, affects all developers:

```yaml
# supernal.yaml
git_hooks:
  enabled: true
  pre_commit:
    checks:
      branch_naming:
        enabled: true # Everyone must follow naming
      date_validation:
        enabled: true
        block_on_errors: true # Hard requirement
```

### 2. Personal Override (`.supernal/local-config.yaml`)

**Coming Soon** - Per-developer overrides (not committed):

```yaml
# .supernal/local-config.yaml (gitignored)
git_hooks:
  pre_commit:
    checks:
      type_duplications:
        enabled: true # I want this check locally
```

### 3. Per-Commit Bypass (Environment Variables)

Temporary override for single commit:

```bash
# Skip all hooks
SC_SKIP_HOOKS=true git commit -m "message"

# Skip specific checks
SC_SKIP_DATE_VALIDATION=true git commit -m "message"
SC_SKIP_DOC_VALIDATION=true git commit -m "message"
```

## Common Scenarios

### Scenario 1: New Team Member Setup

**Goal:** Get started quickly without being blocked

```yaml
git_hooks:
  pre_commit:
    checks:
      branch_naming:
        enabled: false # Learn conventions first
      requirement_metadata:
        enabled: true # Keep this, it's automatic
      date_validation:
        enabled: false # Might be confusing initially
      documentation_validation:
        enabled: true
        block_on_errors: false # Warn but don't block
      markdown_links:
        enabled: true
        block_on_errors: false # Warn but don't block
```

### Scenario 2: CI/CD Pipeline

**Goal:** Fast commits, validation in CI

```yaml
git_hooks:
  enabled: false # Validate in CI instead
```

Or use environment variable:

```bash
SC_SKIP_HOOKS=true git commit -m "CI: Automated update"
```

### Scenario 3: Documentation-Heavy Work

**Goal:** Focus on content, fix links later

```yaml
git_hooks:
  pre_commit:
    checks:
      documentation_validation:
        enabled: true
      markdown_links:
        enabled: true
        block_on_errors: false # Warn but allow commit
```

### Scenario 4: Production-Ready Project

**Goal:** Maximum quality gates

```yaml
git_hooks:
  pre_commit:
    checks:
      branch_naming:
        enabled: true
        skip_for_protected_branches: true
      requirement_metadata:
        enabled: true
      date_validation:
        enabled: true
        block_on_errors: true
      documentation_validation:
        enabled: true
        block_on_errors: true
      markdown_links:
        enabled: true
        block_on_errors: true
      type_duplications:
        enabled: true
        block_on_errors: true
```

## Environment Variables Reference

| Variable                       | Effect                 | Scope                            |
| ------------------------------ | ---------------------- | -------------------------------- |
| `SC_SKIP_HOOKS=true`           | Disable all hooks      | All checks                       |
| `SC_SKIP_DATE_VALIDATION=true` | Skip date validation   | Date validation only             |
| `SC_SKIP_DOC_VALIDATION=true`  | Skip doc & link checks | Documentation and markdown links |

## Commands

### Show Configuration

```bash
# Display current configuration
sc git-hooks show-config

# Show configuration from specific file
sc git-hooks show-config --file=./supernal.yaml
```

### Install Hooks with Configuration

```bash
# Install hooks (reads supernal.yaml)
sc git-hooks install

# Install with specific configuration
sc git-hooks install --config=./custom.yaml
```

### Validate Configuration

```bash
# Check if configuration is valid
sc git-hooks validate-config

# Test a specific check
sc git-hooks test-check branch_naming
```

## Troubleshooting

### "Hooks are disabled but still running"

Check for multiple hook files:

```bash
ls -la .git/hooks/pre-commit*
```

Remove backup copies:

```bash
rm .git/hooks/pre-commit.backup
rm .git/hooks/pre-commit.sample
```

### "Configuration not being read"

1. Check `supernal.yaml` exists:

```bash
cat supernal.yaml | grep -A 10 "git_hooks:"
```

2. Validate YAML syntax:

```bash
sc validate --config
```

3. Check hook script can read config:

```bash
node -e "
const HookConfigLoader = require('./supernal-code-package/lib/cli/commands/git-hooks/hook-config-loader.js');
const loader = new HookConfigLoader();
console.log(JSON.stringify(loader.loadConfig(), null, 2));
"
```

### "Check always blocks despite configuration"

The check might have a hard requirement. Check:

1. Is `allow_bypass: false` in config?
2. Is the environment variable set correctly?
3. Are there multiple validation points?

### "Configuration changes not taking effect"

1. Configuration is loaded on each commit
2. No cache to clear
3. But hook script itself must be up-to-date:

```bash
sc git-hooks install --force
```

## Best Practices

### For Project Maintainers

1. **Start permissive, tighten gradually:**

```yaml
# Week 1: Warnings only
documentation_validation:
  block_on_errors: false

# Week 2+: Enforce
documentation_validation:
  block_on_errors: true
```

2. **Document your choices:**

```yaml
git_hooks:
  pre_commit:
    checks:
      # We disable type checks because they're slow
      # and we run them in CI instead
      type_duplications:
        enabled: false
```

3. **Provide bypass instructions in README:**

```markdown
## Quick Commits

For rapid iteration:
\`\`\`bash
SC_SKIP_HOOKS=true git commit -m "WIP: Experimenting"
\`\`\`

For documentation work:
\`\`\`bash
SC_SKIP_DOC_VALIDATION=true git commit -m "docs: Draft"
\`\`\`
```

### For Developers

1. **Understand your project's configuration**

```bash
sc git-hooks show-config
```

2. **Don't bypass without reason**
   - Hooks catch real issues
   - Bypassing creates tech debt

3. **Fix issues properly**
   - `sc docs links --fix` for link issues
   - `sc date-validate --fix` for date issues
   - Don't just bypass

4. **Suggest configuration changes**
   - If a check is problematic, propose disabling it
   - Open PR to update `supernal.yaml`

### For CI/CD

```yaml
# .github/workflows/ci.yml
env:
  SC_SKIP_HOOKS: true # Hooks run locally, not in CI

jobs:
  validate:
    steps:
      - name: Run full validation
        run: |
          sc validate --docs
          sc docs links
          sc type-check
```

## Migration Guide

### From Old Hooks (No Configuration)

1. **Back up existing hooks:**

```bash
cp .git/hooks/pre-commit .git/hooks/pre-commit.old
```

2. **Create configuration:**

```yaml
# supernal.yaml - Add this section
git_hooks:
  enabled: true
  pre_commit:
    enabled: true
    checks:
      branch_naming: { enabled: true }
      requirement_metadata: { enabled: true }
      date_validation: { enabled: true, allow_bypass: true }
      documentation_validation: { enabled: true, allow_bypass: true }
      markdown_links: { enabled: true, allow_bypass: true }
```

3. **Reinstall hooks:**

```bash
sc git-hooks install
```

4. **Test:**

```bash
# Should use configuration
touch test.md
git add test.md
git commit -m "test: Configuration test"
```

### To Stricter Configuration

Enable checks one at a time:

```yaml
# Week 1
git_hooks:
  pre_commit:
    checks:
      markdown_links:
        enabled: true
        block_on_errors: false  # Warn only

# Week 2
      markdown_links:
        enabled: true
        block_on_errors: true   # Now enforce
```

## Related Documentation

- [Git Workflow](../workflow/sops/general/SOP-0.1.12-git-workflow.md)
- [Fixing Broken Links](./fixing-broken-links.md)
- [Git Hooks Installation](../README.md)
- [Pre-commit Hook Implementation](../../.git/hooks/pre-commit)

## Configuration Schema

See full schema: `supernal-code-package/lib/validation/schemas/git-hooks-config.schema.json`

Example with all options:

```yaml
git_hooks:
  # Global settings
  enabled: boolean # Master switch

  # Pre-commit hook
  pre_commit:
    enabled: boolean
    checks:
      # Branch naming
      branch_naming:
        enabled: boolean
        skip_for_protected_branches: boolean

      # Requirement metadata
      requirement_metadata:
        enabled: boolean
        update_git_tracking: boolean
        auto_stage_updates: boolean

      # Date validation
      date_validation:
        enabled: boolean
        block_on_errors: boolean
        allow_bypass: boolean

      # Documentation
      documentation_validation:
        enabled: boolean
        block_on_errors: boolean
        allow_bypass: boolean

      # Markdown links
      markdown_links:
        enabled: boolean
        block_on_errors: boolean
        allow_bypass: boolean
        check_only_staged: boolean

      # Type duplications
      type_duplications:
        enabled: boolean
        block_on_errors: boolean
        allow_bypass: boolean

  # Pre-push hook (future)
  pre_push:
    enabled: boolean
    checks:
      test_suite:
        enabled: boolean
        block_on_failures: boolean
      lint_check:
        enabled: boolean
        block_on_failures: boolean

  # Environment variable names
  bypass_variables:
    date_validation: string # Default: SC_SKIP_DATE_VALIDATION
    documentation_validation: string # Default: SC_SKIP_DOC_VALIDATION
    all_hooks: string # Default: SC_SKIP_HOOKS
```

---

**Last Updated:** 2025-11-29  
**Maintained by:** Supernal Coding Core Team  
**Feedback:** Open an issue or PR with configuration suggestions

