'use strict';

const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { config, hasApiCredentials } = require('./src/config');
const { MemoryCache } = require('./src/cache');
const { DataMatcherClient } = require('./src/datamatcher');
const { getMockPayload } = require('./src/fixtures');
const {
  isAuthenticated,
  createSessionCookie,
  clearSessionCookie,
  verifyPassword,
  requireAuth,
} = require('./src/auth');

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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.',
  },
});

app.get('/health', (_req, res) => {
  const meta = cache.meta();
  res.json({
    status: 'ok',
    service: 'neotarget',
    focus: config.focusAdditionalSpecialization,
    timestamp: new Date().toISOString(),
    configured: hasApiCredentials(),
    loginConfigured: Boolean(config.appPassword),
    cache: meta,
  });
});

app.get('/api/meta', (_req, res) => {
  res.json({
    service: 'neotarget',
    focus: config.focusAdditionalSpecialization,
    country: config.country,
    configured: hasApiCredentials(),
    authenticated: isAuthenticated(_req),
  });
});

app.get('/api/session', (req, res) => {
  res.json({
    success: true,
    authenticated: isAuthenticated(req),
  });
});

app.post('/api/login', loginLimiter, (req, res) => {
  if (!config.appPassword) {
    return res.status(503).json({
      success: false,
      error: 'Login ist nicht konfiguriert (APP_PASSWORD fehlt).',
    });
  }

  const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  if (!verifyPassword(password)) {
    return res.status(401).json({
      success: false,
      error: 'Passwort ist ungültig.',
    });
  }

  res.setHeader('Set-Cookie', createSessionCookie());
  return res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ success: true });
});

async function loadDoctors({ force = false } = {}) {
  if (!hasApiCredentials()) {
    if (config.useMockData) {
      const payload = getMockPayload();
      cache.set(payload);
      return { ...payload, fromCache: false, stale: false };
    }
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
    const payload = await client.fetchAllFocusDoctors();
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

app.get('/api/doctors', apiLimiter, requireAuth, async (req, res) => {
  const force = String(req.query.refresh || '') === '1';

  try {
    const data = await loadDoctors({ force });
    res.json({
      success: true,
      doctors: data.doctors,
      total: data.total,
      fetchedAt: data.fetchedAt,
      fields: data.fields,
      focus: data.focus || config.focusAdditionalSpecialization,
      country: data.country || config.country,
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
        focus: stale.focus || config.focusAdditionalSpecialization,
        country: stale.country || config.country,
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
      focus: config.focusAdditionalSpecialization,
      country: config.country,
      fromCache: false,
      stale: false,
      warning: null,
      error: err.message || 'Daten konnten nicht geladen werden.',
    });
  }
});

const publicDir = path.join(__dirname, 'public');

// Public assets for login + shared static files
app.use('/assets', express.static(path.join(publicDir, 'assets')));
app.get('/login.css', (_req, res) => res.sendFile(path.join(publicDir, 'login.css')));
app.get('/login.js', (_req, res) => res.sendFile(path.join(publicDir, 'login.js')));

app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  res.sendFile(path.join(publicDir, 'login.html'));
});

// Protect app shell + authenticated static assets
app.get('/', requireAuth, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/styles.css', requireAuth, (_req, res) => {
  res.sendFile(path.join(publicDir, 'styles.css'));
});

app.get('/app.js', requireAuth, (_req, res) => {
  res.sendFile(path.join(publicDir, 'app.js'));
});

app.get('*', (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  res.sendFile(path.join(publicDir, 'index.html'));
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
    console.log(`NeoTarget listening on port ${config.port}`);
    console.log(`Focus Zusatzfach: ${config.focusAdditionalSpecialization}`);
    if (!config.appPassword) {
      console.warn('Warning: APP_PASSWORD not set. Login will fail until configured.');
    }
    if (!hasApiCredentials()) {
      console.warn(
        'Warning: DATAMATCHER_API_URL / DATAMATCHER_API_KEY not set. Configure .env before loading doctors.'
      );
    }
  });
}

module.exports = { app, loadDoctors, cache, client };
