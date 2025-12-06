#!/usr/bin/env node

const fs = require('node:fs').promises;
const path = require('node:path');
const { execSync } = require('node:child_process');

/**
 * Agent-Specific Commit Attribution System
 * Implements REQ-039: Detects and attributes commits to specific AI agents
 */

class AgentDetector {
  constructor() {
    this.detectionRules = {
      // Environment variable patterns for agent detection
      cursor: {
        envVars: ['CURSOR_SESSION_ID', 'CURSOR_USER_ID', 'CURSOR_WORKSPACE'],
        processNames: ['cursor', 'cursor.exe'],
        indicators: ['cursor-ide', 'cursor-editor']
      },
      claude: {
        envVars: [
          'CLAUDE_SESSION_ID',
          'CLAUDE_CODE_SESSION',
          'ANTHROPIC_API_KEY'
        ],
        processNames: ['claude-code', 'claude'],
        indicators: ['claude-code', 'anthropic']
      },
      github_copilot: {
        envVars: ['GITHUB_COPILOT_TOKEN', 'COPILOT_SESSION'],
        processNames: ['copilot'],
        indicators: ['github-copilot', 'copilot']
      },
      // Add more agents as needed
      generic_ai: {
        envVars: ['AI_AGENT_ID', 'AI_SESSION_ID'],
        processNames: [],
        indicators: ['ai-agent', 'artificial-intelligence']
      }
    };
  }

  /**
   * Detect the current active agent based on environment and process analysis
   * @returns {Object} Detection result with agent type and confidence
   */
  async detectAgent() {
    const results = {
      detected: false,
      agent: null,
      confidence: 0,
      evidence: [],
      timestamp: new Date().toISOString(),
      context: await this.gatherContext()
    };

    // Check each agent type
    for (const [agentType, rules] of Object.entries(this.detectionRules)) {
      const detection = await this.checkAgentType(agentType, rules);

      if (detection.confidence > results.confidence) {
        results.detected = detection.confidence > 0.5;
        results.agent = agentType;
        results.confidence = detection.confidence;
        results.evidence = detection.evidence;
      }
    }

    // Fallback: Check for generic AI indicators
    if (!results.detected) {
      const genericDetection = await this.detectGenericAI();
      if (genericDetection.confidence > 0.3) {
        results.detected = true;
        results.agent = 'unknown_ai';
        results.confidence = genericDetection.confidence;
        results.evidence = genericDetection.evidence;
      }
    }

    return results;
  }

  /**
   * Check if a specific agent type is active
   * @param {string} agentType - The agent type to check
   * @param {Object} rules - Detection rules for this agent
   * @returns {Object} Detection result
   */
  async checkAgentType(_agentType, rules) {
    const result = {
      confidence: 0,
      evidence: []
    };

    // Check environment variables
    for (const envVar of rules.envVars) {
      if (process.env[envVar]) {
        result.confidence += 0.4;
        result.evidence.push(`Environment variable ${envVar} detected`);
      }
    }

    // Check running processes
    try {
      const processes = await this.getRunningProcesses();
      for (const processName of rules.processNames) {
        if (
          processes.some((p) =>
            p.toLowerCase().includes(processName.toLowerCase())
          )
        ) {
          result.confidence += 0.3;
          result.evidence.push(`Process ${processName} detected`);
        }
      }
    } catch (_error) {
      // Process detection failed, continue without it
    }

    // Check for indirect indicators
    for (const indicator of rules.indicators) {
      if (await this.checkIndicator(indicator)) {
        result.confidence += 0.2;
        result.evidence.push(`Indicator ${indicator} detected`);
      }
    }

    // Cap confidence at 1.0
    result.confidence = Math.min(result.confidence, 1.0);

    return result;
  }

  /**
   * Get list of running processes (cross-platform)
   * @returns {Array} List of process names
   */
  async getRunningProcesses() {
    try {
      let command;
      if (process.platform === 'win32') {
        command = 'tasklist /FO CSV /NH';
      } else {
        command = 'ps aux';
      }

      const output = execSync(command, { encoding: 'utf8', timeout: 5000 });
      return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Check for generic AI indicators
   * @returns {Object} Detection result
   */
  async detectGenericAI() {
    const result = {
      confidence: 0,
      evidence: []
    };

    // Check for AI-related environment variables
    const aiEnvVars = Object.keys(process.env).filter(
      (key) =>
        key.toLowerCase().includes('ai') ||
        key.toLowerCase().includes('agent') ||
        key.toLowerCase().includes('bot')
    );

    if (aiEnvVars.length > 0) {
      result.confidence += 0.2;
      result.evidence.push(
        `AI-related environment variables: ${aiEnvVars.join(', ')}`
      );
    }

    return result;
  }

  /**
   * Check for specific indicator presence
   * @param {string} indicator - Indicator to check for
   * @returns {boolean} Whether indicator was found
   */
  async checkIndicator(indicator) {
    // Check in current working directory for indicator files/folders
    try {
      const cwd = process.cwd();
      const items = await fs.readdir(cwd);
      return items.some((item) =>
        item.toLowerCase().includes(indicator.toLowerCase())
      );
    } catch (_error) {
      return false;
    }
  }

  /**
   * Gather additional context for agent attribution
   * @returns {Object} Context information
   */
  async gatherContext() {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      workingDirectory: process.cwd(),
      timestamp: Date.now(),
      pid: process.pid,
      ppid: process.ppid
    };
  }
}

class CommitAttributor {
  constructor() {
    this.detector = new AgentDetector();
    this.auditTrail = [];
  }

