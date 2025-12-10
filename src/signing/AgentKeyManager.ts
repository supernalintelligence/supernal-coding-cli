/**
 * AgentKeyManager - GPG key generation and management for SC agents
 *
 * Handles non-interactive GPG key generation for AI agents.
 * Part of REQ-INFRA-111: Agent Commit Signing
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'os';
import yaml from 'yaml';

const AGENT_EMAIL_DOMAIN = 'supernal.local';

/** GPG check result */
export interface GpgCheckResult {
  installed: boolean;
  version: string | null;
  error: string | null;
}

/** Agent ID options */
export interface AgentIdOptions {
  agentId?: string;
}

/** Key generation options */
export interface GenerateKeyOptions extends AgentIdOptions {
  force?: boolean;
}

/** Key generation result */
export interface GenerateKeyResult {
  success: boolean;
  agentId?: string;
  email?: string;
  name?: string;
  gpgKeyId?: string;
  host?: string;
  created?: string;
  existing?: boolean;
  error?: string;
}

/** Verification result */
export interface VerificationResult {
  valid: boolean;
  error: string | null;
}

/** Registration result */
export interface RegistrationResult {
  success: boolean;
  registryPath?: string;
  error?: string;
}

/** Agent entry */
export interface AgentEntry {
  id: string;
  name: string;
  email: string;
  gpg_key_id: string;
  host: string;
  created: string;
  last_used: string | null;
  commit_count: number;
  updated?: string;
}

/** Agent registry */
interface AgentRegistry {
  version: number;
  agents: AgentEntry[];
}

/** Delete key result */
export interface DeleteKeyResult {
  success: boolean;
  error?: string;
}

