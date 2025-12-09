/**
 * Signing module - GPG signing for SC agent commits
 *
 * Part of REQ-INFRA-111: Agent Commit Signing
 */

const SigningManager = require('./SigningManager');
const AgentKeyManager = require('./AgentKeyManager');

module.exports = {
  SigningManager,
  AgentKeyManager,
};

