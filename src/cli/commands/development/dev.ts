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

class DevTools {
  scriptsDir: any;
  constructor() {
    this.scriptsDir = path.join(__dirname, 'dev-scripts');
  }

  async findExcessiveLogs(options = {}) {
    const {
      maxRatio = '0.05',
      outputFile = 'logs/excessive-console-logs.txt'
    } = options;

    console.log(
      `${colors.blue}🔍 Finding files with excessive console logs...${colors.reset}`
    );
    console.log(
      `${colors.cyan}Max ratio: ${maxRatio} (${(parseFloat(maxRatio) * 100).toFixed(1)}%)${colors.reset}`
    );
    console.log(`${colors.cyan}Output file: ${outputFile}${colors.reset}`);

    const scriptPath = path.join(this.scriptsDir, 'find-excessive-logs.sh');

    if (!fs.existsSync(scriptPath)) {
      console.error(
        `${colors.red}❌ Script not found: ${scriptPath}${colors.reset}`
      );
      process.exit(1);
    }

    try {
      execSync(`bash "${scriptPath}" "${maxRatio}" "${outputFile}"`, {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      console.log(`${colors.green}✅ Log analysis completed${colors.reset}`);
      console.log(
        `${colors.cyan}Results saved to: ${outputFile}${colors.reset}`
      );
    } catch (_error) {
      console.error(`${colors.red}❌ Log analysis failed${colors.reset}`);
      process.exit(1);
    }
  }

  showHelp() {
    console.log(
      `${colors.bold}Supernal Coding Development Tools${colors.reset}`
    );
    console.log('');
    console.log(`${colors.cyan}Available commands:${colors.reset}`);
    console.log(
      '  find-logs [options]      Find files with excessive console logs'
    );
    console.log('  check-deps [options]     Check for undeclared dependencies');
    console.log(
      '  fix-declarations [opts]  Fix JavaScript case declaration issues'
    );
    console.log('');
    console.log(`${colors.cyan}Examples:${colors.reset}`);
    console.log('  sc dev find-logs --max-ratio 0.03');
    console.log('  sc dev check-deps --verbose');
    console.log('  sc dev fix-declarations --dry-run');
    console.log('  sc dev fix-declarations --file ./src/app.js');
    console.log('');
    console.log(
      `${colors.cyan}For detailed help on any command:${colors.reset}`
    );
    console.log('  sc dev <command> --help');
  }
}

// CLI function
async function runCommand(args, devTools) {
  if (args.length === 0) {
    devTools.showHelp();
    process.exit(0);
  }

  const command = args[0];
  const options = {};

  // Parse command line options
  for (let i = 1; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2).replace(/-/g, '');
      const value = args[i + 1];
      options[key] = value;
    }
  }

  switch (command) {
    case 'find-logs': {
      devTools.findExcessiveLogs(options);
      break;
    }
    case 'check-deps': {
      const checkDeps = require('./check-deps');
      const checkDepsResult = await checkDeps(args.slice(1));
      process.exit(checkDepsResult.success ? 0 : 1);
      break;
    }
    case 'fix-declarations': {
      const fixDeclarations = require('./fix-declarations');
      const fixResult = await fixDeclarations(args.slice(1));
      process.exit(fixResult.success ? 0 : 1);
      break;
    }
    case 'help':
    case '--help':
    case '-h':
      devTools.showHelp();
      break;
    default:
      console.error(
        `${colors.red}❌ Unknown command: ${command}${colors.reset}`
      );
      devTools.showHelp();
      process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const devTools = new DevTools();

  runCommand(args, devTools).catch((error) => {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = DevTools;
