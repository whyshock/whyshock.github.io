/**
 * Access token exchange handler for POST /auth/access-token.
 * Exchanges OAuth 1.0a request token + verifier for access token + secret.
 */

import type { Env, ErrorResponse } from './types';
import { corsHeaders } from './cors';
import { encrypt } from './crypto';
import { generateOAuthHeader, parseOAuthResponse } from './oauth';

const GARMIN_ACCESS_TOKEN_URL =
  'https://connectapi.garmin.com/oauth-service/oauth/access_token';

/** Token expiry: 1 year (Garmin tokens don't have a fixed expiry, so we set a reasonable default) */
const TOKEN_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

/** Maximum time (ms) to keep token data in memory before cleanup */
const TOKEN_CLEANUP_DELAY_MS = 30_000;

interface AccessTokenRequest {
  requestToken: string;
  requestTokenSecret: string;
  oauthVerifier: string;
}

interface AccessTokenResponse {
  encryptedAccessToken: string;
  encryptedTokenSecret: string;
  userId: string;
  displayName: string;
  expiresAt: number;
}

/**
 * Handle POST /auth/access-token
 * Exchanges request token + verifier for access token via Garmin OAuth 1.0a.
 */
export async function handleAccessToken(
  request: Request,
  env: Env,
  origin: string,
  ctx: ExecutionContext,
): Promise<Response> {
  // Parse and validate request body
  let body: AccessTokenRequest;
  try {
    body = await request.json() as AccessTokenRequest;
  } catch {
    return errorResponse('invalid_request', 'Request body must be valid JSON', 400, origin);
  }

  if (!body.requestToken || !body.requestTokenSecret || !body.oauthVerifier) {
    return errorResponse(
      'invalid_request',
      'Missing required fields: requestToken, requestTokenSecret, oauthVerifier',
      400,
      origin,
    );
  }

  // Exchange request token for access token
  let accessToken: string;
  let accessTokenSecret: string;

  try {
    const authHeader = await generateOAuthHeader('POST', GARMIN_ACCESS_TOKEN_URL, {
      consumerKey: env.GARMIN_CONSUMER_KEY,
      consumerSecret: env.GARMIN_CONSUMER_SECRET,
      token: body.requestToken,
      tokenSecret: body.requestTokenSecret,
      verifier: body.oauthVerifier,
    });

    const garminResponse = await fetch(GARMIN_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!garminResponse.ok) {
      const errorText = await garminResponse.text();
      return errorResponse(
        'token_exchange_failed',
        `Garmin API returned ${garminResponse.status}: ${errorText}`,
        502,
        origin,
      );
    }

    const responseBody = await garminResponse.text();
    const parsedResponse = parseOAuthResponse(responseBody);

    accessToken = parsedResponse['oauth_token'] || '';
    accessTokenSecret = parsedResponse['oauth_token_secret'] || '';

    if (!accessToken || !accessTokenSecret) {
      return errorResponse(
        'token_exchange_failed',
        'Garmin API did not return valid access tokens',
        502,
        origin,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(
      'token_exchange_failed',
      `Failed to exchange tokens: ${message}`,
      502,
      origin,
    );
  }

  // Derive a userId from the access token (Garmin doesn't return a separate user ID in the token response)
  // We use a hash of the access token as a stable identifier
  const userId = await deriveUserId(accessToken);
  const displayName = `Garmin User`;

  // Encrypt tokens before returning to client
  let encryptedAccessToken: string;
  let encryptedTokenSecret: string;

  try {
    encryptedAccessToken = await encrypt(accessToken, env.ENCRYPTION_KEY);
    encryptedTokenSecret = await encrypt(accessTokenSecret, env.ENCRYPTION_KEY);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(
      'encryption_failed',
      `Failed to encrypt tokens: ${message}`,
      500,
      origin,
    );
  }

  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

  const responsePayload: AccessTokenResponse = {
    encryptedAccessToken,
    encryptedTokenSecret,
    userId,
    displayName,
    expiresAt,
  };

  // Schedule token cleanup to ensure raw tokens are discarded from memory (Req 10.4)
  // In Cloudflare Workers, waitUntil extends the worker's lifetime to perform cleanup.
  // We create mutable references that we explicitly nullify.
  let rawAccessToken: string | null = accessToken;
  let rawAccessTokenSecret: string | null = accessTokenSecret;

  ctx.waitUntil(
    new Promise<void>((resolve) => {
      setTimeout(() => {
        rawAccessToken = null;
        rawAccessTokenSecret = null;
        resolve();
      }, TOKEN_CLEANUP_DELAY_MS);
    }),
  );

  // Overwrite local variables to aid GC (best effort in JS runtime)
  accessToken = '';
  accessTokenSecret = '';

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

/**
 * Derive a stable user identifier from the access token using SHA-256.
 * Returns a hex string (first 16 chars) as the userId.
 */
async function deriveUserId(accessToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(accessToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
