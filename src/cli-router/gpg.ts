// @ts-nocheck
/**
 * GPG Setup CLI Command
 *
 * Simplifies GPG key generation and git configuration for signed commits.
 *
 * Usage:
 *   sc gpg setup       # Interactive GPG setup
 *   sc gpg status      # Check current GPG configuration
 *   sc gpg test        # Test signing with current configuration
 */

const { Command } = require('commander');
const { execSync, spawnSync } = require('node:child_process');
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const chalk = require('chalk');

// Import agent signing modules
const { AgentKeyManager, SigningManager } = require('../signing');

const gpg = new Command('gpg').description(
  'GPG key management for signed commits'
);

// Utility to ask Y/n questions
async function askYesNo(question, defaultYes = true) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultStr = defaultYes ? '[Y/n]' : '[y/N]';

  return new Promise((resolve) => {
    rl.question(`${question} ${defaultStr}: `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (normalized === '') {
        resolve(defaultYes);
      } else {
        resolve(normalized === 'y' || normalized === 'yes');
      }
    });
  });
}

// Detect OS and package manager
function detectSystem() {
  const platform = os.platform();

  if (platform === 'darwin') {
    // macOS - check for brew
    try {
      execSync('which brew', { stdio: 'pipe' });
      return {
        platform: 'macos',
        packageManager: 'brew',
        installCmd: 'brew install gnupg',
      };
    } catch (_e) {
      return { platform: 'macos', packageManager: null, installCmd: null };
    }
  } else if (platform === 'linux') {
    // Check for apt or yum
    try {
      execSync('which apt-get', { stdio: 'pipe' });
      return {
        platform: 'linux',
        packageManager: 'apt',
        installCmd: 'sudo apt-get install -y gnupg',
      };
    } catch (_e) {
      try {
        execSync('which yum', { stdio: 'pipe' });
        return {
          platform: 'linux',
          packageManager: 'yum',
          installCmd: 'sudo yum install -y gnupg',
        };
      } catch (_e2) {
        return { platform: 'linux', packageManager: null, installCmd: null };
      }
    }
  }

  return { platform, packageManager: null, installCmd: null };
}

// Check if GPG is installed
function isGpgInstalled() {
  try {
    execSync('gpg --version', { stdio: 'pipe' });
    return true;
  } catch (_e) {
    return false;
  }
}

