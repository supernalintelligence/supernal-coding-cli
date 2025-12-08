# Feature Naming Conventions

## Pattern

Features should follow descriptive naming patterns that answer:

- **What**: What is being built?
- **Who**: Who is it for?
- **Where**: What part of the system?

## Recommended Patterns

### Pattern 1: `{entity}-{action}-{method}`

Best for user-facing features or specific implementations.

**Examples**:

- `user-authentication-gpg` (not just "auth-component")
- `user-session-management` (not just "session-component")
- `admin-dashboard-analytics` (not just "dashboard")
- `document-processing-ai` (not just "docs-processor")

### Pattern 2: `{domain}-{standard}-{purpose}`

Best for compliance or framework features.

**Examples**:

- `compliance-gdpr-framework` (not just "compliance")
- `security-oauth-integration` (not just "oauth")
- `data-privacy-controls` (not just "privacy")

### Pattern 3: `{component}-{entity}-{action}`

Best for technical/architectural features.

**Examples**:

- `dashboard-feature-viewer` (not just "feature-viewer")
- `api-requirement-validator` (not just "validator")
- `cli-feature-manager` (not just "feature-tools")

### Pattern 4: `{platform}-{integration}-{service}`

Best for integrations and external services.

**Examples**:

- `github-action-deployer` (not just "deploy-action")
- `linkedin-content-poster` (not just "linkedin-posting")
- `slack-notification-bot` (not just "notifications")

## Anti-Patterns

❌ **Too Generic**:

- `workflow-tracking` → What workflow? For who?
- `feature-validation` → What kind of features?
- `auth-component` → What auth? For what?

✅ **Better**:

- `user-workflow-tracking` or `ai-workflow-tracker`
- `feature-structure-validator` or `docs-feature-validator`
- `user-gpg-authentication` or `admin-oauth-login`

❌ **Too Vague**:

- `enhancement` → Enhancement of what?
- `improvements` → To what?
- `tools` → What tools?

✅ **Better**:

- `feature-validation-enhancement`
- `dashboard-performance-improvements`
- `cli-requirement-tools`

