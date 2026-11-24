'use strict';

require('dotenv').config();

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const config = {
  port: positiveInt(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: (process.env.DATAMATCHER_API_URL || '').replace(/\/+$/, ''),
  apiKey: process.env.DATAMATCHER_API_KEY || '',
  cacheTtlMs: positiveInt(process.env.CACHE_TTL_MINUTES, 15) * 60 * 1000,
  apiTimeoutMs: positiveInt(process.env.API_TIMEOUT_MS, 30000),
  pageSize: 500,
};

function hasApiCredentials() {
  return Boolean(config.apiUrl && config.apiKey);
}

module.exports = { config, hasApiCredentials };
