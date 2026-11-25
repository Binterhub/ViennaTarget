'use strict';

const FOCUS_ZUSATZFACH = 'Neonatologie und Pädiatrische Intensivmedizin';

// Live API spelling; also accept earlier typo variant in UI matching.
const FOCUS_ZUSATZFACH_ALIASES = [
  FOCUS_ZUSATZFACH,
  'Neonatologie und pädriatrische Intensivmedizin',
  'Neonatologie und pädiatrische Intensivmedizin',
];


const state = {
  doctors: [],
  fields: { postalCode: false, gender: false, postalKey: null, genderKey: null },
  filtered: [],
  sortKey: 'lastname',
  sortDir: 'asc',
  page: 1,
  pageSize: 50,
  chart: null,
  chartExpanded: false,
  fetchedAt: null,
  focus: FOCUS_ZUSATZFACH,
  focusOnly: true,
  openEvoid: null,
};

const el = {
  banner: document.getElementById('banner'),
  statTotal: document.getElementById('stat-total'),
  statFocus: document.getElementById('stat-focus'),
  statCities: document.getElementById('stat-cities'),
  statFiltered: document.getElementById('stat-filtered'),
  chart: document.getElementById('city-chart'),
  chartWrap: document.getElementById('chart-wrap'),
  chartToggle: document.getElementById('chart-toggle'),
  chartToggleHint: document.getElementById('chart-toggle-hint'),
  filterName: document.getElementById('filter-name'),
  filterEvoid: document.getElementById('filter-evoid'),
  filterPostal: document.getElementById('filter-postal'),
  filterGender: document.getElementById('filter-gender'),
  filterCity: document.getElementById('filter-city'),
  fieldPostal: document.getElementById('field-postal'),
  fieldGender: document.getElementById('field-gender'),
  thPostal: document.getElementById('th-postal'),
  btnFocus: document.getElementById('btn-focus'),
  btnAllSpecs: document.getElementById('btn-all-specs'),
  btnReset: document.getElementById('btn-reset'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnLogout: document.getElementById('btn-logout'),
  btnExportXlsx: document.getElementById('btn-export-xlsx'),
  lastUpdated: document.getElementById('last-updated'),
  resultsSummary: document.getElementById('results-summary'),
  pageSize: document.getElementById('page-size'),
  tbody: document.getElementById('doctors-body'),
  pagePrev: document.getElementById('page-prev'),
  pageNext: document.getElementById('page-next'),
  pageInfo: document.getElementById('page-info'),
  loadingPanel: document.getElementById('loading-panel'),
  loadingTitle: document.getElementById('loading-title'),
  loadingElapsed: document.getElementById('loading-elapsed'),
  doctorDetail: document.getElementById('doctor-detail'),
  doctorDetailTitle: document.getElementById('doctor-detail-title'),
  doctorDetailSub: document.getElementById('doctor-detail-sub'),
  doctorDetailPhoto: document.getElementById('doctor-detail-photo'),
  doctorDetailFields: document.getElementById('doctor-detail-fields'),
  doctorDetailClose: document.getElementById('doctor-detail-close'),
  socialPreview: document.getElementById('social-preview'),
  socialPreviewClose: document.getElementById('social-preview-close'),
  socialPreviewIcon: document.getElementById('social-preview-icon'),
  socialPreviewTitle: document.getElementById('social-preview-title'),
  socialPreviewHost: document.getElementById('social-preview-host'),
  socialPreviewUrl: document.getElementById('social-preview-url'),
  socialPreviewOpen: document.getElementById('social-preview-open'),
  socialPreviewCopy: document.getElementById('social-preview-copy'),
};

/** Preferred display order / labels for known API person fields (case-insensitive lookup). */
const DETAIL_FIELD_DEFS = [
  { keys: ['evoid', 'evoId', 'EVOID'], label: 'EVO-ID', compact: true },
  // Titel / Vorname / Nachname are shown in the header only.
  { keys: ['title', 'Title'], label: 'Titel', headerOnly: true },
  { keys: ['firstname', 'firstName', 'FirstName'], label: 'Vorname', headerOnly: true },
  { keys: ['lastname', 'lastName', 'LastName'], label: 'Nachname', headerOnly: true },
  { keys: ['specialization', 'Specialization'], label: 'Hauptfach' },
  { keys: ['additionalspecialization', 'additionalSpecialization', 'AdditionalSpecialization'], label: 'Zusatzfach' },
  { keys: ['city', 'City'], label: 'Ort' },
  { keys: ['postalcode', 'postalCode', 'plz', 'zip', 'zipcode', 'zipCode'], label: 'Postleitzahl' },
  // Land / Ländercode omitted from detail panel (Austria-wide context).
  { keys: ['country', 'Country'], label: 'Land', headerOnly: true },
  { keys: ['countrycode', 'countryCode', 'CountryCode'], label: 'Ländercode', headerOnly: true },
  { keys: ['gender', 'geschlecht', 'sex', 'Geschlecht'], label: 'Geschlecht' },
  { keys: ['orcid', 'ORCID', 'Orcid'], label: 'ORCID', kind: 'social', icon: 'orcid' },
  { keys: ['openalexid', 'openAlexId', 'OpenAlexId', 'openalex'], label: 'OpenAlex', kind: 'openalex', icon: 'openalex' },
  { keys: ['homepage', 'Homepage', 'website', 'url'], label: 'Homepage', kind: 'social', icon: 'homepage' },
  { keys: ['facebook', 'Facebook'], label: 'Facebook', kind: 'social', icon: 'facebook' },
  { keys: ['linkedin', 'LinkedIn', 'linkedIn'], label: 'LinkedIn', kind: 'social', icon: 'linkedin' },
  { keys: ['researchgate', 'ResearchGate', 'researchGate'], label: 'ResearchGate', kind: 'social', icon: 'researchgate' },
  { keys: ['instagram', 'Instagram'], label: 'Instagram', kind: 'social', icon: 'instagram' },
  { keys: ['x', 'X', 'twitter', 'Twitter'], label: 'X', kind: 'social', icon: 'x' },
  { keys: ['youtube', 'YouTube', 'Youtube'], label: 'YouTube', kind: 'social', icon: 'youtube' },
  { keys: ['xing', 'Xing', 'XING'], label: 'Xing', kind: 'social', icon: 'xing' },
  // Photo is rendered as a linked image in the header — omit URL row from body.
  { keys: ['externalphoto', 'externalPhoto', 'ExternalPhoto', 'photo', 'image'], label: 'Foto', headerOnly: true },
  { keys: ['vpnr', 'vpNr', 'VpNr', 'VPN R', 'vp_nr'], label: 'VPNR' },
  { keys: ['hindex', 'hIndex', 'HIndex', 'h_index'], label: 'h-Index' },
  { keys: ['kasse', 'Kasse'], label: 'Kasse', kind: 'yesno' },
  { keys: ['wahlarzt', 'WahlArzt', 'wahlarztflag'], label: 'Wahlarzt', kind: 'yesno' },
];

const SOCIAL_EXTRA_KEY_RE =
  /^(facebook|linkedin|instagram|twitter|x|xing|youtube|tiktok|homepage|website|orcid|openalex|researchgate)/i;

const SOCIAL_ICON_BY_KEY = {
  facebook: 'facebook',
  linkedin: 'linkedin',
  instagram: 'instagram',
  twitter: 'x',
  x: 'x',
  xing: 'xing',
  youtube: 'youtube',
  tiktok: 'tiktok',
  homepage: 'homepage',
  website: 'homepage',
  orcid: 'orcid',
  openalex: 'openalex',
  openalexid: 'openalex',
  researchgate: 'researchgate',
};

function socialIconSvg(name) {
  const common = 'viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"';
  switch (name) {
    case 'facebook':
      return `<svg ${common}><path fill="currentColor" d="M14 8h2.5V5.5H14c-1.9 0-3.5 1.6-3.5 3.5V11H8v2.5h2.5V20H14v-6.5h2.3L17 11h-3V9c0-.6.4-1 1-1z"/></svg>`;
    case 'x':
      return `<svg ${common}><path fill="currentColor" d="M4.5 4h4.1l3.3 4.6L16.3 4H20l-5.4 6.3L20.5 20h-4.1l-3.6-5-4.2 5H4.5l5.7-6.7L4.5 4zm3.2 1.5 8.9 13h1.7L9.3 5.5H7.7z"/></svg>`;
    case 'linkedin':
      return `<svg ${common}><path fill="currentColor" d="M6.2 9.5H3.7V20h2.5V9.5zM5 3.8C4 3.8 3.2 4.6 3.2 5.6S4 7.4 5 7.4s1.8-.8 1.8-1.8S6 3.8 5 3.8zM20.3 12.3c0-2.4-1.5-4-3.9-4-1.3 0-2.3.6-2.8 1.4h-.1V9.5h-2.5c0 .7 0 10.5 0 10.5h2.5v-5.9c0-.3 0-.7.1-1 .3-.7.9-1.5 2-1.5 1.4 0 2 1.1 2 2.6V20h2.5v-7.7z"/></svg>`;
    case 'instagram':
      return `<svg ${common}><path fill="currentColor" d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9A4.5 4.5 0 0 1 16.5 21h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm0 1.7A2.8 2.8 0 0 0 4.7 7.5v9c0 1.5 1.3 2.8 2.8 2.8h9c1.5 0 2.8-1.3 2.8-2.8v-9c0-1.5-1.3-2.8-2.8-2.8h-9zm9.2 1.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM12 7.8A4.2 4.2 0 1 1 12 16.2 4.2 4.2 0 0 1 12 7.8zm0 1.7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>`;
    case 'orcid':
      return `<svg ${common}><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-3.1 4.4a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3zM7.7 9.7h2.3v7.8H7.7V9.7zm4.1 0h3.4c2.3 0 3.8 1.4 3.8 3.7s-1.5 4.1-3.9 4.1h-3.3V9.7zm2.3 1.8v4.6h1c1.4 0 2.2-.8 2.2-2.3s-.8-2.3-2.2-2.3h-1z"/></svg>`;
    case 'openalex':
      return `<svg ${common}><path fill="currentColor" d="M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3zm0 2.1 5.4 3v2.3L12 13.5 6.6 10.4V7.1L12 5.1zm-5.4 7.1L12 15.4l5.4-3.2v3.5L12 19l-5.4-3.2v-3.6z"/></svg>`;
    case 'researchgate':
      return `<svg ${common}><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-1.2 5.2h3.5c1.9 0 3.1 1.1 3.1 2.7 0 1.3-.7 2.2-1.8 2.6l2.1 3.3h-2.5l-1.8-3h-.7v3H9.8V7.2zm2.3 1.7h-.9v2.3h.9c.8 0 1.3-.4 1.3-1.2s-.5-1.1-1.3-1.1z"/></svg>`;
    case 'youtube':
      return `<svg ${common}><path fill="currentColor" d="M21.6 7.8a2.7 2.7 0 0 0-1.9-1.9C18 5.5 12 5.5 12 5.5s-6 0-7.7.4A2.7 2.7 0 0 0 2.4 7.8 28.4 28.4 0 0 0 2 12a28.4 28.4 0 0 0 .4 4.2 2.7 2.7 0 0 0 1.9 1.9c1.7.4 7.7.4 7.7.4s6 0 7.7-.4a2.7 2.7 0 0 0 1.9-1.9A28.4 28.4 0 0 0 22 12a28.4 28.4 0 0 0-.4-4.2zM10.2 15.1V8.9L15.5 12l-5.3 3.1z"/></svg>`;
    case 'xing':
      return `<svg ${common}><path fill="currentColor" d="M17.8 3h-2.6l-3.4 5.8L16 15.8h2.6l-4.2-7L17.8 3zM9.7 7.2H7.2l1.5 2.5L5.2 16h2.5l3.5-6.3L9.7 7.2z"/></svg>`;
    case 'tiktok':
      return `<svg ${common}><path fill="currentColor" d="M15.5 3c.4 2.1 1.7 3.7 3.8 4.1v2.4c-1.3 0-2.5-.4-3.6-1v5.5c0 3.2-2.5 5.6-5.7 5.6S4.3 17.2 4.3 14s2.5-5.6 5.7-5.6c.3 0 .6 0 .9.1v2.5a3.2 3.2 0 0 0-.9-.1 3.1 3.1 0 1 0 3.1 3.1V3h2.4z"/></svg>`;
    case 'homepage':
    default:
      return `<svg ${common}><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 3.5 4.5 10v9.5h5.2v-5.2h4.6v5.2h5.2V10L12 3.5z"/></svg>`;
  }
}

function socialIconForKey(key) {
  const k = String(key || '').toLocaleLowerCase('en-US');
  return SOCIAL_ICON_BY_KEY[k] || null;
}

/** Infer network from URL host — API sometimes stores LinkedIn under facebook/homepage. */
function socialIconFromUrl(url) {
  const raw = text(url).trim().toLocaleLowerCase('en-US');
  if (!raw) return null;
  if (raw.includes('linkedin.com')) return 'linkedin';
  if (raw.includes('researchgate.net')) return 'researchgate';
  if (raw.includes('facebook.com') || raw.includes('fb.com') || raw.includes('fb.me')) return 'facebook';
  if (raw.includes('instagram.com')) return 'instagram';
  if (raw.includes('orcid.org')) return 'orcid';
  if (raw.includes('openalex.org')) return 'openalex';
  if (raw.includes('youtube.com') || raw.includes('youtu.be')) return 'youtube';
  if (raw.includes('xing.com') && !raw.includes('profile-images.xing.com')) return 'xing';
  if (raw.includes('tiktok.com')) return 'tiktok';
  if (/(?:^|\.)x\.com(?:\/|$)/.test(raw) || raw.includes('twitter.com')) return 'x';
  return null;
}

function socialLabelForIcon(icon) {
  switch (icon) {
    case 'linkedin':
      return 'LinkedIn';
    case 'researchgate':
      return 'ResearchGate';
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'orcid':
      return 'ORCID';
    case 'openalex':
      return 'OpenAlex';
    case 'youtube':
      return 'YouTube';
    case 'xing':
      return 'Xing';
    case 'tiktok':
      return 'TikTok';
    case 'x':
      return 'X';
    case 'homepage':
      return 'Homepage';
    default:
      return icon || 'Profile';
  }
}

function renderSocialIconLink({ href, label, icon }) {
  const safeHref = href || '#';
  const safeIcon = icon || 'homepage';
  return `<a class="detail-social-link" href="${escapeHtml(safeHref)}" data-social-preview data-social-icon="${escapeHtml(safeIcon)}" data-social-label="${escapeHtml(label)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${socialIconSvg(safeIcon)}<span class="detail-social-sr">${escapeHtml(label)}</span></a>`;
}

function renderHomepageRow({ href, display }) {
  const safeHref = href || '#';
  const longClass = text(display).length > 30 ? ' detail-link-long' : '';
  return `<div class="detail-homepage"><dt>${socialIconSvg('homepage')}<span class="detail-social-sr">Homepage</span></dt><dd><a href="${escapeHtml(safeHref)}" data-social-preview data-social-icon="homepage" data-social-label="Homepage" target="_blank" rel="noopener noreferrer" class="detail-homepage-url${longClass}">${escapeHtml(display)}</a></dd></div>`;
}

function collectSocialLinksFromDoc(doc) {
  const byIcon = new Map();
  const mark = (href, icon, label, display) => {
    if (!href || !icon || icon === 'homepage') return;
    if (byIcon.has(icon)) return;
    byIcon.set(icon, {
      href,
      icon,
      label: label || socialLabelForIcon(icon),
      display: display || href,
    });
  };

  for (const def of DETAIL_FIELD_DEFS) {
    if (def.kind !== 'social' && def.kind !== 'openalex') continue;
    const picked = pickDoctorField(doc, def.keys);
    if (!picked.key) continue;
    const display = text(picked.value).trim();
    if (!display) continue;
    const href = hrefForField(def.kind === 'openalex' ? 'openalex' : 'link', picked.value);
    if (!href) continue;
    const fromUrl = socialIconFromUrl(href);
    const icon = fromUrl || def.icon || socialIconForKey(picked.key);
    if (!icon || icon === 'homepage') continue;
    mark(href, icon, socialLabelForIcon(icon), display);
  }

  // Sweep every string field for known profile hosts (covers misfiled LinkedIn/RG URLs).
  for (const [key, value] of Object.entries(doc || {})) {
    if (value === null || typeof value === 'object') continue;
    const display = text(value).trim();
    if (!display) continue;
    const href = hrefForField('link', value);
    if (!href) continue;
    const icon = socialIconFromUrl(href);
    if (!icon) continue;
    // Skip photo CDN URLs that only happen to live on a social host.
    if (key.toLocaleLowerCase('en-US').includes('photo') && !/\/in\//i.test(href) && !/profile\//i.test(href)) {
      continue;
    }
    mark(href, icon, socialLabelForIcon(icon), display);
  }

  return Array.from(byIcon.values());
}

let loadingTimer = null;
let loadingStartedAt = 0;

function setLoading(active, { refresh = false } = {}) {
  if (!el.loadingPanel) return;
  if (loadingTimer) {
    clearInterval(loadingTimer);
    loadingTimer = null;
  }
  if (!active) {
    el.loadingPanel.hidden = true;
    if (el.btnRefresh) el.btnRefresh.disabled = false;
    if (el.btnExportXlsx) el.btnExportXlsx.disabled = state.filtered.length === 0;
    return;
  }

  loadingStartedAt = Date.now();
  el.loadingPanel.hidden = false;
  if (el.loadingTitle) {
    el.loadingTitle.textContent = refresh
      ? 'Ärztedaten werden aktualisiert…'
      : 'Ärztedaten werden geladen…';
  }
  if (el.loadingElapsed) el.loadingElapsed.textContent = 'Laufzeit: 0 s';
  if (el.btnRefresh) el.btnRefresh.disabled = true;
  if (el.btnExportXlsx) el.btnExportXlsx.disabled = true;

  loadingTimer = setInterval(() => {
    const secs = Math.floor((Date.now() - loadingStartedAt) / 1000);
    if (el.loadingElapsed) {
      el.loadingElapsed.textContent =
        secs < 25
          ? `Laufzeit: ${secs} s`
          : `Laufzeit: ${secs} s — großer Abruf, bitte weiter warten`;
    }
  }, 1000);
}

function showBanner(message, type = 'warn') {
  if (!message) {
    el.banner.hidden = true;
    el.banner.textContent = '';
    el.banner.className = 'banner';
    return;
  }
  el.banner.hidden = false;
  el.banner.textContent = message;
  const typeClass =
    type === 'error' ? 'error' : type === 'info' ? 'info' : type === 'loading' ? 'loading' : '';
  el.banner.className = `banner ${typeClass}`.trim();
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalize(value) {
  return text(value).trim().toLocaleLowerCase('de-AT');
}

function compareDe(a, b) {
  return text(a).localeCompare(text(b), 'de', { sensitivity: 'base', numeric: true });
}

function getPostal(doc) {
  const key = state.fields.postalKey;
  if (key && Object.prototype.hasOwnProperty.call(doc, key)) return doc[key];
  return '';
}

function getGender(doc) {
  const key = state.fields.genderKey;
  if (key && Object.prototype.hasOwnProperty.call(doc, key)) return doc[key];
  return '';
}

function uniqueSorted(values) {
  const set = new Set();
  for (const v of values) {
    const t = text(v).trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort(compareDe);
}

function fillSelect(select, options, { keepSelection = true, preferSelected = [] } = {}) {
  const previous = keepSelection
    ? new Set(Array.from(select.selectedOptions).map((o) => o.value))
    : new Set(preferSelected);
  select.innerHTML = '';
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (previous.has(opt)) option.selected = true;
    select.appendChild(option);
  }
}

function selectedValues(select) {
  return Array.from(select.selectedOptions).map((o) => o.value);
}

function focusAliasNorms() {
  return FOCUS_ZUSATZFACH_ALIASES.map((s) => normalize(s));
}

function hasFocusZusatzfach(doc) {
  const raw = text(doc.additionalspecialization);
  if (!raw) return false;
  const aliases = focusAliasNorms();
  // Field may contain comma-separated values (OR semantics upstream).
  // Match exact focus / aliases — never match shorter unrelated Zusatzfächer.
  return raw
    .split(',')
    .map((part) => normalize(part))
    .some((part) => aliases.some((focus) => part === focus || part.includes(focus)));
}

function countFocusDoctors() {
  return state.doctors.filter(hasFocusZusatzfach).length;
}

function applyOptionalFields() {
  const showPostal = Boolean(state.fields.postalCode);
  const showGender = Boolean(state.fields.gender);
  el.thPostal.hidden = !showPostal;

  el.filterPostal.disabled = !showPostal;
  el.filterPostal.title = showPostal
    ? ''
    : 'Nicht in den aktuellen Daten verfügbar';
  el.fieldPostal.classList.toggle('field-disabled', !showPostal);
  if (!showPostal) el.filterPostal.value = '';

  el.filterGender.disabled = !showGender;
  el.filterGender.title = showGender
    ? ''
    : 'Nicht in den aktuellen Daten verfügbar';
  el.fieldGender.classList.toggle('field-disabled', !showGender);

  if (showGender) {
    const genders = uniqueSorted(state.doctors.map(getGender));
    const current = el.filterGender.value;
    el.filterGender.innerHTML = '<option value="">Alle</option>';
    for (const g of genders) {
      const option = document.createElement('option');
      option.value = g;
      option.textContent = g;
      el.filterGender.appendChild(option);
    }
    if (genders.includes(current)) el.filterGender.value = current;
  } else {
    el.filterGender.innerHTML = '<option value="">–</option>';
  }
}

function populateFilterOptions({ applyFocusDefault = false } = {}) {
  if (applyFocusDefault) state.focusOnly = true;
  updateFocusButtons();
  applyOptionalFields();
}

function updateFocusButtons() {
  if (el.btnFocus) el.btnFocus.classList.toggle('btn-primary', state.focusOnly);
  if (el.btnFocus) el.btnFocus.classList.toggle('btn-secondary', !state.focusOnly);
  if (el.btnAllSpecs) el.btnAllSpecs.classList.toggle('btn-primary', !state.focusOnly);
  if (el.btnAllSpecs) el.btnAllSpecs.classList.toggle('btn-secondary', state.focusOnly);
}

function selectFocusZusatzfach() {
  state.focusOnly = true;
  updateFocusButtons();
}

function clearAddSpecSelection() {
  state.focusOnly = false;
  updateFocusButtons();
}

function matchesFilters(doc) {
  const nameQ = normalize(el.filterName.value);
  if (nameQ) {
    const full = `${normalize(doc.firstname)} ${normalize(doc.lastname)}`;
    const reverse = `${normalize(doc.lastname)} ${normalize(doc.firstname)}`;
    if (
      !full.includes(nameQ) &&
      !reverse.includes(nameQ) &&
      !normalize(doc.firstname).includes(nameQ) &&
      !normalize(doc.lastname).includes(nameQ)
    ) {
      return false;
    }
  }

  const evoidQ = normalize(el.filterEvoid.value);
  if (evoidQ && !normalize(doc.evoid).includes(evoidQ)) return false;

  if (state.fields.postalCode) {
    const postalQ = normalize(el.filterPostal.value);
    if (postalQ && !normalize(getPostal(doc)).includes(postalQ)) return false;
  }

  if (state.fields.gender) {
    const genderQ = el.filterGender.value;
    if (genderQ && text(getGender(doc)) !== genderQ) return false;
  }

  const cityQ = normalize(el.filterCity.value);
  if (cityQ) {
    const city = normalize(doc.city);
    if (cityQ === normalize('(ohne Angabe)')) {
      if (city) return false;
    } else if (el.filterCity.dataset.exact === '1') {
      // Chart-bar clicks use exact Ort match (avoid Wien → Wiener Neustadt).
      if (city !== cityQ) return false;
    } else if (!city.includes(cityQ)) {
      return false;
    }
  }

  if (state.focusOnly && !hasFocusZusatzfach(doc)) return false;

  return true;
}

/** Title “power” ranks — lower number = higher power (Prim. first). */
const TITLE_POWER_RANKS = [
  { rank: 1, re: /\bprim\.?\b/ },
  { rank: 2, re: /\buniv\.?\s*-?\s*prof\.?\b/ },
  { rank: 3, re: /\bassoz\.?\s*-?\s*prof\.?\b/ },
  { rank: 4, re: /\buniv\.?\s*-?\s*doz\.?\b/ },
  { rank: 5, re: /\boa\b/ },
  { rank: 6, re: /\boä\b|\boae\b/ },
  { rank: 7, re: /\bpriv\.?\s*-?\s*doz\.?\b/ },
  { rank: 8, re: /\bass\.?\s*-?\s*prof\.?\b/ },
  { rank: 9, re: /\bprof\.?\b/ },
  { rank: 10, re: /\bfa\b/ },
  { rank: 11, re: /\bfä\b|\bfae\b/ },
  { rank: 12, re: /\buniv\.?\s*-?\s*ass\.?\b/ },
  { rank: 13, re: /\bddr\.?\b/ },
  { rank: 14, re: /\bdr\.?\b/ },
  { rank: 15, re: /\bmudr\.?\b/ },
  { rank: 16, re: /\bmag\.?\b/ },
];

function normalizeTitleForRank(value) {
  return text(value)
    .toLocaleLowerCase('de-AT')
    .normalize('NFKC')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[–—−]/g, '-')
    .replace(/[._/]+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlePowerRank(title) {
  const normalized = normalizeTitleForRank(title);
  if (!normalized) return 999;
  let best = 999;
  for (const { rank, re } of TITLE_POWER_RANKS) {
    if (rank >= best) continue;
    if (re.test(normalized)) best = rank;
  }
  return best;
}

function sortValue(doc, key) {
  if (key === 'postal') return getPostal(doc);
  return doc[key];
}

function sortDoctors(list) {
  const { sortKey, sortDir } = state;
  const dir = sortDir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    let cmp;
    if (sortKey === 'title') {
      // asc = highest power first (Prim. → … → Mag.)
      cmp = titlePowerRank(a.title) - titlePowerRank(b.title);
      if (cmp === 0) cmp = compareDe(a.title, b.title);
    } else {
      cmp = compareDe(sortValue(a, sortKey), sortValue(b, sortKey));
    }
    if (cmp === 0 && sortKey === 'lastname') {
      cmp = compareDe(a.firstname, b.firstname);
    }
    if (cmp === 0) {
      cmp = compareDe(a.lastname, b.lastname);
    }
    if (cmp === 0) {
      cmp = compareDe(a.evoid, b.evoid);
    }
    return cmp * dir;
  });
}

function computeBaseStats() {
  el.statTotal.textContent = String(state.doctors.length);
  el.statFocus.textContent = String(countFocusDoctors());
}

function topCities(list, n = 10) {
  const counts = new Map();
  for (const d of list) {
    const s = text(d.city).trim() || '(ohne Angabe)';
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || compareDe(a[0], b[0]))
    .slice(0, n);
}

function selectOnlyCity(cityLabel) {
  el.filterCity.value = cityLabel || '';
  el.filterCity.dataset.exact = cityLabel ? '1' : '';
}

function filterByCityFromChart(cityLabel) {
  if (!cityLabel) return;
  selectOnlyCity(cityLabel);
  state.sortKey = 'lastname';
  state.sortDir = 'asc';
  state.page = 1;
  updateSortHeaders();
  refreshView();
  showBanner(
    cityLabel === '(ohne Angabe)'
      ? 'Gefiltert: Ort ohne Angabe · sortiert nach Nachname.'
      : `Gefiltert: Ort „${cityLabel}“ · sortiert nach Nachname.`,
    'info'
  );
  setTimeout(() => showBanner(''), 2800);
  const results = document.querySelector('.results');
  if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function chartBarMetrics(expanded) {
  if (expanded) {
    return { barPercentage: 0.92, categoryPercentage: 0.92, maxBarThickness: 32 };
  }
  return { barPercentage: 0.45, categoryPercentage: 0.65, maxBarThickness: 8 };
}

function applyChartExpandedUi() {
  const expanded = Boolean(state.chartExpanded);
  if (el.chartWrap) el.chartWrap.classList.toggle('is-expanded', expanded);
  if (el.chartToggle) el.chartToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (el.chartToggleHint) el.chartToggleHint.textContent = expanded ? 'Zuklappen' : 'Aufklappen';
}

function syncChartBarMetrics() {
  if (!state.chart) return;
  const metrics = chartBarMetrics(state.chartExpanded);
  const ds = state.chart.data.datasets[0];
  ds.barPercentage = metrics.barPercentage;
  ds.categoryPercentage = metrics.categoryPercentage;
  ds.maxBarThickness = metrics.maxBarThickness;
  state.chart.options.maintainAspectRatio = !state.chartExpanded;
  state.chart.update();
  // Layout class may change canvas box — resize after paint.
  requestAnimationFrame(() => {
    if (state.chart) state.chart.resize();
  });
}

function setChartExpanded(expanded) {
  state.chartExpanded = Boolean(expanded);
  applyChartExpandedUi();
  syncChartBarMetrics();
}

function toggleChartExpanded() {
  setChartExpanded(!state.chartExpanded);
}

function renderChart(list) {
  const top = topCities(list, 10);
  const labels = top.map(([name]) => name);
  const values = top.map(([, count]) => count);

  const cities = new Set(list.map((d) => text(d.city).trim()).filter(Boolean));
  el.statCities.textContent = String(cities.size);

  const metrics = chartBarMetrics(state.chartExpanded);
  applyChartExpandedUi();

  if (state.chart) {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = values;
    state.chart.data.datasets[0].barPercentage = metrics.barPercentage;
    state.chart.data.datasets[0].categoryPercentage = metrics.categoryPercentage;
    state.chart.data.datasets[0].maxBarThickness = metrics.maxBarThickness;
    state.chart.update();
    return;
  }

  if (typeof Chart === 'undefined' || !el.chart) return;

  state.chart = new Chart(el.chart, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Anzahl',
          data: values,
          backgroundColor: '#0a5c5a',
          borderRadius: 2,
          barPercentage: metrics.barPercentage,
          categoryPercentage: metrics.categoryPercentage,
          maxBarThickness: metrics.maxBarThickness,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: !state.chartExpanded,
      layout: {
        padding: { top: 2, right: 6, bottom: 2, left: 0 },
      },
      onHover(event, elements) {
        const canvas = event?.native?.target || el.chart;
        if (canvas && canvas.style) {
          canvas.style.cursor = elements && elements.length ? 'pointer' : 'default';
        }
      },
      onClick(_event, elements, chart) {
        if (!elements || !elements.length) return;
        const index = elements[0].index;
        const label = chart.data.labels[index];
        filterByCityFromChart(label);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return items[0]?.label || '';
            },
            afterBody() {
              return 'Klicken zum Filtern nach Ort';
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: '#dce8e6' },
        },
        y: {
          ticks: {
            autoSkip: false,
            font: { size: 12 },
            callback(value) {
              const label = this.getLabelForValue(value);
              return label.length > 28 ? `${label.slice(0, 26)}…` : label;
            },
          },
          grid: { display: false },
        },
      },
    },
  });
}

