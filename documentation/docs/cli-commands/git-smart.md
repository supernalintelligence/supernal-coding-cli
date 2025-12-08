# sc git-smart

**Description:** Intelligent Git workflow automation with sub-repository management, safe merging, and CI/CD monitoring.

## Usage

```bash
sc git-smart [action] [options]
```

## Actions

### Core Commands

| Command | Description |
|---------|-------------|
| `status` | Show comprehensive Git & CI/CD status with feedback |
| `branch <REQ-XXX>` | Create feature branch for requirement |
| `merge [branch]` | Safe merge with rebase and validation |
| `push` | Smart push with automatic CI/CD monitoring |
| `deploy` | Comprehensive deployment with tests and tagging |
| `feedback [suggest]` | Intelligent suggestions based on current state |

### Branch Management

| Command | Description |
|---------|-------------|
| `check-branch` | Validate branch compliance (no main/master) |
| `check-context` | Check if current work matches branch |
| `list-branches` | Show status of all branches |
| `cleanup-branches` | Clean up merged branches (push first, then delete) |
| `suggest` | Get branch naming suggestions |

### Sub-Repository Management

| Command | Description |
|---------|-------------|
| `subrepos` | Show status of all nested git repositories |
| `sync-push` | Sync and push all sub-repositories before parent push |

### CI/CD Monitoring

| Command | Description |
|---------|-------------|
| `monitor [branch]` | Watch CI/CD pipelines after push |
| `monitor --status` | Quick status check |
| `monitor --diagnose` | Diagnose workflow failures |

## Options

### Merge Options

| Option | Description |
|--------|-------------|
| `--push`, `--auto-push` | Push to remote after successful merge |
| `--delete-local` | Force delete local branch after merge |
| `--preserve-local` | Force preserve local branch after merge |
| `--skip-monitoring` | Skip automatic CI/CD monitoring |
| `--quiet` | Minimize output during merge process |

### Deployment Options

| Option | Description |
|--------|-------------|
| `--tag=X.Y.Z` | Use specific version (auto-increment if not provided) |
| `--skip-tests` | Skip test validation |
| `--skip-lint` | Skip code linting |
| `--no-push-tags` | Create tag locally but don't push to remote |

### Cleanup Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Show what would be cleaned without doing it |
| `--no-push` | Skip pushing branches to remote before deletion |

### Sync-Push Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Show what would be synced without doing it |
| `--commit` | Auto-commit uncommitted changes before push |
| `--push-parent` | Also push the parent repo after sub-repos |
| `--quiet` | Minimize output |

## Sub-Repository Sync Feature

When working with monorepos containing nested git repositories (like `supernal-code-package`, `supernal-dashboard`), `sync-push` ensures all sub-repos are pushed before the parent.

### Pre-Push Hook Integration

The pre-push hook automatically blocks pushes if sub-repositories have:
- Unpushed commits
- Uncommitted changes

**Bypass options:**
```bash
git push --no-verify              # Skip all checks
SC_SKIP_SUBREPO_CHECK=true git push  # Skip only sub-repo check
```

### Workflow Example

```bash
# Check sub-repo status
sc git-smart subrepos

# Sync all sub-repos
sc git-smart sync-push

# Sync and also push parent
sc git-smart sync-push --push-parent

# Preview what would be synced
sc git-smart sync-push --dry-run

# Auto-commit uncommitted changes in sub-repos
sc git-smart sync-push --commit
```

## Smart Branch Cleanup

After merge, local branches are cleaned up intelligently:

- **REQ-XXX branches**: Always deleted (temporary requirement work)
- **Regular branches**: Preserved if unmerged commits or no remote backup
- Use `--delete-local` or `--preserve-local` to override smart decisions

## Examples

### Basic Workflow

```bash
# Check current status
sc git-smart status

# Create feature branch
sc git-smart branch REQ-024

# Check work context matches branch
sc git-smart check-context

# Safe merge with auto-push
sc git-smart merge --push --delete-local
```

### Sub-Repository Management

```bash
# View all nested repo status
sc git-smart subrepos

# Sync all before pushing parent
sc git-smart sync-push --push-parent
```

### Deployment

```bash
# Full deployment with auto-version
sc git-smart deploy

# Specific version
sc git-smart deploy --tag=v2.1.0

# Skip tests for hotfix
sc git-smart deploy --skip-tests
```

### Branch Cleanup

```bash
# Preview cleanup
sc git-smart cleanup-branches --dry-run

# Clean up merged branches
sc git-smart cleanup-branches
```

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-11.01 | Production Deployment | 4 |
| SOP-T.01 | Using sc CLI | 5 |
| SOP-T.07 | Multi-Feature Branch Workflow | 3 |
| SOP-10.01 | Staging Deployment & Validation | 2 |
| SOP-0.1.12 | Git Workflow & Code Review | 5 |
| SOP-8.01 | Feature Integration & Testing | 3 |
| SOP-0.1 | AI-Accelerated Workflow | 3 |

## Implementation

- **File:** `lib/cli/commands/git/git-smart.js`
- **Pre-push Hook:** `lib/cli/commands/git/hooks/pre-push.sh`

---

*Last Updated: December 2025*