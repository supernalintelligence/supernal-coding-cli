const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');

class CommandMapper {
  constructor() {
    this.cliDir = path.join(__dirname, '../..');
    this.mappingFile = path.join(this.cliDir, 'command-mapping.json');
    this.commandsDir = path.join(this.cliDir, 'commands');
  }

  /**
   * Discover all commands by parsing cli/index.js
   */
  async discoverCommands() {
    const indexPath = path.join(this.cliDir, 'index.js');
    const indexContent = await fs.readFile(indexPath, 'utf8');

    const commands = [];

    // Parse .command() definitions using regex
    const commandRegex =
      /program\s*\.command\(['"`]([^'"`]+)['"`]\)\s*\.description\(['"`]([^'"`]+)['"`]\)/g;
    let match;

    while ((match = commandRegex.exec(indexContent)) !== null) {
      const [, commandName, description] = match;

      // Extract the full command block to get arguments and options
      const commandBlock = this.extractCommandBlock(indexContent, match.index);

      commands.push({
        name: commandName,
        description: description,
        arguments: this.parseArguments(commandBlock),
        options: this.parseOptions(commandBlock),
        action: this.parseAction(commandBlock),
        examples: await this.generateExamples(commandName),
        implementationFile: this.findImplementationFile(commandName)
      });
    }

    return commands;
  }

  /**
   * Extract the complete command block from index.js
   */
  extractCommandBlock(content, startIndex) {
    let depth = 0;
    let i = startIndex;
    let block = '';

    // Find the start of the command block - search backwards with safety check
    while (i >= 0 && i < content.length && content.substr(i, 8) !== 'program') {
      i--;
    }

    // If we didn't find 'program', start from the original match
    if (i < 0) {
      i = startIndex;
    }

    // Extract until we find the matching closing
    while (i < content.length) {
      const char = content[i];
      block += char;

      if (char === '{') depth++;
      if (char === '}') depth--;

      // End when we close the action block
      if (depth === 0 && block.includes('.action(')) {
        break;
      }

      i++;
    }

    return block;
  }

  /**
   * Parse command arguments from the command block
   */
  parseArguments(commandBlock) {
    const argRegex =
      /\.argument\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]+)['"`]\)/g;
    const args = [];
    let match;

    while ((match = argRegex.exec(commandBlock)) !== null) {
      const [, syntax, description] = match;
      args.push({
        syntax: syntax,
        description: description,
        required: !syntax.includes('['),
        variadic: syntax.includes('...')
      });
    }

    return args;
  }

  /**
   * Parse command options from the command block
   */
  parseOptions(commandBlock) {
    const optRegex =
      /\.option\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]+)['"`](?:,\s*['"`]([^'"`]+)['"`])?\)/g;
    const options = [];
    let match;

    while ((match = optRegex.exec(commandBlock)) !== null) {
      const [, flags, description, defaultValue] = match;
      options.push({
        flags: flags,
        description: description,
        defaultValue: defaultValue || null,
        required: flags.includes('<') && !flags.includes('[')
      });
    }

    return options;
  }

  /**
   * Parse the action function reference
   */
  parseAction(commandBlock) {
    const actionRegex = /require\(['"`]\.\/commands\/([^'"`]+)['"`]\)/;
    const match = actionRegex.exec(commandBlock);
    return match ? match[1] : null;
  }

  /**
   * Find the implementation file for a command
   */
  findImplementationFile(commandName) {
    const possibleFiles = [
      `${commandName}.js`,
      `${commandName.replace('-', '')}.js`,
      `${commandName.split('-')[0]}.js`
    ];

    for (const file of possibleFiles) {
      const filePath = path.join(this.commandsDir, file);
      if (fs.existsSync(filePath)) {
        return file;
      }
    }

    return null;
  }

  /**
   * Generate examples based on command name and structure
   */
  async generateExamples(commandName) {
    const examples = [];

    switch (commandName) {
      case 'suggest':
        examples.push(
          'sc suggest "The kanban command is slow"',
          'sc suggest "Better error messages needed"'
        );
        break;
      case 'suggest-bug':
        examples.push(
          'sc suggest-bug "CLI crashes on empty directory"',
          'sc suggest-bug "Git hooks fail on Windows"'
        );
        break;
      case 'suggest-feature':
        examples.push(
          'sc suggest-feature "Add dark mode support"',
          'sc suggest-feature "Integration with VS Code"'
        );
        break;
      case 'kanban':
        examples.push(
          'sc kanban list',
          'sc kanban todo "New task"',
          'sc kanban stats'
        );
        break;
      case 'validate':
        examples.push(
          'sc validate --all',
          'sc validate --requirements',
          'sc validate --tests'
        );
        break;
      case 'git-hooks':
        examples.push(
          'sc git-hooks install',
          'sc git-hooks status',
          'sc git-hooks pre-commit'
        );
        break;
      case 'install':
        examples.push(
          'sc install /path/to/project',
          'sc install /path/to/project --components=kanban,git-hooks'
        );
        break;
      default:
        examples.push(`sc ${commandName} --help`);
    }

    return examples;
  }

  /**
   * Analyze command usage patterns in implementation files
   */
  async analyzeImplementation(commandFile) {
    if (!commandFile) return {};

    const filePath = path.join(this.commandsDir, commandFile);
    if (!fs.existsSync(filePath)) return {};

    const content = await fs.readFile(filePath, 'utf8');

    return {
      hasHelpFunction: content.includes('showHelp') || content.includes('help'),
      hasErrorHandling: content.includes('catch') || content.includes('try'),
      usesChalk: content.includes('chalk.'),
      usesFileSystem: content.includes('fs.') || content.includes('fs-extra'),
      complexity: this.calculateComplexity(content),
      dependencies: this.extractDependencies(content)
    };
  }

  /**
   * Calculate implementation complexity
   */
  calculateComplexity(content) {
    const lines = content.split('\n').length;
    const functions = (content.match(/function\s+\w+/g) || []).length;
    const classes = (content.match(/class\s+\w+/g) || []).length;
    const conditionals = (content.match(/if\s*\(/g) || []).length;

    return {
      lines,
      functions,
      classes,
      conditionals,
      score: Math.min(
        10,
        Math.ceil(
          (lines + functions * 5 + classes * 10 + conditionals * 2) / 50
        )
      )
    };
  }

  /**
   * Extract dependencies from require statements
   */
  extractDependencies(content) {
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
    const dependencies = [];
    let match;

    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return dependencies;
  }

  /**
   * Generate the complete command mapping
   */
  async generateMapping() {
    console.log(chalk.cyan('🔍 Discovering commands...'));

    const commands = await this.discoverCommands();
    const mapping = {
      metadata: {
        generated: new Date().toISOString(),
        totalCommands: commands.length,
        cliVersion: this.getCliVersion()
      },
      commands: {}
    };

    for (const command of commands) {
      console.log(chalk.gray(`   Analyzing: ${command.name}`));

      const implementation = await this.analyzeImplementation(
        command.implementationFile
      );

      mapping.commands[command.name] = {
        ...command,
        implementation
      };
    }

    return mapping;
  }

  /**
   * Get CLI version from package.json
   */
  getCliVersion() {
    try {
      const packagePath = path.join(this.cliDir, '../package.json');
      const pkg = require(packagePath);
      return pkg.version;
    } catch (_e) {
      return 'unknown';
    }
  }

  /**
   * Save mapping to file
   */
  async saveMapping(mapping) {
    await fs.writeJson(this.mappingFile, mapping, { spaces: 2 });
    console.log(
      chalk.green(`✅ Command mapping saved to: ${this.mappingFile}`)
    );
  }

  /**
   * Load existing mapping
   */
  async loadMapping() {
    try {
      return await fs.readJson(this.mappingFile);
    } catch (_e) {
      return null;
    }
  }

  /**
   * Generate dynamic help content
   */
  generateDynamicHelp(mapping) {
    let help = chalk.cyan('\n🛠️  Supernal Coding CLI Commands\n\n');

    const categories = this.categorizeCommands(mapping.commands);

    for (const [category, commands] of Object.entries(categories)) {
      help += chalk.yellow(`${category}:\n`);

      for (const command of commands) {
        help += chalk.white(
          `  sc ${command.name.padEnd(20)} ${command.description}\n`
        );

        if (command.examples && command.examples.length > 0) {
          help += chalk.gray(`    Example: ${command.examples[0]}\n`);
        }
      }
      help += '\n';
    }

    help += chalk.gray(
      `Generated from ${mapping.metadata.totalCommands} commands at ${mapping.metadata.generated}\n`
    );

    return help;
  }

  /**
   * Categorize commands for better help organization
   */
  categorizeCommands(commands) {
    const categories = {
      'Core Workflow': [],
      'Development Tools': [],
      'System Management': [],
      'Feedback & Support': []
    };

    for (const [name, command] of Object.entries(commands)) {
      if (['kanban', 'validate', 'priority'].includes(name)) {
        categories['Core Workflow'].push(command);
      } else if (['dev', 'docs', 'generate'].includes(name)) {
        categories['Development Tools'].push(command);
      } else if (['git-hooks', 'install', 'agent'].includes(name)) {
        categories['System Management'].push(command);
      } else if (name.includes('suggest')) {
        categories['Feedback & Support'].push(command);
      } else {
        categories['System Management'].push(command);
      }
    }

    return categories;
  }

  /**
   * Generate README documentation from mapping
   */
  generateReadmeDocumentation(mapping) {
    let doc = '## 📖 Command Reference\n\n';
    doc += '> Auto-generated from CLI code. Updated via git hooks.\n\n';

    const categories = this.categorizeCommands(mapping.commands);

    for (const [category, commands] of Object.entries(categories)) {
      doc += `### ${category}\n\n`;

      for (const command of commands) {
        doc += `#### \`sc ${command.name}\`\n`;
        doc += `${command.description}\n\n`;

        if (command.arguments && command.arguments.length > 0) {
          doc += '**Arguments:**\n';
          for (const arg of command.arguments) {
            const required = arg.required ? '(required)' : '(optional)';
            doc += `- \`${arg.syntax}\` ${required} - ${arg.description}\n`;
          }
          doc += '\n';
        }

        if (command.options && command.options.length > 0) {
          doc += '**Options:**\n';
          for (const opt of command.options) {
            const defaultVal = opt.defaultValue
              ? ` (default: ${opt.defaultValue})`
              : '';
            doc += `- \`${opt.flags}\` - ${opt.description}${defaultVal}\n`;
          }
          doc += '\n';
        }

        if (command.examples && command.examples.length > 0) {
          doc += '**Examples:**\n```bash\n';
          for (const example of command.examples) {
            doc += `${example}\n`;
          }
          doc += '```\n\n';
        }
      }
    }

    doc += `---\n*Documentation auto-generated on ${new Date().toLocaleDateString()} from ${mapping.metadata.totalCommands} commands*\n`;

    return doc;
  }

  /**
   * Generate .cursor/rules content with CLI command knowledge
   */
  generateCursorRulesContent(mapping) {
    const commands = Object.values(mapping.commands);

    // Group commands by category
    const categories = {
      'Core Workflow': ['kanban', 'validate', 'priority'],
      Development: ['generate', 'docs', 'dev'],
      'System Management': ['install', 'git-hooks', 'git-smart', 'deploy'],
      'Feedback & Support': ['suggest', 'suggest-bug', 'suggest-feature'],
      Help: ['help']
    };

    let content = `# 🛠️ Supernal Coding CLI Commands

**All commands can be run with either 'sc' or 'supernal-coding' prefix**

## Quick Reference

`;

    // Generate categorized command list
    for (const [category, commandNames] of Object.entries(categories)) {
      content += `### ${category}\n\n`;

      for (const name of commandNames) {
        const cmd = commands.find((c) => c.name === name);
        if (cmd) {
          content += `**\`sc ${cmd.name}\`** - ${cmd.description}\n`;

          // Add key options if available
          if (cmd.options && cmd.options.length > 0) {
            const keyOptions = cmd.options.slice(0, 2); // Show first 2 options
            content += `  Options: ${keyOptions.map((opt) => `\`${opt.flags}\``).join(', ')}\n`;
          }

          // Add an example
          if (cmd.examples && cmd.examples.length > 0) {
            content += `  Example: \`${cmd.examples[0]}\`\n`;
          }
          content += '\n';
        }
      }
    }

    content += `## Full Command Details

For complete help on any command:
\`\`\`bash
sc <command> --help
\`\`\`

## Agent-Specific Usage Patterns

### Task Management Workflow
\`\`\`bash
sc kanban list          # See current tasks
sc kanban todo "task"   # Create new task  
sc kanban done <id>     # Mark task complete
\`\`\`

### Validation & Quality
\`\`\`bash
sc validate --all       # Full project validation
sc validate --requirements  # Just requirements check
\`\`\`

### Getting Help
\`\`\`bash
sc suggest "feedback"   # Quick GitHub issue creation
sc help                 # Show all commands
\`\`\`

**Total Commands Available: ${mapping.metadata.totalCommands}**
**Last Updated: ${new Date(mapping.metadata.generated).toLocaleString()}**
`;

    return content;
  }

  /**
   * Update .cursor/rules files with CLI knowledge
   */
  async updateCursorRules(mapping) {
    try {
      const cursorRulesDir = path.join(process.cwd(), '.cursor', 'rules');

      // Ensure .cursor/rules directory exists
      await fs.ensureDir(cursorRulesDir);

      // Generate CLI commands reference
      const cliRulesContent = this.generateCursorRulesContent(mapping);
      const cliRulesFile = path.join(
        cursorRulesDir,
        'supernal-cli-commands.mdc'
      );

      await fs.writeFile(cliRulesFile, cliRulesContent);
      console.log(
        chalk.green('✅ Updated .cursor/rules/supernal-cli-commands.mdc')
      );

      // Generate complete agent-on-board.mdc from template
      const agentOnboardContent = this.generateAgentOnboardTemplate(mapping);
      const agentOnboardFile = path.join(cursorRulesDir, 'agent-on-board.mdc');

      await fs.writeFile(agentOnboardFile, agentOnboardContent);
      console.log(
        chalk.green(
          '✅ Generated .cursor/rules/agent-on-board.mdc from template'
        )
      );

      return true;
    } catch (error) {
      console.error(
        chalk.red('❌ Error updating .cursor/rules:'),
        error.message
      );
      return false;
    }
  }

  /**
   * Generate agent-on-board.mdc template with current CLI knowledge
   */
  generateAgentOnboardTemplate(mapping) {
    const commands = Object.values(mapping.commands);

    // Get key commands by category for agent use
    const keyCommands = {
      onboarding: commands.find((c) => c.name === 'agent'),
      tasks: commands.find((c) => c.name === 'kanban'),
      validation: commands.find((c) => c.name === 'validate'),
      feedback: commands.find((c) => c.name === 'suggest'),
      priority: commands.find((c) => c.name === 'priority'),
      help: commands.find((c) => c.name === 'help')
    };

    return `# 🚀 Welcome to Supernal Development!

Really excited to work with you to continue the massive progress our team has had! 

## Your First Step - Agent Onboarding

**ALWAYS run this first before starting any work:**

\`\`\`bash
sc agent onboard
\`\`\`



## Key Commands for Daily Work

### 📋 Task Management
${
  keyCommands.tasks
    ? `
**\`${keyCommands.tasks.examples?.[0] || 'sc kanban list'}\`** - View current tasks and priorities
**\`sc kanban todo "task description"\`** - Create new task  
**\`sc kanban done <id>\`** - Mark task complete
`
    : ''
}

