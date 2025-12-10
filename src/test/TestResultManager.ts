// @ts-nocheck
const fs = require('node:fs');
const path = require('node:path');
const { execSync, _spawn } = require('node:child_process');
const chalk = require('chalk');

class TestResultManager {
  config: any;
  indexFile: any;
  resultsDir: any;
  constructor(config = {}) {
    this.resultsDir = config.path || '.supernal/test-results';
    this.indexFile = path.join(this.resultsDir, 'index.json');
    this.config = {
      retentionDays: config.retention_days || 30,
      saveStdoutOnPass: config.save_stdout_on_pass || false,
      maxResults: config.max_results || 1000,
      ...config
    };
  }

  loadConfig() {
    // Load from supernal.yaml if available
    try {
      const yaml = require('yaml');
      const configPath = path.join(process.cwd(), 'supernal.yaml');
      if (fs.existsSync(configPath)) {
        const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.test_results) {
          Object.assign(this.config, config.test_results);
        }
      }
    } catch {
      /* use defaults */
    }
  }

  ensureDir() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
    if (!fs.existsSync(this.indexFile)) {
      fs.writeFileSync(
        this.indexFile,
        JSON.stringify({ results: [] }, null, 2)
      );
    }
  }

  generateId() {
    const date = new Date().toISOString().split('T')[0];
    const index = this.getIndex();
    const todayCount =
      index.results.filter((r) => r.id.includes(date)).length + 1;
    return `test-${date}-${String(todayCount).padStart(3, '0')}`;
  }

  getIndex() {
    this.ensureDir();
    return JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
  }

  saveIndex(index) {
    fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
  }

  getGitInfo() {
    try {
      const branch = execSync('git branch --show-current', {
        encoding: 'utf8'
      }).trim();
      const commit = execSync('git rev-parse --short HEAD', {
        encoding: 'utf8'
      }).trim();
      const user = execSync('git config user.name', {
        encoding: 'utf8'
      }).trim();
      return { branch, commit, user };
    } catch {
      return { branch: 'unknown', commit: 'unknown', user: 'unknown' };
    }
  }

  async run(command, options = {}) {
    this.ensureDir();

    const id = this.generateId();
    const startTime = Date.now();
    const gitInfo = this.getGitInfo();

    console.log(chalk.blue(`📋 Test ID: ${id}`));
    console.log(chalk.gray(`   Command: ${command}`));
    console.log(chalk.gray(`   Branch: ${gitInfo.branch} @ ${gitInfo.commit}`));
    console.log('');

    let exitCode = 0;
    let stdout = '';
    let stderr = '';

    try {
      // Execute command and capture output
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });
      stdout = result;
    } catch (error) {
      exitCode = error.status || 1;
      stdout = error.stdout || '';
      stderr = error.stderr || '';
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Determine if this is compliance evidence
    const isCompliance = this.isComplianceEvidence(options);

    // Create result record
    const result = {
      id,
      command,
      timestamp: new Date().toISOString(),
      exit_code: exitCode,
      duration_ms: duration,
      executor: gitInfo.user,
      git_branch: gitInfo.branch,
      git_commit: gitInfo.commit,
      requirement_id: options.req || null,
      feature: options.feature || null,
      passed: exitCode === 0,
      is_compliance_evidence: isCompliance,
      evidence_reason: isCompliance
        ? this.getComplianceReason(options, gitInfo)
        : null
    };

    // Save detailed log file (respect verbosity config)
    const logFile = path.join(this.resultsDir, `${id}.json`);
    const shouldSaveOutput =
      exitCode !== 0 || this.config.saveStdoutOnPass || options.verbose;
    const detailedResult = {
      ...result,
      stdout: shouldSaveOutput
        ? stdout.substring(0, 50000)
        : '[output not saved - test passed]',
      stderr: shouldSaveOutput ? stderr.substring(0, 10000) : ''
    };
    fs.writeFileSync(logFile, JSON.stringify(detailedResult, null, 2));

    // Auto-cleanup old routine results (compliance evidence never auto-deleted)
    this.cleanupRoutine();

    // Update index
    const index = this.getIndex();
    index.results.push(result);
    this.saveIndex(index);

    // Print result
    console.log('');
    if (exitCode === 0) {
      console.log(chalk.green(`✅ Test passed in ${duration}ms`));
    } else {
      console.log(chalk.red(`❌ Test failed with exit code ${exitCode}`));
    }
    console.log(chalk.cyan(`📄 Result logged: ${logFile}`));

    return result;
  }

  list(options = {}) {
    const index = this.getIndex();
    let results = index.results;

    if (options.since) {
      const since = new Date(options.since);
      results = results.filter((r) => new Date(r.timestamp) >= since);
    }

    if (options.req) {
      results = results.filter((r) => r.requirement_id === options.req);
    }

    if (results.length === 0) {
      console.log(chalk.yellow('No test results found'));
      return [];
    }

    console.log(chalk.bold(`\n📊 Test Results (${results.length})\n`));
    console.log('─'.repeat(100));
    console.log(
      chalk.gray('ID'.padEnd(22)) +
        chalk.gray('Status'.padEnd(8)) +
        chalk.gray('Duration'.padEnd(10)) +
        chalk.gray('Branch'.padEnd(20)) +
        chalk.gray('Command')
    );
    console.log('─'.repeat(100));

    for (const r of results.slice(-20)) {
      // Last 20
      const status = r.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(
        chalk.white(r.id.padEnd(22)) +
          status.padEnd(8) +
          chalk.gray(`${r.duration_ms}ms`.padEnd(10)) +
          chalk.cyan(r.git_branch.substring(0, 18).padEnd(20)) +
          chalk.gray(r.command.substring(0, 40))
      );
    }
    console.log('─'.repeat(100));

    return results;
  }

  show(id) {
    const logFile = path.join(this.resultsDir, `${id}.json`);
    if (!fs.existsSync(logFile)) {
      console.log(chalk.red(`Test result not found: ${id}`));
      return null;
    }

    const result = JSON.parse(fs.readFileSync(logFile, 'utf8'));

    console.log(chalk.bold(`\n📋 Test Result: ${id}\n`));
    console.log(`Command:     ${result.command}`);
    console.log(`Timestamp:   ${result.timestamp}`);
    console.log(`Exit Code:   ${result.exit_code}`);
    console.log(`Duration:    ${result.duration_ms}ms`);
    console.log(`Executor:    ${result.executor}`);
    console.log(`Branch:      ${result.git_branch}`);
    console.log(`Commit:      ${result.git_commit}`);
    if (result.requirement_id) {
      console.log(`Requirement: ${result.requirement_id}`);
    }
    if (result.feature) {
      console.log(`Feature:     ${result.feature}`);
    }

    return result;
  }

  getUrl(id) {
    const logFile = path.join(this.resultsDir, `${id}.json`);
    if (!fs.existsSync(logFile)) {
      console.log(chalk.red(`Test result not found: ${id}`));
      return null;
    }

    const absolutePath = path.resolve(logFile);
    console.log(absolutePath);
    return absolutePath;
  }

  export(options = {}) {
    const index = this.getIndex();
    let results = index.results;

    if (options.since) {
      const since = new Date(options.since);
      results = results.filter((r) => new Date(r.timestamp) >= since);
    }

    const exportFile = path.join(
      this.resultsDir,
      `export-${new Date().toISOString().split('T')[0]}.json`
    );

    fs.writeFileSync(
      exportFile,
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          count: results.length,
          results
        },
        null,
        2
      )
    );

    console.log(
      chalk.green(`✅ Exported ${results.length} results to ${exportFile}`)
    );
    return exportFile;
  }

  /**
   * Auto-cleanup old ROUTINE results only
   * COMPLIANCE EVIDENCE IS NEVER AUTO-DELETED
   */
  cleanupRoutine() {
    const index = this.getIndex();
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - (this.config.retention?.routine?.days || 30)
    );

    // Only cleanup NON-compliance results
    const toDelete = index.results.filter(
      (r) => new Date(r.timestamp) < cutoffDate && !r.is_compliance_evidence // CRITICAL: Never delete compliance evidence
    );

    if (toDelete.length === 0) return;

    for (const result of toDelete) {
      const logFile = path.join(this.resultsDir, `${result.id}.json`);
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
      }
    }

    index.results = index.results.filter(
      (r) => new Date(r.timestamp) >= cutoffDate || r.is_compliance_evidence
    );

    // Enforce max for routine only
    const routineResults = index.results.filter(
      (r) => !r.is_compliance_evidence
    );
    const maxRoutine = this.config.retention?.routine?.max_count || 1000;

    if (routineResults.length > maxRoutine) {
      const excess = routineResults.slice(
        0,
        routineResults.length - maxRoutine
      );
      for (const result of excess) {
        const logFile = path.join(this.resultsDir, `${result.id}.json`);
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
        const idx = index.results.findIndex((r) => r.id === result.id);
        if (idx >= 0) index.results.splice(idx, 1);
      }
    }

    this.saveIndex(index);

    if (toDelete.length > 0) {
      console.log(
        chalk.gray(`Cleaned up ${toDelete.length} routine test results`)
      );
    }
  }

  /**
   * Determine if test run should be compliance evidence
   */
  isComplianceEvidence(options) {
    // Explicit flags
    if (options.compliance || options.evidence) return true;

    // Requirement linked
    if (options.req) return true;

    // Release/main branch
    const gitInfo = this.getGitInfo();
    if (gitInfo.branch === 'main') return true;
    if (gitInfo.branch.startsWith('release/')) return true;

    return false;
  }

  /**
   * Get reason why test is compliance evidence (for audit trail)
   */
  getComplianceReason(options, gitInfo) {
    const reasons = [];
    if (options.compliance) reasons.push('explicit --compliance flag');
    if (options.evidence) reasons.push('explicit --evidence flag');
    if (options.req) reasons.push(`linked to ${options.req}`);
    if (gitInfo.branch === 'main') reasons.push('main branch');
    if (gitInfo.branch.startsWith('release/'))
      reasons.push(`release branch (${gitInfo.branch})`);
    return reasons.join(', ');
  }

  /**
   * Manual compliance evidence cleanup (requires --confirm)
   * USE WITH EXTREME CAUTION - may violate compliance requirements
   */
  cleanupEvidence(options) {
    if (!options.confirm) {
      console.log(
        chalk.red('ERROR: Deleting compliance evidence requires --confirm flag')
      );
      console.log(
        chalk.yellow('WARNING: This may violate regulatory requirements!')
      );
      console.log(
        chalk.yellow('         Consult compliance officer before proceeding.')
      );
      console.log('');
      console.log(
        'Usage: sc test evidence cleanup --before 2024-01-01 --confirm'
      );
      return;
    }

    if (!options.before) {
      console.log(chalk.red('ERROR: Must specify --before <date> for safety'));
      return;
    }

    const beforeDate = new Date(options.before);
    const index = this.getIndex();

    const toDelete = index.results.filter(
      (r) => r.is_compliance_evidence && new Date(r.timestamp) < beforeDate
    );

    console.log(
      chalk.yellow(
        `\nWARNING: About to delete ${toDelete.length} compliance evidence records`
      )
    );
    console.log(chalk.yellow(`Before: ${options.before}`));
    console.log(
      chalk.red(
        '\nThis action cannot be undone and may violate compliance requirements.\n'
      )
    );

    // Actually delete
    for (const result of toDelete) {
      const logFile = path.join(this.resultsDir, `${result.id}.json`);
      if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    }

    index.results = index.results.filter(
      (r) => !r.is_compliance_evidence || new Date(r.timestamp) >= beforeDate
    );
    this.saveIndex(index);

    console.log(
      chalk.green(`Deleted ${toDelete.length} compliance evidence records`)
    );
    console.log(
      chalk.yellow('REMINDER: Document this cleanup in your compliance records')
    );
  }

  /**
   * Phase 2: Invalidate a test result
   */
  invalidate(id, options = {}) {
    const index = this.getIndex();
    const result = index.results.find((r) => r.id === id);

    if (!result) {
      console.log(chalk.red(`Test result not found: ${id}`));
      return null;
    }

    if (result.valid === false) {
      console.log(chalk.yellow(`Test result already invalidated: ${id}`));
      return result;
    }

    result.valid = false;
    result.invalidated_at = new Date().toISOString();
    result.invalidated_reason = options.reason || 'Manually invalidated';
    if (options.supersededBy) {
      result.superseded_by = options.supersededBy;
    }

    this.saveIndex(index);

    // Also update the detailed log file
    const logFile = path.join(this.resultsDir, `${id}.json`);
    if (fs.existsSync(logFile)) {
      const detailed = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      detailed.valid = false;
      detailed.invalidated_at = result.invalidated_at;
      detailed.invalidated_reason = result.invalidated_reason;
      if (options.supersededBy) {
        detailed.superseded_by = options.supersededBy;
      }
      fs.writeFileSync(logFile, JSON.stringify(detailed, null, 2));
    }

    console.log(chalk.yellow(`Invalidated test result: ${id}`));
    console.log(chalk.gray(`  Reason: ${result.invalidated_reason}`));
    if (options.supersededBy) {
      console.log(chalk.gray(`  Superseded by: ${options.supersededBy}`));
    }

    return result;
  }

  /**
   * Phase 2: Supersede one test result with another
   */
  supersede(oldId, newId) {
    const index = this.getIndex();
    const oldResult = index.results.find((r) => r.id === oldId);
    const newResult = index.results.find((r) => r.id === newId);

    if (!oldResult) {
      console.log(chalk.red(`Old test result not found: ${oldId}`));
      return null;
    }

    if (!newResult) {
      console.log(chalk.red(`New test result not found: ${newId}`));
      return null;
    }

    return this.invalidate(oldId, {
      reason: `Superseded by ${newId}`,
      supersededBy: newId
    });
  }

  /**
   * Phase 2: Check validity of test results
   * Detects stale results where command or context may have changed
   */
  checkValidity(options = {}) {
    const index = this.getIndex();
    const staleResults = [];
    const validResults = [];

    for (const result of index.results) {
      // Skip already invalidated
      if (result.valid === false) continue;

      const issues = [];

      // Check if commit still exists
      try {
        execSync(`git cat-file -e ${result.git_commit}^{commit}`, {
          stdio: 'ignore'
        });
      } catch {
        issues.push(`Commit ${result.git_commit} no longer exists`);
      }

      // Check if on different branch now (warning, not invalidation)
      const currentBranch = this.getGitInfo().branch;
      if (result.git_branch !== currentBranch && options.strict) {
        issues.push(
          `Branch changed: was ${result.git_branch}, now ${currentBranch}`
        );
      }

      // Check age for routine tests
      if (!result.is_compliance_evidence) {
        const ageInDays =
          (Date.now() - new Date(result.timestamp)) / (1000 * 60 * 60 * 24);
        if (ageInDays > 30) {
          issues.push(`Routine test is ${Math.floor(ageInDays)} days old`);
        }
      }

      if (issues.length > 0) {
        staleResults.push({ result, issues });
      } else {
        validResults.push(result);
      }
    }

    // Display results
    console.log(chalk.bold('\nTest Result Validity Check\n'));
    console.log('─'.repeat(80));

    if (staleResults.length === 0) {
      console.log(chalk.green('✓ All test results appear valid'));
    } else {
      console.log(
        chalk.yellow(
          `⚠️  Found ${staleResults.length} potentially stale results:\n`
        )
      );

      for (const { result, issues } of staleResults) {
        console.log(chalk.white(`  ${result.id}`));
        console.log(
          chalk.gray(`    Command: ${result.command.substring(0, 50)}`)
        );
        for (const issue of issues) {
          console.log(chalk.yellow(`    ⚠️  ${issue}`));
        }
        console.log('');
      }

      console.log(chalk.cyan('\nTo invalidate stale results:'));
      console.log(
        chalk.gray(`  sc test invalidate <id> --reason "Test file changed"`)
      );
    }

    console.log('─'.repeat(80));
    console.log(
      chalk.gray(
        `Valid: ${validResults.length} | Stale: ${staleResults.length} | Total: ${index.results.length}`
      )
    );

    return { valid: validResults, stale: staleResults };
  }

  /**
   * List only valid (not invalidated) results
   */
  listValid(options = {}) {
    const originalOptions = { ...options };
    const index = this.getIndex();

    // Filter to only valid results
    const validResults = index.results.filter((r) => r.valid !== false);

    // Temporarily replace index results
    const originalResults = index.results;
    index.results = validResults;
    this.saveIndex(index);

    // Call normal list
    this.list(originalOptions);

    // Restore
    index.results = originalResults;
    this.saveIndex(index);
  }
}

module.exports = TestResultManager;
