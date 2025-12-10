// @ts-nocheck
/**
 * CLI Map Sync Check
 *
 * Detects changes to CLI source files or SOPs and regenerates
 * documentation when needed. Uses file hash comparison.
 *
 * Configuration via supernal.yaml:
 *   git_hooks.pre_push.checks.cli_sync:
 *     enabled: true
 *     block_on_out_of_sync: true
 *     allow_bypass: true
 *     watch_patterns: [...]
 *     auto_sync: false
 *
 * Bypass: SC_SKIP_CLI_SYNC=true
 *
 * Watched files (default):
 * - supernal-code-package/lib/cli/program.js
 * - supernal-code-package/lib/cli/commands/**
 * - docs/workflow/sops/**
 *
 * Generated files:
 * - docs/reference/cli-command-tree.json
 * - docs/reference/CLI-COMMAND-TREE.md
 * - documentation/docs/cli-commands/**
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { glob } = require('glob');
const yaml = require('yaml');

const HASH_FILE = '.supernal/cli-map-hashes.json';

// Default files to watch for changes
const DEFAULT_WATCH_PATTERNS = [
  'supernal-code-package/lib/cli/program.js',
  'supernal-code-package/lib/cli/commands/**/*.js',
  'docs/workflow/sops/**/*.md'
];

/**
 * Load configuration from supernal.yaml
 */
function loadConfig(projectRoot) {
  const configPath = path.join(projectRoot, 'supernal.yaml');
  const defaults = {
    enabled: true,
    block_on_out_of_sync: true,
    allow_bypass: true,
    watch_patterns: DEFAULT_WATCH_PATTERNS,
    auto_sync: false
  };

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.parse(content);
      const cliSyncConfig = config?.git_hooks?.pre_push?.checks?.cli_sync || {};
      return { ...defaults, ...cliSyncConfig };
    }
  } catch {
    // Ignore errors, use defaults
  }

  return defaults;
}

// For backward compatibility
const WATCH_PATTERNS = DEFAULT_WATCH_PATTERNS;

// Generated output files
const OUTPUT_FILES = {
  json: 'docs/reference/cli-command-tree.json',
  markdown: 'docs/reference/CLI-COMMAND-TREE.md',
  docsDir: 'documentation/docs/cli-commands'
};

/**
 * Calculate hash of a file's contents
 */
function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Get all watched files with their hashes
 */
async function getWatchedFileHashes(projectRoot, config = null) {
  const hashes = {};
  const patterns = config?.watch_patterns || WATCH_PATTERNS;

  for (const pattern of patterns) {
    const fullPattern = path.join(projectRoot, pattern);
    const files = await glob(fullPattern, { nodir: true });

    for (const file of files) {
      const relativePath = path.relative(projectRoot, file);
      const hash = hashFile(file);
      if (hash) {
        hashes[relativePath] = hash;
      }
    }
  }

  return hashes;
}

/**
 * Load stored hashes from previous run
 */
function loadStoredHashes(projectRoot) {
  const hashFilePath = path.join(projectRoot, HASH_FILE);
  try {
    if (fs.existsSync(hashFilePath)) {
      return JSON.parse(fs.readFileSync(hashFilePath, 'utf-8'));
    }
  } catch {
    // Ignore errors, will regenerate
  }
  return null;
}

/**
 * Save current hashes for next comparison
 */
function saveHashes(projectRoot, hashes) {
  const hashFilePath = path.join(projectRoot, HASH_FILE);
  const dir = path.dirname(hashFilePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    hashFilePath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        watchPatterns: WATCH_PATTERNS,
        files: hashes
      },
      null,
      2
    )
  );
}

/**
 * Compare hashes and detect changes
 */
