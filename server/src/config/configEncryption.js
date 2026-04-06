import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const CONFIG_VERSION = 1;

let _masterKey = null;

/**
 * Resolve the master key from env var, file, or auto-generate.
 * Priority: MASTER_KEY env var > file at MASTER_KEY_PATH > auto-generate.
 */
export function ensureMasterKey() {
  if (_masterKey) return _masterKey;

  const envKey = process.env.MASTER_KEY;
  if (envKey && /^[0-9a-f]{64}$/i.test(envKey)) {
    _masterKey = Buffer.from(envKey, 'hex');
    return _masterKey;
  }

  const keyPath = getMasterKeyPath();
  if (fs.existsSync(keyPath)) {
    const hex = fs.readFileSync(keyPath, 'utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      _masterKey = Buffer.from(hex, 'hex');
      return _masterKey;
    }
  }

  // Auto-generate
  _masterKey = crypto.randomBytes(32);
  const dir = path.dirname(keyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(keyPath, _masterKey.toString('hex'), { mode: 0o600 });
  console.log(`[config] Master key auto-generated at ${keyPath}`);
  return _masterKey;
}

export function getMasterKeyHex() {
  return ensureMasterKey().toString('hex');
}

export function verifyMasterKey(candidateHex) {
  const current = ensureMasterKey().toString('hex');
  return candidateHex === current;
}

export function getMasterKeyPath() {
  return process.env.MASTER_KEY_PATH || path.resolve(process.cwd(), 'data', '.master-key');
}

export function getConfigFilePath() {
  return process.env.CONFIG_PATH || path.resolve(process.cwd(), 'data', 'config.json');
}

export function encryptConfig(plainObj) {
  const key = ensureMasterKey();
  const plaintext = JSON.stringify(plainObj);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: CONFIG_VERSION,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted.toString('base64'),
    updatedAt: new Date().toISOString(),
  };
}

export function decryptConfig(envelope) {
  if (envelope.version !== CONFIG_VERSION) {
    throw new Error(`Unsupported config version: ${envelope.version}`);
  }
  const key = ensureMasterKey();
  const iv = Buffer.from(envelope.iv, 'hex');
  const authTag = Buffer.from(envelope.authTag, 'hex');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

export function saveConfigFile(plainObj) {
  const filePath = getConfigFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const envelope = encryptConfig(plainObj);
  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), { mode: 0o600 });
}

export function loadConfigFile() {
  const filePath = getConfigFilePath();
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const envelope = JSON.parse(raw);
  return decryptConfig(envelope);
}

export function configFileExists() {
  return fs.existsSync(getConfigFilePath());
}
