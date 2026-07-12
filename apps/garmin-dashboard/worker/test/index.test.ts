import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

const mockEnv: Env = {
  GARMIN_CONSUMER_KEY: 'test-consumer-key',
  GARMIN_CONSUMER_SECRET: 'test-consumer-secret',
  ALLOWED_ORIGINS: 'http://localhost:5173,https://yourusername.github.io',
  ENCRYPTION_KEY: 'test-encryption-key-32bytes-long!',
};

const mockCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe('Garmin OAuth Proxy Worker', () => {
  describe('GET /health', () => {
    it('returns 200 with status ok and ISO timestamp', async () => {
      const request = new Request('http://localhost/health', { method: 'GET' });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(200);

      const body = (await response.json()) as { status: string; timestamp: string };
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('returns Content-Type application/json', async () => {
      const request = new Request('http://localhost/health', { method: 'GET' });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('does not require Origin header for health check', async () => {
      const request = new Request('http://localhost/health', { method: 'GET' });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(200);
    });
  });

  describe('Origin validation', () => {
    it('returns 403 for requests without Origin header on protected endpoints', async () => {
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error: string; message: string };
      expect(body.error).toBe('forbidden');
      expect(body.message).toBe('Origin not allowed');
    });

    it('returns 403 for requests from unauthorized origins', async () => {
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'https://malicious-site.com' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(403);
    });

    it('allows requests from authorized origins (localhost:5173)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=t&oauth_token_secret=s&oauth_callback_confirmed=true', {
          status: 200,
        }),
      );

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).not.toBe(403);
    });

    it('allows requests from authorized origins (github pages)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=t&oauth_token_secret=s&oauth_callback_confirmed=true', {
          status: 200,
        }),
      );

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'https://yourusername.github.io' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).not.toBe(403);
    });
  });

  describe('CORS preflight', () => {
    it('handles OPTIONS request from allowed origin with 204', async () => {
      const request = new Request('http://localhost/auth/request-token', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });

    it('rejects OPTIONS request from disallowed origin with 403', async () => {
      const request = new Request('http://localhost/auth/request-token', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.com' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(403);
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 for unknown paths with valid origin', async () => {
      const request = new Request('http://localhost/unknown', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('not_found');
    });

    it('includes CORS headers in 404 response', async () => {
      const request = new Request('http://localhost/unknown', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });
  });

  describe('GET /auth/request-token', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('returns redirectUrl, requestToken, and requestTokenSecret on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=test_token_123&oauth_token_secret=test_secret_456&oauth_callback_confirmed=true', {
          status: 200,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        redirectUrl: string;
        requestToken: string;
        requestTokenSecret: string;
      };
      expect(body.redirectUrl).toContain('https://connect.garmin.com/oauthConfirm');
      expect(body.redirectUrl).toContain('oauth_token=test_token_123');
      expect(body.requestToken).toBe('test_token_123');
      expect(body.requestTokenSecret).toBe('test_secret_456');
    });

    it('includes CORS headers in successful response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=abc&oauth_token_secret=def&oauth_callback_confirmed=true', {
          status: 200,
        }),
      );

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });

    it('sends correct OAuth parameters to Garmin API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=t&oauth_token_secret=s&oauth_callback_confirmed=true', {
          status: 200,
        }),
      );

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      await worker.fetch(request, mockEnv, mockCtx);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('https://connectapi.garmin.com/oauth-service/oauth/request_token');
      expect(options.method).toBe('POST');

      const authHeader = options.headers.Authorization as string;
      expect(authHeader).toContain('OAuth');
      expect(authHeader).toContain('oauth_consumer_key="test-consumer-key"');
      expect(authHeader).toContain('oauth_signature_method="HMAC-SHA1"');
      expect(authHeader).toContain('oauth_version="1.0"');
      expect(authHeader).toContain('oauth_callback=');
      expect(authHeader).toContain('oauth_nonce=');
      expect(authHeader).toContain('oauth_timestamp=');
      expect(authHeader).toContain('oauth_signature=');
    });

    it('uses origin-based callback URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=t&oauth_token_secret=s&oauth_callback_confirmed=true', {
          status: 200,
        }),
      );

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'https://yourusername.github.io' },
      });
      await worker.fetch(request, mockEnv, mockCtx);

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const authHeader = options.headers.Authorization as string;
      expect(authHeader).toContain(encodeURIComponent('https://yourusername.github.io/callback'));
    });

    it('returns 502 when Garmin API returns an error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_problem=consumer_key_refused', {
          status: 401,
        }),
      );

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(502);
      const body = (await response.json()) as { error: string; message: string };
      expect(body.error).toBe('token_request_failed');
      expect(body.message).toContain('Garmin API returned 401');
    });

    it('returns 502 when Garmin API returns invalid response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('some_unexpected_response=true', {
          status: 200,
        }),
      );

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(502);
      const body = (await response.json()) as { error: string; message: string };
      expect(body.error).toBe('token_request_failed');
      expect(body.message).toContain('missing oauth_token');
    });

    it('returns 502 when fetch throws a network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(502);
      const body = (await response.json()) as { error: string; message: string };
      expect(body.error).toBe('token_request_failed');
      expect(body.message).toContain('Network unreachable');
    });

    it('returns 403 for request without Origin header', async () => {
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(403);
    });

    it('returns 403 for request from unauthorized origin', async () => {
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'https://evil.com' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      expect(response.status).toBe(403);
    });
  });

  describe('Stub endpoints', () => {
    it('POST /auth/access-token is implemented (no longer returns 501)', async () => {
      const request = new Request('http://localhost/auth/access-token', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      // Should return 400 (validation error) instead of 501 since it's now implemented
      expect(response.status).toBe(400);
    });

    it('POST /auth/refresh-token is implemented (no longer returns 501)', async () => {
      const request = new Request('http://localhost/auth/refresh-token', {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173' },
      });
      const response = await worker.fetch(request, mockEnv, mockCtx);

      // Should return 400 (invalid request body) rather than 501
      expect(response.status).toBe(400);
    });
  });
});
