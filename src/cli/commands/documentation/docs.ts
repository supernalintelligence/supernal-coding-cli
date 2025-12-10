#!/usr/bin/env node
// @ts-nocheck

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

class DocsWrapper {
  docSystemScript: any;
  generateScript: any;
  scriptsDir: any;
  constructor() {
    this.scriptsDir = path.join(__dirname, 'docs-scripts');
    this.generateScript = path.join(this.scriptsDir, 'generate-docs.cjs');
    this.docSystemScript = path.join(this.scriptsDir, 'doc-system.cjs');
  }

  // Execute documentation scripts
  runScript(scriptPath, args = []) {
    try {
      if (!fs.existsSync(scriptPath)) {
        console.error(
          `${colors.red}❌ Documentation script not found: ${scriptPath}${colors.reset}`
        );
        return;
      }

      const command = `node "${scriptPath}" ${args.map((arg) => `"${arg}"`).join(' ')}`;
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      if (error.status !== 0) {
        process.exit(error.status);
      }
    }
  }

  // Route commands to appropriate scripts
  async execute(action, options = {}) {
    switch (action) {
      case 'process': {
        console.log(
          `${colors.blue}📖 Processing documentation file...${colors.reset}`
        );
        // Load process command dynamically
        const processCmd = require(
          path.join(__dirname, '..', 'docs', 'process')
        );
        const docFile = options.file || options._ || process.argv[3];
        if (!docFile) {
          processCmd.showHelp();
          return;
        }
        await processCmd.processDocumentation(docFile, options);
        break;
      }

      case 'cleanup': {
        console.log(
          `${colors.blue}🔍 Scanning documentation structure...${colors.reset}`
        );
        // Load cleanup command dynamically
        const cleanupCmd = require(
          path.join(__dirname, '..', 'docs', 'cleanup')
        );
        await cleanupCmd.run({
          autoFix: options.autoFix || false,
          interactive: options.interactive || false,
          dryRun: options.dryRun || false,
          verbose: options.verbose || false
        });
        break;
      }

      case 'generate':
        console.log(
          `${colors.blue}📝 Generating documentation...${colors.reset}`
        );
        this.runScript(
          this.generateScript,
          options.format ? ['--format', options.format] : []
        );
        break;

      case 'validate':
        console.log(
          `${colors.blue}🔍 Validating documentation...${colors.reset}`
        );
        await this.validateDocumentation(options);
        break;

      case 'build':
        console.log(
          `${colors.blue}🏗️  Building documentation system...${colors.reset}`
        );
        this.runScript(this.docSystemScript, ['build']);
        break;

      case 'init':
        console.log(
          `${colors.blue}🏗️  Initializing documentation system...${colors.reset}`
        );
        this.runScript(this.docSystemScript, ['init']);
        break;

      case 'check':
        console.log(
          `${colors.blue}🔍 Checking documentation system status...${colors.reset}`
        );
        this.runScript(this.docSystemScript, ['check']);
        break;

      default:
        this.showHelp();
        break;
    }
  }

  async validateDocumentation(options = {}) {
    // Determine which validators to run
    const runStructure =
      options.structure ||
      options.all ||
      (!options.template && !options.structure);
    const runTemplate = options.template || options.all;

    let hasErrors = false;

    // Run structure validation (DocumentationValidator)
    if (runStructure) {
      console.log(
        `${colors.blue}📋 Running structure validation...${colors.reset}`
      );
      const DocumentationValidator = require('../../../validation/DocumentationValidator');
      const structureValidator = new DocumentationValidator();
      const result = await structureValidator.validate();

      if (options.fix && !result.success) {
        console.log(
          `${colors.blue}\n🔧 Applying structure fixes...${colors.reset}`
        );
        const fixResult = await structureValidator.fixIdFilenameMismatches();

        console.log(`${colors.blue}\n📊 Fix Summary:${colors.reset}`);
        console.log(
          `${colors.green}   ✅ Fixed: ${fixResult.fixed}${colors.reset}`
        );
        if (fixResult.failed > 0) {
          console.log(
            `${colors.red}   ❌ Failed: ${fixResult.failed}${colors.reset}`
          );
        }

        // Re-validate
        console.log(
          `${colors.blue}\n🔍 Re-validating structure...${colors.reset}`
        );
        const finalResult = await structureValidator.validate();
        hasErrors = !finalResult.success;
      } else {
        hasErrors = !result.success;
      }
    }

    // Run template validation (TemplateValidator)
    if (runTemplate) {
      console.log(
        `${colors.blue}\n📝 Running template validation...${colors.reset}`
      );
      const {
        TemplateValidator
      } = require('../../../validation/TemplateValidator');

      const validator = new TemplateValidator({
        projectRoot: process.cwd(),
        verbose: options.verbose || false
      });

      // Find directories to validate
      const dirsToValidate = ['docs', 'requirements', 'evidence', 'templates']
        .map((dir) => path.join(process.cwd(), dir))
        .filter((dir) => fs.existsSync(dir));

      let allResults = [];
      for (const dir of dirsToValidate) {
        const results = await validator.validateDirectory(dir);
        allResults = allResults.concat(results);
      }

      if (options.fix) {
        const invalidResults = allResults.filter((r) => !r.valid);
        if (invalidResults.length > 0) {
          console.log(
            `${colors.blue}\n🔧 Applying template fixes...${colors.reset}`
          );
          for (const result of invalidResults) {
            const fixResult = await validator.validateAndFix(result.file, {
              autoFix: true
            });
            if (fixResult.fixed) {
              console.log(
                `${colors.green}✅ Fixed: ${path.relative(process.cwd(), result.file)}${colors.reset}`
              );
            }
          }
        }
      }

      const summary = validator.getSummary(allResults);
      if (summary.invalid > 0) {
        hasErrors = true;
      }
    }

    return { success: !hasErrors };
  }

