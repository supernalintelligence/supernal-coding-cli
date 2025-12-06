# sc dashboard

**Description:** Dashboard management for requirements visualization

## Usage

```bash
sc dashboard [action] [options]
```

## Arguments

- `[args...]` - Action-specific arguments

## Options

| Option | Description |
|--------|-------------|
| `--github-pages` | Deploy to GitHub Pages |
| `--vercel` | Deploy to Vercel |
| `--kill-conflicts` | Kill processes on conflicting ports |
| `--force` | Force overwrite existing dashboard |
| `--upgrade` | Upgrade existing dashboard |
| `--dry-run` | Preview changes without applying |
| `-y, --yes` | Skip confirmation prompts |
| `-v, --verbose` | Verbose output |

## Implementation

- **File:** `./commands/dashboard`
- **Line:** 1173

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*