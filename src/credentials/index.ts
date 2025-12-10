/**
 * Credential Management Module
 *
 * Provides secure credential storage and retrieval for external service integrations.
 *
 * Storage Location: ~/.supernal/credentials/ (outside repository)
 * Encryption: AES-256-GCM with machine-specific key
 */

const encryption = require('./encryption');
const fileStorage = require('./storage/file-storage');
const googleOAuth = require('./google-oauth');
const jiraAuth = require('./jira-auth');

export {
  encryption,
  fileStorage,
  googleOAuth as google,
  jiraAuth as jira
};

module.exports = {
  encryption,
  fileStorage,
  google: googleOAuth,
  jira: jiraAuth,
  store: fileStorage.store,
  retrieve: fileStorage.retrieve,
  list: fileStorage.list,
  remove: fileStorage.remove
};
