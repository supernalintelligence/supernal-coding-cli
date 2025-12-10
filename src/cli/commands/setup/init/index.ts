// @ts-nocheck
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');
const { getConfig } = require('../../../../scripts/config-loader');
const {
  findGitRoot,
  validateGitRepository,
  getGitInfo,
} = require('../../../utils/git-utils');
const {
  analyzeRepositoryStructure,
  getAllResolvedPaths,
  validatePathResolution,
  ensureDirectoryExists,
} = require('../../../utils/path-resolver');

// Import refactored modules
const { detectProjectType } = require('./project-detection');
const { installEquipmentPack } = require('./equipment-pack');
const {
  detectInstallationConflicts,
  analyzeMergeCompatibility,
} = require('./conflict-detection');
const { createEnhancedTOMLConfig } = require('./config-management');
const { installGitignore } = require('./gitignore-installer');
const { showActionableNextSteps } = require('./next-steps');

// Import individual content installers for standalone flags
const {
  installWorkflowSystem,
  installGuidesSystem,
  installComplianceTemplates
} = require('./docs-structure');

/**
 * Enhanced Equipment Pack with Project Type Intelligence
 */
const EQUIPMENT_PACK = {
  coreSystem: {
    name: 'Core System',
    description:
      'Complete auto-building, auto-documenting, auto-testing system',
    required: true,
    components: {
      cursorRules: [
        'agent-on-board', // Agent onboarding and context
        'dev_workflow', // Development workflow patterns
        'agent-hand-off', // Knowledge transfer procedures
        'avoid-anti-patterns', // Code quality enforcement
        'testing-strategy', // Testing approaches
        'self-improve', // Continuous improvement
      ],
      directories: [
        'kanban', // Kanban project management
        'requirements', // Requirements documentation
        'tests/e2e', // End-to-end testing
        'tests/requirements', // Requirements testing
        'supernal-code-package/lib/cli/commands', // CLI command structure
        'templates', // Code and doc templates
      ],
      packages: [
        'chalk', // Terminal colors
        'commander', // CLI framework
        'fs-extra', // File system utilities
        'inquirer', // Interactive prompts
        'yaml', // YAML processing
        'handlebars', // Template engine
        'js-yaml', // YAML configuration parsing
      ],
    },
  },

  gitManagement: {
    name: 'Git Management',
    description: 'Automated git workflows, branch management, and compliance',
    required: false,
    defaultActive: true,
    components: {
      cursorRules: [
        'git-smart', // Git best practices
      ],
    },
  },
};

/**
 * Handle standalone content installation (--guides, --compliance, --workflow)
 * These can be run independently without a full preset installation.
 * Perfect for docs sites that need specific content types.
 * @param {Object} options - Command line options
 */
