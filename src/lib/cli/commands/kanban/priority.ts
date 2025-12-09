#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');
const chalk = require('chalk');
const { loadProjectConfig, getDocPaths } = require('../../utils/config-loader');
const FrontmatterValidator = require('../../utils/frontmatter-validator');

// Helper to get paths from modern config
function getConfigPaths() {
  const config = loadProjectConfig(process.cwd(), { silent: true });
  const paths = getDocPaths(config);
  return {
    requirementsDir: paths.requirements,
    kanbanDir: paths.kanban
  };
}

// Parse YAML frontmatter from markdown files
function parseFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return {};

  try {
    return yaml.parse(fmMatch[1]) || {};
  } catch (error) {
    console.warn('Failed to parse YAML frontmatter:', error.message);
    return {};
  }
}

// Check if requirement dependencies are satisfied
function getDependencyStatus(reqData, allRequirements) {
  if (
    !reqData.dependencies ||
    reqData.dependencies.length === 0 ||
    (reqData.dependencies.length === 1 && reqData.dependencies[0] === '')
  ) {
    return { satisfied: true, pending: [] };
  }

  const pending = [];
  for (const depId of reqData.dependencies) {
    if (depId && depId !== '') {
      const dep = allRequirements.find((r) => r.id === depId);
      if (
        !dep ||
        (dep.status !== 'Implemented' && dep.status !== 'Completed')
      ) {
        pending.push(depId);
      }
    }
  }

  return { satisfied: pending.length === 0, pending };
}

// Find all requirements that depend on this requirement
function findDependents(reqId, allRequirements) {
  return allRequirements.filter((req) => req.dependencies?.includes(reqId));
}

