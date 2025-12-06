const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const { loadProjectConfig, getDocPaths } = require('../../utils/config-loader');
const DocumentManager = require('../base/DocumentManager');
const RequirementHelpers = require('./utils/helpers');
const {
  extractFrontmatter,
  parseContent,
  reconstructContent
} = require('./utils/parsers');
const RequirementTemplates = require('./utils/templates');
const _TemplateResolver = require('../../../utils/template-resolver');

/**
 * Core requirement management operations (CRUD)
 */
class RequirementManager extends DocumentManager {
  constructor() {
    super({
      documentType: 'requirement',
      prefix: 'req',
      baseDirectory: 'docs/requirements'
    });
    const config = loadProjectConfig(this.projectRoot);
    const paths = getDocPaths(config);
    this.requirementsPath = path.join(this.projectRoot, paths.requirements);
    // Remove project templates path - use TemplateResolver from base class
  }

  /**
   * Get next available requirement ID
   */
  async getNextRequirementId() {
    // Use base class method to get all document files
    const reqFiles = await this.getAllDocumentFiles();
    let highestId = 0;

    for (const file of reqFiles) {
      const match = file.match(/req-(\d+)/);
      if (match) {
        const id = parseInt(match[1], 10);
        if (id > highestId) {
          highestId = id;
        }
      }
    }

    return highestId + 1;
  }

  /**
   * Load template file
   */
  async loadTemplate(templateName) {
    try {
      // Use parent's TemplateResolver (checks project overrides, then package)
      const templatePath = this.templateResolver.resolve(templateName);
      if (await fs.pathExists(templatePath)) {
        const content = await fs.readFile(templatePath, 'utf8');
        const templateVersion = this.extractTemplateVersion(content);

        return {
          content,
          path: templatePath,
          version: templateVersion || '1.0.0',
          name: templateName
        };
      }
    } catch (_error) {
      // Template not found, fall back to default
    }

    // Fallback to basic template if template not found
    const defaultContent = RequirementTemplates.getDefaultTemplate();
    return {
      content: defaultContent,
      path: null,
      version: '1.0.0',
      name: 'default'
    };
  }

  /**
   * Extract version from template frontmatter
   */
  extractTemplateVersion(content) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return null;

