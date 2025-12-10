/**
 * Template Fetcher - Fetch latest SC templates from various sources
 * Supports npm registry, git repository, and local sources
 */

import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'node:child_process';
import https from 'node:https';
import tar from 'tar';
import { glob } from 'glob';

interface TemplateFetcherOptions {
  cacheDir?: string;
  source?: 'npm' | 'git' | 'local';
  verbose?: boolean;
}

interface FetchResult {
  success: boolean;
  path: string;
  version: string;
  cached: boolean;
  source?: string;
}

interface NpmPackageInfo {
  version: string;
  dist: {
    tarball: string;
  };
}

interface CacheEntry {
  name: string;
  size: number;
  modified: Date;
}

interface CacheInfo {
  exists: boolean;
  size: number;
  entries: CacheEntry[];
}

class TemplateFetcher {
  protected cacheDir: string;
  protected source: 'npm' | 'git' | 'local';
  protected verbose: boolean;

  constructor(options: TemplateFetcherOptions = {}) {
    this.cacheDir =
      options.cacheDir || path.join(process.cwd(), '.supernal-coding', 'cache');
    this.source = options.source || 'npm';
    this.verbose = options.verbose || false;
  }

  async fetchTemplates(version: string = 'latest'): Promise<FetchResult> {
    await fs.ensureDir(this.cacheDir);

    const cacheKey = `sc-templates-${version}`;
    const cachePath = path.join(this.cacheDir, cacheKey);

    if (await this.isCached(cachePath)) {
      if (this.verbose) {
        console.log(`Using cached templates: ${version}`);
      }
      return {
        success: true,
        path: cachePath,
        version,
        cached: true,
      };
    }

    switch (this.source) {
      case 'npm':
        return await this.fetchFromNpm(version, cachePath);
      case 'git':
        return await this.fetchFromGit(version, cachePath);
      case 'local':
        return await this.fetchFromLocal(version, cachePath);
      default:
        throw new Error(`Unknown source: ${this.source}`);
    }
  }

  async fetchFromNpm(version: string, cachePath: string): Promise<FetchResult> {
    if (this.verbose) {
      console.log(`Fetching templates from npm: ${version}`);
    }

    try {
      const packageInfo = await this.getNpmPackageInfo(
        'supernal-coding',
        version
      );
      const tarballUrl = packageInfo.dist.tarball;
      const actualVersion = packageInfo.version;

      if (this.verbose) {
        console.log(`Downloading: ${tarballUrl}`);
      }

      const tempTarball = path.join(this.cacheDir, `temp-${Date.now()}.tgz`);
      await this.downloadFile(tarballUrl, tempTarball);

      await fs.ensureDir(cachePath);
      await tar.extract({
        file: tempTarball,
        cwd: cachePath,
        strip: 1,
      });

      await fs.remove(tempTarball);

      if (this.verbose) {
        console.log(`Templates extracted to: ${cachePath}`);
      }

      return {
        success: true,
        path: cachePath,
        version: actualVersion,
        cached: false,
        source: 'npm',
      };
    } catch (error) {
      throw new Error(`Failed to fetch from npm: ${(error as Error).message}`);
    }
  }

  async fetchFromGit(version: string, cachePath: string): Promise<FetchResult> {
    if (this.verbose) {
      console.log(`Fetching templates from git: ${version}`);
    }

    const gitUrl = 'https://github.com/supernal-io/supernal-coding.git';
    const ref = version === 'latest' ? 'main' : `v${version}`;

    try {
      await fs.ensureDir(cachePath);

      execSync(`git clone --depth 1 --branch ${ref} ${gitUrl} ${cachePath}`, {
        stdio: this.verbose ? 'inherit' : 'ignore',
      });

      if (this.verbose) {
        console.log(`Templates cloned to: ${cachePath}`);
      }

      return {
        success: true,
        path: cachePath,
        version: ref,
        cached: false,
        source: 'git',
      };
    } catch (error) {
      throw new Error(`Failed to fetch from git: ${(error as Error).message}`);
    }
  }

  async fetchFromLocal(_version: string, cachePath: string): Promise<FetchResult> {
    if (this.verbose) {
      console.log(`Using local templates`);
    }

    const localPath = this.findLocalScPackage();

    if (!localPath) {
      throw new Error('Local SC package not found');
    }

    await fs.copy(localPath, cachePath);

    return {
      success: true,
      path: cachePath,
      version: 'local',
      cached: false,
      source: 'local',
    };
  }

  async getNpmPackageInfo(packageName: string, version: string): Promise<NpmPackageInfo> {
    return new Promise((resolve, reject) => {
      const url =
        version === 'latest'
          ? `https://registry.npmjs.org/${packageName}/latest`
          : `https://registry.npmjs.org/${packageName}/${version}`;

      https
        .get(url, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`npm registry returned ${res.statusCode}`));
            }
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  async downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);

      https
        .get(url, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            return this.downloadFile(response.headers.location!, dest)
              .then(resolve)
              .catch(reject);
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    });
  }

  async isCached(cachePath: string): Promise<boolean> {
    return await fs.pathExists(cachePath);
  }

  findLocalScPackage(): string | null {
    const locations = [
      path.join(__dirname, '../../..'),
      path.join(process.cwd(), 'node_modules/supernal-coding'),
      path.join(process.cwd(), '../supernal-coding'),
    ];

    for (const location of locations) {
      if (fs.existsSync(path.join(location, 'package.json'))) {
        try {
          const pkg = require(path.join(location, 'package.json'));
          if (pkg.name === 'supernal-coding') {
            return location;
          }
        } catch (_e) {
          // Invalid package.json, continue
        }
      }
    }

    return null;
  }

  async extractDirectories(fetchedPath: string, dirs: string[] = []): Promise<Record<string, string>> {
    const extracted: Record<string, string> = {};

    const defaultDirs =
      dirs.length > 0
        ? dirs
        : ['.cursor/rules', 'templates', '.supernal-coding'];

    for (const dir of defaultDirs) {
      const sourcePath = path.join(fetchedPath, dir);

      if (await fs.pathExists(sourcePath)) {
        extracted[dir] = sourcePath;
      } else {
        if (this.verbose) {
          console.log(`⚠️  Directory not found in templates: ${dir}`);
        }
      }
    }

    return extracted;
  }

  async getFileList(fetchedPath: string, patterns: string[] = ['**/*']): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        cwd: fetchedPath,
        nodir: true,
        dot: true,
      });
      files.push(...matches);
    }

    return [...new Set(files)];
  }

  async clearCache(): Promise<void> {
    if (await fs.pathExists(this.cacheDir)) {
      await fs.remove(this.cacheDir);
      if (this.verbose) {
        console.log('Cache cleared');
      }
    }
  }

  async getCacheInfo(): Promise<CacheInfo> {
    if (!(await fs.pathExists(this.cacheDir))) {
      return { exists: false, size: 0, entries: [] };
    }

    const entries = await fs.readdir(this.cacheDir);
    let totalSize = 0;

    const details: CacheEntry[] = [];
    for (const entry of entries) {
      const entryPath = path.join(this.cacheDir, entry);
      const stats = await fs.stat(entryPath);
      totalSize += stats.size;
      details.push({
        name: entry,
        size: stats.size,
        modified: stats.mtime,
      });
    }

    return {
      exists: true,
      size: totalSize,
      entries: details,
    };
  }
}

export default TemplateFetcher;
module.exports = TemplateFetcher;
