/**
 * Google API Client
 * 
 * Wraps the credential management and provides a clean API interface.
 */

const googleAuth = require('../../credentials/google-oauth');

// Re-export auth functions
const {
  startCLIAuthFlow,
  isAuthenticated,
  logout,
  getUserInfo,
  getAuthenticatedClient
} = googleAuth;

module.exports = {
  startCLIAuthFlow,
  isAuthenticated,
  logout,
  getUserInfo,
  getAuthenticatedClient
};

