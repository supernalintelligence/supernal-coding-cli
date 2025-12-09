/**
 * Template Fetcher - Fetch latest SC templates from various sources
 * Supports npm registry, git repository, and local sources
 */

const fs = require('fs-extra');
const path = require('node:path');
const { execSync } = require('node:child_process');
const https = require('node:https');
const tar = require('tar');

class TemplateFetcher {
  constructor(options = {}) {
    this.cacheDir =
      options.cacheDir || path.join(process.cwd(), '.supernal-coding', 'cache');
    this.source = options.source || 'npm'; // 'npm', 'git', or 'local'
    this.verbose = options.verbose || false;
  }

  /**
   * Fetch templates for a specific version
   * @param {string} version - Version to fetch (e.g., '1.2.5', 'latest')
   * @returns {Promise<FetchResult>}
   */
  async fetchTemplates(version = 'latest') {
    await fs.ensureDir(this.cacheDir);

    const cacheKey = `sc-templates-${version}`;
    const cachePath = path.join(this.cacheDir, cacheKey);

    // Check cache first
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

    // Fetch based on source
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

  /**
   * Fetch from npm registry
   */
  async fetchFromNpm(version, cachePath) {
    if (this.verbose) {
      console.log(`Fetching templates from npm: ${version}`);
    }

    try {
      // Get package info from npm
      const packageInfo = await this.getNpmPackageInfo(
        'supernal-coding',
        version
      );
      const tarballUrl = packageInfo.dist.tarball;
      const actualVersion = packageInfo.version;

      if (this.verbose) {
        console.log(`Downloading: ${tarballUrl}`);
      }

      // Download and extract tarball
      const tempTarball = path.join(this.cacheDir, `temp-${Date.now()}.tgz`);
      await this.downloadFile(tarballUrl, tempTarball);

      // Extract to cache
      await fs.ensureDir(cachePath);
      await tar.extract({
        file: tempTarball,
        cwd: cachePath,
        strip: 1, // Remove 'package/' prefix from npm tarballs
      });

      // Cleanup temp tarball
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
      throw new Error(`Failed to fetch from npm: ${error.message}`);
    }
  }

  /**
   * Fetch from git repository
   */
  async fetchFromGit(version, cachePath) {
    if (this.verbose) {
      console.log(`Fetching templates from git: ${version}`);
    }

    const gitUrl = 'https://github.com/supernal-io/supernal-coding.git';
    const ref = version === 'latest' ? 'main' : `v${version}`;

    try {
      await fs.ensureDir(cachePath);

      // Clone specific ref
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
      throw new Error(`Failed to fetch from git: ${error.message}`);
    }
  }

  /**
   * Fetch from local development directory
   */
  async fetchFromLocal(_version, cachePath) {
    if (this.verbose) {
      console.log(`Using local templates`);
    }

    // Find local SC package directory
    const localPath = this.findLocalScPackage();

    if (!localPath) {
      throw new Error('Local SC package not found');
    }

    // Copy to cache
    await fs.copy(localPath, cachePath);

    return {
      success: true,
      path: cachePath,
      version: 'local',
      cached: false,
      source: 'local',
    };
  }

  /**
   * Get package info from npm registry
   */
  async getNpmPackageInfo(packageName, version) {
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

  /**
   * Download file from URL
   */
  async downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);

      https
        .get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 302 || response.statusCode === 301) {
            return this.downloadFile(response.headers.location, dest)
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
          fs.unlink(dest);
          reject(err);
        });
    });
  }

  /**
   * Check if templates are cached
   */
  async isCached(cachePath) {
    return await fs.pathExists(cachePath);
  }

  /**
   * Find local SC package directory
   */
  findLocalScPackage() {
    // Check common locations
    const locations = [
      path.join(__dirname, '../../..'), // From lib/upgrade
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

  /**
   * Extract specific directories from fetched templates
   * @param {string} fetchedPath - Path to fetched templates
   * @param {Array<string>} dirs - Directories to extract (e.g., ['.cursor/rules', 'templates'])
   * @returns {Promise<Object>} Map of directory to extracted path
   */
  async extractDirectories(fetchedPath, dirs = []) {
    const extracted = {};

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

  /**
   * Get file list from fetched templates
   */
  async getFileList(fetchedPath, patterns = ['**/*']) {
    const glob = require('glob');
    const files = [];

    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        cwd: fetchedPath,
        nodir: true,
        dot: true,
      });
      files.push(...matches);
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Clear cache
   */
  async clearCache() {
    if (await fs.pathExists(this.cacheDir)) {
      await fs.remove(this.cacheDir);
      if (this.verbose) {
        console.log('Cache cleared');
      }
    }
  }

  /**
   * Get cache info
   */
  async getCacheInfo() {
    if (!(await fs.pathExists(this.cacheDir))) {
      return { exists: false, size: 0, entries: [] };
    }

    const entries = await fs.readdir(this.cacheDir);
    let totalSize = 0;

    const details = [];
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

/**
 * @typedef {Object} FetchResult
 * @property {boolean} success - Whether fetch was successful
 * @property {string} path - Path to fetched templates
 * @property {string} version - Version that was fetched
 * @property {boolean} cached - Whether result was from cache
 * @property {string} source - Source of templates (npm, git, local)
 */

module.exports = TemplateFetcher;
