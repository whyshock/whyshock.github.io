import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createCacheService } from './cache';
import type { CacheService } from '../types/cache';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    cache = createCacheService({ storageType: 'localStorage' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('set and get', () => {
    it('should store and retrieve data for a user', () => {
      const data = { activities: [{ id: '1', type: 'running' }] };
      cache.set('activities_cache', 'user-123', data);

      const result = cache.get('activities_cache', 'user-123');
      expect(result).toEqual(data);
    });

    it('should store and retrieve primitive values', () => {
      cache.set('counter', 'user-1', 42);
      expect(cache.get('counter', 'user-1')).toBe(42);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('nonexistent', 'user-123');
      expect(result).toBeNull();
    });

    it('should overwrite existing data with a new set', () => {
      cache.set('key', 'user-1', 'first');
      cache.set('key', 'user-1', 'second');
      expect(cache.get('key', 'user-1')).toBe('second');
    });
  });

  describe('TTL expiration', () => {
    it('should return data before TTL expires', () => {
      cache.set('key', 'user-1', 'value', 60); // 60 seconds
      expect(cache.get('key', 'user-1')).toBe('value');
    });

    it('should return null after TTL expires', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      cache.set('key', 'user-1', 'value', 5); // 5 seconds TTL

      // Advance time past TTL
      vi.setSystemTime(now + 6000); // 6 seconds later
      expect(cache.get('key', 'user-1')).toBeNull();

      vi.useRealTimers();
    });

    it('should not expire entries with null TTL', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      cache.set('key', 'user-1', 'value'); // No TTL

      // Advance time significantly
      vi.setSystemTime(now + 100_000_000);
      expect(cache.get('key', 'user-1')).toBe('value');

      vi.useRealTimers();
    });

    it('should remove expired entries from storage on get', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      cache.set('key', 'user-1', 'value', 5);

      vi.setSystemTime(now + 6000);
      cache.get('key', 'user-1');

      // Verify entry was removed from storage
      expect(window.localStorage.getItem('user-1:key')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('user isolation', () => {
    it('should isolate data between different users', () => {
      cache.set('activities_cache', 'user-A', { name: 'Alice data' });
      cache.set('activities_cache', 'user-B', { name: 'Bob data' });

      expect(cache.get('activities_cache', 'user-A')).toEqual({ name: 'Alice data' });
      expect(cache.get('activities_cache', 'user-B')).toEqual({ name: 'Bob data' });
    });

    it('should not allow user A to access user B data', () => {
      cache.set('secret', 'user-B', 'top-secret');

      const result = cache.get('secret', 'user-A');
      expect(result).toBeNull();
    });
  });

  describe('clear(userId)', () => {
    it('should remove all entries for a specific user', () => {
      cache.set('key1', 'user-1', 'value1');
      cache.set('key2', 'user-1', 'value2');
      cache.set('key1', 'user-2', 'other-value');

      cache.clear('user-1');

      expect(cache.get('key1', 'user-1')).toBeNull();
      expect(cache.get('key2', 'user-1')).toBeNull();
    });

    it('should not affect other users data when clearing', () => {
      cache.set('key1', 'user-1', 'value1');
      cache.set('key1', 'user-2', 'value2');

      cache.clear('user-1');

      expect(cache.get('key1', 'user-2')).toBe('value2');
    });
  });

  describe('clearAll()', () => {
    it('should remove all entries from storage', () => {
      cache.set('key1', 'user-1', 'value1');
      cache.set('key2', 'user-2', 'value2');
      cache.set('key3', 'user-3', 'value3');

      cache.clearAll();

      expect(cache.get('key1', 'user-1')).toBeNull();
      expect(cache.get('key2', 'user-2')).toBeNull();
      expect(cache.get('key3', 'user-3')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return null for invalid JSON in storage', () => {
      // Manually put invalid JSON into storage
      window.localStorage.setItem('user-1:broken', 'not-valid-json{{{');

      const result = cache.get('broken', 'user-1');
      expect(result).toBeNull();
    });

    it('should silently handle storage quota exceeded on set', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      // Should not throw
      expect(() => cache.set('key', 'user-1', 'value')).not.toThrow();

      setItemSpy.mockRestore();
    });
  });

  describe('sessionStorage backend', () => {
    let authCache: CacheService;

    beforeEach(() => {
      authCache = createCacheService({ storageType: 'sessionStorage' });
    });

    it('should store and retrieve data from sessionStorage', () => {
      authCache.set('auth_session', 'user-1', { token: 'abc123' });

      const result = authCache.get('auth_session', 'user-1');
      expect(result).toEqual({ token: 'abc123' });
    });

    it('should use sessionStorage not localStorage', () => {
      authCache.set('auth_session', 'user-1', { token: 'abc123' });

      // Check it's in sessionStorage
      expect(window.sessionStorage.getItem('user-1:auth_session')).not.toBeNull();
      // And not in localStorage
      expect(window.localStorage.getItem('user-1:auth_session')).toBeNull();
    });
  });

  describe('key prefix configuration', () => {
    it('should support a custom key prefix', () => {
      const prefixedCache = createCacheService({
        storageType: 'localStorage',
        keyPrefix: 'garmin',
      });

      prefixedCache.set('data', 'user-1', 'test');

      // Should store with prefix
      expect(window.localStorage.getItem('garmin:user-1:data')).not.toBeNull();
    });
  });
});
