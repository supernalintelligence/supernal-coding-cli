# sc docs

**Description:** Documentation management

## Usage

```bash
sc docs [action] [options]
```

## Arguments

- `[args...]` - Action-specific arguments

## Options

| Option | Description |
|--------|-------------|
| `--structure` | Run structure validation only |
| `--template` | Run template validation only |
| `--all` | Run all validations |
| `--fix` | Automatically fix issues |
| `--auto-fix` | Automatically fix documentation issues |
| `--interactive` | Review changes interactively |
| `--dry-run` | Show what would be done |
| `--full-report` | Write full link report to file |
| `--file <path>` | Check specific file |
| `--format <type>` | Output format (ascii, markdown, json) |
| `--output <path>` | Output file path |
| `-v, --verbose` | Verbose output |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-T.01 | Using sc CLI | 4 |
| SOP-0.1.18 | Feature Documentation Structure & Organization | 1 |
| SOP-0.1.10 | Documentation Standards | 5 |
| SOP-0.1.12 | Git Workflow & Code Review | 5 |
| SOP-0.1.13 | Change Control & Deployment | 4 |

### Example Usages

```bash
sc docs validate path/to/doc.md
sc docs generate --milestone=q1-2025
sc docs [command]
sc docs validate
sc docs validate --fix-refs
```

## Implementation

- **File:** `./commands/docs/docs`
- **Line:** 907

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*