function formatUpdated(iso) {
  if (!iso) return 'Letzte Aktualisierung: –';
  try {
    const d = new Date(iso);
    return `Letzte Aktualisierung: ${d.toLocaleString('de-AT')}`;
  } catch {
    return `Letzte Aktualisierung: ${iso}`;
  }
}

function stampExportFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `neotarget-aerzte-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`;
}

function exportFilteredXlsx() {
  if (!state.filtered.length) {
    showBanner('Keine Treffer zum Exportieren.', 'warn');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showBanner('XLSX-Bibliothek nicht geladen. Bitte Seite neu laden.', 'error');
    return;
  }

  const rows = state.filtered.map((d) => {
    const row = {
      'EVO-ID': text(d.evoid),
      Titel: text(d.title),
      Vorname: text(d.firstname),
      Nachname: text(d.lastname),
      Hauptfach: text(d.specialization),
      Zusatzfach: text(d.additionalspecialization),
      Ort: text(d.city),
      Land: text(d.country),
    };
    if (state.fields.postalCode) {
      row.Postleitzahl = text(getPostal(d));
    }
    if (state.fields.gender) {
      row.Geschlecht = text(getGender(d));
    }
    return row;
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Aerzte');
  XLSX.writeFile(book, stampExportFilename());
  showBanner(`${rows.length} Treffer als XLSX exportiert.`, 'info');
  setTimeout(() => showBanner(''), 2500);
}

function doctorKey(doc) {
  return text(doc && doc.evoid);
}

function pickDoctorField(doc, keys) {
  if (!doc || typeof doc !== 'object') return { key: null, value: undefined };
  const entries = Object.keys(doc);
  for (const want of keys) {
    const found = entries.find((k) => k.toLocaleLowerCase('en-US') === String(want).toLocaleLowerCase('en-US'));
    if (found !== undefined) return { key: found, value: doc[found] };
  }
  return { key: null, value: undefined };
}

function formatYesNo(value) {
  const raw = text(value).trim().toLocaleLowerCase('de-AT');
  if (!raw) return '';
  if (['yes', 'y', 'true', '1', 'ja', 'j'].includes(raw)) return 'Yes';
  if (['no', 'n', 'false', '0', 'nein'].includes(raw)) return 'No';
  return text(value);
}

function hrefForField(kind, value) {
  const raw = text(value).trim();
  if (!raw) return '';
  if (kind === 'openalex') {
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://openalex.org/${encodeURIComponent(raw)}`;
  }
  if (kind === 'link') {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^www\./i.test(raw)) return `https://${raw}`;
    if (raw.includes('@') && !raw.includes(' ')) return `mailto:${raw}`;
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) return `https://${raw}`;
    if (/^orcid\.org\//i.test(raw)) return `https://${raw}`;
    if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(raw)) return `https://orcid.org/${raw}`;
  }
  return raw.startsWith('http') ? raw : '';
}

