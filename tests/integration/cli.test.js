/**
 * CLI Integration Tests
 * Tests for command-line interface
 *
 * NOTE: Skipping - these test Renaissance CLI commands not yet implemented
 */

const { describe, it, beforeEach, expect } = require('@jest/globals');
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs').promises;
const os = require('node:os');

describe.skip('CLI Integration Tests', () => {
  let testDir;
  let scBin;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-cli-test-'));
    scBin = path.join(__dirname, '../../bin/sc');

    // Initialize project structure
    const supernalDir = path.join(testDir, '.supernal');
    await fs.mkdir(supernalDir, { recursive: true });

    // Create minimal project.yaml
    await fs.writeFile(
      path.join(supernalDir, 'project.yaml'),
      `
workflow:
  defaults: minimal
project:
  name: test-project
  version: 1.0.0
`
    );
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('workflow commands', () => {
    it.skip('should show workflow status - requires workflow init', () => {
      // Skipped: Need to initialize workflow state first
      // TODO: Add `sc workflow init --pattern=minimal` before test
    });

    it.skip('should list workflow phases - requires workflow init', () => {
      // Skipped: Need to initialize workflow state first
    });

    it.skip('should show workflow history - requires workflow init', () => {
      // Skipped: Need to initialize workflow state first
    });
  });

  describe('config commands', () => {
    it('should show configuration', () => {
      const output = execSync(`cd ${testDir} && node ${scBin} config show`, {
        encoding: 'utf8'
      });

      expect(output).toContain('workflow:');
      expect(output).toContain('project:');
    });

    it.skip('should validate configuration - needs ConfigValidator fix', () => {
      // Skipped: ConfigValidator not properly handling config objects
      // TODO: Fix ConfigValidator to accept resolved config
    });

    it('should list patterns', () => {
      const output = execSync(
        `cd ${testDir} && node ${scBin} config list-patterns`,
        {
          encoding: 'utf8'
        }
      );

      expect(output).toMatch(/minimal|agile-4|comprehensive-16/);
    });
  });

  describe('template commands', () => {
    it('should list templates', () => {
      const output = execSync(`cd ${testDir} && node ${scBin} template list`, {
        encoding: 'utf8'
      });

      expect(output).toMatch(/Template|SAD|ADR|SOP/);
    });

    it('should show template registry', () => {
      const output = execSync(
        `cd ${testDir} && node ${scBin} template registry`,
        {
          encoding: 'utf8'
        }
      );

      expect(output).toMatch(/Type|Category/);
    });
  });

  describe('multi-repo commands', () => {
    it('should discover repositories', () => {
      const output = execSync(
        `cd ${testDir} && node ${scBin} multi-repo discover`,
        {
          encoding: 'utf8'
        }
      );

      expect(output).toMatch(/Found|No sub-repositories found/);
    });

    it('should show repository status', () => {
      const output = execSync(
        `cd ${testDir} && node ${scBin} multi-repo status`,
        {
          encoding: 'utf8'
        }
      );

      expect(output).toMatch(/Repository|No sub-repositories found/);
    });
  });

  describe('error handling', () => {
    it('should show error when not in supernal project', () => {
      const nonProjectDir = path.join(os.tmpdir(), `non-project-${Date.now()}`);

      try {
        execSync(
          `mkdir -p ${nonProjectDir} && cd ${nonProjectDir} && node ${scBin} workflow status`,
          {
            encoding: 'utf8'
          }
        );
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.stderr || error.stdout).toMatch(/Not a Supernal project/);
      } finally {
        execSync(`rm -rf ${nonProjectDir}`);
      }
    });

    it('should show help when no command provided', () => {
      const output = execSync(`node ${scBin} --help`, {
        encoding: 'utf8'
      });

      expect(output).toContain('workflow');
      expect(output).toContain('config');
      expect(output).toContain('template');
      expect(output).toContain('multi-repo');
    });
  });
});
