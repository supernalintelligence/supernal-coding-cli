// @ts-nocheck
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const {
  loadProjectConfig,
  getDocPaths
} = require('../../../utils/config-loader');
const TemplateResolver = require('../../../../utils/template-resolver');
const {
  replaceTemplateVariables,
  getProjectName,
  getGitVersion
} = require('./templates');

/**
 * Copy templates with variable replacement
 * @param {string} sourceDir - Source template directory
 * @param {string} targetDir - Target directory
 * @param {string} projectRoot - Project root for getting replacements
 * @param {Object} options - Copy options
 */
async function copyWithVariableReplacement(
  sourceDir,
  targetDir,
  projectRoot,
  options = {}
) {
  // Get template variable values
  const templateVersion = getGitVersion(sourceDir);
  const projectName = await getProjectName(projectRoot);

  const replacements = {
    TEMPLATE_VERSION: templateVersion,
    PROJECT_NAME: projectName
  };

  await copyTemplatesRecursive(sourceDir, targetDir, replacements, options);
}

/**
 * Recursively copy templates with variable replacement
 */
async function copyTemplatesRecursive(
  sourceDir,
  targetDir,
  replacements,
  options
) {
  await fs.ensureDir(targetDir);

  const items = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const item of items) {
    const sourcePath = path.join(sourceDir, item.name);
    const targetPath = path.join(targetDir, item.name);

    if (item.isDirectory()) {
      await copyTemplatesRecursive(
        sourcePath,
        targetPath,
        replacements,
        options
      );
    } else if (item.isFile()) {
      // Check if file exists and should skip
      if ((await fs.pathExists(targetPath)) && !options.overwrite) {
        continue;
      }

      // Read file content
      const content = await fs.readFile(sourcePath, 'utf8');

      // Replace template variables
      const processedContent = replaceTemplateVariables(content, replacements);

      // Write processed content
      await fs.writeFile(targetPath, processedContent, 'utf8');
    }
  }
}

/**
 * Create kanban directory structure safely (only if not exists)
 * Uses supernal.yaml for configuration
 * @param {string} targetDir - Target installation directory
 * @param {Object} options - Installation options
 */
async function createKanbanStructureSafe(targetDir, _options = {}) {
  // Load configuration from supernal.yaml (silent during init)
  const config = loadProjectConfig(targetDir, { silent: true });
  const paths = getDocPaths(config);

  const kanbanDir = path.join(targetDir, paths.kanban);

  // Check if kanban directory already has content
  if (await fs.pathExists(kanbanDir)) {
    const existingFiles = await fs.readdir(kanbanDir);
    if (existingFiles.length > 0) {
      console.log(
        chalk.yellow(
          `   ⚠️  Kanban directory already exists with content (${existingFiles.length} items)`
        )
      );
      console.log(
        chalk.gray(
          '      Not modifying existing kanban structure to preserve user content'
        )
      );
      return;
    }
  }

  // Safe to create kanban structure
  const kanbanDirs = [
    'BRAINSTORM',
    'PLANNING',
    'TODO',
    'DOING',
    'BLOCKED',
    'DONE',
    'handoffs' // Use lowercase 'handoffs' to match config
  ];

  console.log(
    chalk.blue(
      `   📁 Creating kanban directories in ${path.relative(targetDir, kanbanDir)}/`
    )
  );

  for (const dir of kanbanDirs) {
    const dirPath = path.join(kanbanDir, dir);
    const archivePath = path.join(dirPath, 'ARCHIVE');

    await fs.ensureDir(dirPath);
    await fs.ensureDir(archivePath);
    console.log(chalk.green(`   ✓ ${dir}/`));
  }

  // Create README only if it doesn't exist
  const readmePath = path.join(kanbanDir, 'README.md');
  if (!(await fs.pathExists(readmePath))) {
    const readmeContent = `# Kanban Project Management

This directory contains the kanban task management system.

## Structure

- **BRAINSTORM/**: Ideas and exploration
- **PLANNING/**: Planning and scoping tasks  
- **TODO/**: Ready to work tasks
- **DOING/**: In progress work
- **BLOCKED/**: Blocked tasks
- **DONE/**: Completed tasks
- **handoffs/**: Agent/developer handoffs and documentation

## Usage

Use the \`sc kanban\` command to interact with this system:

\`\`\`bash
sc kanban list              # Show all tasks
sc kanban todo "new task"   # Create new task
sc kanban priority next     # Show next priority task
\`\`\`

See \`sc kanban --help\` for full documentation.
`;

    await fs.writeFile(readmePath, readmeContent);
    console.log(chalk.green('   ✓ README.md'));
  } else {
    console.log(
      chalk.yellow('   ⚠️  README.md already exists, not overwriting')
    );
  }
}

