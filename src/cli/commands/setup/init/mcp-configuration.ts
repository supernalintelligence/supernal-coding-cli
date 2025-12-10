import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'node:path';

interface ActiveFeatures {
  testingFramework?: boolean;
  [key: string]: unknown;
}

interface MCPOptions {
  overwrite?: boolean;
}

interface MCPServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
  env: Record<string, string>;
  projectSpecific: Record<string, unknown>;
}

/**
 * Install MCP configuration with environment-specific setup
 */
export async function installMCPConfiguration(
  targetDir: string,
  activeFeatures: ActiveFeatures,
  options: MCPOptions = {}
): Promise<void> {
  const mcpConfigPath = path.join(targetDir, '.cursor', 'mcp.json');

  const mcpConfig: MCPConfig = {
    mcpServers: {
      'supernal-coding': {
        command: 'node',
        args: ['supernal-code-package/lib/cli/index.js', 'mcp'],
        env: {
          NODE_ENV: 'development',
        },
      },
    },
    env: {
      NODE_ENV: 'development',
    },
    projectSpecific: {},
  };

  if (activeFeatures.testingFramework) {
    mcpConfig.mcpServers.playwright = {
      command: 'npx',
      args: ['playwright', 'test', '--reporter=json'],
      env: {
        NODE_ENV: 'test',
        PLAYWRIGHT_BROWSERS_PATH: '0',
      },
    };

    mcpConfig.mcpServers['testing-tools'] = {
      command: 'node',
      args: ['scripts/testing-mcp-server.js'],
      env: {
        NODE_ENV: 'test',
        TEST_ENV: 'test',
      },
    };

    mcpConfig.mcpServers['test-runner'] = {
      command: 'node',
      args: ['tests/e2e/lib/test-runner.js', '--mcp'],
      env: {
        NODE_ENV: 'test',
        TEST_ENV: 'test',
      },
    };
  }

  if (await fs.pathExists(mcpConfigPath)) {
    if (options.overwrite) {
      console.log(
        chalk.yellow('   ⚠️  Overwriting existing MCP configuration')
      );
      await fs.writeJSON(mcpConfigPath, mcpConfig, { spaces: 2 });
    } else {
      const existingConfig = await fs.readJSON(mcpConfigPath);
      const mergedConfig = {
        ...existingConfig,
        mcpServers: {
          ...existingConfig.mcpServers,
          ...mcpConfig.mcpServers,
        },
        env: {
          ...existingConfig.env,
          ...mcpConfig.env,
        },
      };
      await fs.writeJSON(mcpConfigPath, mergedConfig, { spaces: 2 });
      console.log(chalk.blue('   ✓ Merged MCP configuration'));
    }
  } else {
    await fs.ensureDir(path.dirname(mcpConfigPath));
    await fs.writeJSON(mcpConfigPath, mcpConfig, { spaces: 2 });
    console.log(chalk.blue('   ✓ Created MCP configuration'));
  }
}

module.exports = {
  installMCPConfiguration,
};
