/**
 * File-based Credential Storage
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { encrypt, decrypt } from '../encryption';

const SUPERNAL_DIR = path.join(os.homedir(), '.supernal');
const CREDENTIALS_DIR = path.join(SUPERNAL_DIR, 'credentials');
const AUDIT_DIR = path.join(SUPERNAL_DIR, 'audit');

interface Credentials {
  [key: string]: unknown;
}

interface StoreOptions {
  passphrase?: string;
  metadata?: Record<string, unknown>;
}

interface RetrieveOptions {
  passphrase?: string;
}

interface GetAuditLogOptions {
  limit?: number;
  service?: string;
}

interface AuditEntry {
  timestamp: string;
  operation: string;
  service: string;
  pid: number;
  user: string;
  [key: string]: unknown;
}

interface StoredPayload {
  service: string;
  credentials: Credentials;
  storedAt: string;
  metadata: Record<string, unknown>;
}

async function initialize(): Promise<void> {
  await fs.mkdir(SUPERNAL_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(AUDIT_DIR, { recursive: true, mode: 0o700 });
}

function getStoragePath(service: string): string {
  const sanitized = service.replace(/[^a-zA-Z0-9-_]/g, '-');
  return path.join(CREDENTIALS_DIR, `${sanitized}.enc`);
}

async function logAuditEntry(operation: string, service: string, details: Record<string, unknown> = {}): Promise<void> {
  await initialize();

  const logPath = path.join(AUDIT_DIR, 'access.log');

  const entry: AuditEntry = {
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

async function store(service: string, credentials: Credentials, options: StoreOptions = {}): Promise<{ success: boolean; path: string }> {
  await initialize();

  const storagePath = getStoragePath(service);

  const payload: StoredPayload = {
    service,
    credentials,
    storedAt: new Date().toISOString(),
    metadata: options.metadata || {}
  };

  const encrypted = await encrypt(payload, options.passphrase);
  await fs.writeFile(storagePath, encrypted as string, { mode: 0o600 });

  await logAuditEntry('store', service, {
    action: 'credentials_stored',
    metadata: options.metadata
  });

  return { success: true, path: storagePath };
}

async function retrieve(service: string, options: RetrieveOptions = {}): Promise<Credentials | null> {
  const storagePath = getStoragePath(service);

  try {
    const encrypted = await fs.readFile(storagePath, 'utf-8');
    const payload = await decrypt(encrypted, options.passphrase) as StoredPayload;

    await logAuditEntry('retrieve', service, { action: 'credentials_accessed' });

    return payload.credentials;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function exists(service: string): Promise<boolean> {
  const storagePath = getStoragePath(service);
  try {
    await fs.access(storagePath);
    return true;
  } catch {
    return false;
  }
}

async function remove(service: string): Promise<{ success: boolean; reason?: string }> {
  const storagePath = getStoragePath(service);

  try {
    await fs.unlink(storagePath);

    await logAuditEntry('remove', service, { action: 'credentials_deleted' });

    return { success: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: false, reason: 'not_found' };
    }
    throw error;
  }
}

async function list(): Promise<string[]> {
  await initialize();

  try {
    const files = await fs.readdir(CREDENTIALS_DIR);
    return files
      .filter((f) => f.endsWith('.enc'))
      .map((f) => f.replace('.enc', ''));
  } catch {
    return [];
  }
}

async function update(service: string, updates: Credentials, options: StoreOptions = {}): Promise<Credentials> {
  const current = await retrieve(service, options);
  if (!current) {
    throw new Error(`No credentials found for service: ${service}`);
  }

  const merged = { ...current, ...updates };
  await store(service, merged, options);

  await logAuditEntry('update', service, {
    action: 'credentials_updated',
    fields: Object.keys(updates)
  });

  return merged;
}

async function getAuditLog(options: GetAuditLogOptions = {}): Promise<AuditEntry[]> {
  const logPath = path.join(AUDIT_DIR, 'access.log');
  const { limit = 100, service } = options;

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    let entries: AuditEntry[] = content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    if (service) {
      entries = entries.filter((e) => e.service === service);
    }

    return entries.reverse().slice(0, limit);
  } catch {
    return [];
  }
}

export {
  initialize,
  store,
  retrieve,
  exists,
  remove,
  list,
  update,
  getAuditLog,
  SUPERNAL_DIR,
  CREDENTIALS_DIR,
  AUDIT_DIR
};

module.exports = {
  initialize,
  store,
  retrieve,
  exists,
  remove,
  list,
  update,
  getAuditLog,
  SUPERNAL_DIR,
  CREDENTIALS_DIR,
  AUDIT_DIR
};