function markOpenDoctorRow() {
  if (!el.tbody) return;
  const openKey = text(state.openEvoid);
  el.tbody.querySelectorAll('tr.doctor-row').forEach((row) => {
    row.classList.toggle('is-open', Boolean(openKey) && row.getAttribute('data-evoid') === openKey);
  });
}

function setDetailLayoutOpen(open) {
  document.body.classList.toggle('detail-open', Boolean(open));
  if (!open) document.body.classList.remove('social-preview-open');
}

function setSocialPreviewLayoutOpen(open) {
  document.body.classList.toggle('social-preview-open', Boolean(open) && document.body.classList.contains('detail-open'));
}

function closeSocialPreview() {
  if (!el.socialPreview) return;
  el.socialPreview.hidden = true;
  setSocialPreviewLayoutOpen(false);
  if (el.doctorDetailFields) {
    el.doctorDetailFields.querySelectorAll('[data-social-preview].is-active').forEach((node) => {
      node.classList.remove('is-active');
    });
  }
}

function hostFromHref(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function openSocialPreview({ href, icon, label }) {
  if (!el.socialPreview || !href) return;
  const network = label || socialLabelForIcon(icon) || 'Profile';
  const kind = icon || socialIconFromUrl(href) || 'homepage';
  const host = hostFromHref(href);

  if (el.socialPreviewIcon) {
    el.socialPreviewIcon.innerHTML = socialIconSvg(kind);
  }
  if (el.socialPreviewTitle) {
    el.socialPreviewTitle.textContent = network;
  }
  if (el.socialPreviewHost) {
    el.socialPreviewHost.textContent = host || '—';
    el.socialPreviewHost.hidden = !host;
  }
  if (el.socialPreviewUrl) {
    el.socialPreviewUrl.textContent = href;
  }
  if (el.socialPreviewOpen) {
    el.socialPreviewOpen.href = href;
  }
  if (el.socialPreviewCopy) {
    el.socialPreviewCopy.textContent = 'Link kopieren';
    el.socialPreviewCopy.disabled = false;
  }

  el.socialPreview.hidden = false;
  setSocialPreviewLayoutOpen(true);

  if (el.doctorDetailFields) {
    el.doctorDetailFields.querySelectorAll('[data-social-preview]').forEach((node) => {
      const match = node.getAttribute('href') === href;
      node.classList.toggle('is-active', match);
    });
  }
}

async function copySocialPreviewLink() {
  const href = el.socialPreviewOpen?.getAttribute('href') || '';
  if (!href || href === '#' || !el.socialPreviewCopy) return;
  try {
    await navigator.clipboard.writeText(href);
    el.socialPreviewCopy.textContent = 'Kopiert';
    window.setTimeout(() => {
      if (el.socialPreviewCopy) el.socialPreviewCopy.textContent = 'Link kopieren';
    }, 1600);
  } catch {
    el.socialPreviewCopy.textContent = 'Kopieren fehlgeschlagen';
  }
}

function closeDoctorDetail() {
  if (!el.doctorDetail) return;
  closeSocialPreview();
  el.doctorDetail.hidden = true;
  state.openEvoid = null;
  setDetailLayoutOpen(false);
  markOpenDoctorRow();
}

function openDoctorDetail(doc) {
  if (!el.doctorDetail || !doc) return;
  const wasHidden = el.doctorDetail.hidden;

  const titleParts = [
    pickDoctorField(doc, ['title', 'Title']).value,
    pickDoctorField(doc, ['firstname', 'firstName', 'FirstName']).value,
    pickDoctorField(doc, ['lastname', 'lastName', 'LastName']).value,
  ]
    .map((v) => text(v).trim())
    .filter(Boolean);
  const title = titleParts.join(' ') || 'Person';
  el.doctorDetailTitle.textContent = title;
  // Hauptfach / Zusatzfach live in the body fields — header only shows Ort when present.
  const city = text(doc.city).trim();
  if (el.doctorDetailSub) {
    el.doctorDetailSub.textContent = city;
    el.doctorDetailSub.hidden = !city;
  }

  const photo = pickDoctorField(doc, ['externalphoto', 'externalPhoto', 'ExternalPhoto', 'photo', 'image']);
  const photoUrl = hrefForField('link', photo.value);
  if (photoUrl && el.doctorDetailPhoto) {
    el.doctorDetailPhoto.hidden = false;
    el.doctorDetailPhoto.href = photoUrl;
    el.doctorDetailPhoto.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="Foto von ${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer" />`;
    // Broken / 404 photos: hide container entirely (no alt-text stub).
    const img = el.doctorDetailPhoto.querySelector('img');
    if (img) {
      const hideBrokenPhoto = () => {
        el.doctorDetailPhoto.hidden = true;
        el.doctorDetailPhoto.removeAttribute('href');
        el.doctorDetailPhoto.innerHTML = '';
      };
      img.addEventListener('error', hideBrokenPhoto, { once: true });
      if (img.complete && img.naturalWidth === 0) hideBrokenPhoto();
    }
  } else if (el.doctorDetailPhoto) {
    el.doctorDetailPhoto.hidden = true;
    el.doctorDetailPhoto.removeAttribute('href');
    el.doctorDetailPhoto.innerHTML = '';
  }

  const usedKeys = new Set();
  const rows = [];
  const socialLinks = collectSocialLinksFromDoc(doc);

  for (const def of DETAIL_FIELD_DEFS) {
    const picked = pickDoctorField(doc, def.keys);
    if (!picked.key) continue;
    usedKeys.add(picked.key.toLocaleLowerCase('en-US'));
    if (def.headerOnly) continue;

    let display = text(picked.value).trim();
    if (def.kind === 'yesno') display = formatYesNo(picked.value);

    // Social / profile links are rendered as icons below (and skipped here),
    // except a true personal homepage URL (not a LinkedIn/RG/etc. profile).
    if (def.kind === 'social' || def.kind === 'openalex') {
      if (!display) continue;
      const href = hrefForField(def.kind === 'openalex' ? 'openalex' : 'link', picked.value);
      if (!href) continue;
      const fromUrl = socialIconFromUrl(href);
      const icon = fromUrl || def.icon || socialIconForKey(picked.key) || 'homepage';
      if (icon === 'homepage') {
        rows.push(renderHomepageRow({ href, display }));
      }
      continue;
    }

    // Hide empty / null / blank detail rows (VPNR, h-Index, …).
    if (!display) continue;

    let valueHtml;
    if (def.kind === 'link') {
      const href = hrefForField('link', picked.value);
      valueHtml = href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(display)}</a>`
        : escapeHtml(display);
    } else {
      valueHtml = escapeHtml(display);
    }
    const rowClass = def.compact ? ' class="detail-evoid"' : '';
    rows.push(`<div${rowClass}><dt>${escapeHtml(def.label)}</dt><dd>${valueHtml}</dd></div>`);
  }

  // Any additional API fields not in the known map (skip social keys — handled via icons).
  const extras = Object.keys(doc)
    .filter((k) => !usedKeys.has(k.toLocaleLowerCase('en-US')))
    .sort(compareDe);
  for (const key of extras) {
    const value = doc[key];
    if (value !== null && typeof value === 'object') continue;
    const display = text(value).trim();
    if (!display) continue;
    if (SOCIAL_EXTRA_KEY_RE.test(key)) continue;
    if (socialIconFromUrl(display)) continue;
    rows.push(`<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(display)}</dd></div>`);
  }

  if (socialLinks.length) {
    const icons = socialLinks.map((s) => renderSocialIconLink(s)).join('');
    rows.push(
      `<div class="detail-socials"><dt>Profile</dt><dd class="detail-social-list">${icons}</dd></div>`
    );
  }

  el.doctorDetailFields.innerHTML = rows.join('') || '<div><dt>–</dt><dd class="doctor-detail-empty">Keine Felder</dd></div>';
  state.openEvoid = doctorKey(doc);
  closeSocialPreview();
  el.doctorDetail.hidden = false;
  setDetailLayoutOpen(true);
  markOpenDoctorRow();
  // Focus close only on first open — keep list keyboard-friendly when swapping rows.
  if (wasHidden && el.doctorDetailClose) el.doctorDetailClose.focus();
}

