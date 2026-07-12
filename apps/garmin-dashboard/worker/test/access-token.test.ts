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
  waitUntil: vi.fn(),
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const VALID_ORIGIN = 'http://localhost:5173';

function createAccessTokenRequest(body: unknown): Request {
  return new Request('http://localhost/auth/access-token', {
    method: 'POST',
    headers: {
      Origin: VALID_ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /auth/access-token', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/auth/access-token', {
      method: 'POST',
      headers: {
        Origin: VALID_ORIGIN,
        'Content-Type': 'application/json',
      },
      body: 'not valid json',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const body = await response.json() as { error: string; message: string };
    expect(body.error).toBe('invalid_request');
    expect(body.message).toContain('valid JSON');
  });

  it('returns 400 when requestToken is missing', async () => {
    const request = createAccessTokenRequest({
      requestTokenSecret: 'secret',
      oauthVerifier: 'verifier',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const body = await response.json() as { error: string; message: string };
    expect(body.error).toBe('invalid_request');
    expect(body.message).toContain('requestToken');
  });

  it('returns 400 when requestTokenSecret is missing', async () => {
    const request = createAccessTokenRequest({
      requestToken: 'token',
      oauthVerifier: 'verifier',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const body = await response.json() as { error: string; message: string };
    expect(body.error).toBe('invalid_request');
    expect(body.message).toContain('requestTokenSecret');
  });

  it('returns 400 when oauthVerifier is missing', async () => {
    const request = createAccessTokenRequest({
      requestToken: 'token',
      requestTokenSecret: 'secret',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const body = await response.json() as { error: string; message: string };
    expect(body.error).toBe('invalid_request');
    expect(body.message).toContain('oauthVerifier');
  });

  it('returns 502 when Garmin API returns an error', async () => {
    // Mock fetch to simulate Garmin API error
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const request = createAccessTokenRequest({
      requestToken: 'test-request-token',
      requestTokenSecret: 'test-request-secret',
      oauthVerifier: 'test-verifier',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(502);

    const body = await response.json() as { error: string; message: string };
    expect(body.error).toBe('token_exchange_failed');
    expect(body.message).toContain('401');

    fetchSpy.mockRestore();
  });

  it('returns 502 when Garmin API returns empty tokens', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('some_other_param=value', { status: 200 }),
    );

    const request = createAccessTokenRequest({
      requestToken: 'test-request-token',
      requestTokenSecret: 'test-request-secret',
      oauthVerifier: 'test-verifier',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(502);

    const body = await response.json() as { error: string; message: string };
    expect(body.error).toBe('token_exchange_failed');
    expect(body.message).toContain('valid access tokens');

    fetchSpy.mockRestore();
  });

  it('returns 200 with encrypted tokens on successful exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('oauth_token=access-token-123&oauth_token_secret=access-secret-456', {
        status: 200,
      }),
    );

    const request = createAccessTokenRequest({
      requestToken: 'test-request-token',
      requestTokenSecret: 'test-request-secret',
      oauthVerifier: 'test-verifier',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);

    const body = await response.json() as {
      encryptedAccessToken: string;
      encryptedTokenSecret: string;
      userId: string;
      displayName: string;
      expiresAt: number;
    };

    expect(body.encryptedAccessToken).toBeDefined();
    expect(body.encryptedAccessToken).not.toBe('');
    // Encrypted tokens should be base64 and different from plaintext
    expect(body.encryptedAccessToken).not.toBe('access-token-123');

    expect(body.encryptedTokenSecret).toBeDefined();
    expect(body.encryptedTokenSecret).not.toBe('');
    expect(body.encryptedTokenSecret).not.toBe('access-secret-456');

    expect(body.userId).toBeDefined();
    expect(body.userId.length).toBe(16); // 8 bytes as hex = 16 chars

    expect(body.displayName).toBeDefined();

    expect(body.expiresAt).toBeGreaterThan(Date.now());

    fetchSpy.mockRestore();
  });

  it('includes CORS headers in successful response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('oauth_token=token&oauth_token_secret=secret', { status: 200 }),
    );

    const request = createAccessTokenRequest({
      requestToken: 'test-request-token',
      requestTokenSecret: 'test-request-secret',
      oauthVerifier: 'test-verifier',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN);

    fetchSpy.mockRestore();
  });

  it('includes CORS headers in error responses', async () => {
    const request = createAccessTokenRequest({});

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN);
  });

  it('calls ctx.waitUntil for token cleanup scheduling', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('oauth_token=token&oauth_token_secret=secret', { status: 200 }),
    );

    const request = createAccessTokenRequest({
      requestToken: 'test-request-token',
      requestTokenSecret: 'test-request-secret',
      oauthVerifier: 'test-verifier',
    });

    await worker.fetch(request, mockEnv, mockCtx);
    expect(mockCtx.waitUntil).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('returns 502 when fetch throws a network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network timeout'),
    );

    const request = createAccessTokenRequest({
      requestToken: 'test-request-token',
      requestTokenSecret: 'test-request-secret',
      oauthVerifier: 'test-verifier',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(502);

    const body = await response.json() as { error: string; message: string };
    expect(body.error).toBe('token_exchange_failed');
    expect(body.message).toContain('Network timeout');

    fetchSpy.mockRestore();
  });

  it('sends OAuth Authorization header to Garmin API', async () => {
    let capturedHeaders: Headers | null = null;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      async (input, init) => {
        capturedHeaders = new Headers(init?.headers as HeadersInit);
        return new Response('oauth_token=token&oauth_token_secret=secret', { status: 200 });
      },
    );

    const request = createAccessTokenRequest({
      requestToken: 'test-request-token',
      requestTokenSecret: 'test-request-secret',
      oauthVerifier: 'test-verifier',
    });

    await worker.fetch(request, mockEnv, mockCtx);

    expect(capturedHeaders).not.toBeNull();
    const authHeader = capturedHeaders!.get('Authorization');
    expect(authHeader).toBeDefined();
    expect(authHeader).toContain('OAuth');
    expect(authHeader).toContain('oauth_consumer_key');
    expect(authHeader).toContain('test-consumer-key');
    expect(authHeader).toContain('oauth_token');
    expect(authHeader).toContain('test-request-token');
    expect(authHeader).toContain('oauth_verifier');
    expect(authHeader).toContain('test-verifier');
    expect(authHeader).toContain('oauth_signature');

    fetchSpy.mockRestore();
  });

  it('POSTs to the correct Garmin access token URL', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      async (input, init) => {
        capturedUrl = typeof input === 'string' ? input : (input as Request).url;
        capturedMethod = init?.method || 'GET';
        return new Response('oauth_token=token&oauth_token_secret=secret', { status: 200 });
      },
    );

    const request = createAccessTokenRequest({
      requestToken: 'test-request-token',
      requestTokenSecret: 'test-request-secret',
      oauthVerifier: 'test-verifier',
    });

    await worker.fetch(request, mockEnv, mockCtx);

    expect(capturedUrl).toBe(
      'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    );
    expect(capturedMethod).toBe('POST');

    fetchSpy.mockRestore();
  });
});
