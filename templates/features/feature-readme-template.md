---
feature_id: template-feature-id
title: Feature Title Here
phase: drafting
epic: epic-name-here
priority: medium
created: YYYY-MM-DD
updated: YYYY-MM-DD
assignee:
branch: main
---

# [Feature Title]

> **Status**: 📝 Drafting  
> **Phase**: Design & Planning

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

This feature follows the standard structure:

```
feature-name/
├── README.md                 # This file
├── design/                   # Design documents, ADRs, architecture
├── planning/                 # Implementation plans, specifications
├── requirements/             # Feature-specific requirements (Gherkin)
├── stories/                  # User stories
├── chats/                    # Cursor chat exports
├── testing/                  # Test plans and results (added in later phases)
├── validation/               # Validation checklists (added in later phases)
└── archive/                  # Deprecated/old documents
```

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

- `req-001-*.md`
- `req-002-*.md`
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

## Next Steps

1. Complete design documents
2. Extract ADRs from planning docs
3. Write requirements
4. Get approval
5. Update frontmatter: `phase: implementing`

---

**Phase Transition**: When design is complete and approved:

```bash
sc feature move [feature-id] implementing
```
