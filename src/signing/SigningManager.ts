/**
 * SigningManager - Central signing logic for SC commits
 *
 * Manages GPG signing for agent commits, distinguishing them from human commits.
 * Part of REQ-INFRA-111: Agent Commit Signing
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'os';
import yaml from 'yaml';

/** Agent entry in registry */
export interface AgentEntry {
  id: string;
  host: string;
  gpg_key_id: string;
  email: string;
  created: string;
  last_used?: string;
  commit_count?: number;
}

/** Agent registry structure */
export interface AgentRegistry {
  agents?: AgentEntry[];
  [key: string]: unknown;
}

/** Agent commits config */
export interface AgentCommitsConfig {
  sign: boolean;
  keySource: string;
  gpgKeyId: string | null;
}

/** Human commits config */
export interface HumanCommitsConfig {
  requireSignature: boolean;
}

/** Signing configuration */
export interface SigningConfig {
  enabled: boolean;
  agentCommits: AgentCommitsConfig;
  humanCommits: HumanCommitsConfig;
  agentRegistry: string;
}

/** Options for signing flags */
export interface SigningFlagsOptions {
  isAgentCommit?: boolean;
}

/** Raw configuration */
interface RawConfig {
  git?: {
    signing?: {
      enabled?: boolean;
      agent_commits?: {
        sign?: boolean;
        key_source?: string;
        gpg_key_id?: string;
      };
      human_commits?: {
        require_signature?: boolean;
      };
      agent_registry?: string;
    };
  };
  [key: string]: unknown;
}

class SigningManager {
  protected agentRegistry: AgentRegistry | null;
  protected config: RawConfig | null;
  protected projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.config = null;
    this.agentRegistry = null;
  }

  /**
   * Load configuration from supernal.yaml
   */
  loadConfig(): RawConfig {
    if (this.config) return this.config;

    const configPaths = [
      path.join(this.projectRoot, 'supernal.yaml'),
      path.join(this.projectRoot, 'supernal.yml'),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf8');
          this.config = yaml.parse(content) || {};
          return this.config;
        } catch (error) {
          console.warn(`Warning: Could not parse ${configPath}: ${(error as Error).message}`);
        }
      }
    }

    this.config = {};
    return this.config;
  }

  /**
   * Get signing configuration
   * @returns Signing config with defaults
   */
  getSigningConfig(): SigningConfig {
    const config = this.loadConfig();
    return {
      enabled: config.git?.signing?.enabled ?? false,
      agentCommits: {
        sign: config.git?.signing?.agent_commits?.sign ?? true,
        keySource: config.git?.signing?.agent_commits?.key_source ?? 'registry',
        gpgKeyId: config.git?.signing?.agent_commits?.gpg_key_id ?? null,
      },
      humanCommits: {
        requireSignature: config.git?.signing?.human_commits?.require_signature ?? false,
      },
      agentRegistry: config.git?.signing?.agent_registry ?? '.supernal/config/agents.yaml',
    };
  }

  /**
   * Get signing flags for git commit command
   * @param options
   * @returns Git signing flags to add to commit command
   */
  getSigningFlags(options: SigningFlagsOptions = {}): string {
    const signingConfig = this.getSigningConfig();

    // If signing not enabled, return empty (let git config decide)
    if (!signingConfig.enabled) {
      return '';
    }

    if (options.isAgentCommit) {
      return this.getAgentSigningFlags(signingConfig);
    }

    return this.getHumanSigningFlags(signingConfig);
  }

  /**
   * Get signing flags for agent (SC) commits
   * @param signingConfig
   * @returns Git flags
   */
  getAgentSigningFlags(signingConfig: SigningConfig): string {
    if (!signingConfig.agentCommits.sign) {
      // Explicitly don't sign agent commits
      return '--no-gpg-sign';
    }

    const keyId = this.getAgentKeyId(signingConfig);

    if (!keyId) {
      // No agent key available - don't sign but warn
      console.warn(
        'Warning: Agent signing enabled but no key configured. Commit will be unsigned.'
      );
      return '--no-gpg-sign';
    }

    // Sign with the agent's specific key
    return `-S --gpg-sign=${keyId}`;
  }

  /**
   * Get signing flags for human (manual) commits
   * @param signingConfig
   * @returns Git flags
   */
  getHumanSigningFlags(signingConfig: SigningConfig): string {
    if (signingConfig.humanCommits.requireSignature) {
      // Force signing with user's default key
      return '-S';
    }

    // Let git config decide
    return '';
  }

  /**
   * Get the agent's GPG key ID from various sources
   * Priority: environment > registry > static config
   * @param signingConfig
   * @returns Key ID or null if not found
   */
  getAgentKeyId(signingConfig: SigningConfig): string | null {
    // 1. Check environment variable first
    if (process.env.SC_AGENT_GPG_KEY) {
      return process.env.SC_AGENT_GPG_KEY;
    }

    // 2. Check registry file
    if (signingConfig.agentCommits.keySource === 'registry') {
      const registryKey = this.getKeyFromRegistry(signingConfig.agentRegistry);
      if (registryKey) {
        return registryKey;
      }
    }

    // 3. Fall back to static config
    return signingConfig.agentCommits.gpgKeyId;
  }

  /**
   * Load agent registry and find key for current host
   * @param registryPath - Relative path to registry file
   * @returns Key ID or null
   */
  getKeyFromRegistry(registryPath: string): string | null {
    const fullPath = path.join(this.projectRoot, registryPath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const registry: AgentRegistry = yaml.parse(content);
      this.agentRegistry = registry;

      const hostname = os.hostname();

      // Find agent for current host
      const agent = registry.agents?.find(
        (a) => a.host === hostname || a.host === hostname.split('.')[0]
      );

      return agent?.gpg_key_id || null;
    } catch (error) {
      console.warn(`Warning: Could not read agent registry: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Get the loaded agent registry
   * @returns Registry data
   */
  getAgentRegistry(): AgentRegistry | null {
    if (!this.agentRegistry) {
      const signingConfig = this.getSigningConfig();
      this.getKeyFromRegistry(signingConfig.agentRegistry);
    }
    return this.agentRegistry;
  }

  /**
   * Check if agent signing is enabled and configured
   */
  isAgentSigningEnabled(): boolean {
    const signingConfig = this.getSigningConfig();
    return signingConfig.enabled && signingConfig.agentCommits.sign;
  }

  /**
   * Check if an agent key is available for the current host
   */
  hasAgentKey(): boolean {
    const signingConfig = this.getSigningConfig();
    return !!this.getAgentKeyId(signingConfig);
  }

  /**
   * Get information about the current agent (if registered)
   * @returns Agent info or null
   */
  getCurrentAgent(): AgentEntry | null {
    const registry = this.getAgentRegistry();
    if (!registry?.agents) return null;

    const hostname = os.hostname();
    return registry.agents.find(
      (a) => a.host === hostname || a.host === hostname.split('.')[0]
    ) || null;
  }
}

export default SigningManager;
module.exports = SigningManager;