// Calculate dependency depth (how many things depend on this, recursively)
function calculateDependencyDepth(reqId, allRequirements, visited = new Set()) {
  if (visited.has(reqId)) return 0; // Circular dependency protection
  visited.add(reqId);

  const dependents = findDependents(reqId, allRequirements);
  if (dependents.length === 0) return 0;

  let maxDepth = 0;
  for (const dependent of dependents) {
    const depth =
      1 +
      calculateDependencyDepth(dependent.id, allRequirements, new Set(visited));
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}

// NEW: Topological priority calculation to ensure dependencies always outrank dependents
function calculateTopologicalPriority(allRequirements) {
  const priorities = new Map();
  const visited = new Set();
  const visiting = new Set();

  // Helper function for topological sort with priority calculation
  function visit(reqId) {
    if (visiting.has(reqId)) {
      console.warn(`Circular dependency detected involving ${reqId}`);
      return 5; // Default score for circular dependencies
    }
    if (visited.has(reqId)) {
      return priorities.get(reqId);
    }

    visiting.add(reqId);
    const req = allRequirements.find((r) => r.id === reqId);
    if (!req) {
      console.warn(`Requirement ${reqId} not found`);
      return 5;
    }

    // Calculate base score from intrinsic properties
    const baseScore = calculateIntrinsicPriority(req);

    // Find the highest priority of all dependents (things that depend on this)
    const dependents = findDependents(reqId, allRequirements);
    let maxDependentScore = 0;

    for (const dependent of dependents) {
      const dependentScore = visit(dependent.id);
      maxDependentScore = Math.max(maxDependentScore, dependentScore);
    }

    // This requirement must have higher priority than any dependent
    // Priority = base intrinsic score + boost above highest dependent
    let finalScore = baseScore;
    if (maxDependentScore > 0) {
      finalScore = Math.max(baseScore, maxDependentScore + 0.5);
    }

    // Cap at reasonable maximum
    finalScore = Math.min(finalScore, 15);

    visiting.delete(reqId);
    visited.add(reqId);
    priorities.set(reqId, finalScore);

    return finalScore;
  }

  // Calculate priorities for all requirements
  for (const req of allRequirements) {
    if (!visited.has(req.id)) {
      visit(req.id);
    }
  }

  return priorities;
}

// Calculate intrinsic priority based on requirement properties (not dependencies)
function calculateIntrinsicPriority(requirement) {
  let score = 5; // Base score

  // FOUNDATIONAL BONUSES (more conservative)
  if (requirement.foundational) score += 1.0;
  if (requirement.blocking) score += 1.0;
  if (requirement.hierarchy === 'system-level') score += 0.5;
  if (requirement.category === 'infrastructure') score += 0.5;

  // RISK AND COMPLIANCE
  if (requirement.safetyRelated) score += 1.0;
  if (
    requirement.complianceStandards &&
    requirement.complianceStandards.length > 0
  )
    score += 0.5;
  if (requirement.riskLevel === 'Critical') score += 0.5;
  if (requirement.riskLevel === 'High') score += 0.3;

  // STATUS ADJUSTMENTS
  if (
    requirement.status === 'Implemented' ||
    requirement.status === 'Completed'
  ) {
    score = Math.max(score - 1, 2); // Implemented things get lower priority
  }
  if (requirement.status === 'Draft' && requirement.blocking) score += 0.3;

  // COMPLIANCE URGENCY
  if (requirement.complianceStandards?.includes('21-CFR-Part-11')) score += 0.5;
  if (requirement.validationRequired && requirement.status !== 'Implemented')
    score += 0.3;

  // DEPENDENCY PENALTY: If this has unmet dependencies, slight reduction
  // (This will be overridden by topological calculation anyway)

  return Math.round(score * 10) / 10; // Round to 1 decimal
}

// Updated priority calculation using topological approach
function calculateDynamicPriority(requirement, allRequirements = []) {
  // Use topological priority calculation
  const topologicalPriorities = calculateTopologicalPriority(allRequirements);
  let score = topologicalPriorities.get(requirement.id) || 5;

  // Penalize items with unmet dependencies
  const depStatus = getDependencyStatus(requirement, allRequirements);
  if (!depStatus.satisfied) {
    // Reduce score by 2 points for each unmet dependency, but don't go below 4
    const penalty = Math.min(depStatus.pending.length * 2, score - 4);
    score = Math.max(4, score - penalty);
  }

  return score;
}

// Updated priority mapping with expanded range to accommodate dependency chains
function scoreToPriority(score) {
  if (score >= 10.0) return 'Critical'; // Dependencies of blocking systems
  if (score >= 8.0) return 'High'; // Blocking systems themselves
  if (score >= 6.0) return 'Medium'; // Important features
  if (score >= 4.0) return 'Low'; // Nice to have
  return 'Deferred'; // Can wait
}

function getIndicators(reqData, allRequirements) {
  const indicators = [];
  if (reqData.foundational) indicators.push('🏗️');
  if (reqData.safetyRelated) indicators.push('🏥');
  if (reqData.blocking) indicators.push('🚧');

  // Add dependency indicators
  const dependencyDepth = calculateDependencyDepth(reqData.id, allRequirements);
  if (dependencyDepth > 0) indicators.push(`🔗${dependencyDepth}`);

  const depStatus = getDependencyStatus(reqData, allRequirements);
  if (!depStatus.satisfied) indicators.push('⏳');

  return indicators.join('');
}

// Load all requirements for dependency checking
function loadAllRequirements() {
  const { requirementsDir: reqDir } = getConfigPaths();
  const requirementsDir = path.join(process.cwd(), reqDir);

  // Categories that match current docs/requirements structure
  const categories = [
    'core',
    'workflow',
    'testing',
    'infrastructure',
    'content-management',
    'compliance'
  ]; // Exclude 'archive', 'deprecated', 'stories'
  const allRequirements = [];

  // Validate frontmatter before loading
  const validator = new FrontmatterValidator();
  const validation = validator.validateRequirements(requirementsDir);

  if (!validation.valid) {
    console.log(chalk.yellow('\n⚠️  Frontmatter validation issues detected:'));
    validator.printReport();
    console.log(
      chalk.yellow(
        '\n💡 Some requirements may be skipped due to frontmatter issues.'
      )
    );
    console.log(
      chalk.yellow(
        '   This could explain discrepancies between CLI and dashboard counts.'
      )
    );
  }

  for (const category of categories) {
    const categoryDir = path.join(requirementsDir, category);
    if (!fs.existsSync(categoryDir)) continue;

    const files = fs
      .readdirSync(categoryDir)
      .filter((f) => f.startsWith('req-') && f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const frontmatter = parseFrontmatter(content);

      if (frontmatter.id) {
        allRequirements.push({
          ...frontmatter,
          category,
          filePath
        });
      } else {
        // Log files that are skipped due to missing id
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(
          chalk.yellow(
            `  ⚠️  Skipping ${relativePath} - missing or invalid id field`
          )
        );
      }
    }
  }

  return allRequirements;
}

function updatePrioritizationSummary(allRequirements) {
  const { kanbanDir } = getConfigPaths();
  const prioritizationPath = path.join(
    process.cwd(),
    kanbanDir,
    'prioritization.md'
  );

  console.log(chalk.blue('📝 Updating prioritization.md summary...'));

  // Calculate current distribution
  const priorityCounts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    Deferred: 0
  };
  const priorityGroups = {
    Critical: [],
    High: [],
    Medium: [],
    Low: [],
    Deferred: []
  };

  for (const req of allRequirements) {
    const score = calculateDynamicPriority(req, allRequirements);
    const priority = scoreToPriority(score);
    priorityCounts[priority]++;

    const indicators = getIndicators(req, allRequirements);
    const depStatus = getDependencyStatus(req, allRequirements);
    const dependencyWarning = !depStatus.satisfied
      ? ` (depends on: ${depStatus.pending.join(', ')})`
      : '';

    // Use full file path for clickable navigation
    const fullPath = req.filePath
      ? path.relative(process.cwd(), req.filePath)
      : req.id;

    priorityGroups[priority].push({
      id: req.id,
      title: fullPath,
      category: req.category || 'unknown',
      score: score,
      indicators: indicators,
      dependencyWarning: dependencyWarning
    });
  }

  // Sort each priority group by score (descending)
  Object.keys(priorityGroups).forEach((priority) => {
    priorityGroups[priority].sort((a, b) => b.score - a.score);
  });

  const currentDate = new Date().toISOString().split('T')[0];

  const content = `# Prioritization Framework

**Purpose**: Maintain prioritization across all epics, requirements, and tasks using consistent criteria and business value analysis.

## Current Priorities (Updated: ${currentDate})

### ✅ **INTELLIGENT REPRIORITIZATION SYSTEM ACTIVE**
**Status**: Fully operational - processed ${allRequirements.length} requirements successfully  
**Commands**: \`sc priority update|show|validate\`  
**Last Run**: ${currentDate} - All priorities recalculated using topological dependency-aware scoring

### **Current Priority Distribution (${currentDate})**
${Object.entries(priorityCounts)
  .filter(([_, count]) => count > 0)
  .map(
    ([priority, count]) => `- **${count} ${priority}** priority requirements`
  )
  .join('\n')}

### Requirement-Level Priorities (Auto-Generated by Dependency-Aware System)

#### Critical Priority (P1) - Foundation & Dependencies (Score: 10.0+)
${
  priorityGroups.Critical.length > 0
    ? priorityGroups.Critical.map(
        (req) =>
          `- **[${req.title}](../requirements/${req.category}/req-${req.id.toLowerCase().replace('req-', '')}-*.md)**: ${req.id}${req.dependencyWarning} ${req.indicators}`
      ).join('\n')
    : '- None'
}

#### High Priority (P2) - Important Systems (Score: 8.0-9.9)
${
  priorityGroups.High.length > 0
    ? priorityGroups.High.map(
        (req) =>
          `- **[${req.title}](../requirements/${req.category}/req-${req.id.toLowerCase().replace('req-', '')}-*.md)**: ${req.id}${req.dependencyWarning} ${req.indicators}`
      ).join('\n')
    : '- None'
}

#### Medium Priority (P3) - Standard Features (Score: 6.0-7.9)
${
  priorityGroups.Medium.length > 0
    ? priorityGroups.Medium.map(
        (req) =>
          `- **[${req.title}](../requirements/${req.category}/req-${req.id.toLowerCase().replace('req-', '')}-*.md)**: ${req.id}${req.dependencyWarning} ${req.indicators}`
      ).join('\n')
    : '- None'
}

#### Low Priority (P4) - Future Features (Score: 4.0-5.9)
${
  priorityGroups.Low.length > 0
    ? priorityGroups.Low.map(
        (req) =>
          `- **[${req.title}](../requirements/${req.category}/req-${req.id.toLowerCase().replace('req-', '')}-*.md)**: ${req.id}${req.dependencyWarning} ${req.indicators}`
      ).join('\n')
    : '- None'
}

${
  priorityGroups.Deferred.length > 0
    ? `#### Deferred (Score: <4.0)
${priorityGroups.Deferred.map(
  (req) =>
    `- **[${req.title}](../requirements/${req.category}/req-${req.id.toLowerCase().replace('req-', '')}-*.md)**: ${req.id}${req.dependencyWarning} ${req.indicators}`
).join('\n')}`
    : ''
}

---

## Priority Calculation Methodology

### Topological Dependency-Aware Scoring
- **Dependencies get HIGHER priority** than things that depend on them
- **Dependency depth bonus**: +0.5 per level of dependency chains
- **Unmet dependency penalty**: -2.0 for requirements with unsatisfied dependencies

### Intrinsic Property Scoring
- **Base Score**: 5.0
- **Foundational systems**: +1.0 
- **Blocking requirements**: +1.0
- **System-level components**: +0.5
- **Infrastructure category**: +0.5
- **Safety-related**: +1.0
- **Compliance standards**: +0.5
- **Risk level (Critical/High)**: +0.5/+0.3

### Priority Ranges  
- **Critical (10.0+)**: Dependencies of critical systems, foundational requirements
- **High (8.0-9.9)**: Critical systems themselves, important blocking requirements  
- **Medium (6.0-7.9)**: Standard features and enhancements
- **Low (4.0-5.9)**: Nice-to-have features
- **Deferred (<4.0)**: Future considerations

### Key Indicators
- **🏗️** Foundational system
- **🚧** Blocking requirement  
- **🏥** Safety-related
- **🔗N** N requirements depend on this
- **⏳** Has unmet dependencies

---

## Usage Instructions

1. **Update priorities**: \`sc priority update\` - Recalculates all priorities and updates this file
2. **View distribution**: \`sc priority show\` - Shows current priority breakdown
3. **Validate consistency**: \`sc priority validate\` - Checks for dependency issues
4. **Focus on Critical/High**: Work on requirements without ⏳ indicators first
5. **Follow dependency order**: Complete dependencies before dependents

**Last Generated**: ${currentDate} by Intelligent Priority System
`;

  try {
    // Completely replace the file content (not append)
    fs.writeFileSync(prioritizationPath, content, { flag: 'w' });
    console.log(
      chalk.green('✅ Completely regenerated prioritization.md summary')
    );
  } catch (error) {
    console.error(
      chalk.red(`❌ Error updating prioritization.md: ${error.message}`)
    );
  }
}

