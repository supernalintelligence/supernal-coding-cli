# sc test

**Description:** Run test guidance and mapping

## Usage

```bash
sc test [action] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-g, --guidance` | Show test guidance |
| `-m, --map` | Show test mapping |
| `--watch` | Watch mode |
| `--coverage` | Generate coverage |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-T.01 | Using sc CLI | 4 |

### Example Usages

```bash
sc test requirement REQ-XXX
sc test coverage REQ-XXX
sc test if configured
sc test [command]
```

## Implementation

- **File:** `./commands/testing/test-command`
- **Line:** 884

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*