# Feature Organization

Features are organized by **functional domain** using a hierarchical structure that mirrors natural complexity management.

See [STRUCTURE-PHILOSOPHY.md](STRUCTURE-PHILOSOPHY.md) for the complete philosophy behind this organization.

## Directory Structure

```
docs/features/
├── admin-operations/         # Admin & operations features
├── ai-workflow-system/       # AI automation & workflows
├── compliance-framework/     # Compliance & regulatory
├── content-management/       # Content & social media
├── dashboard-platform/       # Dashboard UI & integrations
├── developer-tooling/        # CLI, docs, dev tools
├── integrations/             # External service connections
├── workflow-management/      # Workflow & state tracking
└── archived/                 # Historical reference
```

## Organization Principle

**Level 1: Domain** (What area of the system?)  
**Level 2: Feature** (What specific capability?)  
**Level 3: Component** (What concrete implementation?) - _only if needed_

### Example

```
ai-workflow-system/              # DOMAIN
├── agent-orchestration/         # FEATURE
├── project-detection/           # FEATURE
└── self-improvement/            # FEATURE
    ├── planning/                # Component
    └── design/                  # Component
```

## Quick Start

### 1. Choose Your Domain

Identify which Level 1 domain your feature belongs to:

- `ai-workflow-system/` - AI agents, automation, generation
- `developer-tooling/` - CLI tools, validation, dev utilities
- `compliance-framework/` - Compliance, auditing, regulatory
- `dashboard-platform/` - UI, visualization, dashboards
- `workflow-management/` - State tracking, configuration
- `content-management/` - Social media, content tools
- `integrations/` - External service connections
- `admin-operations/` - Admin features, operations

### 2. Create Feature Directory

```bash
# Level 2: Create your feature under the appropriate domain
mkdir -p docs/features/{domain}/{feature-name}

# Example
mkdir -p docs/features/ai-workflow-system/code-generation
```

### 3. Create Feature Structure

```bash
cd docs/features/{domain}/{feature-name}

# Create standard subdirectories
mkdir -p design planning requirements testing
```

Typical feature structure:

```
feature-name/
├── README.md           # Feature overview
├── design/             # ADRs, architecture docs
├── planning/           # Implementation plans, roadmaps
├── requirements/       # Gherkin specs (optional)
└── testing/            # Test plans, results (when testing)
```

## Feature Contents

### What Goes in Each Directory

**design/**

- Architecture Decision Records (ADRs)
- System architecture diagrams
- Technical design documents
- Component specifications

**planning/**

- Implementation roadmaps
- Phase plans
- Resource allocation
- Migration strategies

**requirements/** (optional)

- Gherkin-style requirements
- Acceptance criteria
- Test scenarios

**testing/**

- Test plans
- Test results
- Coverage reports
- Validation checklists

## Naming Conventions

See [NAMING-CONVENTIONS.md](NAMING-CONVENTIONS.md) for complete guidelines.

### Key Rules

- **Domains**: 2-3 words, descriptive, kebab-case
  - `ai-workflow-system`, `developer-tooling`, `compliance-framework`
- **Features**: 1-2 words, specific, kebab-case
  - `agent-orchestration`, `code-generation`, `self-improvement`
- **Avoid**:
  - Generic names: `system/`, `tools/`, `utils/`
  - Single words: `auth/`, `data/`, `users/`
  - Phase names: `drafting/`, `implementing/`, `testing/`

## Complexity Management

### When to Add Level 3

Only add a Level 3 (component) when a feature is **genuinely complex** enough to warrant breakdown:

```
❌ TOO DEEP
ai-workflow-system/
└── core/
    └── orchestration/
        └── agents/              # 4 levels!

✅ PROPER
ai-workflow-system/
├── agent-orchestration/         # Feature stays at Level 2
└── context-management/          # Separate feature if complex enough
```

### Refactoring Trigger

If you need Level 4+, refactor by making siblings instead of nesting deeper.

## Working with Features

### Creating a New Feature

1. **Identify Domain**: Choose appropriate Level 1 domain
2. **Name Feature**: Use 1-2 descriptive words in kebab-case
3. **Create Structure**: Make feature directory with subdirectories
4. **Add README**: Document purpose, epic linkage, requirements
5. **Link to Epic**: Reference in `docs/planning/epics/epic-*.md`

### Linking to Requirements

Features implement requirements from `docs/requirements/`:

```markdown
## Related Requirements

- REQ-WORKFLOW-096: Project Self-Healing System
- REQ-INFRA-085: Self-Updating Rule Engine
```

### Dashboard Integration

The dashboard automatically discovers features by scanning `docs/features/`:

- Displays domain hierarchy
- Shows feature status
- Links to design docs
- Tracks implementation progress

## Best Practices

### ✅ DO

- **Organize by function**, not phase
- **Use 2-3 levels max** (domain → feature → component)
- **Keep features focused** (3-7 features per domain)
- **Name descriptively** (avoid generic terms)
- **Link to epics** and requirements
- **Document decisions** in ADRs

### ❌ DON'T

- **Don't organize by phase** (`drafting/`, `implementing/`)
- **Don't nest too deep** (4+ levels indicates refactor needed)
- **Don't use generic names** (`tools/`, `utils/`, `system/`)
- **Don't duplicate** (check if feature exists elsewhere first)
- **Don't skip README** (every feature needs context)

## Git Integration

### Feature Branches

```bash
# Create branch named after domain/feature
git checkout -b feature/ai-workflow-system/code-generation
```

### Commits

Reference features and requirements:

```bash
git commit -m "feat(code-generation): Add template system

- Implement template parser
- Add validation
- REQ-WORKFLOW-097: Learning from corrections
"
```

## Related Documentation

- [STRUCTURE-PHILOSOPHY.md](STRUCTURE-PHILOSOPHY.md) - Why this structure works
- [NAMING-CONVENTIONS.md](NAMING-CONVENTIONS.md) - Complete naming guide
- [FEATURE-SYSTEM-GUIDE.md](FEATURE-SYSTEM-GUIDE.md) - Detailed feature management

---

**Last Updated**: 2025-11-28  
**Maintained By**: Supernal Coding Core Team
