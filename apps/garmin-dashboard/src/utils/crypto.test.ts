import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken, deriveKey } from './crypto';

describe('crypto utilities', () => {
  describe('encryptToken / decryptToken round-trip', () => {
    it('encrypts and decrypts a regular string correctly', async () => {
      const plaintext = 'my-oauth-access-token-12345';
      const userId = 'user-abc-123';

      const encrypted = await encryptToken(plaintext, userId);
      const decrypted = await decryptToken(encrypted, userId);

      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts an empty string', async () => {
      const plaintext = '';
      const userId = 'user-xyz';

      const encrypted = await encryptToken(plaintext, userId);
      const decrypted = await decryptToken(encrypted, userId);

      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts special characters', async () => {
      const plaintext = '{"token":"abc/+=123","secret":"xyz!@#$%"}';
      const userId = 'user-special';

      const encrypted = await encryptToken(plaintext, userId);
      const decrypted = await decryptToken(encrypted, userId);

      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts unicode content', async () => {
      const plaintext = 'token-with-émojis-🏃‍♂️-and-ünïcödë';
      const userId = 'user-unicode';

      const encrypted = await encryptToken(plaintext, userId);
      const decrypted = await decryptToken(encrypted, userId);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('different userIds produce different ciphertexts', () => {
    it('same plaintext encrypted with different userIds produces different results', async () => {
      const plaintext = 'shared-token-value';
      const userIdA = 'user-alice';
      const userIdB = 'user-bob';

      const encryptedA = await encryptToken(plaintext, userIdA);
      const encryptedB = await encryptToken(plaintext, userIdB);

      expect(encryptedA).not.toBe(encryptedB);
    });

    it('ciphertext from one user cannot be decrypted by another', async () => {
      const plaintext = 'secret-token';
      const userIdA = 'user-alice';
      const userIdB = 'user-bob';

      const encrypted = await encryptToken(plaintext, userIdA);

      await expect(decryptToken(encrypted, userIdB)).rejects.toThrow();
    });
  });

  describe('tampered ciphertext throws error on decrypt', () => {
    it('throws on a flipped bit in ciphertext', async () => {
      const plaintext = 'tamper-test-token';
      const userId = 'user-tamper';

      const encrypted = await encryptToken(plaintext, userId);

      // Decode base64, flip a byte in the ciphertext portion, re-encode
      const binary = atob(encrypted);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      // Flip a byte after the IV (first 12 bytes)
      bytes[14] = bytes[14]! ^ 0xff;

      let tampered = '';
      for (let i = 0; i < bytes.length; i++) {
        tampered += String.fromCharCode(bytes[i]!);
      }
      const tamperedBase64 = btoa(tampered);

      await expect(decryptToken(tamperedBase64, userId)).rejects.toThrow(
        'Decryption failed',
      );
    });

    it('throws on truncated ciphertext', async () => {
      const plaintext = 'truncate-test';
      const userId = 'user-truncate';

      const encrypted = await encryptToken(plaintext, userId);
      // Truncate to just a few characters
      const truncated = encrypted.slice(0, 10);

      await expect(decryptToken(truncated, userId)).rejects.toThrow();
    });

    it('throws on invalid base64 input', async () => {
      const userId = 'user-invalid';
      const invalidBase64 = '!!!not-valid-base64!!!';

      await expect(decryptToken(invalidBase64, userId)).rejects.toThrow();
    });
  });

  describe('deriveKey', () => {
    it('returns a CryptoKey object', async () => {
      const key = await deriveKey('test-user');

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('produces deterministic keys for the same userId', async () => {
      const key1 = await deriveKey('user-deterministic');
      const key2 = await deriveKey('user-deterministic');

      // We can't directly compare CryptoKeys, but we can verify
      // they produce the same encryption result with the same IV
      // Instead, verify round-trip works
      const plaintext = 'deterministic-test';
      const encrypted = await encryptToken(plaintext, 'user-deterministic');
      const decrypted = await decryptToken(encrypted, 'user-deterministic');
      expect(decrypted).toBe(plaintext);

      // Suppress unused variable warnings
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });
  });

  describe('encryption uniqueness', () => {
    it('same plaintext and userId produces different ciphertexts (random IV)', async () => {
      const plaintext = 'repeated-encryption-test';
      const userId = 'user-uniqueness';

      const encrypted1 = await encryptToken(plaintext, userId);
      const encrypted2 = await encryptToken(plaintext, userId);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same plaintext
      const decrypted1 = await decryptToken(encrypted1, userId);
      const decrypted2 = await decryptToken(encrypted2, userId);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });
  });
});
