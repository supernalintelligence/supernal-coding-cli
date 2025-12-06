const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');

// Import installation modules
const { installCursorRules } = require('./cursor-rules');
const { installMCPConfiguration } = require('./mcp-configuration');
// Note: installTemplates intentionally not imported - templates stay in SC package only
const { installGitManagement } = require('./git-management');
const {
  createKanbanStructureSafe,
  createDocsStructureSafe,
  installWorkflowSystem,
  installGuidesSystem,
  installPlanningSystem,
  installFeaturesSystem
} = require('./docs-structure');
const { createTestRepository } = require('./test-setup');
const { installComplianceTemplates } = require('./docs-structure');

/**
 * Main equipment pack installation orchestrator
 * @param {string} targetDir - Target installation directory
 * @param {Object} activeFeatures - Active features configuration
 * @param {Object} options - Installation options
 */
async function installEquipmentPack(targetDir, activeFeatures, options = {}) {
  console.log(chalk.yellow('\n🔧 Installing Equipment Pack Components...'));

  // Create directory structure (kanban and requirements are created inside docs)
  // Note: No 'scripts' directory - all functionality is in 'sc' command
  // Note: No 'templates' directory - templates are in SC package only (no duplication)
  const dirs = [
    '.cursor/rules',
    'tests/e2e',
    'tests/requirements',
    'supernal-code-package/lib/cli/commands',
    'docs'
  ];

  // Only create test-repos for development environments or when explicitly requested
  const isDevelopmentInstall =
    process.env.NODE_ENV === 'development' ||
    process.env.SC_DEV_MODE === 'true' ||
    options.includeTesting === true ||
    options.development === true;

  if (isDevelopmentInstall) {
    dirs.push('test-repos');
  }

  for (const dir of dirs) {
    await fs.ensureDir(path.join(targetDir, dir));
  }

  // Install Core System cursor rules
  console.log(chalk.blue('📋 Installing cursor rules...'));
  await installCursorRules(targetDir, activeFeatures, options);

  // Install MCP configuration with environment-specific setup
  console.log(chalk.blue('🔌 Installing MCP configuration...'));
  await installMCPConfiguration(targetDir, activeFeatures, options);

  // Templates are in SC package - no need to copy to project
  // (Removed template duplication - templates reference package location)
  console.log(
    chalk.gray('   ⏭️  Templates located in SC package (no duplication)')
  );

  // Install git management files if enabled
  if (activeFeatures.gitManagement) {
    console.log(chalk.blue('🔧 Installing git management...'));
    await installGitManagement(targetDir, activeFeatures, options);
  }

  // Create kanban directory structure (only if not exists)
  console.log(chalk.blue('📋 Creating kanban structure...'));
  await createKanbanStructureSafe(targetDir, options);

  // Create docs directory structure (only if not exists)
  console.log(chalk.blue('📚 Creating docs structure...'));
  await createDocsStructureSafe(targetDir, options);

  // Install workflow system from templates
  console.log(chalk.blue('📚 Installing workflow system...'));
  await installWorkflowSystem(targetDir, options);

  // Install guides from templates
  console.log(chalk.blue('📖 Installing guides...'));
  await installGuidesSystem(targetDir, options);

  // Install planning structure from templates
  console.log(chalk.blue('📋 Installing planning system...'));
  await installPlanningSystem(targetDir, options);

  // Install features directory structure from templates
  console.log(chalk.blue('📂 Installing features system...'));
  await installFeaturesSystem(targetDir, options);

  // Copy compliance templates to docs/compliance (only if not exists)
  console.log(chalk.blue('🛡️ Installing compliance templates...'));
  await installComplianceTemplates(targetDir, options);

  // Create test repository only for development environments
  if (isDevelopmentInstall) {
    console.log(chalk.blue('🧪 Creating test repository...'));
    await createTestRepository(targetDir);
  } else {
    console.log(
      chalk.gray(
        '   ⏭️  Skipping test repository creation (not in development mode)'
      )
    );
  }

  console.log(chalk.green('✅ Equipment Pack installation complete!'));
  console.log(chalk.white('   ✓ Enhanced YAML configuration created'));
}

module.exports = {
  installEquipmentPack
};
