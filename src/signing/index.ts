/**
 * Signing module - GPG signing for SC agent commits
 *
 * Part of REQ-INFRA-111: Agent Commit Signing
 */

// These are still JS internally
const SigningManager = require('./SigningManager');
const AgentKeyManager = require('./AgentKeyManager');

export { SigningManager, AgentKeyManager };

module.exports = {
  SigningManager,
  AgentKeyManager,
};