/**
 * Create docs directory structure safely (only if not exists)
 * @param {string} targetDir - Target installation directory
 * @param {Object} options - Installation options
 */
async function createDocsStructureSafe(targetDir, _options = {}) {
  // Load configuration from supernal.yaml
  const config = loadProjectConfig(targetDir, { silent: true });
  const paths = getDocPaths(config);

  const docsDir = path.join(targetDir, paths.docs);

  // Check if docs directory already has user content (ignore our own subdirectories and common files)
  if (await fs.pathExists(docsDir)) {
    const existingFiles = await fs.readdir(docsDir);
    const ourSubdirs = [
      'kanban',
      'requirements',
      'architecture',
      'adr',
      'planning',
      'guides',
      'problems',
      'stories',
      'compliance',
      'tests',
      'verification',
      'sessions',
      'handoffs'
    ];
    const commonFiles = ['README.md', '.gitkeep'];
    const userFiles = existingFiles.filter(
      (file) => !ourSubdirs.includes(file) && !commonFiles.includes(file)
    );

    if (userFiles.length > 0) {
      console.log(
        chalk.yellow(
          `   ⚠️  Docs directory already exists with user content (${userFiles.length} items)`
        )
      );
      console.log(
        chalk.gray(
          '      Not modifying existing docs structure to preserve user content'
        )
      );
      return;
    }
  }

  // Safe to create docs structure (kanban is created separately by createKanbanStructureSafe)
  // Based on Dashboard v2 plan - proper workflow-aligned structure
  const docsDirs = [
    'problems', // ❓ Core problems to solve (MarkdownDocument)
    'stories', // 📖 User stories and narratives (MarkdownDocument)
    'compliance', // 🛡️ Regulatory compliance (ComplianceDocument) - EARLY in workflow
    'requirements', // 📋 All requirements (with subdirectories)
    'requirements/functional', // ⚡ Gherkin-based functional requirements (Requirement)
    'requirements/technical', // ⚙️ Technical specs and implementation (Requirement)
    'architecture', // 🏗️ System design (ArchitectureDocument)
    'tests', // 🧪 Testing documentation (TestDocument)
    'verification' // ✅ Verification requirements (Requirement)
  ];

  console.log(
    chalk.blue(
      `   📁 Creating docs directories in ${path.relative(targetDir, docsDir)}/`
    )
  );

  for (const dir of docsDirs) {
    const dirPath = path.join(docsDir, dir);
    await fs.ensureDir(dirPath);
    console.log(chalk.green(`   ✓ ${dir}/`));
  }

  // Create README only if it doesn't exist
  const readmePath = path.join(docsDir, 'README.md');
  if (!(await fs.pathExists(readmePath))) {
    const readmeContent = `# Documentation

This directory contains the project documentation system organized by workflow phases.

## Structure

### Content Types (Dashboard v2 Workflow)

- **problems/**: ❓ Core problems and opportunities to solve (MarkdownDocument)
- **stories/**: 📖 User stories and general narratives (MarkdownDocument)
- **compliance/**: 🛡️ Regulatory compliance requirements and audit trails (ComplianceDocument)
- **requirements/**: 📋 All requirements organized by type
  - **requirements/functional/**: ⚡ Gherkin-based functional requirements (Requirement)
  - **requirements/technical/**: ⚙️ Technical specs and implementation requirements (Requirement)
- **architecture/**: 🏗️ System design and architecture documentation (ArchitectureDocument)
- **tests/**: 🧪 Testing documentation, strategies, and status (TestDocument)
- **verification/**: ✅ Verification and validation requirements (Requirement)
- **kanban/**: 📋 Kanban workflow documentation and tracking

### Workflow Order

1. **Problems** → 2. **Stories** → 3. **Compliance** → 4. **Functional Requirements** → 
5. **Architecture** → 6. **Technical Requirements** → 7. **Tests** → 8. **Verification**

## Usage

Use the \`sc docs\` command to interact with this system:

\`\`\`bash
sc docs generate              # Generate documentation
sc docs validate              # Validate documentation structure
sc docs serve                 # Serve documentation locally
\`\`\`

See \`sc docs --help\` for full documentation.
`;

    await fs.writeFile(readmePath, readmeContent);
    console.log(chalk.green('   ✓ README.md'));
  } else {
    console.log(
      chalk.yellow('   ⚠️  README.md already exists, not overwriting')
    );
  }
}

