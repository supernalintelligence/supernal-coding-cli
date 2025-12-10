/**
 * Coverage Manager
 * Core logic for external coverage tool integration
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import chalk from 'chalk';
import * as yaml from 'js-yaml';

import type {
  CoverageConfig,
  CoverageStack,
  CoverageTool,
  CoverageThresholds,
  CoverageInitOptions,
  CoverageRunOptions,
  CoverageCheckOptions,
  CoverageValidationResult,
  CoverageRunResult,
  ThresholdCheckResult,
  StackDetectionResult,
  ValidationCheck,
} from './types';

/** Default coverage thresholds */
const DEFAULT_THRESHOLDS: CoverageThresholds = {
  line: 80,
  branch: 70,
  function: 80,
  statement: 80,
};

/** Starter thresholds for new projects */
const STARTER_THRESHOLDS: CoverageThresholds = {
  line: 60,
  branch: 50,
  function: 60,
  statement: 60,
};

/**
 * Coverage Manager class
 * Handles coverage tool configuration, validation, and execution
 */
export class CoverageManager {
  private projectRoot: string;
  private configPath: string;
  private supernalDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.supernalDir = path.join(projectRoot, '.supernal');
    this.configPath = path.join(this.supernalDir, 'coverage.yaml');
  }

  /**
   * Initialize coverage configuration for the project
   */
  async init(options: CoverageInitOptions = {}): Promise<void> {
    console.log(chalk.blue('🔧 Initializing coverage configuration...\n'));

    // Check for existing config
    if (fs.existsSync(this.configPath) && !options.force) {
      console.log(chalk.yellow('⚠️  Coverage configuration already exists'));
      console.log(chalk.gray(`   ${this.configPath}`));
      console.log(chalk.gray('\n   Use --force to overwrite\n'));
      return;
    }

    // Detect stack
    const detection = this.detectStack();
    const stack = options.stack === 'auto' || !options.stack 
      ? detection.detected 
      : options.stack;
    const tool = options.tool === 'auto' || !options.tool
      ? detection.suggestedTool
      : options.tool;

    console.log(chalk.green(`✅ Stack: ${stack}`));
    if (detection.confidence !== 'high') {
      console.log(chalk.gray(`   Confidence: ${detection.confidence}`));
      console.log(chalk.gray(`   Indicators: ${detection.indicators.join(', ')}`));
    }
    console.log(chalk.green(`✅ Tool: ${tool}\n`));

    // Build configuration
    const config: CoverageConfig = {
      stack,
      collection: {
        tool,
        include: this.getDefaultIncludes(stack),
        exclude: this.getDefaultExcludes(stack),
      },
      thresholds: {
        line: options.minLine ?? STARTER_THRESHOLDS.line,
        branch: options.minBranch ?? STARTER_THRESHOLDS.branch,
        function: options.minFunction ?? STARTER_THRESHOLDS.function,
        statement: STARTER_THRESHOLDS.statement,
      },
      reporting: {
        service: 'none',
      },
      enforcement: {
        preCommit: false,
        prePush: false,
        ciRequired: false,
      },
    };

    if (options.dryRun) {
      console.log(chalk.blue('📋 Configuration (dry-run):\n'));
      console.log(yaml.dump({ coverage: config }));
      return;
    }

    // Ensure .supernal directory exists
    if (!fs.existsSync(this.supernalDir)) {
      fs.mkdirSync(this.supernalDir, { recursive: true });
    }

    // Write configuration
    const yamlContent = yaml.dump({ coverage: config }, { 
      lineWidth: 100,
      noRefs: true,
    });
    fs.writeFileSync(this.configPath, yamlContent);
    console.log(chalk.green(`✅ Created: ${this.configPath}\n`));

    // Show next steps
    this.showNextSteps(tool);
  }

  /**
   * Validate coverage installation and configuration
   */
  async validate(): Promise<CoverageValidationResult> {
    const checks: ValidationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Check config file exists
    const configExists = fs.existsSync(this.configPath);
    checks.push({
      name: 'Configuration file',
      passed: configExists,
      message: configExists 
        ? `Found: ${this.configPath}` 
        : 'Not found',
      suggestion: configExists ? undefined : 'Run: sc coverage init',
    });

    if (!configExists) {
      return this.buildValidationResult(checks, warnings, ['Configuration not found']);
    }

    // 2. Load and parse config
    let config: CoverageConfig;
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = yaml.load(content) as { coverage: CoverageConfig };
      config = parsed.coverage;
      checks.push({
        name: 'Configuration parsing',
        passed: true,
        message: 'Valid YAML',
      });
    } catch (error) {
      errors.push(`Invalid configuration: ${(error as Error).message}`);
      return this.buildValidationResult(checks, warnings, errors);
    }

    // 3. Detect stack and compare
    const detection = this.detectStack();
    const stackMatch = config.stack === detection.detected || config.stack === 'auto';
    checks.push({
      name: 'Stack detection',
      passed: stackMatch,
      message: stackMatch 
        ? `Configured: ${config.stack}, Detected: ${detection.detected}` 
        : `Mismatch: configured ${config.stack}, detected ${detection.detected}`,
      suggestion: stackMatch ? undefined : `Update stack in ${this.configPath}`,
    });

    // 4. Check coverage tool installed
    const toolCheck = this.checkToolInstalled(config.collection.tool);
    checks.push({
      name: 'Coverage tool',
      passed: toolCheck.installed,
      message: toolCheck.installed 
        ? `${config.collection.tool} ${toolCheck.version || ''}` 
        : `${config.collection.tool} not installed`,
      suggestion: toolCheck.installed ? undefined : toolCheck.installCommand,
    });

    // 5. Check coverage provider installed
    const providerCheck = this.checkProviderInstalled(config.collection.tool);
    checks.push({
      name: 'Coverage provider',
      passed: providerCheck.installed,
      message: providerCheck.installed 
        ? `${providerCheck.name} ${providerCheck.version || ''}` 
        : `${providerCheck.name} not installed`,
      suggestion: providerCheck.installed ? undefined : providerCheck.installCommand,
    });

    // 6. Check tool config file
    const toolConfigCheck = this.checkToolConfig(config.collection.tool);
    checks.push({
      name: 'Tool configuration',
      passed: toolConfigCheck.exists,
      message: toolConfigCheck.exists 
        ? `Found: ${toolConfigCheck.path}` 
        : 'Tool config not found',
      suggestion: toolConfigCheck.exists ? undefined : 'Configure coverage in tool config file',
    });

    // 7. Check reporting token if service configured
    if (config.reporting.service !== 'none') {
      const tokenEnv = config.reporting.tokenEnv || `${config.reporting.service.toUpperCase()}_TOKEN`;
      const tokenSet = !!process.env[tokenEnv];
      
      if (!tokenSet) {
        warnings.push(`${tokenEnv} not set (upload will fail in CI)`);
      }
      
      checks.push({
        name: 'Reporting token',
        passed: tokenSet,
        message: tokenSet ? `${tokenEnv} is set` : `${tokenEnv} not set`,
        suggestion: tokenSet ? undefined : `Set ${tokenEnv} environment variable`,
      });
    }

    // Determine overall validity
    const hasErrors = checks.some(c => !c.passed && !c.suggestion?.includes('optional'));
    if (hasErrors) {
      errors.push('Some required checks failed');
    }

    return this.buildValidationResult(checks, warnings, errors, config, detection);
  }

  /**
   * Run tests with coverage collection
   */
  async run(options: CoverageRunOptions = {}): Promise<CoverageRunResult> {
    const config = this.loadConfig();
    if (!config) {
      return {
        success: false,
        exitCode: 1,
        outputDir: '',
        duration: 0,
        error: 'Coverage not configured. Run: sc coverage init',
      };
    }

    const startTime = Date.now();
    const coverageDir = path.join(this.projectRoot, 'coverage');

    if (!options.quiet) {
      console.log(chalk.blue('🧪 Running tests with coverage...\n'));
    }

    try {
      const command = this.buildCoverageCommand(config, options);
      
      if (options.verbose) {
        console.log(chalk.gray(`Command: ${command}\n`));
      }

      execSync(command, {
        cwd: this.projectRoot,
        stdio: options.quiet ? 'pipe' : 'inherit',
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
      });

      const duration = Date.now() - startTime;

      if (!options.quiet) {
        console.log(chalk.green(`\n✅ Coverage complete (${duration}ms)`));
        console.log(chalk.gray(`   Output: ${coverageDir}`));
      }

      // If --check flag, validate thresholds
      if (options.check) {
        const checkResult = await this.check({});
        if (!checkResult.passed) {
          return {
            success: false,
            exitCode: 1,
            outputDir: coverageDir,
            duration,
            error: 'Coverage thresholds not met',
          };
        }
      }

      return {
        success: true,
        exitCode: 0,
        outputDir: coverageDir,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        exitCode: 1,
        outputDir: coverageDir,
        duration,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check coverage against thresholds
   */
  async check(options: CoverageCheckOptions = {}): Promise<ThresholdCheckResult> {
    const config = this.loadConfig();
    const thresholds = {
      line: options.minLine ?? config?.thresholds.line ?? DEFAULT_THRESHOLDS.line,
      branch: options.minBranch ?? config?.thresholds.branch ?? DEFAULT_THRESHOLDS.branch,
      function: options.minFunction ?? config?.thresholds.function ?? DEFAULT_THRESHOLDS.function,
      statement: options.minStatement ?? config?.thresholds.statement ?? DEFAULT_THRESHOLDS.statement,
    };

    // Try to read coverage summary
    const summaryPath = path.join(this.projectRoot, 'coverage', 'coverage-summary.json');
    if (!fs.existsSync(summaryPath)) {
      console.log(chalk.yellow('⚠️  No coverage data found'));
      console.log(chalk.gray('   Run: sc coverage run'));
      return {
        passed: false,
        details: [],
      };
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    const totals = summary.total;

    const details = [
      {
        metric: 'line' as keyof CoverageThresholds,
        actual: totals.lines.pct,
        threshold: thresholds.line,
        passed: totals.lines.pct >= thresholds.line,
      },
      {
        metric: 'branch' as keyof CoverageThresholds,
        actual: totals.branches.pct,
        threshold: thresholds.branch,
        passed: totals.branches.pct >= thresholds.branch,
      },
      {
        metric: 'function' as keyof CoverageThresholds,
        actual: totals.functions.pct,
        threshold: thresholds.function,
        passed: totals.functions.pct >= thresholds.function,
      },
      {
        metric: 'statement' as keyof CoverageThresholds,
        actual: totals.statements.pct,
        threshold: thresholds.statement,
        passed: totals.statements.pct >= thresholds.statement,
      },
    ];

    const passed = details.every(d => d.passed);

    if (!options.json) {
      this.displayCheckResult(passed, details);
    }

    return { passed, details };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Detect the project stack based on config files
   */
  private detectStack(): StackDetectionResult {
    const indicators: string[] = [];
    let detected: CoverageStack = 'node';
    let suggestedTool: CoverageTool = 'jest';
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for Vite
    if (fs.existsSync(path.join(this.projectRoot, 'vite.config.ts')) ||
        fs.existsSync(path.join(this.projectRoot, 'vite.config.js'))) {
      indicators.push('vite.config found');
      detected = 'react-vite';
      suggestedTool = 'vitest';
      confidence = 'high';
    }

    // Check for Next.js
    if (fs.existsSync(path.join(this.projectRoot, 'next.config.js')) ||
        fs.existsSync(path.join(this.projectRoot, 'next.config.mjs')) ||
        fs.existsSync(path.join(this.projectRoot, 'next.config.ts'))) {
      indicators.push('next.config found');
      detected = 'nextjs';
      suggestedTool = 'jest';
      confidence = 'high';
    }

    // Check for vitest config (overrides stack detection)
    if (fs.existsSync(path.join(this.projectRoot, 'vitest.config.ts')) ||
        fs.existsSync(path.join(this.projectRoot, 'vitest.config.js'))) {
      indicators.push('vitest.config found');
      suggestedTool = 'vitest';
      if (detected === 'node') {
        detected = 'react-vite';
      }
      confidence = 'high';
    }

    // Check for jest config
    if (fs.existsSync(path.join(this.projectRoot, 'jest.config.js')) ||
        fs.existsSync(path.join(this.projectRoot, 'jest.config.ts'))) {
      indicators.push('jest.config found');
      if (suggestedTool !== 'vitest') {
        suggestedTool = 'jest';
      }
    }

    // Check package.json for React
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps.react) {
        indicators.push('react dependency');
        if (detected === 'node') {
          detected = 'react-vite';
          confidence = 'medium';
        }
      }
    }

    return { detected, confidence, indicators, suggestedTool };
  }

  /**
   * Check if coverage tool is installed
   */
  private checkToolInstalled(tool: CoverageTool): { installed: boolean; version: string | null; installCommand: string } {
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return { installed: false, version: null, installCommand: 'No package.json found' };
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const toolName = tool === 'vitest' ? 'vitest' : tool === 'jest' ? 'jest' : 'c8';
    const installed = !!deps[toolName];
    const version = deps[toolName] || null;
    const installCommand = `pnpm add -D ${toolName}`;

    return { installed, version, installCommand };
  }

  /**
   * Check if coverage provider is installed
   */
  private checkProviderInstalled(tool: CoverageTool): { installed: boolean; version: string | null; name: string; installCommand: string } {
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return { installed: false, version: null, name: 'unknown', installCommand: 'No package.json found' };
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    let providerName: string;
    let installCommand: string;

    if (tool === 'vitest') {
      providerName = '@vitest/coverage-v8';
      installCommand = 'pnpm add -D @vitest/coverage-v8';
    } else if (tool === 'jest') {
      // Jest uses built-in coverage or babel-jest
      providerName = 'jest (built-in)';
      return { installed: true, version: deps.jest, name: providerName, installCommand: '' };
    } else {
      providerName = 'c8';
      installCommand = 'pnpm add -D c8';
    }

    const installed = !!deps[providerName];
    const version = deps[providerName] || null;

    return { installed, version, name: providerName, installCommand };
  }

  /**
   * Check if tool config file exists
   */
  private checkToolConfig(tool: CoverageTool): { exists: boolean; path: string | null } {
    const configFiles: Record<CoverageTool, string[]> = {
      vitest: ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js'],
      jest: ['jest.config.js', 'jest.config.ts', 'jest.config.cjs'],
      c8: ['package.json'], // c8 config in package.json
      auto: [],
    };

    for (const configFile of configFiles[tool] || []) {
      const fullPath = path.join(this.projectRoot, configFile);
      if (fs.existsSync(fullPath)) {
        return { exists: true, path: configFile };
      }
    }

    return { exists: false, path: null };
  }

  /**
   * Load coverage configuration
   */
  private loadConfig(): CoverageConfig | null {
    if (!fs.existsSync(this.configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = yaml.load(content) as { coverage: CoverageConfig };
      return parsed.coverage;
    } catch {
      return null;
    }
  }

  /**
   * Build the coverage command based on tool
   */
  private buildCoverageCommand(config: CoverageConfig, options: CoverageRunOptions): string {
    const tool = config.collection.tool;

    if (tool === 'vitest') {
      const parts = ['npx', 'vitest', 'run', '--coverage'];
      if (options.include) {
        parts.push(`--include=${options.include}`);
      }
      return parts.join(' ');
    }

    if (tool === 'jest') {
      const parts = ['npx', 'jest', '--coverage'];
      if (options.include) {
        parts.push(`--testPathPattern=${options.include}`);
      }
      return parts.join(' ');
    }

    if (tool === 'c8') {
      return 'npx c8 npm test';
    }

    // Fallback to npm test with coverage
    return 'npm test -- --coverage';
  }

  /**
   * Get default include patterns for stack
   */
  private getDefaultIncludes(stack: CoverageStack): string[] {
    if (stack === 'nextjs') {
      return ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', 'pages/**/*.{ts,tsx}'];
    }
    return ['src/**/*.{ts,tsx}'];
  }

  /**
   * Get default exclude patterns for stack
   */
  private getDefaultExcludes(stack: CoverageStack): string[] {
    const common = [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
      '**/*.d.ts',
      '**/mocks/**',
      '**/__tests__/**',
      '**/node_modules/**',
    ];

    if (stack === 'nextjs') {
      return [...common, '**/.next/**'];
    }

    return common;
  }

  /**
   * Build validation result object
   */
  private buildValidationResult(
    checks: ValidationCheck[],
    warnings: string[],
    errors: string[],
    config?: CoverageConfig,
    detection?: StackDetectionResult
  ): CoverageValidationResult {
    const valid = errors.length === 0 && checks.every(c => c.passed);

    return {
      valid,
      stack: {
        detected: detection?.detected ?? 'node',
        explicit: config?.stack ?? null,
        match: config?.stack === detection?.detected,
      },
      tool: {
        name: config?.collection.tool ?? 'auto',
        version: null,
        installed: checks.find(c => c.name === 'Coverage tool')?.passed ?? false,
      },
      provider: {
        name: '',
        version: null,
        installed: checks.find(c => c.name === 'Coverage provider')?.passed ?? false,
      },
      config: {
        path: this.configPath,
        exists: fs.existsSync(this.configPath),
        hasCoverageSection: !!config,
        thresholds: config?.thresholds ?? null,
      },
      reporting: {
        service: config?.reporting.service ?? 'none',
        tokenSet: false,
        tokenEnvVar: config?.reporting.tokenEnv ?? null,
      },
      checks,
      warnings,
      errors,
    };
  }

  /**
   * Display check result
   */
  private displayCheckResult(passed: boolean, details: ThresholdCheckResult['details']): void {
    console.log(passed 
      ? chalk.green('\n✅ Coverage thresholds met\n')
      : chalk.red('\n❌ Coverage thresholds not met\n')
    );

    console.log(chalk.blue('Current coverage:'));
    for (const detail of details) {
      const icon = detail.passed ? chalk.green('✅') : chalk.red('❌');
      const pct = detail.passed 
        ? chalk.green(`${detail.actual.toFixed(1)}%`)
        : chalk.red(`${detail.actual.toFixed(1)}%`);
      console.log(`  ${icon} ${detail.metric}: ${pct} (threshold: ${detail.threshold}%)`);
    }
    console.log();
  }

  /**
   * Show next steps after init
   */
  private showNextSteps(tool: CoverageTool): void {
    console.log(chalk.blue('📋 Next steps:\n'));

    if (tool === 'vitest') {
      console.log(chalk.white('  1. Install dependencies:'));
      console.log(chalk.gray('     pnpm add -D vitest @vitest/coverage-v8\n'));
      console.log(chalk.white('  2. Add coverage config to vitest.config.ts:'));
      console.log(chalk.gray(`     coverage: {
       provider: 'v8',
       reporter: ['text', 'lcov', 'json'],
     }\n`));
    } else if (tool === 'jest') {
      console.log(chalk.white('  1. Ensure jest is installed:'));
      console.log(chalk.gray('     pnpm add -D jest\n'));
      console.log(chalk.white('  2. Add coverage config to jest.config.js:'));
      console.log(chalk.gray(`     collectCoverage: true,
     coverageReporters: ['text', 'lcov', 'json'],\n`));
    }

    console.log(chalk.white('  3. Run coverage:'));
    console.log(chalk.gray('     sc coverage run\n'));
    console.log(chalk.white('  4. Check thresholds:'));
    console.log(chalk.gray('     sc coverage check\n'));
  }
}

export default CoverageManager;

