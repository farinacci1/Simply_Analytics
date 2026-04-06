import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  encryptWithKey,
  decryptWithKey,
  encryptCredentials,
  decryptCredentials,
  parseKeyHex,
  clearKeyCache,
} from '../../server/src/utils/encryption.js';

const TEST_KEY = crypto.randomBytes(32);
const TEST_KEY_HEX = TEST_KEY.toString('hex');

describe('encryption utilities', () => {
  beforeEach(() => {
    clearKeyCache();
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY_HEX;
  });

  describe('encryptWithKey / decryptWithKey', () => {
    it('round-trips a simple string', () => {
      const original = 'hello world';
      const encrypted = encryptWithKey(original, TEST_KEY);
      const decrypted = decryptWithKey(encrypted, TEST_KEY);
      expect(decrypted).toBe(original);
    });

    it('round-trips unicode text', () => {
      const original = 'café ☕ naïve — привет 🎉';
      const encrypted = encryptWithKey(original, TEST_KEY);
      expect(decryptWithKey(encrypted, TEST_KEY)).toBe(original);
    });

    it('round-trips an empty string', () => {
      const encrypted = encryptWithKey('', TEST_KEY);
      expect(decryptWithKey(encrypted, TEST_KEY)).toBe('');
    });

    it('round-trips a long string', () => {
      const original = 'x'.repeat(100_000);
      const encrypted = encryptWithKey(original, TEST_KEY);
      expect(decryptWithKey(encrypted, TEST_KEY)).toBe(original);
    });

    it('produces base64-encoded output', () => {
      const encrypted = encryptWithKey('test', TEST_KEY);
      expect(typeof encrypted).toBe('string');
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });

    it('produces different ciphertext for the same plaintext (random IV)', () => {
      const a = encryptWithKey('same input', TEST_KEY);
      const b = encryptWithKey('same input', TEST_KEY);
      expect(a).not.toBe(b);
    });

    it('fails to decrypt with a different key', () => {
      const encrypted = encryptWithKey('secret', TEST_KEY);
      const wrongKey = crypto.randomBytes(32);
      expect(() => decryptWithKey(encrypted, wrongKey)).toThrow();
    });

    it('fails on tampered ciphertext', () => {
      const encrypted = encryptWithKey('secret', TEST_KEY);
      const buf = Buffer.from(encrypted, 'base64');
      buf[buf.length - 1] ^= 0xff;
      const tampered = buf.toString('base64');
      expect(() => decryptWithKey(tampered, TEST_KEY)).toThrow();
    });
  });

  describe('encryptCredentials / decryptCredentials', () => {
    it('round-trips a credentials object', () => {
      const creds = { token: 'pat-abc123', type: 'pat' };
      const encrypted = encryptCredentials(creds);
      const decrypted = decryptCredentials(encrypted);
      expect(decrypted).toEqual(creds);
    });

    it('handles nested objects', () => {
      const creds = { key: { nested: { deep: true } }, arr: [1, 2, 3] };
      const encrypted = encryptCredentials(creds);
      expect(decryptCredentials(encrypted)).toEqual(creds);
    });
  });

  describe('parseKeyHex', () => {
    it('parses a valid 64-char hex string into a 32-byte buffer', () => {
      const buf = parseKeyHex(TEST_KEY_HEX);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBe(32);
      expect(buf.toString('hex')).toBe(TEST_KEY_HEX);
    });

    it('throws for a short hex string', () => {
      expect(() => parseKeyHex('abcdef')).toThrow(/64-character hex/);
    });

    it('throws for non-hex characters', () => {
      const bad = 'z'.repeat(64);
      expect(() => parseKeyHex(bad)).toThrow(/64-character hex/);
    });

    it('accepts uppercase hex', () => {
      const upper = TEST_KEY_HEX.toUpperCase();
      const buf = parseKeyHex(upper);
      expect(buf.length).toBe(32);
    });
  });
});
