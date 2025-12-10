import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'node:path';
import { getConfig } from '../../../../scripts/config-loader';
import {
  findGitRoot,
  validateGitRepository,
  getGitInfo,
} from '../../../utils/git-utils';
import {
  analyzeRepositoryStructure,
  getAllResolvedPaths,
  validatePathResolution,
  ensureDirectoryExists,
} from '../../../utils/path-resolver';

// Import refactored modules
const { detectProjectType, PROJECT_TYPES } = require('./project-detection');
import { installEquipmentPack } from './equipment-pack';
import {
  detectInstallationConflicts,
  analyzeMergeCompatibility,
} from './conflict-detection';
import { createEnhancedTOMLConfig } from './config-management';
import { installGitignore } from './gitignore-installer';
import { showActionableNextSteps } from './next-steps';

// Import individual content installers for standalone flags
import {
  installWorkflowSystem,
  installGuidesSystem,
  installComplianceTemplates
} from './docs-structure';

interface InitOptions {
  interactive?: boolean;
  minimal?: boolean;
  standard?: boolean;
  full?: boolean;
  development?: boolean;
  dryRun?: boolean;
  directory?: string;
  overwrite?: boolean;
  merge?: boolean;
  verbose?: boolean;
  guides?: boolean;
  compliance?: boolean;
  workflow?: boolean;
  gitManagement?: boolean;
  kanbanSystem?: boolean;
  testingFramework?: boolean;
  mcpIntegration?: boolean;
  [key: string]: boolean | string | undefined;
}

interface ActiveFeatures {
  coreSystem: boolean;
  projectType: string;
  gitManagement?: boolean;
  kanbanSystem?: boolean;
  testingFramework?: boolean;
  mcpIntegration?: boolean;
  advancedFeatures?: boolean;
  developmentTools?: boolean;
  includeTesting?: boolean;
  [key: string]: boolean | string | undefined;
}

interface DetectedType {
  name: string;
  type: string;
  description: string;
  confidence: number;
  [key: string]: string | number;
}

interface GitValidation {
  warnings: string[];
}

interface GitInfo {
  currentBranch: string;
}

interface PathValidation {
  missingPaths?: { key: string }[];
  optionalMissing?: { key: string }[];
}

interface ContentInstallResult {
  success: boolean;
  installed: string[];
}

interface Conflict {
  type: string;
  description: string;
  details?: string[];
}

interface MergeAction {
  type: string;
  description: string;
  details?: {
    newFiles?: unknown[];
    existingFiles?: unknown[];
  };
}

interface MergeAnalysis {
  canMerge: boolean;
  mergeActions?: MergeAction[];
  warnings?: string[];
  blockingConflicts?: { type: string; description: string; path?: string }[];
}

interface ConflictsResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
}

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
 * @param options - Command line options
 */
