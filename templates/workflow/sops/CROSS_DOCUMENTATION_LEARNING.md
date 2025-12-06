# Supernal Coding Cross-Documentation Learning Plan

## What Loopora Does Better

### 1. **Clean Index Files**

Loopora has simple, scannable index files for each document type:

- **SAD.md**: Simple table of contents with links
- **ADR.md**: Index of all decisions
- **ADD.md**: Index of design documents
- **SOP.md**: Comprehensive process index with quick navigation table

### 2. **README.md Structure**

Loopora's designs/README.md provides:

- Clear "What it is" for each document type
- Location and file listings
- "Getting Started" paths for different roles
- Explicit navigation strategy

### 3. **Document Type Clarity**

Clear document type definitions:

- **SAD** = System-wide architecture (what/why)
- **ADD** = Component-level design (how)
- **ADR** = Decision records (context/options/consequences)
- **SOP** = Process documentation (workflow/procedures)

## What Supernal Can Adopt

### Improvements Needed for Supernal docs/workflow/sops/

#### Current Issues:

1. **No index files** for SOPs at root level (only README in sops/)
2. **README is verbose** - good 3-tier structure but hard to scan quickly
3. **Missing quick navigation table** like Loopora's SOP.md
4. **No separate indexes** for different document types

#### Proposed Structure:

```
docs/workflow/sops/
├── README.md                          # Current file (keep 3-tier explanation)
├── INDEX.md                           # NEW: Quick navigation (Loopora-style)
├── SOP-0-overview-complete-workflow.md
├── SOP-0.1-ai-accelerated-workflow-overview.md
├── parts/                             # 16 modular parts
│   ├── INDEX.md                       # NEW: Parts quick reference
│   ├── SOP-0.1.01-foundation.md
│   └── ...
├── phase-0-discovery/
│   ├── INDEX.md                       # NEW: Phase 0 index
│   ├── SOP-0.01-business-vision-and-problem.md
│   └── SOP-0.02-solution-technology-analysis.md
├── phase-1-inception/                 # Future
├── phase-2-requirements/              # Future
└── tools/
    ├── INDEX.md                       # NEW: Tools index
    └── SOP-T.01-using-sc-cli.md
```

### NEW: docs/workflow/sops/INDEX.md (Loopora-inspired)

**File**: `docs/workflow/sops/INDEX.md`

