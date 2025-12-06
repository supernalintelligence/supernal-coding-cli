/**
 * Jest Setup File
 *
 * Runs before all tests to configure the testing environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPERNAL_DEBUG = 'false';

// Global test timeout (can be overridden per test)
jest.setTimeout(10000);

// Mock console methods to reduce noise in test output (optional)
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   // Keep error for debugging
// };

// Custom matchers (optional)
expect.extend({
  toBeValidRequirement(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      received.id &&
      received.title &&
      received.status &&
      received.priority;

    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to be a valid requirement`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to be a valid requirement with id, title, status, and priority`,
        pass: false
      };
    }
  },

  toBeValidKanbanTask(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      received.id &&
      received.title &&
      received.board;

    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to be a valid kanban task`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to be a valid kanban task with id, title, and board`,
        pass: false
      };
    }
  },

  toHaveValidSyncStatus(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.enabled === 'boolean' &&
      received.state;

    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to have valid sync status`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to have valid sync status with enabled and state properties`,
        pass: false
      };
    }
  }
});

// Global test helpers
global.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

global.mockRequirement = (overrides = {}) => ({
  id: 'REQ-TEST-001',
  title: 'Test Requirement',
  status: 'Draft',
  priority: 'Medium',
  epic: 'test-epic',
  category: 'test',
  path: '/test/path/req-test-001.md',
  ...overrides
});

global.mockKanbanTask = (overrides = {}) => ({
  id: 'task-test-001',
  title: 'Test Task',
  board: 'TODO',
  type: 'feature',
  path: '/test/path/task-test-001.md',
  ...overrides
});

global.mockSyncChange = (overrides = {}) => ({
  type: 'requirement',
  action: 'update',
  id: 'REQ-TEST-001',
  data: { status: 'In Progress' },
  timestamp: new Date().toISOString(),
  ...overrides
});

// Cleanup after all tests
afterAll(() => {
  // Perform any global cleanup if needed
});

console.log('✓ Jest setup complete');
