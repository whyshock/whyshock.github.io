import type { Env, HealthResponse, ErrorResponse } from './types';
import { validateOrigin, corsHeaders, handlePreflight } from './cors';
import { handleAccessToken } from './access-token';
import { handleRefreshToken } from './refresh-token';
import { getRequestToken } from './oauth';
import { handleSync } from './garmin-sync';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Health endpoint does not require origin validation
    if (pathname === '/health' && request.method === 'GET') {
      return handleHealth();
    }

    // CORS preflight handling
    if (request.method === 'OPTIONS') {
      const origin = validateOrigin(request, env);
      if (!origin) {
        return forbidden();
      }
      return handlePreflight(origin);
    }

    // Validate Origin for all other requests
    const origin = validateOrigin(request, env);
    if (!origin) {
      return forbidden();
    }

    // Route to handlers
    switch (pathname) {
      case '/auth/request-token':
        if (request.method === 'GET') {
          return handleRequestToken(request, env, origin);
        }
        break;
      case '/auth/access-token':
        if (request.method === 'POST') {
          return handleAccessToken(request, env, origin, ctx);
        }
        break;
      case '/auth/refresh-token':
        if (request.method === 'POST') {
          return handleRefreshToken(request, env, origin, ctx);
        }
        break;
      case '/api/sync':
        if (request.method === 'POST') {
          return handleSync(request, env, origin);
        }
        break;
    }

    return jsonResponse(
      { error: 'not_found', message: 'Endpoint not found' } satisfies ErrorResponse,
      404,
      origin,
    );
  },
} satisfies ExportedHandler<Env>;

function handleHealth(): Response {
  const body: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleRequestToken(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const callbackUrl = `${origin}/callback`;

    const result = await getRequestToken(
      env.GARMIN_CONSUMER_KEY,
      env.GARMIN_CONSUMER_SECRET,
      callbackUrl,
    );

    return jsonResponse(
      {
        redirectUrl: result.redirectUrl,
        requestToken: result.requestToken,
        requestTokenSecret: result.requestTokenSecret,
      },
      200,
      origin,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during token request';
    return jsonResponse(
      { error: 'token_request_failed', message } satisfies ErrorResponse,
      502,
      origin,
    );
  }
}

function forbidden(): Response {
  const body: ErrorResponse = {
    error: 'forbidden',
    message: 'Origin not allowed',
  };
  return new Response(JSON.stringify(body), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonResponse(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}
