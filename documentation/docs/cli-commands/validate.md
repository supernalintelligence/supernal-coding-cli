# sc validate

**Description:** Validate current installation

## Usage

```bash
sc validate [action] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Show detailed validation information |
| `--requirements` | Validate requirements files |
| `--docs` | Validate documentation files |
| `--tests` | Validate test files |
| `--config` | Validate configuration |
| `--all` | Validate everything |
| `--fix` | Automatically fix validation errors where possible |
| `--dry-run` | Preview fixes without applying them (use with --fix) |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-0.1.18 | Feature Documentation Structure & Organization | 3 |
| SOP-0.1.17 | Documentation Requirements & Templates | 1 |
| SOP-3.03 | Compliance Requirements Management | 1 |

### Example Usages

```bash
sc validate --feature workflow-management/wip-registry
sc validate --cross-cutting-refs
sc validate --test-links
sc validate --docs
sc validate --compliance
```

## Implementation

- **File:** `./commands/validate`
- **Line:** 179

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*