    const versionMatch = match[1].match(/version:\s*["']?([^"'\n]+)["']?/);
    return versionMatch ? versionMatch[1].trim() : null;
  }

  /**
   * Inject template provenance into frontmatter
   */
  injectProvenance(content, provenance) {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return content; // No frontmatter, return as-is

    const frontmatter = match[1];
    const body = content.substring(match[0].length);

    // Add provenance fields at the start of frontmatter
    const provenanceFields = [
      `# Template Provenance`,
      `created_from_template: ${provenance.created_from_template}`,
      `version: ${provenance.version}`,
      `created: ${provenance.created}`,
      ``
    ].join('\n');

    return `---\n${provenanceFields}\n${frontmatter}\n---${body}`;
  }

  /**
   * Create a new requirement
   */
  async createRequirement(title, options = {}) {
    try {
      // Validate title parameter
      if (typeof title !== 'string' || title.trim() === '') {
        throw new Error('Title is required and must be a non-empty string');
      }

      const reqId = await this.getNextRequirementId();
      const normalizedId = reqId.toString().padStart(3, '0');

      // Determine target directory
      let reqDir;
      let relativeNote = '';

      // Normalize legacy --feature to --feature-path
      const featurePath = options.featurePath || options.feature;

      if (featurePath) {
        // Feature-specific requirement: docs/features/{domain}/{feature}/requirements/
        reqDir = path.join(
          this.projectRoot,
          'docs',
          'features',
          featurePath,
          'requirements'
        );
        relativeNote = ` (feature-specific: ${featurePath})`;

        // Validate feature directory exists
        const featureDir = path.join(
          this.projectRoot,
          'docs',
          'features',
          featurePath
        );
        if (!(await fs.pathExists(featureDir))) {
          // Provide helpful error with suggestion
          const [domain, featureName] = featurePath.split('/');
          throw new Error(
            `Feature directory does not exist: docs/features/${featurePath}\n\n` +
              `Create the feature first:\n` +
              `  1. Create directory: mkdir -p docs/features/${featurePath}\n` +
              `  2. Create subdirectories: mkdir -p docs/features/${featurePath}/{design,planning,requirements,tests,research,implementation}\n` +
              `  3. Create README.md with feature metadata\n` +
              `  4. (Optional) Register for feature-based commits: sc feature add ${featureName || domain}\n\n` +
              `Or use --epic or --category for centralized requirements:\n` +
              `  sc requirement new "${title}" --epic=epic-name\n` +
              `  sc requirement new "${title}" --category=infrastructure`
          );
        }

        // Check if feature has README.md
        const featureReadme = path.join(featureDir, 'README.md');
        if (!(await fs.pathExists(featureReadme))) {
          console.warn(
            chalk.yellow(
              `\n⚠️  Warning: Feature ${featurePath} is missing README.md\n` +
                `   Consider creating a README.md with feature metadata.\n`
            )
          );
        }
      } else {
        // Centralized requirement: docs/requirements/{category}/
        const category =
          options.category ||
          (options.epic
            ? RequirementHelpers.epicToCategory(options.epic)
            : 'workflow');
        reqDir = path.join(this.requirementsPath, category);
        relativeNote = ` (centralized: ${category})`;
      }

      // Ensure directory exists
      await fs.ensureDir(reqDir);

      // Create requirement file with proper kebab-case name
      const kebabName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const fileName = `req-${normalizedId}-${kebabName}.md`;
      const filePath = path.join(reqDir, fileName);

      // Check if file already exists
      if (await fs.pathExists(filePath)) {
        throw new Error(`Requirement file already exists: ${filePath}`);
      }

      // Load template and replace placeholders
      const templateData = await this.loadTemplate('requirement-template.md');

      // Prepare data with template provenance
      const dataWithProvenance = {
        id: normalizedId,
        title,
        ...options
      };

      // Add template tracking if template was loaded successfully
      if (templateData.path) {
        const relativePath = path.relative(
          path.dirname(filePath),
          templateData.path
        );
        dataWithProvenance.created_from_template = `${relativePath}@${templateData.version}`;
        dataWithProvenance.version = '1.0.0'; // Initial version for new requirement
        dataWithProvenance.created = new Date().toISOString().split('T')[0];
      }

      const content = this.populateTemplate(
        templateData.content,
        dataWithProvenance
      );

      // If we have template provenance, inject it into frontmatter
      if (dataWithProvenance.created_from_template) {
        const contentWithProvenance = this.injectProvenance(content, {
          created_from_template: dataWithProvenance.created_from_template,
          version: dataWithProvenance.version,
          created: dataWithProvenance.created
        });

        // Write file with provenance
        await fs.writeFile(filePath, contentWithProvenance);
      } else {
        // Write file without provenance
        await fs.writeFile(filePath, content);
      }

      console.log(
        chalk.green(
          `✅ Requirement REQ-${normalizedId} created successfully!${relativeNote}`
        )
      );
      console.log(chalk.blue(`📁 File: ${filePath}`));
      if (options.epic) {
        console.log(chalk.blue(`🔗 Epic: ${options.epic}`));
      }
      if (options.featurePath || options.feature) {
        console.log(
          chalk.blue(`📦 Feature: ${options.featurePath || options.feature}`)
        );
      }
      console.log(chalk.yellow(`\n⚠️  TEMPLATE CREATED - NEEDS UPDATING:`));
      console.log(
        chalk.yellow(
          `   1. Replace placeholder content with actual requirements`
        )
      );
      console.log(
        chalk.yellow(`   2. Fill in Gherkin scenarios with specific test cases`)
      );
      console.log(chalk.yellow(`   3. Add technical implementation details`));
      console.log(
        chalk.yellow(
          `   4. Run: sc req validate ${normalizedId} to check completeness`
        )
      );
      console.log(
        chalk.blue(`\n💡 Next steps: Edit the file above, then run validation`)
      );

      return {
        id: normalizedId,
        filePath,
        category: options.category
      };
    } catch (error) {
      console.error(
        chalk.red(`❌ Error creating requirement: ${error.message}`)
      );
      throw error;
    }
  }

  /**
   * Populate template with values
   */
  populateTemplate(template, values) {
    return template
      .replace(/\{\{id\}\}/g, values.id)
      .replace(/\{\{requirement-name\}\}/g, values.title)
      .replace(/\{\{epic-name\}\}/g, values.epic || 'not-assigned')
      .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0])
      .replace(
        /\{\{priority\}\}/g,
        RequirementHelpers.priorityNameToNumber(values.priority) || '2'
      )
      .replace(
        /\{\{user-type\}\}/g,
        values['user-type'] || values.userType || 'developer'
      )
      .replace(
        /\{\{functionality\}\}/g,
        values.functionality || 'Functionality to be defined'
      )
      .replace(/\{\{benefit\}\}/g, values.benefit || 'Benefit to be defined')
      .replace(
        /\{\{request-type\}\}/g,
        values['request-type'] || values.requestType || 'feature'
      )
      .replace(
        /\{\{precondition\}\}/g,
        values.precondition || 'Precondition to be defined'
      )
      .replace(/\{\{action\}\}/g, values.action || 'Action to be defined')
      .replace(
        /\{\{expected-result\}\}/g,
        values.expectedResult || 'Expected result to be defined'
      )
      .replace(
        /\{\{technical-details\}\}/g,
        values.technicalDetails ||
          'Technical implementation details to be added'
      )
      .replace(
        /\{\{test-strategy\}\}/g,
        values.testStrategy || 'Test strategy to be defined'
      )
      .replace(
        /\{\{implementation-notes\}\}/g,
        values.implementationNotes || 'Implementation notes to be added'
      );
  }

  /**
   * List requirements with filtering
   */
  async listRequirements(options = {}) {
    try {
      const files = await this.getAllRequirementFiles();
      const requirements = [];

      for (const file of files) {
        const reqPath = await this.findRequirementFile(file);
        if (reqPath) {
          const content = await fs.readFile(reqPath, 'utf8');
          const frontmatter = extractFrontmatter(content);

          if (!options.status || frontmatter.status === options.status) {
            if (!options.epic || frontmatter.epic === options.epic) {
              requirements.push({
                file,
                path: reqPath,
                ...frontmatter
              });
            }
          }
        }
      }

      // Sort by ID
      requirements.sort((a, b) => {
        const aId = parseInt(a.id?.replace('REQ-', '') || '0', 10);
        const bId = parseInt(b.id?.replace('REQ-', '') || '0', 10);
        return aId - bId;
      });

      if (requirements.length === 0) {
        console.log(chalk.yellow('No requirements found matching criteria.'));
        return;
      }

      console.log(chalk.bold('\n📋 Requirements:\n'));
      for (const req of requirements) {
        const statusColor = RequirementHelpers.getStatusColor(req.status);
        const priorityIcon = RequirementHelpers.getPriorityIcon(req.priority);

        console.log(
          `${priorityIcon} ${statusColor(req.status?.toUpperCase() || 'UNKNOWN')} ${chalk.bold(req.id || 'NO-ID')} ${req.title || req.file || 'NO-TITLE'}`
        );
        if (req.epic && req.epic !== 'not-assigned') {
          console.log(`   ${chalk.dim('Epic:')} ${chalk.cyan(req.epic)}`);
        }
      }

      return requirements;
    } catch (error) {
      console.error(
        chalk.red(`❌ Error listing requirements: ${error.message}`)
      );
      throw error;
    }
  }

  /**
   * Update requirement
   */
  async updateRequirement(reqId, updates) {
    try {
      const reqFile = await this.findRequirementById(reqId);
      if (!reqFile) {
        throw new Error(`Requirement ${reqId} not found`);
      }

      const content = await fs.readFile(reqFile, 'utf8');
      const { frontmatter, body } = parseContent(content);

      // Update frontmatter
      const updatedFrontmatter = {
        ...frontmatter,
        ...updates,
        updated: new Date().toISOString().split('T')[0]
      };

      // Reconstruct file
      const newContent = reconstructContent(updatedFrontmatter, body);
      await fs.writeFile(reqFile, newContent);

      console.log(chalk.green(`✅ Requirement ${reqId} updated successfully!`));
    } catch (error) {
      console.error(
        chalk.red(`❌ Error updating requirement: ${error.message}`)
      );
      throw error;
    }
  }

  /**
   * Delete or archive requirement
   */
  async deleteRequirement(reqId, options = {}) {
    try {
      const reqFile = await this.findRequirementById(reqId);
      if (!reqFile) {
        throw new Error(`Requirement ${reqId} not found`);
      }

      if (!options.force) {
        // Move to archive instead of deleting
        const archivePath = path.join(path.dirname(reqFile), 'archive');
        await fs.ensureDir(archivePath);

        const fileName = path.basename(reqFile);
        const archiveFile = path.join(
          archivePath,
          `${fileName}.archived-${Date.now()}`
        );

        await fs.move(reqFile, archiveFile);
        console.log(
          chalk.yellow(`📦 Requirement ${reqId} archived to: ${archiveFile}`)
        );
      } else {
        await fs.remove(reqFile);
        console.log(chalk.red(`🗑️  Requirement ${reqId} permanently deleted!`));
      }
    } catch (error) {
      console.error(
        chalk.red(`❌ Error deleting requirement: ${error.message}`)
      );
      throw error;
    }
  }

  /**
   * Find requirement by ID
   */
  async findRequirementById(reqId) {
    const normalizedId = RequirementHelpers.normalizeReqId(reqId);
    if (!normalizedId) {
      return null;
    }

    const files = await this.getAllRequirementFiles();
    const targetFile = files.find((f) => f.includes(`req-${normalizedId}`));

    if (targetFile) {
      return await this.findRequirementFile(targetFile);
    }

    return null;
  }

  /**
   * Find requirement file path
   */
  async findRequirementFile(fileName) {
    // Search in all subdirectories
    async function searchDir(dir) {
      if (!(await fs.pathExists(dir))) return null;

      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          const found = await searchDir(fullPath);
          if (found) return found;
        } else if (item.name === fileName) {
          return fullPath;
        }
      }
      return null;
    }

    return await searchDir(this.requirementsPath);
  }

  /**
   * Check for duplicate requirement numbers
   */
  async checkDuplicates() {
    console.log(chalk.cyan('🔍 Checking for duplicate requirement numbers...'));

    const reqFiles = await this.getAllRequirementFiles();
    const reqNumbers = {};
    const duplicates = [];

    // Scan all requirement files for numbers
    for (const file of reqFiles) {
      const match = file.match(/req-(\d{3})/);
      if (match) {
        const reqNum = match[1];
        if (reqNumbers[reqNum]) {
          reqNumbers[reqNum].push(file);
        } else {
          reqNumbers[reqNum] = [file];
        }
      }
    }

    // Find duplicates
    Object.entries(reqNumbers).forEach(([reqNum, fileList]) => {
      if (fileList.length > 1) {
        duplicates.push({ reqNum, files: fileList });
      }
    });

    if (duplicates.length === 0) {
      console.log(chalk.green('✅ No duplicate requirement numbers found!'));
      return true;
    } else {
      console.log(chalk.red('❌ Duplicate requirement numbers detected:'));
      console.log();

      duplicates.forEach(({ reqNum, files }) => {
        console.log(
          chalk.yellow(`🚨 REQ-${reqNum} appears in ${files.length} files:`)
        );
        files.forEach((file) => console.log(`   - ${file}`));
        console.log();
      });

      console.log(chalk.cyan('💡 Resolution:'));
      console.log(
        '   1. Keep the canonical version in supernal-coding/requirements/'
      );
      console.log(
        '   2. Remove task duplicates, handoff records, and epic placeholders'
      );
      console.log('   3. Rename conflicting requirements with new REQ numbers');
      console.log();

      return false;
    }
  }

  /**
   * Show help information
   */
  async showHelp() {
    console.log(chalk.bold('\n🔧 Requirement Management Commands\n'));

    console.log(`${chalk.cyan('sc requirement new')} <title> [options]`);
    console.log('  Create a new requirement');
    console.log('  Options:');
    console.log('    --epic <name>           Epic name (kebab-case)');
    console.log(
      '    --priority <level>      Priority: critical, high, medium, low, deferred'
    );
    console.log('    --functionality <text>  What functionality is needed');
    console.log('    --benefit <text>        What benefit this provides');
    console.log(
      '    --user-type <type>      User type (developer, agent, etc.)'
    );
    console.log();

    console.log(`${chalk.cyan('sc requirement list')} [options]`);
    console.log('  List all requirements');
    console.log('  Options:');
    console.log('    --status <status>       Filter by status');
    console.log('    --epic <name>          Filter by epic');
    console.log();

    console.log(`${chalk.cyan('sc requirement show')} <id>`);
    console.log('  Show details for a specific requirement');
    console.log();

    console.log(`${chalk.cyan('sc requirement update')} <id> [options]`);
    console.log('  Update a requirement');
    console.log('  Options:');
    console.log('    --status <status>       Update status');
    console.log('    --priority <level>      Update priority');
    console.log('    --epic <name>          Update epic');
    console.log();

    console.log(`${chalk.cyan('sc requirement validate')} <id> [options]`);
    console.log('  Validate requirement completeness and quality');
    console.log('  Options:');
    console.log(
      '    --content              Validate content quality (default)'
    );
    console.log('    --naming               Validate file naming consistency');
    console.log('    --all                  Validate both content and naming');
    console.log();

    console.log(`${chalk.cyan('sc requirement validate-all')} [options]`);
    console.log('  Validate all requirements');
    console.log('  Options:');
    console.log('    --naming               Validate naming only');
    console.log('    --dry-run              Show what would be fixed');
    console.log('    --verbose              Show detailed results');
    console.log();

    console.log(
      `${chalk.cyan('sc requirement fix-naming')} <id|--all> [options]`
    );
    console.log('  Fix naming consistency issues');
    console.log('  Options:');
    console.log('    --all                  Fix all files');
    console.log('    --yes                  Skip confirmation');
    console.log();

    console.log(chalk.cyan('sc requirement check-duplicates'));
    console.log('  Check for duplicate requirement numbers across the project');
    console.log();

    console.log(`${chalk.cyan('sc requirement generate-tests')} <id>`);
    console.log('  Generate test files from requirement Gherkin scenarios');
    console.log();

    console.log(`${chalk.cyan('sc requirement validate-coverage')} <id>`);
    console.log(
      '  Analyze test coverage for specific requirement acceptance criteria'
    );
    console.log();

    console.log(chalk.cyan('sc requirement coverage-report'));
    console.log(
      '  Generate comprehensive test coverage report for all requirements'
    );
    console.log();

    console.log(`${chalk.cyan('sc requirement start-work')} <id>`);
    console.log('  Create git branch and prepare for implementation');
    console.log();

    console.log(`${chalk.cyan('sc requirement smart-start')} <id>`);
    console.log(
      '  Smart workflow: commit changes, create branch, update status'
    );
    console.log();

    console.log(`${chalk.cyan('sc requirement search')} <keywords>`);
    console.log('  Search requirements by keywords');
    console.log();

    console.log(`${chalk.cyan('sc requirement delete')} <id> [options]`);
    console.log('  Delete or archive a requirement');
    console.log('  Options:');
    console.log(
      '    --force                Permanently delete (default: archive)'
    );
    console.log();

    console.log(chalk.bold('Examples:'));
    console.log(
      '  sc requirement new "User Authentication" --epic=enhanced-workflow-system --priority=high'
    );
    console.log('  sc requirement list --status=pending');
    console.log('  sc requirement validate 036 --naming');
    console.log('  sc requirement validate-all --dry-run');
    console.log('  sc requirement fix-naming --all --yes');
    console.log('  sc requirement check-duplicates');
    console.log('  sc requirement generate-tests 036');
    console.log('  sc requirement validate-coverage 036');
    console.log('  sc requirement coverage-report');
    console.log('  sc requirement start-work 036');
    console.log('  sc requirement smart-start 036');
    console.log('  sc requirement search "authentication login"');
    console.log('  sc requirement update 036 --status=done');
    console.log('  sc requirement delete 036');
  }
}

module.exports = RequirementManager;
