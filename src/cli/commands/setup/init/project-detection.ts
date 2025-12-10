// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

/**
 * Project Type Detection and Configuration
 * Handles automatic detection of project types and their configurations
 */

const PROJECT_TYPES = {
  'web-frontend': {
    name: 'Web Frontend',
    description: 'React, Vue, Angular, or vanilla JS frontend projects',
    detectors: [
      'package.json with react/vue/angular',
      'src/components/',
      'public/index.html',
      'webpack.config.js',
      'vite.config.js'
    ],
    additionalRules: [
      'react-patterns',
      'component-architecture',
      'frontend-performance',
      'accessibility-guidelines'
    ],
    packages: ['eslint', 'prettier', 'jest', 'cypress']
  },

  'node-backend': {
    name: 'Node.js Backend',
    description: 'Express, Fastify, or other Node.js server applications',
    detectors: [
      'package.json with express/fastify/koa',
      'src/routes/',
      'src/middleware/',
      'server.js',
      'app.js'
    ],
    additionalRules: [
      'api-design',
      'security-patterns',
      'database-patterns',
      'error-handling'
    ],
    packages: ['express', 'helmet', 'cors', 'joi', 'supertest']
  },

  fullstack: {
    name: 'Full Stack',
    description:
      'Combined frontend and backend, Next.js, Nuxt.js, or similar frameworks',
    detectors: [
      'package.json with next/nuxt',
      'pages/',
      'api/',
      'components/',
      'next.config.js',
      'nuxt.config.js'
    ],
    additionalRules: [
      'react-patterns',
      'api-design',
      'database-patterns',
      'frontend-performance'
    ],
    packages: ['next', 'nuxt', 'prisma', 'jest', 'cypress']
  },

  'python-backend': {
    name: 'Python Backend',
    description: 'Django, FastAPI, Flask, or other Python web frameworks',
    detectors: [
      'requirements.txt',
      'pyproject.toml',
      'manage.py',
      'app.py',
      'main.py',
      'src/'
    ],
    additionalRules: [
      'python-patterns',
      'api-design',
      'database-patterns',
      'testing-patterns'
    ],
    packages: ['fastapi', 'django', 'flask', 'pytest', 'black']
  },

  'mobile-app': {
    name: 'Mobile Application',
    description: 'React Native, Flutter, or native mobile development',
    detectors: [
      'package.json with react-native',
      'pubspec.yaml',
      'android/',
      'ios/',
      'App.js',
      'App.tsx'
    ],
    additionalRules: [
      'react-patterns',
      'mobile-performance',
      'accessibility-guidelines',
      'testing-patterns'
    ],
    packages: ['react-native', 'expo', 'jest', 'detox']
  },

  'data-science': {
    name: 'Data Science',
    description: 'Jupyter notebooks, data analysis, ML/AI projects',
    detectors: [
      '*.ipynb',
      'requirements.txt with pandas/numpy',
      'data/',
      'notebooks/',
      'models/'
    ],
    additionalRules: [
      'python-patterns',
      'data-patterns',
      'ml-patterns',
      'documentation-patterns'
    ],
    packages: ['pandas', 'numpy', 'scikit-learn', 'jupyter', 'pytest']
  },

  'desktop-app': {
    name: 'Desktop Application',
    description: 'Electron, Tauri, or native desktop applications',
    detectors: [
      'package.json with electron',
      'src-tauri/',
      'main.js',
      'main.ts',
      'public/'
    ],
    additionalRules: [
      'desktop-patterns',
      'security-patterns',
      'performance-patterns',
      'testing-patterns'
    ],
    packages: ['electron', 'tauri', 'jest', 'spectron']
  },

  'cli-tool': {
    name: 'CLI Tool',
    description: 'Command-line tools and utilities',
    detectors: [
      'bin/',
      'cli.js',
      'index.js with commander/yargs',
      'package.json with bin field'
    ],
    additionalRules: [
      'cli-patterns',
      'error-handling',
      'testing-patterns',
      'documentation-patterns'
    ],
    packages: ['commander', 'yargs', 'chalk', 'inquirer', 'jest']
  },

  library: {
    name: 'Library/Package',
    description: 'Reusable libraries, npm packages, or SDKs',
    detectors: [
      'package.json with main/module field',
      'lib/',
      'dist/',
      'index.js',
      'rollup.config.js',
      'webpack.config.js'
    ],
    additionalRules: [
      'library-patterns',
      'api-design',
      'testing-patterns',
      'documentation-patterns'
    ],
    packages: ['rollup', 'webpack', 'jest', 'typescript']
  },

  monorepo: {
    name: 'Monorepo',
    description: 'Multi-package repositories with shared tooling',
    detectors: [
      'lerna.json',
      'nx.json',
      'packages/',
      'apps/',
      'package.json with workspaces'
    ],
    additionalRules: [
      'monorepo-patterns',
      'shared-tooling',
      'testing-patterns',
      'ci-cd-patterns'
    ],
    packages: ['lerna', 'nx', 'yarn', 'jest', 'husky']
  }
};