function reviewPriorities() {
  console.log(chalk.blue('🎯 Fixed Requirements Priority Review'));
  console.log('========================================');

  const allRequirements = loadAllRequirements();
  const priorityCounts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    Deferred: 0
  };
  const criticalHighReqs = [];
  const changedFiles = []; // Track files that were updated

  // Sort by dependency depth first to show the priority logic
  const sortedReqs = allRequirements.sort((a, b) => {
    const depthA = calculateDependencyDepth(a.id, allRequirements);
    const depthB = calculateDependencyDepth(b.id, allRequirements);
    if (depthA !== depthB) return depthB - depthA; // Higher dependency depth first
    return b.id.localeCompare(a.id); // Then by ID
  });

  for (const req of sortedReqs) {
    const currentPriority = req.priority || 'Medium';
    const newScore = calculateDynamicPriority(req, allRequirements);
    const newPriority = scoreToPriority(newScore);
    const indicators = getIndicators(req, allRequirements);
    const dependencyDepth = calculateDependencyDepth(req.id, allRequirements);

    // Update the file if priority or score changed
    const currentScore = req.priorityScore || 5;
    const scoreChanged = Math.abs(currentScore - newScore) > 0.1; // Allow for small floating point differences

    if (currentPriority !== newPriority || scoreChanged) {
      updateRequirementPriority(req.filePath, newPriority, newScore);
      changedFiles.push(req.filePath); // Track changed file
      const changeIndicator =
        currentPriority !== newPriority
          ? `${currentPriority} → ${newPriority}`
          : `score ${currentScore} → ${newScore}`;
      console.log(
        chalk.green(`✅ Updated ${req.id}: ${changeIndicator} ${indicators}`)
      );
    } else {
      console.log(
        chalk.gray(
          `⚪ ${req.id}: ${newPriority} (Score: ${newScore}) ${indicators}`
        )
      );
    }

    // Show dependency relationships
    if (dependencyDepth > 0) {
      const dependents = findDependents(req.id, allRequirements);
      console.log(
        chalk.cyan(
          `   └─ ${dependents.length} requirements depend on this (depth: ${dependencyDepth})`
        )
      );
    }

    priorityCounts[newPriority]++;

    if (newPriority === 'Critical' || newPriority === 'High') {
      criticalHighReqs.push({
        id: req.id,
        priority: newPriority,
        score: newScore,
        indicators,
        dependencyDepth
      });
    }
  }

  console.log(`\n📊 Fixed Priority Distribution:`);
  console.log('==================================================');
  Object.entries(priorityCounts).forEach(([priority, count]) => {
    if (count > 0) {
      console.log(`${priority}: ${count} requirements`);
    }
  });

  console.log(`\n🎯 Critical & High Priority Requirements (Dependency-Aware):`);
  criticalHighReqs
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.dependencyDepth - a.dependencyDepth;
    })
    .forEach((req) => {
      console.log(
        `  ${req.id}: ${req.priority} (${req.score}) ${req.indicators}`
      );
    });

  // Update the prioritization.md summary file
  const { kanbanDir } = getConfigPaths();
  const prioritizationPath = path.join(
    process.cwd(),
    kanbanDir,
    'prioritization.md'
  );
  updatePrioritizationSummary(allRequirements);
  changedFiles.push(prioritizationPath); // Also track the summary file

  console.log(
    '\n✅ All requirement priorities updated with proper dependency logic!'
  );
  console.log('\n💡 Key improvements:');
  console.log('  • Dependencies now get HIGHER priority than dependents');
  console.log('  • Realistic score distribution (not everything at 10)');
  console.log(
    '  • Dependency depth indicators (🔗N shows N things depend on this)'
  );
  console.log('  • Unmet dependency warnings (⏳)');
  console.log('  • Auto-updated prioritization.md summary with current state');

  // Return changed files for potential commit
  return changedFiles;
}

