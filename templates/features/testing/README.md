# Testing

Test plans, test results, and validation artifacts for this feature.

## Structure

```
testing/
├── README.md              # This file
├── TEST-PLAN.md           # Overall test strategy
├── manual-test-*.md       # Manual test procedures
├── test-execution-*.md    # Test run logs
├── coverage-summary.md    # Coverage report
└── external-artifacts.md  # Links to screenshots, videos
```

## Test Plan Template

Create `TEST-PLAN.md`:

```markdown
---
feature: [feature-id]
phase: [testing|validating]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Test Plan: [Feature Name]

## Scope

What is being tested?

## Test Strategy

### Automated Tests

- Unit tests
- Integration tests
- E2E tests

### Manual Tests

- User acceptance testing
- Performance testing
- Accessibility testing

## Test Environment

- Platform: [development|staging|production]
- Dependencies: [list]

## Test Cases

### TC-001: [Test Case Name]

**Requirement**: REQ-001
**Priority**: High
**Type**: Automated

**Steps**:

1. Step 1
2. Step 2

**Expected**:

- Result 1
- Result 2

**Automated**: `tests/path/to/test.test.ts`

## Quality Gates

- [ ] All automated tests passing
- [ ] Code coverage > 80%
- [ ] No critical bugs
- [ ] Performance benchmarks met

## Test Results

See:

- [Test Execution Log] (see project documentation)
- [Coverage Summary] (see project documentation)
```

## Test Execution Log Template

Create `test-execution-YYYY-MM-DD.md`:

````markdown
# Test Execution: [Date]

**Feature**: [feature-id]
**Tester**: @username
**Environment**: staging

## Automated Tests

```bash
npm test -- --testPathPattern=feature-name
```
````

**Results**:

- ✅ 23 passed
- ❌ 2 failed
- ⏭️ 1 skipped

**Failed Tests**:

1. `should handle edge case` - [Issue #123]
2. `should validate input` - [Issue #124]

## Manual Tests

### TC-001: User Login Flow

**Status**: ✅ Pass  
**Notes**: Works as expected

### TC-002: Error Handling

**Status**: ❌ Fail  
**Notes**: Error message not clear - [Issue #125]

## Coverage

Overall: 87%

- Statements: 89%
- Branches: 84%
- Functions: 91%
- Lines: 87%

See [coverage-summary.md] (see project documentation) for details.

## External Artifacts

- Screenshots: https://artifacts.supernal.dev/feature-name/screenshots/
- Videos: https://artifacts.supernal.dev/feature-name/videos/
- Reports: https://artifacts.supernal.dev/feature-name/reports/

````

## Coverage Summary Template

Create `coverage-summary.md`:

```markdown
# Coverage Summary

**Feature**: [feature-id]
**Date**: YYYY-MM-DD

## Overall Coverage: 87%

| Type       | Coverage | Threshold | Status |
|------------|----------|-----------|--------|
| Statements | 89%      | 80%       | ✅     |
| Branches   | 84%      | 75%       | ✅     |
| Functions  | 91%      | 85%       | ✅     |
| Lines      | 87%      | 80%       | ✅     |

## By File

| File                          | Coverage |
|-------------------------------|----------|
| src/features/feature-name.ts  | 95%      |
| src/features/helper.ts        | 78%      |
| src/features/utils.ts         | 89%      |

## Untested Areas

- Edge case handling in `helper.ts:42-58`
- Error recovery in `feature-name.ts:120-135`

## Full Report

HTML report: https://artifacts.supernal.dev/feature-name/coverage/
````

## External Artifacts Template

Create `external-artifacts.md` for large binary artifacts:

```markdown
# External Test Artifacts

Large artifacts (screenshots, videos, full reports) are hosted externally.

## Screenshots

- [Login flow success](https://artifacts.supernal.dev/feature-name/screenshots/login-success.png)
- [Error state](https://artifacts.supernal.dev/feature-name/screenshots/error-state.png)

## Videos

- [Full user flow](https://artifacts.supernal.dev/feature-name/videos/user-flow.mp4)
- [Performance test](https://artifacts.supernal.dev/feature-name/videos/performance.mp4)

## Reports

- [Full HTML coverage](https://artifacts.supernal.dev/feature-name/coverage/)
- [Lighthouse report](https://artifacts.supernal.dev/feature-name/lighthouse.html)
- [Bundle analysis](https://artifacts.supernal.dev/feature-name/bundle-report.html)
```

## Integration with Requirements

Link test results back to requirements in `requirements/req-*.md`:

```markdown
## Test Coverage

Validated by:

- [Test Execution 2024-11-25] (see project documentation)
- Automated tests: `tests/features/feature-name.test.ts`
- Coverage: 87% (see [coverage summary] (see project documentation))
```

## Quality Gates

Before moving to `validating/` or `complete/`:

- [ ] All automated tests passing
- [ ] Coverage meets thresholds (typically 80%+)
- [ ] Manual acceptance tests complete
- [ ] No critical or high-priority bugs
- [ ] Performance benchmarks met
- [ ] Test artifacts documented

## See Also

- [Test Validation Integration] (see project documentation)
- [Test Artifacts Detail] (see project documentation)