/**
 * Detect project type based on directory contents and configuration files
 * @param {string} directory - Directory to analyze
 * @returns {Promise<Object>} Detection result with type, confidence, and patterns
 */
async function detectProjectType(directory) {
  try {
    const files = await fs.readdir(directory);
    const detectionResults = {};

    // Check each project type
    for (const [typeKey, typeConfig] of Object.entries(PROJECT_TYPES)) {
      let score = 0;
      const matchedPatterns = [];

      for (const detector of typeConfig.detectors) {
        if (await checkDetectorPattern(directory, detector, files)) {
          score += 1;
          matchedPatterns.push(detector);
        }
      }

      if (score > 0) {
        // Calculate confidence: be more generous for small matches
        // If we have ANY match, start at 65% base confidence
        // Then add up to 35% more based on additional matches
        const baseConfidence = 65;
        const additionalConfidence =
          ((score - 1) / Math.max(typeConfig.detectors.length - 1, 1)) * 35;
        const confidence = Math.min(baseConfidence + additionalConfidence, 100);

        detectionResults[typeKey] = {
          ...typeConfig,
          score,
          confidence,
          matchedPatterns
        };
      }
    }

    // Find the best match
    const bestMatch = Object.entries(detectionResults).reduce(
      (best, [key, result]) => {
        if (result.score > best.score) {
          return { type: key, ...result };
        }
        return best;
      },
      { type: 'web-frontend', score: 0, confidence: 0 }
    );

    // If no strong match, default to web-frontend with low confidence
    if (bestMatch.score === 0) {
      return {
        type: 'web-frontend',
        ...PROJECT_TYPES['web-frontend'],
        score: 0,
        confidence: 0,
        matchedPatterns: ['fallback due to no clear indicators']
      };
    }

    return bestMatch;
  } catch (error) {
    console.warn(
      chalk.yellow(`⚠️  Project type detection failed: ${error.message}`)
    );

    // Fallback to web-frontend
    return {
      type: 'web-frontend',
      ...PROJECT_TYPES['web-frontend'],
      score: 0,
      confidence: 0,
      patterns: ['fallback due to detection error']
    };
  }
}

/**
 * Check if a detector pattern matches in the directory
 * @param {string} directory - Directory to check
 * @param {string} pattern - Pattern to match
 * @param {string[]} files - List of files in directory
 * @returns {Promise<boolean>} Whether pattern matches
 */
async function checkDetectorPattern(directory, pattern, files) {
  try {
    // Check for specific files
    if (pattern.includes('.')) {
      const fileName = pattern.split(' ')[0];
      return (
        files.includes(fileName) ||
        (await fs.pathExists(path.join(directory, fileName)))
      );
    }

    // Check for directories
    if (pattern.endsWith('/')) {
      const dirName = pattern.slice(0, -1);
      return await fs.pathExists(path.join(directory, dirName));
    }

    // Check package.json content
    if (pattern.startsWith('package.json with')) {
      const packageJsonPath = path.join(directory, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJSON(packageJsonPath);
        const dependencyPattern = pattern.split('with ')[1];

        // Split by / to get multiple options (e.g., "react/vue/angular")
        const options = dependencyPattern.split('/').map((opt) => opt.trim());

        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies
        };

        // Check if any of the options match any dependency
        return options.some((option) =>
          Object.keys(allDeps || {}).some(
            (dep) => dep === option || dep.startsWith(`${option}-`)
          )
        );
      }
    }

    // Check for glob patterns
    if (pattern.includes('*')) {
      const glob = require('glob');
      const matches = glob.sync(pattern, { cwd: directory });
      return matches.length > 0;
    }

    // Default file/directory check
    return (
      files.includes(pattern) ||
      (await fs.pathExists(path.join(directory, pattern)))
    );
  } catch (_error) {
    return false;
  }
}

module.exports = {
  PROJECT_TYPES,
  detectProjectType,
  checkDetectorPattern
};
