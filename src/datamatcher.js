'use strict';

const { config } = require('./config');

const OPTIONAL_POSTAL_KEYS = ['postalcode', 'postalCode', 'plz', 'zip', 'zipcode', 'zipCode'];
const OPTIONAL_GENDER_KEYS = ['gender', 'geschlecht', 'sex', 'Geschlecht'];

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
   * Broad Austria (or SEARCH_COUNTRY) pull — focus Zusatzfach is a client default,
   * not an exclusive server lock (mirrors Vienna Target's city focus).
   */
  searchPayload() {
    return [
      {
        country: config.country,
      },
    ];
  }

  async searchPage(skip, take, { retried = false } = {}) {
    const token = await this.getToken();
    const url = `${config.apiUrl}/api/doctorsearch?skip=${skip}&take=${take}`;
    const payload = this.searchPayload();

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
      return this.searchPage(skip, take, { retried: true });
    }

    if (!response.ok) {
      const error = new Error(this.statusMessage(response.status, 'Ärztesuche'));
      error.status = response.status;
      error.code = 'SEARCH_FAILED';
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

  /**
   * Fetch all doctors for the configured country via pagination (take max 500).
   * Deduplicate by evoid. NeoTarget emphasizes Zusatzfach
   * "Neonatologie und pädriatrische Intensivmedizin" in the UI as the default filter.
   */
  async fetchAllFocusDoctors() {
    const take = config.pageSize;
    const byId = new Map();
    let skip = 0;
    let pages = 0;
    const maxPages = 200;

    while (pages < maxPages) {
      const page = await this.searchPage(skip, take);
      pages += 1;

      for (const row of page.results) {
        if (!row || typeof row !== 'object') continue;
        const id = row.evoid;
        if (id === undefined || id === null || id === '') continue;
        const key = String(id);
        if (!byId.has(key)) {
          byId.set(key, row);
        }
      }

      if (page.results.length === 0) break;
      if (page.results.length < take) break;

      skip += take;
    }

    const doctors = Array.from(byId.values());
    const fieldFlags = detectOptionalFields(doctors);

    return {
      doctors,
      total: doctors.length,
      fetchedAt: new Date().toISOString(),
      fields: fieldFlags,
      focus: config.focusAdditionalSpecialization,
      country: config.country,
    };
  }
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
  OPTIONAL_POSTAL_KEYS,
  OPTIONAL_GENDER_KEYS,
};