/**
 * Install compliance frameworks from @supernal/compliance-cards npm package
 * Falls back to templates if npm package not available
 * @param {string} targetDir - Target installation directory
 * @param {Object} options - Installation options
 * @param {string[]} options.complianceFrameworks - Array of framework names to install (e.g., ['hipaa', 'gdpr'])
 */
async function installComplianceTemplates(targetDir, options = {}) {
  try {
    const complianceDir = path.join(targetDir, 'docs/compliance/frameworks');

    // Check if compliance directory already has content
    if (await fs.pathExists(complianceDir)) {
      const existingFiles = await fs.readdir(complianceDir);
      if (existingFiles.length > 0 && !options.overwrite) {
        console.log(
          chalk.yellow(
            `   ⚠️  Compliance directory already exists with content (${existingFiles.length} items)`
          )
        );
        console.log(
          chalk.gray(
            '      Not modifying existing compliance structure to preserve user content'
          )
        );
        return;
      }
    }

    // Try to find @supernal/compliance-cards package
    let sourceComplianceDir = null;
    let source = 'unknown';

    // 1. Check node_modules in supernal-code-package
    const scPackageNodeModules = path.join(
      __dirname,
      '../../../../..',
      'node_modules/@supernal/compliance-cards/frameworks'
    );
    if (await fs.pathExists(scPackageNodeModules)) {
      sourceComplianceDir = scPackageNodeModules;
      source = '@supernal/compliance-cards (SC package dependency)';
    }

    // 2. Check node_modules in target directory
    if (!sourceComplianceDir) {
      const targetNodeModules = path.join(
        targetDir,
        'node_modules/@supernal/compliance-cards/frameworks'
      );
      if (await fs.pathExists(targetNodeModules)) {
        sourceComplianceDir = targetNodeModules;
        source = '@supernal/compliance-cards (project dependency)';
      }
    }

    // 3. Check global node_modules
    if (!sourceComplianceDir) {
      try {
        const globalPath = require.resolve(
          '@supernal/compliance-cards/frameworks',
          {
            paths: [process.cwd(), __dirname]
          }
        );
        if (await fs.pathExists(globalPath)) {
          sourceComplianceDir = globalPath;
          source = '@supernal/compliance-cards (global)';
        }
      } catch {
        // Not installed globally
      }
    }

    // 4. Fallback to templates (legacy, for backward compatibility)
    if (!sourceComplianceDir) {
      const resolver = new TemplateResolver(targetDir);
      if (resolver.exists('compliance/frameworks')) {
        sourceComplianceDir = resolver.resolve('compliance/frameworks');
        source = 'SC package templates (legacy fallback)';
      }
    }

    // No source found
    if (!sourceComplianceDir) {
      console.log(
        chalk.yellow('   ⚠️  @supernal/compliance-cards package not found')
      );
      console.log(
        chalk.gray('      Install with: npm install @supernal/compliance-cards')
      );
      console.log(
        chalk.gray(
          '      Or: npm install github:ianderrington/compliance-cards'
        )
      );
      await fs.ensureDir(complianceDir);
      return;
    }

    // Dry-run mode
    if (options.dryRun) {
      const frameworks = options.complianceFrameworks || ['all'];
      console.log(
        chalk.gray(
          `      Would copy ${frameworks.join(', ')} compliance frameworks from ${source}`
        )
      );
      return;
    }

    // Ensure compliance directory exists
    await fs.ensureDir(complianceDir);

    // Selective framework installation
    if (
      options.complianceFrameworks &&
      options.complianceFrameworks.length > 0
    ) {
      console.log(
        chalk.gray(
          `      Installing selective frameworks: ${options.complianceFrameworks.join(', ')}`
        )
      );

      let installedCount = 0;
      for (const framework of options.complianceFrameworks) {
        const sourceFrameworkDir = path.join(sourceComplianceDir, framework);
        const targetFrameworkDir = path.join(complianceDir, framework);

        if (await fs.pathExists(sourceFrameworkDir)) {
          await copyWithVariableReplacement(
            sourceFrameworkDir,
            targetFrameworkDir,
            targetDir,
            options
          );
          installedCount++;
        } else {
          console.log(
            chalk.yellow(`      ⚠️  Framework not found: ${framework}`)
          );
        }
      }

      console.log(
        chalk.green(
          `   ✓ Compliance templates installed (${installedCount}/${options.complianceFrameworks.length} frameworks)`
        )
      );
    } else {
      // Install all frameworks
      await copyWithVariableReplacement(
        sourceComplianceDir,
        complianceDir,
        targetDir,
        options
      );

      const frameworks = await fs.readdir(complianceDir);
      console.log(
        chalk.green(
          `   ✓ Compliance templates installed (${frameworks.length} frameworks)`
        )
      );
    }

    // Show source
    console.log(chalk.gray(`      Source: ${source}`));
  } catch (error) {
    console.log(
      chalk.yellow(
        `   ⚠️  Could not install compliance templates: ${error.message}`
      )
    );
  }
}

