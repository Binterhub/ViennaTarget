'use strict';

const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { config, hasApiCredentials } = require('./src/config');
const { MemoryCache } = require('./src/cache');
const { DataMatcherClient } = require('./src/datamatcher');

const app = express();
const client = new DataMatcherClient();
const cache = new MemoryCache(config.cacheTtlMs);

let refreshPromise = null;

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.',
  },
});

app.get('/health', (_req, res) => {
  const meta = cache.meta();
  res.json({
    status: 'ok',
    service: 'vienna-doctor-explorer',
    timestamp: new Date().toISOString(),
    configured: hasApiCredentials(),
    cache: meta,
  });
});

async function loadDoctors({ force = false } = {}) {
  if (!hasApiCredentials()) {
    const error = new Error(
      'DataMatcherAPI ist nicht konfiguriert. Bitte DATAMATCHER_API_URL und DATAMATCHER_API_KEY setzen.'
    );
    error.code = 'NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }

  if (!force) {
    const hit = cache.get();
    if (hit) return { ...hit, fromCache: true, stale: false };
  }

  if (refreshPromise) {
    const data = await refreshPromise;
    return { ...data, fromCache: false, stale: false };
  }

  refreshPromise = (async () => {
    const payload = await client.fetchAllViennaDoctors();
    cache.set(payload);
    return payload;
  })();

  try {
    const data = await refreshPromise;
    return { ...data, fromCache: false, stale: false };
  } finally {
    refreshPromise = null;
  }
}

app.get('/api/doctors', apiLimiter, async (req, res) => {
  const force = String(req.query.refresh || '') === '1';

  try {
    const data = await loadDoctors({ force });
    res.json({
      success: true,
      doctors: data.doctors,
      total: data.total,
      fetchedAt: data.fetchedAt,
      fields: data.fields,
      fromCache: data.fromCache,
      stale: false,
      warning: null,
      error: null,
    });
  } catch (err) {
    const stale = cache.getStale();
    if (stale) {
      return res.status(200).json({
        success: true,
        doctors: stale.doctors,
        total: stale.total,
        fetchedAt: stale.fetchedAt,
        fields: stale.fields,
        fromCache: true,
        stale: true,
        warning:
          err.message ||
          'Aktuelle Daten konnten nicht geladen werden. Es werden zwischengespeicherte Daten angezeigt.',
        error: null,
      });
    }

    const status = err.status || (err.code === 'NOT_CONFIGURED' ? 503 : 502);
    res.status(status).json({
      success: false,
      doctors: [],
      total: 0,
      fetchedAt: null,
      fields: { postalCode: false, gender: false, postalKey: null, genderKey: null },
      fromCache: false,
      stale: false,
      warning: null,
      error: err.message || 'Daten konnten nicht geladen werden.',
    });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Ein interner Fehler ist aufgetreten.',
  });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Vienna Doctor Explorer listening on port ${config.port}`);
    if (!hasApiCredentials()) {
      console.warn(
        'Warning: DATAMATCHER_API_URL / DATAMATCHER_API_KEY not set. Configure .env before loading doctors.'
      );
    }
  });
}

module.exports = { app, loadDoctors, cache, client };
