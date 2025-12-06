# Supernal Coding Test Suite

Comprehensive test suite for the Supernal Coding package, including unit tests, integration tests, and end-to-end tests.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end tests only

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

## Test Structure

```
tests/
├── unit/              # Unit tests for individual components
│   ├── tools/         # Tests for MCP tools
│   │   ├── requirements.test.js
│   │   ├── kanban.test.js
│   │   └── validation.test.js
│   ├── sync/          # Tests for sync manager
│   │   ├── manager.test.js
│   │   └── backends/
│   │       └── rest.test.js
│   └── api/           # Tests for programmatic API
│       └── index.test.js
├── integration/       # Integration tests
│   ├── mcp-server.test.js
│   ├── sync-flow.test.js
│   └── api-http.test.js
├── e2e/              # End-to-end tests
│   ├── claude-code.test.js
│   └── dashboard.test.js
├── test-fixtures/     # Test data and fixtures
│   ├── requirements/
│   ├── kanban/
│   └── config/
├── setup.js          # Jest setup file
└── README.md         # This file
```

## Test Types

### Unit Tests

Unit tests focus on individual components in isolation. They use mocks and stubs to isolate the component being tested.

**Location:** `tests/unit/`

**Example:**

```javascript
// tests/unit/tools/requirements.test.js
describe('RequirementsManager', () => {
  test('lists requirements with filters', async () => {
    const requirements = await manager.list({ priority: 'Critical' });
    expect(requirements).toBeInstanceOf(Array);
    expect(requirements.every((r) => r.priority === 'Critical')).toBe(true);
  });
});
```

**Run:**

```bash
npm run test:unit
```

### Integration Tests

Integration tests verify that multiple components work together correctly. They test the interactions between components.

**Location:** `tests/integration/`

**Example:**

```javascript
// tests/integration/mcp-server.test.js
describe('MCP Server Integration', () => {
  test('server starts and responds', async () => {
    const response = await sendMCPRequest({
      method: 'tools/list',
    });
    expect(response.tools).toBeDefined();
  });
});
```

**Run:**

```bash
npm run test:integration
```

### End-to-End Tests

End-to-end tests verify complete workflows from user perspective. They test the entire system in a production-like environment.

**Location:** `tests/e2e/`

**Example:**

```javascript
// tests/e2e/claude-code.test.js
describe('Claude Code E2E', () => {
  test('Full workflow: create requirement', async () => {
    // Simulate complete user workflow
  });
});
```

**Run:**

```bash
npm run test:e2e
```

## Writing Tests

### Test File Naming

- Unit tests: `*.test.js` in `tests/unit/`
- Integration tests: `*.test.js` in `tests/integration/`
- E2E tests: `*.test.js` in `tests/e2e/`

### Test Structure

```javascript
describe('Component Name', () => {
  // Setup
  beforeAll(() => {
    // Runs once before all tests in this file
  });

  beforeEach(() => {
    // Runs before each test
  });

  afterEach(() => {
    // Runs after each test
  });

  afterAll(() => {
    // Runs once after all tests in this file
  });

  describe('method name', () => {
    test('should do something', () => {
      // Test implementation
      expect(result).toBe(expected);
    });

    test('should handle error case', () => {
      // Error handling test
      expect(() => dangerousFunction()).toThrow();
    });
  });
});
```

### Custom Matchers

Custom Jest matchers are available via `tests/setup.js`:

```javascript
// Check if object is a valid requirement
expect(requirement).toBeValidRequirement();

// Check if object is a valid kanban task
expect(task).toBeValidKanbanTask();

// Check if object has valid sync status
expect(status).toHaveValidSyncStatus();
```

### Helper Functions

Global helper functions from `tests/setup.js`:

```javascript
// Delay execution
await delay(1000); // Wait 1 second

// Create mock objects
const req = mockRequirement({ priority: 'Critical' });
const task = mockKanbanTask({ board: 'DOING' });
const change = mockSyncChange({ action: 'create' });
```

### Mocking

#### Mock Functions

```javascript
const mockFn = jest.fn();
mockFn.mockReturnValue('mocked value');
mockFn.mockResolvedValue('async value');
mockFn.mockRejectedValue(new Error('error'));

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(3);
```

#### Mock Modules

