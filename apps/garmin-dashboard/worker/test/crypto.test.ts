import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/crypto';

const TEST_KEY = 'test-encryption-key-32bytes-long!';

describe('Crypto utilities (AES-256-GCM)', () => {
  it('encrypt returns a non-empty base64 string', async () => {
    const encrypted = await encrypt('hello world', TEST_KEY);
    expect(encrypted).toBeDefined();
    expect(encrypted.length).toBeGreaterThan(0);
    // Should be valid base64
    expect(() => atob(encrypted)).not.toThrow();
  });

  it('decrypt recovers the original plaintext', async () => {
    const plaintext = 'my-secret-token-value-12345';
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypted output differs from plaintext', async () => {
    const plaintext = 'access-token-abc123';
    const encrypted = await encrypt(plaintext, TEST_KEY);
    expect(encrypted).not.toBe(plaintext);
  });

  it('two encryptions of the same plaintext produce different ciphertexts (random IV)', async () => {
    const plaintext = 'same-value-twice';
    const encrypted1 = await encrypt(plaintext, TEST_KEY);
    const encrypted2 = await encrypt(plaintext, TEST_KEY);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('decrypt with wrong key throws an error', async () => {
    const plaintext = 'sensitive-data';
    const encrypted = await encrypt(plaintext, TEST_KEY);

    await expect(decrypt(encrypted, 'wrong-key-completely-different!!')).rejects.toThrow();
  });

  it('handles empty string encryption/decryption', async () => {
    const plaintext = '';
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('handles unicode characters', async () => {
    const plaintext = '日本語テスト 🎉 émojis';
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('handles long strings', async () => {
    const plaintext = 'a'.repeat(10000);
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });
});