function updateRequirementPriority(filePath, newPriority, newScore) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Update priority in frontmatter
    let updatedContent = content.replace(
      /^priority:\s*.+$/m,
      `priority: ${newPriority}`
    );

    // Update or add priorityScore
    if (updatedContent.includes('priorityScore:')) {
      updatedContent = updatedContent.replace(
        /^priorityScore:\s*.+$/m,
        `priorityScore: ${newScore}`
      );
    } else {
      // Add priorityScore after priority line
      updatedContent = updatedContent.replace(
        /^priority:\s*.+$/m,
        `priority: ${newPriority}\npriorityScore: ${newScore}`
      );
    }

    fs.writeFileSync(filePath, updatedContent);
  } catch (error) {
    console.error(chalk.red(`❌ Error updating ${filePath}: ${error.message}`));
  }
}

function showPriorities(options = {}) {
  let { limit, priority, showAll = false } = options;

  if (!showAll && !limit && !priority) {
    // Default behavior: show top 5 highest priority items
    console.log(chalk.blue('🎯 Top 5 Highest Priority Items:\n'));
    limit = 5; // Set default limit
  } else if (priority) {
    console.log(chalk.blue(`📊 ${priority} Priority Items:\n`));
  } else if (limit) {
    console.log(chalk.blue(`📊 Top ${limit} Highest Priority Items:\n`));
  } else {
    console.log(chalk.blue('📊 Current Priority Distribution:\n'));
  }

  const allRequirements = loadAllRequirements();
  const priorityCounts = {
    Critical: [],
    High: [],
    Medium: [],
    Low: [],
    Deferred: []
  };

  for (const req of allRequirements) {
    const reqPriority = req.priority || 'Medium';
    const indicators = getIndicators(req, allRequirements);
    const depStatus = getDependencyStatus(req, allRequirements);

    // Use full file path for clickable navigation
    const fullPath = req.filePath
      ? path.relative(process.cwd(), req.filePath)
      : req.id;
    let displayName = fullPath;
    if (!depStatus.satisfied) {
      displayName += ` (depends on: ${depStatus.pending.join(', ')})`;
    }

    if (priorityCounts[reqPriority]) {
      priorityCounts[reqPriority].push({
        id: req.id,
        title: displayName,
        category: req.category,
        indicators,
        score: req.priorityScore || 5,
        dependenciesMet: depStatus.satisfied,
        priority: reqPriority,
        filePath: req.filePath
      });
    }
  }

  // If filtering by specific priority
  if (priority && priorityCounts[priority]) {
    const items = priorityCounts[priority].sort(
      (a, b) => (b.score || 5) - (a.score || 5)
    );

    const displayItems = limit ? items.slice(0, limit) : items;
    displayItems.forEach((item) => {
      const depIndicator = item.dependenciesMet ? '' : ' ⏳';
      console.log(
        `  ${item.id}: ${item.title} [${item.category}] ${item.indicators}${depIndicator}`
      );
    });
    console.log('');
    return;
  }

  // If showing top N items across all priorities
  if (limit && !priority) {
    const allItems = [];
    Object.values(priorityCounts).forEach((items) => {
      allItems.push(...items);
    });

    allItems
      .sort((a, b) => (b.score || 5) - (a.score || 5))
      .slice(0, limit)
      .forEach((item) => {
        const depIndicator = item.dependenciesMet ? '' : ' ⏳';
        console.log(
          `  ${item.id}: ${item.title} [${item.priority}] [${item.category}] ${item.indicators}${depIndicator}`
        );
      });
    console.log('');
    return;
  }

  // Default: show all priorities
  Object.entries(priorityCounts).forEach(([priority, items]) => {
    if (items.length > 0) {
      console.log(chalk.bold(`${priority} Priority (${items.length}):`));
      items
        .sort((a, b) => (b.score || 5) - (a.score || 5))
        .forEach((item) => {
          const depIndicator = item.dependenciesMet ? '' : ' ⏳';
          console.log(
            `  ${item.id}: ${item.title} [${item.category}] ${item.indicators}${depIndicator}`
          );
        });
      console.log('');
    }
  });
}

