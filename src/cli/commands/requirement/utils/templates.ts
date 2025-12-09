/**
 * Template generators for requirement management
 */
class RequirementTemplates {
  /**
   * Get default requirement template
   */
  static getDefaultTemplate() {
    return `---
id: REQ-{{id}}
title: {{requirement-name}}
status: pending
priority: {{priority}}
epic: {{epic-name}}
dependencies: []
created: {{date}}
updated: {{date}}
---

# REQ-{{id}}: {{requirement-name}}

## Overview
{{functionality}}

## User Story
**As a** {{user-type}}  
**I want** {{functionality}}  
**So that** {{benefit}}

## Acceptance Criteria
- [ ] {{precondition}}
- [ ] {{action}}
- [ ] {{expected-result}}

## Technical Implementation
{{technical-details}}

## Test Strategy
{{test-strategy}}

## Notes
{{implementation-notes}}
`;
  }

  /**
   * Create Cucumber steps template
   */
  static createStepsTemplate(reqId) {
    return `const { Given, When, Then } = require('@cucumber/cucumber');

// REQ-${reqId} Step Definitions
// Generated on ${new Date().toISOString().split('T')[0]}

Given('I have a precondition', function () {
  // Implement precondition setup
  this.pending();
});

When('I perform an action', function () {
  // Implement the action
  this.pending();
});

Then('I should see the expected result', function () {
  // Implement assertion
  this.pending();
});

// Add more step definitions based on your Gherkin scenarios
`;
  }

  /**
   * Create unit test template
   */
  static createUnitTestTemplate(reqId) {
    return `// REQ-${reqId} Unit Tests
// Generated on ${new Date().toISOString().split('T')[0]}

describe('REQ-${reqId} Unit Tests', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  test('should implement core functionality', () => {
    // Implement unit test
    expect(true).toBe(true); // Replace with actual test
  });

  test('should handle error cases', () => {
    // Implement error handling test
    expect(true).toBe(true); // Replace with actual test
  });

  // Add more unit tests based on acceptance criteria
});
`;
  }

  /**
   * Create E2E test template
   */
  static createE2ETestTemplate(reqId) {
    return `// REQ-${reqId} End-to-End Tests
// Generated on ${new Date().toISOString().split('T')[0]}

const { test, expect } = require('@playwright/test');

test.describe('REQ-${reqId} E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
  });

  test('should complete end-to-end user flow', async ({ page }) => {
    // Implement E2E test
    // await page.goto('your-app-url');
    // await page.click('selector');
    // await expect(page.locator('result')).toBeVisible();
  });

  test('should handle edge cases', async ({ page }) => {
    // Implement edge case testing
  });

  // Add more E2E tests based on user stories
});
`;
  }
}

module.exports = RequirementTemplates;
