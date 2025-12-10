/**
 * Jira Plugin
 *
 * Integration with Atlassian Jira for issue tracking and requirement sync.
 *
 * Commands:
 *   sc connect jira auth login    - Connect with API token
 *   sc connect jira auth logout   - Disconnect
 *   sc connect jira auth status   - Check connection
 *   sc connect jira list          - List recent issues
 *   sc connect jira show <key>    - Show issue details
 *   sc connect jira projects      - List accessible projects
 *   sc connect jira boards        - List boards
 *   sc connect jira sprint        - Show active sprint
 *   sc connect jira link          - Link requirement to issue
 *   sc connect jira unlink        - Remove link
 *   sc connect jira push          - Push requirement to Jira
 *   sc connect jira pull          - Pull issue to requirement
 *   sc connect jira sync          - Bidirectional sync
 */

const { createPlugin } = require('../base');
const api = require('./api');

// Import command handlers
const authLogin = require('./commands/auth-login');
const authLogout = require('./commands/auth-logout');
const authStatus = require('./commands/auth-status');
const list = require('./commands/list');
const show = require('./commands/show');
const projects = require('./commands/projects');
const boards = require('./commands/boards');
const sprint = require('./commands/sprint');
const link = require('./commands/link');
const unlink = require('./commands/unlink');
const push = require('./commands/push');
const pull = require('./commands/pull');
const sync = require('./commands/sync');
const linked = require('./commands/linked');

const jiraPlugin = createPlugin({
  id: 'jira',
  name: 'Jira',
  description: 'Atlassian Jira integration for issue tracking and requirement sync',
  version: '1.0.0',
  icon: 'jira',

  capabilities: {
    auth: ['api-token', 'oauth2'],
    browse: true,
    import: true,
    export: true,
    sync: true,
    webhook: false
  },

  credentials: {
    required: ['domain', 'email', 'token'],
    optional: ['defaultProject', 'defaultIssueType']
  },

  commands: {
    auth: {
      login: authLogin,
      logout: authLogout,
      status: authStatus
    },
    list,
    show,
    projects,
    boards,
    sprint,
    link,
    unlink,
    push,
    pull,
    sync,
    linked
  },

  // API client factory
  createClient: api.createClient
});

export default jiraPlugin;
module.exports = jiraPlugin;
