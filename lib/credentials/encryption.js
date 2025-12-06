/**
 * Credential Encryption Module
 * 
 * Provides AES-256-GCM encryption for credential storage.
 * Keys are derived from machine-specific entropy + user passphrase.
 */

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

/**
 * Get or create the machine-specific encryption key
 * Stored in ~/.supernal/keys/credential-key with mode 600
 */
async function getOrCreateMachineKey() {
  const keyDir = path.join(os.homedir(), '.supernal', 'keys');
  const keyPath = path.join(keyDir, 'credential-key');
  
  try {
    // Try to read existing key
    const existingKey = await fs.readFile(keyPath, 'utf-8');
    return Buffer.from(existingKey.trim(), 'hex');
  } catch {
    // Key doesn't exist, create new one
    await fs.mkdir(keyDir, { recursive: true, mode: 0o700 });
    
    // Generate random key material
    const keyMaterial = crypto.randomBytes(KEY_LENGTH);
    
    // Write key file with restricted permissions
    await fs.writeFile(keyPath, keyMaterial.toString('hex'), { mode: 0o600 });
    
    return keyMaterial;
  }
}

/**
 * Derive encryption key from machine key + optional passphrase
 */
async function deriveKey(passphrase = '', salt) {
  const machineKey = await getOrCreateMachineKey();
  
  // Combine machine key with passphrase for key derivation
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

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param {Object|string} data - Data to encrypt
 * @param {string} passphrase - Optional additional passphrase
 * @returns {string} Base64-encoded encrypted payload
 */
async function encrypt(data, passphrase = '') {
  // Serialize data
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive encryption key
  const key = await deriveKey(passphrase, salt);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  
  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final()
  ]);
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  // Combine: salt + iv + authTag + encrypted
  const payload = Buffer.concat([salt, iv, authTag, encrypted]);
  
  return payload.toString('base64');
}

/**
 * Decrypt data encrypted with encrypt()
 * 
 * @param {string} encryptedPayload - Base64-encoded encrypted data
 * @param {string} passphrase - Optional passphrase used during encryption
 * @returns {Object} Decrypted data
 */
async function decrypt(encryptedPayload, passphrase = '') {
  // Decode payload
  const payload = Buffer.from(encryptedPayload, 'base64');
  
  // Extract components
  let offset = 0;
  
  const salt = payload.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;
  
  const iv = payload.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  
  const authTag = payload.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;
  
  const encrypted = payload.subarray(offset);
  
  // Derive decryption key
  const key = await deriveKey(passphrase, salt);
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(authTag);
  
  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  // Parse JSON
  const plaintext = decrypted.toString('utf-8');
  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
}

/**
 * Generate a random encryption key (for key rotation)
 */
function generateKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Verify that the encryption system is working
 */
async function verifyEncryption() {
  const testData = { test: 'verification', timestamp: Date.now() };
  const encrypted = await encrypt(testData);
  const decrypted = await decrypt(encrypted);
  
  return (
    decrypted.test === testData.test &&
    decrypted.timestamp === testData.timestamp
  );
}

module.exports = {
  encrypt,
  decrypt,
  generateKey,
  verifyEncryption,
  getOrCreateMachineKey,
  // Constants for testing
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  SALT_LENGTH
};