function findDoctorByEvoid(evoid) {
  const key = text(evoid);
  if (!key) return null;
  return (
    state.filtered.find((d) => doctorKey(d) === key) ||
    state.doctors.find((d) => doctorKey(d) === key) ||
    null
  );
}

function renderTable() {
  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.page > pages) state.page = pages;
  if (state.page < 1) state.page = 1;

  const start = (state.page - 1) * state.pageSize;
  const pageRows = state.filtered.slice(start, start + state.pageSize);

  el.statFiltered.textContent = String(total);
  el.resultsSummary.textContent =
    total === 0
      ? 'Keine Treffer für die aktuellen Filter.'
      : `Zeige ${start + 1}–${start + pageRows.length} von ${total} Treffern`;

  if (el.btnExportXlsx) {
    el.btnExportXlsx.disabled = total === 0;
  }

  el.pageInfo.textContent = `Seite ${state.page} von ${pages}`;
  el.pagePrev.disabled = state.page <= 1;
  el.pageNext.disabled = state.page >= pages;

  const colCount = state.fields.postalCode ? 8 : 7;

  if (pageRows.length === 0) {
    el.tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty">Keine Einträge gefunden.</td></tr>`;
    return;
  }

  const html = pageRows
    .map((d) => {
      const id = escapeHtml(doctorKey(d));
      const lastname = escapeHtml(text(d.lastname));
      const cells = [
        `<td class="cell-evoid">${escapeHtml(text(d.evoid))}</td>`,
        `<td class="cell-title">${escapeHtml(text(d.title))}</td>`,
        `<td class="cell-firstname">${escapeHtml(text(d.firstname))}</td>`,
        `<td class="cell-lastname"><button type="button" class="lastname-link" data-open-doctor="${id}">${lastname || '–'}</button></td>`,
        `<td class="cell-specialty">${escapeHtml(text(d.specialization))}</td>`,
        `<td class="cell-specialty">${escapeHtml(text(d.additionalspecialization))}</td>`,
        `<td>${escapeHtml(text(d.city))}</td>`,
      ];
      if (state.fields.postalCode) {
        cells.push(`<td>${escapeHtml(text(getPostal(d)))}</td>`);
      }
      const openClass = state.openEvoid && doctorKey(d) === text(state.openEvoid) ? ' is-open' : '';
      return `<tr class="doctor-row${openClass}" tabindex="0" data-evoid="${id}" title="Details anzeigen">${cells.join('')}</tr>`;
    })
    .join('');
  el.tbody.innerHTML = html;
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function refreshView() {
  state.filtered = sortDoctors(state.doctors.filter(matchesFilters));
  renderChart(state.filtered.length ? state.filtered : state.doctors);
  renderTable();
}

