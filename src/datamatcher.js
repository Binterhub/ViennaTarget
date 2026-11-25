'use strict';

const { config } = require('./config');

const OPTIONAL_POSTAL_KEYS = ['postalcode', 'postalCode', 'plz', 'zip', 'zipcode', 'zipCode'];
const OPTIONAL_GENDER_KEYS = ['gender', 'geschlecht', 'sex', 'Geschlecht'];

/**
 * After the 2026-11 DB change, country-only (and some city-only) filters return
 * HTTP 400 "Nullable object must have a value.". Working pulls need at least one
 * additional supported field (specialization / additionalspecialization / lastname).
 * Success bodies are often a raw JSON array instead of { results, resultCount }.
 */
const AUSTRIA_SPECIALIZATION_SEEDS = [
  'Allgemeinmedizin',
  'Kinder- und Jugendheilkunde',
  'Innere Medizin',
  'Frauenheilkunde und Geburtshilfe',
  'Anästhesiologie und Intensivmedizin',
  'Orthopädie und Traumatologie',
  'Neurologie',
  'Psychiatrie und Psychotherapeutische Medizin',
  'Haut- und Geschlechtskrankheiten',
  'Augenheilkunde und Optometrie',
  'Urologie',
  'Radiologie',
  'Neurochirurgie',
  'Herzchirurgie',
  'Thoraxchirurgie',
  'Allgemeinchirurgie und Viszeralchirurgie',
  'Nuklearmedizin',
  'Strahlentherapie-Radioonkologie',
  'Medizinische Genetik',
  'Transfusionsmedizin',
  'Pharmakologie und Toxikologie',
  'Arbeitsmedizin',
  'Kinder- und Jugendchirurgie',
  'Kinder- und Jugendpsychiatrie',
  'Lungenkrankheiten',
  'Rheumatologie',
  'Gastroenterologie und Hepatologie',
  'Kardiologie',
  'Nephrologie',
  'Endokrinologie und Stoffwechselerkrankungen',
  'Hämatologie und internistische Onkologie',
];

class DataMatcherClient {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.apiTimeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async getToken({ force = false } = {}) {
    const skewMs = 30_000;
    if (!force && this.accessToken && Date.now() < this.tokenExpiresAt - skewMs) {
      return this.accessToken;
    }

    const url = `${config.apiUrl}/api/auth/token`;
    let response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'X-API-Key': config.apiKey,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      const message =
        err.name === 'AbortError'
          ? 'Zeitüberschreitung bei der Anmeldung an der DataMatcherAPI.'
          : 'DataMatcherAPI ist derzeit nicht erreichbar.';
      const error = new Error(message);
      error.code = 'UPSTREAM_UNAVAILABLE';
      error.cause = err;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(this.statusMessage(response.status, 'Anmeldung'));
      error.status = response.status;
      error.code = 'AUTH_FAILED';
      throw error;
    }

    const body = await response.json();
    if (!body || !body.accessToken) {
      const error = new Error('Unerwartete Antwort bei der Token-Ausstellung.');
      error.code = 'AUTH_INVALID_RESPONSE';
      throw error;
    }

