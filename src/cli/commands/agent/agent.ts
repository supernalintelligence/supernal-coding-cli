// @ts-nocheck
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');
const _GitSmart = require('../git/git-smart');
const { getConfig } = require('../../../scripts/config-loader');
const {
  generateTimestampedFilename,
  generateTimestamp
} = require('../../utils/timestamp');

/**
 * Agent Operations Command
 * Handles agent onboarding, handoffs, and status operations
 * Replaces scripts/agent-onboard.sh and scripts/agent-hand-off.sh
 */

async function agentCommand(action, options = {}) {
  switch (action) {
    case 'onboard':
      return await agentOnboard(options);
    case 'handoff':
      return await agentHandoff(options);
    case 'status':
      return await agentStatus(options);
    default:
      console.log(chalk.red(`❌ Unknown action: "${action}"`));
      console.log(chalk.blue('Available actions:\n'));
      console.log(
        chalk.blue.bold('🤖 Supernal Coding - Agent Workflow Management')
      );
      console.log(chalk.blue('=============================================='));
      console.log('');
      console.log(chalk.bold('Usage:'), 'sc agent <action> [options]');
      console.log('');
      console.log(chalk.bold('Actions:'));
      console.log(
        '  ',
        chalk.green('onboard'),
        '               Agent onboarding process'
      );
      console.log(
        '  ',
        chalk.green('handoff'),
        '               Create agent handoff document'
      );
      console.log(
        '  ',
        chalk.green('status'),
        '                Show current agent context'
      );
      console.log('');
      console.log(chalk.bold('Examples:'));
      console.log('  sc agent onboard');
      console.log(
        '  sc agent handoff --title="completed-feature-implementation"'
      );
      console.log('  sc agent status');
      console.log('');
      return false;
  }
}

/**
 * Agent Onboarding - Replaces scripts/agent-onboard.sh
 */