async function handleContentInstall(options) {
  const targetDir = options.directory || process.cwd();
  const absoluteTargetDir = path.resolve(targetDir);
  
  console.log(chalk.blue('📦 Installing content modules...'));
  console.log(chalk.white(`   Target: ${absoluteTargetDir}`));
  
  // Ensure docs directory exists
  await fs.ensureDir(path.join(absoluteTargetDir, 'docs'));
  
  let installed = [];
  
  // Install guides if requested
  if (options.guides) {
    console.log(chalk.blue('\n📖 Installing guides...'));
    try {
      await installGuidesSystem(absoluteTargetDir, options);
      installed.push('guides');
      console.log(chalk.green('   ✓ Guides installed → docs/guides/'));
    } catch (error) {
      console.log(chalk.yellow(`   ⚠️ Guides: ${error.message}`));
    }
  }
  
  // Install compliance templates if requested
  if (options.compliance) {
    console.log(chalk.blue('\n🛡️ Installing compliance templates...'));
    try {
      await installComplianceTemplates(absoluteTargetDir, options);
      installed.push('compliance');
      console.log(chalk.green('   ✓ Compliance templates installed → docs/compliance/'));
    } catch (error) {
      console.log(chalk.yellow(`   ⚠️ Compliance: ${error.message}`));
    }
  }
  
  // Install workflow/SOPs if requested
  if (options.workflow) {
    console.log(chalk.blue('\n📚 Installing workflow/SOPs...'));
    try {
      await installWorkflowSystem(absoluteTargetDir, options);
      installed.push('workflow');
      console.log(chalk.green('   ✓ Workflow/SOPs installed → docs/workflow/'));
    } catch (error) {
      console.log(chalk.yellow(`   ⚠️ Workflow: ${error.message}`));
    }
  }
  
  // Summary
  if (installed.length > 0) {
    console.log(chalk.green(`\n✅ Content installation complete!`));
    console.log(chalk.white(`   Installed: ${installed.join(', ')}`));
    
    // Show what was created
    console.log(chalk.blue('\n📁 Installed content:'));
    if (installed.includes('guides')) {
      console.log(chalk.white('   docs/guides/     - User guides and tutorials'));
    }
    if (installed.includes('compliance')) {
      console.log(chalk.white('   docs/compliance/ - Compliance framework templates'));
    }
    if (installed.includes('workflow')) {
      console.log(chalk.white('   docs/workflow/   - SOPs and workflow documentation'));
    }
    
    console.log(chalk.blue('\n💡 These can be referenced by your site build.'));
    console.log(chalk.white('   Run "sc build" to validate and generate CLI docs.'));
  } else {
    console.log(chalk.yellow('\n⚠️ No content modules were installed.'));
    console.log(chalk.white('   Use: sc init --guides --compliance --workflow'));
  }
  
  return { success: true, installed };
}

/**
 * Determine preset based on command line options
 * @param {Object} options - Command line options
 * @returns {string|null} Preset name or null
 */
function determinePreset(options) {
  if (options.minimal) return 'minimal';
  if (options.standard) return 'standard';
  if (options.full) return 'full';
  if (options.development) return 'development';

  return null;
}

/**
 * Main initialization command handler
 * @param {string|undefined} directory - Optional directory argument (unused, for CLI compatibility)
 * @param {Object} options - Command line options
 */
