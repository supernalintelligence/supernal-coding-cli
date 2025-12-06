---
_naming_pattern: ^ADR-\d{3}-.+\.md$
_template_origin: templates/docs/architecture/decision.template.md
_consistency_note: 'ADR files must be numbered sequentially (e.g., ADR-001-technology-choice.md)'
type: decision
title: Decision Title
decision_id: ADR-NNN
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: proposed
author: Team Name
reviewedBy: []
reviewDates: []
supersedes: null
superseded_by: null
related_docs: []
related_requirements: []
tags: []
---

# ADR-NNN: [Decision Title]

**Status**: Proposed  
**Date**: YYYY-MM-DD  
**Supersedes**: -  
**Superseded_by**: -

## Context

Describe the situation, problem, and forces at play. What factors led to needing this decision?

Include:

- Business context
- Technical constraints
- Stakeholder requirements
- Current limitations or problems

## Decision

State the architectural decision clearly and concisely. This should be unambiguous.

We will [decision statement].

## Rationale

Explain why this decision was made. What factors were most important?

1. **Factor 1**: Explanation
2. **Factor 2**: Explanation
3. **Factor 3**: Explanation

## Consequences

### Positive

- **Benefit 1**: Description of positive impact
- **Benefit 2**: Description of positive impact
- **Benefit 3**: Description of positive impact

### Negative

- **Drawback 1**: Description of trade-off or limitation
- **Drawback 2**: Description of trade-off or limitation
- **Mitigation**: How we'll address the negatives

## Alternatives Considered

### Option 1: [Alternative Name] (Rejected)

**Approach**: Brief description

**Pros**:

- Pro 1
- Pro 2

**Cons**:

- Con 1
- Con 2

**Why rejected**: Explanation

### Option 2: [Alternative Name] (Rejected)

**Approach**: Brief description

**Pros**:

- Pro 1
- Pro 2

**Cons**:

- Con 1
- Con 2

**Why rejected**: Explanation

## Implementation Details

Specific implementation notes, if applicable:

- Key implementation steps
- Configuration details
- Migration considerations
- Rollout strategy

## Related Documents

- **Architecture**: [System Overview] (see project documentation)
- **Requirements**: [REQ-XXX] (see project documentation)
- **Components**: [Component Name] (see project documentation)

## Authors

- [Author Name/Team]

---

**Note**: If this ADR supersedes another, update the superseded ADR's status and add a note at the top pointing to this ADR.

**Status Values**:

- **Proposed**: Under discussion
- **Accepted**: Approved and active
- **Deprecated**: No longer relevant
- **Superseded**: Replaced by newer ADR
