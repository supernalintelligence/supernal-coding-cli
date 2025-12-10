/**
 * Jest Configuration for Supernal Coding Package
 *
 * Configures Jest for unit, integration, and e2e testing
 * Supports incremental TypeScript migration
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest/presets/js-with-ts',

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.test.ts',
    '**/__tests__/**/*.js',
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).js',
    '**/?(*.)+(spec|test).ts'
  ],

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // ts-jest configuration
  globals: {
    'ts-jest': {
      useESM: false,
      isolatedModules: true,
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        skipLibCheck: true,
        resolveJsonModule: true,
        allowJs: true,
      }
    }
  },

  // Coverage collection
  collectCoverageFrom: [
    'lib/**/*.js',
    'lib/**/*.ts',
    '!lib/**/node_modules/**',
    '!lib/**/*.test.js',
    '!lib/**/*.test.ts',
    '!lib/**/__tests__/**',
    '!lib/types/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },

  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', 'lib'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/dist/', 
    '/build/', 
    '/coverage/',
    '/documentation/',                     // Playwright tests for old docusaurus site
    'cli/commands/development/test\\.',    // Command file named test.js/ts (not a test file)
  ],

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Reset mocks between tests
  resetMocks: true
};
