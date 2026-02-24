import { logger } from '@user-office-software/duo-logger';

// Remote Browserless WebSocket endpoint.
// When set, PDF generation uses a remote browser cluster instead of local Chromium.
export const BROWSER_WS_ENDPOINT = process.env.BROWSER_WS_ENDPOINT || '';

// Base URL of the factory app, used by the remote browser to fetch static assets
// (CSS, fonts, images, JS). Defaults to http://localhost:<port> for local development.
// In Docker/K8s, set to the service name (e.g. http://factory:4500).
const NODE_PORT = process.env.NODE_PORT || 4500;
export const FACTORY_BASE_URL =
  process.env.FACTORY_BASE_URL || `http://localhost:${NODE_PORT}`;

/**
 * Whether PDF generation is configured to use a remote Browserless cluster.
 */
export function isRemoteBrowser(): boolean {
  return !!BROWSER_WS_ENDPOINT;
}

logger.logInfo('Browserless configuration', {
  isRemote: isRemoteBrowser(),
  browserWsEndpoint: BROWSER_WS_ENDPOINT || '(not set — using local Chromium)',
  factoryBaseUrl: FACTORY_BASE_URL,
});