### 🔍 Quality & Validation
${
  keyCommands.validation
    ? `
**\`${keyCommands.validation.examples?.[0] || 'sc validate --all'}\`** - Complete project validation
**\`sc validate --requirements\`** - Check requirements only
**\`sc validate --tests\`** - Run test validation
`
    : ''
}

### 📈 Priority Management  
${
  keyCommands.priority
    ? `
**\`sc priority update\`** - Update requirement priorities
**\`sc priority show\`** - Display current priority matrix
`
    : ''
}

### 💬 Feedback & Issues
${
  keyCommands.feedback
    ? `
**\`${keyCommands.feedback.examples?.[0] || 'sc suggest "feedback"'}\`** - Quick GitHub issue creation
**\`sc suggest-bug "description"\`** - Report bugs
**\`sc suggest-feature "idea"\`** - Request features
`
    : ''
}

### 🆘 Getting Help
${
  keyCommands.help
    ? `
**\`sc help\`** - Show all available commands
**\`sc <command> --help\`** - Get detailed help for any command
`
    : ''
}

## Key Principles

- **Trust but Verify**: Hand-offs are helpful but may contain errors
- **Test Everything**: Verify all claims about working functionality  
- **Build on Success**: Leverage the good work that's been done
- **Document Findings**: Update hand-offs with your discoveries
- **Stay on Track**: Always verify you're on the right branch

