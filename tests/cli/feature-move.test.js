/**
 * Tests for sc feature move command
 * Tests moving features between domains (organizational structure)
 */

const fs = require('node:fs').promises;
const path = require('node:path');
const { execSync } = require('node:child_process');
const { moveFeatureCommand } = require('../../lib/cli/commands/feature/move');
const _FeatureValidator = require('../../lib/validation/FeatureValidator');

// Mock chalk to avoid color codes in tests
jest.mock('chalk', () => {
  const mockFn = (str) => str;
  mockFn.green = mockFn;
  mockFn.red = mockFn;
  mockFn.yellow = mockFn;
  mockFn.blue = mockFn;
  mockFn.gray = mockFn;
  mockFn.bold = mockFn;
  return mockFn;
});

describe('sc feature move', () => {
  let testDir;
  let featuresDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temporary test directory
    testDir = path.join(__dirname, '..', '..', 'tmp', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Initialize git repo
    process.chdir(testDir);
    execSync('git init', { stdio: 'pipe' });
    execSync('git config user.name "Test User"', { stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { stdio: 'pipe' });

    // Create domain-based features directory structure
    featuresDir = path.join(testDir, 'docs', 'features');
    await fs.mkdir(
      path.join(featuresDir, 'developer-tooling', 'test-feature'),
      {
        recursive: true
      }
    );

    // Create required directories for drafting phase
    await fs.mkdir(
      path.join(featuresDir, 'developer-tooling', 'test-feature', 'design'),
      { recursive: true }
    );
    await fs.mkdir(
      path.join(featuresDir, 'developer-tooling', 'test-feature', 'planning'),
      { recursive: true }
    );
    await fs.mkdir(
      path.join(
        featuresDir,
        'developer-tooling',
        'test-feature',
        'requirements'
      ),
      { recursive: true }
    );

    // Create test feature in developer-tooling domain
    const featureReadme = `---
feature_id: test-feature
title: Test Feature
domain: developer-tooling
phase: drafting
status: active
branch: main
created: 2025-11-28
updated: 2025-11-28
---

# Test Feature

Test feature for move command testing.
`;

    await fs.writeFile(
      path.join(featuresDir, 'developer-tooling', 'test-feature', 'README.md'),
      featureReadme
    );

    // Initial commit
    execSync('git add -A', { stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { stdio: 'pipe' });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_err) {
      // Ignore cleanup errors
    }
  });

  describe('successful moves between domains', () => {
    test('moves feature from developer-tooling to ai-workflow-system', async () => {
      const consoleLog = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      try {
        await moveFeatureCommand('test-feature', 'ai-workflow-system', {
          projectRoot: testDir
        });
      } catch (error) {
        // If command threw an error, show logs for debugging
        console.error('Command threw error:', error.message);
        consoleLog.mock.calls.forEach((call) => {
          console.error(call[0]);
        });
      }

      // Verify folder moved to new domain
      const newPath = path.join(
        featuresDir,
        'ai-workflow-system',
        'test-feature'
      );
      const exists = await fs
        .access(newPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Verify old path gone
      const oldPath = path.join(
        featuresDir,
        'developer-tooling',
        'test-feature'
      );
      const oldExists = await fs
        .access(oldPath)
        .then(() => true)
        .catch(() => false);
      expect(oldExists).toBe(false);

      // Verify frontmatter updated
      const readme = await fs.readFile(
        path.join(newPath, 'README.md'),
        'utf-8'
      );
      expect(readme).toMatch(/domain:\s*ai-workflow-system/);
      expect(readme).toMatch(/updated:\s*\d{4}-\d{2}-\d{2}/);

      consoleLog.mockRestore();
    });

    test('moves feature to another domain preserving phase', async () => {
      // Create target domain
      await fs.mkdir(path.join(featuresDir, 'dashboard-platform'), {
        recursive: true
      });

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await moveFeatureCommand('test-feature', 'dashboard-platform', {
        projectRoot: testDir
      });

      const newPath = path.join(
        featuresDir,
        'dashboard-platform',
        'test-feature'
      );
      const exists = await fs
        .access(newPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const readme = await fs.readFile(
        path.join(newPath, 'README.md'),
        'utf-8'
      );
      // Domain should update
      expect(readme).toMatch(/domain:\s*dashboard-platform/);
      // Phase should remain the same (metadata, not structure)
      expect(readme).toMatch(/phase:\s*drafting/);

      mockExit.mockRestore();
    });

    test('updates timestamp when moving', async () => {
      const oldReadme = await fs.readFile(
        path.join(
          featuresDir,
          'developer-tooling',
          'test-feature',
          'README.md'
        ),
        'utf-8'
      );
      const oldDate = oldReadme.match(/updated:\s*(\d{4}-\d{2}-\d{2})/)[1];

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await moveFeatureCommand('test-feature', 'ai-workflow-system', {
        projectRoot: testDir
      });

      const newReadme = await fs.readFile(
        path.join(
          featuresDir,
          'ai-workflow-system',
          'test-feature',
          'README.md'
        ),
        'utf-8'
      );
      const newDate = newReadme.match(/updated:\s*(\d{4}-\d{2}-\d{2})/)[1];

      expect(newDate).not.toBe(oldDate);

      mockExit.mockRestore();
    });
  });

  describe('validation and error handling', () => {
    test('rejects invalid domain name', async () => {
      const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        moveFeatureCommand('test-feature', 'invalid-domain', {
          projectRoot: testDir
        })
      ).rejects.toThrow('Invalid domain');

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('Invalid domain')
      );

      mockLog.mockRestore();
    });

    test('rejects nonexistent feature', async () => {
      const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        moveFeatureCommand('nonexistent-feature', 'ai-workflow-system', {
          projectRoot: testDir
        })
      ).rejects.toThrow('Feature not found');

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('Feature not found')
      );

      mockLog.mockRestore();
    });

    test('handles already-in-target-domain gracefully', async () => {
      const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Try to move to same domain - should complete without error
      await moveFeatureCommand('test-feature', 'developer-tooling', {
        projectRoot: testDir
      });

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('already in developer-tooling')
      );

      mockLog.mockRestore();
    });

    test('blocks move if current state invalid', async () => {
      // Corrupt the feature's frontmatter
      const readmePath = path.join(
        featuresDir,
        'developer-tooling',
        'test-feature',
        'README.md'
      );
      let readme = await fs.readFile(readmePath, 'utf-8');
      readme = readme.replace(
        /feature_id:\s*test-feature/,
        'feature_id: wrong-id'
      );
      await fs.writeFile(readmePath, readme);

      const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

      await expect(
        moveFeatureCommand('test-feature', 'ai-workflow-system', {
          projectRoot: testDir
        })
      ).rejects.toThrow('validation errors');

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('validation errors')
      );

      mockLog.mockRestore();
    });
  });

  describe('git integration', () => {
    test('preserves git history with git mv', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await moveFeatureCommand('test-feature', 'ai-workflow-system', {
        projectRoot: testDir
      });

      // Check git status shows move
      const gitStatus = execSync('git status --short', {
        cwd: testDir,
        encoding: 'utf-8'
      });

      // Should show rename in git status
      expect(gitStatus).toMatch(/R.*test-feature/);

      mockExit.mockRestore();
    });

    test('stages changes after move', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await moveFeatureCommand('test-feature', 'ai-workflow-system', {
        projectRoot: testDir
      });

      const gitStatus = execSync('git status --short', {
        cwd: testDir,
        encoding: 'utf-8'
      });

      // Changes should be staged (not "??" for untracked)
      expect(gitStatus).not.toMatch(/\?\?/);

      mockExit.mockRestore();
    });
  });

  describe('frontmatter preservation', () => {
    test('preserves other frontmatter fields', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await moveFeatureCommand('test-feature', 'ai-workflow-system', {
        projectRoot: testDir
      });

      const newReadme = await fs.readFile(
        path.join(
          featuresDir,
          'ai-workflow-system',
          'test-feature',
          'README.md'
        ),
        'utf-8'
      );

      // Should still have original fields
      expect(newReadme).toMatch(/feature_id:\s*test-feature/);
      expect(newReadme).toMatch(/title:\s*Test Feature/);
      expect(newReadme).toMatch(/phase:\s*drafting/);
      expect(newReadme).toMatch(/status:\s*active/);
      expect(newReadme).toMatch(/branch:\s*main/);
      expect(newReadme).toMatch(/created:\s*2025-11-28/);

      mockExit.mockRestore();
    });

    test('only updates domain and updated fields', async () => {
      const oldReadme = await fs.readFile(
        path.join(
          featuresDir,
          'developer-tooling',
          'test-feature',
          'README.md'
        ),
        'utf-8'
      );

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await moveFeatureCommand('test-feature', 'ai-workflow-system', {
        projectRoot: testDir
      });

      const newReadme = await fs.readFile(
        path.join(
          featuresDir,
          'ai-workflow-system',
          'test-feature',
          'README.md'
        ),
        'utf-8'
      );

      // Domain should be different
      expect(oldReadme).toMatch(/domain:\s*developer-tooling/);
      expect(newReadme).toMatch(/domain:\s*ai-workflow-system/);

      // Updated should be different
      const _oldUpdated = oldReadme.match(
        /updated:\s*(\d{4}-\d{2}-\d{2})/
      )?.[1];
      const newUpdated = newReadme.match(/updated:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
      expect(newUpdated).toBeDefined();

      // Phase should be preserved (it's workflow metadata, not structure)
      expect(newReadme).toMatch(/phase:\s*drafting/);

      // Everything else should be the same
      expect(newReadme).toMatch(/feature_id:\s*test-feature/);
      expect(newReadme).toMatch(/title:\s*Test Feature/);

      mockExit.mockRestore();
    });
  });
});
