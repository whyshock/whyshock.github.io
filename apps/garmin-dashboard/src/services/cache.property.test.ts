import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { createCacheService } from './cache';
import type { CacheService } from '../types/cache';

/**
 * Property-based tests for the caching layer.
 *
 * These tests use fast-check to verify universal caching properties
 * across a wide range of random inputs (minimum 100 iterations each).
 */
describe('Cache Property Tests', () => {
  let cache: CacheService;

  beforeEach(() => {
    // Create a fresh cache instance with localStorage backend for each test
    window.localStorage.clear();
    cache = createCacheService({
      storageType: 'localStorage',
      defaultTTL: null,
      keyPrefix: '',
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  /**
   * Property 3: Cache namespace isolation
   * For any two distinct userIds and any key-value pair, storing data under
   * userId A makes it unreachable via userId B.
   *
   * **Validates: Requirements 10.1, 10.2**
   */
  describe('Property 3: Cache namespace isolation', () => {
    it('data written under userId A is never retrievable under userId B', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.jsonValue(),
          (userIdA, userIdB, key, value) => {
            fc.pre(userIdA !== userIdB);

            // Clear storage before each iteration to avoid cross-contamination
            window.localStorage.clear();

            cache.set(key, userIdA, value);
            const result = cache.get(key, userIdB);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 4: Cache TTL expiration
   * For any positive TTL and any data, after the TTL elapses, get() returns null.
   *
   * **Validates: Requirements 2.6**
   */
  describe('Property 4: Cache TTL expiration', () => {
    it('expired entries return null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.jsonValue(),
          fc.integer({ min: 1, max: 60 }),
          (userId, key, value, ttl) => {
            // Clear storage before each iteration
            window.localStorage.clear();

            vi.useFakeTimers();
            const now = Date.now();
            vi.setSystemTime(now);

            cache.set(key, userId, value, ttl);

            // Advance time past TTL
            vi.setSystemTime(now + (ttl + 1) * 1000);
            const result = cache.get(key, userId);

            vi.useRealTimers();
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('data IS retrievable within its TTL', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.jsonValue(),
          fc.integer({ min: 2, max: 60 }),
          (userId, key, value, ttl) => {
            // Clear storage before each iteration
            window.localStorage.clear();

            vi.useFakeTimers();
            const now = Date.now();
            vi.setSystemTime(now);

            cache.set(key, userId, value, ttl);

            // Read immediately (well within TTL)
            const result = cache.get(key, userId);

            vi.useRealTimers();
            expect(JSON.stringify(result)).toBe(JSON.stringify(value));
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
