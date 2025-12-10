// @ts-nocheck
/**
 * PeopleManager - Manages team contributors and approval permissions
 *
 * Handles CRUD operations on .supernal/people.yaml and provides
 * utilities for GPG verification and approval permission checking.
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { execSync } = require('node:child_process');
const { minimatch } = require('minimatch');

const PEOPLE_FILE = '.supernal/people.yaml';

class PeopleManager {
  peoplePath: any;
  workspaceRoot: any;
  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.peoplePath = path.join(workspaceRoot, PEOPLE_FILE);
  }

  /**
   * Load people.yaml or return default structure
   */
  load() {
    if (!fs.existsSync(this.peoplePath)) {
      return this.getDefaultStructure();
    }

    try {
      const content = fs.readFileSync(this.peoplePath, 'utf8');
      return yaml.load(content) || this.getDefaultStructure();
    } catch (e) {
      console.error(`Error loading ${PEOPLE_FILE}:`, e.message);
      return this.getDefaultStructure();
    }
  }

  /**
   * Save people data to YAML
   */
  save(data) {
    const dir = path.dirname(this.peoplePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    data.updated = new Date().toISOString().split('T')[0];
    const content = yaml.dump(data, { lineWidth: -1, quotingType: '"' });
    fs.writeFileSync(this.peoplePath, content, 'utf8');
  }

  /**
   * Get default people.yaml structure
   */
  getDefaultStructure() {
    return {
      version: '1.0',
      updated: new Date().toISOString().split('T')[0],
      project: {
        name: 'Project Name',
        repository: '',
      },
      roles: {
        owner: {
          description: 'Full project access, can approve all documents',
          permissions: [
            'approve_all',
            'manage_contributors',
            'manage_settings',
          ],
        },
        admin: {
          description: 'Administrative access, can approve most documents',
          permissions: ['approve_controlled', 'manage_contributors'],
        },
        approver: {
          description: 'Can approve documents in their assigned areas',
          permissions: ['approve_assigned'],
        },
        contributor: {
          description: 'Can contribute but not approve',
          permissions: ['contribute'],
        },
      },
      contributors: [],
      approval_rules: {
        controlled_paths: [],
        tracked_paths: [],
      },
    };
  }

  /**
   * List all contributors
   */
  list() {
    const data = this.load();
    const contributors = data.contributors || [];

    // Enrich with GPG status
    return contributors.map((c) => ({
      ...c,
      gpgStatus: this.getGpgStatusForKey(c.gpgKeyId),
    }));
  }

  /**
   * Get a specific contributor by ID or email
   */
  get(idOrEmail) {
    const contributors = this.list();
    return contributors.find(
      (c) => c.id === idOrEmail || c.email === idOrEmail
    );
  }

  /**
   * Add a new contributor
   */
  add(contributor) {
    const data = this.load();
    if (!data.contributors) {
      data.contributors = [];
    }

    // Generate ID if not provided
    if (!contributor.id) {
      contributor.id = this.generateId(contributor.name || contributor.email);
    }

    // Check for duplicates
    const existing = data.contributors.find(
      (c) => c.id === contributor.id || c.email === contributor.email
    );
    if (existing) {
      throw new Error(
        `Contributor with ID "${contributor.id}" or email "${contributor.email}" already exists`
      );
    }

    // Set defaults
    contributor.active = contributor.active !== false;
    contributor.role = contributor.role || 'contributor';
    contributor.canApprove = contributor.canApprove || [];

    data.contributors.push(contributor);
    this.save(data);

    return contributor;
  }

  /**
   * Remove a contributor
   */
  remove(id) {
    const data = this.load();
    const index = data.contributors.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Contributor "${id}" not found`);
    }

    const removed = data.contributors.splice(index, 1)[0];
    this.save(data);

    return removed;
  }

  /**
   * Update a contributor
   */
  update(id, updates) {
    const data = this.load();
    const index = data.contributors.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Contributor "${id}" not found`);
    }

    data.contributors[index] = {
      ...data.contributors[index],
      ...updates,
    };
    this.save(data);

    return data.contributors[index];
  }

  /**
   * Register the current user from git config and GPG
   */
  registerSelf() {
    let name, email, gpgKeyId;

    // Get from git config
    try {
      name = execSync('git config user.name', { encoding: 'utf8' }).trim();
    } catch (_e) {
      throw new Error(
        'Git user.name not configured. Run: git config user.name "Your Name"'
      );
    }

    try {
      email = execSync('git config user.email', { encoding: 'utf8' }).trim();
    } catch (_e) {
      throw new Error(
        'Git user.email not configured. Run: git config user.email "you@example.com"'
      );
    }

    // Get GPG signing key if configured
    try {
      gpgKeyId = execSync('git config user.signingkey', {
        encoding: 'utf8',
      }).trim();
    } catch (_e) {
      // GPG not configured, that's okay
    }

    // Get GitHub username if available
    let github;
    try {
      github = execSync('git config user.github', { encoding: 'utf8' }).trim();
      if (github && !github.startsWith('@')) {
        github = `@${github}`;
      }
    } catch (_e) {
      // Optional
    }

    const contributor = {
      name,
      email,
      github,
      gpgKeyId,
      role: 'contributor',
      active: true,
      canApprove: [],
    };

    // Check if already exists
    const existing = this.get(email);
    if (existing) {
      // Update existing
      return this.update(existing.id, contributor);
    }

    return this.add(contributor);
  }

  /**
   * Get GPG status for all contributors or a specific one
   */
  getGpgStatus(id) {
    const contributors = id ? [this.get(id)].filter(Boolean) : this.list();

    return contributors.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      gpgKeyId: c.gpgKeyId,
      status: this.getGpgStatusForKey(c.gpgKeyId),
    }));
  }

  /**
   * Check GPG status for a specific key ID
   */
  getGpgStatusForKey(keyId) {
    if (!keyId) {
      return 'missing';
    }

    try {
      const result = execSync(`gpg --list-keys ${keyId} 2>/dev/null`, {
        encoding: 'utf8',
      });
      return result ? 'verified' : 'unverified';
    } catch (_e) {
      return 'unverified';
    }
  }

  /**
   * Verify if a contributor's GPG key is on GitHub
   * Note: This requires the gh CLI to be authenticated
   */
  async verifyGitHubKey(id) {
    const contributor = this.get(id);
    if (!contributor) {
      throw new Error(`Contributor "${id}" not found`);
    }

    if (!contributor.gpgKeyId) {
      return {
        contributor: id,
        keyId: null,
        onGitHub: false,
        message: 'No GPG key configured for this contributor',
      };
    }

    // Check if gh CLI is available
    try {
      execSync('which gh', { stdio: 'pipe' });
    } catch (_e) {
      return {
        contributor: id,
        keyId: contributor.gpgKeyId,
        onGitHub: null,
        message: 'GitHub CLI (gh) not installed. Cannot verify.',
      };
    }

    // Try to list GPG keys from GitHub
    try {
      const ghKeys = execSync('gh api user/gpg_keys --jq ".[].key_id"', {
        encoding: 'utf8',
      });
      const keyIds = ghKeys.split('\n').filter(Boolean);
      const isOnGitHub = keyIds.some((k) =>
        contributor.gpgKeyId.toUpperCase().includes(k.toUpperCase())
      );

      return {
        contributor: id,
        keyId: contributor.gpgKeyId,
        onGitHub: isOnGitHub,
        message: isOnGitHub
          ? 'GPG key is registered on GitHub'
          : 'GPG key NOT found on GitHub',
      };
    } catch (e) {
      return {
        contributor: id,
        keyId: contributor.gpgKeyId,
        onGitHub: null,
        message: `Could not verify: ${e.message}`,
      };
    }
  }

  /**
   * Check if a contributor can approve a specific document
   */
  canApprove(contributorId, documentPath) {
    const contributor = this.get(contributorId);
    if (!contributor || !contributor.active) {
      return false;
    }

    // Owners can approve everything
    if (contributor.role === 'owner') {
      return true;
    }

    // Check canApprove patterns
    if (contributor.canApprove && contributor.canApprove.length > 0) {
      return contributor.canApprove.some((pattern) =>
        minimatch(documentPath, pattern, { matchBase: true })
      );
    }

    // Admins can approve controlled docs
    if (contributor.role === 'admin') {
      const data = this.load();
      const controlledPaths = (data.approval_rules?.controlled_paths || []).map(
        (p) => p.pattern
      );
      return controlledPaths.some((pattern) =>
        minimatch(documentPath, pattern, { matchBase: true })
      );
    }

    return false;
  }

  /**
   * Get all contributors who can approve a specific document
   */
  getApproversFor(documentPath) {
    return this.list().filter((c) => this.canApprove(c.id, documentPath));
  }

  /**
   * Generate a URL-safe ID from a name
   */
  generateId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const contributors = this.list();
    const byRole = {};
    let gpgConfigured = 0;

    contributors.forEach((c) => {
      byRole[c.role] = (byRole[c.role] || 0) + 1;
      if (c.gpgKeyId) gpgConfigured++;
    });

    return {
      total: contributors.length,
      active: contributors.filter((c) => c.active).length,
      byRole,
      gpgConfigured,
      gpgVerified: contributors.filter((c) => c.gpgStatus === 'verified')
        .length,
    };
  }
}

module.exports = { PeopleManager };
