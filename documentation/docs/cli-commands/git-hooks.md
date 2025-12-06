# sc git-hooks

**Description:** Manage git hooks

## Usage

```bash
sc git-hooks [action] [options]
```

## Arguments

- `[hook]` - Hook name for specific actions

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-T.01 | Using sc CLI | 5 |
| SOP-0.1.07 | AI Implementation Safeguards | 1 |
| SOP-6.01 | Testing Strategy | 1 |
| N/A | docs/workflow/sops/archived/2025-11-22-SOP-0.1.7-quality-automation-large.md | 1 |
| N/A | docs/workflow/sops/archived/2025-11-22-SOP-0.1-ai-accelerated-workflow-monolithic.md | 1 |

### Example Usages

```bash
sc git-hooks install
sc git-hooks status
sc git-hooks pre-commit
sc git-hooks pre-push
sc git-hooks safety
```

## Implementation

- **File:** `./commands/git/git-hooks`
- **Line:** 813

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*