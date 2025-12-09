/**
 * Jira API Client
 * 
 * Wraps the credential management and provides a clean API interface.
 * Re-exports auth functions and adds higher-level operations.
 */

const jiraAuth = require('../../credentials/jira-auth');

// Re-export auth functions
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

/**
 * Create an API client instance
 * @param {Object} credentials - Optional credentials (uses stored if not provided)
 */
function createClient(credentials = null) {
  return {
    // Auth
    login,
    logout,
    isAuthenticated,
    getStatus,
    validateCredentials,
    
    // API requests
    async request(path, options = {}) {
      return apiRequest(path, options);
    },
    
    async agileRequest(path, options = {}) {
      return agileRequest(path, options);
    },
    
    // Issues
    async getIssue(key) {
      return apiRequest(`/issue/${key}`);
    },
    
    async searchIssues(jql, options = {}) {
      const { maxResults = 50, fields = ['summary', 'status', 'assignee', 'priority', 'issuetype', 'updated'] } = options;
      const params = new URLSearchParams({
        jql,
        maxResults: String(maxResults),
        fields: fields.join(',')
      });
      return apiRequest(`/search/jql?${params}`);
    },
    
    async createIssue(data) {
      return apiRequest('/issue', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    
    async updateIssue(key, data) {
      return apiRequest(`/issue/${key}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    
    // Projects
    async getProjects() {
      return apiRequest('/project');
    },
    
    async getProject(key) {
      return apiRequest(`/project/${key}`);
    },
    
    // Boards (Agile API)
    async getBoards() {
      return agileRequest('/board');
    },
    
    async getBoard(boardId) {
      return agileRequest(`/board/${boardId}`);
    },
    
    // Sprints
    async getActiveSprint(boardId) {
      const sprints = await agileRequest(`/board/${boardId}/sprint?state=active`);
      return sprints.values?.[0] || null;
    },
    
    async getSprintIssues(sprintId) {
      return agileRequest(`/sprint/${sprintId}/issue`);
    },
    
    // Transitions
    async getTransitions(issueKey) {
      return apiRequest(`/issue/${issueKey}/transitions`);
    },
    
    async transitionIssue(issueKey, transitionId) {
      return apiRequest(`/issue/${issueKey}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: transitionId } })
      });
    },
    
    // Comments
    async addComment(issueKey, body) {
      return apiRequest(`/issue/${issueKey}/comment`, {
        method: 'POST',
        body: JSON.stringify({ body })
      });
    }
  };
}

module.exports = {
  // Auth
  login,
  logout,
  isAuthenticated,
  getStatus,
  getCredentials,
  validateCredentials,
  apiRequest,
  agileRequest,
  
  // Client factory
  createClient
};

