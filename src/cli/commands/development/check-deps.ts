/**
 * SC Dev Check Dependencies Command
 * Moved from scripts/check-undeclared-deps.js for self-contained package architecture
 *
 * Scans for require() and import statements and verifies they're properly declared in package.json
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

interface ScanResult {
  file: string;
  undeclared: string[];
}

interface MainOptions {
  directory: string;
  verbose: boolean;
}

interface MainResult {
  success: boolean;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

class UndeclaredDependencyChecker {
  readonly builtInModules: Set<string>;
  readonly declaredDeps: Set<string>;
  readonly packageJson: PackageJson;
  readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;

    // Load package.json
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('No package.json found in project root');
    }

    this.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    this.declaredDeps = new Set([
      ...Object.keys(this.packageJson.dependencies || {}),
      ...Object.keys(this.packageJson.devDependencies || {}),
      ...Object.keys(this.packageJson.peerDependencies || {})
    ]);

    this.builtInModules = new Set([
      'fs',
      'path',
      'os',
      'crypto',
      'util',
      'events',
      'stream',
      'http',
      'https',
      'url',
      'querystring',
      'zlib',
      'buffer',
      'child_process',
      'cluster',
      'dgram',
      'dns',
      'net',
      'tls',
      'readline',
      'repl',
      'vm',
      'assert',
      'console',
      'process',
      'timers',
      'tty',
      'domain',
      'punycode',
      'string_decoder',
      'v8',
      'worker_threads',
      'async_hooks',
      'perf_hooks',
      'inspector'
    ]);
  }

  scanFile(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = new Set<string>();

    // Match require() statements
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // Match import statements
    const importRegex = /import\s+(?:.*?\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    while ((match = importRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // Match dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    return Array.from(imports);
  }

  getPackageName(importPath: string): string {
    // Handle scoped packages
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importPath;
    }

    // Handle regular packages
    return importPath.split('/')[0];
  }

  isRelativeImport(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../');
  }

  scanDirectory(directory: string = this.projectRoot): ScanResult[] {
    const results: ScanResult[] = [];

    const scanRecursive = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (
            ['node_modules', '.git', 'dist', 'build', '.next'].includes(
              entry.name
            )
          ) {
            continue;
          }
          scanRecursive(fullPath);
        } else if (entry.isFile()) {
          // Only scan JavaScript/TypeScript files
          if (/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(entry.name)) {
            try {
              const imports = this.scanFile(fullPath);
              const undeclared: string[] = [];

              for (const importPath of imports) {
                if (this.isRelativeImport(importPath)) continue;

                const packageName = this.getPackageName(importPath);

                if (
                  !this.builtInModules.has(packageName) &&
                  !this.declaredDeps.has(packageName)
                ) {
                  undeclared.push(importPath);
                }
              }

              if (undeclared.length > 0) {
                results.push({
                  file: path.relative(this.projectRoot, fullPath),
                  undeclared
                });
              }
            } catch (error) {
              const err = error as Error;
              console.warn(
                `Warning: Could not scan ${fullPath}: ${err.message}`
              );
            }
          }
        }
      }
    };

    scanRecursive(directory);
    return results;
  }

  generateReport(results: ScanResult[]): void {
    if (results.length === 0) {
      console.log(chalk.green('[OK] No undeclared dependencies found!'));
      return;
    }

    console.log(
      chalk.red(
        `[X] Found ${results.length} files with undeclared dependencies:`
      )
    );
    console.log('');

    const allUndeclared = new Set<string>();

    for (const result of results) {
      console.log(chalk.yellow(`[i] ${result.file}:`));
      for (const dep of result.undeclared) {
        console.log(`   - ${dep}`);
        allUndeclared.add(this.getPackageName(dep));
      }
      console.log('');
    }

    console.log(chalk.blue('[i] Suggested package.json additions:'));
    console.log('');
    console.log(
      chalk.cyan('npm install --save'),
      Array.from(allUndeclared).join(' ')
    );
    console.log('');
    console.log(
      chalk.gray('Or add to devDependencies if these are development-only:')
    );
    console.log(
      chalk.cyan('npm install --save-dev'),
      Array.from(allUndeclared).join(' ')
    );
  }
}

// CLI Interface
async function main(args: string[]): Promise<MainResult> {
  const options: MainOptions = {
    directory: process.cwd(),
    verbose: false
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--directory':
      case '-d':
        options.directory = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        console.log(`
${chalk.bold('SC Dev Check Dependencies')}

${chalk.cyan('Usage:')} sc dev check-deps [options]

${chalk.cyan('Options:')}
  -d, --directory <path>  Directory to scan (default: current directory)
  -v, --verbose          Show verbose output
  -h, --help            Show this help message

${chalk.cyan('Description:')}
  Scans JavaScript/TypeScript files for require() and import statements
  and verifies they're properly declared in package.json dependencies.

${chalk.cyan('Examples:')}
  sc dev check-deps                    # Scan current directory
  sc dev check-deps -d ./src          # Scan specific directory
  sc dev check-deps --verbose         # Show detailed output
`);
        return { success: true };
    }
  }

  try {
    if (options.verbose) {
      console.log(
        chalk.blue(
          `[i] Scanning ${options.directory} for undeclared dependencies...`
        )
      );
    }

    const checker = new UndeclaredDependencyChecker(options.directory);
    const results = checker.scanDirectory();
    checker.generateReport(results);

    return { success: results.length === 0 };
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`[X] Error: ${err.message}`));
    return { success: false };
  }
}

// Export for CLI system
export default main;

// Allow direct execution
if (require.main === module) {
  const args = process.argv.slice(2);
  main(args).then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}
