---
title: "Phase System Explanation"
sidebar_label: "Phase System Explanation"
---

# Phase System Explanation

This document explains Supernal Coding's phase system and how it's used across different contexts.

## The Three Views of Phases

Supernal Coding uses three complementary views of workflow phases for different audiences:

### 1. Landing Page (8 High-Level Phases) - Marketing View

**Purpose:** Simple, visual introduction for new users

**Phases:**

1. **Discover** - See a problem or solution opportunity
2. **Analyze** - Learn and identify next priorities
3. **Research** - Gather context and understand the domain
4. **Plan** - Define requirements and priorities
5. **Model** - Design architecture, types, tests, and patterns
6. **Test and Complete** - Validate against requirements and priorities
7. **Deploy** - Ship to production with confidence
8. **Monitor** - Track performance and user behavior

**Where Used:**

- Landing page hero visualization
- Marketing materials
- Initial user onboarding

**Target Audience:** New visitors, potential users, quick overview

### 2. Dashboard (5 Phase Groups) - Tracking View

**Purpose:** Simplified tracking and visualization for day-to-day work

**Phase Groups:**

1. **Discovery** (Maps to phases 1-3) - Finding and defining the problem
2. **Foundation** (Maps to phases 4-5) - Planning and requirements
3. **Implementation** (Maps to phases 6-7) - Building and testing
4. **Integration** (Maps to phases 8-9) - Bringing features together
5. **Release** (Maps to phases 10-12) - Deploying and operating

**Where Used:**

- Dashboard requirement tracking
- TypeScript types (`src/lib/types.ts`)
- Simplified project views
- Quick status reporting

**Target Audience:** Daily development work, simple projects, quick status checks

### 3. SOPs (12 Detailed Phases) - Comprehensive View

**Purpose:** Comprehensive workflow guidance for complex projects

**Phases:**

1. **Discovery** - Business analysis and opportunity identification
2. **Research and Modeling** - User stories and domain modeling
3. **Design** - Architecture, compliance, and security design
4. **Planning** - Feature breakdown and task estimation
5. **Technical Requirements** - Detailed requirements and domain modeling
6. **Tests** - Test creation and validation
7. **Build** - Component implementation and testing
8. **Integration** - Feature integration and E2E testing
9. **Milestone** - Epic integration into milestones
10. **Staging** - Staging deployment and validation
11. **Production** - Production deployment
12. **Operations** - Ongoing monitoring and maintenance

**Where Used:**

- `SOP-0-overview-complete-workflow.md` - Master workflow documentation
- Phase-specific SOPs in `docs/workflow/sops/phase-X-*/`
- Comprehensive workflow planning

**Target Audience:** Teams needing detailed process guidance, regulated industries, enterprise projects

---

## Complete Phase Mapping

### Landing (8) → Dashboard (5) → SOPs (12)

| Landing Phase     | Dashboard Group    | SOP Phases                  | Description                         |
| ----------------- | ------------------ | --------------------------- | ----------------------------------- |
| Discover          | **Discovery**      | 1: Discovery                | Identify problems and opportunities |
| Analyze           | **Discovery**      | 1: Discovery                | Analyze and prioritize              |
| Research          | **Discovery**      | 2: Research and Modeling    | Domain research and user stories    |
| Plan              | **Foundation**     | 4: Planning                 | Feature breakdown and estimation    |
| Model             | **Foundation**     | 3: Design, 5: Requirements  | Architecture and detailed modeling  |
| Test and Complete | **Implementation** | 6: Tests, 7: Build          | Testing and implementation          |
| Deploy            | **Release**        | 10: Staging, 11: Production | Deployment to production            |
| Monitor           | **Release**        | 12: Operations              | Ongoing monitoring and maintenance  |

**Note:** SOP Phases 8 (Integration) and 9 (Milestone) are embedded within "Test and Complete" and "Deploy" on the landing page.

---

## When to Use Which View

### Use Landing Page View (8 Phases) When:

- Explaining Supernal Coding to new users
- Creating marketing materials
- High-level project overviews
- Initial discussions with stakeholders

