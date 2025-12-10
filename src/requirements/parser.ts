import fs from 'node:fs';
import path from 'node:path';

type Phase = 
  | 'discovery' 
  | 'research' 
  | 'design' 
  | 'compliance' 
  | 'planning' 
  | 'drafting' 
  | 'implementing' 
  | 'testing' 
  | 'validating' 
  | 'complete'
  | 'foundation'
  | 'implementation'
  | 'integration'
  | 'release';

type RequirementType = 
  | 'problem'
  | 'story'
  | 'functional-requirement'
  | 'technical-requirement'
  | 'architecture'
  | 'test'
  | 'compliance'
  | 'verification'
  | 'evidence'
  | 'component'
  | 'monitoring'
  | 'kanban';

interface Requirement {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: string;
  priorityScore: number;
  status: string;
  phase: Phase | string;
  pattern: string;
  type: RequirementType;
  filePath: string;
  dependencies?: string[];
  epic?: string;
  createdAt?: string;
  updatedAt?: string;
  targetDate?: string;
  startDate?: string;
}

interface PhaseStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  progress: number;
}

interface PhasesData {
  groups: Record<RequirementType, Requirement[]>;
  stats: Record<RequirementType, PhaseStats>;
  totalRequirements: number;
}

interface RepoConfig {
  requirementsDir: string;
  repoPath: string;
  repoRoot: string;
  projectRoot: string;
}

