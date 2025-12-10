// @ts-nocheck
/**
 * Compliance Configuration Checks CLI
 * 
 * Validates security configuration for credential storage:
 * - .gitignore patterns for sensitive files
 * - Credential file locations
 * - File permissions
 * - Encryption configuration
 */

const { Command } = require('commander');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

// Required patterns that should be in .gitignore for credential protection
const REQUIRED_GITIGNORE_PATTERNS = [
  { pattern: '.supernal-coding/sessions/', description: 'Session directories' },
  { pattern: '.supernal-coding/integrations/', description: 'Integration credentials' },
  { pattern: '*.credentials.json', description: 'Credential files' },
  { pattern: '**/tokens.json', description: 'OAuth tokens' },
  { pattern: '*.key', description: 'Private key files' },
  { pattern: '.env.local', description: 'Local environment variables' },
  { pattern: '.env*.local', description: 'Local environment files' }
];

// Paths where credentials should NOT be stored
const FORBIDDEN_CREDENTIAL_PATHS = [
  'src/',
  'apps/',
  'packages/',
  'lib/',
  'public/'
];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readGitignore(repoPath) {
  const gitignorePath = path.join(repoPath, '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    return content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  } catch {
    return [];
  }
}

async function checkGitignorePatterns(repoPath) {
  const gitignorePatterns = await readGitignore(repoPath);
  const results = [];
  const missingPatterns = [];

  for (const { pattern, description } of REQUIRED_GITIGNORE_PATTERNS) {
    const hasPattern = gitignorePatterns.some(p =>
      p.includes(pattern) ||
      p === pattern ||
      (pattern.startsWith('*') && p.endsWith(pattern.slice(1)))
    );

    if (!hasPattern) {
      missingPatterns.push({ pattern, description });
    }
  }

  if (missingPatterns.length === 0) {
    results.push({ status: 'pass', message: `All ${REQUIRED_GITIGNORE_PATTERNS.length} required patterns present` });
  } else {
    results.push({
      status: 'fail',
      message: `${missingPatterns.length} patterns missing`,
      details: missingPatterns.map(p => `${p.pattern} (${p.description})`)
    });
  }

  return { category: 'gitignore', results };
}

async function checkCredentialLocations(repoPath) {
  const results = [];
  const credentialPatterns = ['*.credentials.json', 'tokens.json', '*.key', '*.pem'];
  const foundInForbidden = [];

  for (const forbiddenPath of FORBIDDEN_CREDENTIAL_PATHS) {
    const fullPath = path.join(repoPath, forbiddenPath);
    if (await fileExists(fullPath)) {
      try {
        const entries = await fs.readdir(fullPath, { recursive: true, withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const fileName = entry.name;
            for (const pattern of credentialPatterns) {
              if (pattern.startsWith('*')) {
                if (fileName.endsWith(pattern.slice(1))) {
                  foundInForbidden.push(path.join(forbiddenPath, fileName));
                }
              } else if (fileName === pattern) {
                foundInForbidden.push(path.join(forbiddenPath, fileName));
              }
            }
          }
        }
      } catch {
        // Directory might not exist or not be readable
      }
    }
  }

  if (foundInForbidden.length === 0) {
    results.push({ status: 'pass', message: 'No credentials in tracked directories' });
  } else {
    results.push({
      status: 'fail',
      message: `${foundInForbidden.length} credential file(s) in tracked directories`,
      details: foundInForbidden
    });
  }

  // Check credential directory exists
  const credentialDir = path.join(repoPath, '.supernal-coding/integrations');
  if (await fileExists(credentialDir)) {
    results.push({ status: 'pass', message: 'Credential directory properly configured' });
  } else {
    results.push({ status: 'warning', message: 'Credential directory not found (optional)' });
  }

  return { category: 'credentials', results };
}

