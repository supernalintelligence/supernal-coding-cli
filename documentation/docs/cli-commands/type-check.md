# sc type-check

**Description:** Detect and prevent TypeScript/JavaScript type duplications

## Usage

```bash
sc type-check [action] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--pre-commit` | Pre-commit check (fails if duplications found) |
| `--show-ignored` | Show ignored auto-generated types |
| `--show-legitimate` | Show legitimate duplications only |
| `--add-ignore <type>` | Get command to add type to ignore list |
| `--add-legitimate <type>` | Add type to legitimate duplications |
| `--init-config` | Create .duplication-lint.json config file |
| `--update <types>` | Update specific types (comma-separated) |
| `--update-types <types>` | Update multiple types (comma-separated) |
| `--force` | Force operation |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-6.01 | Testing Strategy | 5 |
| N/A | docs/workflow/sops/archived/summaries/REORGANIZATION-2024-11-22.md | 2 |

### Example Usages

```bash
sc type-check`
sc type-check
sc type-check src/features/auth
sc type-check --watch
sc type-check --declaration
```

## Implementation

- **File:** `./commands/type-check`
- **Line:** 857

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*