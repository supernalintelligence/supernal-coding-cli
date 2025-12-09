/**
 * Shared requirement parser for dashboard applications
 * Extracted from apps/supernal-dashboard for DRY compliance
 * @module requirements/parser
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * Parse a requirement markdown file and extract metadata
 * @param {string} filePath - Path to the requirement file
 * @returns {import('./types').Requirement | null} Parsed requirement or null on error
 */
function parseRequirement(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.md');

    // Extract YAML front matter
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let priority = 'Medium';
    let priorityScore = 5;
    let phase = 'drafting'; // Default to drafting phase (SOP Phase 5 - Technical Requirements)
    let pattern = 'feature';
    let title = '';
    let reqId = fileName;
    let status = 'Draft';
    let category = 'core';
    let dependencies = [];
    let epic;
    let createdAt;
    let updatedAt;
    let targetDate;
    let startDate;
    let description = '';

    if (yamlMatch) {
      const yamlContent = yamlMatch[1];

      // Extract all frontmatter fields
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

      // Helper to normalize frontmatter values (strip quotes, normalize case)
      const normalizeValue = (val) => val.trim().replace(/^['"]|['"]$/g, '');
      
      // Normalize phase to 12-phase SOP workflow
      // Valid phases: discovery, research, design, compliance, planning, drafting, implementing, testing, validating, complete
      const normalizePhase = (rawPhase) => {
        const p = rawPhase.toLowerCase().replace(/^['"]|['"]$/g, '').trim();
        const phaseMap = {
          // Standard SOP phases (keep as-is)
          'discovery': 'discovery',       // Phase 1
          'research': 'research',         // Phase 2
          'design': 'design',             // Phase 3
          'compliance': 'compliance',     // Phase 3b
          'planning': 'planning',         // Phase 4
          'drafting': 'drafting',         // Phase 5
          'implementing': 'implementing', // Phases 6-7
          'testing': 'testing',           // Phase 8
          'validating': 'validating',     // Phase 10
          'complete': 'complete',         // Phases 11-12
          
          // Numeric phases → map to SOP phase names
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
          
          // Legacy/non-standard → map to closest SOP phase
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

      // Parse dependencies array
      if (depsMatch) {
        const depsStr = depsMatch[1];
        dependencies = depsStr
          .split(',')
          .map((d) => d.trim().replace(/['"]/g, ''))
          .filter((d) => d.length > 0);
      }
    }

    // Fallback: Extract title from first # heading if not in frontmatter
    if (!title) {
      const headingMatch = content.match(/^#\s+(.+)$/m);
      title = headingMatch
        ? headingMatch[1]
        : fileName.replace(/^req-[^-]+-\d+-/, '').replace(/-/g, ' ');
    }

    // Fallback: Extract category from file path if not in frontmatter
    if (category === 'core') {
      const pathParts = filePath.split(path.sep);
      const requirementsIndex = pathParts.indexOf('requirements');
      if (requirementsIndex !== -1 && pathParts[requirementsIndex + 1]) {
        category = pathParts[requirementsIndex + 1];
      }
    }

    // Determine requirement type based on folder structure first, then content and metadata
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

/**
 * Determine the requirement type based on folder structure FIRST, then content/metadata
 * @param {string} content - File content
 * @param {import('./types').Phase} phase - Phase
 * @param {string} pattern - Pattern
 * @param {string} category - Category
 * @param {string} [filePath] - File path
 * @returns {import('./types').RequirementType} Determined requirement type
 */
function determineRequirementType(content, phase, pattern, category, filePath) {
  // FOLDER-BASED CATEGORIZATION (PRIMARY)
  if (filePath) {
    const pathParts = filePath.split(path.sep);

    // Find the folder after 'requirements'
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
          // For core, check subfolder or content
          if (pathParts[requirementsIndex + 2]) {
            const subFolder = pathParts[requirementsIndex + 2];
            if (subFolder === 'problems') return 'problem';
            if (subFolder === 'stories') return 'story';
          }
          return 'functional-requirement'; // Default for core
      }
    }
  }

  // FALLBACK: Content-based analysis (SECONDARY)
  const lowerContent = content.toLowerCase();

  // Check for problem statements
  if (
    phase === 'discovery' ||
    lowerContent.includes('problem') ||
    lowerContent.includes('issue') ||
    category.includes('problem')
  ) {
    return 'problem';
  }

  // Check for user stories
  if (
    lowerContent.includes('user story') ||
    lowerContent.includes('as a user') ||
    lowerContent.includes('story') ||
    category.includes('stories')
  ) {
    return 'story';
  }

  // Check for functional requirements
  if (
    lowerContent.includes('functional') ||
    lowerContent.includes('feature') ||
    pattern === 'feature' ||
    category.includes('functional')
  ) {
    return 'functional-requirement';
  }

  // Check for technical requirements
  if (
    lowerContent.includes('technical') ||
    category.includes('technical') ||
    category.includes('infrastructure')
  ) {
    return 'technical-requirement';
  }

  // Check for architecture
  if (
    lowerContent.includes('architecture') ||
    lowerContent.includes('design') ||
    category.includes('architecture')
  ) {
    return 'architecture';
  }

  // Check for tests
  if (
    lowerContent.includes('test') ||
    lowerContent.includes('testing') ||
    category.includes('test')
  ) {
    return 'test';
  }

  // Check for compliance
  if (
    lowerContent.includes('compliance') ||
    lowerContent.includes('gdpr') ||
    lowerContent.includes('iso') ||
    category.includes('compliance')
  ) {
    return 'compliance';
  }

  // Check for verification
  if (
    phase === 'integration' ||
    phase === 'release' ||
    lowerContent.includes('verification') ||
    lowerContent.includes('validation')
  ) {
    return 'verification';
  }

  // Default based on phase
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

/**
 * Generate phase-based statistics from requirements
 * @param {import('./types').Requirement[]} requirements - Array of requirements
 * @returns {import('./types').PhasesData} Phase statistics
 */
function generatePhaseStats(requirements) {
  const phaseGroups = {
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

  const phaseStats = {
    evidence: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    },
    problem: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    story: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    compliance: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    },
    'functional-requirement': {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    },
    'technical-requirement': {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    },
    component: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    },
    architecture: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    },
    test: { total: 0, completed: 0, inProgress: 0, pending: 0, progress: 0 },
    monitoring: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    },
    verification: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    },
    kanban: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      progress: 0
    }
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

  // Calculate progress percentages
  Object.keys(phaseStats).forEach((phase) => {
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

/**
 * Load all requirement files using workflow-driven configuration
 * @param {string} requirementsDir - Base requirements directory
 * @param {string} [repoPath] - Repository path for workflow config
 * @returns {Promise<import('./types').Requirement[]>} Array of parsed requirements
 */
async function loadRequirements(requirementsDir, repoPath) {
  const allRequirements = [];
  const seenFiles = new Set(); // De-duplicate by absolute path

  if (!fs.existsSync(requirementsDir)) {
    console.warn(`Requirements directory not found: ${requirementsDir}`);
    return allRequirements;
  }

  console.log(`📂 Scanning ${requirementsDir} for requirements...`);

  // Try to load workflow config for directories and patterns
  let workflowDirectories = [];
  let workflowPatterns = [];

  if (repoPath) {
    try {
      // Try to load workflow loader - may not be available in all contexts
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
          `✨ Using workflow config: ${workflowDirectories.length} directories, ${workflowPatterns.length} patterns`
        );
      }
    } catch (_error) {
      // Workflow loader not available or workflow config not found - use fallback
      console.log('⚠️  Workflow config not available, using default patterns');
    }
  }

  // Determine directories to scan
  const scanDirs = workflowDirectories.length > 0 ? workflowDirectories : ['']; // Scan the base requirementsDir if no workflow

  // Determine file patterns
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

  // Files/dirs to exclude
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

  function isRequirementFile(filename, filepath) {
    // Must be markdown
    if (!filename.endsWith('.md')) return false;

    // Check if path contains excluded patterns
    if (excludePatterns.some((pattern) => pattern.test(filepath))) {
      return false;
    }

    // Check if filename matches requirement patterns
    return requirementPatterns.some((pattern) => pattern.test(filename));
  }

  function traverseDirectory(dirPath) {
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
        continue; // Skip inaccessible files/broken symlinks
      }

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (excludePatterns.some((pattern) => pattern.test(item))) {
          continue;
        }
        traverseDirectory(itemPath);
      } else if (isRequirementFile(item, itemPath)) {
        // De-duplicate by absolute path
        const absolutePath = path.resolve(itemPath);
        if (seenFiles.has(absolutePath)) {
          console.log(
            `⏭️  Skipping duplicate: ${path.relative(requirementsDir, absolutePath)}`
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

  // Scan directories from workflow or fallback
  for (const dir of scanDirs) {
    const fullPath = dir ? path.join(requirementsDir, dir) : requirementsDir;
    if (fs.existsSync(fullPath)) {
      traverseDirectory(fullPath);
    } else {
      console.warn(`⚠️  Directory not found: ${fullPath}`);
    }
  }

  console.log(`✅ Loaded ${allRequirements.length} unique requirements`);
  return allRequirements;
}

/**
 * Get repository configuration based on repoId
 * @param {string} repoId - Repository identifier
 * @returns {{requirementsDir: string, repoPath: string, repoRoot: string, projectRoot: string}} Repository configuration
 */
function getRepoConfig(repoId) {
  // Use PROJECT_ROOT env var if available (for dashboard serving other repos)
  // Otherwise fall back to process.cwd() (for direct CLI usage)
  const projectRoot = process.env.PROJECT_ROOT || process.cwd();

  // Check for copied files in production (Vercel)
  const publicRepoPath = path.join(projectRoot, 'public', '_repo');
  let repoPath = projectRoot;
  let usingCopiedFiles = false;

  if (fs.existsSync(publicRepoPath)) {
    // Production: use copied files
    repoPath = publicRepoPath;
    usingCopiedFiles = true;
  } else if (projectRoot.includes('supernal-dashboard')) {
    // Development: navigate to repo root
    repoPath = path.resolve(projectRoot, '../..');
  }

  // Validate repo name only when NOT using copied files
  if (!usingCopiedFiles) {
    const currentRepoName = path.basename(repoPath);
    if (repoId !== currentRepoName) {
      throw new Error(
        `Repository '${repoId}' not found. Current repository is '${currentRepoName}'.`
      );
    }
  }

  // Default: Use docs/ as the base directory for Renaissance structure
  let requirementsDir = path.join(repoPath, 'docs');

  const configPath = path.join(repoPath, 'supernal.yaml');
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      // Match ONLY the directory field under [requirements], not reports_directory
      const directoryMatch = configContent.match(
        /\[requirements\][^[]*?^directory\s*=\s*"([^"]+)"/m
      );
      if (directoryMatch) {
        const configuredDir = directoryMatch[1]; // e.g., "docs/requirements"
        // Use the parent of the configured directory (e.g., docs/) for Renaissance structure scanning
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

module.exports = {
  parseRequirement,
  determineRequirementType,
  generatePhaseStats,
  loadRequirements,
  getRepoConfig
};
