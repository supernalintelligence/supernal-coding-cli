/**
 * Jira API Client
 *
 * Wraps the credential management and provides a clean API interface.
 * Re-exports auth functions and adds higher-level operations.
 */

const jiraAuth = require('../../credentials/jira-auth');

const {
  login,
  logout,
  isAuthenticated,
  getStatus,
  getCredentials,
  validateCredentials,
  apiRequest,
  agileRequest
} = jiraAuth;

interface SearchOptions {
  maxResults?: number;
  fields?: string[];
}

interface JiraClient {
  login: typeof login;
  logout: typeof logout;
  isAuthenticated: typeof isAuthenticated;
  getStatus: typeof getStatus;
  validateCredentials: typeof validateCredentials;
  request(path: string, options?: Record<string, unknown>): Promise<unknown>;
  agileRequest(path: string, options?: Record<string, unknown>): Promise<unknown>;
  getIssue(key: string): Promise<unknown>;
  searchIssues(jql: string, options?: SearchOptions): Promise<unknown>;
  createIssue(data: unknown): Promise<unknown>;
  updateIssue(key: string, data: unknown): Promise<unknown>;
  getProjects(): Promise<unknown>;
  getProject(key: string): Promise<unknown>;
  getBoards(): Promise<unknown>;
  getBoard(boardId: string | number): Promise<unknown>;
  getActiveSprint(boardId: string | number): Promise<unknown>;
  getSprintIssues(sprintId: string | number): Promise<unknown>;
  getTransitions(issueKey: string): Promise<unknown>;
  transitionIssue(issueKey: string, transitionId: string): Promise<unknown>;
  addComment(issueKey: string, body: string): Promise<unknown>;
}

function createClient(_credentials: unknown = null): JiraClient {
  return {
    login,
    logout,
    isAuthenticated,
    getStatus,
    validateCredentials,

    async request(path: string, options: Record<string, unknown> = {}) {
      return apiRequest(path, options);
    },

    async agileRequest(path: string, options: Record<string, unknown> = {}) {
      return agileRequest(path, options);
    },

    async getIssue(key: string) {
      return apiRequest(`/issue/${key}`);
    },

    async searchIssues(jql: string, options: SearchOptions = {}) {
      const { maxResults = 50, fields = ['summary', 'status', 'assignee', 'priority', 'issuetype', 'updated'] } = options;
      const params = new URLSearchParams({
        jql,
        maxResults: String(maxResults),
        fields: fields.join(',')
      });
      return apiRequest(`/search/jql?${params}`);
    },

    async createIssue(data: unknown) {
      return apiRequest('/issue', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async updateIssue(key: string, data: unknown) {
      return apiRequest(`/issue/${key}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async getProjects() {
      return apiRequest('/project');
    },

    async getProject(key: string) {
      return apiRequest(`/project/${key}`);
    },

    async getBoards() {
      return agileRequest('/board');
    },

    async getBoard(boardId: string | number) {
      return agileRequest(`/board/${boardId}`);
    },

    async getActiveSprint(boardId: string | number) {
      const sprints = await agileRequest(`/board/${boardId}/sprint?state=active`) as { values?: unknown[] };
      return sprints.values?.[0] || null;
    },

    async getSprintIssues(sprintId: string | number) {
      return agileRequest(`/sprint/${sprintId}/issue`);
    },

    async getTransitions(issueKey: string) {
      return apiRequest(`/issue/${issueKey}/transitions`);
    },

    async transitionIssue(issueKey: string, transitionId: string) {
      return apiRequest(`/issue/${issueKey}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: transitionId } })
      });
    },

    async addComment(issueKey: string, body: string) {
      return apiRequest(`/issue/${issueKey}/comment`, {
        method: 'POST',
        body: JSON.stringify({ body })
      });
    }
  };
}

export {
  login,
  logout,
  isAuthenticated,
  getStatus,
  getCredentials,
  validateCredentials,
  apiRequest,
  agileRequest,
  createClient
};

module.exports = {
  login,
  logout,
  isAuthenticated,
  getStatus,
  getCredentials,
  validateCredentials,
  apiRequest,
  agileRequest,
  createClient
};