/**
 * Install workflow system from templates using TemplateResolver
 * @param {string} targetDir - Target installation directory
 * @param {Object} options - Installation options
 */
async function installWorkflowSystem(targetDir, options = {}) {
  try {
    const resolver = new TemplateResolver(targetDir);

    // Resolve workflow template (checks project /templates/ first, then package)
    const workflowTemplatePath = resolver.resolve('workflow');

    console.log(
      chalk.blue(`   📚 Installing workflow system from templates...`)
    );

    // Copy workflow to target with variable replacement
    const targetWorkflowDir = path.join(targetDir, 'docs/workflow');
    await copyWithVariableReplacement(
      workflowTemplatePath,
      targetWorkflowDir,
      targetDir,
      options
    );

    console.log(chalk.green('   ✓ Workflow system installed'));

    // Show source
    const source = resolver.getSource('workflow');
    if (source === 'project') {
      console.log(chalk.gray('      Source: Project /templates/ (override)'));
    } else {
      console.log(chalk.gray('      Source: SC package templates (canonical)'));
    }
  } catch (error) {
    console.log(
      chalk.red(`   ✗ Could not install workflow system: ${error.message}`)
    );
    throw error;
  }
}

/**
 * Install guides from templates using TemplateResolver
 * @param {string} targetDir - Target installation directory
 * @param {Object} options - Installation options
 */
async function installGuidesSystem(targetDir, options = {}) {
  try {
    const resolver = new TemplateResolver(targetDir);

    // Check if guides already exist
    const targetGuidesDir = path.join(targetDir, 'docs/guides');
    if (await fs.pathExists(targetGuidesDir)) {
      const existingFiles = await fs.readdir(targetGuidesDir);
      if (existingFiles.length > 0 && !options.overwrite) {
        console.log(
          chalk.yellow(`   ⚠️  Guides directory already exists with content`)
        );
        return;
      }
    }

    // Resolve guides template
    if (resolver.exists('guides')) {
      const guidesTemplatePath = resolver.resolve('guides');

      console.log(chalk.blue(`   📖 Installing guides...`));

      await copyWithVariableReplacement(
        guidesTemplatePath,
        targetGuidesDir,
        targetDir,
        options
      );

      console.log(chalk.green('   ✓ Guides installed'));
    }
  } catch (error) {
    console.log(
      chalk.yellow(`   ⚠️  Could not install guides: ${error.message}`)
    );
  }
}

/**
 * Install planning structure from templates using TemplateResolver
 * @param {string} targetDir - Target installation directory
 * @param {Object} options - Installation options
 */
