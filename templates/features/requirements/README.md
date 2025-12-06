# Requirements

Feature-specific requirements in Gherkin (BDD) format.

## Naming Convention

```
req-{num}-{short-description}.md
```

**Examples**:

- `req-001-feature-scanner.md`
- `req-002-branch-integration.md`
- `req-003-validation-system.md`

## Template

````markdown
---
id: req-[feature-id]-{num}
title: [Requirement Title]
feature: [feature-id]
priority: [high|medium|low]
status: [draft|ready|implemented|validated|done]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# REQ-{num}: [Requirement Title]

## Description

What does this requirement specify?

## Feature: [Scenario Name]

```gherkin
Given [initial context]
When [action or event]
Then [expected outcome]
```
````

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Test Coverage

Link to tests that validate this requirement:

- `tests/path/to/test.test.ts`

## Dependencies

- [ ] REQ-xxx
- [ ] Epic requirement: epic-name/req-xxx

## Notes

Additional context, edge cases, or implementation notes.

````

## Gherkin Best Practices

**Good Gherkin**:
```gherkin
Feature: User Login
  Scenario: Successful login with valid credentials
    Given the user is on the login page
    And the user has a valid account
    When the user enters valid credentials
    And clicks the login button
    Then the user should be redirected to the dashboard
    And see a welcome message
````

**Bad Gherkin**:

```gherkin
Feature: Login
  Scenario: Login works
    Given user
    When login
    Then success
```

## Cross-Cutting Requirements

If a requirement spans multiple features, it should live in:

```
docs/requirements/{domain}/req-{category}-{num}-{title}.md
```

Then reference it from this feature:

```markdown
See also: [REQ-CORE-042: User Authentication] (see project documentation)
```

## See Also

- [Requirements vs Tasks Model] (see project documentation)
- [Test Validation Integration] (see project documentation)