async function handleContentInstall(options: InitOptions): Promise<ContentInstallResult> {
  const targetDir = options.directory || process.cwd();
  const absoluteTargetDir = path.resolve(targetDir);
  
  console.log(chalk.blue('[PACKAGE] Installing content modules...'));
  console.log(chalk.white(`   Target: ${absoluteTargetDir}`));
  
  // Ensure docs directory exists
  await fs.ensureDir(path.join(absoluteTargetDir, 'docs'));
  
  const installed: string[] = [];
  
  // Install guides if requested
  if (options.guides) {
    console.log(chalk.blue('\n[DOCS] Installing guides...'));
    try {
      await installGuidesSystem(absoluteTargetDir, options);
      installed.push('guides');
      console.log(chalk.green('   [OK] Guides installed -> docs/guides/'));
    } catch (error) {
      const err = error as Error;
      console.log(chalk.yellow(`   [WARN] Guides: ${err.message}`));
    }
  }
  
  // Install compliance templates if requested
  if (options.compliance) {
    console.log(chalk.blue('\n[COMPLIANCE] Installing compliance templates...'));
    try {
      await installComplianceTemplates(absoluteTargetDir, options);
      installed.push('compliance');
      console.log(chalk.green('   [OK] Compliance templates installed -> docs/compliance/'));
    } catch (error) {
      const err = error as Error;
      console.log(chalk.yellow(`   [WARN] Compliance: ${err.message}`));
    }
  }
  
  // Install workflow/SOPs if requested
  if (options.workflow) {
    console.log(chalk.blue('\n[DOCS] Installing workflow/SOPs...'));
    try {
      await installWorkflowSystem(absoluteTargetDir, options);
      installed.push('workflow');
      console.log(chalk.green('   [OK] Workflow/SOPs installed -> docs/workflow/'));
    } catch (error) {
      const err = error as Error;
      console.log(chalk.yellow(`   [WARN] Workflow: ${err.message}`));
    }
  }
  
  // Summary
  if (installed.length > 0) {
    console.log(chalk.green(`\n[OK] Content installation complete!`));
    console.log(chalk.white(`   Installed: ${installed.join(', ')}`));
    
    // Show what was created
    console.log(chalk.blue('\n[DIR] Installed content:'));
    if (installed.includes('guides')) {
      console.log(chalk.white('   docs/guides/     - User guides and tutorials'));
    }
    if (installed.includes('compliance')) {
      console.log(chalk.white('   docs/compliance/ - Compliance framework templates'));
    }
    if (installed.includes('workflow')) {
      console.log(chalk.white('   docs/workflow/   - SOPs and workflow documentation'));
    }
    
    console.log(chalk.blue('\n[TIP] These can be referenced by your site build.'));
    console.log(chalk.white('   Run "sc build" to validate and generate CLI docs.'));
  } else {
    console.log(chalk.yellow('\n[WARN] No content modules were installed.'));
    console.log(chalk.white('   Use: sc init --guides --compliance --workflow'));
  }
  
  return { success: true, installed };
}

/**
 * Determine preset based on command line options
 * @param options - Command line options
 * @returns Preset name or null
 */
function determinePreset(options: InitOptions): string | null {
  if (options.minimal) return 'minimal';
  if (options.standard) return 'standard';
  if (options.full) return 'full';
  if (options.development) return 'development';

  return null;
}

/**
 * Main initialization command handler
 * @param directory - Optional directory argument (unused, for CLI compatibility)
 * @param options - Command line options
 */
