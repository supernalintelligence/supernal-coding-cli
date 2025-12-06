# sc requirement

**Alias:** `req`

**Description:** Manage requirements

## Usage

```bash
sc requirement [action] [options]
```

## Arguments

- `[args...]` - Action-specific arguments (ID, title, etc)

## Options

| Option | Description |
|--------|-------------|
| `--priority <level>` | Priority: critical|high|medium|low |
| `--status <status>` | Status for update action |
| `--force` | Force operation (for delete) |
| `-f, --format <type>` | Output format (json, table, csv) |
| `-v, --verbose` | Verbose output |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-0.1.18 | Feature Documentation Structure & Organization | 4 |
| SOP-0.1.17 | Documentation Requirements & Templates | 3 |
| SOP-5.01 | Technical Requirements Development | 4 |
| SOP-3.03 | Compliance Requirements Management | 1 |

### Example Usages

```bash
sc requirement` Command
sc requirement new "Traceability Matrix" \
sc requirement new "WIP Tracking" \
sc requirement new`
sc requirement new` command
```

## Implementation

- **File:** `./commands/requirement`
- **Line:** 136

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*