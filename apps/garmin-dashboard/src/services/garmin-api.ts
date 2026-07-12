/**
 * Garmin Connect API client with OAuth 1.0a request signing.
 * Signs all requests with HMAC-SHA1 using the consumer key and access token.
 *
 * Validates: Requirements 2.1, 2.3, 2.4, 3.1, 4.2, 4.3
 */

import type {
  GarminAPIClient,
  PaginationParams,
  DateRangeParams,
  APIError,
  APIErrorCode,
  RetryConfig,
  DEFAULT_RETRY_CONFIG as _DefaultRetry,
} from '@/types/api';
import type {
  Activity,
  ActivityDetail,
  DailySummary,
  PersonalRecord,
  TrainingStatus,
  UserProfile,
} from '@/types/garmin';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GarminAPIClientConfig {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  tokenSecret: string;
  baseUrl?: string;
  timeoutMs?: number;
  retryConfig?: Partial<RetryConfig>;
}

interface OAuthParams {
  oauth_consumer_key: string;
  oauth_token: string;
  oauth_signature_method: string;
  oauth_timestamp: string;
  oauth_nonce: string;
  oauth_version: string;
  oauth_signature?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://apis.garmin.com/wellness-api/rest';
const DEFAULT_TIMEOUT_MS = 15000;

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// ─── OAuth 1.0a Signing Utilities ─────────────────────────────────────────────

/**
 * Percent-encodes a string per RFC 3986.
 * This is stricter than encodeURIComponent — it also encodes !, ', (, ), and *.
 */
export function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

/**
 * Generates a random nonce string for OAuth signature uniqueness.
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a Unix timestamp in seconds for OAuth.
 */
export function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

/**
 * Computes HMAC-SHA1 signature using the Web Crypto API.
 * Returns a Base64-encoded signature string.
 */
export async function hmacSha1(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Builds the OAuth signature base string per the OAuth 1.0a spec.
 * Format: METHOD&percentEncode(baseUrl)&percentEncode(sortedParams)
 */
export function buildSignatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>
): string {
  // Sort parameters alphabetically by key
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key]!)}`)
    .join('&');

  return [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');
}

/**
 * Builds the signing key for OAuth 1.0a HMAC-SHA1.
 * Format: percentEncode(consumerSecret)&percentEncode(tokenSecret)
 */
export function buildSigningKey(consumerSecret: string, tokenSecret: string): string {
  return `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
}

/**
 * Generates a complete OAuth 1.0a Authorization header value.
 */
export async function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  tokenSecret: string,
  queryParams: Record<string, string> = {}
): Promise<string> {
  const oauthParams: OAuthParams = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_nonce: generateNonce(),
    oauth_version: '1.0',
  };

  // Combine OAuth params with query params for signature base string
  const allParams: Record<string, string> = {
    ...queryParams,
    ...oauthParams,
  };

  const baseString = buildSignatureBaseString(method, url, allParams);
  const signingKey = buildSigningKey(consumerSecret, tokenSecret);
  const signature = await hmacSha1(signingKey, baseString);

  oauthParams.oauth_signature = signature;

  // Build the Authorization header value
  const headerParts = Object.entries(oauthParams)
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value!)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ─── Error Handling ───────────────────────────────────────────────────────────

function createAPIError(
  code: APIErrorCode,
  message: string,
  statusCode?: number,
  retryable = false
): APIError {
  return {
    code,
    message,
    statusCode,
    retryable,
    timestamp: new Date().toISOString(),
  };
}

function mapHttpStatusToError(status: number): { code: APIErrorCode; retryable: boolean } {
  switch (true) {
    case status === 401:
      return { code: 'TOKEN_EXPIRED', retryable: false };
    case status === 403:
      return { code: 'FORBIDDEN', retryable: false };
    case status === 404:
      return { code: 'NOT_FOUND', retryable: false };
    case status === 429:
      return { code: 'RATE_LIMITED', retryable: true };
    case status >= 500:
      return { code: 'SERVER_ERROR', retryable: true };
    default:
      return { code: 'UNKNOWN_ERROR', retryable: false };
  }
}

// ─── Fetch Utilities ──────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw createAPIError('TIMEOUT', `Request timed out after ${timeoutMs}ms`, undefined, true);
    }
    throw createAPIError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network request failed',
      undefined,
      true
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Computes the delay before the next retry attempt using exponential backoff.
 */
function computeRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleeps for the specified duration (used between retries).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Garmin API Client Implementation ─────────────────────────────────────────

/**
 * Creates a GarminAPIClient that signs all requests with OAuth 1.0a HMAC-SHA1.
 *
 * Validates: Requirements 2.1, 2.3, 2.4, 3.1, 4.2, 4.3
 */