async function agentOnboard(_options = {}) {
  console.log(chalk.blue('🚀 Supernal Agent Onboarding'));
  console.log(chalk.blue('=================================='));

  // 1. Intelligent Branch Analysis
  console.log(chalk.yellow('\n1. Git & Branch Analysis'));
  const branchContext = analyzeBranchContext();
  displayBranchContext(branchContext);

  // Show flexibility - don't force rigid compliance
  if (branchContext.hasUncommitted) {
    console.log(chalk.yellow('\n⚠️  Note: Uncommitted changes detected'));
    console.log(
      chalk.blue('💡 Flexible options: commit, stash, or document in handoff')
    );
  }

  // 2. Git Status
  console.log(chalk.yellow('\n2. Git Status'));
  console.log('Recent commits:');
  try {
    const recentCommits = execSync('git log --oneline -3', {
      encoding: 'utf8'
    });
    console.log(recentCommits);
  } catch (_error) {
    console.log(chalk.red('❌ Error getting git log'));
  }

  // Check for uncommitted changes
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim()) {
      console.log(chalk.yellow('⚠️  Uncommitted changes detected'));
      console.log(gitStatus);
    } else {
      console.log(chalk.green('✅ Working tree clean'));
    }
  } catch (_error) {
    console.log(chalk.red('❌ Error checking git status'));
  }

  // 3. Handoff Detection & Prioritization
  console.log(chalk.yellow('\n3. Handoff Detection & Status'));
  const handoffFiles = findHandoffFiles();

  if (handoffFiles.length > 0) {
    console.log(chalk.blue('📋 HANDOFF DOCUMENTS FOUND:'));
    for (const file of handoffFiles) {
      const { creation_date, status } = extractHandoffMetadata(file);
      console.log(`  📄 ${file}`);
      console.log(`     📅 Created: ${creation_date}`);
      console.log(`     🎯 Status: ${status}`);
      console.log('');
    }

    const mostRecent = handoffFiles[0]; // Assuming sorted by modification time
    if (mostRecent) {
      console.log(chalk.green(`🎯 MOST RECENT HANDOFF: ${mostRecent}`));
      console.log(
        chalk.blue('💡 READ THIS FIRST: This contains your immediate context')
      );
    }
  } else {
    console.log(chalk.green('✅ No handoffs found - starting fresh'));
  }

  // 4. Cleanup Detection
  console.log(chalk.yellow('\n4. Cleanup Items Detection'));
  const cleanupItems = findCleanupItems();
  if (cleanupItems.length > 0) {
    console.log(chalk.red('🧹 CLEANUP ITEMS FOUND:'));
    cleanupItems.forEach((item) => {
      console.log(chalk.red(`  🚨 ${item}`));
    });
    console.log(
      chalk.yellow('⚠️  RECOMMENDATION: Address cleanup items before new work')
    );
  } else {
    console.log(chalk.green('✅ No cleanup items pending'));
  }

  // 5. Kanban Status
  console.log(chalk.yellow('\n5. Current Kanban Status'));
  const kanbanStats = getKanbanStatus();
  Object.entries(kanbanStats).forEach(([status, count]) => {
    console.log(`${status}:        ${count} tasks`);
  });

  // 6. Testing & Build Context
  console.log(chalk.yellow('\n6. Testing & Build Status'));
  const testContext = analyzeTestingContext();
  displayTestingContext(testContext);

  // 7. Dashboard Status Check
  console.log(chalk.yellow('\n7. Dashboard System Check'));
  if (fs.existsSync('dashboard/server.js')) {
    console.log(chalk.green('✅ Dashboard system found'));
    console.log(chalk.blue('💡 Quick test: cd dashboard && node server.js'));
    console.log(chalk.blue('🌐 Expected URL: http://localhost:3001'));
  } else {
    console.log(chalk.red('❌ Dashboard system not found'));
  }

  // 8. System Validation
  console.log(chalk.yellow('\n8. System Validation'));
  if (fs.existsSync('package.json')) {
    console.log(chalk.green('✅ Project package.json found'));
  } else {
    console.log(chalk.yellow('⚠️  No package.json found'));
  }

  if (fs.existsSync('.cursor/rules')) {
    const ruleCount = fs
      .readdirSync('.cursor/rules')
      .filter((f) => f.endsWith('.mdc')).length;
    console.log(chalk.green(`✅ Cursor rules found (${ruleCount} rules)`));
  } else {
    console.log(chalk.yellow('⚠️  No cursor rules found'));
  }

  // 9. Enhanced Branch & Todo Analysis
  console.log(chalk.blue('\n9. 🎯 STRATEGIC NEXT STEPS'));

  // Analyze existing branches and todos
  const branchAnalysis = analyzeExistingBranches();
  const todoContext = analyzeTodoContext();

  // Enhanced branch recommendations
  console.log(chalk.yellow('\n🌿 Branch Strategy:'));
  const branchRecs = generateBranchAnalysisRecommendations(branchAnalysis);
  branchRecs.forEach((rec) => console.log(`  ${rec}`));

  // Todo-driven recommendations
  console.log(chalk.yellow('\n📋 Todo-Driven Strategy:'));
  todoContext.suggestions.forEach((suggestion) =>
    console.log(`  ${suggestion}`)
  );

  // Show handoff-based recommendations
  if (handoffFiles.length > 0) {
    console.log(chalk.yellow('\n💡 HANDOFF-DRIVEN WORKFLOW:'));
    console.log('   1. Read most recent handoff for immediate context');
    console.log(
      '   2. Check if existing feature branch matches the handoff work'
    );
    console.log('   3. Commit to relevant feature branch or create new one');
    console.log('   4. Verify testing status before making changes');
  }

  // Check for cleanup items
  if (cleanupItems.length > 0) {
    console.log(chalk.red('\n🧹 CLEANUP FIRST:'));
    console.log('   Address cleanup items before starting new work');
  }

  console.log(chalk.green('\n🎯 Onboarding Complete!'));
  console.log('Next steps:');
  console.log('  1. Review any handoffs above');
  console.log('  2. Address any cleanup items');
  console.log('  3. Check kanban for current priorities');
  console.log('  4. Start development work');

  console.log(chalk.blue('\nKey references:'));
  const config = getConfig();
  const kanbanDir = config.getKanbanBaseDirectory();
  console.log(`  - ${kanbanDir}/README.md (Kanban system)`);
  console.log('  - .cursor/rules/ (AI agent rules)');
  console.log(
    `  - ${config.getKanbanBaseDirectory()}/handoffs/ (Handoff documents)`
  );

  return true;
}

/**
 * Helper Functions
 */

function findHandoffFiles() {
  const files = [];

  try {
    // Just look in the config-based handoffs directory
    const config = getConfig();
    const handoffDir = path.join(config.getKanbanBaseDirectory(), 'handoffs');
    if (fs.existsSync(handoffDir)) {
      const handoffFiles = fs
        .readdirSync(handoffDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(handoffDir, f));
      files.push(...handoffFiles);
    }
  } catch (_error) {
    console.log(chalk.yellow('⚠️  Could not read handoff directory'));
  }

  return files;
}

function extractHandoffMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const creationMatch = content.match(/Created.*?:\s*(.+)/i);
    const statusMatch = content.match(/Status.*?:\s*(.+)/i);

    return {
      creation_date: creationMatch ? creationMatch[1].trim() : '',
      status: statusMatch ? statusMatch[1].trim() : ''
    };
  } catch (_error) {
    return { creation_date: '', status: '' };
  }
}

function findCleanupItems() {
  const config = getConfig();
  const cleanupDirs = [
    `${config.getKanbanBaseDirectory()}/immediate/cleanup`,
    'cleanup',
    'tasks/cleanup'
  ];

  const items = [];
  for (const dir of cleanupDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
      items.push(...files.map((f) => path.join(dir, f)));
    }
  }

  return items;
}

function getKanbanStatus() {
  const stats = { TODO: 0, DOING: 0, BLOCKED: 0 };

  const config = getConfig();
  const configuredKanbanDir = config.getKanbanBaseDirectory();
  const kanbanDirs = [configuredKanbanDir, 'kanban'];

  for (const baseDir of kanbanDirs) {
    if (fs.existsSync(baseDir)) {
      for (const status of ['TODO', 'DOING', 'BLOCKED']) {
        const statusDirs = [
          path.join(baseDir, status),
          path.join(baseDir, 'tasks', status),
          path.join(baseDir, 'immediate', status.toLowerCase())
        ];

        for (const statusDir of statusDirs) {
          if (fs.existsSync(statusDir)) {
            const count = fs
              .readdirSync(statusDir)
              .filter((f) => f.endsWith('.md')).length;
            stats[status] += count;
          }
        }
      }
      break; // Use first found kanban directory
    }
  }

  return stats;
}

/**
 * Analyze current branch context and provide intelligent recommendations
 */
function analyzeBranchContext() {
  const context = {
    branch: 'unknown',
    isMain: false,
    commitsAhead: 0,
    commitsBehind: 0,
    hasUncommitted: false,
    recentCommits: [],
    recommendations: []
  };

  try {
    // Get current branch
    context.branch = execSync('git branch --show-current', {
      encoding: 'utf8'
    }).trim();
    context.isMain = ['main', 'master'].includes(context.branch);

    // Check for uncommitted changes
    const statusOutput = execSync('git status --porcelain', {
      encoding: 'utf8'
    });
    context.hasUncommitted = statusOutput.trim().length > 0;

    // Get commit relationship with main
    if (!context.isMain) {
      try {
        const aheadBehind = execSync(
          `git rev-list --left-right --count main...${context.branch}`,
          { encoding: 'utf8' }
        ).trim();
        const [behind, ahead] = aheadBehind.split('\t').map(Number);
        context.commitsBehind = behind;
        context.commitsAhead = ahead;
      } catch (_error) {
        // Branch might not have common history with main
        context.commitsAhead = -1; // Unknown
      }
    }

    // Get recent commits
    try {
      const commits = execSync('git log --oneline -3', { encoding: 'utf8' })
        .trim()
        .split('\n');
      context.recentCommits = commits;
    } catch (_error) {
      // No commits or other git issue
    }

    // Generate intelligent recommendations
    context.recommendations = generateBranchRecommendations(context);
  } catch (_error) {
    context.recommendations.push(
      '⚠️  Could not analyze git state - may not be in a git repository'
    );
  }

  return context;
}

/**
 * Generate flexible branch recommendations based on context
 */
function generateBranchRecommendations(context) {
  const recommendations = [];

  if (context.isMain) {
    if (context.hasUncommitted) {
      recommendations.push('⚠️  You have uncommitted changes on main branch');
      recommendations.push(
        '💡 Consider: Commit changes or create feature branch for safety'
      );
    } else {
      recommendations.push(
        "✅ You're on main with clean state - good starting point"
      );
      recommendations.push(
        '💡 For new work: Consider `git checkout -b feature/task-name`'
      );
    }
  } else {
    // On feature branch
    if (context.commitsAhead > 0) {
      recommendations.push(
        `✅ On feature branch "${context.branch}" with ${context.commitsAhead} commits ahead`
      );
      if (context.hasUncommitted) {
        recommendations.push(
          '⚠️  Has uncommitted changes - commit before handoff'
        );
      } else {
        recommendations.push(
          '✅ Clean state - good for handoff or continued work'
        );
      }
    } else if (context.commitsAhead === 0) {
      recommendations.push(
        `ℹ️  Feature branch "${context.branch}" has no commits ahead of main`
      );
      recommendations.push(
        '💡 This might be a fresh branch or recently merged'
      );
    }

    if (context.commitsBehind > 0) {
      recommendations.push(
        `ℹ️  Branch is ${context.commitsBehind} commits behind main`
      );
      recommendations.push(
        '💡 Consider: `git merge main` to get latest changes'
      );
    }
  }

  return recommendations;
}

