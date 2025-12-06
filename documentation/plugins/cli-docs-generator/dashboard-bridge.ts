import fs from 'node:fs';
import path from 'node:path';

interface RequirementData {
  id: string;
  title: string;
  status: string;
  priority: string;
  dependencies: string[];
  lastModified: string;
  gitTracking?: {
    lastCommit: string;
    lastUpdate: string;
  };
}

interface DashboardData {
  requirements: RequirementData[];
  kanbanItems: any[];
  projectMetrics: {
    totalRequirements: number;
    completedRequirements: number;
    pendingRequirements: number;
    lastUpdate: string;
  };
}

/**
 * Bridge class to connect Docusaurus with the existing dashboard infrastructure
 * Leverages the dashboard's KanbanParser and requirement processing capabilities
 */
export class DashboardBridge {
  private projectRoot: string;
  private dashboardPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.dashboardPath = path.join(projectRoot, 'dashboard');
  }

  /**
   * Check if dashboard infrastructure is available
   */
  isDashboardAvailable(): boolean {
    const kanbanParserPath = path.join(
      this.dashboardPath,
      'src',
      'services',
      'kanbanParser.js'
    );
    return fs.existsSync(kanbanParserPath);
  }

  /**
   * Load data using the dashboard's kanbanParser
   */
  async loadDashboardData(): Promise<DashboardData | null> {
    if (!this.isDashboardAvailable()) {
      return null;
    }

    try {
      // Use require to load the existing kanbanParser
      const kanbanParserPath = path.join(
        this.dashboardPath,
        'src',
        'services',
        'kanbanParser.js'
      );

      // Since this is a dynamic import in TypeScript, we need to handle it properly
      const _kanbanParser = require(kanbanParserPath);

      // Load requirements data
      const requirementsPath = path.join(
        this.projectRoot,
        'supernal-coding',
        'requirements'
      );
      const requirements = await this.parseRequirements(requirementsPath);

      // Load kanban data
      const kanbanPath = path.join(
        this.projectRoot,
        'supernal-coding',
        'kanban'
      );
      const kanbanItems = await this.parseKanbanItems(kanbanPath);

      return {
        requirements,
        kanbanItems,
        projectMetrics: {
          totalRequirements: requirements.length,
          completedRequirements: requirements.filter(
            (r) => r.status === 'completed'
          ).length,
          pendingRequirements: requirements.filter(
            (r) => r.status === 'pending'
          ).length,
          lastUpdate: new Date().toISOString()
        }
      };
    } catch (error) {
      console.warn('Failed to load dashboard data:', error);
      return null;
    }
  }

  /**
   * Parse requirements using similar logic to dashboard
   */
  private async parseRequirements(
    requirementsPath: string
  ): Promise<RequirementData[]> {
    const requirements: RequirementData[] = [];

    if (!fs.existsSync(requirementsPath)) {
      return requirements;
    }

    try {
      // Recursively find all .md files in requirements directory
      const findMarkdownFiles = (dir: string): string[] => {
        const files: string[] = [];
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            files.push(...findMarkdownFiles(fullPath));
          } else if (item.endsWith('.md')) {
            files.push(fullPath);
          }
        }

        return files;
      };

      const markdownFiles = findMarkdownFiles(requirementsPath);

      for (const filePath of markdownFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const requirement = this.parseRequirementFile(filePath, content);
        if (requirement) {
          requirements.push(requirement);
        }
      }
    } catch (error) {
      console.warn('Error parsing requirements:', error);
    }

    return requirements;
  }

  /**
   * Parse individual requirement file
   */
  private parseRequirementFile(
    filePath: string,
    content: string
  ): RequirementData | null {
    try {
      // Extract metadata from the file
      const statusMatch = content.match(/\*\*Status\*\*:?\s*([^\n]+)/i);
      const priorityMatch = content.match(/\*\*Priority\*\*:?\s*([^\n]+)/i);
      const idMatch = path.basename(filePath, '.md').match(/req-(\d+)/i);
      const titleMatch = content.match(/^#\s+(.+)$/m);

      // Extract git tracking metadata if present
      const gitTrackingMatch = content.match(
        /\*\*Git Tracking\*\*:[\s\S]*?Last Commit:\s*([^\n]+)[\s\S]*?Last Update:\s*([^\n]+)/i
      );

      const requirement: RequirementData = {
        id: idMatch ? `REQ-${idMatch[1]}` : path.basename(filePath, '.md'),
        title: titleMatch ? titleMatch[1] : path.basename(filePath, '.md'),
        status: statusMatch ? statusMatch[1].trim() : 'unknown',
        priority: priorityMatch ? priorityMatch[1].trim() : 'medium',
        dependencies: [], // Could be extracted from content if needed
        lastModified: fs.statSync(filePath).mtime.toISOString()
      };

      if (gitTrackingMatch) {
        requirement.gitTracking = {
          lastCommit: gitTrackingMatch[1].trim(),
          lastUpdate: gitTrackingMatch[2].trim()
        };
      }

      return requirement;
    } catch (error) {
      console.warn(`Error parsing requirement file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse kanban items (simplified version)
   */
  private async parseKanbanItems(_kanbanPath: string): Promise<any[]> {
    // This is a simplified implementation
    // In a real scenario, we'd use the dashboard's kanbanParser logic
    return [];
  }

  /**
   * Generate enhanced CLI documentation with project context
   */
  generateEnhancedDocumentation(dashboardData: DashboardData): string {
    const documentation = `
# Project Overview

## Requirements Status
- **Total Requirements**: ${dashboardData.projectMetrics.totalRequirements}
- **Completed**: ${dashboardData.projectMetrics.completedRequirements}
- **Pending**: ${dashboardData.projectMetrics.pendingRequirements}
- **Last Update**: ${new Date(dashboardData.projectMetrics.lastUpdate).toLocaleDateString()}

## CLI Commands in Context

The CLI commands below are part of a comprehensive development workflow that includes:
- **${dashboardData.requirements.length} tracked requirements**
- **Automated git hooks** for requirements tracking
- **Agent handoff management** for seamless development transitions
- **Kanban-based task management** for organized development

`;

    return documentation;
  }
}

export default DashboardBridge;
