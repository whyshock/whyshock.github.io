// API clients, OAuth proxy communication, and caching layer
export { createCacheService, dataCache, authCache } from './cache';
export {
  createOAuthProxyClient,
  getOAuthProxyClient,
  resetOAuthProxyClient,
} from './oauth-proxy';
export { createGarminAPIClient, isGarminAPIError } from './garmin-api';
export type { GarminAPIClientConfig } from './garmin-api';