function updateSortHeaders() {
  document.querySelectorAll('#doctors-table th[data-sort]').forEach((th) => {
    const key = th.getAttribute('data-sort');
    th.classList.toggle('sorted', key === state.sortKey);
    th.classList.toggle('asc', key === state.sortKey && state.sortDir === 'asc');
    th.classList.toggle('desc', key === state.sortKey && state.sortDir === 'desc');
  });
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST', headers: { Accept: 'application/json' } });
  } catch {
    // still leave the app shell
  }
  window.location.href = '/login';
}

async function loadDoctors({ refresh = false } = {}) {
  const hadDoctors = state.doctors.length > 0;
  setLoading(true, { refresh });
  showBanner(
    refresh
      ? 'Daten werden aktualisiert (Austria-weiter Abruf, bitte warten)…'
      : 'Daten werden geladen (Austria-weiter Abruf kann 30–90 s dauern)…',
    'loading'
  );
  // Keep existing rows visible during refresh so a failed reload cannot blank the UI.
  if (!hadDoctors) {
    el.tbody.innerHTML = `<tr><td colspan="7" class="empty">Daten werden geladen — bitte warten…</td></tr>`;
  }
  if (el.resultsSummary && !hadDoctors) {
    el.resultsSummary.textContent = 'Lade Ärztedaten von DataMatcherAPI…';
  }

  try {
    const url = refresh ? '/api/doctors?refresh=1' : '/api/doctors';
    const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });

    if (res.status === 401) {
      setLoading(false);
      window.location.href = '/login';
      return;
    }

    const data = await res.json();
    const incoming = Array.isArray(data.doctors) ? data.doctors : [];

    if ((!data.success && incoming.length === 0) || (data.success && incoming.length === 0 && !hadDoctors)) {
      if (!hadDoctors) {
        state.doctors = [];
        state.filtered = [];
        computeBaseStats();
        el.statFiltered.textContent = '0';
        el.statCities.textContent = '0';
        el.tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(data.error || 'Keine Daten')}</td></tr>`;
        el.lastUpdated.textContent = formatUpdated(null);
      } else {
        refreshView();
      }
      showBanner(
        data.error ||
          (hadDoctors
            ? 'Aktualisierung fehlgeschlagen — bestehende Daten bleiben sichtbar.'
            : 'Daten konnten nicht geladen werden.'),
        'error'
      );
      return;
    }

    if (incoming.length === 0 && hadDoctors) {
      refreshView();
      showBanner('Aktualisierung lieferte keine Daten — bestehende Treffer bleiben sichtbar.', 'warn');
      return;
    }

    state.doctors = incoming;
    state.fields = data.fields || state.fields;
    state.fetchedAt = data.fetchedAt;
    state.focus = data.focus || FOCUS_ZUSATZFACH;
    state.page = 1;

    populateFilterOptions({ applyFocusDefault: true });
    computeBaseStats();
    refreshView();
    updateSortHeaders();
    el.lastUpdated.textContent = formatUpdated(data.fetchedAt);

    const focusCount = countFocusDoctors();

    if (data.warning) {
      showBanner(data.warning, 'warn');
    } else if (data.stale) {
      showBanner('Zwischengespeicherte Daten werden angezeigt.', 'warn');
    } else if (state.doctors.length === 0) {
      showBanner('Keine Ärztedaten für das Land gefunden.', 'warn');
    } else {
      showBanner(
        data.fromCache
          ? `Daten aus dem Cache (${state.doctors.length} gesamt, ${focusCount} mit Fokus-Zusatzfach).`
          : `${state.doctors.length} Ärztinnen und Ärzte geladen · ${focusCount} mit Fokus „${FOCUS_ZUSATZFACH}“.`,
        'info'
      );
      setTimeout(() => showBanner(''), 5000);
    }
  } catch {
    if (hadDoctors) {
      refreshView();
      showBanner('Netzwerkfehler — bestehende Daten bleiben sichtbar.', 'error');
    } else {
      showBanner('Netzwerkfehler beim Laden der Daten.', 'error');
      el.tbody.innerHTML = `<tr><td colspan="7" class="empty">Netzwerkfehler</td></tr>`;
    }
  } finally {
    setLoading(false);
  }
}

function resetFiltersToFocus() {
  el.filterName.value = '';
  el.filterEvoid.value = '';
  el.filterPostal.value = '';
  el.filterGender.value = '';
  el.filterCity.value = '';
  el.filterCity.dataset.exact = '';
  selectFocusZusatzfach();
  state.sortKey = 'lastname';
  state.sortDir = 'asc';
  state.page = 1;
  updateSortHeaders();
  refreshView();
}

function bindEvents() {
  const onFilterChange = () => {
    state.page = 1;
    refreshView();
  };

  ['input', 'change'].forEach((evt) => {
    el.filterName.addEventListener(evt, onFilterChange);
    el.filterEvoid.addEventListener(evt, onFilterChange);
    el.filterPostal.addEventListener(evt, onFilterChange);
    el.filterGender.addEventListener(evt, onFilterChange);
    el.filterCity.addEventListener(evt, () => {
      // Typing switches back to contains-match; chart click sets exact=1.
      el.filterCity.dataset.exact = '';
      onFilterChange();
    });
  });

  el.btnFocus.addEventListener('click', () => {
    selectFocusZusatzfach();
    state.page = 1;
    refreshView();
  });

  el.btnAllSpecs.addEventListener('click', () => {
    clearAddSpecSelection();
    state.page = 1;
    refreshView();
  });

  el.btnReset.addEventListener('click', resetFiltersToFocus);
  el.btnRefresh.addEventListener('click', () => loadDoctors({ refresh: true }));
  el.btnLogout.addEventListener('click', logout);
  if (el.btnExportXlsx) {
    el.btnExportXlsx.addEventListener('click', exportFilteredXlsx);
  }

  el.pageSize.addEventListener('change', () => {
    state.pageSize = Number(el.pageSize.value) || 50;
    state.page = 1;
    renderTable();
  });

  el.pagePrev.addEventListener('click', () => {
    state.page -= 1;
    renderTable();
  });
  el.pageNext.addEventListener('click', () => {
    state.page += 1;
    renderTable();
  });

  document.querySelectorAll('#doctors-table th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort');
      if (key === 'postal' && !state.fields.postalCode) return;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      updateSortHeaders();
      refreshView();
    });
  });

  el.tbody.addEventListener('click', (event) => {
    const openBtn = event.target.closest('[data-open-doctor]');
    const row = event.target.closest('tr.doctor-row');
    const evoid = openBtn?.getAttribute('data-open-doctor') || row?.getAttribute('data-evoid');
    if (!evoid) return;
    const doc = findDoctorByEvoid(evoid);
    if (doc) openDoctorDetail(doc);
  });

  el.tbody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('tr.doctor-row');
    if (!row) return;
    event.preventDefault();
    const doc = findDoctorByEvoid(row.getAttribute('data-evoid'));
    if (doc) openDoctorDetail(doc);
  });

  if (el.doctorDetailClose) {
    el.doctorDetailClose.addEventListener('click', closeDoctorDetail);
  }
  if (el.socialPreviewClose) {
    el.socialPreviewClose.addEventListener('click', closeSocialPreview);
  }
  if (el.socialPreviewCopy) {
    el.socialPreviewCopy.addEventListener('click', () => {
      copySocialPreviewLink();
    });
  }
  if (el.doctorDetailFields) {
    el.doctorDetailFields.addEventListener('click', (event) => {
      const link = event.target.closest('[data-social-preview]');
      if (!link || !el.doctorDetailFields.contains(link)) return;
      // Plain click → leftmost preview pane. Modified clicks → real site in a new tab.
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openSocialPreview({
        href: link.getAttribute('href'),
        icon: link.getAttribute('data-social-icon'),
        label: link.getAttribute('data-social-label'),
      });
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (el.socialPreview && !el.socialPreview.hidden) {
      closeSocialPreview();
      return;
    }
    if (el.doctorDetail && !el.doctorDetail.hidden) {
      closeDoctorDetail();
    }
  });
}

bindEvents();
loadDoctors();
