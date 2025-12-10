import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import matter from 'gray-matter';

interface ComponentInfo {
  file: string;
  type: string;
  name: string;
  functions: string[];
  classes: string[];
  exports: string[];
  matchCount: number;
}

interface MapOptions {
  searchDirs?: string[];
  updateRequirement?: boolean;
  generateTrace?: boolean;
}

interface MapResult {
  requirementId: string;
  components: ComponentInfo[];
}

interface RequirementInfo {
  id: string;
  title?: string;
  codeComponents?: string[];
  lastMapped?: string;
}

interface ComplianceReport {
  generated: string;
  requirements: Array<{
    id: string;
    title?: string;
    mapped: boolean;
    componentCount: number;
    lastMapped: string | null;
  }>;
  totalRequirements: number;
  totalMapped: number;
  totalComponents: number;
}

class SolutionsMapper {
  protected codeDir: string;
  protected projectRoot: string;
  protected requirementsDir: string;
  protected solutionsDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.requirementsDir = path.join(projectRoot, 'docs', 'requirements');
    this.solutionsDir = path.join(projectRoot, 'docs', 'solutions');
    this.codeDir = projectRoot;
    this.ensureDirectories();
  }

  async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.solutionsDir);
  }

  async mapComponents(requirementId: string, options: MapOptions = {}): Promise<MapResult> {
    console.log(chalk.blue(`Scanning codebase for ${requirementId}...`));

    const components = await this.scanCodebase(requirementId, options);

    if (components.length === 0) {
      console.log(
        chalk.yellow(
          `No code components found with ${requirementId} references`
        )
      );
      return { requirementId, components: [] };
    }

    if (options.updateRequirement !== false) {
      await this.updateRequirementWithComponents(requirementId, components);
    }

    if (options.generateTrace !== false) {
      await this.generateTraceDocument(requirementId, components);
    }

    console.log(
      chalk.green(
        `[OK] Mapped ${components.length} components for ${requirementId}`
      )
    );

    return { requirementId, components };
  }

  async scanCodebase(requirementId: string, options: MapOptions = {}): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];
    const scannedFiles = new Set<string>();

    const patterns = [
      new RegExp(`//.*${requirementId}`, 'gi'),
      new RegExp(`/\\*.*${requirementId}.*\\*/`, 'gis'),
      new RegExp(`#.*${requirementId}`, 'gi'),
      new RegExp(`@implements.*${requirementId}`, 'gi'),
      new RegExp(`@requirement.*${requirementId}`, 'gi'),
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

  async scanDirectory(
    dirPath: string,
    patterns: RegExp[],
    requirementId: string,
    components: ComponentInfo[],
    scannedFiles: Set<string>
  ): Promise<void> {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(this.projectRoot, fullPath);

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

  isCodeFile(filename: string): boolean {
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

  async scanFile(
    filePath: string,
    patterns: RegExp[],
    _requirementId: string,
    components: ComponentInfo[],
    relativePath: string
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      const matches: string[] = [];
      for (const pattern of patterns) {
        const found = content.match(pattern);
        if (found) {
          matches.push(...found);
        }
      }

      if (matches.length > 0) {
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

  extractComponentInfo(
    content: string,
    filePath: string,
    _relativePath: string
  ): { type: string; name: string; functions: string[]; classes: string[]; exports: string[] } {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);

    const info = {
      type: this.inferComponentType(ext, content),
      name: path.basename(fileName, ext),
      functions: [] as string[],
      classes: [] as string[],
      exports: [] as string[]
    };

    const functionMatches = content.matchAll(
      /(?:function|async function|const|let|var)\s+(\w+)\s*[=(]/g
    );
    for (const match of functionMatches) {
      info.functions.push(match[1]);
    }

    const classMatches = content.matchAll(
      /class\s+(\w+)(?:\s+extends\s+\w+)?/g
    );
    for (const match of classMatches) {
      info.classes.push(match[1]);
    }

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

  inferComponentType(ext: string, content: string): string {
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

  async updateRequirementWithComponents(requirementId: string, components: ComponentInfo[]): Promise<void> {
    const reqFile = await this.findRequirementFile(requirementId);
    if (!reqFile) {
      console.log(
        chalk.yellow(`Could not find requirement file for ${requirementId}`)
      );
      return;
    }

    const content = await fs.readFile(reqFile, 'utf8');
    const { data, content: markdownContent } = matter(content);

    data.codeComponents = components.map((c) => c.file);
    data.lastMapped = new Date().toISOString().split('T')[0];

    let updatedContent = markdownContent;

    if (!updatedContent.includes('## Code Components')) {
      updatedContent += '\n\n## Code Components\n\n';
    }

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

  generateComponentsSection(components: ComponentInfo[], requirementId: string): string {
    let section = `<!-- Auto-generated by: sc solutions map ${requirementId} -->\n`;
    section += `<!-- Last updated: ${new Date().toISOString()} -->\n\n`;

    if (components.length === 0) {
      return `${section}No code components mapped yet.\n`;
    }

    const byType: Record<string, ComponentInfo[]> = {};
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

  async generateTraceDocument(requirementId: string, components: ComponentInfo[]): Promise<void> {
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

  async findRequirementFile(requirementId: string): Promise<string | null> {
    const files: string[] = [];

    const scanDir = async (dir: string): Promise<void> => {
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
    };

    await scanDir(this.requirementsDir);
    return files[0] || null;
  }

  async generateComplianceReport(): Promise<ComplianceReport> {
    console.log(chalk.blue('Generating compliance report...'));

    const report: ComplianceReport = {
      generated: new Date().toISOString(),
      requirements: [],
      totalRequirements: 0,
      totalMapped: 0,
      totalComponents: 0
    };

    const reqFiles: string[] = [];
    await this.collectRequirementFiles(this.requirementsDir, reqFiles);

    for (const reqFile of reqFiles) {
      const content = await fs.readFile(reqFile, 'utf8');
      const { data } = matter(content) as unknown as { data: RequirementInfo };

      if (data.id) {
        const mapped = !!(data.codeComponents && data.codeComponents.length > 0);
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
          report.totalComponents += data.codeComponents!.length;
        }
      }
    }

    const reportPath = path.join(this.solutionsDir, 'compliance-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });

    console.log(chalk.green('[OK] Compliance report generated'));
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

  async collectRequirementFiles(dir: string, files: string[]): Promise<void> {
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

export default SolutionsMapper;
module.exports = SolutionsMapper;
