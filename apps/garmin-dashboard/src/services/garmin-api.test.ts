/**
 * Unit tests for the Garmin API client with OAuth 1.0a signing.
 * Tests cover OAuth signing, API method calls, error handling, and retry logic.
 *
 * Validates: Requirements 2.1, 2.3, 2.4, 3.1, 4.2, 4.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createGarminAPIClient,
  percentEncode,
  generateNonce,
  generateTimestamp,
  hmacSha1,
  buildSignatureBaseString,
  buildSigningKey,
  generateOAuthHeader,
  isGarminAPIError,
} from './garmin-api';
import type { GarminAPIClientConfig } from './garmin-api';

// ─── Test Setup ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const defaultConfig: GarminAPIClientConfig = {
  consumerKey: 'test_consumer_key',
  consumerSecret: 'test_consumer_secret',
  accessToken: 'test_access_token',
  tokenSecret: 'test_token_secret',
  baseUrl: 'https://apis.garmin.com/wellness-api/rest',
  timeoutMs: 5000,
  retryConfig: {
    maxRetries: 1,
    baseDelay: 10,
    maxDelay: 100,
    backoffMultiplier: 2,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  },
};

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createErrorResponse(status: number, message?: string): Response {
  const body = message ? { message } : {};
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── OAuth Signing Utilities ──────────────────────────────────────────────────

describe('OAuth 1.0a Signing Utilities', () => {
  describe('percentEncode()', () => {
    it('should encode spaces as %20', () => {
      expect(percentEncode('hello world')).toBe('hello%20world');
    });

    it('should encode special characters per RFC 3986', () => {
      expect(percentEncode('!')).toBe('%21');
      expect(percentEncode("'")).toBe('%27');
      expect(percentEncode('(')).toBe('%28');
      expect(percentEncode(')')).toBe('%29');
      expect(percentEncode('*')).toBe('%2A');
    });

    it('should not encode unreserved characters', () => {
      expect(percentEncode('abcABC123-._~')).toBe('abcABC123-._~');
    });

    it('should encode slashes and colons', () => {
      expect(percentEncode('https://example.com/path')).toBe(
        'https%3A%2F%2Fexample.com%2Fpath'
      );
    });
  });

  describe('generateNonce()', () => {
    it('should generate a 32-character hex string', () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique nonces on consecutive calls', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('generateTimestamp()', () => {
    it('should return current Unix timestamp in seconds as string', () => {
      const now = Math.floor(Date.now() / 1000);
      const ts = generateTimestamp();
      const tsNum = parseInt(ts, 10);
      // Allow 1 second tolerance
      expect(tsNum).toBeGreaterThanOrEqual(now - 1);
      expect(tsNum).toBeLessThanOrEqual(now + 1);
    });
  });

  describe('hmacSha1()', () => {
    it('should produce a Base64-encoded HMAC-SHA1 signature', async () => {
      // Known test vector: key="key", data="The quick brown fox jumps over the lazy dog"
      const result = await hmacSha1(
        'key',
        'The quick brown fox jumps over the lazy dog'
      );
      // Expected HMAC-SHA1 for this input (Base64)
      expect(result).toBe('3nybhbi3iqa8ino29wqQcBydtNk=');
    });

    it('should produce consistent results for the same input', async () => {
      const result1 = await hmacSha1('secret', 'message');
      const result2 = await hmacSha1('secret', 'message');
      expect(result1).toBe(result2);
    });

    it('should produce different results for different keys', async () => {
      const result1 = await hmacSha1('key1', 'message');
      const result2 = await hmacSha1('key2', 'message');
      expect(result1).not.toBe(result2);
    });
  });

  describe('buildSignatureBaseString()', () => {
    it('should format as METHOD&URL&PARAMS', () => {
      const result = buildSignatureBaseString('GET', 'https://api.example.com/resource', {
        oauth_consumer_key: 'key',
        oauth_nonce: 'nonce',
      });

      expect(result).toContain('GET&');
      expect(result).toContain(percentEncode('https://api.example.com/resource'));
    });

    it('should sort parameters alphabetically', () => {
      const result = buildSignatureBaseString('GET', 'https://api.example.com/data', {
        z_param: 'z_value',
        a_param: 'a_value',
        m_param: 'm_value',
      });

      // The param string should be a_param=...&m_param=...&z_param=...
      const parts = result.split('&');
      const paramStr = decodeURIComponent(parts[2]!);
      expect(paramStr.indexOf('a_param')).toBeLessThan(paramStr.indexOf('m_param'));
      expect(paramStr.indexOf('m_param')).toBeLessThan(paramStr.indexOf('z_param'));
    });

    it('should uppercase the method', () => {
      const result = buildSignatureBaseString('get', 'https://api.example.com', {});
      expect(result.startsWith('GET&')).toBe(true);
    });
  });

  describe('buildSigningKey()', () => {
    it('should format as consumerSecret&tokenSecret', () => {
      const key = buildSigningKey('consumer_secret', 'token_secret');
      expect(key).toBe('consumer_secret&token_secret');
    });

    it('should percent-encode special characters in secrets', () => {
      const key = buildSigningKey('sec&ret', 'tok=en');
      expect(key).toBe('sec%26ret&tok%3Den');
    });

    it('should handle empty token secret', () => {
      const key = buildSigningKey('consumer_secret', '');
      expect(key).toBe('consumer_secret&');
    });
  });

  describe('generateOAuthHeader()', () => {
    it('should produce a header starting with "OAuth "', async () => {
      const header = await generateOAuthHeader(
        'GET',
        'https://api.example.com/data',
        'consumer_key',
        'consumer_secret',
        'access_token',
        'token_secret'
      );

      expect(header.startsWith('OAuth ')).toBe(true);
    });

    it('should include all required OAuth parameters', async () => {
      const header = await generateOAuthHeader(
        'GET',
        'https://api.example.com/data',
        'my_consumer_key',
        'consumer_secret',
        'my_access_token',
        'token_secret'
      );

      expect(header).toContain('oauth_consumer_key="my_consumer_key"');
      expect(header).toContain('oauth_token="my_access_token"');
      expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
      expect(header).toContain('oauth_version="1.0"');
      expect(header).toContain('oauth_nonce=');
      expect(header).toContain('oauth_timestamp=');
      expect(header).toContain('oauth_signature=');
    });

    it('should produce different signatures for different URLs', async () => {
      const header1 = await generateOAuthHeader(
        'GET',
        'https://api.example.com/activities',
        'key',
        'secret',
        'token',
        'token_secret'
      );
      const header2 = await generateOAuthHeader(
        'GET',
        'https://api.example.com/profile',
        'key',
        'secret',
        'token',
        'token_secret'
      );

      // Extract signatures
      const sig1 = header1.match(/oauth_signature="([^"]+)"/)?.[1];
      const sig2 = header2.match(/oauth_signature="([^"]+)"/)?.[1];
      expect(sig1).not.toBe(sig2);
    });
  });
});

// ─── Garmin API Client ────────────────────────────────────────────────────────

describe('Garmin API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getActivities ──────────────────────────────────────────────────────

  describe('getActivities()', () => {
    it('should call GET /activities with start and limit params', async () => {
      const mockActivities = [
        {
          activityId: '1',
          activityType: 'running',
          activityName: 'Morning Run',
          startTime: '2024-01-15T08:00:00Z',
          duration: 3600,
          distance: 10000,
          hasGPS: true,
        },
      ];

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockActivities));

      const client = createGarminAPIClient(defaultConfig);
      const result = await client.getActivities({ start: 0, limit: 50 });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toContain('/activities?');
      expect(url).toContain('start=0');
      expect(url).toContain('limit=50');
      expect(options.method).toBe('GET');
      expect(options.headers.Authorization).toMatch(/^OAuth /);
      expect(result).toEqual(mockActivities);
    });

    it('should pass pagination params correctly', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse([]));

      const client = createGarminAPIClient(defaultConfig);
      await client.getActivities({ start: 50, limit: 25 });

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('start=50');
      expect(url).toContain('limit=25');
    });
  });

  // ─── getActivityDetail ──────────────────────────────────────────────────

  describe('getActivityDetail()', () => {
    it('should call GET /activities/{activityId}', async () => {
      const mockDetail = {
        activityId: 'act_123',
        activityType: 'cycling',
        activityName: 'Afternoon Ride',
        startTime: '2024-01-15T14:00:00Z',
        duration: 5400,
        distance: 30000,
        hasGPS: true,
        heartRateZones: [],
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockDetail));

      const client = createGarminAPIClient(defaultConfig);
      const result = await client.getActivityDetail('act_123');

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('/activities/act_123');
      expect(result).toEqual(mockDetail);
    });
  });

  // ─── getDailySummary ────────────────────────────────────────────────────

  describe('getDailySummary()', () => {
    it('should call GET /dailies with date range params', async () => {
      const mockSummaries = [
        { date: '2024-01-15', steps: 8500 },
        { date: '2024-01-16', steps: 10200 },
      ];

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockSummaries));

      const client = createGarminAPIClient(defaultConfig);
      const result = await client.getDailySummary({
        startDate: '2024-01-15',
        endDate: '2024-01-21',
      });

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('/dailies?');
      expect(url).toContain('startDate=2024-01-15');
      expect(url).toContain('endDate=2024-01-21');
      expect(result).toEqual(mockSummaries);
    });
  });

  // ─── getPersonalRecords ─────────────────────────────────────────────────

  describe('getPersonalRecords()', () => {
    it('should call GET /personalRecords', async () => {
      const mockRecords = [
        {
          recordType: 'longest_run',
          value: 42195,
          unit: 'meters',
          activityId: 'act_marathon',
          date: '2023-11-05',
        },
      ];

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockRecords));

      const client = createGarminAPIClient(defaultConfig);
      const result = await client.getPersonalRecords();

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('/personalRecords');
      expect(result).toEqual(mockRecords);
    });
  });

  // ─── getTrainingStatus ──────────────────────────────────────────────────

  describe('getTrainingStatus()', () => {
    it('should call GET /trainingStatus', async () => {
      const mockStatus = {
        vo2Max: 52,
        trainingLoad: 350,
        trainingLoadBalance: 'optimal',
        recoveryTimeHours: 24,
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockStatus));

      const client = createGarminAPIClient(defaultConfig);
      const result = await client.getTrainingStatus();

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('/trainingStatus');
      expect(result).toEqual(mockStatus);
    });
  });

  // ─── getUserProfile ─────────────────────────────────────────────────────

  describe('getUserProfile()', () => {
    it('should call GET /userProfile', async () => {
      const mockProfile = {
        userId: 'garmin_user_42',
        displayName: 'Athlete One',
        profileImageUrl: 'https://example.com/avatar.jpg',
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockProfile));

      const client = createGarminAPIClient(defaultConfig);
      const result = await client.getUserProfile();

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('/userProfile');
      expect(result).toEqual(mockProfile);
    });
  });

  // ─── OAuth Header Signing ───────────────────────────────────────────────

  describe('OAuth request signing', () => {
    it('should include an OAuth Authorization header on every request', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse([]));

      const client = createGarminAPIClient(defaultConfig);
      await client.getActivities({ start: 0, limit: 10 });

      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.headers.Authorization).toMatch(/^OAuth /);
      expect(options.headers.Authorization).toContain('oauth_consumer_key');
      expect(options.headers.Authorization).toContain('oauth_signature');
    });

    it('should include Accept: application/json header', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse({}));

      const client = createGarminAPIClient(defaultConfig);
      await client.getUserProfile();

      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.headers.Accept).toBe('application/json');
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should throw TOKEN_EXPIRED on 401 response', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(401, 'Token expired')
      );

      const client = createGarminAPIClient(defaultConfig);

      await expect(client.getUserProfile()).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED',
        statusCode: 401,
        retryable: false,
      });
    });

    it('should throw FORBIDDEN on 403 response', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(403, 'Access denied')
      );

      const client = createGarminAPIClient(defaultConfig);

      await expect(client.getActivities({ start: 0, limit: 10 })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
        retryable: false,
      });
    });

    it('should throw NOT_FOUND on 404 response', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(404, 'Activity not found')
      );

      const client = createGarminAPIClient(defaultConfig);

      await expect(client.getActivityDetail('nonexistent')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        statusCode: 404,
        message: 'Activity not found',
        retryable: false,
      });
    });

    it('should throw RATE_LIMITED on 429 response after retries', async () => {
      // With maxRetries=1, it should try twice then throw
      mockFetch.mockResolvedValue(createErrorResponse(429, 'Too many requests'));

      const client = createGarminAPIClient({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 1,
          baseDelay: 1,
          maxDelay: 10,
          backoffMultiplier: 1,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
      });

      await expect(client.getPersonalRecords()).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        statusCode: 429,
        retryable: true,
      });

      // Should have been called twice (initial + 1 retry)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw SERVER_ERROR on 500 response after retries', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(500, 'Internal server error'));

      const client = createGarminAPIClient({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 1,
          baseDelay: 1,
          maxDelay: 10,
          backoffMultiplier: 1,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
      });

      await expect(client.getTrainingStatus()).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        statusCode: 500,
        retryable: true,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw NETWORK_ERROR on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const client = createGarminAPIClient({
        ...defaultConfig,
        retryConfig: { ...defaultConfig.retryConfig!, maxRetries: 0 },
      });

      await expect(client.getUserProfile()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
      });
    });

    it('should throw TIMEOUT error on request timeout', async () => {
      mockFetch.mockImplementationOnce(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            // Simulate a delayed response that exceeds the timeout
            const timer = setTimeout(() => {
              // This won't fire, abort will happen first
            }, 10000);
            options.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );

      const client = createGarminAPIClient({
        ...defaultConfig,
        timeoutMs: 50, // Very short timeout for test
        retryConfig: { ...defaultConfig.retryConfig!, maxRetries: 0 },
      });

      await expect(client.getUserProfile()).rejects.toMatchObject({
        code: 'TIMEOUT',
        retryable: true,
      });
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Bad Gateway', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      const client = createGarminAPIClient({
        ...defaultConfig,
        retryConfig: { ...defaultConfig.retryConfig!, maxRetries: 0 },
      });

      await expect(client.getUserProfile()).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        statusCode: 502,
        retryable: true,
      });
    });
  });

  // ─── Retry Logic ────────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('should retry on 500 and succeed on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(createErrorResponse(500, 'Server error'))
        .mockResolvedValueOnce(
          createJsonResponse({ userId: 'user1', displayName: 'Test' })
        );

      const client = createGarminAPIClient({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 1,
          baseDelay: 1, // minimal delay for test speed
          maxDelay: 10,
          backoffMultiplier: 1,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
      });
      const result = await client.getUserProfile();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ userId: 'user1', displayName: 'Test' });
    });

    it('should not retry on 401 (non-retryable)', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(401, 'Unauthorized'));

      const client = createGarminAPIClient(defaultConfig);

      await expect(client.getUserProfile()).rejects.toMatchObject({
        code: 'TOKEN_EXPIRED',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 (non-retryable)', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(404, 'Not found'));

      const client = createGarminAPIClient(defaultConfig);

      await expect(client.getActivityDetail('bad_id')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect maxRetries configuration', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(503, 'Service unavailable'));

      const client = createGarminAPIClient({
        ...defaultConfig,
        retryConfig: {
          maxRetries: 3,
          baseDelay: 1, // minimal delay for test speed
          maxDelay: 10,
          backoffMultiplier: 1,
          retryableStatuses: [408, 429, 500, 502, 503, 504],
        },
      });

      await expect(client.getUserProfile()).rejects.toMatchObject({
        code: 'SERVER_ERROR',
      });

      // initial + 3 retries = 4 total
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  // ─── isGarminAPIError ───────────────────────────────────────────────────

  describe('isGarminAPIError()', () => {
    it('should return true for valid APIError objects', () => {
      const error = {
        code: 'NETWORK_ERROR',
        message: 'Failed',
        retryable: true,
        timestamp: '2024-01-01T00:00:00.000Z',
      };
      expect(isGarminAPIError(error)).toBe(true);
    });

    it('should return false for non-APIError objects', () => {
      expect(isGarminAPIError(new Error('test'))).toBe(false);
      expect(isGarminAPIError(null)).toBe(false);
      expect(isGarminAPIError(undefined)).toBe(false);
      expect(isGarminAPIError({ code: 'ERROR' })).toBe(false);
    });
  });

  // ─── Base URL Configuration ─────────────────────────────────────────────

  describe('base URL configuration', () => {
    it('should use custom base URL when provided', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse([]));

      const client = createGarminAPIClient({
        ...defaultConfig,
        baseUrl: 'https://custom-proxy.example.com/garmin',
      });

      await client.getActivities({ start: 0, limit: 10 });

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('https://custom-proxy.example.com/garmin/activities');
    });

    it('should use default Garmin API URL when baseUrl is not provided', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse([]));

      const { baseUrl: _, ...configWithoutBase } = defaultConfig;
      const client = createGarminAPIClient(configWithoutBase as GarminAPIClientConfig);

      await client.getActivities({ start: 0, limit: 10 });

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toContain('https://apis.garmin.com/wellness-api/rest/activities');
    });
  });
});
