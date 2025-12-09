/**
 * Google Plugin
 * 
 * Integration with Google Workspace (Drive, Docs, Sheets).
 * 
 * Commands:
 *   sc connect google auth login    - Connect with OAuth
 *   sc connect google auth logout   - Disconnect
 *   sc connect google auth status   - Check connection
 *   sc connect google list [path]   - Browse Drive
 *   sc connect google import <id>   - Import as iResource
 *   sc connect google status        - Check sync status
 *   sc connect google sync          - Sync iResources
 */

const { createPlugin } = require('../base');

// Import command handlers
const authLogin = require('./commands/auth-login');
const authLogout = require('./commands/auth-logout');
const authStatus = require('./commands/auth-status');
const list = require('./commands/list');
const importCmd = require('./commands/import');
const status = require('./commands/status');
const sync = require('./commands/sync');

module.exports = createPlugin({
  id: 'google',
  name: 'Google Workspace',
  description: 'Google Drive, Docs, and Sheets integration for iResource import',
  version: '1.0.0',
  icon: 'google',
  
  capabilities: {
    auth: ['oauth2'],
    browse: true,
    import: true,
    export: false,
    sync: true,
    webhook: false
  },
  
  credentials: {
    required: ['clientId', 'clientSecret', 'tokens'],
    optional: ['defaultFolder']
  },
  
  commands: {
    auth: {
      login: authLogin,
      logout: authLogout,
      status: authStatus
    },
    list,
    import: importCmd,
    status,
    sync
  }
});

