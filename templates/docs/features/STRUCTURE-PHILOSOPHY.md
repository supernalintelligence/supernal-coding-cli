# Feature Structure Philosophy

## The Core Principle

**Hierarchy = Natural Complexity Management**

```
Level 1: DOMAIN    (What area of the system?)
Level 2: FEATURE   (What specific capability?)
Level 3: ATOMIC    (What concrete implementation?)
```

## Why This Works

### 1. **Mirrors Mental Models**

When you think "I need to work on user authentication", you naturally think:

1. User management (domain)
2. Authentication (feature)
3. GPG-specific implementation (atomic)

The folder structure matches this:

```
user-management/gpg-authentication/
```

### 2. **Self-Limiting Complexity**

If you need more than 3 levels, it's a sign to refactor:

```
❌ user-management/auth/gpg/key/rotation/storage/
```

Should become:

```
✅ user-management/gpg-authentication/
✅ user-management/key-management/
```

### 3. **Phase is Metadata, Not Structure**

Instead of organizing by phase (which changes over time):

```
❌ domain-a/feature-a/ (phase: drafting)
❌ domain-b/feature-a/ (phase: implementing)  (duplicates when feature spans domains)
```

Organize by function (stable):

```
✅ user-management/gpg-authentication/
   README.md (phase: 7)
```

## Complexity Management Strategies

### Strategy 1: Broad Domains (Level 1)

Think of Level 1 as **functional modules** in your codebase:

- `user-management/` = User-related functionality
- `compliance-framework/` = Compliance/regulatory
- `ai-workflow-system/` = AI/automation
- `data-pipeline/` = Data processing
- `api-gateway/` = API/integration

**Rule**: 5-10 Level 1 domains max for most projects

### Strategy 2: Specific Features (Level 2)

Level 2 = **The actual feature** you're building:

- `gpg-authentication` = The authentication feature using GPG
- `gdpr-controls` = GDPR compliance controls
- `agent-orchestration` = AI agent coordination

**Rule**: 3-7 Level 2 features per domain

### Strategy 3: Atomic Components (Level 3)

Only when Level 2 is complex enough to warrant breakdown:

- `key-rotation` = Part of GPG authentication
- `consent-tracking` = Part of GDPR controls

**Rule**: Avoid if possible. Most features should be 2 levels.

## Decision Tree

```
Is this a new feature?
├─ YES: Is it part of an existing domain?
│  ├─ YES: Create at Level 2 under that domain
│  │      Example: user-management/oauth-login/
│  └─ NO: Does it need its own domain?
│     ├─ YES: Create new Level 1 domain
│     │      Example: notification-system/
│     └─ NO: Add to closest related domain
│            Example: api-gateway/webhook-handler/
└─ NO: Is this a sub-component of existing feature?
   ├─ YES: Is the parent complex enough?
   │  ├─ YES: Create Level 3
   │  │      Example: .../gdpr-controls/consent-tracking/
   │  └─ NO: Make it a sibling instead
   │         Example: gdpr-controls/ + audit-logging/
   └─ NO: Refactor - might be too granular
```

## Real-World Examples

### Example 1: Adding LinkedIn Posting

**Question**: Where does `linkedin-content-poster` go?

**Analysis**:

- Is it user-facing? No, it's an integration
- Is it part of existing domain? Maybe `social-media-integration/`
- Does that domain exist? No

**Decision**:

```
social-media-integration/           # New Level 1 domain
└── linkedin-content-poster/        # Level 2 feature
```

Or if you already have `integrations/`:

```
integrations/
├── github-actions/
└── linkedin-poster/
```

### Example 2: GDPR Compliance

**Question**: How to organize GDPR features?

**Analysis**:

- Domain: `compliance-framework/`
- Features: Multiple aspects (consent, deletion, export, audit)
- Sub-features: Each might have components

**Decision**:

```
compliance-framework/
├── gdpr-controls/                  # Could go deeper if needed
│   ├── consent-tracking/
│   └── data-deletion/
├── audit-logging/                  # Separate feature
└── privacy-controls/               # Separate feature
```

### Example 3: AI Workflow System

**Question**: Complex AI system with many components

**Analysis**:

- Domain: `ai-workflow-system/`
- Features: Agent orchestration, LLM routing, task scheduling
- Each feature could be complex

**Decision**:

```
ai-workflow-system/
├── agent-orchestration/            # Main coordination
│   └── context-management/         # Complex enough for Level 3
├── llm-routing/                    # Separate from orchestration
├── task-scheduling/                # Separate concern
└── response-synthesis/             # Another feature
```

**Not**:

```
❌ ai-workflow-system/
   └── core/
       └── orchestration/
           └── agents/              # Too nested!
```

## Anti-Pattern Warning Signs

### 1. Generic Names

```
❌ system/
❌ components/
❌ tools/
❌ utils/
```

These indicate lack of clear purpose.

### 2. Single-Word Top Level

```
❌ users/
❌ auth/
❌ data/
```

Add specificity: `user-management/`, `authentication-service/`, `data-pipeline/`

### 3. Too Deep

```
❌ a/b/c/d/e/  # 5 levels!
```

Flatten and make siblings.

### 4. Duplicate Info

```
❌ user-management/user-authentication/user-profile/
```

Should be:

```
✅ user-management/authentication/profile/
```

## Summary

- **Level 1**: Broad functional domain (5-10 total)
- **Level 2**: Specific feature (3-7 per domain)
- **Level 3**: Atomic component (only if needed)
- **Phase**: In frontmatter, not folders
- **Naming**: Descriptive, specific, 2-3 words
- **Refactor**: If you need Level 4+

**The goal**: Anyone can understand the codebase structure in 5 minutes by just reading folder names.
