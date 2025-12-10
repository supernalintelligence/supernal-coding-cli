/**
 * Credential Encryption Module
 *
 * Provides AES-256-GCM encryption for credential storage.
 * Keys are derived from machine-specific entropy + user passphrase.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

async function getOrCreateMachineKey(): Promise<Buffer> {
  const keyDir = path.join(os.homedir(), '.supernal', 'keys');
  const keyPath = path.join(keyDir, 'credential-key');

  try {
    const existingKey = await fs.readFile(keyPath, 'utf-8');
    return Buffer.from(existingKey.trim(), 'hex');
  } catch {
    await fs.mkdir(keyDir, { recursive: true, mode: 0o700 });

    const keyMaterial = crypto.randomBytes(KEY_LENGTH);

    await fs.writeFile(keyPath, keyMaterial.toString('hex'), { mode: 0o600 });

    return keyMaterial;
  }
}

async function deriveKey(passphrase: string = '', salt: Buffer): Promise<Buffer> {
  const machineKey = await getOrCreateMachineKey();

  const combinedSecret = Buffer.concat([
    machineKey,
    Buffer.from(passphrase, 'utf-8')
  ]);

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      combinedSecret,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256',
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
}

async function encrypt(data: unknown, passphrase: string = ''): Promise<string> {
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const key = await deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([salt, iv, authTag, encrypted]);

  return payload.toString('base64');
}

async function decrypt(encryptedPayload: string, passphrase: string = ''): Promise<unknown> {
  const payload = Buffer.from(encryptedPayload, 'base64');

  let offset = 0;

  const salt = payload.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = payload.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const authTag = payload.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;

  const encrypted = payload.subarray(offset);

  const key = await deriveKey(passphrase, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  const plaintext = decrypted.toString('utf-8');
  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
}

function generateKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

async function verifyEncryption(): Promise<boolean> {
  const testData = { test: 'verification', timestamp: Date.now() };
  const encrypted = await encrypt(testData);
  const decrypted = await decrypt(encrypted) as { test: string; timestamp: number };

  return (
    decrypted.test === testData.test &&
    decrypted.timestamp === testData.timestamp
  );
}

export {
  encrypt,
  decrypt,
  generateKey,
  verifyEncryption,
  getOrCreateMachineKey,
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  SALT_LENGTH
};

module.exports = {
  encrypt,
  decrypt,
  generateKey,
  verifyEncryption,
  getOrCreateMachineKey,
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  SALT_LENGTH
};
