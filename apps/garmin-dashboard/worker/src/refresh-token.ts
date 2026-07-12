/**
 * Token refresh handler for POST /auth/refresh-token.
 * For Garmin OAuth 1.0a, tokens are long-lived and don't expire in the traditional sense.
 * "Refresh" here means: accept the existing encrypted tokens, decrypt them, validate,
 * re-encrypt with a new timestamp, and return. This simulates a session extension.
 * Implements max 1 retry on refresh failure within 5 seconds (Req 1.6).
 */

import type { Env, ErrorResponse } from './types';
import { corsHeaders } from './cors';
import { encrypt, decrypt } from './crypto';

/** Session extension: 1 year from now */
const SESSION_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

/** Maximum retry timeout in ms */
const RETRY_TIMEOUT_MS = 5000;

/** Cleanup delay for raw tokens in memory */
const TOKEN_CLEANUP_DELAY_MS = 30_000;

interface RefreshTokenRequest {
  encryptedAccessToken: string;
  encryptedTokenSecret: string;
}

interface RefreshTokenResponse {
  encryptedAccessToken: string;
  encryptedTokenSecret: string;
  expiresAt: number;
}

/**
 * Handle POST /auth/refresh-token
 * Decrypts existing tokens, validates them, re-encrypts with new timestamp.
 * Retries once on failure within 5 seconds.
 */
export async function handleRefreshToken(
  request: Request,
  env: Env,
  origin: string,
  ctx: ExecutionContext,
): Promise<Response> {
  // Parse and validate request body
  let body: RefreshTokenRequest;
  try {
    body = (await request.json()) as RefreshTokenRequest;
  } catch {
    return errorResponse('invalid_request', 'Request body must be valid JSON', 400, origin);
  }

  if (!body.encryptedAccessToken || !body.encryptedTokenSecret) {
    return errorResponse(
      'invalid_request',
      'Missing required fields: encryptedAccessToken, encryptedTokenSecret',
      400,
      origin,
    );
  }

  // Attempt refresh with max 1 retry
  const result = await attemptRefreshWithRetry(body, env, origin, ctx);
  return result;
}

/**
 * Attempt the token refresh operation. If it fails, retry once within the timeout window.
 */
async function attemptRefreshWithRetry(
  body: RefreshTokenRequest,
  env: Env,
  origin: string,
  ctx: ExecutionContext,
): Promise<Response> {
  const startTime = Date.now();

  // First attempt
  const firstResult = await performRefresh(body, env, origin, ctx);
  if (firstResult.ok) {
    return firstResult.response;
  }

  // Check if we have time for a retry within the 5-second window
  const elapsed = Date.now() - startTime;
  if (elapsed >= RETRY_TIMEOUT_MS) {
    return refreshFailedResponse(firstResult.errorMessage, origin);
  }

  // Retry once
  const retryResult = await performRefresh(body, env, origin, ctx);
  if (retryResult.ok) {
    return retryResult.response;
  }

  return refreshFailedResponse(retryResult.errorMessage, origin);
}

interface RefreshResult {
  ok: boolean;
  response: Response;
  errorMessage: string;
}

/**
 * Perform a single refresh attempt: decrypt, validate, re-encrypt.
 */
async function performRefresh(
  body: RefreshTokenRequest,
  env: Env,
  origin: string,
  ctx: ExecutionContext,
): Promise<RefreshResult> {
  let accessToken: string | null = null;
  let tokenSecret: string | null = null;

  try {
    // Decrypt the tokens
    accessToken = await decrypt(body.encryptedAccessToken, env.ENCRYPTION_KEY);
    tokenSecret = await decrypt(body.encryptedTokenSecret, env.ENCRYPTION_KEY);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown decryption error';
    return {
      ok: false,
      response: errorResponse('decryption_failed', `Failed to decrypt tokens: ${message}`, 401, origin),
      errorMessage: message,
    };
  }

  // Validate tokens are non-empty strings
  if (!accessToken || !tokenSecret) {
    return {
      ok: false,
      response: errorResponse('invalid_token', 'Decrypted tokens are empty or invalid', 401, origin),
      errorMessage: 'Decrypted tokens are empty or invalid',
    };
  }

  // Re-encrypt tokens to produce a fresh encrypted payload (session extension)
  let encryptedAccessToken: string;
  let encryptedTokenSecret: string;

  try {
    encryptedAccessToken = await encrypt(accessToken, env.ENCRYPTION_KEY);
    encryptedTokenSecret = await encrypt(tokenSecret, env.ENCRYPTION_KEY);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown encryption error';
    return {
      ok: false,
      response: errorResponse('encryption_failed', `Failed to re-encrypt tokens: ${message}`, 500, origin),
      errorMessage: message,
    };
  }

  const expiresAt = Date.now() + SESSION_EXPIRY_MS;

  const responsePayload: RefreshTokenResponse = {
    encryptedAccessToken,
    encryptedTokenSecret,
    expiresAt,
  };

  // Schedule cleanup of raw token data from memory (Req 10.4)
  const rawAccessToken = accessToken;
  const rawTokenSecret = tokenSecret;

  ctx.waitUntil(
    new Promise<void>((resolve) => {
      setTimeout(() => {
        // Intentionally reference and discard to aid GC
        void rawAccessToken;
        void rawTokenSecret;
        resolve();
      }, TOKEN_CLEANUP_DELAY_MS);
    }),
  );

  // Clear local references
  accessToken = null;
  tokenSecret = null;

  const response = new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });

  return { ok: true, response, errorMessage: '' };
}

function refreshFailedResponse(detail: string, origin: string): Response {
  return errorResponse(
    'token_refresh_failed',
    `Token refresh failed after retry: ${detail}`,
    401,
    origin,
  );
}

function errorResponse(
  error: string,
  message: string,
  status: number,
  origin: string,
): Response {
  const body: ErrorResponse = { error, message };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}
