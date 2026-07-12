/**
 * OAuth 1.0a signing utilities for Garmin Connect API.
 * Implements HMAC-SHA1 signature generation per RFC 5849.
 */

/**
 * RFC 3986 percent encoding (required by OAuth 1.0a).
 */
export function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * Build the OAuth 1.0a signature base string.
 * Concatenates: METHOD&encoded_URL&encoded_sorted_params
 */
export function buildSignatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  // Collect and sort parameters alphabetically by key
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&');

  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
}

/**
 * Generate HMAC-SHA1 signature and return as base64.
 */
export async function hmacSha1Sign(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const dataBytes = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  return uint8ArrayToBase64(new Uint8Array(signature));
}

/**
 * Build the signing key from consumer secret and optional token secret.
 * Format: percentEncode(consumerSecret)&percentEncode(tokenSecret)
 */
export function buildSigningKey(consumerSecret: string, tokenSecret?: string): string {
  return `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret || '')}`;
}

/**
 * Build the OAuth Authorization header string from params and signature.
 */
export function buildAuthorizationHeader(
  params: Record<string, string>,
  signature: string,
): string {
  const allParams = { ...params, oauth_signature: signature };
  const entries = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(', ');

  return `OAuth ${entries}`;
}

/**
 * Generate a random nonce string (32-character hex).
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get current Unix timestamp as a string.
 */
export function getTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

/**
 * Generate a complete OAuth 1.0a Authorization header for a request.
 * High-level helper that combines all the primitives.
 */
export async function generateOAuthHeader(
  method: string,
  url: string,
  opts: {
    consumerKey: string;
    consumerSecret: string;
    token?: string;
    tokenSecret?: string;
    verifier?: string;
  },
): Promise<string> {
  const params: Record<string, string> = {
    oauth_consumer_key: opts.consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: getTimestamp(),
    oauth_version: '1.0',
  };

  if (opts.token) {
    params.oauth_token = opts.token;
  }

  if (opts.verifier) {
    params.oauth_verifier = opts.verifier;
  }

  const baseString = buildSignatureBaseString(method, url, params);
  const signingKey = buildSigningKey(opts.consumerSecret, opts.tokenSecret);
  const signature = await hmacSha1Sign(signingKey, baseString);

  return buildAuthorizationHeader(params, signature);
}

/**
 * Parse an OAuth response body (URL-encoded key=value pairs).
 */
export function parseOAuthResponse(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of body.split('&')) {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  return params;
}

const GARMIN_REQUEST_TOKEN_URL =
  'https://connectapi.garmin.com/oauth-service/oauth/request_token';
const GARMIN_AUTHORIZE_URL =
  'https://connect.garmin.com/oauthConfirm';

interface RequestTokenResult {
  redirectUrl: string;
  requestToken: string;
  requestTokenSecret: string;
}

/**
 * Obtain a request token from Garmin and build the authorization redirect URL.
 * Used by GET /auth/request-token endpoint.
 */
export async function getRequestToken(
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string,
): Promise<RequestTokenResult> {
  const params: Record<string, string> = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: consumerKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: getTimestamp(),
    oauth_version: '1.0',
  };

  const baseString = buildSignatureBaseString('POST', GARMIN_REQUEST_TOKEN_URL, params);
  const signingKey = buildSigningKey(consumerSecret);
  const signature = await hmacSha1Sign(signingKey, baseString);
  const authHeader = buildAuthorizationHeader(params, signature);

  const response = await fetch(GARMIN_REQUEST_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Garmin API returned ${response.status}: ${text}`);
  }

  const responseBody = await response.text();
  const parsed = parseOAuthResponse(responseBody);

  const requestToken = parsed['oauth_token'];
  const requestTokenSecret = parsed['oauth_token_secret'];

  if (!requestToken || !requestTokenSecret) {
    throw new Error(`Garmin response missing oauth_token or oauth_token_secret`);
  }

  const redirectUrl = `${GARMIN_AUTHORIZE_URL}?oauth_token=${percentEncode(requestToken)}`;

  return { redirectUrl, requestToken, requestTokenSecret };
}

/** Convert Uint8Array to base64 string */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
