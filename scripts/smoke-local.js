'use strict';

/**
 * Local smoke test without upstream DataMatcherAPI.
 * Starts no server — expects NeoTarget already listening on PORT (default 3000).
 *
 * Usage: node scripts/smoke-local.js
 */
require('dotenv').config();

const port = Number(process.env.PORT) || 3000;
const base = `http://127.0.0.1:${port}`;
const password = process.env.APP_PASSWORD || '';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

async function main() {
  console.log('NeoTarget local smoke');
  console.log('---------------------');

  const health = await fetch(`${base}/health`);
  if (!health.ok) fail(`/health HTTP ${health.status}`);
  const healthBody = await health.json();
  if (healthBody.status !== 'ok' || healthBody.service !== 'neotarget') {
    fail('/health unexpected payload');
  }
  ok('/health');

  const unauth = await fetch(`${base}/api/doctors`);
  if (unauth.status !== 401) fail(`/api/doctors expected 401, got ${unauth.status}`);
  ok('/api/doctors rejects unauthenticated');

  const loginRedirect = await fetch(`${base}/`, { redirect: 'manual' });
  if (![302, 301, 303, 307, 308].includes(loginRedirect.status)) {
    fail(`GET / expected redirect when logged out, got ${loginRedirect.status}`);
  }
  ok('GET / redirects to login when logged out');

  const loginPage = await fetch(`${base}/login`);
  if (!loginPage.ok) fail(`/login HTTP ${loginPage.status}`);
  const loginHtml = await loginPage.text();
  if (!loginHtml.includes('datadominance-login-hero.jpg')) {
    fail('login page missing full hero image');
  }
  if (!loginHtml.includes('NeoTarget')) fail('login page missing NeoTarget brand');
  ok('/login renders with full DataDominance hero');

  if (!password) fail('APP_PASSWORD not set for login smoke');

  const badLogin = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password: 'wrong-password' }),
  });
  if (badLogin.status !== 401) fail(`bad login expected 401, got ${badLogin.status}`);
  ok('bad password rejected');

  const goodLogin = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!goodLogin.ok) fail(`good login HTTP ${goodLogin.status}`);
  const setCookie = goodLogin.headers.getSetCookie?.() || [];
  const cookieHeader =
    setCookie.length > 0
      ? setCookie.map((c) => c.split(';')[0]).join('; ')
      : (goodLogin.headers.get('set-cookie') || '').split(',').map((c) => c.split(';')[0].trim()).join('; ');
  if (!cookieHeader.includes('neotarget_session=')) fail('login missing session cookie');
  ok('login sets session cookie');

  const appPage = await fetch(`${base}/`, { headers: { Cookie: cookieHeader }, redirect: 'manual' });
  if (appPage.status !== 200) fail(`authenticated GET / expected 200, got ${appPage.status}`);
  const appHtml = await appPage.text();
  if (!appHtml.includes('datadominance-app-hero.jpg')) {
    fail('app page missing short post-login hero');
  }
  if (!appHtml.includes('Neonatologie und pädriatrische Intensivmedizin')) {
    fail('app page missing focus Zusatzfach copy');
  }
  ok('authenticated app shell + short hero');

  const doctors = await fetch(`${base}/api/doctors`, {
    headers: { Cookie: cookieHeader, Accept: 'application/json' },
  });
  // Without API URL: 503, or 200 mock fixtures when USE_MOCK_DATA=1; with live API: 200
  if (![200, 503].includes(doctors.status)) {
    fail(`/api/doctors unexpected status ${doctors.status}`);
  }
  const doctorsBody = await doctors.json();
  if (doctors.status === 503) {
    if (!doctorsBody.error) fail('503 without error message');
    ok('/api/doctors returns clear 503 when API not configured');
  } else {
    if (!doctorsBody.success) fail('200 doctors payload not success');
    if (!Array.isArray(doctorsBody.doctors)) fail('doctors array missing');
    ok(`/api/doctors returned ${doctorsBody.total ?? doctorsBody.doctors.length} doctors`);
    if (doctorsBody.focus !== 'Neonatologie und pädriatrische Intensivmedizin') {
      fail(`unexpected focus: ${doctorsBody.focus}`);
    }
    ok('focus Zusatzfach present in payload');
  }

  const logout = await fetch(`${base}/api/logout`, {
    method: 'POST',
    headers: { Cookie: cookieHeader, Accept: 'application/json' },
  });
  if (!logout.ok) fail(`logout HTTP ${logout.status}`);
  ok('logout');

  console.log('PASS');
}

main().catch((err) => fail(err.message || String(err)));
