import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

const mockEnv: Env = {
  GARMIN_CONSUMER_KEY: 'test-consumer-key',
  GARMIN_CONSUMER_SECRET: 'test-consumer-secret',
  ALLOWED_ORIGINS: 'http://localhost:5173,https://yourusername.github.io',
  ENCRYPTION_KEY: 'test-encryption-key-32bytes-long!',
};

const VALID_ORIGIN = 'http://localhost:5173';

function createMockCtx() {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

describe('Integration Tests: OAuth Proxy', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Origin Validation - Edge Cases', () => {
    it('rejects origins that are substrings of allowed origins (e.g. localhost:5173.evil.com)', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173.evil.com' },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(403);
    });

    it('rejects origins with allowed origin as prefix in path', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173/malicious' },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(403);
    });

    it('rejects origins with allowed origin embedded in subdomain', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'https://yourusername.github.io.evil.com' },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(403);
    });

    it('rejects all requests when ALLOWED_ORIGINS is empty', async () => {
      const ctx = createMockCtx();
      const emptyOriginsEnv: Env = {
        ...mockEnv,
        ALLOWED_ORIGINS: '',
      };

      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });

      const response = await worker.fetch(request, emptyOriginsEnv, ctx);
      expect(response.status).toBe(403);
    });

    it('rejects origins with different protocol (http vs https)', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'https://localhost:5173' },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(403);
    });

    it('rejects origins with trailing slash', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173/' },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(403);
    });
  });

  describe('Token Exchange Flow - Full Flow with Mocked Garmin API', () => {
    it('completes full request-token → access-token exchange', async () => {
      const ctx = createMockCtx();

      // Step 1: Mock Garmin request-token endpoint
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=req_token_abc&oauth_token_secret=req_secret_xyz&oauth_callback_confirmed=true', {
          status: 200,
        }),
      );

      const requestTokenReq = new Request('http://localhost/auth/request-token', {
        method: 'GET',
        headers: { Origin: VALID_ORIGIN },
      });

      const requestTokenResp = await worker.fetch(requestTokenReq, mockEnv, ctx);
      expect(requestTokenResp.status).toBe(200);

      const requestTokenBody = (await requestTokenResp.json()) as {
        redirectUrl: string;
        requestToken: string;
        requestTokenSecret: string;
      };
      expect(requestTokenBody.requestToken).toBe('req_token_abc');
      expect(requestTokenBody.requestTokenSecret).toBe('req_secret_xyz');
      expect(requestTokenBody.redirectUrl).toContain('oauth_token=req_token_abc');

      // Step 2: Mock Garmin access-token endpoint
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=access_token_123&oauth_token_secret=access_secret_456', {
          status: 200,
        }),
      );

      const accessTokenReq = new Request('http://localhost/auth/access-token', {
        method: 'POST',
        headers: {
          Origin: VALID_ORIGIN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestToken: requestTokenBody.requestToken,
          requestTokenSecret: requestTokenBody.requestTokenSecret,
          oauthVerifier: 'verifier_789',
        }),
      });

      const accessTokenResp = await worker.fetch(accessTokenReq, mockEnv, ctx);
      expect(accessTokenResp.status).toBe(200);

      const accessTokenBody = (await accessTokenResp.json()) as {
        encryptedAccessToken: string;
        encryptedTokenSecret: string;
        userId: string;
        expiresAt: number;
      };
      expect(accessTokenBody.encryptedAccessToken).toBeDefined();
      expect(accessTokenBody.encryptedTokenSecret).toBeDefined();
      expect(accessTokenBody.userId).toHaveLength(16);
      expect(accessTokenBody.expiresAt).toBeGreaterThan(Date.now());
    });

    it('handles concurrent token exchanges without interference', async () => {
      // Simulate 3 simultaneous token exchanges
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        const id = callCount;
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(
          `oauth_token=access_${id}&oauth_token_secret=secret_${id}`,
          { status: 200 },
        );
      });

      const exchanges = [1, 2, 3].map((i) => {
        const ctx = createMockCtx();
        const request = new Request('http://localhost/auth/access-token', {
          method: 'POST',
          headers: {
            Origin: VALID_ORIGIN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestToken: `request-token-${i}`,
            requestTokenSecret: `request-secret-${i}`,
            oauthVerifier: `verifier-${i}`,
          }),
        });
        return worker.fetch(request, mockEnv, ctx);
      });

      const responses = await Promise.all(exchanges);

      // All should succeed
      for (const resp of responses) {
        expect(resp.status).toBe(200);
      }

      // Each should return different encrypted tokens
      const bodies = await Promise.all(
        responses.map((r) => r.json() as Promise<{ encryptedAccessToken: string; encryptedTokenSecret: string }>),
      );

      const tokenSet = new Set(bodies.map((b) => b.encryptedAccessToken));
      expect(tokenSet.size).toBe(3); // All 3 are unique
    });
  });

  describe('Token Memory Cleanup Timing', () => {
    it('calls ctx.waitUntil with a cleanup promise for access-token endpoint', async () => {
      const ctx = createMockCtx();
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=token&oauth_token_secret=secret', { status: 200 }),
      );

      const request = new Request('http://localhost/auth/access-token', {
        method: 'POST',
        headers: {
          Origin: VALID_ORIGIN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestToken: 'token',
          requestTokenSecret: 'secret',
          oauthVerifier: 'verifier',
        }),
      });

      await worker.fetch(request, mockEnv, ctx);
      expect(ctx.waitUntil).toHaveBeenCalledTimes(1);

      // The argument to waitUntil should be a Promise
      const waitUntilArg = (ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(waitUntilArg).toBeInstanceOf(Promise);
    });

    it('calls ctx.waitUntil with a cleanup promise for refresh-token endpoint', async () => {
      const { encrypt } = await import('../src/crypto');
      const ctx = createMockCtx();

      const encryptedAccessToken = await encrypt('access-token', mockEnv.ENCRYPTION_KEY);
      const encryptedTokenSecret = await encrypt('token-secret', mockEnv.ENCRYPTION_KEY);

      const request = new Request('http://localhost/auth/refresh-token', {
        method: 'POST',
        headers: {
          Origin: VALID_ORIGIN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ encryptedAccessToken, encryptedTokenSecret }),
      });

      await worker.fetch(request, mockEnv, ctx);
      expect(ctx.waitUntil).toHaveBeenCalled();

      const waitUntilArg = (ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(waitUntilArg).toBeInstanceOf(Promise);
    });

    it('cleanup promise resolves after ~30 seconds (using fake timers)', async () => {
      vi.useFakeTimers();
      const ctx = createMockCtx();

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('oauth_token=token&oauth_token_secret=secret', { status: 200 }),
      );

      const request = new Request('http://localhost/auth/access-token', {
        method: 'POST',
        headers: {
          Origin: VALID_ORIGIN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestToken: 'token',
          requestTokenSecret: 'secret',
          oauthVerifier: 'verifier',
        }),
      });

      await worker.fetch(request, mockEnv, ctx);
      const cleanupPromise = (ctx.waitUntil as ReturnType<typeof vi.fn>).mock.calls[0][0];

      // Promise should not be resolved yet
      let resolved = false;
      cleanupPromise.then(() => { resolved = true; });

      // Advance just under 30 seconds — should not resolve yet
      vi.advanceTimersByTime(29_000);
      await Promise.resolve(); // Flush microtasks
      expect(resolved).toBe(false);

      // Advance past 30 seconds — should resolve
      vi.advanceTimersByTime(2_000);
      await Promise.resolve(); // Flush microtasks
      expect(resolved).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Edge Cases - HTTP Method and Body Handling', () => {
    it('returns 404 for POST to GET-only /auth/request-token endpoint', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/request-token', {
        method: 'POST',
        headers: {
          Origin: VALID_ORIGIN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(404);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('not_found');
    });

    it('returns 404 for GET to POST-only /auth/access-token endpoint', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/access-token', {
        method: 'GET',
        headers: { Origin: VALID_ORIGIN },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(404);
    });

    it('returns 404 for GET to POST-only /auth/refresh-token endpoint', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/refresh-token', {
        method: 'GET',
        headers: { Origin: VALID_ORIGIN },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(404);
    });

    it('handles very large request bodies gracefully', async () => {
      const ctx = createMockCtx();
      // Create a 1MB JSON body
      const largeBody = JSON.stringify({
        requestToken: 'a'.repeat(500_000),
        requestTokenSecret: 'b'.repeat(500_000),
        oauthVerifier: 'verifier',
      });

      const request = new Request('http://localhost/auth/access-token', {
        method: 'POST',
        headers: {
          Origin: VALID_ORIGIN,
          'Content-Type': 'application/json',
        },
        body: largeBody,
      });

      // Should not throw - should either succeed (by making Garmin call) or return an error response
      const response = await worker.fetch(request, mockEnv, ctx);
      expect([200, 400, 502]).toContain(response.status);
    });

    it('handles empty request body for POST endpoints', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/access-token', {
        method: 'POST',
        headers: {
          Origin: VALID_ORIGIN,
          'Content-Type': 'application/json',
        },
        body: '',
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(400);

      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('invalid_request');
    });
  });

  describe('CORS Preflight - Various Headers', () => {
    it('handles preflight with Access-Control-Request-Headers', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/access-token', {
        method: 'OPTIONS',
        headers: {
          Origin: VALID_ORIGIN,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });

    it('handles preflight for any path with valid origin', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/some/arbitrary/path', {
        method: 'OPTIONS',
        headers: { Origin: VALID_ORIGIN },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN);
    });

    it('sets Access-Control-Max-Age header for caching preflight', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/request-token', {
        method: 'OPTIONS',
        headers: { Origin: VALID_ORIGIN },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('returns 403 for preflight from unauthorized origin', async () => {
      const ctx = createMockCtx();
      const request = new Request('http://localhost/auth/access-token', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://attacker.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const response = await worker.fetch(request, mockEnv, ctx);
      expect(response.status).toBe(403);
    });
  });
});
