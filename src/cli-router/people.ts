// @ts-nocheck
/**
 * People Management CLI
 *
 * Manage team contributors, roles, GPG keys, and approval permissions.
 *
 * Usage:
 *   sc people list                # List all contributors
 *   sc people add <email>         # Add new contributor
 *   sc people me                  # Register yourself
 *   sc people remove <id>         # Remove a contributor
 *   sc people gpg-status          # Check GPG status
 *   sc people verify <id>         # Verify GitHub key
 *   sc people set-role <id> <role> # Update role
 */

const { Command } = require('commander');
const { PeopleManager } = require('../people/PeopleManager');
const readline = require('node:readline');

const people = new Command('people').description(
  'Manage team contributors and approval permissions'
);

// Utility for interactive prompts
async function prompt(question, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const defaultStr = defaultValue ? ` [${defaultValue}]` : '';

  return new Promise((resolve) => {
    rl.question(`${question}${defaultStr}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// ============================================================================
// sc people list
// ============================================================================
people
  .command('list')
  .description('List all contributors with roles and GPG status')
  .option('--json', 'Output as JSON')
  .option('--role <role>', 'Filter by role')
  .option('--active-only', 'Show only active contributors')
  .action((options) => {
    const manager = new PeopleManager();
    let contributors = manager.list();

    // Apply filters
    if (options.role) {
      contributors = contributors.filter((c) => c.role === options.role);
    }
    if (options.activeOnly) {
      contributors = contributors.filter((c) => c.active);
    }

    if (options.json) {
      console.log(
        JSON.stringify({ contributors, summary: manager.getSummary() }, null, 2)
      );
      return;
    }

    if (contributors.length === 0) {
      console.log('\nNo contributors found in .supernal/people.yaml');
      console.log(
        'Run "sc people me" to register yourself or "sc people add" to add contributors.\n'
      );
      return;
    }

    console.log('\n📋 Team Contributors\n');
    console.log('─'.repeat(80));

    contributors.forEach((c) => {
      const gpgIcon =
        {
          verified: '✅',
          unverified: '⚠️',
          missing: '❌'
        }[c.gpgStatus] || '❓';

      const roleIcon =
        {
          owner: '👑',
          admin: '🛡️',
          approver: '✓',
          contributor: '👤'
        }[c.role] || '•';

      const status = c.active ? '' : ' (inactive)';

      console.log(`${roleIcon} ${c.name}${status}`);
      console.log(`   Email: ${c.email}`);
      if (c.github) console.log(`   GitHub: ${c.github}`);
      console.log(`   Role: ${c.role}`);
      console.log(`   GPG: ${gpgIcon} ${c.gpgKeyId || 'Not configured'}`);
      if (c.canApprove && c.canApprove.length > 0) {
        console.log(`   Can Approve: ${c.canApprove.join(', ')}`);
      }
      console.log('');
    });

    const summary = manager.getSummary();
    console.log('─'.repeat(80));
    console.log(
      `Total: ${summary.total} | Active: ${summary.active} | GPG Configured: ${summary.gpgConfigured}/${summary.total}`
    );
    console.log('');
  });

// ============================================================================
// sc people add <email>
// ============================================================================
people
  .command('add [email]')
  .description('Add a new contributor (interactive)')
  .option('--name <name>', 'Full name')
  .option(
    '--role <role>',
    'Role: owner, admin, approver, contributor',
    'contributor'
  )
  .option('--gpg-key <keyId>', 'GPG Key ID')
  .option('--github <username>', 'GitHub username')
  .option('--non-interactive', 'Use provided options without prompts')
  .action(async (emailArg, options) => {
    const manager = new PeopleManager();

    let email = emailArg;
    let name = options.name;
    let role = options.role;
    let gpgKeyId = options.gpgKey;
    let github = options.github;

    if (!options.nonInteractive) {
      console.log('\n📝 Add New Contributor\n');

      if (!email) {
        email = await prompt('Email address');
      }
      if (!email) {
        console.log('Email is required.');
        process.exit(1);
      }

      if (!name) {
        name = await prompt('Full name');
      }

      role = await prompt('Role (owner/admin/approver/contributor)', role);

      if (!gpgKeyId) {
        gpgKeyId = await prompt('GPG Key ID (optional, press Enter to skip)');
      }

      if (!github) {
        github = await prompt('GitHub username (optional, with @)');
      }
    }

    try {
      const contributor = manager.add({
        name,
        email,
        role,
        gpgKeyId: gpgKeyId || undefined,
        github: github || undefined
      });

      console.log(
        `\n✅ Added contributor: ${contributor.name} (${contributor.id})`
      );
      console.log(`   Role: ${contributor.role}`);
      if (contributor.gpgKeyId) {
        console.log(`   GPG Key: ${contributor.gpgKeyId}`);
      }
      console.log('');
    } catch (e) {
      console.error(`\n❌ ${e.message}\n`);
      process.exit(1);
    }
  });

// ============================================================================
// sc people me
// ============================================================================
people
  .command('me')
  .description('Register yourself from git config and GPG key')
  .action(() => {
    const manager = new PeopleManager();

    console.log('\n🔐 Registering from git config...\n');

    try {
      const contributor = manager.registerSelf();

      console.log('✅ Successfully registered!\n');
      console.log(`   Name: ${contributor.name}`);
      console.log(`   Email: ${contributor.email}`);
      if (contributor.github) console.log(`   GitHub: ${contributor.github}`);
      console.log(`   Role: ${contributor.role}`);
      if (contributor.gpgKeyId) {
        console.log(`   GPG Key: ${contributor.gpgKeyId}`);
      } else {
        console.log('   GPG Key: ⚠️ Not configured');
        console.log('\n   To enable signed commits, run: sc gpg setup');
      }
      console.log('');
    } catch (e) {
      console.error(`\n❌ ${e.message}\n`);
      process.exit(1);
    }
  });

// ============================================================================
// sc people remove <id>
// ============================================================================
people
  .command('remove <id>')
  .description('Remove a contributor')
  .option('--force', 'Skip confirmation')
  .action(async (id, options) => {
    const manager = new PeopleManager();

    const contributor = manager.get(id);
    if (!contributor) {
      console.error(`\n❌ Contributor "${id}" not found.\n`);
      process.exit(1);
    }

    if (!options.force) {
      const confirm = await prompt(
        `Remove ${contributor.name} (${contributor.email})? [y/N]`,
        'n'
      );
      if (confirm.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        return;
      }
    }

    try {
      manager.remove(id);
      console.log(`\n✅ Removed: ${contributor.name}\n`);
    } catch (e) {
      console.error(`\n❌ ${e.message}\n`);
      process.exit(1);
    }
  });

// ============================================================================
// sc people gpg-status
// ============================================================================
people
  .command('gpg-status')
  .description('Check GPG key status for all contributors')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const manager = new PeopleManager();
    const statuses = manager.getGpgStatus();

    if (options.json) {
      console.log(JSON.stringify(statuses, null, 2));
      return;
    }

    console.log('\n🔐 GPG Key Status\n');
    console.log('─'.repeat(60));

    let verified = 0;
    let unverified = 0;
    let missing = 0;

    statuses.forEach((s) => {
      const icon = {
        verified: '✅',
        unverified: '⚠️',
        missing: '❌'
      }[s.status];

      console.log(`${icon} ${s.name}`);
      console.log(`   Email: ${s.email}`);
      console.log(`   Key: ${s.gpgKeyId || 'Not configured'}`);
      console.log(`   Status: ${s.status}`);
      console.log('');

      if (s.status === 'verified') verified++;
      else if (s.status === 'unverified') unverified++;
      else missing++;
    });

    console.log('─'.repeat(60));
    console.log(
      `Summary: ✅ ${verified} verified | ⚠️ ${unverified} unverified | ❌ ${missing} missing`
    );

    if (missing > 0 || unverified > 0) {
      console.log(
        '\n💡 To set up GPG for a contributor, they should run: sc gpg setup'
      );
    }
    console.log('');
  });

// ============================================================================
// sc people verify <id>
// ============================================================================
people
  .command('verify <id>')
  .description("Verify a contributor's GPG key is on GitHub")
  .action(async (id) => {
    const manager = new PeopleManager();

    console.log(`\n🔍 Verifying GPG key for "${id}"...\n`);

    try {
      const result = await manager.verifyGitHubKey(id);

      if (result.onGitHub === true) {
        console.log(`✅ ${result.message}`);
        console.log(`   Key ID: ${result.keyId}`);
      } else if (result.onGitHub === false) {
        console.log(`⚠️ ${result.message}`);
        console.log(`   Key ID: ${result.keyId}`);
        console.log(
          '\n   To add to GitHub: https://github.com/settings/gpg/new'
        );
      } else {
        console.log(`❓ ${result.message}`);
      }
      console.log('');
    } catch (e) {
      console.error(`\n❌ ${e.message}\n`);
      process.exit(1);
    }
  });

// ============================================================================
// sc people set-role <id> <role>
// ============================================================================
people
  .command('set-role <id> <role>')
  .description("Update a contributor's role")
  .action((id, role) => {
    const manager = new PeopleManager();

    const validRoles = ['owner', 'admin', 'approver', 'contributor'];
    if (!validRoles.includes(role)) {
      console.error(
        `\n❌ Invalid role "${role}". Must be one of: ${validRoles.join(', ')}\n`
      );
      process.exit(1);
    }

    try {
      const updated = manager.update(id, { role });
      console.log(`\n✅ Updated ${updated.name}'s role to: ${role}\n`);
    } catch (e) {
      console.error(`\n❌ ${e.message}\n`);
      process.exit(1);
    }
  });

// ============================================================================
// sc people can-approve <id> <path>
// ============================================================================
people
  .command('can-approve <id> <documentPath>')
  .description('Check if a contributor can approve a document')
  .action((id, documentPath) => {
    const manager = new PeopleManager();

    const contributor = manager.get(id);
    if (!contributor) {
      console.error(`\n❌ Contributor "${id}" not found.\n`);
      process.exit(1);
    }

    const canApprove = manager.canApprove(id, documentPath);

    if (canApprove) {
      console.log(`\n✅ ${contributor.name} CAN approve: ${documentPath}\n`);
    } else {
      console.log(`\n❌ ${contributor.name} CANNOT approve: ${documentPath}\n`);

      const approvers = manager.getApproversFor(documentPath);
      if (approvers.length > 0) {
        console.log('   Eligible approvers:');
        approvers.forEach((a) => console.log(`     - ${a.name} (${a.role})`));
      } else {
        console.log('   No contributors configured to approve this path.');
      }
      console.log('');
    }
  });

// ============================================================================
// sc people approvers-for <path>
// ============================================================================
people
  .command('approvers-for <documentPath>')
  .description('List contributors who can approve a document')
  .action((documentPath) => {
    const manager = new PeopleManager();
    const approvers = manager.getApproversFor(documentPath);

    console.log(`\n📋 Approvers for: ${documentPath}\n`);

    if (approvers.length === 0) {
      console.log('   No contributors configured to approve this path.');
      console.log('   Owners can approve all documents by default.\n');
      return;
    }

    approvers.forEach((a) => {
      console.log(`   • ${a.name} (${a.role})`);
      if (a.email) console.log(`     ${a.email}`);
    });
    console.log('');
  });

// ============================================================================
// sc people init
// ============================================================================
people
  .command('init')
  .description('Initialize people.yaml with default structure')
  .option('--force', 'Overwrite existing file')
  .action((options) => {
    const manager = new PeopleManager();

    if (require('node:fs').existsSync(manager.peoplePath) && !options.force) {
      console.log(`\n⚠️ ${manager.peoplePath} already exists.`);
      console.log('   Use --force to overwrite.\n');
      return;
    }

    const defaultData = manager.getDefaultStructure();
    manager.save(defaultData);

    console.log(`\n✅ Created ${manager.peoplePath}`);
    console.log('\nNext steps:');
    console.log('  1. Run "sc people me" to register yourself');
    console.log('  2. Run "sc people add" to add team members');
    console.log(
      '  3. Edit .supernal/people.yaml to configure approval rules\n'
    );
  });

module.exports = people;
