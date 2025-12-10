/**
 * Test Mapper Script (Wrapper)
 *
 * This is a thin wrapper around the main TestMapperCommand
 * located in cli/commands/testing/test-mapper.js
 *
 * Provides standalone access to test mapping functionality
 * while keeping the core logic in the CLI commands structure.
 */

const TestMapperCommand = require('../cli/commands/testing/test-mapper');

interface TestMapperStats {
  totalFiles: number;
  totalTests: number;
  coveragePercentage: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const format = args[0] || 'report';

  try {
    const testMapper = new TestMapperCommand();
    await testMapper.discover();

    switch (format.toLowerCase()) {
      case 'json':
        console.log(testMapper.exportJSON());
        break;
      case 'commands':
        console.log(JSON.stringify(testMapper.generateTestCommands(), null, 2));
        break;
      case 'stats': {
        const stats: TestMapperStats = testMapper.getStats();
        console.log(`Total Files: ${stats.totalFiles}`);
        console.log(`Total Tests: ${stats.totalTests}`);
        console.log(`Requirements Coverage: ${stats.coveragePercentage}%`);
        break;
      }
      default:
        console.log(testMapper.generateReport());
        break;
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Test mapping failed:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
