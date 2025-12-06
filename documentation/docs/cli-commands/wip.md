# sc wip

**Alias:** `w`

**Description:** Manage work-in-progress files via WIP registry

## Usage

```bash
sc wip [action] [options]
```

## Actions

| Action | Description |
|--------|-------------|
| `register` | Run `sc wip register --help` for details |
| `unregister` | Run `sc wip unregister --help` for details |
| `list` | Run `sc wip list --help` for details |
| `status` | Run `sc wip status --help` for details |
| `touch` | Run `sc wip touch --help` for details |
| `cleanup` | Run `sc wip cleanup --help` for details |
| `check` | Run `sc wip check --help` for details |
| `stats` | Run `sc wip stats --help` for details |
| `reassign` | Run `sc wip reassign --help` for details |

## Options

| Option | Description |
|--------|-------------|
| `--feature <name>` | Feature name |
| `--requirement <id>` | Requirement ID (e.g., REQ-042) |
| `--reason <text>` | Reason for WIP tracking |
| `--notes <text>` | Additional notes |
| `--add-comment` | Add WIP comment to file |
| `--no-auto-cleanup` | Disable auto-cleanup |
| `--older-than <days>` | Filter files older than N days |
| `--paths-only` | Output paths only |
| `--me` | Show only files registered by current user |
| `--unassigned` | Show only unassigned files |
| `--to <userid>` | Reassign file to this user |
| `--dry-run` | Show what would be done |
| `--force` | Skip confirmation prompts |
| `--quiet` | Suppress output |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-T.07 | Multi-Feature Branch Workflow | 2 |
| SOP-0.1.18 | Feature Documentation Structure & Organization | 1 |

### Example Usages

```bash
sc wip list
sc wip register <file> --feature=<feature-name> --requirement=REQ-XXX
sc wip register src/auth.ts --feature=auth"
```

## Implementation

- **File:** `../wip/WipManager`
- **Line:** 408

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*