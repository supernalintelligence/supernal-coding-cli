# Supernal Coding Templates

This directory contains templates and foundational documents for Supernal Coding projects.

## Structure

### `/cursor/rules/`

Cursor IDE rules for AI agent guidance:

- `feature-management.mdc` - Feature lifecycle management rules

### `/docs/features/`

Feature management documentation:

- `FEATURE-SYSTEM-GUIDE.md` - **THE** authoritative guide for feature management

### `/features/`

Feature folder templates:

- Feature subdirectory templates (`design/`, `planning/`, `requirements/`, etc.)
- Subdirectory templates (`design/`, `planning/`, `requirements/`, etc.)
- `feature-readme-template.md` - Template for feature README files

### `/workflow/sops/`

Standard Operating Procedures for the complete workflow

### `/compliance/`

Compliance framework templates (HIPAA, GDPR, SOC2, etc.)

### `/buildme/`

Build and test script templates

### `/guides/`

User guides and CLI documentation

## Usage

### For New Projects

Templates are automatically installed via:

```bash
sc init
```

### For Feature Creation

The `sc feature create` command automatically uses templates from `/features/`:

```bash
sc feature create --id=my-feature --phase=drafting
```

### Manual Copy

To manually copy templates:

```bash
cp -r supernal-code-package/templates/features/design/ my-project/docs/features/{domain}/my-feature/
```

## Maintenance

### When to Update Templates

- New best practices emerge
- Feature system requirements change
- Compliance standards update
- CLI commands change

### How to Update

1. Edit templates in `supernal-code-package/templates/`
2. Test with `sc feature create`
3. Validate with `sc feature validate`
4. Commit changes
5. Projects using `sc init` will get updated templates

## Key Templates

| Template                                | Purpose                           | Used By             |
| --------------------------------------- | --------------------------------- | ------------------- |
| `docs/features/FEATURE-SYSTEM-GUIDE.md` | Complete feature management guide | All projects        |
| `cursor/rules/feature-management.mdc`   | AI agent guidance for features    | Cursor IDE          |
| `features/README.md`                    | Feature folder template           | `sc feature create` |
| `features/*/README.md`                  | Phase-specific guidance           | `sc feature create` |
| `compliance/frameworks/*/`              | Compliance requirements           | Compliance features |
| `workflow/sops/`                        | SOPs for development              | All projects        |

## See Also

- [Feature System Guide](docs/features/FEATURE-SYSTEM-GUIDE.md)
- [Feature Management Rule](cursor/rules/feature-management.mdc)
- [CLI Commands](../lib/cli/commands/)
