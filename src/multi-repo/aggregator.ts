// @ts-nocheck
const fs = require('node:fs').promises;
const path = require('node:path');

/**
 * RepoAggregator - Aggregate data across multiple repos
 */
class RepoAggregator {
  repos: any;
  constructor() {
    this.repos = [];
  }

  /**
   * Set repos to aggregate
   * @param {Array<Object>} repos - Discovered repos
   */
  setRepos(repos) {
    this.repos = repos;
  }

  /**
   * Aggregate requirements across repos
   * @returns {Promise<Array<Object>>} Combined requirements
   */
  async aggregateRequirements() {
    const allRequirements = [];

    for (const repo of this.repos) {
      const repoReqs = await this.loadRequirements(repo);
      allRequirements.push(...repoReqs);
    }

    return allRequirements;
  }

  /**
   * Load requirements for a repo
   * @private
   */
  async loadRequirements(repo) {
    try {
      const reqDir = path.join(repo.path, 'requirements');
      const files = await fs.readdir(reqDir);
      const reqFiles = files.filter(
        (f) => f.startsWith('req-') && f.endsWith('.md')
      );

      const requirements = [];

      for (const file of reqFiles) {
        const filePath = path.join(reqDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const matter = require('gray-matter');
          const parsed = matter(content);

          requirements.push({
            repo: repo.id,
            repoPath: repo.path,
            file,
            id: this.extractReqId(file),
            title: parsed.data.title || this.extractTitle(content),
            status: parsed.data.status || 'unknown',
            priority: parsed.data.priority || 'medium',
            frontmatter: parsed.data,
            content: parsed.content
          });
        } catch {
          // Skip files we can't read
        }
      }

      return requirements;
    } catch {
      return [];
    }
  }

  /**
   * Extract requirement ID from filename
   * @private
   */
  extractReqId(filename) {
    const match = filename.match(/req-([^.]+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract title from content
   * @private
   */
  extractTitle(content) {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : 'Untitled';
  }

  /**
   * Aggregate tasks across repos
   * @returns {Promise<Array<Object>>} Combined tasks
   */
  async aggregateTasks() {
    const allTasks = [];

    for (const repo of this.repos) {
      const repoTasks = await this.loadTasks(repo);
      allTasks.push(...repoTasks);
    }

    return allTasks;
  }

  /**
   * Load tasks for a repo (from kanban or similar)
   * @private
   */
  async loadTasks(repo) {
    try {
      const kanbanDir = path.join(repo.path, 'kanban');
      const files = await fs.readdir(kanbanDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      const tasks = [];

      for (const file of mdFiles) {
        const filePath = path.join(kanbanDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const matter = require('gray-matter');
          const parsed = matter(content);

          tasks.push({
            repo: repo.id,
            repoPath: repo.path,
            file,
            title: parsed.data.title || file.replace('.md', ''),
            status: this.extractKanbanStatus(file),
            priority: parsed.data.priority || 'medium',
            frontmatter: parsed.data,
            content: parsed.content
          });
        } catch {
          // Skip files we can't read
        }
      }

      return tasks;
    } catch {
      return [];
    }
  }

  /**
   * Extract kanban status from filename or path
   * @private
   */
  extractKanbanStatus(file) {
    const statuses = ['todo', 'in-progress', 'done', 'blocked'];
    for (const status of statuses) {
      if (file.toLowerCase().includes(status)) {
        return status;
      }
    }
    return 'unknown';
  }

  /**
   * Aggregate documents across repos
   * @returns {Promise<Array<Object>>} Combined documents
   */
  async aggregateDocuments() {
    const allDocs = [];

    for (const repo of this.repos) {
      const repoDocs = await this.loadDocuments(repo);
      allDocs.push(...repoDocs);
    }

    return allDocs;
  }

  /**
   * Load documents for a repo
   * @private
   */
  async loadDocuments(repo) {
    try {
      const docsDir = path.join(repo.path, 'docs');
      const files = await this.scanDocsRecursive(docsDir);

      const documents = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const matter = require('gray-matter');
          const parsed = matter(content);

          documents.push({
            repo: repo.id,
            repoPath: repo.path,
            file: path.relative(repo.path, file),
            title: parsed.data.title || path.basename(file, '.md'),
            type: parsed.data.type || this.inferDocType(file),
            frontmatter: parsed.data,
            content: parsed.content
          });
        } catch {
          // Skip files we can't read
        }
      }

      return documents;
    } catch {
      return [];
    }
  }

  /**
   * Scan docs directory recursively
   * @private
   */
  async scanDocsRecursive(dir, files = []) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanDocsRecursive(fullPath, files);
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return files;
  }

  /**
   * Infer document type from filename
   * @private
   */
  inferDocType(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('architecture')) return 'architecture';
    if (lower.includes('adr-')) return 'decision';
    if (lower.includes('sop-')) return 'process';
    if (lower.includes('requirements')) return 'requirements';
    if (lower.includes('design')) return 'design';
    return 'general';
  }

  /**
   * Filter aggregated data
   * @param {Array<Object>} data - Data to filter
   * @param {Object} criteria - Filter criteria
   * @returns {Array<Object>} Filtered data
   */
  filter(data, criteria) {
    let filtered = [...data];

    if (criteria.repo) {
      filtered = filtered.filter((item) => item.repo === criteria.repo);
    }

    if (criteria.status) {
      filtered = filtered.filter((item) => item.status === criteria.status);
    }

    if (criteria.priority) {
      filtered = filtered.filter((item) => item.priority === criteria.priority);
    }

    if (criteria.type) {
      filtered = filtered.filter((item) => item.type === criteria.type);
    }

    if (criteria.search) {
      const searchLower = criteria.search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title?.toLowerCase().includes(searchLower) ||
          item.content?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }

  /**
   * Get aggregation summary
   * @returns {Promise<Object>} Summary statistics
   */
  async getSummary() {
    const requirements = await this.aggregateRequirements();
    const tasks = await this.aggregateTasks();
    const documents = await this.aggregateDocuments();

    return {
      repoCount: this.repos.length,
      requirementCount: requirements.length,
      taskCount: tasks.length,
      documentCount: documents.length,
      repos: this.repos.map((r) => ({
        id: r.id,
        path: r.path,
        workflow: r.workflow,
        phase: r.currentPhase
      }))
    };
  }
}

module.exports = { RepoAggregator };
