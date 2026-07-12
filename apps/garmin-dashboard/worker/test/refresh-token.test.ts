import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';
import { encrypt } from '../src/crypto';

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

function createRefreshTokenRequest(body: unknown): Request {
  return new Request('http://localhost/auth/refresh-token', {
    method: 'POST',
    headers: {
      Origin: VALID_ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /auth/refresh-token', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/auth/refresh-token', {
      method: 'POST',
      headers: {
        Origin: VALID_ORIGIN,
        'Content-Type': 'application/json',
      },
      body: 'not valid json',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe('invalid_request');
    expect(body.message).toContain('valid JSON');
  });

  it('returns 400 when encryptedAccessToken is missing', async () => {
    const request = createRefreshTokenRequest({
      encryptedTokenSecret: 'some-encrypted-value',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe('invalid_request');
    expect(body.message).toContain('encryptedAccessToken');
  });

  it('returns 400 when encryptedTokenSecret is missing', async () => {
    const request = createRefreshTokenRequest({
      encryptedAccessToken: 'some-encrypted-value',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);

    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe('invalid_request');
    expect(body.message).toContain('encryptedTokenSecret');
  });

  it('returns 401 when tokens cannot be decrypted (invalid ciphertext)', async () => {
    const request = createRefreshTokenRequest({
      encryptedAccessToken: 'not-valid-base64-encrypted-data',
      encryptedTokenSecret: 'not-valid-base64-encrypted-data',
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    // After retry, returns 401
    expect(response.status).toBe(401);

    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe('token_refresh_failed');
    expect(body.message).toContain('Token refresh failed after retry');
  });

  it('returns 200 with new encrypted tokens on successful refresh', async () => {
    // First encrypt real tokens to create valid input
    const originalAccessToken = 'my-access-token-123';
    const originalTokenSecret = 'my-token-secret-456';

    const encryptedAccessToken = await encrypt(originalAccessToken, mockEnv.ENCRYPTION_KEY);
    const encryptedTokenSecret = await encrypt(originalTokenSecret, mockEnv.ENCRYPTION_KEY);

    const request = createRefreshTokenRequest({
      encryptedAccessToken,
      encryptedTokenSecret,
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      encryptedAccessToken: string;
      encryptedTokenSecret: string;
      expiresAt: number;
    };

    // New encrypted tokens should be defined and non-empty
    expect(body.encryptedAccessToken).toBeDefined();
    expect(body.encryptedAccessToken).not.toBe('');
    // Re-encryption produces a different ciphertext (new IV)
    expect(body.encryptedAccessToken).not.toBe(encryptedAccessToken);

    expect(body.encryptedTokenSecret).toBeDefined();
    expect(body.encryptedTokenSecret).not.toBe('');
    expect(body.encryptedTokenSecret).not.toBe(encryptedTokenSecret);

    // Expiry should be in the future (roughly 1 year from now)
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    expect(body.expiresAt).toBeLessThanOrEqual(Date.now() + 365 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('includes CORS headers in successful response', async () => {
    const encryptedAccessToken = await encrypt('token', mockEnv.ENCRYPTION_KEY);
    const encryptedTokenSecret = await encrypt('secret', mockEnv.ENCRYPTION_KEY);

    const request = createRefreshTokenRequest({
      encryptedAccessToken,
      encryptedTokenSecret,
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN);
  });

  it('includes CORS headers in error responses', async () => {
    const request = createRefreshTokenRequest({});

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(VALID_ORIGIN);
  });

  it('calls ctx.waitUntil for token cleanup scheduling on success', async () => {
    const encryptedAccessToken = await encrypt('token', mockEnv.ENCRYPTION_KEY);
    const encryptedTokenSecret = await encrypt('secret', mockEnv.ENCRYPTION_KEY);

    const request = createRefreshTokenRequest({
      encryptedAccessToken,
      encryptedTokenSecret,
    });

    await worker.fetch(request, mockEnv, mockCtx);
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });

  it('returns 403 for unauthorized origin', async () => {
    const encryptedAccessToken = await encrypt('token', mockEnv.ENCRYPTION_KEY);
    const encryptedTokenSecret = await encrypt('secret', mockEnv.ENCRYPTION_KEY);

    const request = new Request('http://localhost/auth/refresh-token', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ encryptedAccessToken, encryptedTokenSecret }),
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(403);
  });

  it('refreshed tokens can be decrypted back to original values', async () => {
    const { decrypt } = await import('../src/crypto');

    const originalAccessToken = 'original-access-token';
    const originalTokenSecret = 'original-token-secret';

    const encryptedAccessToken = await encrypt(originalAccessToken, mockEnv.ENCRYPTION_KEY);
    const encryptedTokenSecret = await encrypt(originalTokenSecret, mockEnv.ENCRYPTION_KEY);

    const request = createRefreshTokenRequest({
      encryptedAccessToken,
      encryptedTokenSecret,
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      encryptedAccessToken: string;
      encryptedTokenSecret: string;
      expiresAt: number;
    };

    // Decrypt the refreshed tokens — they should contain the same plaintext
    const decryptedAccess = await decrypt(body.encryptedAccessToken, mockEnv.ENCRYPTION_KEY);
    const decryptedSecret = await decrypt(body.encryptedTokenSecret, mockEnv.ENCRYPTION_KEY);

    expect(decryptedAccess).toBe(originalAccessToken);
    expect(decryptedSecret).toBe(originalTokenSecret);
  });

  it('returns updated expiresAt timestamp on each refresh call', async () => {
    const encryptedAccessToken = await encrypt('token', mockEnv.ENCRYPTION_KEY);
    const encryptedTokenSecret = await encrypt('secret', mockEnv.ENCRYPTION_KEY);

    const beforeTime = Date.now();

    const request = createRefreshTokenRequest({
      encryptedAccessToken,
      encryptedTokenSecret,
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);

    const afterTime = Date.now();
    const body = (await response.json()) as { expiresAt: number };

    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    expect(body.expiresAt).toBeGreaterThanOrEqual(beforeTime + oneYearMs);
    expect(body.expiresAt).toBeLessThanOrEqual(afterTime + oneYearMs);
  });
});