```markdown
# Supernal Coding SOPs - Quick Index

## Quick Navigation

| SOP                                                    | Title                       | Audience             | Read Time |
| ------------------------------------------------------ | --------------------------- | -------------------- | --------- |
| [SOP-0](SOP-0-overview-complete-workflow.md)           | Complete Workflow Overview  | All team members     | 30 min    |
| [SOP-0.1](SOP-0.1-ai-accelerated-workflow-overview.md) | AI-Accelerated Workflow Hub | Developers, AI users | 15 min    |

## Parts (Modular SOPs)

### Group A: AI Foundations

| Part                                             | Title                | Purpose                   | Read Time |
| ------------------------------------------------ | -------------------- | ------------------------- | --------- |
| [01](./general/SOP-0.1.01-foundation.md)         | Foundation           | AI collaboration basics   | 20 min    |
| [02](./general/SOP-0.1.02-chat-management.md)    | Chat Management      | Managing AI conversations | 15 min    |
| [03](./general/SOP-0.1.03-prompting-patterns.md) | Prompting Patterns   | Effective prompts         | 25 min    |
| [04](./general/SOP-0.1.04-validation-quality.md) | Validation & Quality | Quality control           | 20 min    |

### Group B: Development Workflow

| Part                                                       | Title                       | Purpose                  | Read Time |
| ---------------------------------------------------------- | --------------------------- | ------------------------ | --------- |
| [05](./general/SOP-0.1.05-requirements-planning.md)        | Requirements & Planning     | Discovery & requirements | 30 min    |
| [06](./general/SOP-0.1.06-design-architecture.md)          | Design & Architecture       | Architecture decisions   | 30 min    |
| [07](./general/SOP-0.1.07-ai-implementation-safeguards.md) | Implementation Safeguards   | Safe AI coding           | 25 min    |
| [08](parts/SOP-0.1.08-testing-strategy.md)                 | Testing Strategy            | Test planning            | 25 min    |
| [09](parts/SOP-0.1.09-e2e-testing.md)                      | End-to-End Testing          | E2E test implementation  | 20 min    |
| [10](./general/SOP-0.1.10-documentation.md)                | Documentation Standards     | Documentation practices  | 20 min    |
| [11](./general/SOP-0.1.11-decision-tracking.md)            | Decision Tracking           | ADR management           | 15 min    |
| [12](./general/SOP-0.1.12-git-workflow.md)                 | Git Workflow & Code Review  | Version control          | 25 min    |
| [13](./general/SOP-0.1.13-change-control.md)               | Change Control & Deployment | Release management       | 30 min    |
| [14](./general/SOP-0.1.14-evaluation-learning.md)          | Evaluation & Learning       | Continuous improvement   | 20 min    |

### Group C: Reference & Standards

| Part                                                 | Title                       | Purpose                   | Read Time |
| ---------------------------------------------------- | --------------------------- | ------------------------- | --------- |
| [15](./general/SOP-0.1.15-naming-conventions.md)     | Naming Conventions ⭐       | Artifact naming standards | 15 min    |
| [16](./general/SOP-0.1.16-roles-responsibilities.md) | Roles & Responsibilities ⭐ | Team structure            | 15 min    |

## Phase-Specific SOPs

### Phase 0: Discovery

| SOP                                                                    | Title                          | Purpose                                   | Status      |
| ---------------------------------------------------------------------- | ------------------------------ | ----------------------------------------- | ----------- |
| [SOP-0.01](phase-0-discovery/SOP-0.01-business-vision-and-problem.md)  | Business Vision & Problem      | Business intelligence, problem definition | ✅ Complete |
| [SOP-0.02](phase-0-discovery/SOP-0.02-solution-technology-analysis.md) | Solution & Technology Analysis | Competitive analysis, tech evaluation     | ✅ Complete |

### Phase 1-6: Future Phases

⏳ To be created

## Tool-Specific SOPs

| SOP                                        | Title          | Purpose         | Status      |
| ------------------------------------------ | -------------- | --------------- | ----------- |
| [SOP-T.01](tools/SOP-T.01-using-sc-cli.md) | Using `sc` CLI | CLI usage guide | ✅ Complete |

---

## Getting Started

### New Team Members

1. [SOP-0](SOP-0-overview-complete-workflow.md) - Big picture (30 min)
2. [SOP-0.1](SOP-0.1-ai-accelerated-workflow-overview.md) - AI workflow (15 min)
3. [Parts 01-04](parts/) - AI foundations (80 min)

### Starting a Feature

1. [Part 05](./general/SOP-0.1.05-requirements-planning.md) - Requirements
2. [SOP-0.01](phase-0-discovery/SOP-0.01-business-vision-and-problem.md) - Detailed discovery
3. [Parts 06-14](parts/) - Continue through workflow

### Quick Reference

- **Naming?** → [Part 15](./general/SOP-0.1.15-naming-conventions.md)
- **Who owns this?** → [Part 16](./general/SOP-0.1.16-roles-responsibilities.md)
- **CLI help?** → [SOP-T.01](tools/SOP-T.01-using-sc-cli.md)

---

## Document Organization

For full structure explanation, see [README.md](README.md)

**Total**: 2 main SOPs + 16 parts + 2 phase SOPs + 1 tool SOP = 21 documents

---

**Last Updated**: 2024-11-22
**Status**: ✅ Complete structure, ready for use
```

### NEW: docs/workflow/sops/parts/INDEX.md

**File**: `docs/workflow/sops/parts/INDEX.md`

