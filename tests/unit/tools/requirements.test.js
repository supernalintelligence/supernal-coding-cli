/**
 * Unit tests for RequirementsManager
 *
 * Note: These are basic tests. Full integration tests require
 * a complete Supernal Coding project setup with requirements files.
 */

const RequirementsManager = require('../../../lib/mcp-server/tools/requirements');

describe('RequirementsManager', () => {
  let manager;

  beforeEach(() => {
    manager = new RequirementsManager('/test/project');
  });

  describe('Constructor', () => {
    test('initializes with project root', () => {
      expect(manager).toBeDefined();
      expect(manager.projectRoot).toBe('/test/project');
      expect(manager.requirementsDir).toContain('supernal-coding/requirements');
    });
  });

  describe('parseRequirement()', () => {
    test('throws error for invalid frontmatter', async () => {
      // This test verifies error handling without needing real files
      const fs = require('fs-extra');
      jest.spyOn(fs, 'readFile').mockResolvedValue('No frontmatter here');

      await expect(manager.parseRequirement('/fake/path.md')).rejects.toThrow(
        'Invalid requirement format'
      );

      fs.readFile.mockRestore();
    });

    test('parses valid requirement with frontmatter', async () => {
      const fs = require('fs-extra');
      const mockContent = `---
id: REQ-001
title: Test Requirement
status: Draft
priority: Medium
epic: test-epic
---

# REQ-001: Test Requirement

Content here`;

      jest.spyOn(fs, 'readFile').mockResolvedValue(mockContent);

      const result = await manager.parseRequirement('/fake/path.md');

      expect(result).toHaveProperty('id', 'REQ-001');
      expect(result).toHaveProperty('title', 'Test Requirement');
      expect(result).toHaveProperty('status', 'Draft');
      expect(result).toHaveProperty('priority', 'Medium');

      fs.readFile.mockRestore();
    });

    test('extracts Gherkin scenarios when present', async () => {
      const fs = require('fs-extra');
      const mockContent = `---
id: REQ-001
title: Test Requirement
---

\`\`\`gherkin
Scenario: Test scenario
  Given something
  When something happens
  Then something occurs
\`\`\`
`;

      jest.spyOn(fs, 'readFile').mockResolvedValue(mockContent);

      const result = await manager.parseRequirement('/fake/path.md');

      expect(result).toHaveProperty('hasScenarios', true);
      expect(result).toHaveProperty('scenarios');
      expect(result.scenarios).toContain('Scenario: Test scenario');

      fs.readFile.mockRestore();
    });
  });

  describe('validate()', () => {
    test('returns success false when validation fails', async () => {
      const { execSync } = require('node:child_process');
      const originalExecSync = execSync;

      // Mock execSync to throw error
      require('node:child_process').execSync = jest.fn(() => {
        const error = new Error('Command failed');
        error.stdout = 'Validation output';
        error.stderr = 'Error details';
        throw error;
      });

      const result = await manager.validate('REQ-001');

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('id', 'REQ-001');

      // Restore original
      require('node:child_process').execSync = originalExecSync;
    });
  });

  describe('create()', () => {
    test('throws error with helpful message on failure', async () => {
      const { execSync } = require('node:child_process');
      const originalExecSync = execSync;

      // Mock execSync to throw error
      require('node:child_process').execSync = jest.fn(() => {
        throw new Error('sc command not found');
      });

      await expect(
        manager.create({ title: 'Test', epic: 'test', priority: 'Medium' })
      ).rejects.toThrow('Failed to create requirement');

      // Restore original
      require('node:child_process').execSync = originalExecSync;
    });
  });
});
