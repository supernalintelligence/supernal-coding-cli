import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';

interface DocsOptions {
  file?: string;
  _?: string;
  autoFix?: boolean;
  interactive?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  format?: string;
  output?: string;
  structure?: boolean;
  template?: boolean;
  all?: boolean;
  fix?: boolean;
}

interface ValidationResult {
  success: boolean;
}

interface FixResult {
  fixed: number;
  failed: number;
}

class DocsWrapper {
  readonly docSystemScript: string;
  readonly generateScript: string;
  readonly scriptsDir: string;

  constructor() {
    this.scriptsDir = path.join(__dirname, 'docs-scripts');
    this.generateScript = path.join(this.scriptsDir, 'generate-docs.cjs');
    this.docSystemScript = path.join(this.scriptsDir, 'doc-system.cjs');
  }

  // Execute documentation scripts
  runScript(scriptPath: string, args: string[] = []): void {
    try {
      if (!fs.existsSync(scriptPath)) {
        console.error(
          chalk.red(`[X] Documentation script not found: ${scriptPath}`)
        );
        return;
      }

      const command = `node "${scriptPath}" ${args.map((arg) => `"${arg}"`).join(' ')}`;
      execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      const err = error as { status?: number };
      if (err.status !== 0) {
        process.exit(err.status || 1);
      }
    }
  }

  // Route commands to appropriate scripts
  async execute(action: string, options: DocsOptions = {}): Promise<ValidationResult | void> {
    switch (action) {
      case 'process': {
        console.log(
          chalk.blue('[i] Processing documentation file...')
        );
        // Load process command dynamically
        const processCmd = await import(
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
          chalk.blue('[i] Scanning documentation structure...')
        );
        // Load cleanup command dynamically
        const cleanupCmd = await import(
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
          chalk.blue('[i] Generating documentation...')
        );
        this.runScript(
          this.generateScript,
          options.format ? ['--format', options.format] : []
        );
        break;

      case 'validate':
        console.log(
          chalk.blue('[i] Validating documentation...')
        );
        return await this.validateDocumentation(options);

      case 'build':
        console.log(
          chalk.blue('[>] Building documentation system...')
        );
        this.runScript(this.docSystemScript, ['build']);
        break;

      case 'init':
        console.log(
          chalk.blue('[>] Initializing documentation system...')
        );
        this.runScript(this.docSystemScript, ['init']);
        break;

      case 'check':
        console.log(
          chalk.blue('[i] Checking documentation system status...')
        );
        this.runScript(this.docSystemScript, ['check']);
        break;

      default:
        this.showHelp();
        break;
    }
  }

  async validateDocumentation(options: DocsOptions = {}): Promise<ValidationResult> {
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
        chalk.blue('[i] Running structure validation...')
      );
      const { DocumentationValidator } = require('../../../validation/DocumentationValidator');
      const structureValidator = new DocumentationValidator();
      const result: ValidationResult = await structureValidator.validate();

      if (options.fix && !result.success) {
        console.log(
          chalk.blue('\n[>] Applying structure fixes...')
        );
        const fixResult: FixResult = await structureValidator.fixIdFilenameMismatches();

        console.log(chalk.blue('\n[i] Fix Summary:'));
        console.log(
          chalk.green(`   [OK] Fixed: ${fixResult.fixed}`)
        );
        if (fixResult.failed > 0) {
          console.log(
            chalk.red(`   [X] Failed: ${fixResult.failed}`)
          );
        }

        // Re-validate
        console.log(
          chalk.blue('\n[i] Re-validating structure...')
        );
        const finalResult: ValidationResult = await structureValidator.validate();
        hasErrors = !finalResult.success;
      } else {
        hasErrors = !result.success;
      }
    }

    // Run template validation (TemplateValidator)
    if (runTemplate) {
      console.log(
        chalk.blue('\n[i] Running template validation...')
      );
      const { TemplateValidator } = require('../../../validation/TemplateValidator');

      const validator = new TemplateValidator({
        projectRoot: process.cwd(),
        verbose: options.verbose || false
      });

      // Find directories to validate
      const dirsToValidate = ['docs', 'requirements', 'evidence', 'templates']
        .map((dir) => path.join(process.cwd(), dir))
        .filter((dir) => fs.existsSync(dir));

      interface ValidationResultItem {
        valid: boolean;
        file: string;
        fixed?: boolean;
      }

      let allResults: ValidationResultItem[] = [];
      for (const dir of dirsToValidate) {
        const results: ValidationResultItem[] = await validator.validateDirectory(dir);
        allResults = allResults.concat(results);
      }

      if (options.fix) {
        const invalidResults = allResults.filter((r) => !r.valid);
        if (invalidResults.length > 0) {
          console.log(
            chalk.blue('\n[>] Applying template fixes...')
          );
          for (const result of invalidResults) {
            const fixResult = await validator.validateAndFix(result.file, {
              autoFix: true
            });
            if (fixResult.fixed) {
              console.log(
                chalk.green(`[OK] Fixed: ${path.relative(process.cwd(), result.file)}`)
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

  showHelp(): void {
    console.log(
      chalk.bold('Supernal Coding - Documentation System')
    );
    console.log('======================================');
    console.log('');
    console.log(
      `${chalk.bold('Usage:')} sc docs <action> [options]`
    );
    console.log('');
    console.log(`${chalk.bold('Actions:')}`);
    console.log(
      `  ${chalk.green('process <file>')}          Extract and implement code blocks from documentation`
    );
    console.log(
      `  ${chalk.green('cleanup')}                  Scan and cleanup documentation structure (ADR-001)`
    );
    console.log(
      `  ${chalk.green('generate')}                 Generate documentation from templates`
    );
    console.log(
      `  ${chalk.green('validate')}                 Validate documentation structure and content`
    );
    console.log('');
    console.log(`${chalk.bold('Options:')}`);
    console.log(
      `  ${chalk.yellow('--structure')}              Run structure validation (organization, naming, references)`
    );
    console.log(
      `  ${chalk.yellow('--template')}               Run template validation (frontmatter against .template.md)`
    );
    console.log(
      `  ${chalk.yellow('--all')}                    Run both structure and template validation`
    );
    console.log(
      `  ${chalk.yellow('--fix')}                    Automatically fix issues where possible`
    );
    console.log(
      `  ${chalk.yellow('--auto-fix')}               Automatically fix documentation issues`
    );
    console.log(
      `  ${chalk.yellow('--interactive')}            Review each change interactively`
    );
    console.log(
      `  ${chalk.yellow('--dry-run')}                Show what would be done without making changes`
    );
    console.log(
      `  ${chalk.yellow('--format <format>')}        Output format (html, pdf, markdown)`
    );
    console.log(
      `  ${chalk.yellow('--output <path>')}          Output directory`
    );
    console.log(
      `  ${chalk.yellow('--verbose')}                Verbose output`
    );
    console.log('');
    console.log(`${chalk.bold('Examples:')}`);
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
async function main(action: string, options: DocsOptions): Promise<void> {
  const docs = new DocsWrapper();
  await docs.execute(action, options);
}

if (require.main === module) {
  const action = process.argv[2];
  const options: DocsOptions = {};

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

export default DocsWrapper;
