/**
 * Credential Management Module
 *
 * Provides secure credential storage and retrieval for external service integrations.
 *
 * Storage Location: ~/.supernal/credentials/ (outside repository)
 * Encryption: AES-256-GCM with machine-specific key
 *
 * @example
 * const { google, fileStorage } = require('./credentials');
 *
 * // Check if authenticated with Google
 * if (await google.isAuthenticated()) {
 *   const token = await google.getAccessToken();
 *   // Use token to call Google APIs
 * }
 */

const encryption = require('./encryption');
const fileStorage = require('./storage/file-storage');
const googleOAuth = require('./google-oauth');
const jiraAuth = require('./jira-auth');

module.exports = {
  // Low-level encryption utilities
  encryption,

  // File-based credential storage
  fileStorage,

  // Google OAuth integration
  google: googleOAuth,

  // Jira API token integration
  jira: jiraAuth,

  // Convenience exports
  store: fileStorage.store,
  retrieve: fileStorage.retrieve,
  list: fileStorage.list,
  remove: fileStorage.remove
};