async function initCommand(directory: string | InitOptions | undefined, options?: InitOptions): Promise<void | ContentInstallResult> {
  // Handle both call signatures: (options) and (directory, options)
  if (typeof directory === 'object' && !options) {
    options = directory;
    directory = undefined;
  }

  if (!options) {
    options = {};
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
      console.log(chalk.blue('[LAUNCH] Supernal Coding Repository Equipment Pack'));
      console.log(chalk.blue('='.repeat(60)));
      console.log(
        chalk.yellow(
          '\n[WARN] Repository initialization requires selecting a specific preset.'
        )
      );

      console.log(chalk.blue('\n[PACKAGE] Available Installation Presets:'));

      console.log(chalk.green('\n  [MINIMAL] - Just the essentials'));
      console.log(chalk.cyan('  sc init --minimal'));
      console.log(
        chalk.white(
          '    - Basic project structure (kanban, requirements, docs)'
        )
      );
      console.log(chalk.white('    - Core workflow automation'));
      console.log(
        chalk.white('    - Essential cursor rules (workflow, quality)')
      );
      console.log(
        chalk.gray(
          '    -> Perfect for small projects or when adding to existing setups'
        )
      );

      console.log(
        chalk.green('\n  [STANDARD] - Complete development environment')
      );
      console.log(chalk.cyan('  sc init --standard'));
      console.log(chalk.white('    - Everything from MINIMAL'));
      console.log(chalk.white('    - Git hooks and smart merging'));
      console.log(chalk.white('    - Pre-commit quality checks'));
      console.log(chalk.white('    - Type duplication detection'));
      console.log(chalk.white('    - MCP integration for Cursor'));
      console.log(chalk.gray('    -> Recommended for most projects'));

      console.log(chalk.green('\n  [FULL] - Complete supernal ecosystem'));
      console.log(chalk.cyan('  sc init --full'));
      console.log(chalk.white('    - Everything from STANDARD'));
      console.log(chalk.white('    - Advanced testing framework'));
      console.log(chalk.white('    - Multi-environment configurations'));
      console.log(chalk.white('    - Performance monitoring'));
      console.log(chalk.white('    - Complete documentation system'));
      console.log(chalk.gray('    -> For complex projects and teams'));

      console.log(chalk.green('\n  [DEVELOPMENT] - Development and testing'));
      console.log(chalk.cyan('  sc init --development'));
      console.log(chalk.white('    - Everything from FULL'));
      console.log(chalk.white('    - Test repositories and fixtures'));
      console.log(chalk.white('    - Development utilities'));
      console.log(chalk.white('    - Debug configurations'));
      console.log(chalk.gray('    -> For contributors and package development'));

      console.log(chalk.blue('\n[DOCS] Interactive Setup:'));
      console.log(chalk.cyan('  sc init --interactive'));
      console.log(chalk.white('    - Guided setup with custom configuration'));
      console.log(chalk.white('    - Choose specific features'));
      console.log(chalk.white('    - Project-specific optimizations'));

      console.log(chalk.blue('\n[CHECK] Dry Run (Preview):'));
      console.log(chalk.cyan('  sc init --standard --dry-run'));
      console.log(chalk.white('    - See what would be installed'));
      console.log(chalk.white('    - No files created or modified'));
      console.log(chalk.white('    - Perfect for planning'));

      console.log(
        chalk.blue(
          '\n[TIP] Quick Start: sc init --standard (recommended for most projects)'
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
          '[ERROR] No git repository found. Please run "git init" first or specify a directory with a git repository.'
        )
      );
      process.exit(1);
    }

    const gitValidation = await validateGitRepository(gitRoot) as GitValidation;
    const gitInfo = await getGitInfo(gitRoot) as GitInfo;

    console.log(chalk.blue('[LAUNCH] Supernal Coding Repository Equipment Pack'));
    console.log(chalk.blue('='.repeat(60)));

    // Determine preset
    const preset = determinePreset(options);
    if (preset) {
      const presetDescriptions: Record<string, string> = {
        minimal: 'Essential tools and workflow automation',
        standard:
          'Complete development environment with git integration and quality checks',
        full: 'Advanced features with testing framework and multi-environment support',
        development:
          'Full development setup with test repositories and debug tools',
      };

      console.log(
        chalk.green(`\n[PACKAGE] Installing preset: ${preset.toUpperCase()}`)
      );
      console.log(chalk.white(`   ${presetDescriptions[preset]}`));
    }

    console.log(chalk.white(`Target directory: ${absoluteTargetDir}`));

    // Analyze repository structure
    console.log(chalk.blue('\n[CHECK] Analyzing Git repository structure...'));
    console.log(chalk.green(`[OK] Git repository found: ${gitRoot}`));

    if (gitValidation.warnings.length > 0) {
      console.log(chalk.yellow('[WARN] Git repository warnings:'));
      gitValidation.warnings.forEach((warning) => {
        console.log(chalk.yellow(`   - ${warning}`));
      });
    }

    console.log(chalk.white(`   Branch: ${gitInfo.currentBranch}`));

    // Analyze repository structure
    console.log(chalk.blue('\n[DIR] Analyzing repository structure...'));
    const structure = await analyzeRepositoryStructure(gitRoot);
    console.log(chalk.green(`[OK] Repository type: ${structure.type}`));

    // Get resolved paths
    const resolvedPaths = getAllResolvedPaths(gitRoot);
    const pathValidation = validatePathResolution(resolvedPaths) as PathValidation;

    console.log(chalk.blue('\n[DIR] Path resolution analysis:'));
    if (
      pathValidation?.missingPaths &&
      pathValidation.missingPaths.length > 0
    ) {
      console.log(chalk.yellow('[WARN] Some paths missing:'));
      pathValidation.missingPaths.forEach((pathInfo) => {
        console.log(chalk.yellow(`   - ${pathInfo.key}`));
      });
    }

    if (
      pathValidation?.optionalMissing &&
      pathValidation.optionalMissing.length > 0
    ) {
      console.log(chalk.yellow('[WARN] Optional paths missing:'));
      pathValidation.optionalMissing.forEach((pathInfo) => {
        console.log(
          chalk.yellow(`   - Missing optional path: ${pathInfo.key}`)
        );
      });
    }

    // Detect project type
    console.log(chalk.blue('\n[CHECK] Analyzing project type...'));
    const detectedType = await detectProjectType(absoluteTargetDir) as DetectedType;
    console.log(chalk.green(`[DOCS] Detected project type: ${detectedType.name}`));
    console.log(chalk.white(`   ${detectedType.description}`));
    console.log(
      chalk.yellow(
        `[WARN] Detection confidence: ${Math.round(detectedType.confidence)}%`
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
          '\n[DOCS] Using default configuration (use --interactive for custom setup)'
        )
      );
    }

    // Show equipment pack summary
    showEquipmentPackSummary(activeFeatures, detectedType);

    // Check for installation conflicts
    console.log(chalk.blue('\n[CHECK] Checking for existing installations...'));
    const conflicts = await detectInstallationConflicts(
      absoluteTargetDir,
      activeFeatures
    ) as ConflictsResult;

    if (conflicts.hasConflicts && !options.overwrite && !options.dryRun) {
      // If merge option is enabled, analyze merge compatibility
      if (options.merge) {
        console.log(chalk.blue('\n[CHECK] Analyzing merge compatibility...'));
        const mergeAnalysis = await analyzeMergeCompatibility(
          absoluteTargetDir,
          conflicts.conflicts as any,
          activeFeatures
        ) as MergeAnalysis;

        if (mergeAnalysis.canMerge) {
          console.log(
            chalk.green('\n[OK] Merge analysis complete - safe to merge')
          );
          console.log(chalk.white('\nMerge Plan:'));

          mergeAnalysis.mergeActions?.forEach((action) => {
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
              console.log(chalk.gray(`  [WARN] ${warning}`));
            });
          }

          // Continue with installation in merge mode
          console.log(chalk.blue('\n[MERGE] Proceeding with intelligent merge...'));
        } else {
          console.log(chalk.red('\n[ERROR] Merge analysis failed'));
          console.log(chalk.red('\nBlocking Conflicts:'));
          if (
            mergeAnalysis.blockingConflicts &&
            mergeAnalysis.blockingConflicts.length > 0
          ) {
            mergeAnalysis.blockingConflicts.forEach((conflict) => {
              console.log(chalk.red(`  - ${conflict.type}`));
              console.log(chalk.white(`    ${conflict.description}`));
              if (conflict.path) {
                console.log(chalk.gray(`    Path: ${conflict.path}`));
              }
            });
          }
          console.log(chalk.blue('\n[TIP] Solutions:'));
          console.log(chalk.white('  - Use --overwrite to force overwrite'));
          console.log(
            chalk.white('  - Resolve conflicts manually and try again')
          );
          process.exit(1);
        }
      } else {
        // No merge option, show conflict error
        console.log(chalk.red('\n[ERROR] Installation conflicts detected\n'));

        // Display each conflict with details
        conflicts.conflicts.forEach((conflict) => {
          console.log(chalk.yellow(`  - ${conflict.type}`));
          console.log(chalk.white(`    ${conflict.description}`));
          if (conflict.details && conflict.details.length > 0) {
            conflict.details.forEach((detail) => {
              console.log(chalk.gray(`      - ${detail}`));
            });
          }
        });

        // Display solutions
        console.log(chalk.blue('\n[TIP] Solutions:'));
        console.log(
          chalk.white('  - Use --overwrite to force overwrite existing files')
        );
        console.log(
          chalk.white('  - Use --merge to intelligently merge compatible files')
        );
        console.log(
          chalk.white('  - Use --dry-run to preview changes without installing')
        );
        console.log(
          chalk.white('  - Manually resolve conflicts and try again')
        );

        process.exit(1);
      }
    } else if (!options.dryRun) {
      console.log(chalk.green('[OK] No installation conflicts detected'));
    }

    // Dry run check
    if (options.dryRun) {
      console.log(chalk.blue('\n[CHECK] Dry run mode - No files will be created'));
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
    const localConfig: Record<string, unknown> = {
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
        (key) => activeFeatures[key as keyof ActiveFeatures] === true
      ),
      equipmentPack: {
        version: '1.0.0',
        components: {} as Record<string, unknown>,
      },
    };

    // Add component details to local config
    const equipmentPackConfig = localConfig.equipmentPack as { components: Record<string, unknown> };
    Object.keys(EQUIPMENT_PACK).forEach((featureKey) => {
      if (activeFeatures[featureKey as keyof ActiveFeatures]) {
        equipmentPackConfig.components[featureKey] =
          (EQUIPMENT_PACK as Record<string, { components: unknown }>)[featureKey].components;
      }
    });

    // Add project-specific components
    const projectTypeConfig = PROJECT_TYPES[detectedType.type];
    if (projectTypeConfig && projectTypeConfig.additionalRules.length > 0) {
      equipmentPackConfig.components.projectSpecific = {
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
    console.log(chalk.blue('\n[SECURITY] Installing .gitignore...'));
    await installGitignore(gitRoot, options);

    console.log(
      chalk.green('\n[SUCCESS] Repository Equipment Pack installed successfully!')
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
      console.log(chalk.blue('[TARGET] Workflow state tracking initialized'));
    } catch (error) {
      const err = error as Error;
      console.warn(
        chalk.yellow(
          `[WARN] Could not initialize workflow tracking: ${err.message}`
        )
      );
    }

    // Generate actionable next steps based on project type and configuration
    await showActionableNextSteps(
      detectedType as any,
      activeFeatures as any,
      gitRoot,
      resolvedPaths as any
    );
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`[ERROR] Initialization failed: ${err.message}`));
    if (options.verbose) {
      console.error(chalk.gray(err.stack));
    }
    process.exit(1);
  }
}