function parseRequirement(filePath: string): Requirement | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.md');

    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let priority = 'Medium';
    let priorityScore = 5;
    let phase: Phase | string = 'drafting';
    let pattern = 'feature';
    let title = '';
    let reqId = fileName;
    let status = 'Draft';
    let category = 'core';
    let dependencies: string[] = [];
    let epic: string | undefined;
    let createdAt: string | undefined;
    let updatedAt: string | undefined;
    let targetDate: string | undefined;
    let startDate: string | undefined;
    let description = '';

    if (yamlMatch) {
      const yamlContent = yamlMatch[1];

      const priorityMatch = yamlContent.match(/priority:\s*(.+)/);
      const scoreMatch = yamlContent.match(/priorityScore:\s*(\d+)/);
      const phaseMatch = yamlContent.match(/phase:\s*(.+)/);
      const patternMatch = yamlContent.match(/pattern:\s*(.+)/);
      const titleMatch = yamlContent.match(/title:\s*(.+)/);
      const idMatch = yamlContent.match(/^id:\s*['"]*([^'"\n]+)['"]*$/m);
      const statusMatch = yamlContent.match(/status:\s*(.+)/);
      const categoryMatch = yamlContent.match(/category:\s*(.+)/);
      const depsMatch = yamlContent.match(/dependencies:\s*\[([\s\S]*?)\]/);
      const epicMatch = yamlContent.match(/epic:\s*(.+)/);
      const createdMatch = yamlContent.match(/created:\s*['"]*([^'"\n]+)['"]*$/m);
      const updatedMatch = yamlContent.match(/updated:\s*['"]*([^'"\n]+)['"]*$/m);
      const targetDateMatch = yamlContent.match(/target_date:\s*['"]*([^'"\n]+)['"]*$/m);
      const startDateMatch = yamlContent.match(/start_date:\s*['"]*([^'"\n]+)['"]*$/m);
      const descriptionMatch = yamlContent.match(/description:\s*['"]*([^'"\n]+)['"]*$/m);

      const normalizeValue = (val: string): string => val.trim().replace(/^['"]|['"]$/g, '');
      
      const normalizePhase = (rawPhase: string): Phase | string => {
        const p = rawPhase.toLowerCase().replace(/^['"]|['"]$/g, '').trim();
        const phaseMap: Record<string, Phase> = {
          'discovery': 'discovery',
          'research': 'research',
          'design': 'design',
          'compliance': 'compliance',
          'planning': 'planning',
          'drafting': 'drafting',
          'implementing': 'implementing',
          'testing': 'testing',
          'validating': 'validating',
          'complete': 'complete',
          '1': 'discovery',
          '2': 'research',
          '3': 'design',
          '4': 'planning',
          '5': 'drafting',
          '6': 'implementing',
          '7': 'implementing',
          '8': 'testing',
          '9': 'testing',
          '10': 'validating',
          '11': 'complete',
          '12': 'complete',
          'foundation': 'drafting',
          'requirements': 'drafting',
          'implementation': 'implementing',
          'solutions': 'implementing',
          'integration': 'testing',
          'evaluations': 'testing',
          'release': 'complete',
          'done': 'complete',
          'completed': 'complete',
          'backlog': 'discovery',
        };
        return phaseMap[p] || p;
      };
      
      if (priorityMatch) priority = normalizeValue(priorityMatch[1]);
      if (scoreMatch) priorityScore = parseInt(scoreMatch[1], 10);
      if (phaseMatch) phase = normalizePhase(phaseMatch[1]);
      if (patternMatch) pattern = normalizeValue(patternMatch[1]);
      if (titleMatch) title = normalizeValue(titleMatch[1]);
      if (idMatch) reqId = normalizeValue(idMatch[1]);
      if (statusMatch) status = normalizeValue(statusMatch[1]);
      if (categoryMatch) category = normalizeValue(categoryMatch[1]);
      if (epicMatch) epic = normalizeValue(epicMatch[1]);
      if (createdMatch) createdAt = normalizeValue(createdMatch[1]);
      if (updatedMatch) updatedAt = normalizeValue(updatedMatch[1]);
      if (targetDateMatch) targetDate = normalizeValue(targetDateMatch[1]);
      if (startDateMatch) startDate = normalizeValue(startDateMatch[1]);
      if (descriptionMatch) description = normalizeValue(descriptionMatch[1]);

      if (depsMatch) {
        const depsStr = depsMatch[1];
        dependencies = depsStr
          .split(',')
          .map((d) => d.trim().replace(/['"]/g, ''))
          .filter((d) => d.length > 0);
      }
    }

    if (!title) {
      const headingMatch = content.match(/^#\s+(.+)$/m);
      title = headingMatch
        ? headingMatch[1]
        : fileName.replace(/^req-[^-]+-\d+-/, '').replace(/-/g, ' ');
    }

    if (category === 'core') {
      const pathParts = filePath.split(path.sep);
      const requirementsIndex = pathParts.indexOf('requirements');
      if (requirementsIndex !== -1 && pathParts[requirementsIndex + 1]) {
        category = pathParts[requirementsIndex + 1];
      }
    }

    const reqType = determineRequirementType(
      content,
      phase,
      pattern,
      category,
      filePath
    );

    return {
      id: reqId,
      title: title,
      description: description,
      category: category === '.' ? 'core' : category,
      priority: priority,
      priorityScore: priorityScore,
      status: status,
      phase: phase,
      pattern: pattern,
      type: reqType,
      filePath: filePath,
      dependencies: dependencies.length > 0 ? dependencies : undefined,
      epic: epic,
      createdAt: createdAt,
      updatedAt: updatedAt,
      targetDate: targetDate,
      startDate: startDate
    };
  } catch (error) {
    console.error(`Error parsing requirement ${filePath}:`, error);
    return null;
  }
}

function determineRequirementType(
  content: string,
  phase: Phase | string,
  pattern: string,
  category: string,
  filePath?: string
): RequirementType {
  if (filePath) {
    const pathParts = filePath.split(path.sep);

    const requirementsIndex = pathParts.indexOf('requirements');
    if (requirementsIndex !== -1 && pathParts[requirementsIndex + 1]) {
      const mainFolder = pathParts[requirementsIndex + 1];

      switch (mainFolder) {
        case 'stories':
          return 'story';
        case 'functional':
          return 'functional-requirement';
        case 'architecture':
          return 'architecture';
        case 'testing':
          return 'test';
        case 'compliance':
          return 'compliance';
        case 'infrastructure':
          return 'technical-requirement';
        case 'workflow':
          return 'kanban';
        case 'core':
          if (pathParts[requirementsIndex + 2]) {
            const subFolder = pathParts[requirementsIndex + 2];
            if (subFolder === 'problems') return 'problem';
            if (subFolder === 'stories') return 'story';
          }
          return 'functional-requirement';
      }
    }
  }

  const lowerContent = content.toLowerCase();

  if (
    phase === 'discovery' ||
    lowerContent.includes('problem') ||
    lowerContent.includes('issue') ||
    category.includes('problem')
  ) {
    return 'problem';
  }

  if (
    lowerContent.includes('user story') ||
    lowerContent.includes('as a user') ||
    lowerContent.includes('story') ||
    category.includes('stories')
  ) {
    return 'story';
  }

  if (
    lowerContent.includes('functional') ||
    lowerContent.includes('feature') ||
    pattern === 'feature' ||
    category.includes('functional')
  ) {
    return 'functional-requirement';
  }

  if (
    lowerContent.includes('technical') ||
    category.includes('technical') ||
    category.includes('infrastructure')
  ) {
    return 'technical-requirement';
  }

  if (
    lowerContent.includes('architecture') ||
    lowerContent.includes('design') ||
    category.includes('architecture')
  ) {
    return 'architecture';
  }

  if (
    lowerContent.includes('test') ||
    lowerContent.includes('testing') ||
    category.includes('test')
  ) {
    return 'test';
  }

  if (
    lowerContent.includes('compliance') ||
    lowerContent.includes('gdpr') ||
    lowerContent.includes('iso') ||
    category.includes('compliance')
  ) {
    return 'compliance';
  }

  if (
    phase === 'integration' ||
    phase === 'release' ||
    lowerContent.includes('verification') ||
    lowerContent.includes('validation')
  ) {
    return 'verification';
  }

  switch (phase) {
    case 'discovery':
      return 'problem';
    case 'foundation':
      return 'functional-requirement';
    case 'implementation':
      return 'technical-requirement';
    case 'integration':
      return 'test';
    case 'release':
      return 'verification';
    default:
      return 'functional-requirement';
  }
}

function generatePhaseStats(requirements: Requirement[]): PhasesData {
  const phaseGroups: Record<RequirementType, Requirement[]> = {
    evidence: [],
    problem: [],
    story: [],
    compliance: [],
    'functional-requirement': [],
    'technical-requirement': [],
    component: [],
    architecture: [],
    test: [],
    monitoring: [],
    verification: [],
    kanban: []
  };

  const phaseStats: Record<RequirementType, PhaseStats> = {
    evidence: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    problem: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    story: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    compliance: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    'functional-requirement': { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    'technical-requirement': { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    component: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    architecture: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    test: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    monitoring: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    verification: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    kanban: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 }
  };

  requirements.forEach((req) => {
    const type = req.type || 'functional-requirement';
    const status = req.status.toLowerCase();

    if (phaseGroups[type]) {
      phaseGroups[type].push(req);
      phaseStats[type].total++;

      if (status.includes('done') || status.includes('complete')) {
        phaseStats[type].completed++;
      } else if (status.includes('progress') || status.includes('active')) {
        phaseStats[type].inProgress++;
      } else {
        phaseStats[type].pending++;
      }
    }
  });

  (Object.keys(phaseStats) as RequirementType[]).forEach((phase) => {
    const stats = phaseStats[phase];
    stats.progress =
      stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  });

  return {
    groups: phaseGroups,
    stats: phaseStats,
    totalRequirements: requirements.length
  };
}

async function loadRequirements(requirementsDir: string, repoPath?: string): Promise<Requirement[]> {
  const allRequirements: Requirement[] = [];
  const seenFiles = new Set<string>();

  if (!fs.existsSync(requirementsDir)) {
    console.warn(`Requirements directory not found: ${requirementsDir}`);
    return allRequirements;
  }

  console.log(`Scanning ${requirementsDir} for requirements...`);

  let workflowDirectories: string[] = [];
  let workflowPatterns: string[] = [];

  if (repoPath) {
    try {
      const {
        loadWorkflowConfig,
        getDirectories,
        getFilePatterns
      } = require('../workflow/loader');
      const workflow = await loadWorkflowConfig(repoPath);

      if (workflow) {
        workflowDirectories = getDirectories(workflow);
        workflowPatterns = getFilePatterns(workflow);
        console.log(
          `Using workflow config: ${workflowDirectories.length} directories, ${workflowPatterns.length} patterns`
        );
      }
    } catch (_error) {
      console.log('[WARN] Workflow config not available, using default patterns');
    }
  }

  const scanDirs = workflowDirectories.length > 0 ? workflowDirectories : [''];

  const requirementPatterns =
    workflowPatterns.length > 0
      ? workflowPatterns.map((p) => new RegExp(p, 'i'))
      : [
          /^req-/i,
          /^prob-/i,
          /^story-/i,
          /^test-/i,
          /^comp-/i,
          /^arch-/i,
          /^epic-/i
        ];

  const excludePatterns = [
    /handoff/i,
    /todo/i,
    /readme/i,
    /template/i,
    /example/i,
    /draft/i,
    /_archive/i,
    /archive\//i,
    /node_modules/i,
    /\.git/i
  ];

  function isRequirementFile(filename: string, filepath: string): boolean {
    if (!filename.endsWith('.md')) return false;

    if (excludePatterns.some((pattern) => pattern.test(filepath))) {
      return false;
    }

    return requirementPatterns.some((pattern) => pattern.test(filename));
  }

  function traverseDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);

      let stat;
      try {
        stat = fs.statSync(itemPath);
      } catch (_error) {
        continue;
      }

      if (stat.isDirectory()) {
        if (excludePatterns.some((pattern) => pattern.test(item))) {
          continue;
        }
        traverseDirectory(itemPath);
      } else if (isRequirementFile(item, itemPath)) {
        const absolutePath = path.resolve(itemPath);
        if (seenFiles.has(absolutePath)) {
          console.log(
            `[SKIP] Skipping duplicate: ${path.relative(requirementsDir, absolutePath)}`
          );
          continue;
        }
        seenFiles.add(absolutePath);

        const requirement = parseRequirement(itemPath);
        if (requirement) {
          allRequirements.push(requirement);
        }
      }
    }
  }

  for (const dir of scanDirs) {
    const fullPath = dir ? path.join(requirementsDir, dir) : requirementsDir;
    if (fs.existsSync(fullPath)) {
      traverseDirectory(fullPath);
    } else {
      console.warn(`[WARN] Directory not found: ${fullPath}`);
    }
  }

  console.log(`[OK] Loaded ${allRequirements.length} unique requirements`);
  return allRequirements;
}

function getRepoConfig(repoId: string): RepoConfig {
  const projectRoot = process.env.PROJECT_ROOT || process.cwd();

  const publicRepoPath = path.join(projectRoot, 'public', '_repo');
  let repoPath = projectRoot;
  let usingCopiedFiles = false;

  if (fs.existsSync(publicRepoPath)) {
    repoPath = publicRepoPath;
    usingCopiedFiles = true;
  } else if (projectRoot.includes('supernal-dashboard')) {
    repoPath = path.resolve(projectRoot, '../..');
  }

  if (!usingCopiedFiles) {
    const currentRepoName = path.basename(repoPath);
    if (repoId !== currentRepoName) {
      throw new Error(
        `Repository '${repoId}' not found. Current repository is '${currentRepoName}'.`
      );
    }
  }

  let requirementsDir = path.join(repoPath, 'docs');

  const configPath = path.join(repoPath, 'supernal.yaml');
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const directoryMatch = configContent.match(
        /\[requirements\][^[]*?^directory\s*=\s*"([^"]+)"/m
      );
      if (directoryMatch) {
        const configuredDir = directoryMatch[1];
        const fullPath = path.join(repoPath, configuredDir);
        requirementsDir = path.dirname(fullPath);
      }
    } catch (error) {
      console.warn(`Could not read config, using default: ${error}`);
    }
  }

  return {
    requirementsDir,
    repoPath,
    repoRoot: repoPath,
    projectRoot: repoPath
  };
}

export {
  parseRequirement,
  determineRequirementType,
  generatePhaseStats,
  loadRequirements,
  getRepoConfig
};

export type {
  Requirement,
  RequirementType,
  Phase,
  PhaseStats,
  PhasesData,
  RepoConfig
};

module.exports = {
  parseRequirement,
  determineRequirementType,
  generatePhaseStats,
  loadRequirements,
  getRepoConfig
};
