/**
 * API response types, error types, and service interfaces for the
 * Garmin Fitness Dashboard. Covers both the OAuth proxy and Garmin Connect API.
 */

import type {
  Activity,
  ActivityDetail,
  DailySummary,
  PersonalRecord,
  TrainingStatus,
  UserProfile,
} from './garmin';

// ─── OAuth Proxy Types ────────────────────────────────────────────────────────

export interface RequestTokenResponse {
  redirectUrl: string;
  requestToken: string;
}

export interface EncryptedTokenPayload {
  accessToken: string; // Encrypted
  tokenSecret: string; // Encrypted
  refreshToken: string; // Encrypted
  expiresAt: number; // Unix timestamp
  userId: string;
  displayName: string;
}

export interface AccessTokenRequest {
  requestToken: string;
  oauthVerifier: string;
}

export interface RefreshTokenRequest {
  encryptedRefreshToken: string;
}

// ─── OAuth Proxy API Interface ────────────────────────────────────────────────

export interface OAuthProxyAPI {
  getRequestToken(): Promise<RequestTokenResponse>;
  exchangeAccessToken(params: AccessTokenRequest): Promise<EncryptedTokenPayload>;
  refreshToken(params: RefreshTokenRequest): Promise<EncryptedTokenPayload>;
}

// ─── Garmin API Client Interface ──────────────────────────────────────────────

export interface PaginationParams {
  start: number;
  limit: number;
}

export interface DateRangeParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface GarminAPIClient {
  getActivities(params: PaginationParams): Promise<Activity[]>;
  getActivityDetail(activityId: string): Promise<ActivityDetail>;
  getDailySummary(params: DateRangeParams): Promise<DailySummary[]>;
  getPersonalRecords(): Promise<PersonalRecord[]>;
  getTrainingStatus(): Promise<TrainingStatus>;
  getUserProfile(): Promise<UserProfile>;
}

// ─── API Error Types ──────────────────────────────────────────────────────────

export type APIErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REFRESH_FAILED'
  | 'ORIGIN_BLOCKED'
  | 'MISSING_SCOPES';

export interface APIError {
  code: APIErrorCode;
  message: string;
  statusCode?: number;
  retryable: boolean;
  timestamp: string; // ISO 8601
}

export interface APIErrorResponse {
  error: APIError;
}

// ─── Retry Configuration ──────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// ─── API Response Wrappers ────────────────────────────────────────────────────

export type APIResult<T> =
  | { success: true; data: T }
  | { success: false; error: APIError };

// ─── Health Check ─────────────────────────────────────────────────────────────

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version?: string;
}
