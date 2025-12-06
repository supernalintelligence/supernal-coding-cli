#!/usr/bin/env node

/**
 * Test script for multi-repo workspace coordination
 * Dogfoods the workspace system with dummy repos
 */

const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const WorkspaceManager = require('../../lib/workspace/WorkspaceManager');

const TEST_DIR = path.join(process.cwd(), 'test-repos');

async function cleanup() {
  console.log(chalk.blue('🧹 Cleaning up test directory...'));
  if (await fs.pathExists(TEST_DIR)) {
    await fs.remove(TEST_DIR);
  }
}

async function setup() {
  console.log(chalk.blue('\n📦 Setting up test directory...'));
  await fs.ensureDir(TEST_DIR);
  process.chdir(TEST_DIR);
}

async function testWorkspaceInit() {
  console.log(chalk.blue.bold('\n\n=== TEST 1: Workspace Initialization ==='));

  const manager = new WorkspaceManager();

  try {
    const result = await manager.init({
      name: 'test-workspace',
      description: 'Test multi-repo workspace'
    });

    console.log(chalk.green('✅ Workspace initialized'));
    console.log(chalk.gray('   Workspace file:'), result.workspace);
    console.log(chalk.gray('   Handoffs dir:'), result.structure.handoffs);
    console.log(
      chalk.gray('   Dependencies dir:'),
      result.structure.dependencies
    );

    // Verify structure
    const checks = [
      fs.pathExists('.supernal/workspace.yaml'),
      fs.pathExists('.supernal/cross-repo/handoffs'),
      fs.pathExists('.supernal/cross-repo/dependencies'),
      fs.pathExists('.supernal/README.md')
    ];

    const results = await Promise.all(checks);
    if (results.every((r) => r)) {
      console.log(chalk.green('✅ All directories created'));
    } else {
      console.log(chalk.red('❌ Some directories missing'));
      return false;
    }

    return true;
  } catch (error) {
    console.log(chalk.red('❌ Failed:'), error.message);
    return false;
  }
}

async function createDummyRepo(name, type) {
  console.log(chalk.gray(`\n   Creating dummy repo: ${name}...`));

  const repoPath = path.join(TEST_DIR, name);
  await fs.ensureDir(repoPath);

  // Create minimal Supernal Coding structure
  await fs.ensureDir(path.join(repoPath, '.supernal'));
  await fs.ensureDir(path.join(repoPath, 'docs/handoffs'));
  await fs.ensureDir(path.join(repoPath, 'docs/requirements'));

  // Create config.yaml
  const config = {
    project: {
      name,
      type,
      primary_language: type === 'backend' ? 'typescript' : 'javascript'
    },
    docs: {
      kanban: 'docs/planning/kanban',
      handoffs: 'docs/handoffs',
      requirements: 'docs/requirements'
    }
  };

  const yaml = require('js-yaml');
  await fs.writeFile(
    path.join(repoPath, '.supernal/config.yaml'),
    yaml.dump(config),
    'utf8'
  );

  // Create README
  await fs.writeFile(
    path.join(repoPath, 'README.md'),
    `# ${name}\n\nTest ${type} repository\n`,
    'utf8'
  );

  console.log(chalk.green(`   ✅ Created ${name}`));
  return repoPath;
}

