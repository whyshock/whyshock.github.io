/**
 * Unit tests for the OAuth proxy client service.
 * Tests cover successful flows, error handling, and timeout behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOAuthProxyClient } from './oauth-proxy';
import type { OAuthProxyAPI } from '@/types/api';

// ─── Test Setup ───────────────────────────────────────────────────────────────

const PROXY_URL = 'https://oauth-proxy.example.workers.dev';

// Mock import.meta.env
vi.stubEnv('VITE_OAUTH_PROXY_URL', PROXY_URL);

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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

describe('OAuth Proxy Client', () => {
  let client: OAuthProxyAPI;

  beforeEach(() => {
    vi.stubEnv('VITE_OAUTH_PROXY_URL', PROXY_URL);
    mockFetch.mockReset();
    client = createOAuthProxyClient();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── getRequestToken ──────────────────────────────────────────────────────

  describe('getRequestToken()', () => {
    it('should call GET /auth/request-token and return response', async () => {
      const mockResponse = {
        redirectUrl: 'https://connect.garmin.com/oauthConfirm?oauth_token=abc123',
        requestToken: 'abc123',
      };

      mockFetch.mockResolvedValueOnce(createJsonResponse(mockResponse));

      const result = await client.getRequestToken();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe(`${PROXY_URL}/auth/request-token`);
      expect(options.method).toBe('GET');
      expect(result).toEqual(mockResponse);
    });

    it('should throw NETWORK_ERROR on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(client.getRequestToken()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
      });
    });

    it('should throw TIMEOUT error when request exceeds timeout', async () => {
      mockFetch.mockImplementationOnce(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );

      // Use fake timers to trigger the timeout
      vi.useFakeTimers();
      const promise = client.getRequestToken();
      vi.advanceTimersByTime(5001);

      await expect(promise).rejects.toMatchObject({
        code: 'TIMEOUT',
        retryable: true,
      });

      vi.useRealTimers();
    });

    it('should throw SERVER_ERROR on 500 response', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(500, 'Internal server error')
      );

      await expect(client.getRequestToken()).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        statusCode: 500,
        message: 'Internal server error',
        retryable: true,
      });
    });

    it('should throw FORBIDDEN on 403 response (origin blocked)', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(403, 'Origin not allowed')
      );

      await expect(client.getRequestToken()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
        message: 'Origin not allowed',
        retryable: false,
      });
    });
  });

  // ─── exchangeAccessToken ──────────────────────────────────────────────────

  describe('exchangeAccessToken()', () => {
    const params = {
      requestToken: 'req_token_123',
      oauthVerifier: 'verifier_456',
    };

    const mockPayload = {
      accessToken: 'encrypted_access',
      tokenSecret: 'encrypted_secret',
      refreshToken: 'encrypted_refresh',
      expiresAt: Date.now() + 3600000,
      userId: 'garmin_user_1',
      displayName: 'Test User',
    };

    it('should call POST /auth/access-token with correct body', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse(mockPayload));

      const result = await client.exchangeAccessToken(params);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe(`${PROXY_URL}/auth/access-token`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body as string)).toEqual({
        requestToken: 'req_token_123',
        oauthVerifier: 'verifier_456',
      });
      expect(result).toEqual(mockPayload);
    });

    it('should throw UNAUTHORIZED on 401 response', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(401, 'Invalid OAuth verifier')
      );

      await expect(client.exchangeAccessToken(params)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
        retryable: false,
      });
    });

    it('should throw TIMEOUT when exchange takes too long', async () => {
      mockFetch.mockImplementationOnce(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );

      vi.useFakeTimers();
      const promise = client.exchangeAccessToken(params);
      vi.advanceTimersByTime(5001);

      await expect(promise).rejects.toMatchObject({
        code: 'TIMEOUT',
        retryable: true,
      });

      vi.useRealTimers();
    });

    it('should handle non-JSON error responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Bad Gateway', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      await expect(client.exchangeAccessToken(params)).rejects.toMatchObject({
        code: 'SERVER_ERROR',
        statusCode: 502,
        retryable: true,
      });
    });
  });

  // ─── refreshToken ─────────────────────────────────────────────────────────

  describe('refreshToken()', () => {
    const params = {
      encryptedRefreshToken: 'encrypted_refresh_token_value',
    };

    const mockPayload = {
      accessToken: 'new_encrypted_access',
      tokenSecret: 'new_encrypted_secret',
      refreshToken: 'new_encrypted_refresh',
      expiresAt: Date.now() + 3600000,
      userId: 'garmin_user_1',
      displayName: 'Test User',
    };

    it('should call POST /auth/refresh-token with correct body', async () => {
      mockFetch.mockResolvedValueOnce(createJsonResponse(mockPayload));

      const result = await client.refreshToken(params);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).toBe(`${PROXY_URL}/auth/refresh-token`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body as string)).toEqual({
        encryptedRefreshToken: 'encrypted_refresh_token_value',
      });
      expect(result).toEqual(mockPayload);
    });

    it('should throw UNAUTHORIZED on 401 (refresh token expired)', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(401, 'Refresh token expired')
      );

      await expect(client.refreshToken(params)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
        message: 'Refresh token expired',
        retryable: false,
      });
    });

    it('should throw RATE_LIMITED on 429 response', async () => {
      mockFetch.mockResolvedValueOnce(
        createErrorResponse(429, 'Too many requests')
      );

      await expect(client.refreshToken(params)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        statusCode: 429,
        retryable: true,
      });
    });

    it('should throw TIMEOUT when refresh takes too long', async () => {
      mockFetch.mockImplementationOnce(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          })
      );

      vi.useFakeTimers();
      const promise = client.refreshToken(params);
      vi.advanceTimersByTime(5001);

      await expect(promise).rejects.toMatchObject({
        code: 'TIMEOUT',
        retryable: true,
      });

      vi.useRealTimers();
    });

    it('should throw NETWORK_ERROR when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      await expect(client.refreshToken(params)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
      });
    });
  });

  // ─── URL Configuration ────────────────────────────────────────────────────

  describe('proxy URL configuration', () => {
    it('should strip trailing slash from proxy URL', async () => {
      vi.stubEnv('VITE_OAUTH_PROXY_URL', 'https://proxy.example.com/');
      const trailingSlashClient = createOAuthProxyClient();

      mockFetch.mockResolvedValueOnce(
        createJsonResponse({ redirectUrl: 'https://garmin.com', requestToken: 'tok' })
      );

      await trailingSlashClient.getRequestToken();

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe('https://proxy.example.com/auth/request-token');
    });

    it('should throw when VITE_OAUTH_PROXY_URL is not set', () => {
      vi.stubEnv('VITE_OAUTH_PROXY_URL', '');

      expect(() => createOAuthProxyClient()).toThrow(
        'VITE_OAUTH_PROXY_URL is not configured'
      );
    });
  });

  // ─── AbortController signal ───────────────────────────────────────────────

  describe('AbortController integration', () => {
    it('should pass an AbortSignal to fetch', async () => {
      mockFetch.mockResolvedValueOnce(
        createJsonResponse({ redirectUrl: 'https://garmin.com', requestToken: 'tok' })
      );

      await client.getRequestToken();

      const [, options] = mockFetch.mock.calls[0]!;
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