/**
 * Display branch context analysis
 */
function displayBranchContext(context) {
  console.log(chalk.yellow('\n🌿 Branch Context Analysis'));
  console.log(`Current Branch: ${chalk.cyan(context.branch)}`);

  if (!context.isMain) {
    if (context.commitsAhead >= 0) {
      console.log(`Commits Ahead: ${chalk.green(context.commitsAhead)}`);
    }
    if (context.commitsBehind > 0) {
      console.log(`Commits Behind: ${chalk.yellow(context.commitsBehind)}`);
    }
  }

  console.log(
    `Working Directory: ${context.hasUncommitted ? chalk.yellow('Has changes') : chalk.green('Clean')}`
  );

  if (context.recentCommits.length > 0) {
    console.log('\nRecent Commits:');
    context.recentCommits.forEach((commit) => {
      console.log(chalk.gray(`  ${commit}`));
    });
  }

  console.log(chalk.blue('\n💡 Recommendations:'));
  context.recommendations.forEach((rec) => {
    console.log(`  ${rec}`);
  });
}

/**
 * Analyze testing and build context
 */
function analyzeTestingContext() {
  const context = {
    hasTests: false,
    testFiles: [],
    hasBuildScript: false,
    buildStatus: 'unknown',
    testStatus: 'unknown',
    recommendations: []
  };

  try {
    // Check for package.json and scripts
    if (fs.existsSync('package.json')) {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      context.hasBuildScript = !!packageJson.scripts?.build;
      context.hasTestScript = !!packageJson.scripts?.test;
    }

    // Find test files
    const testPatterns = [
      '**/*.test.js',
      '**/*.spec.js',
      '**/*.test.ts',
      '**/*.spec.ts',
      'tests/**/*.js',
      'test/**/*.js'
    ];

    for (const pattern of testPatterns) {
      try {
        const files = execSync(
          `find . -name "${pattern.replace('**/', '')}" -type f`,
          { encoding: 'utf8' }
        )
          .split('\n')
          .filter((f) => f.trim())
          .slice(0, 10); // Limit to prevent overwhelming output
        context.testFiles.push(...files);
      } catch (_error) {
        // Pattern might not match anything
      }
    }

    context.hasTests = context.testFiles.length > 0;

    // Try to determine build status
    if (context.hasBuildScript) {
      try {
        execSync('npm run build', { stdio: 'pipe' });
        context.buildStatus = 'passing';
      } catch (_error) {
        context.buildStatus = 'failing';
      }
    }

    // Try to determine test status (but don't run long tests)
    if (context.hasTestScript) {
      try {
        // Quick check - just see if test command exists
        execSync('npm test --help', { stdio: 'pipe' });
        context.testStatus = 'available';
      } catch (_error) {
        context.testStatus = 'unavailable';
      }
    }

    // Generate testing recommendations
    context.recommendations = generateTestingRecommendations(context);
  } catch (_error) {
    context.recommendations.push('⚠️  Could not analyze testing context');
  }

  return context;
}

/**
 * Generate testing recommendations based on context
 */
function generateTestingRecommendations(context) {
  const recommendations = [];

  if (context.hasTests) {
    recommendations.push(`✅ Found ${context.testFiles.length} test files`);
    if (context.hasTestScript) {
      recommendations.push('💡 Run tests with: npm test');
    }
  } else {
    recommendations.push('⚠️  No test files detected');
    recommendations.push('💡 Consider adding tests for new functionality');
  }

  if (context.hasBuildScript) {
    if (context.buildStatus === 'passing') {
      recommendations.push('✅ Build is passing');
    } else if (context.buildStatus === 'failing') {
      recommendations.push('❌ Build is failing - needs attention');
    } else {
      recommendations.push('💡 Check build status with: npm run build');
    }
  }

  return recommendations;
}

/**
 * Display testing context analysis
 */
