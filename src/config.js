'use strict';

require('dotenv').config();

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Fixed Zusatzfach / additionalspecialization used for all NeoTarget searches. */
const FOCUS_ADDITIONAL_SPECIALIZATION =
  'Neonatologie und Pädiatrische Intensivmedizin';

const config = {
  port: positiveInt(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: (process.env.DATAMATCHER_API_URL || '').replace(/\/+$/, ''),
  apiKey: process.env.DATAMATCHER_API_KEY || '',
  cacheTtlMs: positiveInt(process.env.CACHE_TTL_MINUTES, 15) * 60 * 1000,
  apiTimeoutMs: positiveInt(process.env.API_TIMEOUT_MS, 30000),
  pageSize: 500,
  focusAdditionalSpecialization: FOCUS_ADDITIONAL_SPECIALIZATION,
  country: process.env.SEARCH_COUNTRY || 'Austria',
  /** Simple shared password gate (never expose to the browser). */
  appPassword: process.env.APP_PASSWORD || '',
  sessionSecret:
    process.env.SESSION_SECRET ||
    'neotarget-dev-session-secret-change-me',
  /** When true and API is not configured, serve local fixture doctors for UI demos. */
  useMockData: String(process.env.USE_MOCK_DATA || '') === '1',
};

function hasApiCredentials() {
  return Boolean(config.apiUrl && config.apiKey);
}

module.exports = { config, hasApiCredentials, FOCUS_ADDITIONAL_SPECIALIZATION };