// Install GPG
async function installGpg(system) {
  if (!system.installCmd) {
    console.log('');
    console.log('❌ Cannot auto-install GPG on this system.');
    console.log('');
    console.log('Please install manually:');
    if (system.platform === 'macos') {
      console.log(
        '  1. Install Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      );
      console.log('  2. Install GPG: brew install gnupg');
    } else {
      console.log(
        '  Linux: sudo apt-get install gnupg  OR  sudo yum install gnupg'
      );
      console.log('  Windows: Install Gpg4win from https://gpg4win.org');
    }
    return false;
  }

  console.log(`  Installing GPG via ${system.packageManager}...`);
  console.log(`  Running: ${system.installCmd}`);

  try {
    execSync(system.installCmd, { stdio: 'inherit' });
    console.log('  ✅ GPG installed successfully');
    return true;
  } catch (_e) {
    console.log('  ❌ Installation failed');
    return false;
  }
}

// Get shell profile path
function getShellProfilePath() {
  const shell = process.env.SHELL || '/bin/bash';
  const home = os.homedir();

  if (shell.includes('zsh')) {
    return path.join(home, '.zshrc');
  } else if (shell.includes('bash')) {
    // Check for .bashrc first, then .bash_profile
    const bashrc = path.join(home, '.bashrc');
    if (fs.existsSync(bashrc)) {
      return bashrc;
    }
    return path.join(home, '.bash_profile');
  }

  return path.join(home, '.profile');
}

// Check if GPG_TTY is already configured
function isGpgTtyConfigured() {
  const profilePath = getShellProfilePath();

  if (fs.existsSync(profilePath)) {
    const content = fs.readFileSync(profilePath, 'utf8');
    return content.includes('GPG_TTY');
  }

  return false;
}

// Add GPG_TTY to shell profile
function addGpgTtyToProfile() {
  const profilePath = getShellProfilePath();
  const exportLine = '\n# GPG TTY for signed commits\nexport GPG_TTY=$(tty)\n';

  try {
    fs.appendFileSync(profilePath, exportLine);
    return true;
  } catch (_e) {
    return false;
  }
}

// Check if GitHub CLI is available
function isGhCliInstalled() {
  try {
    execSync('which gh', { stdio: 'pipe' });
    return true;
  } catch (_e) {
    return false;
  }
}

// Copy to clipboard (cross-platform)
function copyToClipboard(text) {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      execSync('pbcopy', { input: text, stdio: ['pipe', 'pipe', 'pipe'] });
      return true;
    } else if (platform === 'linux') {
      // Try xclip first, then xsel
      try {
        execSync('xclip -selection clipboard', {
          input: text,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
      } catch (_e) {
        execSync('xsel --clipboard', {
          input: text,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
      }
    }
  } catch (_e) {
    return false;
  }

  return false;
}

// ============================================================================
// sc gpg setup
// ============================================================================
gpg
  .command('setup')
  .description('Interactive GPG setup for signed commits')
  .option('--non-interactive', 'Use defaults without prompts')
  .option('--name <name>', 'Full name for GPG key')
  .option('--email <email>', 'Email for GPG key')
  .option('--skip-github', 'Skip GitHub key upload step')
  .action(async (options) => {
    console.log('');
    console.log('🔐 GPG Signed Commits Setup');
    console.log('===========================');
    console.log('');

    const system = detectSystem();

    // Step 1: Check/Install GPG
    console.log('Step 1: Checking GPG installation...');

    if (!isGpgInstalled()) {
      console.log('  ⚠️  GPG not found');

      if (options.nonInteractive) {
        console.log('  ❌ GPG required. Install manually and retry.');
        process.exit(1);
      }

      const shouldInstall = await askYesNo(
        '  Would you like to install GPG now?',
        true
      );

      if (shouldInstall) {
        const success = await installGpg(system);
        if (!success) {
          process.exit(1);
        }
      } else {
        console.log('');
        console.log('⚠️  GPG is required for signed commits.');
        console.log('   Run "sc gpg setup" again after installing GPG.');
        process.exit(1);
      }
    } else {
      console.log('  ✅ GPG is installed');
    }

    // Step 2: Check for existing keys
    console.log('');
    console.log('Step 2: Checking for existing GPG keys...');
    let existingKeys = [];
    try {
      const keysOutput = execSync(
        'gpg --list-secret-keys --keyid-format LONG 2>/dev/null',
        {
          encoding: 'utf8',
        }
      );
      const keyMatches = keysOutput.match(/sec\s+\w+\/([A-F0-9]+)/g);
      if (keyMatches) {
        existingKeys = keyMatches.map((m) => m.split('/')[1]);
        console.log(`  Found ${existingKeys.length} existing key(s)`);
      }
    } catch (_e) {
      console.log('  No existing keys found');
    }

    // Step 3: Get user info
    let name = options.name;
    let email = options.email;

    if (!name) {
      try {
        name = execSync('git config user.name', { encoding: 'utf8' }).trim();
      } catch (_e) {
        name = '';
      }
    }

    if (!email) {
      try {
        email = execSync('git config user.email', { encoding: 'utf8' }).trim();
      } catch (_e) {
        email = '';
      }
    }

    if (!options.nonInteractive && (!name || !email)) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (prompt) =>
        new Promise((resolve) => rl.question(prompt, resolve));

      if (!name) {
        name = await question('Enter your full name: ');
      }
      if (!email) {
        email = await question('Enter your email address: ');
      }
      rl.close();
    }

    console.log('');
    console.log(`  Name: ${name}`);
    console.log(`  Email: ${email}`);

    // Step 4: Generate or select key
    let keyId;
    if (existingKeys.length > 0) {
      console.log('');
      console.log('Step 3: Using existing GPG key...');
      keyId = existingKeys[0];
      console.log(`  Using key: ${keyId}`);
    } else {
      console.log('');
      console.log('Step 3: Generating new GPG key...');
      console.log('  This may take a moment...');
      console.log('');

      // Generate key using batch mode
      const keyParams = `
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: ${name}
Name-Email: ${email}
Expire-Date: 0
%no-protection
%commit
`;

      try {
        execSync(`echo "${keyParams}" | gpg --batch --generate-key`, {
          stdio: 'pipe',
        });

        // Get the new key ID
        const newKeysOutput = execSync(
          'gpg --list-secret-keys --keyid-format LONG',
          { encoding: 'utf8' }
        );
        const newKeyMatch = newKeysOutput.match(/sec\s+\w+\/([A-F0-9]+)/);
        if (newKeyMatch) {
          keyId = newKeyMatch[1];
          console.log(`  ✅ Generated new key: ${keyId}`);
        }
      } catch (_e) {
        console.log('  ❌ Failed to generate key');
        console.log('');
        console.log('Try generating manually:');
        console.log('  gpg --full-generate-key');
        process.exit(1);
      }
    }

    // Step 5: Configure git
    console.log('');
    console.log('Step 4: Configuring git...');
    try {
      execSync(`git config --global user.signingkey ${keyId}`);
      execSync('git config --global commit.gpgsign true');
      console.log('  ✅ Git configured for signed commits');
    } catch (_e) {
      console.log('  ❌ Failed to configure git');
      console.log(
        `  Run manually: git config --global user.signingkey ${keyId}`
      );
    }

    // Step 6: Configure GPG_TTY (automated)
    console.log('');
    console.log('Step 5: Configuring GPG_TTY...');

    if (isGpgTtyConfigured()) {
      console.log('  ✅ GPG_TTY already configured in shell profile');
    } else {
      const profilePath = getShellProfilePath();

      if (options.nonInteractive) {
        if (addGpgTtyToProfile()) {
          console.log(`  ✅ Added GPG_TTY to ${profilePath}`);
        }
      } else {
        const shouldAdd = await askYesNo(
          `  Add GPG_TTY to ${profilePath}?`,
          true
        );

        if (shouldAdd) {
          if (addGpgTtyToProfile()) {
            console.log(`  ✅ Added GPG_TTY to ${profilePath}`);
            console.log(
              '  ⚠️  Run "source ' +
                profilePath +
                '" or restart terminal to apply'
            );
          } else {
            console.log('  ❌ Failed to update profile');
            console.log(
              `  Add manually: echo 'export GPG_TTY=$(tty)' >> ${profilePath}`
            );
          }
        } else {
          console.log('');
          console.log(
            '  ⚠️  WARNING: Without GPG_TTY, signing may fail in some terminals.'
          );
          console.log(
            `  Add manually later: echo 'export GPG_TTY=$(tty)' >> ${profilePath}`
          );
        }
      }
    }

    // Also set it for current session
    process.env.GPG_TTY =
      process.env.TTY ||
      execSync('tty 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();

    // Step 7: Export and handle public key for GitHub
    if (!options.skipGithub) {
      console.log('');
      console.log('Step 6: GitHub/GitLab key configuration...');

      let publicKey;
      try {
        publicKey = execSync(`gpg --armor --export ${keyId}`, {
          encoding: 'utf8',
        });
      } catch (_e) {
        console.log('  ❌ Failed to export public key');
        publicKey = null;
      }

      if (publicKey) {
        // Try to copy to clipboard
        const copied = copyToClipboard(publicKey);

        if (copied) {
          console.log('  ✅ Public key copied to clipboard!');
        }

        // Check if GitHub CLI is available
        if (isGhCliInstalled()) {
          if (options.nonInteractive) {
            console.log('  ℹ️  GitHub CLI available. Run: gh gpg-key add');
          } else {
            const shouldUpload = await askYesNo(
              '  Upload key to GitHub using gh CLI?',
              true
            );

            if (shouldUpload) {
              try {
                execSync(`echo "${publicKey}" | gh gpg-key add -`, {
                  stdio: 'inherit',
                });
                console.log('  ✅ Key uploaded to GitHub');
              } catch (_e) {
                console.log(
                  '  ❌ Failed to upload. You may need to run: gh auth login'
                );
                console.log('');
                console.log('  Manual upload:');
                console.log(
                  '    1. Go to: https://github.com/settings/gpg/new'
                );
                console.log(
                  '    2. Paste your key (already copied to clipboard)'
                );
              }
            }
          }
        } else {
          console.log('');
          console.log('  To add your key to GitHub:');
          console.log('    1. Go to: https://github.com/settings/gpg/new');
          if (copied) {
            console.log('    2. Paste your key (already copied to clipboard)');
          } else {
            console.log(`    2. Run: gpg --armor --export ${keyId} | pbcopy`);
            console.log('    3. Paste the key');
          }

          if (!options.nonInteractive) {
            const openBrowser = await askYesNo(
              '  Open GitHub GPG settings in browser?',
              false
            );
            if (openBrowser) {
              try {
                const openCmd =
                  os.platform() === 'darwin' ? 'open' : 'xdg-open';
                execSync(`${openCmd} https://github.com/settings/gpg/new`);
              } catch (_e) {
                console.log(
                  '  Could not open browser. Please navigate manually.'
                );
              }
            }
          }
        }
      }
    }

    // Step 8: Final test
    console.log('');
    console.log('Step 7: Testing configuration...');

    try {
      // Simple test - sign a message
      execSync('echo "test" | gpg --clearsign > /dev/null 2>&1', {
        encoding: 'utf8',
      });
      console.log('  ✅ GPG signing works!');
    } catch (_e) {
      console.log(
        '  ⚠️  Test signing failed (may work after terminal restart)'
      );
    }

    console.log('');
    console.log('✅ GPG setup complete!');
    console.log('');
    console.log('Your commits will now be signed automatically.');
    console.log('');

    if (!isGpgTtyConfigured()) {
      console.log('⚠️  Remember to restart your terminal or run:');
      console.log(`   source ${getShellProfilePath()}`);
      console.log('');
    }
  });

// ============================================================================
// sc gpg status
// ============================================================================
gpg
  .command('status')
  .description('Check GPG configuration status')
  .action(() => {
    console.log('');
    console.log('🔐 GPG Configuration Status');
    console.log('============================');
    console.log('');

    // Check GPG installation
    let gpgVersion = 'Not installed';
    try {
      const version = execSync('gpg --version', { encoding: 'utf8' });
      const match = version.match(/gpg \(GnuPG\) (\d+\.\d+\.\d+)/);
      gpgVersion = match ? match[1] : 'Installed';
    } catch (_e) {
      gpgVersion = '❌ Not installed';
    }
    console.log(`GPG Version:     ${gpgVersion}`);

    // Check git signing key
    let signingKey = 'Not configured';
    try {
      signingKey = execSync('git config --get user.signingkey', {
        encoding: 'utf8',
      }).trim();
    } catch (_e) {
      signingKey = '❌ Not configured';
    }
    console.log(`Signing Key:     ${signingKey}`);

    // Check auto-sign
    let autoSign = 'false';
    try {
      autoSign = execSync('git config --get commit.gpgsign', {
        encoding: 'utf8',
      }).trim();
    } catch (_e) {
      autoSign = 'false';
    }
    console.log(
      `Auto-sign:       ${autoSign === 'true' ? '✅ Enabled' : '❌ Disabled'}`
    );

    // Check GPG_TTY (current session)
    const gpgTty = process.env.GPG_TTY || '❌ Not set (current session)';
    console.log(`GPG_TTY:         ${gpgTty}`);

    // Check GPG_TTY in profile
    const profileConfigured = isGpgTtyConfigured();
    console.log(
      `GPG_TTY Profile: ${profileConfigured ? '✅ Configured' : '❌ Not in shell profile'}`
    );

    // List keys
    console.log('');
    console.log('Available Keys:');
    try {
      const keys = execSync(
        'gpg --list-secret-keys --keyid-format LONG 2>/dev/null',
        {
          encoding: 'utf8',
        }
      );
      console.log(keys || '  No keys found');
    } catch (_e) {
      console.log('  No keys found');
    }

    console.log('');

    // Recommendations
    if (!isGpgInstalled()) {
      console.log('⚠️  Run: sc gpg setup');
    } else if (signingKey === '❌ Not configured') {
      console.log('⚠️  Run: sc gpg setup');
    } else if (!profileConfigured) {
      console.log('⚠️  Add GPG_TTY to shell profile:');
      console.log(
        `   echo 'export GPG_TTY=$(tty)' >> ${getShellProfilePath()}`
      );
    }
  });

// ============================================================================
// sc gpg test
// ============================================================================
gpg
  .command('test')
  .description('Test GPG signing configuration')
  .action(() => {
    console.log('');
    console.log('🔐 Testing GPG Signing');
    console.log('======================');
    console.log('');

    // Ensure GPG_TTY is set for this test
    if (!process.env.GPG_TTY) {
      try {
        process.env.GPG_TTY = execSync('tty 2>/dev/null', {
          encoding: 'utf8',
        }).trim();
      } catch (_e) {
        // Ignore
      }
    }

    try {
      // Try to sign a test message
      const signingKey = execSync('git config --get user.signingkey', {
        encoding: 'utf8',
      }).trim();

      console.log(`Using key: ${signingKey}`);
      console.log('');

      execSync('echo "test" | gpg --clearsign', { stdio: 'inherit' });

      console.log('');
      console.log('✅ GPG signing works correctly!');
      console.log('');
      console.log('Your commits will now be signed automatically.');
    } catch (_e) {
      console.log('❌ GPG signing failed');
      console.log('');
      console.log('Troubleshooting:');
      console.log('  1. Ensure GPG_TTY is set: export GPG_TTY=$(tty)');
      console.log(
        '  2. Check your signing key: git config --get user.signingkey'
      );
      console.log('  3. List available keys: gpg --list-secret-keys');
      console.log('  4. Restart your terminal and try again');
      console.log('');
    }
  });

// ============================================================================
// sc gpg agent - AI Agent Key Management
// ============================================================================

const agent = gpg
  .command('agent')
  .description('Manage agent GPG keys for SC commit signing');

// sc gpg agent setup
agent
  .command('setup')
  .description('Generate and register a GPG key for this AI agent')
  .option('--agent-id <id>', 'Specify agent ID (default: auto-generated)')
  .option('--force', 'Force regeneration even if key exists')
  .option('--non-interactive', 'Run without prompts (for scripts/CI)')
  .action(async (options) => {
    const keyManager = new AgentKeyManager(process.cwd());

    console.log(chalk.blue('\n🔑 Agent GPG Key Setup\n'));

    // Check GPG installation
    console.log(chalk.gray('Checking GPG installation...'));
    const gpgCheck = keyManager.checkGpgInstalled();

    if (!gpgCheck.installed) {
      console.log(chalk.red('\n❌ GPG not found\n'));
      console.log(gpgCheck.error);
      process.exit(1);
    }

    console.log(chalk.green(`✓ GPG ${gpgCheck.version} installed\n`));

    // Check for existing agent
    const existingAgent = keyManager.getCurrentHostAgent();
    if (existingAgent && !options.force) {
      console.log(chalk.yellow('⚠️  Agent key already exists for this host:\n'));
      console.log(chalk.gray(`   ID:    ${existingAgent.id}`));
      console.log(chalk.gray(`   Email: ${existingAgent.email}`));
      console.log(chalk.gray(`   Key:   ${existingAgent.gpg_key_id}`));
      console.log(chalk.gray(`   Host:  ${existingAgent.host}`));
      console.log();

      // Verify it still works
      const verification = keyManager.verifyKeyCanSign(existingAgent.gpg_key_id);
      if (verification.valid) {
        console.log(chalk.green('✓ Existing key verified - ready to use'));
        console.log(chalk.gray('\n   Use --force to regenerate\n'));
        return;
      }

      console.log(chalk.red('✗ Existing key cannot sign - regenerating...\n'));
    }

    // Generate new key
    console.log(chalk.gray('Generating agent GPG key...'));
    console.log(chalk.gray('(This may take a moment for entropy collection)\n'));

    const result = await keyManager.generateAgentKey({
      agentId: options.agentId,
      force: options.force,
    });

    if (!result.success) {
      console.log(chalk.red(`\n❌ ${result.error}\n`));
      process.exit(1);
    }

    if (result.existing) {
      console.log(chalk.yellow('Using existing key:\n'));
    } else {
      console.log(chalk.green('✓ Key generated successfully:\n'));
    }

    console.log(chalk.white(`   Agent ID: ${result.agentId}`));
    console.log(chalk.white(`   Email:    ${result.email}`));
    console.log(chalk.white(`   Key ID:   ${result.gpgKeyId}`));
    console.log(chalk.white(`   Host:     ${result.host}`));
    console.log();

    // Verify the key can sign
    console.log(chalk.gray('Verifying key can sign...'));
    const verification = keyManager.verifyKeyCanSign(result.gpgKeyId);

    if (!verification.valid) {
      console.log(chalk.red(`\n❌ ${verification.error}`));
      console.log(chalk.yellow('Key generated but cannot sign. Check GPG configuration.\n'));
      process.exit(1);
    }

    console.log(chalk.green('✓ Key verified - can sign commits\n'));

    // Register in project
    console.log(chalk.gray('Registering agent in project...'));
    const registration = keyManager.registerAgent(result);

    if (!registration.success) {
      console.log(chalk.red(`\n❌ ${registration.error}`));
      console.log(chalk.yellow('Key generated but not registered. Register manually.\n'));
      process.exit(1);
    }

    console.log(chalk.green(`✓ Agent registered in ${registration.registryPath}\n`));

    // Show next steps
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray('  1. Enable signing in supernal.yaml:'));
    console.log(chalk.white(`
     git:
       signing:
         enabled: true
         agent_commits:
           sign: true
           key_source: registry
`));
    console.log(chalk.gray('  2. SC commits will now be signed with this agent key'));
    console.log(chalk.gray('  3. Verify with: sc gpg agent verify\n'));
  });

// sc gpg agent verify
agent
  .command('verify')
  .description('Verify agent key is working')
  .action(async () => {
    const keyManager = new AgentKeyManager(process.cwd());
    const signingManager = new SigningManager(process.cwd());

    console.log(chalk.blue('\n🔍 Agent Key Verification\n'));

    // Check GPG
    const gpgCheck = keyManager.checkGpgInstalled();
    if (!gpgCheck.installed) {
      console.log(chalk.red('❌ GPG not installed'));
      process.exit(1);
    }
    console.log(chalk.green(`✓ GPG ${gpgCheck.version} installed`));

    // Check agent registration
    const currentAgent = keyManager.getCurrentHostAgent();
    if (!currentAgent) {
      console.log(chalk.red('\n❌ No agent registered for this host'));
      console.log(chalk.gray('   Run: sc gpg agent setup\n'));
      process.exit(1);
    }

    console.log(chalk.green(`✓ Agent registered: ${currentAgent.id}`));
    console.log(chalk.gray(`   Email: ${currentAgent.email}`));
    console.log(chalk.gray(`   Key:   ${currentAgent.gpg_key_id}`));

    // Verify key exists in keyring
    const keyInKeyring = keyManager.findKeyByEmail(currentAgent.email);
    if (!keyInKeyring) {
      console.log(chalk.red('\n❌ Key not found in GPG keyring'));
      console.log(chalk.gray('   The key may have been deleted. Run: sc gpg agent setup --force\n'));
      process.exit(1);
    }
    console.log(chalk.green('✓ Key found in GPG keyring'));

    // Verify key can sign
    const verifyResult = keyManager.verifyKeyCanSign(currentAgent.gpg_key_id);
    if (!verifyResult.valid) {
      console.log(chalk.red(`\n❌ Key cannot sign: ${verifyResult.error}`));
      process.exit(1);
    }
    console.log(chalk.green('✓ Key can sign'));

    // Check signing config
    const signingConfig = signingManager.getSigningConfig();
    if (signingConfig.enabled) {
      console.log(chalk.green('✓ Signing enabled in config'));
      if (signingConfig.agentCommits.sign) {
        console.log(chalk.green('✓ Agent commit signing enabled'));
      } else {
        console.log(chalk.yellow('⚠️  Agent commit signing disabled'));
      }
    } else {
      console.log(chalk.yellow('⚠️  Signing not enabled in supernal.yaml'));
      console.log(chalk.gray('   Add git.signing.enabled: true to enable'));
    }

    // Show signing flags that would be used
    const flags = signingManager.getSigningFlags({ isAgentCommit: true });
    console.log(chalk.gray(`\n   Signing flags: ${flags || '(none - using git config)'}`));

    console.log(chalk.green('\n✅ Agent key verification complete\n'));
  });

// sc gpg agent list
agent
  .command('list')
  .description('List all registered agents')
  .option('--all', 'Show agents from all hosts')
  .action(async () => {
    const keyManager = new AgentKeyManager(process.cwd());

    console.log(chalk.blue('\n📋 Registered Agents\n'));

    const agents = keyManager.listAgents();

    if (agents.length === 0) {
      console.log(chalk.gray('No agents registered.'));
      console.log(chalk.gray('Run: sc gpg agent setup\n'));
      return;
    }

    const currentHost = os.hostname();

    for (const agentInfo of agents) {
      const isCurrent =
        agentInfo.host === currentHost || agentInfo.host === currentHost.split('.')[0];
      const marker = isCurrent ? chalk.green(' ← current') : '';

      console.log(chalk.white(`${agentInfo.id}${marker}`));
      console.log(chalk.gray(`   Email:   ${agentInfo.email}`));
      console.log(chalk.gray(`   Key:     ${agentInfo.gpg_key_id}`));
      console.log(chalk.gray(`   Host:    ${agentInfo.host}`));
      console.log(chalk.gray(`   Created: ${agentInfo.created}`));
      if (agentInfo.last_used) {
        console.log(chalk.gray(`   Used:    ${agentInfo.last_used}`));
      }
      if (agentInfo.commit_count > 0) {
        console.log(chalk.gray(`   Commits: ${agentInfo.commit_count}`));
      }
      console.log();
    }
  });

module.exports = gpg;
