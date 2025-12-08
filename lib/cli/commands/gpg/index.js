/**
 * GPG Commands - Agent key management for SC commit signing
 *
 * Part of REQ-INFRA-111: Agent Commit Signing
 *
 * Commands:
 *   sc gpg agent setup    - Generate agent GPG key
 *   sc gpg agent verify   - Verify agent key works
 *   sc gpg agent list     - List registered agents
 */

const { Command } = require('commander');
const chalk = require('chalk');
const os = require('os');
const { AgentKeyManager } = require('../../../signing');
const { SigningManager } = require('../../../signing');

function createGpgCommand() {
  const gpg = new Command('gpg')
    .description('GPG signing management for agent commits');

  // Agent subcommand group
  const agent = gpg
    .command('agent')
    .description('Manage agent GPG keys for commit signing');

  // sc gpg agent setup
  agent
    .command('setup')
    .description('Generate and register a GPG key for this agent')
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
      const verification = keyManager.verifyKeyCanSign(currentAgent.gpg_key_id);
      if (!verification.valid) {
        console.log(chalk.red(`\n❌ Key cannot sign: ${verification.error}`));
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
    .action(async (options) => {
      const keyManager = new AgentKeyManager(process.cwd());

      console.log(chalk.blue('\n📋 Registered Agents\n'));

      const agents = keyManager.listAgents();

      if (agents.length === 0) {
        console.log(chalk.gray('No agents registered.'));
        console.log(chalk.gray('Run: sc gpg agent setup\n'));
        return;
      }

      const currentHost = os.hostname();

      for (const agent of agents) {
        const isCurrent =
          agent.host === currentHost || agent.host === currentHost.split('.')[0];
        const marker = isCurrent ? chalk.green(' ← current') : '';

        console.log(chalk.white(`${agent.id}${marker}`));
        console.log(chalk.gray(`   Email:   ${agent.email}`));
        console.log(chalk.gray(`   Key:     ${agent.gpg_key_id}`));
        console.log(chalk.gray(`   Host:    ${agent.host}`));
        console.log(chalk.gray(`   Created: ${agent.created}`));
        if (agent.last_used) {
          console.log(chalk.gray(`   Used:    ${agent.last_used}`));
        }
        if (agent.commit_count > 0) {
          console.log(chalk.gray(`   Commits: ${agent.commit_count}`));
        }
        console.log();
      }
    });

  // sc gpg status - Quick status check
  gpg
    .command('status')
    .description('Show GPG signing status')
    .action(async () => {
      const keyManager = new AgentKeyManager(process.cwd());
      const signingManager = new SigningManager(process.cwd());

      console.log(chalk.blue('\n📊 GPG Signing Status\n'));

      // GPG
      const gpgCheck = keyManager.checkGpgInstalled();
      console.log(
        gpgCheck.installed
          ? chalk.green(`✓ GPG: ${gpgCheck.version}`)
          : chalk.red('✗ GPG: not installed')
      );

      // Agent
      const agent = keyManager.getCurrentHostAgent();
      console.log(
        agent
          ? chalk.green(`✓ Agent: ${agent.id} (${agent.gpg_key_id})`)
          : chalk.yellow('○ Agent: not registered')
      );

      // Config
      const config = signingManager.getSigningConfig();
      console.log(
        config.enabled
          ? chalk.green('✓ Signing: enabled')
          : chalk.yellow('○ Signing: disabled')
      );

      if (config.enabled) {
        console.log(
          config.agentCommits.sign
            ? chalk.green('✓ Agent commits: will be signed')
            : chalk.gray('○ Agent commits: unsigned')
        );
      }

      // Effective flags
      if (agent && config.enabled) {
        const flags = signingManager.getSigningFlags({ isAgentCommit: true });
        console.log(chalk.gray(`\nEffective flags: ${flags || '(default)'}`));
      }

      console.log();
    });

  return gpg;
}

module.exports = createGpgCommand();