    const expiresInSec = Number(body.expiresIn) || 900;
    this.accessToken = body.accessToken;
    this.tokenExpiresAt = Date.now() + expiresInSec * 1000;
    return this.accessToken;
  }

  statusMessage(status, action) {
    switch (status) {
      case 400:
        return `Ungültige Anfrage bei ${action}.`;
      case 401:
        return `Authentifizierung fehlgeschlagen bei ${action}.`;
      case 429:
        return `Zu viele Anfragen an die DataMatcherAPI (${action}). Bitte später erneut versuchen.`;
      case 500:
      case 502:
      case 503:
      case 504:
        return `Temporärer Serverfehler der DataMatcherAPI bei ${action}.`;
      default:
        return `Unerwarteter Fehler (${status}) bei ${action}.`;
    }
  }

  normalizePage(body) {
    // Post-DB-change: many successful searches return a raw array.
    if (Array.isArray(body)) {
      return { results: body, resultCount: body.length };
    }
    if (body && typeof body === 'object') {
      const results = Array.isArray(body.results) ? body.results : [];
      const resultCount =
        typeof body.resultCount === 'number' ? body.resultCount : results.length;
      return { results, resultCount, raw: body };
    }
    return { results: [], resultCount: 0 };
  }

  /**
   * Build filter groups that work after the DB/API drift.
   * Country alone is rejected — always pair with specialization or Zusatzfach.
   */
  buildSearchJobs() {
    const country = config.country;
    const focus = config.focusAdditionalSpecialization;
    const jobs = [];

    if (focus) {
      jobs.push({
        label: 'focus',
        payload: [{ country, additionalspecialization: focus }],
      });
      // Also without country in case country coupling regresses again.
      jobs.push({
        label: 'focus-nocountry',
        payload: [{ additionalspecialization: focus }],
      });
    }

    for (const specialization of AUSTRIA_SPECIALIZATION_SEEDS) {
      jobs.push({
        label: `spec:${specialization}`,
        payload: [{ country, specialization }],
      });
    }

    return jobs;
  }

  async searchPageWithPayload(payload, skip, take, { retried = false } = {}) {
    const token = await this.getToken();
    const url = `${config.apiUrl}/api/doctorsearch?skip=${skip}&take=${take}`;

    let response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const message =
        err.name === 'AbortError'
          ? 'Zeitüberschreitung bei der Ärztesuche.'
          : 'DataMatcherAPI ist derzeit nicht erreichbar.';
      const error = new Error(message);
      error.code = 'UPSTREAM_UNAVAILABLE';
      error.cause = err;
      throw error;
    }

    if (response.status === 401 && !retried) {
      await this.getToken({ force: true });
      return this.searchPageWithPayload(payload, skip, take, { retried: true });
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errBody = await response.json();
        detail = errBody && errBody.detail ? String(errBody.detail) : '';
      } catch {
        // ignore parse errors
      }
      // Keep upstream detail off the Error message (client-facing); retain on .detail for ops.
      if (detail) {
        console.warn(`DataMatcher search failed (${response.status}): ${detail.slice(0, 300)}`);
      }
      const error = new Error(this.statusMessage(response.status, 'Ärztesuche'));
      error.status = response.status;
      error.code = 'SEARCH_FAILED';
      error.detail = detail;
      throw error;
    }

    let body;
    try {
      body = await response.json();
    } catch {
      const error = new Error('Unerwartetes Antwortformat der DataMatcherAPI.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }

    return this.normalizePage(body);
  }

  async collectAllForPayload(payload, take, byId, { maxPages = 80 } = {}) {
    let skip = 0;
    let pages = 0;
    while (pages < maxPages) {
      const page = await this.searchPageWithPayload(payload, skip, take);
      pages += 1;
      for (const row of page.results) {
        if (!row || typeof row !== 'object') continue;
        const id = row.evoid;
        if (id === undefined || id === null || id === '') continue;
        const key = String(id);
        if (!byId.has(key)) byId.set(key, normalizeDoctorRow(row));
      }
      if (page.results.length === 0) break;
      if (page.results.length < take) break;
      skip += take;
    }
  }

  /**
   * Austria-wide pull via specialization + Fokus-Zusatzfach jobs (dedupe by evoid).
   * Avoids broken country-only filter after upstream DB change.
   */
  async fetchAllFocusDoctors() {
    const take = config.pageSize;
    const byId = new Map();
    const jobs = this.buildSearchJobs();
    const errors = [];

    for (const job of jobs) {
      try {
        await this.collectAllForPayload(job.payload, take, byId);
      } catch (err) {
        // Skip broken filter variants; keep going so partial corpus still loads.
        errors.push(`${job.label}: ${err.message || err}`);
      }
    }

    const doctors = Array.from(byId.values());
    if (doctors.length === 0) {
      const error = new Error(
        errors[0] ||
          'Keine Ärztedaten von der DataMatcherAPI erhalten (Filter nach DB-Änderung prüfen).'
      );
      error.code = 'SEARCH_FAILED';
      error.status = 502;
      error.details = errors;
      throw error;
    }

    const fieldFlags = detectOptionalFields(doctors);

    return {
      doctors,
      total: doctors.length,
      fetchedAt: new Date().toISOString(),
      fields: fieldFlags,
      focus: config.focusAdditionalSpecialization,
      country: config.country,
      upstreamNotes: errors.length ? errors.slice(0, 5) : undefined,
    };
  }
}

function normalizeDoctorRow(row) {
  // Keep known fields stable for the UI; coerce nullish specialty strings.
  return {
    ...row,
    title: row.title == null ? '' : row.title,
    firstname: row.firstname == null ? '' : row.firstname,
    lastname: row.lastname == null ? '' : row.lastname,
    city: row.city == null ? '' : row.city,
    specialization: row.specialization == null ? '' : row.specialization,
    additionalspecialization:
      row.additionalspecialization == null ? '' : row.additionalspecialization,
    country: row.country == null ? '' : row.country,
  };
}

function detectOptionalFields(doctors) {
  let hasPostal = false;
  let hasGender = false;
  let postalKey = null;
  let genderKey = null;

  for (const doc of doctors) {
    if (!hasPostal) {
      for (const key of OPTIONAL_POSTAL_KEYS) {
        if (Object.prototype.hasOwnProperty.call(doc, key) && doc[key] != null && doc[key] !== '') {
          hasPostal = true;
          postalKey = key;
          break;
        }
      }
      if (!hasPostal) {
        for (const key of OPTIONAL_POSTAL_KEYS) {
          if (Object.prototype.hasOwnProperty.call(doc, key)) {
            hasPostal = true;
            postalKey = key;
            break;
          }
        }
      }
    }
    if (!hasGender) {
      for (const key of OPTIONAL_GENDER_KEYS) {
        if (Object.prototype.hasOwnProperty.call(doc, key)) {
          hasGender = true;
          genderKey = key;
          break;
        }
      }
    }
    if (hasPostal && hasGender) break;
  }

  return {
    postalCode: hasPostal,
    postalKey,
    gender: hasGender,
    genderKey,
  };
}

module.exports = {
  DataMatcherClient,
  detectOptionalFields,
  normalizeDoctorRow,
  AUSTRIA_SPECIALIZATION_SEEDS,
  OPTIONAL_POSTAL_KEYS,
  OPTIONAL_GENDER_KEYS,
};
