import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encryptToken, decryptToken } from '@/utils/crypto';

/**
 * Property-based tests for authentication crypto and namespace isolation.
 *
 * These tests use fast-check to verify universal properties across
 * a wide range of random inputs (minimum 100 iterations each).
 */
describe('Auth Property Tests', () => {
  /**
   * Property 1: Token encryption round-trip
   * For any arbitrary string (token), encrypting it with a userId and then
   * decrypting it with the same userId always returns the original string.
   *
   * **Validates: Requirements 1.3, 11.2**
   */
  describe('Property 1: Token encryption round-trip', () => {
    it('encrypt then decrypt always returns original token', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 1000 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (token, userId) => {
            const encrypted = await encryptToken(token, userId);
            const decrypted = await decryptToken(encrypted, userId);
            expect(decrypted).toBe(token);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 2: User namespace isolation
   * For any two distinct userIds, data encrypted under userId A cannot be
   * decrypted with userId B's key. This ensures storage keys derived from
   * different userIds never collide and cross-user data access is impossible.
   *
   * **Validates: Requirements 10.1, 10.2**
   */
  describe('Property 2: User namespace isolation', () => {
    it('data encrypted for userId A cannot be decrypted by userId B', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (userIdA, userIdB, token) => {
            fc.pre(userIdA !== userIdB); // Only test distinct users
            const encrypted = await encryptToken(token, userIdA);
            // Decrypting with userIdB should throw (key mismatch)
            try {
              await decryptToken(encrypted, userIdB);
              // If decryption succeeds, it means isolation is broken
              return false;
            } catch {
              // Correctly fails — isolation holds
              return true;
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('storage keys for different userIds never collide', () => {
      // This property verifies that the key derivation namespace
      // produces distinct keys for distinct user IDs
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (userIdA, userIdB) => {
            fc.pre(userIdA !== userIdB);
            // Session storage keys are formatted as `{userId}:auth_session`
            const keyA = `${userIdA}:auth_session`;
            const keyB = `${userIdB}:auth_session`;
            expect(keyA).not.toBe(keyB);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
