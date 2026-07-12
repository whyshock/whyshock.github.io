/**
 * OAuth proxy client service.
 * Communicates with the Cloudflare Worker OAuth proxy to handle
 * Garmin OAuth 1.0a token exchange securely without exposing secrets.
 *
 * Validates: Requirements 1.1, 1.2, 1.5, 1.6, 11.4
 */

import type {
  OAuthProxyAPI,
  RequestTokenResponse,
  EncryptedTokenPayload,
  AccessTokenRequest,
  RefreshTokenRequest,
  APIError,
  APIErrorCode,
} from '@/types/api';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum timeout for token exchange operations (5 seconds per Req 1.2) */
const TOKEN_EXCHANGE_TIMEOUT_MS = 5000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProxyBaseUrl(): string {
  const url = import.meta.env.VITE_OAUTH_PROXY_URL;
  if (!url) {
    throw new Error(
      'VITE_OAUTH_PROXY_URL is not configured. Set it as a build-time environment variable.'
    );
  }
  // Strip trailing slash for consistent URL construction
  return url.replace(/\/+$/, '');
}

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

function mapHttpStatusToErrorCode(status: number): APIErrorCode {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN_ERROR';
}

function isRetryableStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

/**
 * Handles non-200 responses by parsing the error body and throwing a typed APIError.
 */
async function handleErrorResponse(response: Response): Promise<never> {
  const code = mapHttpStatusToErrorCode(response.status);
  let message = `OAuth proxy request failed with status ${response.status}`;

  try {
    const body = await response.json();
    if (body?.error?.message) {
      message = body.error.message;
    } else if (body?.message) {
      message = body.message;
    }
  } catch {
    // Body wasn't JSON — use default message
  }

  throw createAPIError(code, message, response.status, isRetryableStatus(response.status));
}

/**
 * Wraps a fetch request with an AbortController timeout.
 * Throws a TIMEOUT APIError if the request exceeds the specified duration.
 */
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
      throw createAPIError(
        'TIMEOUT',
        `Request timed out after ${timeoutMs}ms`,
        undefined,
        true
      );
    }
    // Network-level failure (no internet, DNS, etc.)
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

// ─── OAuth Proxy Client ───────────────────────────────────────────────────────

/**
 * Creates an OAuthProxyAPI client that communicates with the OAuth proxy worker.
 * The proxy URL is loaded from the VITE_OAUTH_PROXY_URL environment variable.
 */
export function createOAuthProxyClient(): OAuthProxyAPI {
  const baseUrl = getProxyBaseUrl();

  return {
    /**
     * Initiates the OAuth 1.0a flow by requesting a request token from the proxy.
     * The proxy returns a redirect URL for Garmin authorization.
     *
     * Validates: Requirement 1.1 — redirect within 2 seconds
     */
    async getRequestToken(): Promise<RequestTokenResponse> {
      const response = await fetchWithTimeout(
        `${baseUrl}/auth/request-token`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TOKEN_EXCHANGE_TIMEOUT_MS
      );

      if (!response.ok) {
        await handleErrorResponse(response);
      }

      const data: RequestTokenResponse = await response.json();
      return data;
    },

    /**
     * Exchanges a request token and OAuth verifier for encrypted access tokens.
     * Must complete within 5 seconds (Req 1.2).
     *
     * Validates: Requirement 1.2 — token exchange within 5 seconds
     */
    async exchangeAccessToken(params: AccessTokenRequest): Promise<EncryptedTokenPayload> {
      const response = await fetchWithTimeout(
        `${baseUrl}/auth/access-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestToken: params.requestToken,
            oauthVerifier: params.oauthVerifier,
          }),
        },
        TOKEN_EXCHANGE_TIMEOUT_MS
      );

      if (!response.ok) {
        await handleErrorResponse(response);
      }

      const data: EncryptedTokenPayload = await response.json();
      return data;
    },

    /**
     * Refreshes an expired access token using the encrypted refresh token.
     * Must complete within 5 seconds (Req 1.6).
     *
     * Validates: Requirement 1.6 — token refresh within 5 seconds
     */
    async refreshToken(params: RefreshTokenRequest): Promise<EncryptedTokenPayload> {
      const response = await fetchWithTimeout(
        `${baseUrl}/auth/refresh-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encryptedRefreshToken: params.encryptedRefreshToken,
          }),
        },
        TOKEN_EXCHANGE_TIMEOUT_MS
      );

      if (!response.ok) {
        await handleErrorResponse(response);
      }

      const data: EncryptedTokenPayload = await response.json();
      return data;
    },
  };
}

/**
 * Singleton OAuth proxy client instance for use throughout the application.
 * Lazily initialized on first access to avoid import-time errors when
 * the environment variable isn't set (e.g., in test environments).
 */
let _client: OAuthProxyAPI | null = null;

export function getOAuthProxyClient(): OAuthProxyAPI {
  if (!_client) {
    _client = createOAuthProxyClient();
  }
  return _client;
}

/**
 * Resets the singleton client. Useful for testing.
 */
export function resetOAuthProxyClient(): void {
  _client = null;
}
