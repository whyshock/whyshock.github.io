/**
 * User-namespaced caching layer with TTL support.
 * Provides isolated data storage per user with configurable storage backends.
 *
 * - dataCache: uses localStorage for activity data (persists across tab closes)
 * - authCache: uses sessionStorage for auth sessions (cleared when tab closes)
 */

import type { CacheService, CacheEntry, CacheConfig } from '../types/cache';
import { DEFAULT_CACHE_CONFIG } from '../types/cache';

/**
 * Creates a namespaced cache key with format: {userId}:{key}
 */
function buildKey(userId: string, key: string, prefix: string): string {
  const base = `${userId}:${key}`;
  return prefix ? `${prefix}:${base}` : base;
}

/**
 * Checks if a cache entry has exceeded its TTL.
 */
function isExpired(entry: CacheEntry<unknown>): boolean {
  if (entry.ttl === null) {
    return false;
  }
  const expiresAt = entry.timestamp + entry.ttl * 1000;
  return Date.now() > expiresAt;
}

/**
 * Creates a CacheService instance backed by the specified storage type.
 */
export function createCacheService(config: Partial<CacheConfig> = {}): CacheService {
  const resolvedConfig: CacheConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

  function getStorage(): Storage {
    return resolvedConfig.storageType === 'sessionStorage'
      ? window.sessionStorage
      : window.localStorage;
  }

  return {
    get<T>(key: string, userId: string): T | null {
      try {
        const storage = getStorage();
        const fullKey = buildKey(userId, key, resolvedConfig.keyPrefix);
        const raw = storage.getItem(fullKey);

        if (raw === null) {
          return null;
        }

        const entry: CacheEntry<T> = JSON.parse(raw);

        if (isExpired(entry)) {
          // Remove expired entry
          storage.removeItem(fullKey);
          return null;
        }

        return entry.data;
      } catch {
        // Handle JSON parse errors gracefully
        return null;
      }
    },

    set<T>(key: string, userId: string, data: T, ttl?: number): void {
      try {
        const storage = getStorage();
        const fullKey = buildKey(userId, key, resolvedConfig.keyPrefix);
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl: ttl !== undefined ? ttl : resolvedConfig.defaultTTL,
          userId,
        };

        storage.setItem(fullKey, JSON.stringify(entry));
      } catch {
        // Silently fail on storage quota exceeded or other write errors
      }
    },

    clear(userId: string): void {
      const storage = getStorage();
      const prefix = resolvedConfig.keyPrefix
        ? `${resolvedConfig.keyPrefix}:${userId}:`
        : `${userId}:`;

      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const storageKey = storage.key(i);
        if (storageKey !== null && storageKey.startsWith(prefix)) {
          keysToRemove.push(storageKey);
        }
      }

      for (const storageKey of keysToRemove) {
        storage.removeItem(storageKey);
      }
    },

    clearAll(): void {
      // Clear the storage backend this service instance is configured for
      getStorage().clear();
    },
  };
}

/**
 * Data cache instance — uses localStorage for persistent activity data.
 * Activity data, daily summaries, preferences, and insights are stored here.
 */
export const dataCache: CacheService = createCacheService({
  storageType: 'localStorage',
  defaultTTL: null,
});

/**
 * Auth cache instance — uses sessionStorage for session-scoped auth data.
 * Cleared automatically when the browser tab/window closes.
 */
export const authCache: CacheService = createCacheService({
  storageType: 'sessionStorage',
  defaultTTL: null,
});
