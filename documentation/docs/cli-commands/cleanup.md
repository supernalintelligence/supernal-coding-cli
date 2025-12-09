---
title: cleanup
description: Repository structure and documentation cleanup
sidebar_position: 5
---

# sc cleanup

Repository structure and documentation cleanup with staging queue support.

## Synopsis

```bash
sc cleanup [action] [options]
```

## Description

The `cleanup` command scans your repository for organizational issues and can automatically fix them or stage files for manual review. It checks:

- **Root violations**: Markdown files in the repo root that should be organized
- **Folder issues**: Problematic folder naming patterns (temp_, old_, backup_)
- **Naming violations**: Files not following naming conventions
- **Broken links**: Internal markdown links that don't resolve
- **Orphaned files**: Documents not referenced anywhere
- **Missing directories**: Required directories that don't exist

## Actions

| Action | Description |
|----|---|
| `docs` | Run documentation cleanup only |
| `folders` | Run folder structure cleanup only |
| `status` | Show cleanup queue status |
| `process-queue` | Process staged items interactively |

If no action is specified, runs all checks (docs + folders).

## Options

### Fix Options

| Option | Description |
|----|---|
| `--auto-fix` | Automatically fix issues (moves files, creates directories) |
| `--auto-stage` | Move problematic files to cleanup-queue for review |
| `--interactive` | Review each change interactively (coming soon) |
| `--dry-run` | Show what would be done without making changes |

### Check Options

| Option | Description |
|----|----|
| `--skip-docs` | Skip documentation structure checks |
| `--skip-structure` | Skip directory structure validation |
| `--validate-naming` | Enable file naming validation |
| `--check-links` | Check for broken markdown links |
| `--find-orphans` | Find orphaned files with no references |
| `--all` | Enable all checks |

### Output Options

| Option | Description |
|----|---|
| `-v, --verbose` | Verbose output |

## Examples

### Basic Usage

```bash
# Run all cleanup checks
sc cleanup

# Preview changes without making them
sc cleanup --dry-run

# Run only documentation checks
sc cleanup docs

# Run only folder structure checks
sc cleanup folders
```

### Fixing Issues

```bash
# Automatically fix issues (moves files to correct locations)
sc cleanup --auto-fix

# Stage uncertain files for manual review
sc cleanup --auto-stage

# Then check the queue
sc cleanup status

# Process queued items
sc cleanup process-queue
```

### Comprehensive Checks

```bash
# Run all checks including slow ones
sc cleanup --all

# Check for broken links specifically
sc cleanup --check-links

# Find orphaned files
sc cleanup --find-orphans

# Validate file naming conventions
sc cleanup --validate-naming
```

## Output

### Issue Report

```
🔍 Scanning repository...

📊 Cleanup Report

❌ Files in wrong location:
  /DEPLOYMENT.md → archive/legacy-root-docs/DEPLOYMENT.md
  /SC_DESIGN.md → docs/architecture/sc-design

⚠️  Folders needing attention:
  temp_backup → cleanup-queue/to-process
     Reason: Matches pattern /^temp_/

⚠️  Missing directories:
  docs/adr
  docs/planning/startup

Summary:
  2 root violations
  1 folder issues
  0 naming violations
  2 missing directories
  0 broken links
  0 orphaned files

Options:
  --auto-fix      : Apply fixes automatically
  --auto-stage    : Move problematic files to cleanup-queue
  --interactive   : Review each change
```

### Queue Status

```bash
$ sc cleanup status

📋 Cleanup Queue Status

Total items: 3
  Staged (awaiting review): 2
  Processed: 1

Staged items:
  /DEPLOYMENT.md
    → Suggested: archive/legacy-root-docs/DEPLOYMENT.md
  /OLD_PLAN.md
    → Suggested: archive/legacy-root-docs/OLD_PLAN.md

Run "sc cleanup process-queue" to review and process
```

## Configuration

The cleanup system reads configuration from `supernal.yaml`:

```yaml
documentation:
  cleanup_queue_dir: cleanup-queue
  cleanup_subdirs:
    to_process: cleanup-queue/to-process
    auto_staged: cleanup-queue/auto-staged
    manifest: cleanup-queue/manifest.json
  root_whitelist:
    - README.md
    - CHANGELOG.md
    - CONTRIBUTING.md
    - SECURITY.md
    - LICENSE
```

### Pre-commit Integration

```yaml
git_hooks:
  pre_commit:
    checks:
      repo_cleanup:
        enabled: true
        block_on_errors: false  # Warn only
        allow_bypass: true
        mode: docs
```

### Bypass

```bash
# Skip cleanup check for a single commit
SC_SKIP_CLEANUP_CHECK=true git commit -m "message"
```

## Cleanup Queue

The staging queue allows problematic files to be reviewed before final placement.

### Queue Structure

```
cleanup-queue/
├── to-process/     # Files awaiting manual review
├── auto-staged/    # Files staged by --auto-stage
└── manifest.json   # Metadata tracking all items
```

### Workflow

1. Run `sc cleanup --auto-stage` to stage uncertain files
2. Review files in `cleanup-queue/to-process/`
3. Move files to their proper locations
4. Remove entries from `manifest.json`

## Related Commands

- [`sc docs validate`](./docs.md) - Validate documentation structure
- [`sc docs cleanup`](./docs.md) - Documentation-specific cleanup (same as `sc cleanup docs`)
- [`sc wip`](./wip.md) - Work-in-progress file tracking
- [`sc git-smart cleanup-branches`](./git-smart.md) - Clean up merged git branches

## Exit Codes

| Code | Meaning |
|----|---|
| 0 | No issues found or fixes applied successfully |
| 1 | Issues found (when not using --auto-fix) |

## See Also

- [Repository Cleanup Feature](../../features/developer-tooling/repo-cleanup/README.md)
- [cleanup-queue/README.md](../../cleanup-queue/README.md)
- [supernal.yaml Configuration](../../reference/configuration.md)