function displayTestingContext(context) {
  if (context.hasTests) {
    console.log(
      chalk.green(`✅ Tests: Found ${context.testFiles.length} test files`)
    );
    if (context.testFiles.length <= 5) {
      context.testFiles.forEach((file) => {
        console.log(chalk.gray(`  ${file}`));
      });
    } else {
      console.log(
        chalk.gray(
          `  ${context.testFiles.slice(0, 3).join(', ')} ... and ${context.testFiles.length - 3} more`
        )
      );
    }
  } else {
    console.log(chalk.yellow('⚠️  Tests: No test files detected'));
  }

  if (context.hasBuildScript) {
    const buildColor =
      context.buildStatus === 'passing'
        ? chalk.green
        : context.buildStatus === 'failing'
          ? chalk.red
          : chalk.yellow;
    console.log(buildColor(`Build Status: ${context.buildStatus}`));
  }

  if (context.recommendations.length > 0) {
    console.log(chalk.blue('\n💡 Testing Recommendations:'));
    context.recommendations.forEach((rec) => {
      console.log(`  ${rec}`);
    });
  }
}

/**
 * Agent Handoff - Create and manage agent handoff documents
 */
async function agentHandoff(options = {}) {
  console.log(chalk.blue('🤝 Agent Handoff'));
  console.log(chalk.blue('=================================='));

  // 1. Branch Context Analysis
  console.log(chalk.yellow('\n🌿 Current Work Context'));
  const branchContext = analyzeBranchContext();
  displayBranchContext(branchContext);

  // 2. Testing Context
  console.log(chalk.yellow('\n🧪 Testing & Build Status'));
  const testContext = analyzeTestingContext();
  displayTestingContext(testContext);

  // 3. Show existing handoffs
  console.log(chalk.yellow('\n📋 Existing Handoffs:'));
  const existingHandoffs = findExistingHandoffs();

  if (existingHandoffs.length > 0) {
    existingHandoffs.forEach((handoff, index) => {
      console.log(chalk.green(`${index + 1}. ${handoff.filename}`));
      console.log(chalk.gray(`   📅 Modified: ${handoff.modifiedDate}`));
      console.log(chalk.gray(`   📁 Path: ${handoff.relativePath}`));
      console.log('');
    });
  } else {
    console.log(chalk.gray('   No existing handoffs found'));
  }

  // If no title provided, show help and exit
  if (!options.title) {
    console.log(chalk.yellow('\n💡 To create a new handoff:'));
    console.log(
      chalk.blue('   sc agent handoff --title "your-handoff-title-snake-case"')
    );
    console.log(
      chalk.gray(
        '   Example: sc agent handoff --title "priority-system-rewrite"'
      )
    );
    return true;
  }

  // Create new handoff
  console.log(chalk.yellow(`\n🚀 Creating new handoff: ${options.title}`));

  // Generate proper timestamped filename using shared utility
  const filename = generateTimestampedFilename(options.title);

  // Determine handoff directory
  const config = getConfig();
  const handoffDir = path.join(config.getKanbanBaseDirectory(), 'handoffs');

  // Ensure handoff directory exists
  await fs.ensureDir(handoffDir);

  // Full path for the new handoff
  const handoffPath = path.join(handoffDir, filename);

  // Check if file already exists
  if (await fs.pathExists(handoffPath)) {
    console.log(chalk.red(`❌ Handoff already exists: ${handoffPath}`));
    console.log(
      chalk.yellow('💡 Use a different title or edit the existing handoff')
    );
    return false;
  }

  // Get current branch info
  let currentBranch = 'unknown';
  try {
    currentBranch = execSync('git branch --show-current', {
      encoding: 'utf8'
    }).trim();
  } catch (_error) {
    console.log(chalk.yellow('⚠️  Could not determine current branch'));
  }

  // Create handoff content from template with intelligent context
  const handoffContent = createHandoffContent({
    title: options.title,
    date: generateTimestamp(),
    branch: currentBranch,
    branchContext: branchContext,
    testContext: testContext
  });

  // Write the handoff file
  try {
    await fs.writeFile(handoffPath, handoffContent);
    console.log(chalk.green(`✅ Handoff created successfully!`));
    console.log('');
    console.log(chalk.blue('📁 Handoff Location:'));
    console.log(chalk.cyan(`   ${handoffPath}`));
    console.log('');
    console.log(chalk.blue('🎯 Next Steps:'));
    console.log(
      chalk.yellow('   1. Edit the handoff file to add your specific details')
    );
    console.log(chalk.yellow('   2. Fill in the Work Completed section'));
    console.log(
      chalk.yellow('   3. Document Next Steps for the receiving agent')
    );
    console.log(chalk.yellow('   4. List all modified files and resources'));
    console.log('');
    console.log(
      chalk.green(
        '💡 The handoff template has been pre-filled with current context.'
      )
    );
    console.log(
      chalk.green('   Update the sections marked with [FILL IN] placeholders.')
    );

    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Error creating handoff: ${error.message}`));
    return false;
  }
}

/**
 * Find existing handoff files
 */
function findExistingHandoffs() {
  const config = getConfig();
  const handoffDir = path.join(config.getKanbanBaseDirectory(), 'handoffs');

  if (!fs.existsSync(handoffDir)) {
    return [];
  }

  try {
    const files = fs
      .readdirSync(handoffDir)
      .filter((f) => f.endsWith('.md'))
      .map((filename) => {
        const filePath = path.join(handoffDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          relativePath: path.relative(process.cwd(), filePath),
          modifiedDate: stats.mtime.toISOString().split('T')[0],
          fullPath: filePath
        };
      })
      .sort((a, b) => b.modifiedDate.localeCompare(a.modifiedDate)); // Sort by date, newest first

    return files;
  } catch (error) {
    console.log(
      chalk.yellow(`⚠️  Error reading handoff directory: ${error.message}`)
    );
    return [];
  }
}

/**
 * Generate branch-specific guidance for handoffs
 */
function generateBranchGuidance(branchContext) {
  const guidance = [];

  if (branchContext.isMain) {
    guidance.push(
      '📍 Currently on main branch - work was done directly on main'
    );
    if (branchContext.hasUncommitted) {
      guidance.push(
        '⚠️  Has uncommitted changes on main - should commit before handoff'
      );
    }
  } else {
    guidance.push(`📍 Working on feature branch: ${branchContext.branch}`);
    if (branchContext.commitsAhead > 0) {
      guidance.push(
        `✅ Branch has ${branchContext.commitsAhead} commits ahead of main`
      );
    }
    if (branchContext.commitsBehind > 0) {
      guidance.push(
        `ℹ️  Branch is ${branchContext.commitsBehind} commits behind main - may need sync`
      );
    }
  }

  return guidance;
}

/**
 * Generate testing-specific guidance for handoffs
 */
function generateTestGuidance(testContext) {
  const guidance = [];

  if (testContext.hasTests) {
    guidance.push(`✅ Project has ${testContext.testFiles.length} test files`);
    if (testContext.buildStatus === 'passing') {
      guidance.push('✅ Build is currently passing');
    } else if (testContext.buildStatus === 'failing') {
      guidance.push('❌ Build is failing - needs attention before merge');
    }
  } else {
    guidance.push(
      '⚠️  No test files detected - consider adding tests for new functionality'
    );
  }

  return guidance;
}

/**
 * Generate next steps guidance based on context and completion status
 */
function generateNextStepsGuidance(branchContext, testContext, isCompleted) {
  const guidance = [];

  if (isCompleted) {
    // Completed work guidance
    if (branchContext.hasUncommitted) {
      guidance.push('Commit any remaining changes to current feature branch');
    }
    if (testContext.buildStatus === 'failing') {
      guidance.push('Fix failing build before merge');
    } else if (
      testContext.buildStatus === 'unknown' &&
      testContext.hasBuildScript
    ) {
      guidance.push('Verify build passes with: npm run build');
    }
    if (!branchContext.isMain && branchContext.commitsAhead > 0) {
      guidance.push('Consider creating PR/merge request to main');
    }
  } else {
    // In-progress work guidance
    if (branchContext.isMain) {
      guidance.push(
        'Look for existing feature branches related to current work'
      );
      guidance.push(
        'If none found, create new feature branch: git checkout -b feature/task-name'
      );
    } else {
      guidance.push('Continue development on current feature branch');
    }
    if (branchContext.commitsBehind > 0) {
      guidance.push('Consider syncing with main: git merge main');
    }
    if (branchContext.hasUncommitted) {
      guidance.push('Commit current progress before switching branches');
    }
  }

  return guidance;
}

/**
 * Create handoff content from template with intelligent context
 */
function createHandoffContent({
  title,
  date,
  branch,
  branchContext,
  testContext
}) {
  const formattedTitle = title
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Determine handoff type and recommendations
  const isCompleted = title.toLowerCase().includes('completed');
  const handoffType = isCompleted ? 'COMPLETED' : 'IN-PROGRESS';

  // Generate intelligent guidance based on context
  const branchGuidance = generateBranchGuidance(branchContext);
  const testGuidance = generateTestGuidance(testContext);
  const nextStepsGuidance = generateNextStepsGuidance(
    branchContext,
    testContext,
    isCompleted
  );

  return `# 🚀 HANDOFF: ${formattedTitle}

**Status**: ${handoffType === 'COMPLETED' ? '✅ **COMPLETED**' : '🔄 **IN-PROGRESS**'}  
**Priority**: [FILL IN: P1-Critical, P2-Standard, P3-Low]  
**Handoff Date**: ${date}  
**From**: Claude Assistant  
**To**: Next Agent  
**Branch**: ${branch}

---

## 🎯 **Task Summary**

[FILL IN: ${isCompleted ? 'Detailed completion summary of what was accomplished' : 'Current objective and what you were trying to accomplish'}]

## ${isCompleted ? '✅ **Work Completed**' : '🔄 **Current Progress**'}

### **${isCompleted ? 'Major Accomplishments' : 'Progress Made'}**
- [x] [FILL IN: ${isCompleted ? 'Major accomplishment 1' : "What's been completed so far"}]
- [x] [FILL IN: ${isCompleted ? 'Major accomplishment 2' : 'Current working state'}]
- [x] [FILL IN: ${isCompleted ? 'Major accomplishment 3' : 'Any debugging or investigation done'}]

### **Branch & Git Context**
${branchGuidance.map((g) => `- ${g}`).join('\n')}

### **Testing & Build Context**
${testGuidance.map((g) => `- ${g}`).join('\n')}

### **Recent Commits**
\`\`\`
${branchContext.recentCommits.slice(0, 3).join('\n')}
\`\`\`

---

## ${isCompleted ? '🔄 **Follow-up Work**' : '🚧 **Current Blockers & Next Steps**'}

### **${isCompleted ? 'Future Enhancements (Optional)' : 'Immediate Actions Required'}**
${nextStepsGuidance.map((g) => `- [ ] ${g}`).join('\n')}
- [ ] [FILL IN: ${isCompleted ? 'Optional future enhancement' : 'Specific next action needed'}]
- [ ] [FILL IN: ${isCompleted ? 'Maintenance consideration' : 'Following step required'}]

### **Important Context**
- [FILL IN: ${isCompleted ? 'Key decisions made and lessons learned' : 'Current approach being taken and why'}]
- [FILL IN: ${isCompleted ? "What worked well vs what didn't" : 'Specific blockers or challenges encountered'}]
${!isCompleted ? '- [FILL IN: Debugging info - error messages, logs, investigation findings]' : ''}

---

## 📂 **Resources & Files**

### **Key Files Modified**
- \`[FILL IN: file1.ext]\` - [Description of changes]
- \`[FILL IN: file2.ext]\` - [Description of changes]
- \`[FILL IN: file3.ext]\` - [Description of changes]

### **Dependencies Added/Changed**
- [FILL IN: Any new dependencies or package changes]

### **${isCompleted ? 'Testing/Verification Performed' : 'Testing Status'}**
${testContext.testFiles.length > 0 ? `- Test files available: ${testContext.testFiles.slice(0, 3).join(', ')}${testContext.testFiles.length > 3 ? '...' : ''}` : '- No test files detected'}
${testContext.hasBuildScript ? `- Build script available: npm run build` : ''}
- [FILL IN: ${isCompleted ? 'Specific verification steps taken' : 'Testing that still needs to be done'}]

---

## 🎯 **${isCompleted ? 'Success Metrics' : 'Definition of Done'}**

### **${isCompleted ? 'Acceptance Criteria Met' : 'Acceptance Criteria'}**
- [${isCompleted ? 'x' : ' '}] [FILL IN: Specific completion criteria]
- [${isCompleted ? 'x' : ' '}] [FILL IN: Verification requirements]
- [${isCompleted ? 'x' : ' '}] [FILL IN: Quality checks]

---

## 🚨 **Known Issues & ${isCompleted ? 'Technical Debt' : 'Blockers'}**

### **${isCompleted ? 'Outstanding Issues' : 'Current Blockers'}**
- [FILL IN: ${isCompleted ? 'Any known limitations or issues' : 'Specific blockers preventing progress'}]

### **${isCompleted ? 'Technical Debt' : "What's Been Tried"}**
- [FILL IN: ${isCompleted ? 'Any technical debt created or discovered' : 'Approaches attempted and their results'}]

---

**🚀 Ready to Continue**: [FILL IN: ${isCompleted ? 'Brief status - work is complete and ready for review/merge' : 'Current state and what the next agent should focus on immediately'}]
`;
}

/**
 * Agent Status - Placeholder for future implementation
 */
async function agentStatus(_options = {}) {
  console.log(chalk.blue('📊 Agent Status'));
  console.log('Status functionality coming soon...');
  return true;
}

/**
 * Analyze existing feature branches to see if any are relevant to current work
 */
function analyzeExistingBranches() {
  const branches = {
    all: [],
    feature: [],
    current: '',
    recommendations: []
  };

  try {
    // Get all branches
    const allBranches = execSync('git branch -a', { encoding: 'utf8' })
      .split('\n')
      .map((b) => b.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, ''))
      .filter((b) => b.trim() && !b.includes('HEAD'))
      .filter((b, i, arr) => arr.indexOf(b) === i); // Remove duplicates

    branches.all = allBranches;
    branches.current = execSync('git branch --show-current', {
      encoding: 'utf8'
    }).trim();

    // Filter feature branches
    branches.feature = allBranches.filter(
      (b) =>
        b.startsWith('feature/') ||
        b.startsWith('feat/') ||
        b.includes('req-') ||
        b.includes('task-')
    );

    // Generate recommendations (defined later in file)
    branches.recommendations = [];
  } catch (_error) {
    branches.recommendations.push('⚠️  Could not analyze git branches');
  }

  return branches;
}