function validatePriorities() {
  console.log(chalk.blue('🔍 Priority Validation Report'));
  console.log('=====================================');

  const allRequirements = loadAllRequirements();
  let issues = 0;

  for (const req of allRequirements) {
    const depStatus = getDependencyStatus(req, allRequirements);
    const currentScore = req.priorityScore || 5;
    const calculatedScore = calculateDynamicPriority(req, allRequirements);

    // Check for dependency issues
    if (!depStatus.satisfied && req.priority === 'Critical') {
      console.log(
        chalk.yellow(
          `⚠️  ${req.id}: Critical priority but has unmet dependencies: ${depStatus.pending.join(', ')}`
        )
      );
      issues++;
    }

    // Check for score mismatches
    if (Math.abs(currentScore - calculatedScore) > 0.1) {
      // Allow for floating point differences
      console.log(
        chalk.yellow(
          `⚠️  ${req.id}: Priority score mismatch - current: ${currentScore}, calculated: ${calculatedScore}`
        )
      );
      issues++;
    }
  }

  if (issues === 0) {
    console.log(chalk.green('✅ All priorities are properly aligned!'));
  } else {
    console.log(chalk.red(`❌ Found ${issues} priority alignment issues`));
    console.log('\n💡 Run "sc priority update" to fix these issues');
  }
}