async function initCommand(directory, options) {
  // Handle both call signatures: (options) and (directory, options)
  if (typeof directory === 'object' && !options) {
    options = directory;
    directory = undefined;
  }

  try {
    // Handle standalone content installation flags (--guides, --compliance, --workflow)
    const isContentInstall = options.guides || options.compliance || options.workflow;
    
    if (isContentInstall) {
      return await handleContentInstall(options);
    }

    // Check if user provided proper initialization options
    if (
      !options.interactive &&
      !options.minimal &&
      !options.standard &&
      !options.full &&
      !options.development &&
      !options.dryRun
    ) {
      console.log(chalk.blue('🚀 Supernal Coding Repository Equipment Pack'));
      console.log(chalk.blue('='.repeat(60)));
      console.log(
        chalk.yellow(
          '\n⚠️  Repository initialization requires selecting a specific preset.'
        )
      );

      console.log(chalk.blue('\n📦 Available Installation Presets:'));

      console.log(chalk.green('\n  🎯 MINIMAL - Just the essentials'));
      console.log(chalk.cyan('  sc init --minimal'));
      console.log(
        chalk.white(
          '    • Basic project structure (kanban, requirements, docs)'
        )
      );
      console.log(chalk.white('    • Core workflow automation'));
      console.log(
        chalk.white('    • Essential cursor rules (workflow, quality)')
      );
      console.log(
        chalk.gray(
          '    ↳ Perfect for small projects or when adding to existing setups'
        )
      );

      console.log(
        chalk.green('\n  ⚡ STANDARD - Complete development environment')
      );
      console.log(chalk.cyan('  sc init --standard'));
      console.log(chalk.white('    • Everything from MINIMAL'));
      console.log(chalk.white('    • Git hooks and smart merging'));
      console.log(chalk.white('    • Pre-commit quality checks'));
      console.log(chalk.white('    • Type duplication detection'));
      console.log(chalk.white('    • MCP integration for Cursor'));
      console.log(chalk.gray('    ↳ Recommended for most projects'));

      console.log(chalk.green('\n  🚀 FULL - Complete supernal ecosystem'));
      console.log(chalk.cyan('  sc init --full'));
      console.log(chalk.white('    • Everything from STANDARD'));
      console.log(chalk.white('    • Advanced testing framework'));
      console.log(chalk.white('    • Multi-environment configurations'));
      console.log(chalk.white('    • Performance monitoring'));
      console.log(chalk.white('    • Complete documentation system'));
      console.log(chalk.gray('    ↳ For complex projects and teams'));

      console.log(chalk.green('\n  🔧 DEVELOPMENT - Development and testing'));
      console.log(chalk.cyan('  sc init --development'));
      console.log(chalk.white('    • Everything from FULL'));
      console.log(chalk.white('    • Test repositories and fixtures'));
      console.log(chalk.white('    • Development utilities'));
      console.log(chalk.white('    • Debug configurations'));
      console.log(chalk.gray('    ↳ For contributors and package development'));

      console.log(chalk.blue('\n📋 Interactive Setup:'));
      console.log(chalk.cyan('  sc init --interactive'));
      console.log(chalk.white('    • Guided setup with custom configuration'));
      console.log(chalk.white('    • Choose specific features'));
      console.log(chalk.white('    • Project-specific optimizations'));

      console.log(chalk.blue('\n🔍 Dry Run (Preview):'));
      console.log(chalk.cyan('  sc init --standard --dry-run'));
      console.log(chalk.white('    • See what would be installed'));
      console.log(chalk.white('    • No files created or modified'));
      console.log(chalk.white('    • Perfect for planning'));

      console.log(
        chalk.blue(
          '\n💡 Quick Start: sc init --standard (recommended for most projects)'
        )
      );
      return;
    }

    // Determine target directory
    const targetDir = options.directory || process.cwd();
    const absoluteTargetDir = path.resolve(targetDir);

    // Validate and get git information
    const gitRoot = await findGitRoot(absoluteTargetDir);
    if (!gitRoot) {
      console.error(
        chalk.red(
          '❌ No git repository found. Please run "git init" first or specify a directory with a git repository.'
        )
      );
      process.exit(1);
    }

    const gitValidation = await validateGitRepository(gitRoot);
    const gitInfo = await getGitInfo(gitRoot);

    console.log(chalk.blue('🚀 Supernal Coding Repository Equipment Pack'));
    console.log(chalk.blue('='.repeat(60)));

    // Determine preset
    const preset = determinePreset(options);
    if (preset) {
      const presetDescriptions = {
        minimal: 'Essential tools and workflow automation',
        standard:
          'Complete development environment with git integration and quality checks',
        full: 'Advanced features with testing framework and multi-environment support',
        development:
          'Full development setup with test repositories and debug tools',
      };

      console.log(
        chalk.green(`\n📦 Installing preset: ${preset.toUpperCase()}`)
      );
      console.log(chalk.white(`   ${presetDescriptions[preset]}`));
    }

    console.log(chalk.white(`Target directory: ${absoluteTargetDir}`));

    // Analyze repository structure
    console.log(chalk.blue('\n🔍 Analyzing Git repository structure...'));
    console.log(chalk.green(`✓ Git repository found: ${gitRoot}`));

    if (gitValidation.warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Git repository warnings:'));
      gitValidation.warnings.forEach((warning) => {
        console.log(chalk.yellow(`   - ${warning}`));
      });
    }

    console.log(chalk.white(`   Branch: ${gitInfo.currentBranch}`));

    // Analyze repository structure
    console.log(chalk.blue('\n📁 Analyzing repository structure...'));
    const structure = await analyzeRepositoryStructure(gitRoot);
    console.log(chalk.green(`✓ Repository type: ${structure.type}`));

    // Get resolved paths
    const resolvedPaths = getAllResolvedPaths(gitRoot);
    const pathValidation = validatePathResolution(resolvedPaths);

    console.log(chalk.blue('\n📂 Path resolution analysis:'));
    if (
      pathValidation?.missingPaths &&
      pathValidation.missingPaths.length > 0
    ) {
      console.log(chalk.yellow('⚠️  Some paths missing:'));
      pathValidation.missingPaths.forEach((pathInfo) => {
        console.log(chalk.yellow(`   - ${pathInfo.key}`));
      });
    }

    if (
      pathValidation?.optionalMissing &&
      pathValidation.optionalMissing.length > 0
    ) {
      console.log(chalk.yellow('⚠️  Optional paths missing:'));
      pathValidation.optionalMissing.forEach((pathInfo) => {
        console.log(
          chalk.yellow(`   - Missing optional path: ${pathInfo.key}`)
        );
      });
    }

    // Detect project type
    console.log(chalk.blue('\n🔍 Analyzing project type...'));
    const detectedType = await detectProjectType(absoluteTargetDir);
    console.log(chalk.green(`📋 Detected project type: ${detectedType.name}`));
    console.log(chalk.white(`   ${detectedType.description}`));
    console.log(
      chalk.yellow(
        `⚠️  Detection confidence: ${Math.round(detectedType.confidence)}%`
      )
    );

    // Determine active features based on preset
    const activeFeatures = determineActiveFeatures(
      preset,
      detectedType,
      options
    );

    if (!options.interactive) {
      console.log(
        chalk.blue(
          '\n📋 Using default configuration (use --interactive for custom setup)'
        )
      );
    }

    // Show equipment pack summary
    showEquipmentPackSummary(activeFeatures, detectedType);

    // Check for installation conflicts
    console.log(chalk.blue('\n🔍 Checking for existing installations...'));
    const conflicts = await detectInstallationConflicts(
      absoluteTargetDir,
      activeFeatures
    );

    if (conflicts.hasConflicts && !options.overwrite && !options.dryRun) {
      // If merge option is enabled, analyze merge compatibility
      if (options.merge) {
        console.log(chalk.blue('\n🔍 Analyzing merge compatibility...'));
        const mergeAnalysis = await analyzeMergeCompatibility(
          absoluteTargetDir,
          conflicts.conflicts,
          activeFeatures
        );

        if (mergeAnalysis.canMerge) {
          console.log(
            chalk.green('\n✅ Merge analysis complete - safe to merge')
          );
          console.log(chalk.white('\nMerge Plan:'));

          mergeAnalysis.mergeActions.forEach((action) => {
            if (action.type === 'Protected Directory') {
              // For protected directories, show type and description
              console.log(
                chalk.yellow(`  ${action.type}: ${action.description}`)
              );
            } else {
              // Format: "Scripts Merge: Add" or "Templates Merge: Add"
              console.log(chalk.yellow(`  ${action.type}: Add`));
              if (action.details?.newFiles) {
                console.log(
                  chalk.gray(
                    `    Adding ${action.details.newFiles.length} new files`
                  )
                );
                // Show detailed file counts for scripts/templates
                if (
                  action.type === 'Scripts Merge' &&
                  action.details.existingFiles
                ) {
                  console.log(
                    chalk.gray(
                      `    Add ${action.details.newFiles.length} supernal-code scripts alongside ${action.details.existingFiles.length} existing scripts`
                    )
                  );
                } else if (
                  action.type === 'Templates Merge' &&
                  action.details.existingFiles
                ) {
                  console.log(
                    chalk.gray(
                      `    Add ${action.details.newFiles.length} supernal-code templates alongside ${action.details.existingFiles.length} existing templates`
                    )
                  );
                }
              }
            }
          });

          // Show warnings if any exist
          if (mergeAnalysis.warnings && mergeAnalysis.warnings.length > 0) {
            console.log(chalk.yellow('\nMerge warnings:'));
            mergeAnalysis.warnings.forEach((warning) => {
              console.log(chalk.gray(`  ⚠️  ${warning}`));
            });
          }

          // Continue with installation in merge mode
          console.log(chalk.blue('\n🔀 Proceeding with intelligent merge...'));
        } else {
          console.log(chalk.red('\n❌ Merge analysis failed'));
          console.log(chalk.red('\nBlocking Conflicts:'));
          if (
            mergeAnalysis.blockingConflicts &&
            mergeAnalysis.blockingConflicts.length > 0
          ) {
            mergeAnalysis.blockingConflicts.forEach((conflict) => {
              console.log(chalk.red(`  • ${conflict.type}`));
              console.log(chalk.white(`    ${conflict.description}`));
              if (conflict.path) {
                console.log(chalk.gray(`    Path: ${conflict.path}`));
              }
            });
          }
          console.log(chalk.blue('\n💡 Solutions:'));
          console.log(chalk.white('  • Use --overwrite to force overwrite'));
          console.log(
            chalk.white('  • Resolve conflicts manually and try again')
          );
          process.exit(1);
        }
      } else {
        // No merge option, show conflict error
        console.log(chalk.red('\n❌ Installation conflicts detected\n'));

        // Display each conflict with details
        conflicts.conflicts.forEach((conflict) => {
          console.log(chalk.yellow(`  • ${conflict.type}`));
          console.log(chalk.white(`    ${conflict.description}`));
          if (conflict.details && conflict.details.length > 0) {
            conflict.details.forEach((detail) => {
              console.log(chalk.gray(`      - ${detail}`));
            });
          }
        });

        // Display solutions
        console.log(chalk.blue('\n💡 Solutions:'));
        console.log(
          chalk.white('  • Use --overwrite to force overwrite existing files')
        );
        console.log(
          chalk.white('  • Use --merge to intelligently merge compatible files')
        );
        console.log(
          chalk.white('  • Use --dry-run to preview changes without installing')
        );
        console.log(
          chalk.white('  • Manually resolve conflicts and try again')
        );

        process.exit(1);
      }
    } else if (!options.dryRun) {
      console.log(chalk.green('✓ No installation conflicts detected'));
    }

    // Dry run check
    if (options.dryRun) {
      console.log(chalk.blue('\n🔍 Dry run mode - No files will be created'));
      console.log(
        chalk.white(
          '   This would install the equipment pack with the above configuration.'
        )
      );
      return;
    }

    // Install equipment pack
    await installEquipmentPack(absoluteTargetDir, activeFeatures, options);

    // Create local configuration with installed features list
    const installDate = new Date().toISOString();
    const localConfig = {
      version: '1.0.0',
      equipmentPackId: `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      installedAt: installDate,
      installationDate: installDate, // Alias for backward compatibility
      preset: preset || 'custom',
      projectType: {
        detected: detectedType.name || detectedType.type,
        confidence: detectedType.confidence || 0,
      },
      installedFeatures: Object.keys(activeFeatures).filter(
        (key) => activeFeatures[key] === true
      ),
      equipmentPack: {
        version: '1.0.0',
        components: {},
      },
    };

    // Add component details to local config
    Object.keys(EQUIPMENT_PACK).forEach((featureKey) => {
      if (activeFeatures[featureKey]) {
        localConfig.equipmentPack.components[featureKey] =
          EQUIPMENT_PACK[featureKey].components;
      }
    });

    // Add project-specific components
    const projectTypeConfig = require('./project-detection').PROJECT_TYPES[
      detectedType.type
    ];
    if (projectTypeConfig.additionalRules.length > 0) {
      localConfig.equipmentPack.components.projectSpecific = {
        cursorRules: projectTypeConfig.additionalRules,
        packages: projectTypeConfig.packages,
      };
    }

    await fs.writeJSON(
      path.join(absoluteTargetDir, '.supernal-config.json'),
      localConfig,
      { spaces: 2 }
    );

    // Create enhanced YAML configuration for multi-repo compatibility
    await createEnhancedTOMLConfig(
      gitRoot,
      resolvedPaths,
      structure,
      gitInfo,
      activeFeatures
    );

    // Install or update .gitignore
    console.log(chalk.blue('\n🔒 Installing .gitignore...'));
    await installGitignore(gitRoot, options);

    console.log(
      chalk.green('\n🎉 Repository Equipment Pack installed successfully!')
    );

    // Initialize workflow state tracking
    try {
      const WorkflowStateTracker = require('../../workflow/state-tracker');
      const tracker = new WorkflowStateTracker(absoluteTargetDir);

      const initOptions = {
        detectedType: detectedType.type,
        gitManagement: activeFeatures.gitManagement,
        kanbanSystem: activeFeatures.kanbanSystem,
        testingFramework: activeFeatures.testingFramework,
      };

      await tracker.initializeState(initOptions);
      console.log(chalk.blue('🎯 Workflow state tracking initialized'));
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️  Could not initialize workflow tracking: ${error.message}`
        )
      );
    }

    // Generate actionable next steps based on project type and configuration
    await showActionableNextSteps(
      detectedType,
      activeFeatures,
      gitRoot,
      resolvedPaths
    );
  } catch (error) {
    console.error(chalk.red(`❌ Initialization failed: ${error.message}`));
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Determine active features based on preset and options
 * @param {string} preset - Selected preset
 * @param {Object} detectedType - Detected project type
 * @param {Object} options - Command line options
 * @returns {Object} Active features configuration
 */
function determineActiveFeatures(preset, detectedType, options) {
  const baseFeatures = {
    coreSystem: true,
    projectType: detectedType.type,
  };

  switch (preset) {
    case 'minimal':
      return {
        ...baseFeatures,
        gitManagement: false,
        kanbanSystem: true,
        testingFramework: false,
        mcpIntegration: false,
      };

    case 'standard':
      return {
        ...baseFeatures,
        gitManagement: true,
        kanbanSystem: true,
        testingFramework: false,
        mcpIntegration: true,
      };

    case 'full':
      return {
        ...baseFeatures,
        gitManagement: true,
        kanbanSystem: true,
        testingFramework: true,
        mcpIntegration: true,
        advancedFeatures: true,
      };

    case 'development':
      return {
        ...baseFeatures,
        gitManagement: true,
        kanbanSystem: true,
        testingFramework: true,
        mcpIntegration: true,
        advancedFeatures: true,
        developmentTools: true,
        includeTesting: true,
      };

    default:
      // Custom/interactive configuration
      return {
        ...baseFeatures,
        gitManagement: options.gitManagement !== false,
        kanbanSystem: options.kanbanSystem !== false,
        testingFramework: options.testingFramework === true,
        mcpIntegration: options.mcpIntegration !== false,
      };
  }
}

/**
 * Show equipment pack installation summary
 * @param {Object} activeFeatures - Active features
 * @param {Object} detectedType - Detected project type
 */
function showEquipmentPackSummary(activeFeatures, detectedType) {
  console.log(chalk.blue('\n✅ Equipment Pack Summary:'));

  // Core System (always active)
  console.log(chalk.green('  ✓ Core System (required)'));
  console.log(
    chalk.white(
      '    Complete auto-building, auto-documenting, auto-testing system'
    )
  );

  // Git Management
  if (activeFeatures.gitManagement) {
    console.log(chalk.green('  ✓ Git Management (optional)'));
    console.log(
      chalk.white(
        '    Automated git workflows, branch management, and compliance'
      )
    );
  }

  // Project-specific rules
  const projectTypeConfig = require('./project-detection').PROJECT_TYPES[
    detectedType.type
  ];
  if (projectTypeConfig.additionalRules.length > 0) {
    console.log(
      chalk.green(
        `  ✓ ${detectedType.name} Rules (${projectTypeConfig.additionalRules.length} additional)`
      )
    );
    console.log(
      chalk.white(`    ${projectTypeConfig.additionalRules.join(', ')}`)
    );
  }
}

module.exports = {
  handleInitCommand: initCommand, // Alias for new CLI
  initCommand,
  handleContentInstall,
  determinePreset,
  determineActiveFeatures,
  showEquipmentPackSummary,
  EQUIPMENT_PACK,
};