## Complete CLI Reference

For comprehensive details on all **${mapping.metadata.totalCommands} available commands**, see [Supernal CLI Commands](mdc:supernal-cli-commands.mdc).

---

**This is going to be fun and useful!** You're continuing important work - make it count! 🎯

*Last updated: ${new Date(mapping.metadata.generated).toLocaleString()}*
`;
  }

  /**
   * Main execution function
   */
  async execute(options = {}) {
    try {
      const mapping = await this.generateMapping();

      if (options.save !== false) {
        await this.saveMapping(mapping);
      }

      if (options.showHelp) {
        console.log(this.generateDynamicHelp(mapping));
      }

      if (options.generateDocs) {
        const docs = this.generateReadmeDocumentation(mapping);
        console.log(chalk.cyan('\n📝 Generated Documentation:\n'));
        console.log(docs);
      }

      return mapping;
    } catch (error) {
      console.error(
        chalk.red('❌ Error generating command mapping:'),
        error.message
      );
      throw error;
    }
  }
}

// Main execution when run directly
async function main() {
  try {
    const mapper = new CommandMapper();

    // Check if files are newer than mapping
    const indexPath = path.join(mapper.cliDir, 'index.js');
    const commandsPath = mapper.commandsDir;

    let shouldRegenerate = false;

    if (!fs.existsSync(mapper.mappingFile)) {
      shouldRegenerate = true;
    } else {
      const mappingStats = fs.statSync(mapper.mappingFile);
      const indexStats = fs.statSync(indexPath);

      if (indexStats.mtime > mappingStats.mtime) {
        shouldRegenerate = true;
      } else {
        // Check if any command file is newer
        const commandFiles = fs
          .readdirSync(commandsPath)
          .filter((f) => f.endsWith('.js'))
          .map((f) => path.join(commandsPath, f));

        for (const file of commandFiles) {
          const fileStats = fs.statSync(file);
          if (fileStats.mtime > mappingStats.mtime) {
            shouldRegenerate = true;
            break;
          }
        }
      }
    }

    if (shouldRegenerate) {
      console.log(chalk.yellow('⚠️  CLI files are newer than documentation'));
      console.log(chalk.blue('🔄 Regenerating CLI documentation...'));
      const mapping = await mapper.generateMapping();

      // Update .cursor/rules with CLI knowledge
      console.log(
        chalk.blue('🔄 Updating .cursor/rules with CLI knowledge...')
      );
      await mapper.updateCursorRules(mapping);

      console.log(chalk.green('✅ CLI documentation regenerated successfully'));
    } else {
      console.log(chalk.green('✅ CLI documentation is up to date'));
    }

    process.exit(0);
  } catch (error) {
    console.error(
      chalk.red('❌ Failed to sync CLI documentation:'),
      error.message
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = CommandMapper;
