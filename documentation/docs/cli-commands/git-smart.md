# sc git-smart

**Description:** Git workflow automation

## Usage

```bash
sc git-smart [action] [options]
```

## Arguments

- `[identifier]` - Branch ID or other action-specific argument

## Options

| Option | Description |
|--------|-------------|
| `--branch <id>` | Branch identifier (for branch action) |
| `--push` | Auto-push after merge |
| `--delete-local` | Delete local branch after merge |
| `--tag <version>` | Tag version for deploy |
| `--skip-tests` | Skip tests for deploy |
| `--skip-lint` | Skip linting for deploy |
| `--no-push-tags` | Don |
| `-q, --quiet` | Quiet mode |
| `-v, --verbose` | Verbose mode |

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
| N/A | docs/workflow/sops/archived/summaries/IMPROVEMENTS-2024-11-22.md | 1 |
| N/A | docs/workflow/sops/archived/summaries/FINAL-REORGANIZATION-2024-11-22.md | 1 |
| N/A | docs/workflow/sops/archived/summaries/REORGANIZATION-2024-11-22.md | 1 |
| N/A | docs/workflow/sops/archived/2025-11-22-SOP-0.1.7-quality-automation-large.md | 5 |
| N/A | docs/workflow/sops/archived/2025-11-22-SOP-0.1-ai-accelerated-workflow-monolithic.md | 5 |

### Example Usages

```bash
sc git-smart deploy --environment=production-green --tag=v1.2.0
sc git-smart deploy --environment=production --strategy=canary --percentage=5
sc git-smart deploy --environment=production --strategy=rolling
sc git-smart deploy --environment=production --rollback
sc git-smart check-context
```

## Implementation

- **File:** `./commands/git/git-smart`
- **Line:** 379

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*