class AgentKeyManager {
  protected projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Check if GPG is installed and available
   */
  checkGpgInstalled(): GpgCheckResult {
    try {
      const version = execSync('gpg --version', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const versionMatch = version.match(/gpg \(GnuPG\) (\d+\.\d+\.\d+)/);
      return {
        installed: true,
        version: versionMatch ? versionMatch[1] : 'unknown',
        error: null,
      };
    } catch (_error) {
      return {
        installed: false,
        version: null,
        error: this.getGpgInstallInstructions(),
      };
    }
  }

  /**
   * Get GPG installation instructions for the current OS
   */
  getGpgInstallInstructions(): string {
    const platform = os.platform();
    switch (platform) {
      case 'darwin':
        return `GPG not found. Install with:
  brew install gnupg pinentry-mac
  echo "pinentry-program $(brew --prefix)/bin/pinentry-mac" >> ~/.gnupg/gpg-agent.conf
  gpgconf --kill gpg-agent`;
      case 'linux':
        return `GPG not found. Install with:
  Ubuntu/Debian: sudo apt-get install gnupg
  Fedora/RHEL: sudo dnf install gnupg2`;
      case 'win32':
        return `GPG not found. Install Gpg4win from: https://www.gpg4win.org/`;
      default:
        return `GPG not found. Please install GnuPG for your operating system.`;
    }
  }

  /**
   * Generate a unique agent ID based on context
   */
  generateAgentId(options: AgentIdOptions = {}): string {
    if (options.agentId) {
      return options.agentId;
    }

    // Generate based on hostname and timestamp
    const hostname = os.hostname().split('.')[0].toLowerCase();
    const timestamp = Date.now().toString(36).slice(-4);
    return `cursor-${hostname}-${timestamp}`;
  }

  /**
   * Generate agent email from agent ID
   */
  generateAgentEmail(agentId: string): string {
    return `sc-${agentId}@${AGENT_EMAIL_DOMAIN}`;
  }

  /**
   * Generate a new GPG key for an agent (non-interactive)
   */
  async generateAgentKey(options: GenerateKeyOptions = {}): Promise<GenerateKeyResult> {
    // Check GPG is installed
    const gpgCheck = this.checkGpgInstalled();
    if (!gpgCheck.installed) {
      return {
        success: false,
        error: gpgCheck.error || 'GPG not installed',
      };
    }

    const agentId = this.generateAgentId(options);
    const agentEmail = this.generateAgentEmail(agentId);
    const agentName = `SC Agent (${agentId})`;

    // Check if key already exists
    if (!options.force) {
      const existingKey = this.findKeyByEmail(agentEmail);
      if (existingKey) {
        return {
          success: true,
          agentId,
          email: agentEmail,
          name: agentName,
          gpgKeyId: existingKey,
          host: os.hostname(),
          existing: true,
        };
      }
    }

    // Generate key params file (non-interactive, no passphrase)
    const keyParams = `%no-protection
Key-Type: RSA
Key-Length: 4096
Name-Real: ${agentName}
Name-Email: ${agentEmail}
Expire-Date: 0
%commit`;

    const paramsFile = path.join(os.tmpdir(), `sc-key-params-${Date.now()}`);

    try {
      // Write params file
      fs.writeFileSync(paramsFile, keyParams);

      // Generate the key
      execSync(`gpg --batch --generate-key "${paramsFile}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Get the key ID
      const gpgKeyId = this.findKeyByEmail(agentEmail);

      if (!gpgKeyId) {
        return {
          success: false,
          error: 'Key generation completed but could not find key ID',
        };
      }

      return {
        success: true,
        agentId,
        email: agentEmail,
        name: agentName,
        gpgKeyId,
        host: os.hostname(),
        created: new Date().toISOString(),
        existing: false,
      };
    } catch (error) {
      return {
        success: false,
        error: `Key generation failed: ${(error as Error).message}`,
      };
    } finally {
      // Clean up params file
      try {
        if (fs.existsSync(paramsFile)) {
          fs.unlinkSync(paramsFile);
        }
      } catch (_e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Find GPG key ID by email address
   */
  findKeyByEmail(email: string): string | null {
    try {
      const output = execSync(`gpg --list-keys --keyid-format=long "${email}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Parse key ID from output
      // Format: sec   rsa4096/ABCD1234EF567890 2025-12-08 [SC]
      const keyMatch = output.match(/(?:sec|pub)\s+(?:rsa\d+|ed\d+)\/([A-F0-9]+)/i);
      return keyMatch ? keyMatch[1] : null;
    } catch (_error) {
      // Key not found
      return null;
    }
  }

  /**
   * Verify an agent key can sign
   */
  verifyKeyCanSign(gpgKeyId: string): VerificationResult {
    try {
      // Create a temporary file to sign
      const testFile = path.join(os.tmpdir(), `sc-test-sign-${Date.now()}`);
      fs.writeFileSync(testFile, 'test');

      try {
        // Try to create a detached signature
        execSync(
          `gpg --batch --yes --local-user ${gpgKeyId} --detach-sign "${testFile}"`,
          {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );

        // Clean up signature file
        const sigFile = `${testFile}.sig`;
        if (fs.existsSync(sigFile)) {
          fs.unlinkSync(sigFile);
        }

        return { valid: true, error: null };
      } finally {
        // Clean up test file
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: `Key cannot sign: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Register an agent in the project's agent registry
   */
  registerAgent(agentInfo: GenerateKeyResult): RegistrationResult {
    const registryDir = path.join(this.projectRoot, '.supernal', 'config');
    const registryPath = path.join(registryDir, 'agents.yaml');

    try {
      // Ensure directory exists
      if (!fs.existsSync(registryDir)) {
        fs.mkdirSync(registryDir, { recursive: true });
      }

      // Load existing registry or create new
      let registry: AgentRegistry = { version: 1, agents: [] };
      if (fs.existsSync(registryPath)) {
        const content = fs.readFileSync(registryPath, 'utf8');
        registry = yaml.parse(content) || { version: 1, agents: [] };
      }

      // Check if agent already registered (by host or id)
      const existingIndex = registry.agents?.findIndex(
        (a) => a.host === agentInfo.host || a.id === agentInfo.agentId
      );

      const agentEntry: AgentEntry = {
        id: agentInfo.agentId!,
        name: agentInfo.name!,
        email: agentInfo.email!,
        gpg_key_id: agentInfo.gpgKeyId!,
        host: agentInfo.host!,
        created: agentInfo.created || new Date().toISOString(),
        last_used: null,
        commit_count: 0,
      };

      if (existingIndex !== undefined && existingIndex >= 0) {
        // Update existing entry
        registry.agents[existingIndex] = {
          ...registry.agents[existingIndex],
          ...agentEntry,
          updated: new Date().toISOString(),
        };
      } else {
        // Add new entry
        registry.agents = registry.agents || [];
        registry.agents.push(agentEntry);
      }

      // Write registry
      const yamlContent = yaml.stringify(registry, { indent: 2 });
      fs.writeFileSync(registryPath, yamlContent);

      return { success: true, registryPath };
    } catch (error) {
      return {
        success: false,
        error: `Failed to register agent: ${(error as Error).message}`,
      };
    }
  }

  /**
   * List all registered agents
   */
  listAgents(): AgentEntry[] {
    const registryPath = path.join(
      this.projectRoot,
      '.supernal',
      'config',
      'agents.yaml'
    );

    if (!fs.existsSync(registryPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(registryPath, 'utf8');
      const registry: AgentRegistry = yaml.parse(content);
      return registry.agents || [];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get agent for current host
   */
  getCurrentHostAgent(): AgentEntry | null {
    const agents = this.listAgents();
    const hostname = os.hostname();
    return agents.find(
      (a) => a.host === hostname || a.host === hostname.split('.')[0]
    ) || null;
  }

  /**
   * Delete an agent key from GPG keyring
   */
  deleteKey(gpgKeyId: string): DeleteKeyResult {
    try {
      // Delete secret key first
      execSync(
        `gpg --batch --yes --delete-secret-keys ${gpgKeyId}`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      // Delete public key
      execSync(
        `gpg --batch --yes --delete-keys ${gpgKeyId}`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete key: ${(error as Error).message}`,
      };
    }
  }
}

export default AgentKeyManager;
module.exports = AgentKeyManager;