### Use Dashboard View (5 Phase Groups) When:

- Tracking requirements in dashboard
- Creating simplified status reports
- Managing simple/MVP projects
- Quick filtering and visualization
- Daily standups and updates

### Use SOP View (12 Detailed Phases) When:

- Following comprehensive SOPs
- Working on regulated/compliance-heavy projects
- Need phase-specific guidance for current work
- Planning complex enterprise projects
- Creating phase transition documentation
- Conducting phase-gate reviews

---

## Examples

### Tagging a Requirement

**Dashboard Frontmatter (5-phase):**

```yaml
---
phase: foundation
status: in-progress
---
```

**SOP Reference (12-phase):**

```markdown
This requirement is currently in **Phase 5: Technical Requirements**
(Foundation phase group).

See: docs/workflow/sops/phase-5-requirements/SOP-5.01-technical-requirements-development.md
```

### Project Status Report

**Executive Summary (5-phase):**

> We've completed Discovery and are 60% through Foundation phase.

**Detailed Status (12-phase):**

> - Phase 1 (Discovery): ✅ Complete
> - Phase 2 (Research and Modeling): ✅ Complete
> - Phase 3 (Design): ✅ Complete
> - Phase 4 (Planning): ✅ Complete
> - Phase 5 (Technical Requirements): 🔄 60% complete

---

## Learning Path Integration

The dashboard's **Learn** view shows 11 learning blocks that cover:

- Introductory tutorials
- Cross-cutting AI workflow techniques (from SOP parts)
- Selected phase-specific deep dives

**Important:** The learning blocks are NOT a 1:1 mapping to phases. They're curated educational content that spans multiple phases and cross-cutting concerns.

---

## Configuration

### Dashboard Types

Requirements in the dashboard must use the 5-phase grouping:

```typescript
// apps/dashboard-v2/src/lib/types.ts
phase:
  | 'discovery'
  | 'foundation'
  | 'implementation'
  | 'integration'
  | 'release'
```

### SOP References

SOPs document the detailed 12-phase process and are organized by phase number:

```
docs/workflow/sops/
├── phase-1-discovery/
├── phase-2-research/
├── phase-3-design/
├── phase-4-planning/
├── phase-5-requirements/
├── phase-6-tests/
├── phase-7-build/
├── phase-8-integration/
├── phase-9-milestone/
├── phase-10-staging/
├── phase-11-production/
└── phase-12-operations/
```

---

## FAQ

**Q: Why three different phase systems?**

A: Each serves a different audience and purpose:

- **Landing page (8)**: Simple introduction for new users
- **Dashboard (5)**: Simplified tracking for daily work
- **SOPs (12)**: Comprehensive guidance for complex projects

Think of it like maps at different zoom levels - same territory, different levels of detail.

**Q: Which phase system should I use in my requirement frontmatter?**

A: Use the 5-phase grouping (`phase: discovery|foundation|implementation|integration|release`). You can reference specific SOPs for detailed guidance.

**Q: Can I use detailed phase numbers in my requirements?**

A: Currently, the dashboard types only support the 5 high-level phases. You can add custom fields if you need to track detailed phases:

```yaml
---
phase: foundation
detailedPhase: 5
sopReference: 'docs/workflow/sops/phase-5-requirements/SOP-5.01'
---
```

**Q: Will this change in the future?**

A: The Renaissance v3 initiative includes work toward configurable phase systems. This would allow projects to define custom phase structures while maintaining backward compatibility.

---

## Related Documentation

- [SOP-0: Complete Workflow Overview](../workflow/sops/SOP-0-overview-complete-workflow.md) - Master 12-phase documentation
- [SOP-0.1: AI-Accelerated Workflow](../workflow/sops/SOP-0.1-ai-accelerated-workflow-overview.md) - Cross-cutting AI techniques

---

**Last Updated:** 2025-11-25  
**Maintained by:** Supernal Coding Documentation Team  
**Feedback:** File issues or discuss in team channels