export function createGarminAPIClient(config: GarminAPIClientConfig): GarminAPIClient {
  const {
    consumerKey,
    consumerSecret,
    accessToken,
    tokenSecret,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = config;

  const retryConfig: RetryConfig = { ...DEFAULT_RETRY, ...config.retryConfig };

  /**
   * Makes a signed request to the Garmin API with retry support.
   */
  async function signedRequest<T>(
    method: string,
    endpoint: string,
    queryParams: Record<string, string> = {}
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`;

    // Build query string for the actual request URL
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const requestUrl = queryString ? `${url}?${queryString}` : url;

    let lastError: APIError | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      if (attempt > 0 && lastError) {
        const delay = computeRetryDelay(attempt - 1, retryConfig);
        await sleep(delay);
      }

      try {
        // Generate OAuth header (uses the base URL without query string for signing)
        const authHeader = await generateOAuthHeader(
          method,
          url,
          consumerKey,
          consumerSecret,
          accessToken,
          tokenSecret,
          queryParams
        );

        const response = await fetchWithTimeout(
          requestUrl,
          {
            method,
            headers: {
              Authorization: authHeader,
              Accept: 'application/json',
            },
          },
          timeoutMs
        );

        if (response.ok) {
          const data: T = await response.json();
          return data;
        }

        // Handle error responses
        const { code, retryable } = mapHttpStatusToError(response.status);
        let message = `Garmin API request failed with status ${response.status}`;

        try {
          const body = await response.json();
          if (body?.message) {
            message = body.message;
          } else if (body?.errorMessage) {
            message = body.errorMessage;
          }
        } catch {
          // Body wasn't JSON — use default message
        }

        lastError = createAPIError(code, message, response.status, retryable);

        // Only retry on retryable errors
        if (!retryable || !retryConfig.retryableStatuses.includes(response.status)) {
          throw lastError;
        }
      } catch (error: unknown) {
        // If it's already an APIError, check retryability
        if (isAPIError(error)) {
          lastError = error;
          if (!error.retryable) {
            throw error;
          }
        } else {
          // Unexpected error — wrap and throw
          throw createAPIError(
            'UNKNOWN_ERROR',
            error instanceof Error ? error.message : 'Unknown error',
            undefined,
            false
          );
        }
      }
    }

    // All retries exhausted
    throw lastError ?? createAPIError('UNKNOWN_ERROR', 'Request failed after retries');
  }

  return {
    /**
     * Retrieves paginated activities from Garmin Connect.
     * Validates: Requirement 2.1 — fetch most recent activities with pagination
     */
    async getActivities(params: PaginationParams): Promise<Activity[]> {
      return signedRequest<Activity[]>('GET', '/activities', {
        start: params.start.toString(),
        limit: params.limit.toString(),
      });
    },

    /**
     * Retrieves detailed metrics for a specific activity.
     * Validates: Requirement 2.3 — heart rate zones, pace, cadence, elevation, GPS route
     */
    async getActivityDetail(activityId: string): Promise<ActivityDetail> {
      return signedRequest<ActivityDetail>('GET', `/activities/${activityId}`);
    },

    /**
     * Retrieves daily summary data within a date range.
     * Validates: Requirement 3.1 — daily summaries for up to 90-day range
     */
    async getDailySummary(params: DateRangeParams): Promise<DailySummary[]> {
      return signedRequest<DailySummary[]>('GET', '/dailies', {
        startDate: params.startDate,
        endDate: params.endDate,
      });
    },

    /**
     * Retrieves personal records from Garmin Connect.
     * Validates: Requirement 4.2 — longest run, fastest pace, highest elevation
     */
    async getPersonalRecords(): Promise<PersonalRecord[]> {
      return signedRequest<PersonalRecord[]>('GET', '/personalRecords');
    },

    /**
     * Retrieves training status (VO2 max, training load, recovery time).
     * Validates: Requirement 4.3 — training status indicators
     */
    async getTrainingStatus(): Promise<TrainingStatus> {
      return signedRequest<TrainingStatus>('GET', '/trainingStatus');
    },

    /**
     * Retrieves the authenticated user's profile.
     */
    async getUserProfile(): Promise<UserProfile> {
      return signedRequest<UserProfile>('GET', '/userProfile');
    },
  };
}

// ─── Type Guard ───────────────────────────────────────────────────────────────

function isAPIError(error: unknown): error is APIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error &&
    'timestamp' in error
  );
}

/**
 * Type guard to check if an error is an APIError.
 * Useful for callers to determine how to handle errors.
 */
export { isAPIError as isGarminAPIError };