```javascript
jest.mock('../../../lib/mcp-server/tools/requirements', () => {
  return jest.fn().mockImplementation(() => ({
    list: jest.fn().mockResolvedValue([]),
    read: jest.fn().mockResolvedValue({}),
  }));
});
```

#### Mock Backend

```javascript
const mockBackend = {
  initialize: jest.fn().mockResolvedValue(true),
  push: jest.fn().mockResolvedValue({ success: true, pushed: 5 }),
  pull: jest.fn().mockResolvedValue([]),
};

syncManager.backend = mockBackend;
```

## Test Coverage

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report in browser
open coverage/index.html
```

### Coverage Thresholds

Configured in `jest.config.js`:

- **Branches:** 70%
- **Functions:** 75%
- **Lines:** 80%
- **Statements:** 80%

### Increasing Coverage

1. Identify uncovered lines:

   ```bash
   npm run test:coverage
   # Review coverage/index.html
   ```

2. Write tests for uncovered code:
   - Focus on error handling paths
   - Test edge cases
   - Test all conditional branches

3. Run coverage again to verify:
   ```bash
   npm run test:coverage
   ```

## Test Fixtures

Test fixtures provide sample data for tests.

### Location

`tests/test-fixtures/`

### Creating Fixtures

```javascript
// tests/test-fixtures/requirements/test-req-001.md
---
id: REQ-TEST-001
status: Draft
priority: Medium
epic: test-epic
category: test
---

# REQ-TEST-001: Test Requirement

Test requirement for unit tests.

## Description

This is a test requirement fixture.
```

### Using Fixtures

```javascript
const path = require('path');
const fs = require('fs').promises;

const fixturePath = path.join(
  __dirname,
  '../test-fixtures/requirements/test-req-001.md'
);

const content = await fs.readFile(fixturePath, 'utf8');
```

## Continuous Integration

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Debugging Tests

### Run Single Test File

```bash
npm test -- tests/unit/tools/requirements.test.js
```

### Run Single Test

```bash
npm test -- -t "lists requirements with filters"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Common Issues

### Tests Timeout

Increase timeout in test or globally:

```javascript
// Per test
test('slow operation', async () => {
  // ...
}, 30000); // 30 second timeout

// Global (in jest.config.js)
module.exports = {
  testTimeout: 30000,
};
```

### Mock Not Working

Ensure mock is defined before module import:

```javascript
// Good
jest.mock('../module');
const module = require('../module');

// Bad
const module = require('../module');
jest.mock('../module');
```

### Tests Pass Locally, Fail in CI

- Check for environment-specific code
- Verify test fixtures are included in repository
- Check for timing-dependent tests (use Jest fake timers)
- Ensure cleanup happens after each test

## Best Practices

1. **Test Behavior, Not Implementation**
   - Test what the code does, not how it does it
   - Avoid testing internal implementation details

2. **Use Descriptive Test Names**

   ```javascript
   // Good
   test('returns empty array when no requirements match filters', () => {});

   // Bad
   test('test list method', () => {});
   ```

3. **One Assertion Per Test** (when practical)
   - Makes failures easier to diagnose
   - Tests are more focused

4. **Arrange, Act, Assert** (AAA Pattern)

   ```javascript
   test('example', () => {
     // Arrange
     const manager = new RequirementsManager('/test/path');

     // Act
     const result = manager.list();

     // Assert
     expect(result).toBeInstanceOf(Array);
   });
   ```

5. **Clean Up After Tests**
   - Use `afterEach` and `afterAll`
   - Delete created files
   - Restore mocks: `jest.restoreAllMocks()`

6. **Keep Tests Fast**
   - Mock external dependencies
   - Use test fixtures instead of creating real data
   - Avoid unnecessary delays

7. **Test Error Cases**
   - Always test error handling
   - Verify error messages are helpful
   - Test edge cases

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [Supernal Coding Documentation](../docs/)

## Contributing

When contributing tests:

1. Follow existing test structure
2. Ensure tests are independent (no shared state)
3. Add fixtures for new test data
4. Update this README if adding new patterns
5. Maintain coverage thresholds
6. Run `npm run test:coverage` before committing

---

**Last Updated:** 2025-10-28
**Status:** Test suite structure created, tests need implementation
