/**
 * Cache service interface and related types for the Garmin Fitness Dashboard.
 * Provides user-namespaced caching with TTL support for multi-user isolation.
 */

// ─── Cache Service Interface ──────────────────────────────────────────────────

export interface CacheService {
  /** Retrieve a cached value by key, scoped to a specific user. Returns null if not found or expired. */
  get<T>(key: string, userId: string): T | null;

  /** Store a value in cache, scoped to a specific user. Optional TTL in seconds. */
  set<T>(key: string, userId: string, data: T, ttl?: number): void;

  /** Clear all cached entries for a specific user. */
  clear(userId: string): void;

  /** Clear all cached entries for all users. */
  clearAll(): void;
}

// ─── Cache Entry Metadata ─────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  timestamp: number; // Unix timestamp when entry was stored
  ttl: number | null; // Time-to-live in seconds, null for no expiration
  userId: string;
}

// ─── Cache Configuration ──────────────────────────────────────────────────────

export interface CacheConfig {
  /** Default TTL in seconds for cache entries (default: session duration) */
  defaultTTL: number | null;
  /** Storage backend: 'localStorage' for persistent, 'sessionStorage' for session-scoped */
  storageType: 'localStorage' | 'sessionStorage';
  /** Key prefix to namespace all cache entries */
  keyPrefix: string;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: null, // No expiration by default (session-scoped)
  storageType: 'localStorage',
  keyPrefix: '',
};

// ─── Cache Key Constants ──────────────────────────────────────────────────────

export const CACHE_KEYS = {
  AUTH_SESSION: 'auth_session',
  ACTIVITIES: 'activities_cache',
  DAILY_SUMMARY: 'daily_summary_cache',
  PREFERENCES: 'preferences',
  INSIGHTS: 'insights_cache',
  PERSONAL_RECORDS: 'personal_records_cache',
  TRAINING_STATUS: 'training_status_cache',
  USER_PROFILE: 'user_profile_cache',
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];
