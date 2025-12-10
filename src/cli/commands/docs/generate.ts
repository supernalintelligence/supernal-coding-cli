// @ts-nocheck
/**
 * sc docs generate - Generate CLI reference documentation from CommandRegistry
 * 
 * This reads command metadata from the registry and generates markdown files.
 * Part of the dogfooding approach - the site uses sc to document itself.
 */

const fs = require('node:fs');
const path = require('node:path');
const chalk = require('chalk');

class DocsGenerator {
  outputDir: string;
  verbose: boolean;
  
  constructor(options: { outputDir?: string; verbose?: boolean } = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'docs', 'cli');
    this.verbose = options.verbose || false;
  }

  /**
   * Get all commands from the registry
   */
  getCommands() {
    const CommandRegistry = require('../../command-registry');
    const registry = new CommandRegistry();
    registry.initialize();
    return registry.getAllCommands();
  }

  /**
   * Generate markdown for a single command
   */
  generateCommandDoc(command: any): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`---`);
    lines.push(`title: sc ${command.name}`);
    lines.push(`description: ${command.description}`);
    lines.push(`---`);
    lines.push('');
    lines.push(`# sc ${command.name}`);
    lines.push('');
    lines.push(command.description);
    lines.push('');
    
    // Alias
    if (command.alias) {
      lines.push(`**Alias:** \`sc ${command.alias}\``);
      lines.push('');
    }
    
    // Usage
    lines.push('## Usage');
    lines.push('');
    let usage = `sc ${command.name}`;
    if (command.arguments && command.arguments.length > 0) {
      usage += ' ' + command.arguments.join(' ');
    }
    if (command.options && command.options.length > 0) {
      usage += ' [options]';
    }
    lines.push('```bash');
    lines.push(usage);
    lines.push('```');
    lines.push('');
    
    // Arguments
    if (command.arguments && command.arguments.length > 0) {
      lines.push('## Arguments');
      lines.push('');
      lines.push('| Argument | Description |');
      lines.push('|----------|-------------|');
      for (const arg of command.arguments) {
        const isRequired = !arg.startsWith('[');
        const argName = arg.replace(/[<>\[\]]/g, '');
        const reqText = isRequired ? '(required)' : '(optional)';
        lines.push(`| \`${arg}\` | ${reqText} |`);
      }
      lines.push('');
    }
    
    // Options
    if (command.options && command.options.length > 0) {
      lines.push('## Options');
      lines.push('');
      lines.push('| Option | Description |');
      lines.push('|--------|-------------|');
      for (const opt of command.options) {
        const [flags, description] = opt;
        lines.push(`| \`${flags}\` | ${description} |`);
      }
      lines.push('');
    }
    
    // Examples placeholder
    lines.push('## Examples');
    lines.push('');
    lines.push('```bash');
    lines.push(`# Basic usage`);
    lines.push(`sc ${command.name}`);
    if (command.alias) {
      lines.push('');
      lines.push(`# Using alias`);
      lines.push(`sc ${command.alias}`);
    }
    lines.push('```');
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * Generate index page listing all commands
   */
  generateIndex(commands: any[]): string {
    const lines: string[] = [];
    
    lines.push(`---`);
    lines.push(`title: CLI Reference`);
    lines.push(`description: Complete reference for all sc CLI commands`);
    lines.push(`---`);
    lines.push('');
    lines.push('# CLI Reference');
    lines.push('');
    lines.push('Complete reference for all `sc` CLI commands.');
    lines.push('');
    lines.push('## Commands');
    lines.push('');
    lines.push('| Command | Description |');
    lines.push('|---------|-------------|');
    
    // Sort commands alphabetically
    const sortedCommands = [...commands].sort((a, b) => a.name.localeCompare(b.name));
    
    for (const cmd of sortedCommands) {
      const link = `./commands/${cmd.name}.md`;
      let aliasText = '';
      if (cmd.alias) {
        aliasText = ` (alias: \`${cmd.alias}\`)`;
      }
      lines.push(`| [\`sc ${cmd.name}\`](${link}) | ${cmd.description}${aliasText} |`);
    }
    lines.push('');
    
    // Quick reference by category
    lines.push('## Quick Reference by Category');
    lines.push('');
    
    const categories = this.categorizeCommands(sortedCommands);
    for (const [category, cmds] of Object.entries(categories)) {
      lines.push(`### ${category}`);
      lines.push('');
      for (const cmd of cmds as any[]) {
        lines.push(`- [\`sc ${cmd.name}\`](./commands/${cmd.name}.md) - ${cmd.description}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Categorize commands by their purpose
   */
  categorizeCommands(commands: any[]): Record<string, any[]> {
    const categories: Record<string, any[]> = {
      'Setup & Configuration': [],
      'Requirements & Planning': [],
      'Git & Version Control': [],
      'Testing & Validation': [],
      'Documentation': [],
      'Development Tools': [],
      'Other': []
    };
    
    for (const cmd of commands) {
      const name = cmd.name.toLowerCase();
      
      if (name.includes('init') || name.includes('config') || name.includes('install')) {
        categories['Setup & Configuration'].push(cmd);
      } else if (name.includes('req') || name.includes('kanban') || name.includes('priority') || name.includes('trace')) {
        categories['Requirements & Planning'].push(cmd);
      } else if (name.includes('git') || name.includes('merge')) {
        categories['Git & Version Control'].push(cmd);
      } else if (name.includes('test') || name.includes('validate') || name.includes('check')) {
        categories['Testing & Validation'].push(cmd);
      } else if (name.includes('doc')) {
        categories['Documentation'].push(cmd);
      } else if (name.includes('dev') || name.includes('build') || name.includes('deploy') || name.includes('dashboard')) {
        categories['Development Tools'].push(cmd);
      } else {
        categories['Other'].push(cmd);
      }
    }
    
    // Remove empty categories
    for (const key of Object.keys(categories)) {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    }
    
    return categories;
  }

  /**
   * Generate all documentation
   */
  async generate(): Promise<{ success: boolean; filesGenerated: number; errors: string[] }> {
    const errors: string[] = [];
    let filesGenerated = 0;
    
    console.log(chalk.blue('📚 Generating CLI reference documentation...'));
    
    try {
      // Ensure output directories exist
      const commandsDir = path.join(this.outputDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      
      // Get all commands
      const commands = this.getCommands();
      
      if (this.verbose) {
        console.log(chalk.gray(`   Found ${commands.length} commands`));
      }
      
      // Generate individual command docs
      for (const command of commands) {
        try {
          const doc = this.generateCommandDoc(command);
          const filePath = path.join(commandsDir, `${command.name}.md`);
          fs.writeFileSync(filePath, doc);
          filesGenerated++;
          
          if (this.verbose) {
            console.log(chalk.gray(`   ✓ ${command.name}.md`));
          }
        } catch (error) {
          errors.push(`Failed to generate ${command.name}: ${error.message}`);
        }
      }
      
      // Generate index
      try {
        const index = this.generateIndex(commands);
        const indexPath = path.join(this.outputDir, 'index.md');
        fs.writeFileSync(indexPath, index);
        filesGenerated++;
        
        if (this.verbose) {
          console.log(chalk.gray(`   ✓ index.md`));
        }
      } catch (error) {
        errors.push(`Failed to generate index: ${error.message}`);
      }
      
      if (errors.length === 0) {
        console.log(chalk.green(`✅ Generated ${filesGenerated} files in ${this.outputDir}`));
      } else {
        console.log(chalk.yellow(`⚠️ Generated ${filesGenerated} files with ${errors.length} errors`));
        for (const err of errors) {
          console.log(chalk.red(`   ${err}`));
        }
      }
      
      return {
        success: errors.length === 0,
        filesGenerated,
        errors
      };
    } catch (error) {
      console.error(chalk.red(`❌ Failed to generate docs: ${error.message}`));
      return {
        success: false,
        filesGenerated,
        errors: [error.message]
      };
    }
  }
}

/**
 * CLI handler for sc docs generate
 */
async function handleDocsGenerateCommand(options: any = {}) {
  const generator = new DocsGenerator({
    outputDir: options.output || options.o,
    verbose: options.verbose || options.v
  });
  
  return await generator.generate();
}

/**
 * Show help
 */
function showHelp() {
  console.log(chalk.bold('sc docs generate - Generate CLI reference documentation'));
  console.log('');
  console.log(chalk.cyan('Usage:'));
  console.log('  sc docs generate [options]');
  console.log('');
  console.log(chalk.cyan('Options:'));
  console.log('  -o, --output <dir>    Output directory (default: docs/cli)');
  console.log('  -v, --verbose         Verbose output');
  console.log('  --help                Show this help');
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log('  sc docs generate                        # Generate to docs/cli/');
  console.log('  sc docs generate --output=docs/ref/cli  # Custom output dir');
  console.log('  sc docs generate --verbose              # Show progress');
}

module.exports = {
  DocsGenerator,
  handleDocsGenerateCommand,
  showHelp
};

