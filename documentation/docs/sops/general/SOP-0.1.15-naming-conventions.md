---
type: sop
category: ai-technique
sop_id: SOP-0.1.15
title: Naming Conventions Reference
phase: null
group: C
part_number: 15
audience: [developers, ai-agents, architects]
read_time: 20
created: 2025-11-21
updated: 2025-11-23
status: needs_approval
version: '1.0'
author: Supernal Coding Team
reviewedBy: []
reviewDates: []
related_sops: [SOP-0.1]
prerequisites: []
tags: [naming, conventions, standards, reference]
---

# Naming Conventions Reference

**Type**: Reference  
**Group**: C. Reference & Standards

---

## Complete Naming Conventions

This document consolidates all naming conventions used across the project.

### Traceability IDs

| Artifact              | Format                | Example         | Location                        |
| --------------------- | --------------------- | --------------- | ------------------------------- |
| Business Requirement  | BR-YYYY-NNN           | BR-2024-042     | docs/requirements/              |
| User Story            | US-YYYY-NNN           | US-2024-101     | docs/requirements/              |
| Technical Requirement | TR-YYYY-NNN           | TR-2024-201     | docs/requirements/              |
| Architecture Decision | ADR-NNN               | ADR-042         | docs/architecture/decisions/    |
| Design Decision       | DDD-feature-topic | DDD-auth-tokens | docs/features/feature/design/ |
| Micro-Decision        | DEC-NNN               | DEC-042         | Within decisions.md             |
| Change Request        | CHG-YYYY-NNN          | CHG-2024-042    | docs/changes/                   |
| Security Requirement  | SEC-NNN               | SEC-003         | docs/security/                  |

### Code Organization

#### Folders

```
src/
├── features/          ← Feature-based (PREFER)
│   └── feature-name/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       └── utils/
├── shared/            ← Shared code
└── lib/               ← Core libraries
```

#### Files

| Type            | Convention           | Example            |
| --------------- | -------------------- | ------------------ |
| React Component | PascalCase.tsx       | `UserProfile.tsx`  |
| Hook            | camelCase with 'use' | `useAuthToken.ts`  |
| Service         | camelCase + Service  | `authService.ts`   |
| Type/Interface  | PascalCase.ts        | `User.ts`          |
| Utility         | camelCase.ts         | `formatDate.ts`    |
| Constant        | SCREAMING_SNAKE      | `API_ENDPOINTS.ts` |
| Config          | lowercase.config.ts  | `jest.config.ts`   |

#### Functions/Variables

```typescript
// Functions: camelCase, verb-first
function calculateTotal(items: Item[]): number { }
const getUserById = (id: string) => { };

// Variables: camelCase, noun-first
const userName = 'John';
const isAuthenticated = true;

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';

// Private: prefix with _
private _internalState = {};

// Boolean: prefix with is/has/should/can
const isValid = true;
const hasPermission = false;
const shouldRetry = true;
const canEdit = false;
```

#### Classes/Interfaces

```typescript
// Classes: PascalCase, noun
class UserService {}
class AuthenticationError extends Error {}

// Interfaces: PascalCase, descriptive
interface User {}
interface AuthTokens {}

// Type aliases: PascalCase
type UserId = string;
type AuthState = 'authenticated' | 'unauthenticated';
```

### Test Files

| Type        | Convention                    | Location           | Example                    |
| ----------- | ----------------------------- | ------------------ | -------------------------- |
| Unit Test   | filename.test.ts                | Next to source     | `authService.test.ts`      |
| Integration | feature.integration.test.ts | tests/integration/ | `auth.integration.test.ts` |
| E2E Test    | feature.spec.ts             | tests/e2e/         | `auth.spec.ts`             |

### Git Conventions

#### Branches

**Format**: `type/ticket-description`

```
feature/US-2024-101-enable-mfa
fix/BR-2024-042-token-refresh
refactor/auth-service-cleanup
docs/api-documentation
test/add-e2e-auth-tests
chore/update-dependencies
```

#### Commits

**Format**: `type(scope): description` (Conventional Commits)

```
feat(auth): implement JWT token rotation (US-2024-101)
fix(auth): resolve token refresh race condition (BR-2024-042)
docs(api): update authentication endpoint documentation
test(auth): add E2E tests for MFA flow
refactor(auth): extract token service
chore(deps): update dependencies
```

#### Tags

**Format**: `vMAJOR.MINOR.PATCH` (Semantic Versioning)

```
v1.0.0
v1.2.3
v2.0.0-beta.1
v2.0.0-rc.1
```

### Documentation Files

| Type           | Convention                               | Location                          | Example                                     |
| -------------- | ---------------------------------------- | --------------------------------- | ------------------------------------------- |
| Feature README | README.md                                | docs/features/feature-name/          | README.md                                   |
| Architecture   | ARCHITECTURE.md                          | docs/features/feature-name/          | ARCHITECTURE.md                             |
| API Docs       | API.md                                   | docs/features/feature-name/          | API.md                                      |
| Changelog      | CHANGELOG.md                             | docs/features/feature-name/          | CHANGELOG.md                                |
| ADR            | ADR-NNN-title.md                       | docs/architecture/decisions/      | ADR-042-jwt-auth.md                         |
| Co-Planning    | co-planning-YYYY-MM-DD.md                | docs/features/feature-name/planning/ | co-planning-2024-11-22.md                   |
| Evaluation     | evaluation-feature-YYYY-MM-DD.md       | docs/features/feature-name/          | evaluation-auth-2024-11-22.md               |
| Retrospective  | retrospective-sprint-N-YYYY-MM-DD.md   | docs/retrospectives/              | retrospective-sprint-23-2024-11-22.md       |
| Incident       | incident-severity-YYYY-MM-DD-desc.md | docs/incidents/                   | incident-critical-2024-11-22-auth-outage.md |

### Database

#### Tables

```sql
-- Snake case, plural
users
refresh_tokens
user_sessions
oauth_providers
```

#### Columns

```sql
-- Snake case
user_id
created_at
updated_at
email_verified
is_active
```

### API Endpoints

#### REST

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/:id
GET    /api/users
POST   /api/users
PUT    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id
```

#### GraphQL

```graphql
# Queries: camelCase
query {
  user(id: "123")
  users(limit: 10)
}

# Mutations: camelCase
mutation {
  createUser(input: {...})
  updateUser(id: "123", input: {...})
}
```

### Environment Variables

```bash
# SCREAMING_SNAKE_CASE
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
API_BASE_URL=https://...
NODE_ENV=production
```

---

## Quick Reference

**When naming something new**:

1. Check this document for the pattern
2. Look for similar existing names
3. Follow the established convention
4. If unsure, ask in code review

**Remember**:

- Consistency > personal preference
- Clarity > brevity
- Follow existing patterns first

---

## Navigation

← Previous: [Part 14: Evaluation & Learning](SOP-0.1.14-evaluation-learning.md)
→ Next: [Part 16: Roles & Responsibilities](SOP-0.1.16-roles-responsibilities.md)

[Back to Overview](../SOP-0.1-ai-accelerated-workflow-overview.md)
