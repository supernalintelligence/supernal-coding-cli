# sc telemetry

**Description:** Manage telemetry and usage insights

## Usage

```bash
sc telemetry [action] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--commands <boolean>` | Enable/disable command telemetry |
| `--rules <boolean>` | Enable/disable rule telemetry |
| `--validation <boolean>` | Enable/disable validation telemetry |
| `--performance <boolean>` | Enable/disable performance telemetry |
| `--output <file>` | Output file for export |
| `-v, --verbose` | Verbose output |

## Implementation

- **File:** `./commands/telemetry/telemetry`
- **Line:** 1030

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*