// @ts-nocheck
const fs = require('fs-extra');
const path = require('node:path');
const chalk = require('chalk');
const matter = require('gray-matter');

/**
 * Solutions Mapper
 * Automatically maps code components to requirements/sub-requirements for compliance tracing
 */
class SolutionsMapper {
  codeDir: any;
  projectRoot: any;
  requirementsDir: any;
  solutionsDir: any;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.requirementsDir = path.join(projectRoot, 'docs', 'requirements');
    this.solutionsDir = path.join(projectRoot, 'docs', 'solutions');
    this.codeDir = path.join(projectRoot); // Scan from root
    this.ensureDirectories();
  }

  /**
   * Ensure directories exist
   */
  async ensureDirectories() {
    await fs.ensureDir(this.solutionsDir);
  }

  /**
   * Map code components for a requirement or sub-requirement
   */
  async mapComponents(requirementId, options = {}) {
    console.log(chalk.blue(`🔍 Scanning codebase for ${requirementId}...`));

    const components = await this.scanCodebase(requirementId, options);

    if (components.length === 0) {
      console.log(
        chalk.yellow(
          `No code components found with ${requirementId} references`
        )
      );
      return { requirementId, components: [] };
    }

    // Update requirement file with component mappings
    if (options.updateRequirement !== false) {
      await this.updateRequirementWithComponents(requirementId, components);
    }

    // Generate solution trace document
    if (options.generateTrace !== false) {
      await this.generateTraceDocument(requirementId, components);
    }

    console.log(
      chalk.green(
        `✅ Mapped ${components.length} components for ${requirementId}`
      )
    );

    return { requirementId, components };
  }

  /**
   * Scan codebase for components referencing a requirement
   */
  async scanCodebase(requirementId, options = {}) {
    const components = [];
    const scannedFiles = new Set();

    const patterns = [
      // Comments with requirement ID
      new RegExp(`//.*${requirementId}`, 'gi'),
      new RegExp(`/\\*.*${requirementId}.*\\*/`, 'gis'),
      new RegExp(`#.*${requirementId}`, 'gi'),

      // JSDoc tags
      new RegExp(`@implements.*${requirementId}`, 'gi'),
      new RegExp(`@requirement.*${requirementId}`, 'gi'),

      // Decorators (if applicable)
      new RegExp(`@Requirement\\(['"]${requirementId}['"]\\)`, 'gi')
    ];

    const searchDirs = options.searchDirs || [
      'src',
      'lib',
      'apps',
      'packages',
      'supernal-code-package'
    ];

    for (const dir of searchDirs) {
      const fullDir = path.join(this.projectRoot, dir);
      if (await fs.pathExists(fullDir)) {
        await this.scanDirectory(
          fullDir,
          patterns,
          requirementId,
          components,
          scannedFiles
        );
      }
    }

    return components;
  }

  /**
   * Recursively scan directory for requirement references
   */
  async scanDirectory(
    dirPath,
    patterns,
    requirementId,
    components,
    scannedFiles
  ) {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(this.projectRoot, fullPath);

      // Skip node_modules, .git, etc
      if (
        item.name === 'node_modules' ||
        item.name === '.git' ||
        item.name === 'dist' ||
        item.name === 'build' ||
        item.name === '.next'
      ) {
        continue;
      }

      if (item.isDirectory()) {
        await this.scanDirectory(
          fullPath,
          patterns,
          requirementId,
          components,
          scannedFiles
        );
      } else if (this.isCodeFile(item.name)) {
        if (!scannedFiles.has(fullPath)) {
          scannedFiles.add(fullPath);
          await this.scanFile(
            fullPath,
            patterns,
            requirementId,
            components,
            relativePath
          );
        }
      }
    }
  }

  /**
   * Check if file is a code file
   */
  isCodeFile(filename) {
    const extensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.go',
      '.rs',
      '.rb',
      '.php',
      '.sh'
    ];
    return extensions.some((ext) => filename.endsWith(ext));
  }

  /**
   * Scan a single file for requirement references
   */
  async scanFile(filePath, patterns, _requirementId, components, relativePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Check if file references the requirement
      const matches = [];
      for (const pattern of patterns) {
        const found = content.match(pattern);
        if (found) {
          matches.push(...found);
        }
      }

      if (matches.length > 0) {
        // Extract component info
        const componentInfo = this.extractComponentInfo(
          content,
          filePath,
          relativePath
        );

        components.push({
          file: relativePath,
          type: componentInfo.type,
          name: componentInfo.name,
          functions: componentInfo.functions,
          classes: componentInfo.classes,
          exports: componentInfo.exports,
          matchCount: matches.length
        });
      }
    } catch (_error) {
      // Skip files that can't be read
    }
  }

  /**
   * Extract component information from file
   */
  extractComponentInfo(content, filePath, _relativePath) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);

    const info = {
      type: this.inferComponentType(ext, content),
      name: path.basename(fileName, ext),
      functions: [],
      classes: [],
      exports: []
    };

    // Extract functions
    const functionMatches = content.matchAll(
      /(?:function|async function|const|let|var)\s+(\w+)\s*[=(]/g
    );
    for (const match of functionMatches) {
      info.functions.push(match[1]);
    }

    // Extract classes
    const classMatches = content.matchAll(
      /class\s+(\w+)(?:\s+extends\s+\w+)?/g
    );
    for (const match of classMatches) {
      info.classes.push(match[1]);
    }

    // Extract exports
    const exportMatches = content.matchAll(
      /export\s+(?:default\s+)?(?:function|class|const|let|var)?\s*(\w+)?/g
    );
    for (const match of exportMatches) {
      if (match[1]) {
        info.exports.push(match[1]);
      }
    }

    return info;
  }

  /**
   * Infer component type from file extension and content
   */
  inferComponentType(ext, content) {
    if (['.tsx', '.jsx'].includes(ext)) return 'react-component';
    if (['.ts', '.js'].includes(ext)) {
      if (content.includes('React')) return 'react-component';
      if (content.includes('express') || content.includes('router'))
        return 'api';
      if (content.includes('test') || content.includes('describe'))
        return 'test';
      return 'module';
    }
    if (ext === '.py') return 'python-module';
    if (['.java'].includes(ext)) return 'java-class';
    if (['.go'].includes(ext)) return 'go-package';
    return 'code';
  }

  /**
   * Update requirement file with component mappings
   */
  async updateRequirementWithComponents(requirementId, components) {
    const reqFile = await this.findRequirementFile(requirementId);
    if (!reqFile) {
      console.log(
        chalk.yellow(`Could not find requirement file for ${requirementId}`)
      );
      return;
    }

    const content = await fs.readFile(reqFile, 'utf8');
    const { data, content: markdownContent } = matter(content);

    // Update frontmatter
    data.codeComponents = components.map((c) => c.file);
    data.lastMapped = new Date().toISOString().split('T')[0];

    // Update content section
    let updatedContent = markdownContent;

    // Find or create Code Components section
    if (!updatedContent.includes('## Code Components')) {
      updatedContent += '\n\n## Code Components\n\n';
    }

    // Replace Code Components section
    const componentsSection = this.generateComponentsSection(
      components,
      requirementId
    );
    updatedContent = updatedContent.replace(
      /## Code Components[\s\S]*?(?=\n## |$)/,
      `## Code Components\n\n${componentsSection}\n`
    );

    const updatedFile = matter.stringify(updatedContent, data);
    await fs.writeFile(reqFile, updatedFile);

    console.log(
      chalk.blue(`   Updated ${path.relative(this.projectRoot, reqFile)}`)
    );
  }

  /**
   * Generate components section for requirement file
   */
  generateComponentsSection(components, requirementId) {
    let section = `<!-- Auto-generated by: sc solutions map ${requirementId} -->\n`;
    section += `<!-- Last updated: ${new Date().toISOString()} -->\n\n`;

    if (components.length === 0) {
      return `${section}No code components mapped yet.\n`;
    }

    // Group by type
    const byType = {};
    for (const comp of components) {
      if (!byType[comp.type]) {
        byType[comp.type] = [];
      }
      byType[comp.type].push(comp);
    }

    for (const [type, comps] of Object.entries(byType)) {
      section += `### ${type}\n\n`;
      for (const comp of comps) {
        section += `- [\`${comp.file}\`](../../${comp.file})\n`;
        if (comp.classes.length > 0) {
          section += `  - Classes: ${comp.classes.join(', ')}\n`;
        }
        if (comp.functions.length > 0) {
          section += `  - Functions: ${comp.functions.slice(0, 5).join(', ')}${comp.functions.length > 5 ? '...' : ''}\n`;
        }
      }
      section += '\n';
    }

    return section;
  }

  /**
   * Generate solution trace document
   */
  async generateTraceDocument(requirementId, components) {
    const tracePath = path.join(this.solutionsDir, `${requirementId}-trace.md`);

    let content = `# Solution Trace: ${requirementId}\n\n`;
    content += `**Generated**: ${new Date().toISOString()}\n`;
    content += `**Components Mapped**: ${components.length}\n\n`;

    content += `## Purpose\n\n`;
    content += `This document traces the implementation of requirement ${requirementId} `;
    content += `to its code components for compliance and audit purposes.\n\n`;

    content += `## Component Mapping\n\n`;

    for (const comp of components) {
      content += `### ${comp.file}\n\n`;
      content += `- **Type**: ${comp.type}\n`;
      content += `- **Match Count**: ${comp.matchCount}\n`;

      if (comp.classes.length > 0) {
        content += `- **Classes**: ${comp.classes.join(', ')}\n`;
      }

      if (comp.functions.length > 0) {
        content += `- **Functions**: ${comp.functions.join(', ')}\n`;
      }

      if (comp.exports.length > 0) {
        content += `- **Exports**: ${comp.exports.join(', ')}\n`;
      }

      content += `\n`;
    }

    content += `## Compliance Notes\n\n`;
    content += `- All components were automatically detected through code analysis\n`;
    content += `- Components contain explicit references to ${requirementId}\n`;
    content += `- Manual verification recommended for critical compliance requirements\n`;

    await fs.writeFile(tracePath, content);

    console.log(
      chalk.blue(
        `   Generated trace: ${path.relative(this.projectRoot, tracePath)}`
      )
    );
  }

  /**
   * Find requirement file by ID
   */
  async findRequirementFile(requirementId) {
    const files = [];

    async function scanDir(dir) {
      if (!(await fs.pathExists(dir))) return;

      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          await scanDir(fullPath);
        } else if (item.name.endsWith('.md')) {
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const { data } = matter(content);
            if (
              data.id === requirementId ||
              data.id === requirementId.toUpperCase()
            ) {
              files.push(fullPath);
            }
          } catch (_error) {
            // Skip files that can't be parsed
          }
        }
      }
    }

    await scanDir(this.requirementsDir);
    return files[0] || null;
  }

  /**
   * Generate compliance report for all requirements
   */
  async generateComplianceReport() {
    console.log(chalk.blue('📊 Generating compliance report...'));

    const report = {
      generated: new Date().toISOString(),
      requirements: [],
      totalRequirements: 0,
      totalMapped: 0,
      totalComponents: 0
    };

    // Get all requirements
    const reqFiles = [];
    await this.collectRequirementFiles(this.requirementsDir, reqFiles);

    for (const reqFile of reqFiles) {
      const content = await fs.readFile(reqFile, 'utf8');
      const { data } = matter(content);

      if (data.id) {
        const mapped = data.codeComponents && data.codeComponents.length > 0;
        report.requirements.push({
          id: data.id,
          title: data.title,
          mapped,
          componentCount: data.codeComponents ? data.codeComponents.length : 0,
          lastMapped: data.lastMapped || null
        });

        report.totalRequirements++;
        if (mapped) {
          report.totalMapped++;
          report.totalComponents += data.codeComponents.length;
        }
      }
    }

    // Save report
    const reportPath = path.join(this.solutionsDir, 'compliance-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });

    console.log(chalk.green('✅ Compliance report generated'));
    console.log(
      chalk.cyan(`   Total Requirements: ${report.totalRequirements}`)
    );
    console.log(
      chalk.cyan(
        `   Mapped to Code: ${report.totalMapped} (${Math.round((report.totalMapped / report.totalRequirements) * 100)}%)`
      )
    );
    console.log(chalk.cyan(`   Total Components: ${report.totalComponents}`));

    return report;
  }

  /**
   * Collect all requirement files
   */
  async collectRequirementFiles(dir, files) {
    if (!(await fs.pathExists(dir))) return;

    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await this.collectRequirementFiles(fullPath, files);
      } else if (item.name.endsWith('.md') && item.name.includes('req-')) {
        files.push(fullPath);
      }
    }
  }
}

module.exports = SolutionsMapper;
