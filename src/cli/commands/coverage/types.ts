/**
 * Coverage Ecosystem Types
 * Types for external coverage tool integration
 */

/** Supported technology stacks */
export type CoverageStack = 'react-vite' | 'nextjs' | 'node' | 'auto';

/** Supported coverage collection tools */
export type CoverageTool = 'vitest' | 'jest' | 'c8' | 'auto';

/** Supported coverage reporting services */
export type CoverageService = 'codecov' | 'coveralls' | 'sonarqube' | 'none';

/** Coverage threshold configuration */
export interface CoverageThresholds {
  line: number;
  branch: number;
  function: number;
  statement: number;
}

/** Path-specific threshold overrides */
export interface PathThreshold {
  pattern: string;
  thresholds: Partial<CoverageThresholds>;
}

/** Coverage collection configuration */
export interface CoverageCollectionConfig {
  tool: CoverageTool;
  configFile?: string;
  include: string[];
  exclude: string[];
}

/** Coverage reporting configuration */
export interface CoverageReportingConfig {
  service: CoverageService;
  tokenEnv?: string;
}

/** E2E coverage configuration */
export interface CoverageE2EConfig {
  enabled: boolean;
  tool: 'playwright' | 'cypress' | 'none';
  includeInAggregate: boolean;
}

/** Enforcement configuration */
export interface CoverageEnforcementConfig {
  preCommit: boolean;
  prePush: boolean;
  ciRequired: boolean;
}

/** Compliance configuration */
export interface CoverageComplianceConfig {
  enabled: boolean;
  evidenceRetention: number;
  linkToRequirements: boolean;
}

/** Main coverage configuration */
export interface CoverageConfig {
  stack: CoverageStack;
  collection: CoverageCollectionConfig;
  thresholds: CoverageThresholds;
  pathThresholds?: PathThreshold[];
  reporting: CoverageReportingConfig;
  e2e?: CoverageE2EConfig;
  enforcement: CoverageEnforcementConfig;
  compliance?: CoverageComplianceConfig;
}

/** Stack detection result */
export interface StackDetectionResult {
  detected: CoverageStack;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
  suggestedTool: CoverageTool;
}

/** Validation result for a single check */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  suggestion?: string;
}

/** Full validation result */
export interface CoverageValidationResult {
  valid: boolean;
  stack: {
    detected: CoverageStack;
    explicit: CoverageStack | null;
    match: boolean;
  };
  tool: {
    name: CoverageTool;
    version: string | null;
    installed: boolean;
  };
  provider: {
    name: string;
    version: string | null;
    installed: boolean;
  };
  config: {
    path: string | null;
    exists: boolean;
    hasCoverageSection: boolean;
    thresholds: CoverageThresholds | null;
  };
  reporting: {
    service: CoverageService;
    tokenSet: boolean;
    tokenEnvVar: string | null;
  };
  checks: ValidationCheck[];
  warnings: string[];
  errors: string[];
}

/** Coverage run result */
export interface CoverageRunResult {
  success: boolean;
  exitCode: number;
  coverageSummary?: {
    lines: { covered: number; total: number; percent: number };
    branches: { covered: number; total: number; percent: number };
    functions: { covered: number; total: number; percent: number };
    statements: { covered: number; total: number; percent: number };
  };
  outputDir: string;
  duration: number;
  error?: string;
}

/** Threshold check result */
export interface ThresholdCheckResult {
  passed: boolean;
  details: Array<{
    metric: keyof CoverageThresholds;
    actual: number;
    threshold: number;
    passed: boolean;
  }>;
  lowestCoverageFiles?: Array<{
    file: string;
    coverage: number;
  }>;
}

/** Coverage init options */
export interface CoverageInitOptions {
  stack?: CoverageStack;
  tool?: CoverageTool;
  minLine?: number;
  minBranch?: number;
  minFunction?: number;
  force?: boolean;
  dryRun?: boolean;
}

/** Coverage run options */
export interface CoverageRunOptions {
  check?: boolean;
  include?: string;
  e2e?: boolean;
  quick?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

/** Coverage check options */
export interface CoverageCheckOptions {
  minLine?: number;
  minBranch?: number;
  minFunction?: number;
  minStatement?: number;
  json?: boolean;
}

/** Coverage report options */
export interface CoverageReportOptions {
  format?: 'html' | 'lcov' | 'json' | 'text' | 'compliance';
  withRequirements?: boolean;
  output?: string;
}

/** Coverage upload options */
export interface CoverageUploadOptions {
  service?: CoverageService;
  token?: string;
  dryRun?: boolean;
}