  showHelp() {
    console.log(
      `${colors.bold}Supernal Coding - Documentation System${colors.reset}`
    );
    console.log('======================================');
    console.log('');
    console.log(
      `${colors.bold}Usage:${colors.reset} sc docs <action> [options]`
    );
    console.log('');
    console.log(`${colors.bold}Actions:${colors.reset}`);
    console.log(
      `  ${colors.green}process <file>${colors.reset}          Extract and implement code blocks from documentation`
    );
    console.log(
      `  ${colors.green}cleanup${colors.reset}                  Scan and cleanup documentation structure (ADR-001)`
    );
    console.log(
      `  ${colors.green}generate${colors.reset}                 Generate documentation from templates`
    );
    console.log(
      `  ${colors.green}validate${colors.reset}                 Validate documentation structure and content`
    );
    console.log('');
    console.log(`${colors.bold}Options:${colors.reset}`);
    console.log(
      `  ${colors.yellow}--structure${colors.reset}              Run structure validation (organization, naming, references)`
    );
    console.log(
      `  ${colors.yellow}--template${colors.reset}               Run template validation (frontmatter against .template.md)`
    );
    console.log(
      `  ${colors.yellow}--all${colors.reset}                    Run both structure and template validation`
    );
    console.log(
      `  ${colors.yellow}--fix${colors.reset}                    Automatically fix issues where possible`
    );
    console.log(
      `  ${colors.yellow}--auto-fix${colors.reset}               Automatically fix documentation issues`
    );
    console.log(
      `  ${colors.yellow}--interactive${colors.reset}            Review each change interactively`
    );
    console.log(
      `  ${colors.yellow}--dry-run${colors.reset}                Show what would be done without making changes`
    );
    console.log(
      `  ${colors.yellow}--format <format>${colors.reset}        Output format (html, pdf, markdown)`
    );
    console.log(
      `  ${colors.yellow}--output <path>${colors.reset}          Output directory`
    );
    console.log(
      `  ${colors.yellow}--verbose${colors.reset}                Verbose output`
    );
    console.log('');
    console.log(`${colors.bold}Examples:${colors.reset}`);
    console.log(
      `  sc docs process docs/features/{domain}/my-feature/planning/implementation.md`
    );
    console.log(
      `  sc docs cleanup                    # Scan for documentation issues`
    );
    console.log(`  sc docs cleanup --auto-fix         # Fix automatically`);
    console.log(`  sc docs cleanup --dry-run          # Preview changes`);
    console.log(`  sc docs generate --format html`);
    console.log(`  sc docs validate --verbose`);
    console.log(`  sc docs build`);
    console.log('');
    console.log(
      'This wrapper executes the proven documentation scripts while providing'
    );
    console.log('a unified CLI interface through the sc command.');
  }
}

// CLI Interface
async function main(action, options) {
  const docs = new DocsWrapper();
  await docs.execute(action, options);
}

if (require.main === module) {
  const action = process.argv[2];
  const options = {};

  // Parse simple options
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--auto-fix') {
      options.autoFix = true;
    } else if (arg === '--interactive') {
      options.interactive = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--format' && i + 1 < process.argv.length) {
      options.format = process.argv[i + 1];
      i++; // Skip next arg
    } else if (arg === '--output' && i + 1 < process.argv.length) {
      options.output = process.argv[i + 1];
      i++; // Skip next arg
    }
  }

  main(action, options);
}

module.exports = DocsWrapper;
