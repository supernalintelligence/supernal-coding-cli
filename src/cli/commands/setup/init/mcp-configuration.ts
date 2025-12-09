const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('node:path');

/**
 * Install MCP configuration with environment-specific setup
 * @param {string} targetDir - Target installation directory
 * @param {Object} activeFeatures - Active features configuration
 * @param {Object} options - Installation options
 */
async function installMCPConfiguration(
  targetDir,
  activeFeatures,
  options = {}
) {
  const mcpConfigPath = path.join(targetDir, '.cursor', 'mcp.json');

  // Define the base MCP configuration
  const mcpConfig = {
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

  // Add optional servers based on active features
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

  // Handle existing MCP configuration
  if (await fs.pathExists(mcpConfigPath)) {
    if (options.overwrite) {
      console.log(
        chalk.yellow('   ⚠️  Overwriting existing MCP configuration')
      );
      await fs.writeJSON(mcpConfigPath, mcpConfig, { spaces: 2 });
    } else {
      // Merge with existing configuration
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
    // Create new configuration
    await fs.ensureDir(path.dirname(mcpConfigPath));
    await fs.writeJSON(mcpConfigPath, mcpConfig, { spaces: 2 });
    console.log(chalk.blue('   ✓ Created MCP configuration'));
  }
}

module.exports = {
  installMCPConfiguration,
};