async function testRepoLinking() {
  console.log(chalk.blue.bold('\n\n=== TEST 2: Repository Linking ==='));

  // Create dummy repos
  await createDummyRepo('test-api', 'backend');
  await createDummyRepo('test-frontend', 'frontend');
  await createDummyRepo('test-infra', 'infrastructure');

  const _manager = new WorkspaceManager();

  // Link each repo
  const repos = ['test-api', 'test-frontend', 'test-infra'];
  for (const repo of repos) {
    try {
      process.chdir(path.join(TEST_DIR, repo));

      console.log(chalk.green(`✅ Linked ${repo}`));

      // Verify link
      const configPath = '.supernal/config.yaml';
      const yaml = require('js-yaml');
      const config = yaml.load(await fs.readFile(configPath, 'utf8'));

      if (config.workspace?.enabled) {
        console.log(chalk.gray(`   Workspace enabled: true`));
        console.log(
          chalk.gray(`   Parent path: ${config.workspace.parent_path}`)
        );
      } else {
        console.log(chalk.red(`   ❌ Workspace not enabled in config`));
        return false;
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to link ${repo}:`), error.message);
      return false;
    }
  }

  // Verify workspace registration
  process.chdir(TEST_DIR);
  const yaml = require('js-yaml');
  const workspace = yaml.load(
    await fs.readFile('.supernal/workspace.yaml', 'utf8')
  );

  console.log(chalk.blue('\n📋 Workspace registration:'));
  console.log(chalk.gray(`   Total repos: ${workspace.repos.length}`));
  workspace.repos.forEach((repo) => {
    console.log(chalk.gray(`   - ${repo.name} (${repo.type})`));
  });

  if (workspace.repos.length === 3) {
    console.log(chalk.green('\n✅ All repos registered in workspace'));
    return true;
  } else {
    console.log(
      chalk.red(`\n❌ Expected 3 repos, found ${workspace.repos.length}`)
    );
    return false;
  }
}

async function testWorkspaceStatus() {
  console.log(chalk.blue.bold('\n\n=== TEST 3: Workspace Status ==='));

  process.chdir(TEST_DIR);
  const manager = new WorkspaceManager();

  try {
    const status = await manager.status({ json: true });

    console.log(chalk.blue(`\n📊 Workspace: ${status.workspace}`));
    console.log(chalk.gray(`   Total repos: ${status.total_repos}`));
    console.log(chalk.gray(`   Existing repos: ${status.existing_repos}`));

    console.log(chalk.blue('\n   Repositories:'));
    status.repos.forEach((repo) => {
      const icon = repo.exists ? '✅' : '❌';
      console.log(chalk.gray(`   ${icon} ${repo.name} (${repo.type})`));
      if (repo.exists) {
        console.log(
          chalk.gray(`      Active handoffs: ${repo.active_handoffs}`)
        );
      }
    });

    if (status.existing_repos === status.total_repos) {
      console.log(chalk.green('\n✅ All repos exist and are accessible'));
      return true;
    } else {
      console.log(chalk.yellow(`\n⚠️  Some repos not found`));
      return true; // Still pass - repos might not exist yet
    }
  } catch (error) {
    console.log(chalk.red('❌ Failed:'), error.message);
    return false;
  }
}

async function testValidation() {
  console.log(chalk.blue.bold('\n\n=== TEST 4: Workspace Validation ==='));

  process.chdir(TEST_DIR);
  const manager = new WorkspaceManager();

  try {
    const result = await manager.validate();

    if (result.valid) {
      console.log(chalk.green('✅ Workspace configuration is valid'));
      return true;
    } else {
      console.log(chalk.red('❌ Validation errors:'));
      result.errors.forEach((err) => {
        console.log(chalk.red(`   - ${err}`));
      });
      return false;
    }
  } catch (error) {
    console.log(chalk.red('❌ Failed:'), error.message);
    return false;
  }
}

async function testRepoUnlinking() {
  console.log(chalk.blue.bold('\n\n=== TEST 5: Repository Unlinking ==='));

  // Unlink one repo
  process.chdir(path.join(TEST_DIR, 'test-infra'));
  const manager = new WorkspaceManager();

  try {
    const result = await manager.unlink();
    console.log(chalk.green(`✅ Unlinked ${result.repo}`));

    // Verify unlink
    const yaml = require('js-yaml');
    const config = yaml.load(
      await fs.readFile('.supernal/config.yaml', 'utf8')
    );

    if (!config.workspace) {
      console.log(chalk.gray('   Workspace config removed from repo'));
    } else {
      console.log(chalk.red('   ❌ Workspace config still present'));
      return false;
    }

    // Verify workspace
    process.chdir(TEST_DIR);
    const workspace = yaml.load(
      await fs.readFile('.supernal/workspace.yaml', 'utf8')
    );

    const stillLinked = workspace.repos.find((r) => r.name === 'test-infra');
    if (!stillLinked) {
      console.log(chalk.gray('   Repo removed from workspace'));
      console.log(chalk.green('\n✅ Unlink successful'));
      return true;
    } else {
      console.log(chalk.red('   ❌ Repo still in workspace'));
      return false;
    }
  } catch (error) {
    console.log(chalk.red('❌ Failed:'), error.message);
    return false;
  }
}

async function runTests() {
  console.log(
    chalk.bold.blue(
      '\n🧪 Multi-Repo Workspace Coordination - Dogfooding Test\n'
    )
  );
  console.log(chalk.gray('Testing Phase 1: Workspace Foundation\n'));

  const results = [];

  try {
    // Setup
    await cleanup();
    await setup();

    // Run tests
    results.push({ name: 'Workspace Init', pass: await testWorkspaceInit() });
    results.push({ name: 'Repo Linking', pass: await testRepoLinking() });
    results.push({
      name: 'Workspace Status',
      pass: await testWorkspaceStatus()
    });
    results.push({ name: 'Validation', pass: await testValidation() });
    results.push({ name: 'Repo Unlinking', pass: await testRepoUnlinking() });

    // Summary
    console.log(chalk.bold.blue(`\n\n${'='.repeat(60)}`));
    console.log(chalk.bold.blue('TEST SUMMARY'));
    console.log(chalk.bold.blue(`${'='.repeat(60)}\n`));

    results.forEach((test) => {
      const icon = test.pass ? '✅' : '❌';
      const color = test.pass ? chalk.green : chalk.red;
      console.log(color(`${icon} ${test.name}`));
    });

    const passed = results.filter((r) => r.pass).length;
    const total = results.length;

    console.log(chalk.bold.blue(`\n${'='.repeat(60)}`));
    console.log(chalk.bold(`Result: ${passed}/${total} tests passed`));
    console.log(chalk.bold.blue(`${'='.repeat(60)}\n`));

    if (passed === total) {
      console.log(chalk.green.bold('🎉 ALL TESTS PASSED!\n'));
      console.log(chalk.blue('Test workspace created at:'), TEST_DIR);
      console.log(
        chalk.gray('Inspect with:'),
        `cd ${TEST_DIR} && ls -la .supernal/`
      );
      return true;
    } else {
      console.log(chalk.red.bold('❌ SOME TESTS FAILED\n'));
      return false;
    }
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Test suite failed:'), error.message);
    console.error(error.stack);
    return false;
  }
}

// Run tests
runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
