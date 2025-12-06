# sc rules

**Description:** Rule management

## Usage

```bash
sc rules [action] [options]
```

## Arguments

- `[args...]` - Action-specific arguments

## Options

| Option | Description |
|--------|-------------|
| `--force` | Force operation |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-T.01 | Using sc CLI | 1 |

### Example Usages

```bash
sc rules update path/to/rule.mdc
```

## Implementation

- **File:** `./commands/rules/rule-discovery`
- **Line:** 937

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*