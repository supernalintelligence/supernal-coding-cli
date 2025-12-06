---
feature_id: template-feature-id
title: Feature Title Here
domain: developer-tooling # WHERE: Organizational domain
phase: drafting # WHEN: Workflow state (backlog|drafting|implementing|testing|validating|complete)
epic: epic-name-here
priority: medium
status: active # WHAT: Work status (active|paused|blocked|complete|deprecated)
created: YYYY-MM-DD
updated: YYYY-MM-DD
assignee:
branch: main
---

# [Feature Title]

> **Status**: 📝 Drafting  
> **Phase**: Design & Planning  
> **Domain**: Developer Tooling

## Overview

Brief description of what this feature does and why it's needed.

## Problem Statement

What problem does this feature solve? What pain points does it address?

## Goals

- [ ] Goal 1
- [ ] Goal 2
- [ ] Goal 3

## Non-Goals

What is explicitly out of scope for this feature?

## Folder Structure

This feature follows the domain-based structure with phase-appropriate directories:

```
{domain}/{feature-name}/
├── README.md                 # This file (ALWAYS required)
├── design/                   # Required: drafting+
│   ├── architecture.md       # System design
│   ├── data-models.md        # Data structures
│   └── adrs/                 # Architecture Decision Records
├── planning/                 # Required: drafting+
│   ├── implementation-plan.md
│   └── roadmap.md
├── requirements/             # Required: drafting+
│   └── *.feature.md          # Gherkin specs
├── testing/                  # Required: implementing+
│   ├── test-plan.md
│   └── test-results/
├── validation/               # Required: validating+
│   └── checklist.md
├── stories/                  # Suggested
├── chats/                    # Suggested
└── archive/                  # Suggested
```

### Phase-Based Directory Requirements

**Current Phase: Drafting** ✓

Required directories for this phase:

- ✅ `design/` - Architecture and design documents
- ✅ `planning/` - Implementation plans
- ✅ `requirements/` - Feature requirements (Gherkin format)

Additional directories added in later phases:

- ⏱️ `testing/` - When moving to **implementing**
- ⏱️ `validation/` - When moving to **validating**

## Design Documents

See [`design/`](./design/) for:

- Architecture decisions (ADRs)
- System design
- Data models
- API specifications

## Planning

See [`planning/`](./planning/) for:

- Implementation plans
- Task breakdowns
- Technical specifications
- Integration strategies

## Requirements

See [`requirements/`](./requirements/) for feature-specific requirements in Gherkin format:

- `req-001-*.feature.md`
- `req-002-*.feature.md`
- etc.

## Stories

See [`stories/`](./stories/) for user stories and scenarios.

## Dependencies

### Blocked By

- [ ] dependency-1
- [ ] dependency-2

### Blocks

- [ ] feature-x
- [ ] feature-y

## Timeline

- **Created**: YYYY-MM-DD
- **Design Start**: TBD
- **Design Complete**: TBD
- **Implementation Target**: TBD

## Phase Transitions

### Current: Drafting → Next: Implementing

**Before moving to implementing:**

1. ✅ Complete design documents
2. ✅ Extract ADRs from planning docs
3. ✅ Write requirements in Gherkin format
4. ✅ Get design approval
5. ✅ Create `testing/` directory
6. ✅ Create feature branch

**Command:**

```bash
# Update phase in frontmatter to 'implementing'
# Create testing/ directory
mkdir testing
sc feature validate --id=[feature-id]

# Create feature branch
git checkout -b feature/[feature-name]
```

---

**Need help?** See [FEATURE-SYSTEM-GUIDE.md](../docs/features/FEATURE-SYSTEM-GUIDE.md)
