import fs from 'node:fs';
import path from 'node:path';

const { findGitRoot } = require('./git-utils');
const { loadProjectConfig } = require('./config-loader');

const DEFAULT_STATE_DIR = '.supernal-coding';

interface DirectoryContent {
  name: string;
  type: 'directory' | 'file';
  path: string;
}

interface DirectoryAnalysis {
  path: string;
  type: 'directory';
  contents: DirectoryContent[];
}

interface RepositoryStructure {
  type: string;
  hasRequirements: boolean;
  hasKanban: boolean;
  hasWorkflowRules: boolean;
  hasTemplates: boolean;
  hasTests: boolean;
  hasDocs: boolean;
  directories: Record<string, DirectoryAnalysis>;
  patterns: string[];
}

interface ResolvedPaths {
  gitRoot: string;
  requirements: string | null;
  kanban: string | null;
  workflowRules: string | null;
  templates: string | null;
  tests: string | null;
  docs: string | null;
  config: string | null;
}

interface PathValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
}

function getStateDir(projectRoot: string): string {
  try {
    const config = loadProjectConfig(projectRoot);
    return config?.project?.state_dir || DEFAULT_STATE_DIR;
  } catch (_error) {
    return DEFAULT_STATE_DIR;
  }
}

function analyzeRepositoryStructure(repoPath: string): RepositoryStructure {
  const structure: RepositoryStructure = {
    type: 'unknown',
    hasRequirements: false,
    hasKanban: false,
    hasWorkflowRules: false,
    hasTemplates: false,
    hasTests: false,
    hasDocs: false,
    directories: {},
    patterns: []
  };

  try {
    const items = fs.readdirSync(repoPath);

    for (const item of items) {
      const itemPath = path.join(repoPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        structure.directories[item] = {
          path: itemPath,
          type: 'directory',
          contents: analyzeDirectoryContents(itemPath)
        };

        if (['requirements', 'reqs', 'specs'].includes(item)) {
          structure.hasRequirements = true;
          structure.patterns.push('requirements');
        }

        if (['kanban', 'tasks', 'workflow'].includes(item)) {
          structure.hasKanban = true;
          structure.patterns.push('kanban');
        }

        if (['workflow-rules', 'rules', 'workflow'].includes(item)) {
          structure.hasWorkflowRules = true;
          structure.patterns.push('workflow-rules');
        }

        if (['templates', 'template'].includes(item)) {
          structure.hasTemplates = true;
          structure.patterns.push('templates');
        }

        if (['tests', 'test', 'spec'].includes(item)) {
          structure.hasTests = true;
          structure.patterns.push('tests');
        }

        if (['docs', 'documentation'].includes(item)) {
          structure.hasDocs = true;
          structure.patterns.push('docs');
        }
      }
    }

    structure.type = determineRepositoryType(structure);
  } catch (error) {
    console.warn('Error analyzing repository structure:', (error as Error).message);
  }

  return structure;
}

function analyzeDirectoryContents(dirPath: string): DirectoryContent[] {
  try {
    const items = fs.readdirSync(dirPath);
    return items.map((item) => {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      return {
        name: item,
        type: stat.isDirectory() ? 'directory' as const : 'file' as const,
        path: itemPath
      };
    });
  } catch (_error) {
    return [];
  }
}

function determineRepositoryType(structure: RepositoryStructure): string {
  if (
    structure.hasRequirements &&
    structure.hasKanban &&
    structure.hasWorkflowRules
  ) {
    return 'supernal-coding';
  }

  if (structure.hasRequirements && structure.hasTests) {
    return 'requirements-driven';
  }

  if (structure.hasKanban && structure.hasTemplates) {
    return 'workflow-managed';
  }

  if (structure.hasTests && structure.hasDocs) {
    return 'documented-testing';
  }

  return 'standard';
}

function findDirectoryByPattern(repoPath: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    const dirPath = path.join(repoPath, pattern);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      return dirPath;
    }
  }
  return null;
}

function resolvePath(pathType: string, repoPath: string | null = null): string | null {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) {
    return null;
  }

  switch (pathType) {
    case 'requirements':
      return findDirectoryByPattern(gitRoot, [
        'requirements',
        'reqs',
        'specs',
        'docs/requirements',
        'supernal-coding/requirements'
      ]);

    case 'kanban':
      return findDirectoryByPattern(gitRoot, [
        'kanban',
        'tasks',
        'workflow',
        'supernal-coding/kanban'
      ]);

    case 'workflow-rules':
      return findDirectoryByPattern(gitRoot, [
        'workflow-rules',
        'rules',
        'workflow',
        'supernal-coding/workflow-rules'
      ]);

    case 'templates':
      return findDirectoryByPattern(gitRoot, [
        'templates',
        'template',
        'supernal-coding/templates'
      ]);

    case 'tests':
      return findDirectoryByPattern(gitRoot, [
        'tests',
        'test',
        'spec',
        'tests/requirements'
      ]);

    case 'docs':
      return findDirectoryByPattern(gitRoot, [
        'docs',
        'documentation',
        'supernal-coding/docs'
      ]);

    case 'config':
      return findDirectoryByPattern(gitRoot, [
        'supernal-coding',
        'config',
        getStateDir(gitRoot)
      ]);

    default:
      return null;
  }
}

function getAllResolvedPaths(repoPath: string | null = null): ResolvedPaths | null {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) {
    return null;
  }

  return {
    gitRoot,
    requirements: resolvePath('requirements', gitRoot),
    kanban: resolvePath('kanban', gitRoot),
    workflowRules: resolvePath('workflow-rules', gitRoot),
    templates: resolvePath('templates', gitRoot),
    tests: resolvePath('tests', gitRoot),
    docs: resolvePath('docs', gitRoot),
    config: resolvePath('config', gitRoot)
  };
}

function ensureDirectoryExists(dirPath: string, recursive = true): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive });
    }
    return true;
  } catch (error) {
    console.error('Error creating directory:', (error as Error).message);
    return false;
  }
}

function validatePathResolution(paths: ResolvedPaths | null): PathValidation {
  const validation: PathValidation = {
    isValid: true,
    errors: [],
    warnings: [],
    missing: []
  };

  if (!paths) {
    validation.isValid = false;
    validation.errors.push('No paths provided');
    return validation;
  }

  const requiredPaths: Array<keyof ResolvedPaths> = ['gitRoot', 'requirements', 'kanban'];
  const optionalPaths: Array<keyof ResolvedPaths> = ['workflowRules', 'templates', 'tests', 'docs'];

  for (const pathType of requiredPaths) {
    if (!paths[pathType]) {
      validation.isValid = false;
      validation.errors.push(`Missing required path: ${pathType}`);
      validation.missing.push(pathType);
    }
  }

  for (const pathType of optionalPaths) {
    if (!paths[pathType]) {
      validation.warnings.push(`Missing optional path: ${pathType}`);
      validation.missing.push(pathType);
    }
  }

  return validation;
}

export {
  DEFAULT_STATE_DIR,
  getStateDir,
  analyzeRepositoryStructure,
  findDirectoryByPattern,
  resolvePath,
  getAllResolvedPaths,
  ensureDirectoryExists,
  validatePathResolution,
  determineRepositoryType
};

module.exports = {
  DEFAULT_STATE_DIR,
  getStateDir,
  analyzeRepositoryStructure,
  findDirectoryByPattern,
  resolvePath,
  getAllResolvedPaths,
  ensureDirectoryExists,
  validatePathResolution,
  determineRepositoryType
};
