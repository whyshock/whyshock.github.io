/**
 * Environment bindings for the Cloudflare Worker.
 * Secrets are set via `wrangler secret put <NAME>`.
 * Variables are defined in wrangler.toml [vars].
 */
export interface Env {
  /** Garmin OAuth 1.0a consumer key (secret) */
  GARMIN_CONSUMER_KEY: string;
  /** Garmin OAuth 1.0a consumer secret (secret) */
  GARMIN_CONSUMER_SECRET: string;
  /** Comma-separated list of allowed origin domains */
  ALLOWED_ORIGINS: string;
  /** AES-256-GCM encryption key for token encryption (secret) */
  ENCRYPTION_KEY: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
