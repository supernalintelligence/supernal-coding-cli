# sc traceability

**Alias:** `trace`

**Description:** Traceability matrix for compliance and requirement tracking

## Usage

```bash
sc traceability [action] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-f, --format <type>` | Output format (json, html, csv) |
| `-o, --output <path>` | Output file or directory |
| `-v, --verbose` | Verbose output |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-0.1.18 | Feature Documentation Structure & Organization | 1 |
| SOP-3.03 | Compliance Requirements Management | 1 |

### Example Usages

```bash
sc traceability generate"
sc traceability compliance COMP-HIPAA-001`
```

## Implementation

- **File:** `./commands/traceability`
- **Line:** 1137

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*