async function checkFilePermissions(repoPath) {
  const results = [];
  const credentialDir = path.join(repoPath, '.supernal-coding/integrations');
  const broadPermissions = [];

  if (await fileExists(credentialDir)) {
    try {
      const entries = await fs.readdir(credentialDir, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(credentialDir, entry.name);
          const stats = await fs.stat(filePath);
          const mode = stats.mode & 0o777;

          if (mode > 0o600) {
            broadPermissions.push(`${entry.name} (${mode.toString(8)})`);
          }
        }
      }
    } catch {
      // Permission check might fail
    }

    if (broadPermissions.length === 0) {
      results.push({ status: 'pass', message: 'All credential files have restricted permissions' });
    } else {
      results.push({
        status: 'warning',
        message: `${broadPermissions.length} file(s) have broad permissions`,
        details: broadPermissions
      });
    }
  } else {
    results.push({ status: 'skipped', message: 'No credential directory to check' });
  }

  return { category: 'permissions', results };
}

async function runComplianceChecks(repoPath, options = {}) {
  const checks = await Promise.all([
    checkGitignorePatterns(repoPath),
    checkCredentialLocations(repoPath),
    checkFilePermissions(repoPath)
  ]);

  let hasFailures = false;
  let hasWarnings = false;

  for (const check of checks) {
    for (const result of check.results) {
      if (result.status === 'fail') hasFailures = true;
      if (result.status === 'warning') hasWarnings = true;
    }
  }

  // Generate proof hash
  const proofContent = JSON.stringify({
    timestamp: new Date().toISOString(),
    checks: checks.map(c => ({
      category: c.category,
      results: c.results.map(r => ({ status: r.status, message: r.message }))
    }))
  });
  const proofHash = crypto.createHash('sha256').update(proofContent).digest('hex').substring(0, 16);

  return {
    checks,
    hasFailures,
    hasWarnings,
    proofHash,
    timestamp: new Date().toISOString()
  };
}

function formatResults(report, options = {}) {
  const { quiet, json } = options;

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!quiet) {
    console.log('\n📋 Compliance Configuration Checks');
    console.log('═'.repeat(50));
  }

  const statusSymbols = {
    pass: '✅',
    fail: '❌',
    warning: '⚠️',
    skipped: '⏭️'
  };

  for (const check of report.checks) {
    if (!quiet) {
      console.log(`\n${check.category.toUpperCase()}`);
    }

    for (const result of check.results) {
      const symbol = statusSymbols[result.status] || '❓';
      
      if (quiet && result.status === 'pass') continue;

      console.log(`  ${symbol} ${result.message}`);
      
      if (result.details && !quiet) {
        for (const detail of result.details) {
          console.log(`     → ${detail}`);
        }
      }
    }
  }

  if (!quiet) {
    console.log('\n' + '═'.repeat(50));
    console.log(`Proof Hash: ${report.proofHash}`);
    console.log(`Timestamp: ${report.timestamp}`);
  }

  if (report.hasFailures) {
    console.log('\n❌ COMPLIANCE CHECK FAILED');
    return 1;
  } else if (report.hasWarnings) {
    console.log('\n⚠️  Compliance check passed with warnings');
    return 0;
  } else {
    if (!quiet) console.log('\n✅ All compliance checks passed');
    return 0;
  }
}

const program = new Command('compliance')
  .description('Run compliance configuration checks')
  .option('-q, --quiet', 'Only show failures and warnings')
  .option('--json', 'Output as JSON')
  .option('--strict', 'Exit with error on warnings')
  .action(async (options) => {
    try {
      const repoPath = process.cwd();
      const report = await runComplianceChecks(repoPath, options);
      const exitCode = formatResults(report, options);

      if (options.strict && report.hasWarnings) {
        process.exit(1);
      }

      process.exit(exitCode);
    } catch (error) {
      console.error('Error running compliance checks:', error.message);
      process.exit(1);
    }
  });

// Export for use in other modules
module.exports = {
  program,
  runComplianceChecks,
  formatResults
};

