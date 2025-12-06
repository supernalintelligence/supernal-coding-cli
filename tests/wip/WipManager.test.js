const fs = require('fs-extra');
const path = require('node:path');
const WipManager = require('../../lib/wip/WipManager');

describe('WipManager', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = path.join(__dirname, '../.tmp/wip-test');
    await fs.ensureDir(tempDir);
    manager = new WipManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
  });

  describe('register', () => {
    it('should register a file in WIP registry', async () => {
      // Create test file
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test File');

      // Register file
      const entry = await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042',
        reason: 'Testing'
      });

      expect(entry.path).toBe('test.md');
      expect(entry.feature).toBe('my-feature');
      expect(entry.requirement).toBe('REQ-042');
      expect(entry.reason).toBe('Testing');
      expect(entry.auto_cleanup).toBe(true);
      expect(entry.userid).toBeDefined(); // Should auto-detect
    });

    it('should register a file with explicit userid', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test File');

      const entry = await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042',
        reason: 'Testing',
        userid: 'alice'
      });

      expect(entry.userid).toBe('alice');
    });

    it('should auto-detect userid if not provided', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test File');

      // Mock getUserid
      jest.spyOn(manager, 'getUserid').mockResolvedValue('auto-user');

      const entry = await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042'
      });

      expect(entry.userid).toBe('auto-user');
    });

    it('should throw error if file does not exist', async () => {
      await expect(
        manager.register('nonexistent.md', {
          feature: 'my-feature',
          requirement: 'REQ-042'
        })
      ).rejects.toThrow('File not found');
    });

    it('should throw error if file already registered', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042'
      });

      await expect(
        manager.register('test.md', {
          feature: 'my-feature',
          requirement: 'REQ-042'
        })
      ).rejects.toThrow('already WIP-tracked');
    });

    it('should throw specific error if different user tries to register same file', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042',
        userid: 'alice'
      });

      await expect(
        manager.register('test.md', {
          feature: 'my-feature',
          requirement: 'REQ-042',
          userid: 'bob'
        })
      ).rejects.toThrow('already WIP-tracked by @alice');
    });

    it('should add comment to file if requested', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test File\n\nContent here');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042',
        addComment: true
      });

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('WIP-REGISTRY:');
      expect(content).toContain('my-feature');
      expect(content).toContain('REQ-042');
    });
  });

  describe('unregister', () => {
    it('should unregister a file from WIP registry', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042'
      });

      const result = await manager.unregister('test.md');
      expect(result.removed).toBe(true);

      // Verify file is no longer in registry
      const files = await manager.list();
      expect(files).toHaveLength(0);
    });

    it('should remove comment from file if present', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test File\n\nContent');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042',
        addComment: true
      });

      await manager.unregister('test.md');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).not.toContain('WIP-REGISTRY:');
      expect(content).toContain('# Test File');
    });
  });

  describe('list', () => {
    it('should list all WIP-tracked files', async () => {
      const file1 = path.join(tempDir, 'file1.md');
      const file2 = path.join(tempDir, 'file2.md');

      await fs.writeFile(file1, '# File 1');
      await fs.writeFile(file2, '# File 2');

      await manager.register('file1.md', {
        feature: 'feature-a',
        requirement: 'REQ-001'
      });

      await manager.register('file2.md', {
        feature: 'feature-b',
        requirement: 'REQ-002'
      });

      const files = await manager.list();
      expect(files).toHaveLength(2);
      expect(files[0].path).toBe('file1.md');
      expect(files[1].path).toBe('file2.md');
    });

    it('should filter by userid', async () => {
      const file1 = path.join(tempDir, 'file1.md');
      const file2 = path.join(tempDir, 'file2.md');
      const file3 = path.join(tempDir, 'file3.md');

      await fs.writeFile(file1, '# File 1');
      await fs.writeFile(file2, '# File 2');
      await fs.writeFile(file3, '# File 3');

      await manager.register('file1.md', {
        feature: 'feature-a',
        requirement: 'REQ-001',
        userid: 'alice'
      });

      await manager.register('file2.md', {
        feature: 'feature-b',
        requirement: 'REQ-002',
        userid: 'bob'
      });

      await manager.register('file3.md', {
        feature: 'feature-c',
        requirement: 'REQ-003',
        userid: 'alice'
      });

      const aliceFiles = await manager.list({ userid: 'alice' });
      expect(aliceFiles).toHaveLength(2);
      expect(aliceFiles[0].path).toBe('file1.md');
      expect(aliceFiles[1].path).toBe('file3.md');

      const bobFiles = await manager.list({ userid: 'bob' });
      expect(bobFiles).toHaveLength(1);
      expect(bobFiles[0].path).toBe('file2.md');
    });

    it('should filter unassigned files', async () => {
      const file1 = path.join(tempDir, 'file1.md');
      const file2 = path.join(tempDir, 'file2.md');

      await fs.writeFile(file1, '# File 1');
      await fs.writeFile(file2, '# File 2');

      await manager.register('file1.md', {
        feature: 'feature-a',
        requirement: 'REQ-001',
        userid: 'alice'
      });

      // Register without userid and mock to return 'unknown'
      jest.spyOn(manager, 'getUserid').mockResolvedValue('unknown');
      await manager.register('file2.md', {
        feature: 'feature-b',
        requirement: 'REQ-002'
      });

      const unassigned = await manager.list({ unassigned: true });
      expect(unassigned).toHaveLength(1);
      expect(unassigned[0].path).toBe('file2.md');
    });

    it('should filter by age', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042'
      });

      // Mock old file by modifying last_modified
      const registry = await manager.loadRegistry();
      registry.files[0].last_modified = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000
      ).toISOString();
      await manager.saveRegistry(registry);

      const oldFiles = await manager.list({ olderThan: '7' });
      expect(oldFiles).toHaveLength(1);

      const recentFiles = await manager.list({ olderThan: '15' });
      expect(recentFiles).toHaveLength(0);
    });

    it('should return paths only if requested', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042'
      });

      const paths = await manager.list({ pathsOnly: true });
      expect(paths).toEqual(['test.md']);
    });
  });

  describe('status', () => {
    it('should return status information', async () => {
      const file1 = path.join(tempDir, 'file1.md');
      const file2 = path.join(tempDir, 'file2.md');

      await fs.writeFile(file1, '# File 1');
      await fs.writeFile(file2, '# File 2');

      await manager.register('file1.md', {
        feature: 'feature-a',
        requirement: 'REQ-001'
      });

      await manager.register('file2.md', {
        feature: 'feature-b',
        requirement: 'REQ-002'
      });

      const status = await manager.status();
      expect(status.total).toBe(2);
      expect(status.active).toBe(2);
      expect(status.old).toBe(0);
    });
  });

  describe('touch', () => {
    it('should update last_modified timestamp', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042'
      });

      // Get initial timestamp
      const before = await manager.list();
      const timestampBefore = before[0].last_modified;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Touch file
      await manager.touch('test.md');

      // Get new timestamp
      const after = await manager.list();
      const timestampAfter = after[0].last_modified;

      expect(new Date(timestampAfter).getTime()).toBeGreaterThan(
        new Date(timestampBefore).getTime()
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup old files', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042'
      });

      // Mock old file
      const registry = await manager.loadRegistry();
      registry.files[0].last_modified = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000
      ).toISOString();
      await manager.saveRegistry(registry);

      const result = await manager.cleanup({ olderThan: '7', force: true });
      expect(result.cleaned).toBe(1);

      // Verify file is no longer in registry
      const files = await manager.list();
      expect(files).toHaveLength(0);
    });

    it('should support dry-run mode', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042'
      });

      // Mock old file
      const registry = await manager.loadRegistry();
      registry.files[0].last_modified = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000
      ).toISOString();
      await manager.saveRegistry(registry);

      const result = await manager.cleanup({ olderThan: '7', dryRun: true });
      expect(result.cleaned).toBe(1);

      // Verify file is still in registry
      const files = await manager.list();
      expect(files).toHaveLength(1);
    });
  });

  describe('checkUntracked', () => {
    it('should check for untracked files', async () => {
      // This test would need to be run in a git repository
      // For now, just test that the method exists and returns correct structure
      const check = await manager.checkUntracked();

      expect(check).toHaveProperty('untracked');
      expect(check).toHaveProperty('wipTracked');
      expect(check).toHaveProperty('notWipTracked');
      expect(check).toHaveProperty('files');
    });
  });

  describe('userid support', () => {
    it('should get userid from git config', async () => {
      const userid = await manager.getUserid();
      expect(userid).toBeDefined();
      expect(typeof userid).toBe('string');
    });

    it('should list files by user', async () => {
      const file1 = path.join(tempDir, 'file1.md');
      const file2 = path.join(tempDir, 'file2.md');

      await fs.writeFile(file1, '# File 1');
      await fs.writeFile(file2, '# File 2');

      await manager.register('file1.md', {
        feature: 'feature-a',
        requirement: 'REQ-001',
        userid: 'alice'
      });

      await manager.register('file2.md', {
        feature: 'feature-b',
        requirement: 'REQ-002',
        userid: 'bob'
      });

      const aliceFiles = await manager.listByUser('alice');
      expect(aliceFiles).toHaveLength(1);
      expect(aliceFiles[0].path).toBe('file1.md');
    });

    it('should get statistics by user', async () => {
      const file1 = path.join(tempDir, 'file1.md');
      const file2 = path.join(tempDir, 'file2.md');
      const file3 = path.join(tempDir, 'file3.md');

      await fs.writeFile(file1, '# File 1');
      await fs.writeFile(file2, '# File 2');
      await fs.writeFile(file3, '# File 3');

      await manager.register('file1.md', {
        feature: 'feature-a',
        requirement: 'REQ-001',
        userid: 'alice'
      });

      await manager.register('file2.md', {
        feature: 'feature-b',
        requirement: 'REQ-002',
        userid: 'bob'
      });

      await manager.register('file3.md', {
        feature: 'feature-c',
        requirement: 'REQ-003',
        userid: 'alice'
      });

      const stats = await manager.getStatsByUser();
      expect(stats.alice.total).toBe(2);
      expect(stats.bob.total).toBe(1);
    });

    it('should reassign file to different user', async () => {
      const testFile = path.join(tempDir, 'test.md');
      await fs.writeFile(testFile, '# Test');

      await manager.register('test.md', {
        feature: 'my-feature',
        requirement: 'REQ-042',
        userid: 'alice'
      });

      const result = await manager.reassign('test.md', 'bob');
      expect(result.reassigned).toBe(true);
      expect(result.oldUserid).toBe('alice');
      expect(result.newUserid).toBe('bob');

      // Verify reassignment
      const files = await manager.list({ userid: 'bob' });
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('test.md');
    });
  });
});
