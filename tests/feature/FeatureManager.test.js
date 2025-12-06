const fs = require('fs-extra');
const path = require('node:path');
const FeatureManager = require('../../lib/feature/FeatureManager');

describe('FeatureManager', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = path.join(__dirname, '../.tmp/feature-test');
    await fs.ensureDir(tempDir);
    manager = new FeatureManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
  });

  describe('addFeature', () => {
    it('should add a new feature', async () => {
      const feature = await manager.addFeature('my-feature', {
        description: 'Test feature',
        requirements: 'REQ-042,REQ-043',
        owner: 'test@example.com'
      });

      expect(feature.name).toBe('my-feature');
      expect(feature.description).toBe('Test feature');
      expect(feature.requirements).toEqual(['REQ-042', 'REQ-043']);
      expect(feature.owner).toBe('test@example.com');
      expect(feature.status).toBe('in-progress');
    });

    it('should reject invalid feature names', async () => {
      await expect(manager.addFeature('Invalid_Name')).rejects.toThrow(
        'lowercase alphanumeric with hyphens only'
      );
    });

    it('should reject duplicate feature names', async () => {
      await manager.addFeature('my-feature', {
        description: 'Test'
      });

      await expect(
        manager.addFeature('my-feature', {
          description: 'Duplicate'
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('listFeatures', () => {
    it('should list all features', async () => {
      await manager.addFeature('feature-a', {
        description: 'Feature A'
      });

      await manager.addFeature('feature-b', {
        description: 'Feature B'
      });

      const features = await manager.listFeatures();
      expect(features).toHaveLength(2);
      expect(features[0].name).toBe('feature-a');
      expect(features[1].name).toBe('feature-b');
    });

    it('should filter by status', async () => {
      await manager.addFeature('feature-a', {
        description: 'Feature A'
      });

      await manager.addFeature('feature-b', {
        description: 'Feature B'
      });

      // Manually change status of one feature
      const registry = await manager.loadRegistry();
      registry.features[0].status = 'blocked';
      await manager.saveRegistry(registry);

      const inProgress = await manager.listFeatures({ status: 'in-progress' });
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].name).toBe('feature-b');

      const blocked = await manager.listFeatures({ status: 'blocked' });
      expect(blocked).toHaveLength(1);
      expect(blocked[0].name).toBe('feature-a');
    });
  });

  describe('showFeature', () => {
    it('should show feature details', async () => {
      await manager.addFeature('my-feature', {
        description: 'Test feature',
        requirements: 'REQ-042'
      });

      const details = await manager.showFeature('my-feature');
      expect(details.name).toBe('my-feature');
      expect(details.description).toBe('Test feature');
      expect(details.requirements).toEqual(['REQ-042']);
      expect(details.recentCommits).toBeDefined();
    });

    it('should throw error if feature not found', async () => {
      await expect(manager.showFeature('nonexistent')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('completeFeature', () => {
    it('should move feature to completed', async () => {
      await manager.addFeature('my-feature', {
        description: 'Test feature'
      });

      await manager.completeFeature('my-feature');

      // Check active features
      const active = await manager.listFeatures();
      expect(active).toHaveLength(0);

      // Check completed features
      const registry = await manager.loadRegistry();
      expect(registry.completed).toHaveLength(1);
      expect(registry.completed[0].name).toBe('my-feature');
      expect(registry.completed[0].completed).toBeDefined();
    });
  });

  describe('removeFeature', () => {
    it('should remove a feature', async () => {
      await manager.addFeature('my-feature', {
        description: 'Test feature'
      });

      const result = await manager.removeFeature('my-feature');
      expect(result.removed).toBe(true);

      const features = await manager.listFeatures();
      expect(features).toHaveLength(0);
    });

    it('should throw error if feature not found', async () => {
      await expect(manager.removeFeature('nonexistent')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('featureExists', () => {
    it('should check if feature exists', async () => {
      await manager.addFeature('my-feature', {
        description: 'Test'
      });

      const exists = await manager.featureExists('my-feature');
      expect(exists).toBe(true);

      const notExists = await manager.featureExists('nonexistent');
      expect(notExists).toBe(false);
    });
  });

  describe('validateCommitFeatureTag', () => {
    it('should validate commit with valid feature tag', async () => {
      await manager.addFeature('my-feature', {
        description: 'Test'
      });

      const result = await manager.validateCommitFeatureTag(
        '[FEATURE:my-feature] REQ-042: Add functionality'
      );

      expect(result.valid).toBe(true);
      expect(result.hasTag).toBe(true);
      expect(result.featureName).toBe('my-feature');
    });

    it('should reject commit with invalid feature tag', async () => {
      await manager.addFeature('my-feature', {
        description: 'Test'
      });

      const result = await manager.validateCommitFeatureTag(
        '[FEATURE:nonexistent] REQ-042: Add functionality'
      );

      expect(result.valid).toBe(false);
      expect(result.hasTag).toBe(true);
      expect(result.featureName).toBe('nonexistent');
      expect(result.availableFeatures).toBeDefined();
      expect(result.availableFeatures).toContain('my-feature');
    });

    it('should detect missing feature tag', async () => {
      const result = await manager.validateCommitFeatureTag(
        'REQ-042: Add functionality'
      );

      expect(result.valid).toBe(false);
      expect(result.hasTag).toBe(false);
    });
  });

  describe('getFeatureCommits', () => {
    it('should return empty array when no commits', async () => {
      await manager.addFeature('my-feature', {
        description: 'Test'
      });

      const commits = await manager.getFeatureCommits('my-feature');
      expect(commits).toEqual([]);
    });

    // Additional tests would require actual git commits
  });

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      await manager.addFeature('feature-a', {
        description: 'Feature A'
      });

      await manager.addFeature('feature-b', {
        description: 'Feature B'
      });

      await manager.completeFeature('feature-a');

      const stats = await manager.getStatistics();
      expect(stats.active).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.byStatus['in-progress']).toBe(1);
    });
  });
});
