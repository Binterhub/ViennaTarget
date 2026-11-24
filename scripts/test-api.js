'use strict';

/**
 * Simple DataMatcherAPI connection test.
 * Usage: npm run test:api
 */
require('dotenv').config();

const baseUrl = (process.env.DATAMATCHER_API_URL || '').replace(/\/+$/, '');
const apiKey = process.env.DATAMATCHER_API_KEY || '';
const timeoutMs = Number(process.env.API_TIMEOUT_MS) || 30000;

function fail(message, code = 1) {
  console.error(`FAIL: ${message}`);
  process.exit(code);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log('Vienna Doctor Explorer – API connection test');
  console.log('-------------------------------------------');

  if (!baseUrl || !apiKey) {
    fail(
      'DATAMATCHER_API_URL and DATAMATCHER_API_KEY must be set (copy .env.example to .env).'
    );
  }

  console.log(`API URL: ${baseUrl}`);

  let tokenRes;
  try {
    tokenRes = await fetchWithTimeout(`${baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    fail(`Token request failed: ${err.message}`);
  }

  if (!tokenRes.ok) {
    fail(`Token endpoint returned HTTP ${tokenRes.status}`);
  }

  const tokenBody = await tokenRes.json();
  if (!tokenBody.accessToken) {
    fail('Token response missing accessToken');
  }
  console.log(`Token OK (expiresIn=${tokenBody.expiresIn ?? 'n/a'})`);

  let searchRes;
  try {
    searchRes = await fetchWithTimeout(`${baseUrl}/api/doctorsearch?skip=0&take=5`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenBody.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify([{ country: 'Austria', city: 'Wien' }]),
    });
  } catch (err) {
    fail(`Doctor search failed: ${err.message}`);
  }

  if (!searchRes.ok) {
    fail(`Doctor search returned HTTP ${searchRes.status}`);
  }

  const searchBody = await searchRes.json();
  const results = Array.isArray(searchBody)
    ? searchBody
    : Array.isArray(searchBody.results)
      ? searchBody.results
      : null;

  if (!results) {
    fail('Unexpected search response shape');
  }

  console.log(`Search OK (${results.length} row(s) in first page sample)`);
  if (results[0]) {
    const sample = results[0];
    console.log(
      `Sample fields: ${Object.keys(sample).join(', ')}`
    );
  }
  console.log('PASS');
}

main().catch((err) => fail(err.message));
