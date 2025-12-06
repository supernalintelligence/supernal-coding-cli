/**
 * ComplianceValidator - Validates security/compliance configurations
 *
 * Extends FileChangeDetector to:
 * - Verify .gitignore contains required patterns
 * - Check credential storage locations are secure
 * - Validate encryption is enabled
 * - Generate compliance proof documents
 *
 * Usage:
 *   const validator = new ComplianceValidator({ projectRoot: '/path/to/project' });
 *   const { compliant, violations, proof } = await validator.validate();
 */

const { FileChangeDetector } = require('./FileChangeDetector');
const fs = require('fs-extra');
const path = require('node:path');
const os = require('node:os');

// Compliance rules - what we're validating
const COMPLIANCE_RULES = {
  gitignore: {
    name: 'Gitignore Security Patterns',
    description: 'Ensures sensitive files are gitignored',
    requiredPatterns: [
      '.env',
      '.env.local',
      '.env*.local',
      '*.pem',
      '*.key',
      '.supernal/session/',
      '.supernal/cache/',
      '.supernal-coding/integrations/',
      '*.credentials.json',
      '*.credentials.enc'
    ]
  },
  credentialStorage: {
    name: 'Credential Storage Location',
    description: 'Verifies credentials are stored outside repo',
    expectedLocations: [
      '~/.supernal/credentials/',
      '~/.supernal/keys/'
    ],
    forbiddenLocations: [
      './', // Project root
      './credentials/',
      './.supernal/credentials/' // Should NOT be in project
    ]
  },
  permissionModes: {
    name: 'File Permission Modes',
    description: 'Verifies sensitive files have restrictive permissions',
    files: {
      '~/.supernal/keys/credential-key': 0o600,
      '~/.supernal/credentials/': 0o700
    }
  }
};

class ComplianceValidator extends FileChangeDetector {
  constructor(options = {}) {
    super({
      ...options,
      name: 'ComplianceValidator',
      stateFile: options.stateFile || '.supernal/compliance-state.json',
      watchPatterns: [
        '.gitignore',
        'supernal.yaml',
        '.supernal-coding/**/*'
      ]
    });

    this.rules = options.rules || COMPLIANCE_RULES;
    this.violations = [];
    this.warnings = [];
    this.passed = [];
  }

  /**
   * Main validation entry point
   * @returns {Promise<Object>} Validation result with proof
   */
  async validate() {
    this.violations = [];
    this.warnings = [];
    this.passed = [];

    // Run all validation checks
    await this.validateGitignore();
    await this.validateCredentialStorage();
    await this.validatePermissions();
    await this.validateEncryption();

    // Generate proof document
    const proof = await this.generateComplianceProof();

    return {
      compliant: this.violations.length === 0,
      violations: this.violations,
      warnings: this.warnings,
      passed: this.passed,
      proof,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate .gitignore contains required security patterns
   */
  async validateGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    const ruleName = this.rules.gitignore.name;

    if (!(await fs.pathExists(gitignorePath))) {
      this.violations.push({
        rule: ruleName,
        type: 'missing_file',
        message: '.gitignore file not found',
        severity: 'critical',
        remediation: 'Create .gitignore with security patterns'
      });
      return;
    }

    const content = await fs.readFile(gitignorePath, 'utf8');
    const lines = content.split('\n').map((l) => l.trim());

    const missingPatterns = [];
    for (const pattern of this.rules.gitignore.requiredPatterns) {
      // Check if pattern or a more general version exists
      const found = lines.some((line) => {
        if (line.startsWith('#')) return false;
        // Exact match
        if (line === pattern) return true;
        // Pattern contains the required pattern
        if (line.includes(pattern)) return true;
        // Wildcard match (e.g., *.env matches .env)
        if (pattern.includes('*')) {
          const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$'
          );
          return regex.test(line);
        }
        return false;
      });

      if (!found) {
        missingPatterns.push(pattern);
      }
    }

    if (missingPatterns.length > 0) {
      this.violations.push({
        rule: ruleName,
        type: 'missing_patterns',
        message: `Missing gitignore patterns: ${missingPatterns.join(', ')}`,
        severity: 'high',
        missingPatterns,
        remediation: `Add the following to .gitignore:\n${missingPatterns.join('\n')}`
      });
    } else {
      this.passed.push({
        rule: ruleName,
        message: 'All required gitignore patterns present'
      });
    }
  }

  /**
   * Validate credential storage is in secure locations
   */
  async validateCredentialStorage() {
    const ruleName = this.rules.credentialStorage.name;
    const homeDir = os.homedir();

    // Check that global credential directory exists (or is expected)
    const globalCredPath = path.join(homeDir, '.supernal', 'credentials');

    // Check for forbidden credential locations in project
    const forbiddenPaths = [
      path.join(this.projectRoot, 'credentials'),
      path.join(this.projectRoot, '.credentials'),
      path.join(this.projectRoot, '.supernal', 'credentials')
    ];

    for (const forbiddenPath of forbiddenPaths) {
      if (await fs.pathExists(forbiddenPath)) {
        this.violations.push({
          rule: ruleName,
          type: 'insecure_location',
          message: `Credentials found in insecure location: ${forbiddenPath}`,
          severity: 'critical',
          path: forbiddenPath,
          remediation: `Move credentials to ${globalCredPath} (outside repository)`
        });
      }
    }

    // Check for credential files in project root
    const credentialPatterns = ['*.credentials.json', '*.credentials.enc', '*-service-account.json'];
    for (const pattern of credentialPatterns) {
      const { glob } = require('glob');
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: ['**/node_modules/**']
      });

