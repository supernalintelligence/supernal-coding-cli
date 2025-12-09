#!/usr/bin/env node

const chalk = require('chalk');
const SolutionsMapper = require('../../solutions/SolutionsMapper');
const { loadProjectConfig } = require('../../utils/config-loader');

/**
 * Solutions Command Handler
 * CLI interface for solutions mapping and compliance tracing
 */
class SolutionsCommandHandler {
  constructor() {
    this.projectRoot = this.findProjectRoot();
    this.config = loadProjectConfig(this.projectRoot);
    this.mapper = new SolutionsMapper(this.projectRoot);
  }

  /**
   * Find the project root
   */
  findProjectRoot() {
    const fs = require('fs-extra');
    const path = require('node:path');
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      const configPath = path.join(currentDir, 'supernal.yaml');
      if (fs.existsSync(configPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }

    return process.cwd();
  }

  /**
   * Handle solutions command
   */
  async handleCommand(action, ...args) {
    try {
      if (!action) {
        this.showHelp();
        return;
      }

      switch (action) {
        case 'map': {
          if (args.length === 0) {
            console.error(chalk.red('❌ Requirement ID is required'));
            console.log(chalk.blue('Usage: sc solutions map REQ-AUTH-001'));
            process.exit(1);
          }
          const reqId = args[0];
          const options = this.parseOptions(args.slice(1));
          await this.mapper.mapComponents(reqId, options);
          break;
        }

        case 'map-all': {
          const mapAllOptions = this.parseOptions(args);
          await this.mapAllRequirements(mapAllOptions);
          break;
        }

        case 'report':
        case 'compliance-report': {
          await this.mapper.generateComplianceReport();
          break;
        }

        case 'help':
          this.showHelp();
          break;

        default:
          console.log(chalk.red(`❌ Unknown action: "${action}"`));
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Command failed: ${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Map all requirements
   */
  async mapAllRequirements(options) {
    console.log(
      chalk.blue('🔍 Mapping all requirements to code components...')
    );

    const fs = require('fs-extra');
    const path = require('node:path');
    const matter = require('gray-matter');

    const reqDir = path.join(this.projectRoot, 'docs', 'requirements');
    const reqFiles = [];

    // Collect all requirement files
    async function collectFiles(dir) {
      if (!(await fs.pathExists(dir))) return;

      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          await collectFiles(fullPath);
        } else if (item.name.endsWith('.md') && item.name.includes('req-')) {
          reqFiles.push(fullPath);
        }
      }
    }

    await collectFiles(reqDir);

    console.log(chalk.cyan(`   Found ${reqFiles.length} requirement files`));

    let mapped = 0;
    for (const reqFile of reqFiles) {
      try {
        const content = await fs.readFile(reqFile, 'utf8');
        const { data } = matter(content);

        if (data.id) {
          console.log(chalk.gray(`   Mapping ${data.id}...`));
          await this.mapper.mapComponents(data.id, {
            ...options,
            quiet: true
          });
          mapped++;
        }
      } catch (error) {
        console.log(
          chalk.yellow(`   ⚠️  Failed to map ${reqFile}: ${error.message}`)
        );
      }
    }

    console.log(
      chalk.green(`✅ Mapped ${mapped}/${reqFiles.length} requirements`)
    );

    // Generate compliance report
    await this.mapper.generateComplianceReport();
  }

  /**
   * Parse command options
   */
  parseOptions(args) {
    const options = {};
    for (const arg of args) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        if (key === 'searchDirs') {
          options[key] = value ? value.split(',') : [];
        } else if (key === 'updateRequirement' || key === 'generateTrace') {
          options[key] = value !== 'false';
        } else {
          options[key] = value || true;
        }
      }
    }
    return options;
  }

  /**
   * Show help
   */
  showHelp() {
    console.log(chalk.bold('\n🔗 Solutions Mapping & Compliance Tracing\n'));

    console.log(chalk.cyan('Commands:'));
    console.log(
      '  map <requirement-id>         Map code components for a requirement'
    );
    console.log('  map-all                      Map all requirements to code');
    console.log('  report                       Generate compliance report\n');

    console.log(chalk.cyan('Options:'));
    console.log(
      '  --searchDirs=<dirs>          Comma-separated directories to scan (default: src,lib,apps)'
    );
    console.log(
      '  --updateRequirement=false    Skip updating requirement file'
    );
    console.log(
      '  --generateTrace=false        Skip generating trace document\n'
    );

    console.log(chalk.cyan('How it Works:'));
    console.log(
      '  1. Scans codebase for comments/annotations referencing requirement ID'
    );
    console.log(
      '  2. Identifies functions, classes, and exports in those files'
    );
    console.log('  3. Updates requirement file with component mappings');
    console.log(
      '  4. Generates trace document in docs/solutions/ for compliance\n'
    );

    console.log(chalk.cyan('Code Annotation Examples:'));
    console.log(
      chalk.gray('  // REQ-AUTH-001: Implement email validation logic')
    );
    console.log(chalk.gray('  /**'));
    console.log(chalk.gray('   * @requirement REQ-AUTH-001'));
    console.log(
      chalk.gray('   * Validates email format for user registration')
    );
    console.log(chalk.gray('   */'));
    console.log(
      chalk.gray('  @Requirement("REQ-AUTH-001") // Decorator style\n')
    );

    console.log(chalk.cyan('Examples:'));
    console.log(chalk.gray('  sc solutions map REQ-AUTH-001'));
    console.log(
      chalk.gray('  sc solutions map SUB-REQ-AUTH-001.A --searchDirs=src,lib')
    );
    console.log(chalk.gray('  sc solutions map-all'));
    console.log(chalk.gray('  sc solutions report\n'));

    console.log(chalk.cyan('Benefits:'));
    console.log('  • Automatic code-to-requirement traceability');
    console.log('  • Compliance audit support');
    console.log('  • Impact analysis for requirement changes');
    console.log('  • Documentation of implementation coverage\n');
  }
}

// CLI Interface
async function handleSolutionsCommand(action, ...args) {
  const handler = new SolutionsCommandHandler();
  await handler.handleCommand(action, ...args);
}

module.exports = {
  SolutionsCommandHandler,
  handleSolutionsCommand
};

// If called directly
if (require.main === module) {
  const [, , action, ...args] = process.argv;
  handleSolutionsCommand(action, ...args);
}
