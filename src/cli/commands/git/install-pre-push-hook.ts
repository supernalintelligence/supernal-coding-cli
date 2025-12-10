/**
 * install-pre-push-hook.ts - Install Git pre-push hooks
 * Part of REQ-050: Pre-Push Testing and Validation System
 */

import fs from 'fs-extra';
import path from 'node:path';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

interface HookOptions {
  projectRoot?: string;
  verbose?: boolean;
}

interface HookStatus {
  installed: boolean;
  path: string;
  executable: boolean;
  lastModified: Date | null;
}

async function installPrePushHook(options: HookOptions = {}): Promise<string> {
  const { projectRoot = process.cwd(), verbose = false } = options;

  if (verbose) {
    console.log(
      `${colors.blue}🔧 Installing pre-push Git hook...${colors.reset}`
    );
  }

  const gitHooksDir = path.join(projectRoot, '.git', 'hooks');
  if (!(await fs.pathExists(gitHooksDir))) {
    throw new Error(
      'Not in a Git repository or .git/hooks directory not found'
    );
  }

  const sourceHookPath = path.join(__dirname, 'hooks', 'pre-push.sh');
  const hookPath = path.join(gitHooksDir, 'pre-push');

  try {
    await fs.access(sourceHookPath);
  } catch (_error) {
    throw new Error(`Pre-push hook source file not found: ${sourceHookPath}`);
  }

  await fs.copyFile(sourceHookPath, hookPath);

  await fs.chmod(hookPath, '755');

  if (verbose) {
    console.log(
      `${colors.green}✅ Pre-push hook installed successfully!${colors.reset}`
    );
    console.log('');
    console.log(`${colors.bold}🛡️  The pre-push hook will:${colors.reset}`);
    console.log('   • Run the full test suite before any push');
    console.log('   • Block pushes if tests fail');
    console.log('   • Check for type duplications (warning only)');
    console.log('   • Validate build if build script exists');
    console.log('');
    console.log(`${colors.yellow}🚨 To bypass in emergencies:${colors.reset}`);
    console.log('   git push --no-verify');
    console.log('   OR');
    console.log('   SC_SKIP_PRE_PUSH=true git push');
    console.log('');
  }

  return hookPath;
}

async function uninstallPrePushHook(options: HookOptions = {}): Promise<boolean> {
  const { projectRoot = process.cwd(), verbose = false } = options;

  const hookPath = path.join(projectRoot, '.git', 'hooks', 'pre-push');

  if (await fs.pathExists(hookPath)) {
    await fs.remove(hookPath);
    if (verbose) {
      console.log(`${colors.green}✅ Pre-push hook removed${colors.reset}`);
    }
    return true;
  } else {
    if (verbose) {
      console.log(`${colors.yellow}⚠️  No pre-push hook found${colors.reset}`);
    }
    return false;
  }
}

async function checkPrePushHookStatus(options: HookOptions = {}): Promise<HookStatus> {
  const { projectRoot = process.cwd() } = options;

  const hookPath = path.join(projectRoot, '.git', 'hooks', 'pre-push');
  const exists = await fs.pathExists(hookPath);

  if (exists) {
    const stats = await fs.stat(hookPath);
    const isExecutable = (stats.mode & 0o755) === 0o755;

    return {
      installed: true,
      path: hookPath,
      executable: isExecutable,
      lastModified: stats.mtime
    };
  } else {
    return {
      installed: false,
      path: hookPath,
      executable: false,
      lastModified: null
    };
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const verbose =
    process.argv.includes('--verbose') || process.argv.includes('-v');

  try {
    switch (command) {
      case 'install':
        await installPrePushHook({ verbose });
        break;

      case 'uninstall':
        await uninstallPrePushHook({ verbose });
        break;

      case 'status': {
        const status = await checkPrePushHookStatus();
        console.log(`${colors.blue}Pre-push hook status:${colors.reset}`);
        console.log(
          `  Installed: ${status.installed ? `${colors.green}✅ Yes` : `${colors.red}❌ No`}${colors.reset}`
        );
        if (status.installed) {
          console.log(
            `  Executable: ${status.executable ? `${colors.green}✅ Yes` : `${colors.red}❌ No`}${colors.reset}`
          );
          console.log(`  Path: ${colors.gray}${status.path}${colors.reset}`);
          console.log(
            `  Last Modified: ${colors.gray}${status.lastModified}${colors.reset}`
          );
        }
        break;
      }

      default:
        console.log(`${colors.blue}Pre-push Git Hook Manager${colors.reset}`);
        console.log('');
        console.log('Usage:');
        console.log(
          '  node install-pre-push-hook.js install   # Install the pre-push hook'
        );
        console.log(
          '  node install-pre-push-hook.js uninstall # Remove the pre-push hook'
        );
        console.log(
          '  node install-pre-push-hook.js status    # Check hook status'
        );
        console.log('');
        console.log('Options:');
        console.log(
          '  --verbose, -v                           # Verbose output'
        );
        break;
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error: ${(error as Error).message}${colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  installPrePushHook,
  uninstallPrePushHook,
  checkPrePushHookStatus
};

module.exports = {
  installPrePushHook,
  uninstallPrePushHook,
  checkPrePushHookStatus
};
