# sc fbc

**Description:** Manage feature registry for feature-based commits

## Usage

```bash
sc fbc [action] [options]
```

## Actions

| Action | Description |
|--------|-------------|
| `add` | Run `sc fbc add --help` for details |
| `list` | Run `sc fbc list --help` for details |
| `show` | Run `sc fbc show --help` for details |
| `commits` | Run `sc fbc commits --help` for details |
| `complete` | Run `sc fbc complete --help` for details |
| `remove` | Run `sc fbc remove --help` for details |
| `stats` | Run `sc fbc stats --help` for details |
| `validate-commit` | Run `sc fbc validate-commit --help` for details |

## Options

| Option | Description |
|--------|-------------|
| `--description <text>` | Feature description |
| `--requirements <ids>` | Comma-separated requirement IDs |
| `--owner <email>` | Feature owner email |
| `--status <status>` | Filter by status (for list action) |
| `--limit <number>` | Limit number of commits (for commits action) |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-T.07 | Multi-Feature Branch Workflow | 5 |

### Example Usages

```bash
sc fbc add payment-types \
sc fbc add payment-api \
sc fbc add payment-ui \
sc fbc add payment-tests \
sc fbc commits payment-api
```

## Implementation

- **File:** `../feature/FeatureManager`
- **Line:** 619

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*