/**
 * Analyze current todo items to suggest branch strategy
 */
function analyzeTodoContext() {
  const context = {
    todos: [],
    priorities: [],
    suggestions: []
  };

  try {
    // Check immediate todos
    const config = getConfig();
    const todoDir = path.join(
      config.getKanbanBaseDirectory(),
      'immediate',
      'todos'
    );
    if (fs.existsSync(todoDir)) {
      context.todos = fs
        .readdirSync(todoDir)
        .filter((f) => f.endsWith('.md'))
        .slice(0, 5); // Limit for performance
    }

    // Check tasks todo
    const tasksDir = path.join(
      config.getKanbanBaseDirectory(),
      'tasks',
      'todo'
    );
    if (fs.existsSync(tasksDir)) {
      const taskTodos = fs
        .readdirSync(tasksDir)
        .filter((f) => f.endsWith('.md'))
        .slice(0, 5);
      context.todos.push(...taskTodos);
    }

    // Analyze todo content for branch suggestions
    context.suggestions = generateTodoBranchSuggestions(context.todos);
  } catch (_error) {
    context.suggestions.push('⚠️  Could not analyze todo context');
  }

  return context;
}

/**
 * Generate branch recommendations based on existing branches
 */
function generateBranchAnalysisRecommendations(branches) {
  const recommendations = [];

  if (branches.current === 'main' || branches.current === 'master') {
    if (branches.feature.length > 0) {
      recommendations.push('🌿 Existing feature branches found:');
      branches.feature.slice(0, 3).forEach((branch) => {
        recommendations.push(`   • ${branch} - consider if work is related`);
      });
      recommendations.push(
        '💡 Check if any existing branch matches your current work'
      );
    }
    recommendations.push(
      '💡 For new work: git checkout -b feature/your-task-name'
    );
  } else {
    recommendations.push(`✅ On feature branch: ${branches.current}`);
    recommendations.push('💡 Continue on this branch if work is related');
    if (branches.feature.length > 1) {
      const otherBranches = branches.feature
        .filter((b) => b !== branches.current)
        .slice(0, 2);
      if (otherBranches.length > 0) {
        recommendations.push('🌿 Other feature branches available:');
        otherBranches.forEach((branch) => {
          recommendations.push(`   • ${branch}`);
        });
      }
    }
  }

  return recommendations;
}

/**
 * Generate branch suggestions based on todo content
 */
function generateTodoBranchSuggestions(todos) {
  const suggestions = [];

  if (todos.length === 0) {
    suggestions.push(
      'ℹ️  No immediate todos found - check kanban for current priorities'
    );
    return suggestions;
  }

  suggestions.push(`📋 Found ${todos.length} todo items:`);
  todos.slice(0, 3).forEach((todo) => {
    const name = todo.replace('.md', '').replace(/^P\d+_/, '');
    suggestions.push(`   • ${name}`);
  });

  if (todos.length > 0) {
    suggestions.push(
      '💡 Consider creating feature branch based on todo priority'
    );
    suggestions.push('💡 Example: git checkout -b feature/todo-item-name');
  }

  return suggestions;
}

module.exports = agentCommand;