      if (matches.length > 0) {
        this.violations.push({
          rule: ruleName,
          type: 'credential_in_repo',
          message: `Credential file(s) found in repository: ${matches.join(', ')}`,
          severity: 'critical',
          files: matches,
          remediation: 'Move credential files outside the repository'
        });
      }
    }

    if (this.violations.filter((v) => v.rule === ruleName).length === 0) {
      this.passed.push({
        rule: ruleName,
        message: 'No credentials found in insecure locations'
      });
    }
  }

  /**
   * Validate file permissions on sensitive files
   */
  async validatePermissions() {
    const ruleName = this.rules.permissionModes.name;
    const homeDir = os.homedir();

    // Only check on Unix-like systems
    if (process.platform === 'win32') {
      this.warnings.push({
        rule: ruleName,
        message: 'Permission checks not supported on Windows',
        severity: 'info'
      });
      return;
    }

    const filesToCheck = [
      {
        path: path.join(homeDir, '.supernal', 'keys', 'credential-key'),
        expectedMode: 0o600,
        description: 'Encryption key'
      },
      {
        path: path.join(homeDir, '.supernal', 'credentials'),
        expectedMode: 0o700,
        description: 'Credentials directory'
      }
    ];

    for (const { path: filePath, expectedMode, description } of filesToCheck) {
      if (await fs.pathExists(filePath)) {
        try {
          const stats = await fs.stat(filePath);
          const actualMode = stats.mode & 0o777; // Get permission bits only

          if (actualMode !== expectedMode) {
            this.violations.push({
              rule: ruleName,
              type: 'insecure_permissions',
              message: `${description} has insecure permissions: ${actualMode.toString(8)} (expected ${expectedMode.toString(8)})`,
              severity: 'high',
              path: filePath,
              actualMode: actualMode.toString(8),
              expectedMode: expectedMode.toString(8),
              remediation: `Run: chmod ${expectedMode.toString(8)} "${filePath}"`
            });
          }
        } catch (error) {
          // Can't check permissions - might be okay
        }
      }
    }

    if (this.violations.filter((v) => v.rule === ruleName).length === 0) {
      this.passed.push({
        rule: ruleName,
        message: 'File permissions are correctly restrictive'
      });
    }
  }

  /**
   * Validate encryption settings
   */
  async validateEncryption() {
    const ruleName = 'Encryption Configuration';
    const homeDir = os.homedir();

    // Check if encryption key exists (if credentials exist)
    const keyPath = path.join(homeDir, '.supernal', 'keys', 'credential-key');
    const credPath = path.join(homeDir, '.supernal', 'credentials');

    if (await fs.pathExists(credPath)) {
      // Credentials exist, key should exist
      if (!(await fs.pathExists(keyPath))) {
        this.violations.push({
          rule: ruleName,
          type: 'missing_encryption_key',
          message: 'Credentials exist but encryption key is missing',
          severity: 'critical',
          remediation: 'Run: sc credentials setup-encryption'
        });
      } else {
        // Check key file is not empty
        const keyStats = await fs.stat(keyPath);
        if (keyStats.size < 32) {
          this.violations.push({
            rule: ruleName,
            type: 'invalid_encryption_key',
            message: 'Encryption key appears invalid (too small)',
            severity: 'critical',
            remediation: 'Run: sc credentials regenerate-key'
          });
        } else {
          this.passed.push({
            rule: ruleName,
            message: 'Encryption key present and valid'
          });
        }
      }
    } else {
      // No credentials yet - that's fine
      this.passed.push({
        rule: ruleName,
        message: 'No credentials configured (encryption not yet needed)'
      });
    }
  }

  /**
   * Generate compliance proof document
   * @returns {Object} Proof document
   */
  async generateComplianceProof() {
    const fileProof = await this.generateProofDocument();

    return {
      ...fileProof,
      type: 'compliance-validation-proof',
      validation: {
        compliant: this.violations.length === 0,
        violationCount: this.violations.length,
        warningCount: this.warnings.length,
        passedCount: this.passed.length,
        violations: this.violations,
        warnings: this.warnings,
        passed: this.passed
      },
      rules: Object.keys(this.rules).map((key) => ({
        id: key,
        name: this.rules[key].name,
        description: this.rules[key].description
      })),
      // Hash of the validation result for verification
      validationHash: this.hashContent(
        JSON.stringify({
          violations: this.violations,
          warnings: this.warnings,
          passed: this.passed
        })
      )
    };
  }

  /**
   * Generate human-readable report
   * @returns {string} Markdown report
   */
  generateReport() {
    const lines = [
      '# Compliance Validation Report',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Project:** ${this.projectRoot}`,
      '',
      `## Summary`,
      '',
      `| Status | Count |`,
      `|--------|-------|`,
      `| Passed | ${this.passed.length} |`,
      `| Warnings | ${this.warnings.length} |`,
      `| Violations | ${this.violations.length} |`,
      '',
      `**Overall:** ${this.violations.length === 0 ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`,
      ''
    ];

    if (this.violations.length > 0) {
      lines.push('## Violations', '');
      for (const v of this.violations) {
        lines.push(`### ${v.rule}`);
        lines.push(`- **Type:** ${v.type}`);
        lines.push(`- **Severity:** ${v.severity}`);
        lines.push(`- **Message:** ${v.message}`);
        if (v.remediation) {
          lines.push(`- **Remediation:** ${v.remediation}`);
        }
        lines.push('');
      }
    }

    if (this.warnings.length > 0) {
      lines.push('## Warnings', '');
      for (const w of this.warnings) {
        lines.push(`- **${w.rule}:** ${w.message}`);
      }
      lines.push('');
    }

    if (this.passed.length > 0) {
      lines.push('## Passed Checks', '');
      for (const p of this.passed) {
        lines.push(`- ✅ **${p.rule}:** ${p.message}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

module.exports = ComplianceValidator;