```markdown
# SOP Parts - Quick Reference

## Overview

This directory contains 16 modular SOP parts organized into 3 groups.

## Quick Access

| Part                                                       | Title                       | Group             | Tags                               |
| ---------------------------------------------------------- | --------------------------- | ----------------- | ---------------------------------- |
| [01](./general/SOP-0.1.01-foundation.md)                   | Foundation                  | A: AI Foundations | #ai #basics #principles            |
| [02](./general/SOP-0.1.02-chat-management.md)              | Chat Management             | A: AI Foundations | #ai #communication #context        |
| [03](./general/SOP-0.1.03-prompting-patterns.md)           | Prompting Patterns          | A: AI Foundations | #ai #prompts #techniques           |
| [04](./general/SOP-0.1.04-validation-quality.md)           | Validation & Quality        | A: AI Foundations | #ai #quality #validation           |
| [05](./general/SOP-0.1.05-requirements-planning.md)        | Requirements & Planning     | B: Workflow       | #requirements #discovery #planning |
| [06](./general/SOP-0.1.06-design-architecture.md)          | Design & Architecture       | B: Workflow       | #architecture #design #adr         |
| [07](./general/SOP-0.1.07-ai-implementation-safeguards.md) | Implementation Safeguards   | B: Workflow       | #ai #coding #safety                |
| [08](SOP-0.1.08-testing-strategy.md)                       | Testing Strategy            | B: Workflow       | #testing #strategy #bdd            |
| [09](SOP-0.1.09-e2e-testing.md)                            | E2E Testing                 | B: Workflow       | #testing #e2e #playwright          |
| [10](./general/SOP-0.1.10-documentation.md)                | Documentation Standards     | B: Workflow       | #docs #standards #practices        |
| [11](./general/SOP-0.1.11-decision-tracking.md)            | Decision Tracking           | B: Workflow       | #adr #decisions #rationale         |
| [12](./general/SOP-0.1.12-git-workflow.md)                 | Git Workflow & Code Review  | B: Workflow       | #git #review #version-control      |
| [13](./general/SOP-0.1.13-change-control.md)               | Change Control & Deployment | B: Workflow       | #deployment #releases #changes     |
| [14](./general/SOP-0.1.14-evaluation-learning.md)          | Evaluation & Learning       | B: Workflow       | #learning #improvement #feedback   |
| [15](./general/SOP-0.1.15-naming-conventions.md)           | Naming Conventions ⭐       | C: Reference      | #naming #standards #conventions    |
| [16](./general/SOP-0.1.16-roles-responsibilities.md)       | Roles & Responsibilities ⭐ | C: Reference      | #roles #team #responsibilities     |

## By Group

### Group A: AI Foundations (Parts 01-04)

Cross-cutting AI collaboration practices applicable to all phases.

### Group B: Development Workflow (Parts 05-14)

Time-series progression through development phases.

### Group C: Reference & Standards (Parts 15-16)

Quick reference guides for naming and roles.

---

**Parent**: [../INDEX.md](../INDEX.md)
**Last Updated**: 2024-11-22
```

### Improved docs/README.md Section for SOPs

**File**: `docs/README.md` (add new section)

```markdown
## 📋 Standard Operating Procedures (SOPs)

**What they are**: Process documentation defining workflows, practices, and procedures for development. SOPs ensure consistency, quality, and effective human-AI collaboration.

**Location**: [`workflow/sops/`](./README.md)

**Quick Access**:

- [**SOP Index**](workflow/sops/INDEX.md) - Quick navigation table
- [**SOP Overview**](./SOP-0-overview-complete-workflow.md) - Complete 12-phase workflow
- [**AI Workflow Hub**](./SOP-0.1-ai-accelerated-workflow-overview.md) - AI-accelerated development

**Structure**:

- **2 Main SOPs** - High-level overviews and navigation
- **16 Parts** - Modular SOPs (AI foundations, workflow, reference)
- **7 Phase-Specific SOPs** - Deep-dive procedures per phase (2 complete, 5 planned)
- **1 Tool SOP** - sc CLI usage guide

**Getting Started**:

1. **New users**: Start with [SOP Overview](./SOP-0-overview-complete-workflow.md) (30 min)
2. **AI developers**: Read [AI Workflow Hub](./SOP-0.1-ai-accelerated-workflow-overview.md) (15 min)
3. **Quick reference**: Use [SOP Index](workflow/sops/INDEX.md) for navigation
```

---

## Implementation Actions

### Step 1: Create Index Files

```bash
# Create the new index files for Supernal
cd /Users/ianderrington/git/supernal-nova/families/supernal-coding/docs/workflow/sops/

# Use sc docs process to implement
sc docs process /path/to/this/plan.md
```

### Step 2: Update Main docs/README.md

Add the improved SOP section with clear navigation.

### Step 3: Add to Loopora's Cleanup Plan

Add note about adopting Loopora's index pattern for Supernal's own docs.

---

## Benefits

### For Supernal

1. **Easier navigation** - Quick index tables like Loopora
2. **Role-based paths** - Clear getting started guides
3. **Scannable structure** - Tables vs prose
4. **Better discoverability** - Multiple entry points

### For Loopora

1. **Use proven SC patterns** - 3-tier SOP structure
2. **Adopt modular approach** - Break SOPs into parts if they grow
3. **Learn from SC tooling** - CLI-driven workflow management

### For Both

1. **Consistent patterns** - Similar documentation approaches
2. **Cross-learning** - Best practices flow both ways
3. **Better onboarding** - New users find what they need faster

---

## Next Steps

1. ✅ Document what to learn from each other
2. ⏳ Create Supernal SOP index files
3. ⏳ Update Supernal docs/README.md
4. ⏳ Add to Loopora cleanup plan
5. ⏳ Consider if Loopora should adopt SC's modular SOP approach as their documents grow
