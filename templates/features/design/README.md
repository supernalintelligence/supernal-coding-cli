# Design Documents

This directory contains architecture decisions, system design, and technical specifications for this feature.

## Structure

- **ADRs** (Architectural Decision Records): Small, focused decisions
- **Architecture**: System design, component diagrams
- **Data Models**: Schema, types, interfaces
- **API Specs**: Endpoints, contracts

## ADR Naming Convention

```
adr-{category}-{num}-{short-title}.md
```

**Categories**:

- `naming` - Naming conventions, identifiers
- `architecture` - System structure, patterns
- `integration` - External system integration
- `cli` - Command-line interface design
- `ui` - User interface design
- `storage` - Data persistence, databases
- `validation` - Validation rules, checks
- `workflow` - Process, lifecycle
- `testing` - Testing strategy
- `deployment` - Deploy, infrastructure

**Examples**:

- `adr-naming-001-feature-id-format.md`
- `adr-architecture-001-validation-module.md`
- `adr-cli-001-command-structure.md`

## ADR Template

```markdown
---
category:
  [
    naming|architecture|integration|cli|ui|storage|validation|workflow|testing|deployment,
  ]
status: [proposed|accepted|deprecated|superseded]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# ADR-{category}-{num}: [Title]

## Context

What is the issue we're addressing? What constraints exist?

## Decision

What did we decide to do and why?

## Consequences

What are the positive and negative outcomes of this decision?

## Alternatives Considered

What other options did we consider and why did we reject them?
```

## When to Create ADRs

Create ADRs when moving from **drafting** to **implementing** if you have:

- Large planning documents with multiple decisions
- Complex architecture requiring traceability
- Design choices that affect multiple components
- Decisions that future developers need to understand

**AI Assistance**: When moving to `implementing`, AI agents will suggest extracting ADRs from large planning documents.

## See Also

- [ADR Evolution Strategy](../../../../docs/features/dashboard-platform/feature-by-phase-view/design/adr-evolution-strategy.md) (if exists)
- [Architecture Philosophy](../../../../docs/features/dashboard-platform/feature-by-phase-view/design/architecture-philosophy.md) (if exists)
