// @ts-nocheck
/**
 * File-based Credential Storage
 * 
 * Stores encrypted credentials in ~/.supernal/credentials/
 * Each service gets its own encrypted file.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { encrypt, decrypt } = require('../encryption');

// Storage paths
const SUPERNAL_DIR = path.join(os.homedir(), '.supernal');
const CREDENTIALS_DIR = path.join(SUPERNAL_DIR, 'credentials');
const AUDIT_DIR = path.join(SUPERNAL_DIR, 'audit');

/**
 * Initialize storage directories with proper permissions
 */
async function initialize() {
  // Create directories with restricted permissions
  await fs.mkdir(SUPERNAL_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(AUDIT_DIR, { recursive: true, mode: 0o700 });
}

/**
 * Get the storage path for a service
 */
function getStoragePath(service) {
  const sanitized = service.replace(/[^a-zA-Z0-9-_]/g, '-');
  return path.join(CREDENTIALS_DIR, `${sanitized}.enc`);
}

/**
 * Store credentials for a service
 * 
 * @param {string} service - Service identifier (e.g., 'google', 'github')
 * @param {Object} credentials - Credentials to store
 * @param {Object} options - Storage options
 */
async function store(service, credentials, options = {}) {
  await initialize();
  
  const storagePath = getStoragePath(service);
  
  // Add metadata
  const payload = {
    service,
    credentials,
    storedAt: new Date().toISOString(),
    metadata: options.metadata || {}
  };
  
  // Encrypt and store
  const encrypted = await encrypt(payload, options.passphrase);
  await fs.writeFile(storagePath, encrypted, { mode: 0o600 });
  
  // Log audit entry
  await logAuditEntry('store', service, { 
    action: 'credentials_stored',
    metadata: options.metadata 
  });
  
  return { success: true, path: storagePath };
}

/**
 * Retrieve credentials for a service
 * 
 * @param {string} service - Service identifier
 * @param {Object} options - Retrieval options
 * @returns {Object|null} Credentials or null if not found
 */
async function retrieve(service, options = {}) {
  const storagePath = getStoragePath(service);
  
  try {
    const encrypted = await fs.readFile(storagePath, 'utf-8');
    const payload = await decrypt(encrypted, options.passphrase);
    
    // Log audit entry
    await logAuditEntry('retrieve', service, { action: 'credentials_accessed' });
    
    return payload.credentials;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // Not found
    }
    throw error;
  }
}

/**
 * Check if credentials exist for a service
 */
async function exists(service) {
  const storagePath = getStoragePath(service);
  try {
    await fs.access(storagePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete credentials for a service
 */
async function remove(service) {
  const storagePath = getStoragePath(service);
  
  try {
    await fs.unlink(storagePath);
    
    // Log audit entry
    await logAuditEntry('remove', service, { action: 'credentials_deleted' });
    
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: false, reason: 'not_found' };
    }
    throw error;
  }
}

/**
 * List all stored services
 */
async function list() {
  await initialize();
  
  try {
    const files = await fs.readdir(CREDENTIALS_DIR);
    return files
      .filter(f => f.endsWith('.enc'))
      .map(f => f.replace('.enc', ''));
  } catch {
    return [];
  }
}

/**
 * Update specific fields in credentials
 */
async function update(service, updates, options = {}) {
  const current = await retrieve(service, options);
  if (!current) {
    throw new Error(`No credentials found for service: ${service}`);
  }
  
  const merged = { ...current, ...updates };
  await store(service, merged, options);
  
  // Log audit entry
  await logAuditEntry('update', service, { 
    action: 'credentials_updated',
    fields: Object.keys(updates)
  });
  
  return merged;
}

/**
 * Log an audit entry
 */
async function logAuditEntry(operation, service, details = {}) {
  await initialize();
  
  const logPath = path.join(AUDIT_DIR, 'access.log');
  
  const entry = {
    timestamp: new Date().toISOString(),
    operation,
    service,
    ...details,
    pid: process.pid,
    user: os.userInfo().username
  };
  
  const line = JSON.stringify(entry) + '\n';
  
  try {
    await fs.appendFile(logPath, line, { mode: 0o600 });
  } catch {
    // Audit logging should not fail the operation
  }
}

/**
 * Get audit log entries
 */
async function getAuditLog(options = {}) {
  const logPath = path.join(AUDIT_DIR, 'access.log');
  const { limit = 100, service } = options;
  
  try {
    const content = await fs.readFile(logPath, 'utf-8');
    let entries = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    if (service) {
      entries = entries.filter(e => e.service === service);
    }
    
    // Return most recent first
    return entries.reverse().slice(0, limit);
  } catch {
    return [];
  }
}

module.exports = {
  initialize,
  store,
  retrieve,
  exists,
  remove,
  list,
  update,
  getAuditLog,
  // Paths for testing
  SUPERNAL_DIR,
  CREDENTIALS_DIR,
  AUDIT_DIR
};

