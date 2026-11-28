'use strict';

/**
 * Simple DataMatcherAPI connection test for NeoTarget.
 * Usage: npm run test:api
 */
require('dotenv').config();

const { FOCUS_ADDITIONAL_SPECIALIZATION } = require('../src/config');

const baseUrl = (process.env.DATAMATCHER_API_URL || '').replace(/\/+$/, '');
const apiKey = process.env.DATAMATCHER_API_KEY || '';
const timeoutMs = Number(process.env.API_TIMEOUT_MS) || 30000;
const country = process.env.SEARCH_COUNTRY || 'Austria';

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
  console.log('NeoTarget – API connection test');
  console.log('--------------------------------');
  console.log(`Focus (UI default): ${FOCUS_ADDITIONAL_SPECIALIZATION}`);

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

  // Broad country pull (app default dataset)
  const broadPayload = [{ country }];
  let searchRes;
  try {
    searchRes = await fetchWithTimeout(`${baseUrl}/api/doctorsearch?skip=0&take=5`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenBody.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(broadPayload),
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

  console.log(`Broad search OK (${results.length} row(s) in first page sample)`);

  // Focus Zusatzfach sample
  const focusPayload = [
    {
      country,
      additionalspecialization: FOCUS_ADDITIONAL_SPECIALIZATION,
    },
  ];
  let focusRes;
  try {
    focusRes = await fetchWithTimeout(`${baseUrl}/api/doctorsearch?skip=0&take=5`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenBody.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(focusPayload),
    });
  } catch (err) {
    fail(`Focus search failed: ${err.message}`);
  }

  if (!focusRes.ok) {
    fail(`Focus search returned HTTP ${focusRes.status}`);
  }

  const focusBody = await focusRes.json();
  const focusResults = Array.isArray(focusBody)
    ? focusBody
    : Array.isArray(focusBody.results)
      ? focusBody.results
      : null;

  if (!focusResults) {
    fail('Unexpected focus search response shape');
  }

  console.log(
    `Focus search OK (${focusResults.length} row(s) for „${FOCUS_ADDITIONAL_SPECIALIZATION}“)`
  );
  if (focusResults[0]) {
    console.log(`Sample fields: ${Object.keys(focusResults[0]).join(', ')}`);
    if (focusResults[0].additionalspecialization) {
      console.log(`Sample Zusatzfach: ${focusResults[0].additionalspecialization}`);
    }
  }
  console.log('PASS');
}

main().catch((err) => fail(err.message));
