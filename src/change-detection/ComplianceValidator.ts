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

import { FileChangeDetector } from './FileChangeDetector';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { glob } from 'glob';

interface GitignoreRule {
  name: string;
  description: string;
  requiredPatterns: string[];
}

interface CredentialStorageRule {
  name: string;
  description: string;
  expectedLocations: string[];
  forbiddenLocations: string[];
}

interface PermissionModesRule {
  name: string;
  description: string;
  files: Record<string, number>;
}

interface ComplianceRules {
  gitignore: GitignoreRule;
  credentialStorage: CredentialStorageRule;
  permissionModes: PermissionModesRule;
}

interface Violation {
  rule: string;
  type: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  remediation?: string;
  missingPatterns?: string[];
  path?: string;
  files?: string[];
  actualMode?: string;
  expectedMode?: string;
}

interface Warning {
  rule: string;
  message: string;
  severity: 'info' | 'warning';
}

interface PassedCheck {
  rule: string;
  message: string;
}

interface ComplianceValidatorOptions {
  projectRoot?: string;
  stateFile?: string;
  rules?: ComplianceRules;
}

const COMPLIANCE_RULES: ComplianceRules = {
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
      './',
      './credentials/',
      './.supernal/credentials/'
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
  protected passed: PassedCheck[];
  protected rules: ComplianceRules;
  protected violations: Violation[];
  protected warnings: Warning[];

  constructor(options: ComplianceValidatorOptions = {}) {
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

  async validate(): Promise<{
    compliant: boolean;
    violations: Violation[];
    warnings: Warning[];
    passed: PassedCheck[];
    proof: any;
    timestamp: string;
  }> {
    this.violations = [];
    this.warnings = [];
    this.passed = [];

    await this.validateGitignore();
    await this.validateCredentialStorage();
    await this.validatePermissions();
    await this.validateEncryption();

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

  async validateGitignore(): Promise<void> {
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

    const missingPatterns: string[] = [];
    for (const pattern of this.rules.gitignore.requiredPatterns) {
      const found = lines.some((line) => {
        if (line.startsWith('#')) return false;
        if (line === pattern) return true;
        if (line.includes(pattern)) return true;
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

  async validateCredentialStorage(): Promise<void> {
    const ruleName = this.rules.credentialStorage.name;
    const homeDir = os.homedir();

    const globalCredPath = path.join(homeDir, '.supernal', 'credentials');

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

    const credentialPatterns = ['*.credentials.json', '*.credentials.enc', '*-service-account.json'];
    for (const pattern of credentialPatterns) {
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

  async validatePermissions(): Promise<void> {
    const ruleName = this.rules.permissionModes.name;
    const homeDir = os.homedir();

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
          const actualMode = stats.mode & 0o777;

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
        } catch (_error) {
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

  async validateEncryption(): Promise<void> {
    const ruleName = 'Encryption Configuration';
    const homeDir = os.homedir();

    const keyPath = path.join(homeDir, '.supernal', 'keys', 'credential-key');
    const credPath = path.join(homeDir, '.supernal', 'credentials');

    if (await fs.pathExists(credPath)) {
      if (!(await fs.pathExists(keyPath))) {
        this.violations.push({
          rule: ruleName,
          type: 'missing_encryption_key',
          message: 'Credentials exist but encryption key is missing',
          severity: 'critical',
          remediation: 'Run: sc credentials setup-encryption'
        });
      } else {
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
      this.passed.push({
        rule: ruleName,
        message: 'No credentials configured (encryption not yet needed)'
      });
    }
  }

  async generateComplianceProof(): Promise<any> {
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
      validationHash: this.hashContent(
        JSON.stringify({
          violations: this.violations,
          warnings: this.warnings,
          passed: this.passed
        })
      )
    };
  }

  generateReport(): string {
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

export default ComplianceValidator;
module.exports = ComplianceValidator;