/**
 * Determine active features based on preset and options
 * @param preset - Selected preset
 * @param detectedType - Detected project type
 * @param options - Command line options
 * @returns Active features configuration
 */
function determineActiveFeatures(preset: string | null, detectedType: DetectedType, options: InitOptions): ActiveFeatures {
  const baseFeatures: ActiveFeatures = {
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
 * @param activeFeatures - Active features
 * @param detectedType - Detected project type
 */
function showEquipmentPackSummary(activeFeatures: ActiveFeatures, detectedType: DetectedType): void {
  console.log(chalk.blue('\n[OK] Equipment Pack Summary:'));

  // Core System (always active)
  console.log(chalk.green('  [OK] Core System (required)'));
  console.log(
    chalk.white(
      '    Complete auto-building, auto-documenting, auto-testing system'
    )
  );

  // Git Management
  if (activeFeatures.gitManagement) {
    console.log(chalk.green('  [OK] Git Management (optional)'));
    console.log(
      chalk.white(
        '    Automated git workflows, branch management, and compliance'
      )
    );
  }

  // Project-specific rules
  const projectTypeConfig = PROJECT_TYPES[detectedType.type];
  if (projectTypeConfig && projectTypeConfig.additionalRules.length > 0) {
    console.log(
      chalk.green(
        `  [OK] ${detectedType.name} Rules (${projectTypeConfig.additionalRules.length} additional)`
      )
    );
    console.log(
      chalk.white(`    ${projectTypeConfig.additionalRules.join(', ')}`)
    );
  }
}

export {
  initCommand as handleInitCommand, // Alias for new CLI
  initCommand,
  handleContentInstall,
  determinePreset,
  determineActiveFeatures,
  showEquipmentPackSummary,
  EQUIPMENT_PACK,
};

module.exports = {
  handleInitCommand: initCommand, // Alias for new CLI
  initCommand,
  handleContentInstall,
  determinePreset,
  determineActiveFeatures,
  showEquipmentPackSummary,
  EQUIPMENT_PACK,
};
