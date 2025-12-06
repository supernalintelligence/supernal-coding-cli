# sc feature

**Description:** Manage features in the feature-by-phase system

## Usage

```bash
sc feature [action] [options]
```

## Actions

| Action | Description |
|--------|-------------|
| `create` | Run `sc feature create --help` for details |
| `validate` | Run `sc feature validate --help` for details |
| `move` | Run `sc feature move --help` for details |
| `sync` | Run `sc feature sync --help` for details |

## Arguments

- `[feature-id]` - Feature identifier (for validate, move, etc)

## Options

| Option | Description |
|--------|-------------|
| `--fix` | Automatically fix validation errors (validate action) |
| `--quiet` | Minimal output for git hooks (validate action) |
| `--all` | Apply to all features (validate action) |
| `--phase <phase>` | Target phase (for move/create action) |
| `--id <id>` | Feature ID (for create action) |
| `--domain <domain>` | Domain name (for create action with sync) |
| `--title <title>` | Human-readable title (for create action) |
| `--epic <epic>` | Epic name (for create action) |
| `--priority <priority>` | Priority level (for create action) |
| `--assignee <assignee>` | GitHub username (for create action) |
| `--minimal` | Create minimal structure (for create action) |
| `--dry-run` | Show what would be done (for sync action) |
| `-v, --verbose` | Verbose output |

## Related SOPs

| SOP | Title | Usages |
|-----|-------|--------|
| SOP-T.06 | Feature Development with Branch Integration | 5 |

### Example Usages

```bash
sc feature approve feature-user-dashboard \
sc feature branch-create feature-user-dashboard
sc feature move feature-user-dashboard --phase=implementing
sc feature move feature-user-dashboard --phase=testing
sc feature move feature-user-dashboard --phase=validating
```

## Implementation

- **File:** `../feature/FeatureDocumentSync`
- **Line:** 210

---

*This documentation is auto-generated from CLI source code. Run `sc cli generate-docs` to update.*