❌ **Technology in Name** (unless it's the key differentiator):

- `react-dashboard` → Just `supernal-dashboard`
- `nodejs-api` → Just `api-server`

✅ **When Technology Matters**:

- `user-auth-gpg` ✓ (GPG is the key feature)
- `ai-llm-router` ✓ (LLM routing is specific)

## Hierarchy Rules

### Level 1: Broad Domain/System (2 words)

**Pattern**: `{domain}-{type}`

The top level should indicate a broad functional area or system.

**Examples**:

- `user-management/` - All user-related features
- `compliance-framework/` - Compliance and regulatory features
- `ai-workflow-system/` - AI and workflow automation
- `dashboard-platform/` - Dashboard and UI features
- `data-pipeline/` - Data processing and ETL
- `api-gateway/` - API and integration features

**Not**:

- ❌ `users/` - Too generic
- ❌ `workflows/` - Workflow for what?
- ❌ `tools/` - What tools?

### Level 2: Specific Feature/Component (2-3 words)

**Pattern**: `{method/adjective}-{entity}`

Sub-features should describe the specific implementation or capability.

**Examples**:

- `user-management/gpg-authentication/` ✅
- `user-management/session-management/` ✅
- `compliance-framework/gdpr-controls/` ✅
- `compliance-framework/audit-logging/` ✅
- `ai-workflow-system/agent-orchestration/` ✅
- `ai-workflow-system/task-scheduling/` ✅
- `dashboard-platform/analytics-viewer/` ✅

**Not**:

- ❌ `user-management/auth/` - What kind of auth?
- ❌ `compliance-framework/component-1/` - Meaningless
- ❌ `ai-workflow-system/core/` - Too vague

### Level 3: Atomic Implementation (Optional, 2 words max)

**Pattern**: `{specific}-{implementation}`

Only go 3 levels deep if the feature is truly complex and needs breakdown.

**Examples**:

- `user-management/gpg-authentication/key-rotation/` ✅
- `compliance-framework/gdpr-controls/consent-tracking/` ✅
- `ai-workflow-system/agent-orchestration/llm-routing/` ✅

**Rule**: If you need level 4+, your feature is probably too complex. Split into separate level-2 features instead.

### Managing Complexity

**Keep it 1-2 levels for most features**:

```
compliance-framework/
├── gdpr-controls/           # Usually enough!
├── audit-logging/
└── security-scanning/
```

**Only go to level 3 if truly needed**:

```
ai-workflow-system/
└── agent-orchestration/
    ├── llm-routing/         # Complex enough to warrant breakdown
    ├── context-management/
    └── response-synthesis/
```

**Don't go deeper than 3 levels. Instead, create sibling features**:

```
❌ BAD (too deep):
ai-workflow-system/
└── agent-orchestration/
    └── llm-routing/
        └── model-selection/
            └── cost-optimization/    # Too deep!

✅ GOOD (siblings):
ai-workflow-system/
├── agent-orchestration/
├── llm-routing/              # Sibling, not nested
└── model-selection/          # Another sibling
```

### The Goldilocks Rule

- **1 level**: Good for simple, standalone features

  ```
  linkedin-content-poster/
  ```

- **2 levels**: Perfect for most features ⭐

  ```
  user-management/
  └── gpg-authentication/
  ```

- **3 levels**: Only when absolutely necessary

  ```
  compliance-framework/
  └── gdpr-controls/
      └── consent-tracking/
  ```

- **4+ levels**: ❌ Too deep - refactor into siblings

## Migration Guide

When migrating existing features, follow this process:

1. **Identify Current Name**: `workflow-tracking`

2. **Ask Questions**:
   - What workflow? → User workflows
   - Who is it for? → End users and AI agents
   - What does it do? → Tracks workflow state and history

3. **Apply Pattern**: `{entity}-{action}-{purpose}`
   - Entity: `user` or `ai-agent`
   - Action: `workflow`
   - Purpose: `tracking`

4. **New Name**: `user-workflow-tracker` or `ai-workflow-system`

## Examples from Current Codebase

### Before Migration

```
features/
├── ai-workflow-system/workflow-user-tracking/     ❌ Vague
├── compliance-framework/framework-implementation/ ⚠️  OK but could be better
├── developer-tooling/feature-validation/          ❌ Too generic
└── dashboard-platform/tooling-enhancement/        ❌ What tooling?
```

### After Migration (Hierarchical + Descriptive)

```
features/
├── INDEX.md                                    # Master TODO
├── user-management/                            # Level 1: Broad domain
│   ├── gpg-authentication/                     # Level 2: Specific feature
│   │   └── key-rotation/                       # Level 3: Atomic (if needed)
│   └── session-management/
├── compliance-framework/                       # Level 1: Broad domain
│   ├── gdpr-controls/                          # Level 2: Specific feature
│   │   ├── consent-tracking/                   # Level 3: Atomic
│   │   └── data-deletion/
│   └── audit-logging/
├── ai-workflow-system/                         # Level 1: Broad domain
│   ├── agent-orchestration/                    # Level 2: Specific feature
│   ├── task-scheduling/
│   └── llm-routing/
└── cli-tools/                                  # Level 1: Broad domain
    └── feature-validator/                      # Level 2: Specific feature
        └── structure-checker/                  # Level 3: Atomic
```

**Key Improvements**:

- ✅ Clear hierarchy (broad → specific)
- ✅ Self-documenting names
- ✅ Each level adds specificity
- ✅ Easy to understand at a glance
- ✅ Usually 2 levels (occasionally 3)

## Naming Checklist

Before finalizing a feature name, check:

- [ ] Does it answer "what is this?"
- [ ] Does it indicate who/what it's for?
- [ ] Is it specific enough to distinguish from similar features?
- [ ] Would a new developer understand what it does?
- [ ] Does it avoid generic terms like "component", "system", "tool"?
- [ ] Does it follow one of the recommended patterns?
- [ ] Is it 2-4 words (kebab-case)?

## Quick Reference

| Instead of...            | Use...                        | Pattern                  |
| ------------------------ | ----------------------------- | ------------------------ |
| `workflow-tracking`      | `user-workflow-tracker`       | entity-action-purpose    |
| `auth-component`         | `user-gpg-authentication`     | entity-method-action     |
| `compliance`             | `compliance-gdpr-framework`   | domain-standard-type     |
| `feature-tools`          | `cli-feature-manager`         | component-entity-purpose |
| `validation-enhancement` | `feature-structure-validator` | entity-action-role       |
| `dashboard`              | `admin-analytics-dashboard`   | role-purpose-component   |

---

**When in doubt**: Ask yourself "If someone sees just the folder name, will they know what this does?"
