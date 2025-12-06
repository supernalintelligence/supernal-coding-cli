# sc cli

**Description:** CLI introspection and workflow mapping

## Usage

```bash
sc cli [action] [options]
```

## Actions

| Action | Description |
|--------|-------------|
| `workflow-map` | Run `sc cli workflow-map --help` for details |
| `generate-docs` | Run `sc cli generate-docs --help` for details |

## Options

| Option | Description |
|--------|-------------|
| `--format <type>` | Output format (ascii, markdown, json) |
| `--output <path>` | Output file path |
| `-v, --verbose` | Verbose output |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-T.01 | Using sc CLI | 5 |

### Example Usages

```bash
sc cli` command provides introspection into the CLI itself:
sc cli workflow-map
sc cli workflow-map --format markdown
sc cli workflow-map --format json
sc cli workflow-map --format markdown --output docs/reference/CLI-COMMAND-TREE.md
```

## Implementation

- **File:** `../../../scripts/generate-cli-map`
- **Line:** 1256

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*