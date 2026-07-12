/**
 * Garmin Connect credential-based sync handler.
 * Attempts to authenticate with Garmin's SSO and fetch wellness/activity data.
 *
 * NOTE: Garmin has TLS fingerprinting that may block requests from
 * Cloudflare Workers. If auth fails, we return a clear error directing
 * users to the file upload option instead.
 */

import type { Env, ErrorResponse } from './types';
import { corsHeaders } from './cors';

// ─── Garmin SSO Constants ─────────────────────────────────────────────────────

const SSO_EMBED_URL = 'https://sso.garmin.com/sso/embed';
const SSO_SIGNIN_URL = 'https://sso.garmin.com/sso/signin';
const CONNECT_URL = 'https://connect.garmin.com/modern';
const API_BASE = 'https://connect.garmin.com/modern/proxy';

const SSO_PARAMS = new URLSearchParams({
  id: 'gauth-widget',
  embedWidget: 'true',
  gauthHost: 'https://sso.garmin.com/sso/embed',
});

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncRequest {
  email: string;
  password: string;
  days?: number; // Number of days to fetch (default 7)
}

interface DailySummaryData {
  date: string;
  steps: number;
  restingHeartRate?: number;
  stressLevel?: number;
  bodyBattery?: number;
  sleepDuration?: number;
  respirationRate?: number;
}

interface ActivityData {
  activityId: string;
  activityType: string;
  activityName: string;
  startTime: string;
  duration: number;
  distance?: number;
  calories?: number;
  averageHR?: number;
  maxHR?: number;
  elevationGain?: number;
}

interface SyncResponse {
  success: true;
  data: {
    dailySummaries: DailySummaryData[];
    activities: ActivityData[];
    displayName?: string;
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function handleSync(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  try {
    const body = await request.json() as SyncRequest;

    if (!body.email || !body.password) {
      return jsonError('Missing email or password', 400, origin);
    }

    const days = body.days ?? 7;

    // Step 1: Authenticate with Garmin SSO
    const session = await garminLogin(body.email, body.password);

    // Step 2: Fetch wellness data for the last N days
    const dailySummaries = await fetchDailySummaries(session, days);

    // Step 3: Fetch recent activities
    const activities = await fetchActivities(session);

    // Step 4: Get display name
    const displayName = await fetchDisplayName(session);

    const response: SyncResponse = {
      success: true,
      data: {
        dailySummaries,
        activities,
        displayName,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Provide helpful fallback message for common failures
    if (message.includes('TLS') || message.includes('blocked') || message.includes('403')) {
      return jsonError(
        'Garmin blocked the connection (likely TLS fingerprinting). Please use the file upload option instead.',
        503,
        origin,
      );
    }

    if (message.includes('credentials') || message.includes('401') || message.includes('login')) {
      return jsonError(
        'Invalid email or password. Please check your Garmin Connect credentials.',
        401,
        origin,
      );
    }

    return jsonError(`Sync failed: ${message}`, 500, origin);
  }
}

// ─── Garmin SSO Login Flow ────────────────────────────────────────────────────

interface GarminSession {
  cookies: string;
  ticket: string;
}

async function garminLogin(email: string, password: string): Promise<GarminSession> {
  // Step 1: Get the SSO page to obtain CSRF token and cookies
  const embedResponse = await fetch(`${SSO_EMBED_URL}?${SSO_PARAMS.toString()}`, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'manual',
  });

  if (!embedResponse.ok && embedResponse.status !== 200) {
    throw new Error(`SSO embed page returned ${embedResponse.status} — may be blocked`);
  }

  // Collect cookies from the response
  const setCookies = embedResponse.headers.getAll?.('set-cookie') ??
    [embedResponse.headers.get('set-cookie')].filter(Boolean) as string[];
  const cookies = parseCookies(setCookies);

  // Extract CSRF token from the HTML (look for _csrf or similar hidden input)
  const html = await embedResponse.text();
  const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
  const csrf = csrfMatch?.[1] ?? '';

  // Step 2: POST credentials to sign in
  const formData = new URLSearchParams({
    username: email,
    password: password,
    embed: 'true',
    ...(csrf ? { _csrf: csrf } : {}),
  });

  const signinResponse = await fetch(SSO_SIGNIN_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: formatCookies(cookies),
      Origin: 'https://sso.garmin.com',
      Referer: `${SSO_EMBED_URL}?${SSO_PARAMS.toString()}`,
    },
    body: formData.toString(),
    redirect: 'manual',
  });

  // The response should contain a ticket in the redirect URL or response body
  const responseText = await signinResponse.text();

  // Look for ticket in response body (embedded in a script tag or redirect URL)
  const ticketMatch = responseText.match(/ticket=([A-Z0-9-]+)/i) ??
    responseText.match(/ticket":"([^"]+)"/);

  if (!ticketMatch?.[1]) {
    // Check for common failure indicators
    if (responseText.includes('locked') || responseText.includes('LOCKED')) {
      throw new Error('Account is locked. Please unlock via Garmin Connect.');
    }
    if (responseText.includes('credentials') || responseText.includes('invalid')) {
      throw new Error('Invalid credentials — login failed');
    }
    throw new Error('Could not obtain session ticket — login may have been blocked');
  }

  const ticket = ticketMatch[1];

  // Step 3: Exchange ticket for session cookies
  const connectResponse = await fetch(`${CONNECT_URL}/?ticket=${ticket}`, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Cookie: formatCookies(cookies),
    },
    redirect: 'manual',
  });

  // Merge new cookies from the connect response
  const connectCookies = connectResponse.headers.getAll?.('set-cookie') ??
    [connectResponse.headers.get('set-cookie')].filter(Boolean) as string[];
  const allCookies = { ...cookies, ...parseCookies(connectCookies) };

  return {
    cookies: formatCookies(allCookies),
    ticket,
  };
}

// ─── Data Fetchers ────────────────────────────────────────────────────────────

async function fetchDailySummaries(
  session: GarminSession,
  days: number,
): Promise<DailySummaryData[]> {
  const summaries: DailySummaryData[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0]!;

    try {
      const raw = await garminApi(
        session,
        `/usersummary-service/usersummary/daily/${dateStr}`,
      );

      if (raw && !Array.isArray(raw)) {
        const data = raw as Record<string, unknown>;
        summaries.push({
          date: dateStr,
          steps: Number(data.totalSteps ?? data.steps ?? 0),
          restingHeartRate: data.restingHeartRate != null
            ? Number(data.restingHeartRate)
            : data.minHeartRate != null ? Number(data.minHeartRate) : undefined,
          stressLevel: data.averageStressLevel != null
            ? Number(data.averageStressLevel) : undefined,
          bodyBattery: data.bodyBatteryHighestValue != null
            ? Number(data.bodyBatteryHighestValue) : undefined,
          sleepDuration: data.sleepingSeconds != null
            ? Math.round(Number(data.sleepingSeconds) / 60) : undefined,
          respirationRate: data.lowestRespirationValue != null
            ? Number(data.lowestRespirationValue) : undefined,
        });
      }
    } catch {
      // Skip days that fail — partial data is still useful
    }
  }