async function installPlanningSystem(targetDir, options = {}) {
  try {
    const resolver = new TemplateResolver(targetDir);

    // Check if planning already exists
    const targetPlanningDir = path.join(targetDir, 'docs/planning');
    if (await fs.pathExists(targetPlanningDir)) {
      const existingFiles = await fs.readdir(targetPlanningDir);
      // Only skip if there's actual content (not just kanban/)
      const hasContent = existingFiles.filter((f) => f !== 'kanban').length > 0;
      if (hasContent && !options.overwrite) {
        console.log(
          chalk.yellow(`   ⚠️  Planning directory already exists with content`)
        );
        return;
      }
    }

    // Install planning components if they exist in templates
    if (resolver.exists('planning/epics')) {
      const epicsTemplatePath = resolver.resolve('planning/epics');
      const targetEpicsDir = path.join(targetDir, 'docs/planning/epics');

      console.log(chalk.blue(`   📋 Installing planning epics...`));

      await copyWithVariableReplacement(
        epicsTemplatePath,
        targetEpicsDir,
        targetDir,
        options
      );

      console.log(chalk.green('   ✓ Planning epics installed'));
    }

    if (resolver.exists('planning/roadmap')) {
      const roadmapTemplatePath = resolver.resolve('planning/roadmap');
      const targetRoadmapDir = path.join(targetDir, 'docs/planning/roadmap');

      console.log(chalk.blue(`   🗺️  Installing planning roadmap...`));

      await copyWithVariableReplacement(
        roadmapTemplatePath,
        targetRoadmapDir,
        targetDir,
        options
      );

      console.log(chalk.green('   ✓ Planning roadmap installed'));
    }
  } catch (error) {
    console.log(
      chalk.yellow(`   ⚠️  Could not install planning: ${error.message}`)
    );
  }
}

/**
 * Install features directory structure from templates
 * Creates domain-based feature tracking structure
 * @param {string} targetDir - Target installation directory
 * @param {Object} options - Installation options
 */
async function installFeaturesSystem(targetDir, _options = {}) {
  try {
    const resolver = new TemplateResolver(targetDir);
    const config = loadProjectConfig(targetDir, { silent: true });
    const paths = getDocPaths(config);
    const targetFeaturesDir = path.join(
      targetDir,
      paths.features || 'docs/features'
    );

    console.log(
      chalk.blue(`   📂 Installing features system from templates...`)
    );

    // Check if features directory already has content (excluding README.md)
    if (await fs.pathExists(targetFeaturesDir)) {
      const items = await fs.readdir(targetFeaturesDir);
      const contentItems = items.filter(
        (item) => item !== 'README.md' && item !== '.DS_Store'
      );

      if (contentItems.length > 0) {
        console.log(
          chalk.yellow(`   ⚠️  Features directory already exists with content`)
        );

        // Only copy README.md if it doesn't exist
        const readmePath = path.join(targetFeaturesDir, 'README.md');
        if (!(await fs.pathExists(readmePath))) {
          const featuresTemplatePath = resolver.resolve('features');
          const templateReadme = path.join(featuresTemplatePath, 'README.md');
          if (await fs.pathExists(templateReadme)) {
            await fs.copy(templateReadme, readmePath);
            console.log(chalk.gray('      Added README.md'));
          }
        }
        return;
      }
    }

    // Only copy README.md - subdirectories (chats, design, planning, etc.)
    // are for sc feature create, not sc init
    const featuresTemplatePath = resolver.resolve('features');
    await fs.ensureDir(targetFeaturesDir);

    const templateReadme = path.join(featuresTemplatePath, 'README.md');
    const targetReadme = path.join(targetFeaturesDir, 'README.md');

    if (await fs.pathExists(templateReadme)) {
      await fs.copy(templateReadme, targetReadme);
      console.log(chalk.green('   ✓ Features system installed'));
      console.log(
        chalk.gray(
          `      Domain-based structure: {domain}/{feature}/ with phase metadata`
        )
      );
    } else {
      console.log(
        chalk.yellow('   ⚠️  Features README template not found, skipped')
      );
    }

    const source = resolver.getSource('features');
    if (source === 'project') {
      console.log(chalk.gray('      Source: Project /templates/ (override)'));
    } else {
      console.log(chalk.gray('      Source: SC package templates (canonical)'));
    }
  } catch (error) {
    console.log(
      chalk.red(`   ✗ Could not install features system: ${error.message}`)
    );
    throw error;
  }
}

module.exports = {
  createKanbanStructureSafe,
  createDocsStructureSafe,
  installComplianceTemplates,
  installWorkflowSystem,
  installGuidesSystem,
  installPlanningSystem,
  installFeaturesSystem
};
