import type { Env } from './types';

/**
 * Parse the ALLOWED_ORIGINS environment variable into an array of allowed origins.
 */
export function getAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
}

/**
 * Validate the request's Origin header against the configured allowlist.
 * Returns the origin if valid, or null if not allowed.
 */
export function validateOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) {
    return null;
  }

  const allowed = getAllowedOrigins(env);
  if (allowed.includes(origin)) {
    return origin;
  }

  return null;
}

/**
 * Create CORS headers for a valid origin.
 */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 */
export function handlePreflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
