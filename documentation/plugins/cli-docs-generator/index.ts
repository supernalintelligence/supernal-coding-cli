import fs from 'node:fs';
import path from 'node:path';
import type { LoadContext, Plugin } from '@docusaurus/types';
import { DashboardBridge } from './dashboard-bridge';

interface CliCommand {
  command: string;
  description: string;
  usage: string;
  category: string;
  examples?: string[];
  options?: Record<string, string>;
  implementation?: string;
}

interface CommandMapping {
  metadata?: {
    generated: string;
    totalCommands: number;
    cliVersion: string;
  };
  commands: {
    [key: string]: {
      name: string;
      description: string;
      arguments?: any[];
      options?: any[];
      examples?: string[];
      implementationFile?: string;
      implementation?: any;
    };
  };
}

// Helper functions
function extractImplementationInfo(content: string): string {
  // Extract useful information from implementation files
  const _lines = content.split('\n');
  const info: string[] = [];

  // Look for description comments
  const descriptionMatch = content.match(/\/\*\*\s*(.*?)\s*\*\//s);
  if (descriptionMatch) {
    info.push(
      `**Implementation Notes**: ${descriptionMatch[1].replace(/\*/g, '').trim()}`
    );
  }

  // Look for key functions
  const functionMatches = content.match(
    /(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\s*\(/g
  );
  if (functionMatches) {
    const functions = functionMatches
      .map((match) => {
        const funcName = match.match(/(?:function\s+(\w+)|const\s+(\w+))/);
        return funcName ? funcName[1] || funcName[2] : '';
      })
      .filter(Boolean);

    if (functions.length > 0) {
      info.push(`**Key Functions**: ${functions.join(', ')}`);
    }
  }

  return info.join('\n\n');
}

async function generateCommandMarkdownFiles(
  commands: CliCommand[],
  projectRoot: string,
  dashboardData?: any
) {
  // Generate to consolidated docs directory where Docusaurus reads from
  const docsDir = path.join(projectRoot, 'docs', 'guides', 'cli-commands');

  // Ensure CLI commands directory exists
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Generate overview file
  const overviewContent = generateOverviewMarkdown(commands, dashboardData);
  fs.writeFileSync(path.join(docsDir, 'index.md'), overviewContent);

  // Generate individual command files
  for (const command of commands) {
    const commandContent = generateCommandMarkdown(command);
    const filename = `${command.command.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    fs.writeFileSync(path.join(docsDir, filename), commandContent);
  }
}

function generateOverviewMarkdown(
  commands: CliCommand[],
  _dashboardData?: any
): string {
  const _categorizedCommands = commands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, CliCommand[]>
  );

  let content = `---
id: cli-overview
title: CLI Commands Overview
sidebar_label: Overview
sidebar_position: 1
---

# Supernal Coding CLI Commands

All commands can be run with either \`sc\` or \`supernal-coding\` prefix.

## Available Commands

| Command | Description |
|---------|-------------|`;

  // Sort commands alphabetically for better organization
  const sortedCommands = commands.sort((a, b) =>
    a.command.localeCompare(b.command)
  );

  for (const command of sortedCommands) {
    content += `
| [\`${command.command}\`](./${command.command.replace(/[^a-zA-Z0-9]/g, '-')}) | ${command.description} |`;
  }

  content += `

## Quick Start

\`\`\`bash
# Get help for any command
sc <command> --help

# Common workflow commands
sc kanban list          # View current tasks
sc validate --all       # Validate project
sc suggest "feedback"   # Quick GitHub issue
\`\`\`

---

*This documentation is automatically generated from the live CLI system.*`;

  return content;
}

function generateCommandMarkdown(command: CliCommand): string {
  const commandSlug = command.command.replace(/[^a-zA-Z0-9]/g, '-');

  let content = `---
id: ${commandSlug}
title: ${command.command}
sidebar_label: ${command.command}
---

# \`${command.command}\`

${command.description}

## Usage

\`\`\`bash
${command.usage}
\`\`\`

`;

  if (command.examples && command.examples.length > 0) {
    content += `## Examples

`;
    for (const example of command.examples) {
      content += `\`\`\`bash
${example}
\`\`\`

`;
    }
  }

  if (command.implementation) {
    content += `## Implementation Details

${command.implementation}

`;
  }

  content += `## Category

**${command.category}**

---

*This documentation is automatically generated from the live CLI system.*
`;

  return content;
}

export default function cliDocsGeneratorPlugin(
  context: LoadContext,
  _options: any
): Plugin<{
  commands: CliCommand[];
  dashboardData?: any;
  projectMetrics?: any;
  hasEnhancedData: boolean;
}> {
  const { siteDir } = context;
  const projectRoot = path.resolve(siteDir, '..');

  return {
    name: 'cli-docs-generator',

    async loadContent() {
      // Load command mapping from the supernal-code-package
      const commandMappingPath = path.join(
        projectRoot,
        'supernal-code-package',
        'lib',
        'cli',
        'command-mapping.json'
      );

      if (!fs.existsSync(commandMappingPath)) {
        console.warn('Command mapping file not found:', commandMappingPath);
        return null;
      }

      const commandMapping: CommandMapping = JSON.parse(
        fs.readFileSync(commandMappingPath, 'utf8')
      );

      // Initialize dashboard bridge for enhanced data
      const dashboardBridge = new DashboardBridge(projectRoot);
      const dashboardData = await dashboardBridge.loadDashboardData();

      // Process commands and enrich with implementation details
      const commands: CliCommand[] = [];

      if (commandMapping.commands) {
        for (const [commandName, commandInfo] of Object.entries(
          commandMapping.commands
        )) {
          // Generate usage string from options
          let usage = `sc ${commandName}`;
          if (commandInfo.options && commandInfo.options.length > 0) {
            const optionFlags = commandInfo.options
              .map((opt) => opt.flags)
              .join(' ');
            usage += ` ${optionFlags}`;
          }

          const command: CliCommand = {
            command: commandName,
            description: commandInfo.description,
            usage: usage,
            category: commandInfo.implementation?.category || 'General',
            examples: commandInfo.examples || []
          };

          // Try to load implementation details if file is specified
          if (commandInfo.implementationFile) {
            const implPath = path.join(
              projectRoot,
              'supernal-code-package',
              'lib',
              'cli',
              'commands',
              commandInfo.implementationFile
            );
            if (fs.existsSync(implPath)) {
              try {
                const implContent = fs.readFileSync(implPath, 'utf8');
                command.implementation = extractImplementationInfo(implContent);
              } catch (_error) {
                console.warn(`Could not read implementation file: ${implPath}`);
              }
            }
          }

          commands.push(command);
        }
      }

      return {
        commands,
        dashboardData,
        projectMetrics: dashboardData?.projectMetrics,
        hasEnhancedData: !!dashboardData
      };
    },

    async contentLoaded({ content, actions }) {
      if (!content) return;

      const { createData, addRoute } = actions;
      const { commands, dashboardData } = content;

      // Group commands by category
      const commandsByCategory = commands.reduce(
        (acc, cmd) => {
          if (!acc[cmd.category]) {
            acc[cmd.category] = [];
          }
          acc[cmd.category].push(cmd);
          return acc;
        },
        {} as Record<string, CliCommand[]>
      );

      // Create data for the CLI docs
      const cliDataPath = await createData(
        'cli-commands.json',
        JSON.stringify(commandsByCategory, null, 2)
      );

      // Add route for CLI documentation
      addRoute({
        path: '/cli',
        component: '@site/src/components/CliDocs',
        exact: true,
        props: {
          cliDataPath
        }
      });

      // Generate markdown files for each command
      await generateCommandMarkdownFiles(commands, projectRoot, dashboardData);
    }
  };
}