function detectChanges(storedHashes, currentHashes) {
  if (!storedHashes) {
    return { changed: true, reason: 'No previous hash file', changedFiles: [] };
  }

  const changedFiles = [];
  const addedFiles = [];
  const removedFiles = [];

  // Check for changed or added files
  for (const [file, hash] of Object.entries(currentHashes)) {
    if (!storedHashes.files[file]) {
      addedFiles.push(file);
    } else if (storedHashes.files[file] !== hash) {
      changedFiles.push(file);
    }
  }

  // Check for removed files
  for (const file of Object.keys(storedHashes.files)) {
    if (!currentHashes[file]) {
      removedFiles.push(file);
    }
  }

  const hasChanges =
    changedFiles.length > 0 || addedFiles.length > 0 || removedFiles.length > 0;

  return {
    changed: hasChanges,
    reason: hasChanges
      ? `${changedFiles.length} changed, ${addedFiles.length} added, ${removedFiles.length} removed`
      : 'No changes detected',
    changedFiles,
    addedFiles,
    removedFiles
  };
}

/**
 * Check if CLI map needs regeneration
 */
async function checkSyncStatus(projectRoot, options = {}) {
  const { verbose = false } = options;
  const config = loadConfig(projectRoot);

  // Check if enabled
  if (!config.enabled) {
    return {
      needsSync: false,
      reason: 'CLI sync check disabled in config',
      fileCount: 0,
      config
    };
  }

  // Check bypass environment variable
  if (process.env.SC_SKIP_CLI_SYNC === 'true' && config.allow_bypass) {
    return {
      needsSync: false,
      reason: 'Bypassed via SC_SKIP_CLI_SYNC',
      fileCount: 0,
      config
    };
  }

  const currentHashes = await getWatchedFileHashes(projectRoot, config);
  const storedHashes = loadStoredHashes(projectRoot);
  const changes = detectChanges(storedHashes, currentHashes);

  // Also check if output files exist
  const jsonExists = fs.existsSync(path.join(projectRoot, OUTPUT_FILES.json));
  const mdExists = fs.existsSync(path.join(projectRoot, OUTPUT_FILES.markdown));

  if (!jsonExists || !mdExists) {
    changes.changed = true;
    changes.reason = 'Output files missing';
  }

  if (verbose && changes.changed) {
    if (changes.changedFiles?.length > 0) {
      console.log('Changed files:');
      changes.changedFiles.forEach((f) => console.log(`  - ${f}`));
    }
    if (changes.addedFiles?.length > 0) {
      console.log('Added files:');
      changes.addedFiles.forEach((f) => console.log(`  + ${f}`));
    }
    if (changes.removedFiles?.length > 0) {
      console.log('Removed files:');
      changes.removedFiles.forEach((f) => console.log(`  x ${f}`));
    }
  }

  return {
    needsSync: changes.changed,
    reason: changes.reason,
    currentHashes,
    fileCount: Object.keys(currentHashes).length,
    config
  };
}

/**
 * Regenerate CLI map and docs
 */
async function syncCLIMap(projectRoot, options = {}) {
  const { verbose = false, force = false } = options;

  // Check if sync needed
  const status = await checkSyncStatus(projectRoot, { verbose });

  if (!status.needsSync && !force) {
    return {
      synced: false,
      reason: 'Already in sync',
      filesWatched: status.fileCount
    };
  }

  if (verbose) {
    console.log(`Sync needed: ${status.reason}`);
  }

  // Import generator
  const {
    CLIMapGenerator
  } = require('../../../../../scripts/generate-cli-map');
  const generator = new CLIMapGenerator();
  const data = generator.generate();

  // Generate JSON
  const jsonPath = path.join(projectRoot, OUTPUT_FILES.json);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  // Generate Markdown
  const mdPath = path.join(projectRoot, OUTPUT_FILES.markdown);
  fs.writeFileSync(mdPath, generator.generateMarkdownTree(data));

  // Generate individual docs (optional, can be slow)
  if (options.generateDocs !== false) {
    const docsDir = path.join(projectRoot, OUTPUT_FILES.docsDir);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Import doc generator functions from program.js
    // For now, just note that docs should be regenerated
  }

  // Save new hashes
  saveHashes(projectRoot, status.currentHashes);

  return {
    synced: true,
    reason: status.reason,
    filesWatched: status.fileCount,
    commandCount: data.metadata.totalCommands
  };
}

module.exports = {
  checkSyncStatus,
  syncCLIMap,
  getWatchedFileHashes,
  loadConfig,
  WATCH_PATTERNS,
  DEFAULT_WATCH_PATTERNS,
  OUTPUT_FILES,
  HASH_FILE
};
