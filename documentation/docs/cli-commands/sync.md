# sc sync

**Description:** Synchronize with upstream repository or global installation

## Usage

```bash
sc sync [action] [options]
```

## Arguments

- `[action]` - Action: check, pull, preview

## Options

| Option | Description |
|--------|-------------|
| `--upstream <url>` | Override upstream repository URL |
| `--rebase` | Use rebase strategy instead of merge |
| `--auto` | Auto-merge non-conflicting changes |
| `-v, --verbose` | Verbose output |

## Implementation

- **File:** `./commands/sync/repo-sync`
- **Line:** 1063

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*