# Feature System Guide

> **THE** authoritative guide for creating, documenting, and validating features in Supernal Coding

**Last Updated**: 2025-11-28  
**Status**: Living Document  
**Validation**: `sc feature validate`

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Domain-Based Organization](#domain-based-organization)
3. [Required Structure](#required-structure)
4. [Frontmatter Standards](#frontmatter-standards)
5. [Validation & Quality](#validation--quality)
6. [Git Integration](#git-integration)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Creating a New Feature

```bash
# 1. Create feature in appropriate domain
sc feature create --id=code-generation --domain=ai-workflow-system --epic=automation --priority=high

# 2. Edit README.md to add details
vim docs/features/ai-workflow-system/code-generation/README.md

# 3. Validate
sc feature validate --id=code-generation

# 4. Commit
git add docs/features/ai-workflow-system/code-generation
git commit -m "feat(ai-workflow-system): Add code-generation feature"
```

### Command Options

```bash
sc feature create \
  --id=my-feature           # Required: Feature ID (kebab-case)
  --domain=developer-tooling # Required: Target domain
  --title="My Feature"      # Optional: Human title (defaults to id)
  --epic=my-epic            # Optional: Epic name
  --priority=high           # Optional: high|medium|low (default: medium)
  --assignee=username       # Optional: GitHub username
  --minimal                 # Optional: Create README only (no subdirs)
```

---

## Domain-Based Organization

### Hierarchy Principle

```
Level 1: DOMAIN    (What area of the system?)
Level 2: FEATURE   (What specific capability?)
Level 3: COMPONENT (What concrete implementation?) - only if needed
```

### Available Domains

```
docs/features/
├── ai-workflow-system/       # AI automation, agents, generation
├── developer-tooling/        # CLI tools, validation, dev utilities
├── compliance-framework/     # Compliance, auditing, regulatory
├── dashboard-platform/       # UI, visualization, dashboards
├── workflow-management/      # State tracking, configuration, planning
├── content-management/       # Social media, content tools
├── integrations/             # External service connections
├── admin-operations/         # Admin features, operations
└── archived/                 # Historical reference
```

### Choosing the Right Domain

**Questions to ask:**

1. **What part of the system?** → Choose domain
2. **What specific capability?** → Create feature
3. **Does feature need breakdown?** → Only if truly complex

**Examples:**

- `ai-workflow-system/code-generation/` - AI generates code
- `developer-tooling/type-checker/` - Dev tool for checking types
- `compliance-framework/gdpr-controls/` - GDPR compliance features
- `dashboard-platform/architecture-viewer/` - Visualizes architecture

---

## Required Structure

### Minimal Feature

```
{domain}/{feature-name}/
└── README.md (with frontmatter)
```

### Full Feature Structure

```
{domain}/{feature-name}/
├── README.md                          # Single entry point (REQUIRED)
├── design/
│   ├── architecture-diagrams.md
│   ├── data-models.md
│   └── adrs/
│       ├── adr-component-001-title.md
│       └── adr-api-001-title.md
├── planning/
│   ├── implementation-plan.md
│   ├── roadmap.md
│   └── integration-plan.md
├── requirements/                      # Optional: Gherkin specs
│   ├── req-001-user-story.md
│   └── req-002-technical-spec.md
└── testing/                           # When implementing/testing
    ├── test-plan.md
    ├── test-results/
    │   └── YYYY-MM-DD-results.md
    └── coverage/
        └── summary.md
```

### Complex Features (Level 3)

Only when feature is genuinely complex:

```
{domain}/{parent-feature}/{sub-feature}/
├── README.md
├── design/
└── planning/
```

**Avoid** if feature can be kept at Level 2.

---

## Frontmatter Standards

### Required Fields

```yaml
---
feature_id: 'my-feature-name' # MUST match folder name
title: 'Human Readable Title'
domain: 'ai-workflow-system' # Domain folder
epic: 'epic-name' # Link to epic
priority: 'high' # high|medium|low
status: 'active' # active|blocked|paused|complete|deprecated
assignee: 'github-username' # Without @ prefix (optional)
created: '2025-11-28' # YYYY-MM-DD
updated: '2025-11-28' # YYYY-MM-DD
branch: 'main' # Git branch tracking this
---
```

### Optional Fields

```yaml
tags: ['dashboard', 'ui', 'feature-management']
dependencies: ['other-feature-id']
blocking: ['dependent-feature-id']
estimated_effort: '2 weeks'
target_release: 'v2.1.0'
parent: 'parent-feature-name' # If Level 3 component
```

### Validation Rules

1. **`feature_id`** MUST match folder name exactly
2. **`domain`** should match parent domain folder
3. **`updated`** should be updated when content changes
4. **`branch`** should match current git branch when in active development

---

## Validation & Quality

### Automated Validation

**Pre-commit Hook:**

```bash
# Automatically runs on git commit
sc feature validate --quiet
```

**Manual Validation:**

```bash
# Validate specific feature
sc feature validate --id=my-feature

# Validate all features
sc feature validate --all
```

### Validation Checks

1. **Structure**:
   - README.md exists
   - Valid frontmatter present
   - No duplicate feature IDs

2. **Frontmatter**:
   - All required fields present
   - `feature_id` matches folder name
   - `domain` is valid (if specified)
   - Dates in YYYY-MM-DD format

3. **Content**:
   - README.md has content beyond frontmatter
   - Proper naming conventions followed

### Auto-Fix

```bash
# Fix simple issues automatically
sc feature validate --id=my-feature --fix

# What auto-fix handles:
# - Adds missing required fields
# - Updates 'updated' date to today
# - Fixes feature_id to match folder name
# - Creates suggested directories
```

---

## Git Integration

### Branch Naming

```bash
# Pattern: feature/{feature-name} or feature/{domain}/{feature-name}
git checkout -b feature/code-generation
git checkout -b feature/ai-workflow/code-generation
```

### Commit Messages

```bash
# Feature commits with domain context
git commit -m "feat(ai-workflow-system): Add code generation

- Implement template parser
- Add validation logic
- REQ-042: Template validation
"

# Moving features between domains
git commit -m "refactor: Move feature to correct domain"

# Requirement-traceable commits
git commit -m "REQ-088: Implement self-update system"
```

### Pre-Commit Hook

**Automatic checks:**

- Runs `sc feature validate --quiet` on modified features
- Blocks commit if validation fails
- Provides fix suggestions

**Bypass (use sparingly):**

```bash
git commit --no-verify -m "WIP: Save progress"
```

---

## Common Patterns

### Pattern 1: Solo Feature Development

```bash
# 1. Create in appropriate domain
sc feature create --id=my-feature --domain=developer-tooling --epic=tools

# 2. Design & plan
# ... edit docs in design/ and planning/

# 3. Create feature branch
git checkout -b feature/my-feature

# 4. Implement
# ... code and test

# 5. Validate and merge
sc feature validate --id=my-feature
git checkout main
git merge feature/my-feature --no-ff
git push origin main
```

### Pattern 2: Moving Feature to Different Domain

```bash
# Realized feature belongs in different domain
sc feature move my-feature new-domain

# Or manually with git mv
git mv docs/features/old-domain/my-feature docs/features/new-domain/my-feature

# Update frontmatter domain field
vim docs/features/new-domain/my-feature/README.md

# Validate
sc feature validate --id=my-feature
```

### Pattern 3: Complex Feature with Sub-Features

```bash
# Create parent feature
sc feature create --id=llm-routing --domain=ai-workflow-system

# Create sub-features (Level 3)
mkdir -p docs/features/ai-workflow-system/llm-routing/model-selection
mkdir -p docs/features/ai-workflow-system/llm-routing/cost-optimization

# Each sub-feature gets its own README
# ... create READMEs with parent: 'llm-routing' in frontmatter
```

### Pattern 4: Extract ADRs from Planning Docs

**When:** Feature has significant design decisions documented

**Process:**

1. Review `planning/` docs for major decisions
2. Extract each significant decision into ADR
3. Create `design/adrs/adr-{category}-{num}-{title}.md`
4. Update planning docs to reference ADRs
5. Keep planning docs for workflow, ADRs for decisions

**Example:**

```bash
# Original: planning/api-design.md (large doc with multiple decisions)
# Extract: design/adrs/adr-api-001-rest-vs-graphql.md
#          design/adrs/adr-api-002-authentication-strategy.md
```

---

## Troubleshooting

### Validation Fails: "feature_id mismatch"

**Problem:** `feature_id` doesn't match folder name

**Fix:**

```bash
sc feature validate --id=my-feature --fix
```

### Feature in Wrong Domain

**Problem:** Created in wrong domain

**Fix:**

```bash
sc feature move my-feature correct-domain
```

### Missing Directories

**Problem:** Suggested directories missing

**Fix:**

```bash
cd docs/features/{domain}/{feature}
mkdir -p design planning requirements testing
sc feature validate --id={feature}
```

### Duplicate Feature IDs

**Problem:** Multiple features with same ID

**Fix:**

Rename one:

```bash
cd docs/features/domain/duplicate-name
# Rename folder
mv ../duplicate-name ../duplicate-name-v2
# Update feature_id in README.md
```

---

## Cleanup & Archiving

### Archiving Completed Features

```bash
# After feature is complete and stable
git mv docs/features/{domain}/{feature} docs/features/archived/{feature}

# Or keep in domain and update status
# status: 'complete'
```

### Cleaning Up Invalid Features

```bash
# Audit all features
sc feature validate --all > audit.txt

# Auto-fix simple issues
sc feature validate --all --fix

# Move obsolete features to archive
git mv docs/features/{domain}/obsolete docs/features/archived/
```

---

## Related Documentation

- **Structure Philosophy**: [STRUCTURE-PHILOSOPHY.md] (see project documentation)
- **Naming Conventions**: [NAMING-CONVENTIONS.md] (see project documentation)
- **Epic System**: [docs/planning/epics/] (see docs/planning/epics/)
- **Requirements**: [docs/requirements/] (see project documentation)

---

**Questions or improvements?** Update this document and commit:

```bash
git commit -m "docs: Update feature system guide"
```