  /**
   * Generate commit message with agent attribution
   * @param {string} originalMessage - Original commit message
   * @param {Object} options - Attribution options
   * @returns {string} Enhanced commit message with agent attribution
   */
  async generateAttributedCommitMessage(originalMessage, options = {}) {
    const detection = await this.detector.detectAgent();

    let attributedMessage = originalMessage;

    if (detection.detected) {
      const agentTag = this.formatAgentTag(
        detection.agent,
        detection.confidence
      );

      // Add agent tag to commit message
      if (!originalMessage.includes('[') || !originalMessage.includes(']')) {
        attributedMessage = `${agentTag} ${originalMessage}`;
      } else {
        // Insert agent tag after existing tags
        attributedMessage = originalMessage.replace(
          /^(\[.*?\]\s*)/,
          `$1${agentTag} `
        );
      }

      // Add detailed attribution in commit footer if requested
      if (options.detailed) {
        attributedMessage += `\n\nAgent-Attribution-Details:\n`;
        attributedMessage += `Agent: ${detection.agent}\n`;
        attributedMessage += `Confidence: ${(detection.confidence * 100).toFixed(1)}%\n`;
        attributedMessage += `Evidence: ${detection.evidence.join('; ')}\n`;
        attributedMessage += `Detection-Timestamp: ${detection.timestamp}\n`;
      }
    } else {
      // Mark as human-authored if no agent detected
      const humanTag = '[Human]';
      attributedMessage = `${humanTag} ${originalMessage}`;
    }

    // Record in audit trail
    await this.recordAuditTrail(detection, originalMessage, attributedMessage);

    return attributedMessage;
  }

  /**
   * Format agent tag for commit message
   * @param {string} agent - Agent type
   * @param {number} confidence - Detection confidence
   * @returns {string} Formatted agent tag
   */
  formatAgentTag(agent, confidence) {
    const agentNames = {
      cursor: 'Cursor',
      claude: 'Claude',
      github_copilot: 'GitHub-Copilot',
      unknown_ai: 'AI-Agent',
      generic_ai: 'AI'
    };

    const displayName = agentNames[agent] || agent;

    if (confidence < 0.7) {
      return `[${displayName}?]`; // Question mark for low confidence
    }

    return `[${displayName}]`;
  }

  /**
   * Record attribution in audit trail
   * @param {Object} detection - Detection result
   * @param {string} originalMessage - Original commit message
   * @param {string} attributedMessage - Final attributed message
   */
  async recordAuditTrail(detection, originalMessage, attributedMessage) {
    const record = {
      timestamp: new Date().toISOString(),
      detection: detection,
      originalMessage: originalMessage,
      attributedMessage: attributedMessage,
      repository: await this.getRepositoryInfo(),
      commit: await this.getCurrentCommitContext()
    };

    this.auditTrail.push(record);

    // Persist audit trail (optional, based on configuration)
    if (process.env.SUPERNAL_AUDIT_ENABLED === 'true') {
      await this.persistAuditRecord(record);
    }
  }

  /**
   * Get current repository information
   * @returns {Object} Repository information
   */
  async getRepositoryInfo() {
    try {
      const repoRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8'
      }).trim();
      const repoName = path.basename(repoRoot);
      const branch = execSync('git branch --show-current', {
        encoding: 'utf8'
      }).trim();

      return {
        name: repoName,
        path: repoRoot,
        branch: branch
      };
    } catch (_error) {
      return { error: 'Not a git repository or git not available' };
    }
  }

  /**
   * Get current commit context
   * @returns {Object} Commit context information
   */
  async getCurrentCommitContext() {
    try {
      return {
        author: execSync('git config user.name', { encoding: 'utf8' }).trim(),
        email: execSync('git config user.email', { encoding: 'utf8' }).trim(),
        branch: execSync('git branch --show-current', {
          encoding: 'utf8'
        }).trim()
      };
    } catch (_error) {
      return { error: 'Unable to get commit context' };
    }
  }

  /**
   * Persist audit record to storage
   * @param {Object} record - Audit record to persist
   */
  async persistAuditRecord(record) {
    try {
      const auditDir = path.join(process.cwd(), '.supernal', 'audit');
      await fs.mkdir(auditDir, { recursive: true });

      const filename = `agent-attribution-${Date.now()}.json`;
      const filepath = path.join(auditDir, filename);

      await fs.writeFile(filepath, JSON.stringify(record, null, 2));
    } catch (error) {
      console.warn('Failed to persist audit record:', error.message);
    }
  }
}

// CLI Interface
async function main() {
  const attributor = new CommitAttributor();
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'detect': {
      const detection = await attributor.detector.detectAgent();
      console.log(JSON.stringify(detection, null, 2));
      break;
    }

    case 'attribute': {
      const message = args.join(' ') || 'Default commit message';
      const attributed = await attributor.generateAttributedCommitMessage(
        message,
        { detailed: true }
      );
      console.log(attributed);
      break;
    }

    case 'test': {
      console.log('Testing agent detection...');
      const testDetection = await attributor.detector.detectAgent();
      console.log('Detection result:', testDetection);

      const testMessage = await attributor.generateAttributedCommitMessage(
        'Test commit message'
      );
      console.log('Attributed message:', testMessage);
      break;
    }

    default:
      console.log(`
Agent Attribution System - REQ-039 Implementation

Usage:
  node agent-attribution.js detect              # Detect current agent
  node agent-attribution.js attribute <message> # Generate attributed commit message
  node agent-attribution.js test                # Test the system

Examples:
  node agent-attribution.js detect
  node agent-attribution.js attribute "Fix bug in validation system"
  node agent-attribution.js test
        `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AgentDetector, CommitAttributor };
