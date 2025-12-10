import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'node:path';

const { installCursorRules } = require('./cursor-rules');
const { installMCPConfiguration } = require('./mcp-configuration');
const { installGitManagement } = require('./git-management');
const {
  createKanbanStructureSafe,
  createDocsStructureSafe,
  installWorkflowSystem,
  installGuidesSystem,
  installPlanningSystem,
  installFeaturesSystem,
  installComplianceTemplates
} = require('./docs-structure');
const { createTestRepository } = require('./test-setup');

interface ActiveFeatures {
  gitManagement?: boolean;
  testingFramework?: boolean;
  [key: string]: unknown;
}

interface EquipmentPackOptions {
  includeTesting?: boolean;
  development?: boolean;
  [key: string]: unknown;
}

/**
 * Main equipment pack installation orchestrator
 */
async function installEquipmentPack(
  targetDir: string,
  activeFeatures: ActiveFeatures,
  options: EquipmentPackOptions = {}
): Promise<void> {
  console.log(chalk.yellow('\n🔧 Installing Equipment Pack Components...'));

  const dirs = [
    '.cursor/rules',
    'tests/e2e',
    'tests/requirements',
    'supernal-code-package/lib/cli/commands',
    'docs'
  ];

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

  console.log(chalk.blue('📋 Installing cursor rules...'));
  await installCursorRules(targetDir, activeFeatures, options);

  console.log(chalk.blue('🔌 Installing MCP configuration...'));
  await installMCPConfiguration(targetDir, activeFeatures, options);

  console.log(
    chalk.gray('   ⏭️  Templates located in SC package (no duplication)')
  );

  if (activeFeatures.gitManagement) {
    console.log(chalk.blue('🔧 Installing git management...'));
    await installGitManagement(targetDir, activeFeatures, options);
  }

  console.log(chalk.blue('📋 Creating kanban structure...'));
  await createKanbanStructureSafe(targetDir, options);

  console.log(chalk.blue('📚 Creating docs structure...'));
  await createDocsStructureSafe(targetDir, options);

  console.log(chalk.blue('📚 Installing workflow system...'));
  await installWorkflowSystem(targetDir, options);

  console.log(chalk.blue('📖 Installing guides...'));
  await installGuidesSystem(targetDir, options);

  console.log(chalk.blue('📋 Installing planning system...'));
  await installPlanningSystem(targetDir, options);

  console.log(chalk.blue('📂 Installing features system...'));
  await installFeaturesSystem(targetDir, options);

  console.log(chalk.blue('🛡️ Installing compliance templates...'));
  await installComplianceTemplates(targetDir, options);

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

export { installEquipmentPack };
module.exports = { installEquipmentPack };
