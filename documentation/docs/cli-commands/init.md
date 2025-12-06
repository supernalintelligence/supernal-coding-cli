# sc init

**Description:** Equip repository with Supernal Coding

## Usage

```bash
sc init [action] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--minimal` | Install minimal preset |
| `--standard` | Install standard preset (recommended) |
| `--full` | Install full preset |
| `--development` | Install development preset |
| `--interactive` | Interactive setup mode |
| `--dry-run` | Show what would be installed |
| `--overwrite` | Overwrite existing files |
| `--skip-upgrade-check` | Skip package upgrade check |
| `--merge` | Merge with existing installation |
| `--yes` | Skip confirmations |
| `--name <name>` | Project name |
| `--alias <alias>` | Command alias |
| `-t, --template <name>` | Template to use |
| `--force` | Force overwrite |
| `-v, --verbose` | Verbose output |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-12.02 | Post-Launch Operations & Support | 1 |
| SOP-3.04 | Security Analysis & Threat Modeling | 1 |

### Example Usages

```bash
sc init --security`):
sc init --security
```

## Implementation

- **File:** `./commands/setup/init`
- **Line:** 767

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*