  return summaries;
}

async function fetchActivities(session: GarminSession): Promise<ActivityData[]> {
  try {
    const data = await garminApi(
      session,
      '/activitylist-service/activities/search/activities?limit=20&start=0',
    );

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((a: Record<string, unknown>) => ({
      activityId: String(a.activityId ?? ''),
      activityType: mapActivityType(a.activityType as Record<string, unknown> | undefined),
      activityName: String(a.activityName ?? 'Activity'),
      startTime: String(a.startTimeLocal ?? a.startTimeGMT ?? ''),
      duration: Number(a.duration ?? 0),
      distance: a.distance ? Number(a.distance) : undefined,
      calories: a.calories ? Number(a.calories) : undefined,
      averageHR: a.averageHR ? Number(a.averageHR) : undefined,
      maxHR: a.maxHR ? Number(a.maxHR) : undefined,
      elevationGain: a.elevationGain ? Number(a.elevationGain) : undefined,
    }));
  } catch {
    return [];
  }
}

async function fetchDisplayName(session: GarminSession): Promise<string | undefined> {
  try {
    const raw = await garminApi(session, '/userprofile-service/userdisplayname');
    if (raw && !Array.isArray(raw)) {
      return raw.displayName as string | undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ─── API Helper ───────────────────────────────────────────────────────────────

async function garminApi(
  session: GarminSession,
  endpoint: string,
): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Cookie: session.cookies,
      Accept: 'application/json',
      'NK': 'NT', // Required header for Garmin API
    },
  });

  if (response.status === 403) {
    throw new Error('403 — request blocked by Garmin (TLS fingerprinting)');
  }

  if (response.status === 401) {
    throw new Error('401 — session expired or invalid credentials');
  }

  if (!response.ok) {
    throw new Error(`Garmin API returned ${response.status}`);
  }

  const text = await response.text();
  if (!text || text === 'null') {
    return null;
  }

  return JSON.parse(text);
}

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    if (!header) continue;
    const parts = header.split(';')[0];
    if (parts) {
      const [name, ...valueParts] = parts.split('=');
      if (name) {
        cookies[name.trim()] = valueParts.join('=').trim();
      }
    }
  }
  return cookies;
}

function formatCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// ─── Activity Type Mapper ─────────────────────────────────────────────────────

function mapActivityType(type: Record<string, unknown> | undefined): string {
  if (!type) return 'other';
  const key = String(type.typeKey ?? '').toLowerCase();

  const mapping: Record<string, string> = {
    running: 'running',
    trail_running: 'running',
    treadmill_running: 'running',
    cycling: 'cycling',
    road_biking: 'cycling',
    mountain_biking: 'cycling',
    indoor_cycling: 'cycling',
    swimming: 'swimming',
    pool_swimming: 'swimming',
    open_water_swimming: 'swimming',
    walking: 'walking',
    hiking: 'hiking',
    strength_training: 'strength_training',
    yoga: 'yoga',
  };

  return mapping[key] ?? 'other';
}

// ─── Response Helpers ─────────────────────────────────────────────────────────

function jsonError(message: string, status: number, origin: string): Response {
  const body: ErrorResponse = {
    error: status === 401 ? 'auth_failed' : status === 503 ? 'service_blocked' : 'sync_failed',
    message,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}
