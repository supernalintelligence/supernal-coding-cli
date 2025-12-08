#!/usr/bin/env node

/**
 * Monitor Daemon Process
 * 
 * Runs in background to monitor repos, GitHub issues, and CI events.
 * Launched by MonitorManager.startDaemon()
 */

const fs = require('fs-extra');
const path = require('node:path');
const MonitorRunner = require('./MonitorRunner');

// Get config file from command line
const configFile = process.argv[2];
if (!configFile) {
  console.error('Usage: monitor-daemon.js <config-file>');
  process.exit(1);
}

// Load configuration
let config;
try {
  config = fs.readJsonSync(configFile);
} catch (error) {
  console.error(`Failed to load config: ${error.message}`);
  process.exit(1);
}

// Get project root from config file location
const projectRoot = path.dirname(path.dirname(configFile));

// Create and start runner
const runner = new MonitorRunner(projectRoot, config);

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await runner.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await runner.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  runner.log(`Uncaught exception: ${error.message}`);
  runner.log(error.stack);
});

process.on('unhandledRejection', (reason) => {
  runner.log(`Unhandled rejection: ${reason}`);
});

// Start monitoring
runner.start().catch((error) => {
  console.error(`Failed to start monitor: ${error.message}`);
  process.exit(1);
});