async function main(action, options = {}) {
  // If called from commander.js, action is the first argument
  // If called directly, get from process.argv
  const command = action || process.argv[2];

  // Parse additional arguments for show command
  const args = process.argv.slice(3);

  // Handle options passed from CLI
  if (options.limit) {
    args.push('--limit', options.limit.toString());
  }
  if (options.all) {
    args.push('--all');
  }

  switch (command) {
    case 'update': {
      const changedFiles = reviewPriorities();

      // Handle --commit option using safe commit
      if (options.commit && changedFiles.length > 0) {
        const { performSafeCommit } = require('../git/git-commit');
        const relativePaths = changedFiles.map((f) => path.relative(process.cwd(), f));
        const commitMsg = `chore: Update requirement priorities (${changedFiles.length} files)\n\n[PRIORITY-UPDATE]`;
        
        try {
          await performSafeCommit(relativePaths, commitMsg, { verbose: true });
        } catch (error) {
          if (error.message?.includes('nothing to commit')) {
            console.log(chalk.yellow('\n⚠️  No changes to commit'));
          } else {
            console.error(chalk.red(`\n❌ Commit failed: ${error.message}`));
          }
        }
      } else if (changedFiles.length > 0) {
        // Show suggested commit command
        console.log(chalk.blue('\n💡 To commit these changes:'));
        console.log(chalk.cyan(`   sc priority update --commit`));
        console.log(chalk.gray('   Or manually:'));
        const relativePaths = changedFiles.map((f) =>
          path.relative(process.cwd(), f)
        );
        console.log(
          chalk.gray(
            `   git add ${relativePaths.slice(0, 3).join(' ')}${relativePaths.length > 3 ? ' ...' : ''}`
          )
        );
        console.log(
          chalk.gray(`   git commit -m "chore: Update requirement priorities"`)
        );
      }
      break;
    }

    case 'show':
    case 'list': {
      // Parse show options
      const showOptions = {};

      // Check for --all flag
      if (args.includes('--all') || args.includes('all')) {
        showOptions.showAll = true;
      }

      // Check for --limit or -n
      const limitIndex = args.findIndex(
        (arg) => arg === '--limit' || arg === '-n'
      );
      if (limitIndex !== -1 && args[limitIndex + 1]) {
        showOptions.limit = parseInt(args[limitIndex + 1], 10);
      }

      // Check for priority filter (Critical, High, Medium, Low)
      const priorityLevels = ['Critical', 'High', 'Medium', 'Low', 'Deferred'];
      const priorityArg = args.find((arg) => priorityLevels.includes(arg));
      if (priorityArg) {
        showOptions.priority = priorityArg;
      }

      // Check for numeric limit without --limit flag (can be after priority)
      if (!showOptions.limit) {
        const numericArg = args.find((arg) => /^\d+$/.test(arg));
        if (numericArg) {
          showOptions.limit = parseInt(numericArg, 10);
        }
      }

      showPriorities(showOptions);
      break;
    }

    case 'validate':
      validatePriorities();
      break;

    default:
      console.log(chalk.blue('🎯 Priority Management System'));
      console.log(`Usage: ${chalk.cyan('sc priority <command> [options]')}`);
      console.log('');
      console.log('Available Commands:');
      console.log(
        `  ${chalk.green('update')}      Update all requirement priorities using dependency-aware algorithm`
      );
      console.log(
        `  ${chalk.green('show')}        Display priority items with filtering options`
      );
      console.log(`  ${chalk.green('list')}        Alias for show command`);
      console.log(
        `  ${chalk.green('validate')}    Check for priority inconsistencies and dependency issues`
      );
      console.log('');
      console.log('Show Command Options:');
      console.log(
        `  ${chalk.cyan('sc priority show')}           # Show top 5 highest priority items (default)`
      );
      console.log(
        `  ${chalk.cyan('sc priority show 10')}        # Show top 10 highest priority items`
      );
      console.log(
        `  ${chalk.cyan('sc priority show Critical')}  # Show only Critical priority items`
      );
      console.log(
        `  ${chalk.cyan('sc priority show High 3')}    # Show top 3 High priority items`
      );
      console.log(
        `  ${chalk.cyan('sc priority show --all')}     # Show all items by priority level`
      );
      console.log(
        `  ${chalk.cyan('sc priority show --limit 15')} # Show top 15 items across all priorities`
      );
      console.log('');
      console.log('Update Command Options:');
      console.log(
        `  ${chalk.cyan('sc priority update')}           # Recalculate all priorities`
      );
      console.log(
        `  ${chalk.cyan('sc priority update --commit')}  # Recalculate and auto-commit changes`
      );
      console.log('');
      console.log('Examples:');
      console.log(
        `  ${chalk.cyan('sc priority update')}     # Recalculate all priorities`
      );
      console.log(
        `  ${chalk.cyan('sc priority show')}       # View top 5 highest priority items`
      );
      console.log(
        `  ${chalk.cyan('sc priority show all')}   # View all items by priority level`
      );
      console.log(
        `  ${chalk.cyan('sc priority validate')}   # Check for dependency conflicts`
      );
      console.log('');
      console.log('Features:');
      console.log('  • Topological dependency-aware scoring');
      console.log('  • Automatic prioritization.md updates');
      console.log('  • Auto-commit with --commit flag');
      console.log('  • Dependency conflict detection');
      console.log('  • Clear visual indicators (🔗, ⏳, 🚧)');
      console.log('  • Flexible filtering and limiting options');
  }
}

module.exports = {
  main,
  reviewPriorities,
  showPriorities,
  loadAllRequirements,
  calculateDynamicPriority,
  scoreToPriority,
  getIndicators,
  getDependencyStatus
};

if (require.main === module) {
  main();
}
