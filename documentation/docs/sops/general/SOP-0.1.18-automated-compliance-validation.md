---
type: sop
category: ai-technique
sop_id: SOP-0.1.18
title: Automated Compliance Validation
description: Programmatic tests to verify compliance requirements through CLI commands and git hooks
phase: null
group: C. Reference & Standards
part_number: 18
audience: [developers, ai-agents, security, compliance, devops]
read_time: 15
created: 2025-12-05
updated: 2025-12-05
status: active
version: '1.0'
author: Supernal Coding Team
template_source: https://github.com/supernalintelligence/supernal-coding
project_name: '{{PROJECT_NAME}}'
reviewedBy: []
reviewDates: []
related_sops: [SOP-0.1, SOP-3.03, SOP-0.1.12]
prerequisites: []
tags: [compliance, security, automation, git-hooks, testing]
---

# SOP-0.1.18: Automated Compliance Validation

## Purpose

This SOP defines how to implement and use **programmatic compliance tests** that automatically verify security configuration and compliance requirements. By running these tests and passing them, we ensure continuous compliance without manual audits.

## Philosophy: Compliance as Code

Instead of relying on manual checklists and periodic audits, we implement compliance requirements as **executable tests**:

- **Deterministic**: Same inputs always produce same outputs
- **Auditable**: Every check generates a proof hash for traceability
- **Continuous**: Runs on every commit via git hooks
- **Configurable**: Enable/disable checks based on project needs

---

## CLI Commands

### Primary Command: `sc compliance`

```bash
# Run all compliance checks
sc compliance

# Quiet mode - only show failures and warnings
sc compliance --quiet

# JSON output for CI/CD integration
sc compliance --json

# Strict mode - fail on warnings too
sc compliance --strict
```

### Output Example

```
📋 Compliance Configuration Checks
══════════════════════════════════════════════════

GITIGNORE
  ✅ All 7 required patterns present

CREDENTIALS
  ✅ No credentials in tracked directories
  ⚠️ Credential directory not found (optional)

PERMISSIONS
  ⏭️ No credential directory to check

══════════════════════════════════════════════════
Proof Hash: c9acf7f32948c6f1
Timestamp: 2025-12-05T07:29:41.632Z

✅ All compliance checks passed
```

---

## What Gets Validated

### 1. Gitignore Patterns (Required)

Ensures sensitive files are excluded from version control:

| Pattern | Description |
|---------|-------------|
| `.supernal-coding/sessions/` | Session directories |
| `.supernal-coding/integrations/` | Integration credentials |
| `*.credentials.json` | Credential files |
| `**/tokens.json` | OAuth tokens |
| `*.key` | Private key files |
| `.env.local` | Local environment variables |
| `.env*.local` | Local environment files |

**Exit Code**: 1 (fail) if any pattern missing

### 2. Credential Locations

Verifies no credential files exist in tracked directories:

- `src/`
- `apps/`
- `packages/`
- `lib/`
- `public/`

**Exit Code**: 1 (fail) if credentials found in forbidden paths

### 3. File Permissions

Checks that sensitive files have restricted permissions (600):

- Files in `.supernal-coding/integrations/`
- Any `*.key` files
- Any `*.credentials.json` files

**Exit Code**: 0 with warning if permissions too broad

### 4. Encryption Configuration (Optional)

Validates encryption setup if configured:

- `.supernal-coding/encryption.key` exists
- `.supernal-coding/key-rotation.json` exists

**Exit Code**: 0 (skipped) if not configured

---

## Git Hook Integration

### Pre-Commit Hook

The compliance check runs automatically on every commit:

```bash
# In .husky/pre-commit
echo "  🔒 Compliance configuration check..."
sc compliance --quiet
```

### Hook Behavior

| Check Result | Commit Behavior |
|--------------|-----------------|
| All pass | ✅ Commit proceeds |
| Warnings only | ✅ Commit proceeds (with message) |
| Any failure | ❌ Commit blocked |

### Bypass Options

```bash
# Skip compliance check once
SC_SKIP_COMPLIANCE_CHECK=true git commit -m "message"

# Skip all hooks
SC_SKIP_HOOKS=true git commit -m "message"
```

---

## Configuration

### supernal.yaml Settings

```yaml
git_hooks:
  pre_commit:
    checks:
      compliance_check:
        enabled: true                 # Enable/disable the check
        block_on_failures: true       # Block commit on failures
        block_on_warnings: false      # Don't block on warnings
        allow_bypass: true            # Allow SC_SKIP_COMPLIANCE_CHECK
        checks:
          - gitignore_patterns        # Required .gitignore patterns
          - credential_locations      # No creds in src/, apps/, etc.
          - file_permissions          # 600 on sensitive files
          - encryption_config         # Optional encryption setup
  bypass_variables:
    compliance_check: SC_SKIP_COMPLIANCE_CHECK
```

### Dashboard View

The dashboard provides a visual compliance status at:

**Sidebar → Compliance**

Features:
- Category-by-category breakdown
- Pass/fail/warning counts
- Proof document with signature
- Manual "Run Checks" button

---

## Proof of Compliance

Every compliance check generates a **proof document**:

```json
{
  "generatedAt": "2025-12-05T07:29:41.632Z",
  "signature": "sha256:c9acf7f32948c6f17ba9274008014b04...",
  "checksPerformed": 11,
  "checksPassedCount": 9
}
```

This provides:
- **Timestamp**: When the check was run
- **Signature**: SHA-256 hash of check results (tamper-evident)
- **Counts**: Total and passed checks

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run compliance checks
        run: |
          npm install -g @supernal/coding
          sc compliance --strict
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | One or more checks failed |

---

## Adding Custom Checks

To extend compliance validation:

1. **Create check function** in `supernal-code-package/cli/compliance.js`
2. **Return standard result format**:
   ```javascript
   { status: 'pass' | 'fail' | 'warning' | 'skipped', message: string, details?: string[] }
   ```
3. **Register in check runner**
4. **Add to `supernal.yaml` checks list**

---

## Best Practices

### DO:
- Run `sc compliance` before PR reviews
- Enable git hook for continuous compliance
- Review warnings periodically
- Keep proof hashes for audit trail

### DON'T:
- Bypass compliance checks without documented reason
- Disable checks project-wide without security review
- Store credentials in tracked directories
- Use world-readable permissions on sensitive files

---

## Related Documentation

- [SOP-3.03: Compliance Requirements Management](../phase-3-design/SOP-3.03-compliance-requirements.md)
- [SOP-0.1.12: Git Workflow](./SOP-0.1.12-git-workflow.md)
- [Credential Storage Specification](../../architecture/credential-storage-specification.md)
- [Compliance Validation Feature](../../../features/compliance-framework/automated-compliance-validation/README.md)

---

## Quick Reference

```bash
# Check compliance status
sc compliance

# Run with warnings as failures
sc compliance --strict

# Skip during emergency commit
SC_SKIP_COMPLIANCE_CHECK=true git commit -m "emergency fix"

# View in dashboard
# Navigate to: Sidebar → Compliance
```

---

**Last Updated**: 2025-12-05
**Status**: Active
**Owner**: Security & DevOps Team

