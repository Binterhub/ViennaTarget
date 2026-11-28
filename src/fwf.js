'use strict';

const { config } = require('./config');

const FWF_OPEN_API_BASE = 'https://openapi.fwf.ac.at';

function normalizeOrcid(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const m = raw.match(/(?:orcid\.org\/)?(\d{4}-\d{4}-\d{4}-\d{3}[\dX])$/i);
  return m ? m[1].toUpperCase() : '';
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function detailUrlFromHit(hit) {
  const fromApi = firstNonEmpty(hit['_str.url']);
  if (fromApi) {
    // Prefer www host; API sometimes returns fwf.ac.at without www (301).
    return fromApi.replace(/^https?:\/\/fwf\.ac\.at\//i, 'https://www.fwf.ac.at/');
  }
  const doi = firstNonEmpty(hit['_str.grantdoi']);
  if (!doi) return '';
  return `https://www.fwf.ac.at/en/research-radar/${doi}`;
}

function mapProjectHit(hit) {
  const grantDoi = firstNonEmpty(hit['_str.grantdoi']);
  const grantId = grantDoi.includes('/') ? grantDoi.split('/').pop() : grantDoi;
  return {
    id: firstNonEmpty(hit.id),
    grantDoi,
    grantId,
    title: firstNonEmpty(hit['_str.projecttitle.de'], hit['_str.projecttitle.en']),
    titleEn: firstNonEmpty(hit['_str.projecttitle.en']),
    program: firstNonEmpty(hit['_str.program.de'], hit['_str.program.en']),
    amount: hit['_long.approvedamount'] == null ? null : Number(hit['_long.approvedamount']),
    keywords: Array.isArray(hit['_list.keywords.split']) ? hit['_list.keywords.split'] : [],
    status: firstNonEmpty(hit['_str.status.de'], hit['_str.status.en']),
    startDate: firstNonEmpty(hit['_date.startdate']),
    endDate: firstNonEmpty(hit['_date.enddate']),
    url: detailUrlFromHit(hit),
    principalInvestigator: {
      firstname: firstNonEmpty(hit['_str.principalinvestigator.firstname']),
      lastname: firstNonEmpty(hit['_str.principalinvestigator.lastname']),
      orcid: normalizeOrcid(hit['_str.principalinvestigator.orcid']),
    },
  };
}

/**
 * Search FWF Forschungsradar (Open API / Meilisearch) for projects led by ORCID.
 * Token stays server-side — never expose to the browser.
 */
async function findProjectsByOrcid(orcidRaw) {
  const orcid = normalizeOrcid(orcidRaw);
  if (!orcid) {
    const err = new Error('ORCID fehlt oder ist ungültig.');
    err.code = 'BAD_ORCID';
    throw err;
  }
  if (!config.fwfOpenApiToken) {
    const err = new Error('FWF Open API Token ist nicht konfiguriert.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.apiTimeoutMs);
  try {
    const res = await fetch(`${FWF_OPEN_API_BASE}/indexes/projects/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.fwfOpenApiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // High limit: one person can lead many FWF projects; we return all matches.
      body: JSON.stringify({ q: `"${orcid}"`, limit: 100 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`FWF Open API Fehler (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const hits = Array.isArray(data.hits) ? data.hits : [];
    const seen = new Set();
    const projects = [];
    for (const hit of hits) {
      const p = mapProjectHit(hit);
      if (!p.url || p.principalInvestigator.orcid !== orcid) continue;
      const key = p.grantDoi || p.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      projects.push(p);
    }
    // Stable order: newest start date first, then grant id.
    projects.sort((a, b) => {
      const da = a.startDate || '';
      const db = b.startDate || '';
      if (da !== db) return db.localeCompare(da);
      return String(a.grantId || '').localeCompare(String(b.grantId || ''));
    });
    return { orcid, projects, total: projects.length };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  FWF_OPEN_API_BASE,
  normalizeOrcid,
  findProjectsByOrcid,
};
