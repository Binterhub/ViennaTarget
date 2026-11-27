'use strict';

/** Actual Zusatzfach filter value sent to / matched against DataMatcher data. */
const FOCUS_ZUSATZFACH = 'Neonatologie und Pädiatrische Intensivmedizin';
/** Visible product focus label in the UI (not the raw Zusatzfach string). */
const FOCUS_LABEL = 'Fokus: Poractant alfa';

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
  sortKey: 'title',
  sortDir: 'asc',
  page: 1,
  pageSize: 50,
  chart: null,
  chartExpanded: false,
  fetchedAt: null,
  focus: FOCUS_ZUSATZFACH,
  focusOnly: true,
  openEvoid: null,
  /** When h-Index presence filter is on: { sortKey, sortDir } to restore later. */
  sortBeforeHindex: null,
};

const el = {
  banner: document.getElementById('banner'),
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
  thZusatzfach: document.getElementById('th-zusatzfach'),
  thCity: document.getElementById('th-city'),
  thHindex: document.getElementById('th-hindex'),
  btnReset: document.getElementById('btn-reset'),
  moreFiltersToggle: document.getElementById('more-filters-toggle'),
  moreFiltersPanel: document.getElementById('more-filters-panel'),
  moreFiltersHint: document.getElementById('more-filters-hint'),
  presenceChecks: () =>
    Array.from(document.querySelectorAll('input[name="presence"][type="checkbox"]')),
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

/** Exact source labels for „Quelle: …“ hover tips (detail pane). */
const SOCIAL_SOURCE_TIP_BY_ICON = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'x',
  researchgate: 'Researchgate',
  orcid: 'ORCID',
  openalex: 'OpenAlex',
};

/** Preferred display order / labels for known API person fields (case-insensitive lookup). */
const DETAIL_FIELD_DEFS = [
  { keys: ['evoid', 'evoId', 'EVOID'], label: 'EVO-ID', compact: true },
  // Titel / Vorname / Nachname are shown in the header only.
  { keys: ['title', 'Title'], label: 'Titel', headerOnly: true },
  { keys: ['firstname', 'firstName', 'FirstName'], label: 'Vorname', headerOnly: true },
  { keys: ['lastname', 'lastName', 'LastName'], label: 'Nachname', headerOnly: true },
  { keys: ['specialization', 'Specialization'], label: 'Hauptfach', sourceTip: 'ÖÄK' },
  { keys: ['additionalspecialization', 'additionalSpecialization', 'AdditionalSpecialization'], label: 'Zusatzfach', sourceTip: 'ÖÄK' },
  { keys: ['city', 'City'], label: 'Ort', sourceTip: 'ÖÄK' },
  { keys: ['workstation', 'Workstation', 'workStation', 'dienstort', 'Dienstort'], label: 'DIENSTORT' },
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
  { keys: ['hindex', 'hIndex', 'HIndex', 'h_index'], label: 'h-Index', sourceTip: 'Scopus' },
  { keys: ['kasse', 'Kasse'], label: 'Kasse', kind: 'yesno', sourceTip: 'ÖÄK' },
  { keys: ['wahlarzt', 'WahlArzt', 'wahlarztflag'], label: 'Wahlarzt', kind: 'yesno' },
  {
    keys: ['expertwitness', 'expertWitness', 'ExpertWitness', 'sv', 'SV'],
    label: 'SV',
    kind: 'yesno',
    // Shown as logo badge in the detail header when Yes.
    headerOnly: true,
  },
];

function sourceTipText(sourceLabel) {
  return `Quelle: ${sourceLabel}`;
}

function sourceTipAttrs(sourceLabel) {
  if (!sourceLabel) return '';
  const tip = sourceTipText(sourceLabel);
  return ` title="${escapeHtml(tip)}" data-tip="${escapeHtml(tip)}"`;
}

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

/** Official-ish brand marks (Simple Icons paths); color via currentColor / CSS. */
function socialIconSvg(name) {
  const common =
    'class="detail-social-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"';
  switch (name) {
    case 'facebook':
      return `<svg ${common}><path fill="currentColor" d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
    case 'x':
      return `<svg ${common}><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    case 'linkedin':
      // Official-style “in” monogram (no outer box — button supplies the tile).
      return `<svg class="detail-social-svg detail-social-svg--linkedin" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.5 8.25A1.75 1.75 0 1 1 6.5 4.75a1.75 1.75 0 0 1 0 3.5zM5.15 9.6h2.7V19.5h-2.7V9.6zm4.85 0h2.59v1.36h.04c.36-.68 1.24-1.4 2.55-1.4 2.73 0 3.23 1.8 3.23 4.13V19.5h-2.7v-4.02c0-.96-.02-2.19-1.34-2.19-1.34 0-1.54 1.04-1.54 2.12V19.5H10V9.6z"/></svg>`;
    case 'instagram':
      return `<svg ${common}><path fill="currentColor" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`;
    case 'orcid':
      return `<svg ${common}><path fill="currentColor" d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z"/></svg>`;
    case 'openalex':
      // OpenAlex wordmark colors: coral node + teal edges
      return `<svg ${common}><circle cx="7.2" cy="12" r="3.2" fill="#E56B2E"/><circle cx="16.8" cy="7.2" r="2.6" fill="#18A29B"/><circle cx="16.8" cy="16.8" r="2.6" fill="#3B7EA1"/><path fill="none" stroke="#18A29B" stroke-width="1.6" d="M10 10.6 14.6 8.2"/><path fill="none" stroke="#3B7EA1" stroke-width="1.6" d="M10 13.4 14.6 15.8"/></svg>`;
    case 'researchgate':
      // Official ResearchGate “RG” lettermark (Simple Icons path).
      return `<svg class="detail-social-svg detail-social-svg--researchgate" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19.586 0c-.818 0-1.508.19-2.073.565-.563.377-.97.936-1.213 1.68a3.193 3.193 0 0 0-.112.437 8.365 8.365 0 0 0-.078.53 9 9 0 0 0-.05.727c-.01.282-.013.621-.013 1.016a31.121 31.123 0 0 0 .014 1.017 9 9 0 0 0 .05.727 7.946 7.946 0 0 0 .077.53h-.005a3.334 3.334 0 0 0 .113.438c.245.743.65 1.303 1.214 1.68.565.376 1.256.564 2.075.564.8 0 1.536-.213 2.105-.603.57-.39.94-.916 1.175-1.65.076-.235.135-.558.177-.93a10.9 10.9 0 0 0 .043-1.207v-.82c0-.095-.047-.142-.14-.142h-3.064c-.094 0-.14.047-.14.141v.956c0 .094.046.14.14.14h1.666c.056 0 .084.03.084.086 0 .36 0 .62-.036.865-.038.244-.1.447-.147.606-.108.385-.348.664-.638.876-.29.212-.738.35-1.227.35-.545 0-.901-.15-1.21-.353-.306-.203-.517-.454-.67-.915a3.136 3.136 0 0 1-.147-.762 17.366 17.367 0 0 1-.034-.656c-.01-.26-.014-.572-.014-.939a26.401 26.403 0 0 1 .014-.938 15.821 15.822 0 0 1 .035-.656 3.19 3.19 0 0 1 .148-.76 1.89 1.89 0 0 1 .742-1.01c.344-.244.593-.352 1.137-.352.508 0 .815.096 1.144.303.33.207.528.492.764.925.047.094.111.118.198.07l1.044-.43c.075-.048.09-.115.042-.199a3.549 3.549 0 0 0-.466-.742 3 3 0 0 0-.679-.607 3.313 3.313 0 0 0-.903-.41A4.068 4.068 0 0 0 19.586 0zM8.217 5.836c-1.69 0-3.036.086-4.297.086-1.146 0-2.291 0-3.007-.029v.831l1.088.2c.744.144 1.174.488 1.174 2.264v11.288c0 1.777-.43 2.12-1.174 2.263l-1.088.2v.832c.773-.029 2.12-.086 3.465-.086 1.29 0 2.951.057 3.667.086v-.831l-1.49-.2c-.773-.115-1.174-.487-1.174-2.264v-4.784c.688.057 1.29.057 2.206.057 1.748 3.123 3.41 5.472 4.355 6.56.86 1.032 2.177 1.691 3.839 1.691.487 0 1.003-.086 1.318-.23v-.744c-1.031 0-2.063-.716-2.808-1.518-1.26-1.376-2.95-3.582-4.355-6.074 2.32-.545 4.04-2.722 4.04-4.9 0-3.208-2.492-4.698-5.758-4.698zm-.515 1.29c2.406 0 3.839 1.26 3.839 3.552 0 2.263-1.547 3.782-4.097 3.782-.974 0-1.404-.03-2.063-.086v-7.19c.66-.059 1.547-.059 2.32-.059z"/></svg>`;
    case 'youtube':
      return `<svg ${common}><path fill="currentColor" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186 31.247 31.247 0 0 0 0 12a31.21 31.21 0 0 0 .502 5.814 3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136A31.21 31.21 0 0 0 24 12a31.247 31.247 0 0 0-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
    case 'xing':
      return `<svg ${common}><path fill="currentColor" d="M18.188 0c-.376 0-.703.152-.915.407L9.39 11.769l5.875 10.82a1.1 1.1 0 0 0 .941.547h3.313c.269 0 .49-.112.641-.293a.932.932 0 0 0 .146-.754L13.75 11.77l7.25-10.584A.98.98 0 0 0 20.844 0h-2.656zM5.656 4.5c-.269 0-.49.112-.641.293a.932.932 0 0 0-.146.754L7.5 11.25 3.844 17.5a.98.98 0 0 0 .156.984c.151.181.372.293.641.293h2.656c.376 0 .703-.152.915-.407L12 11.25 8.344 5.25A1.1 1.1 0 0 0 7.403 4.5H5.656z"/></svg>`;
    case 'tiktok':
      return `<svg ${common}><path fill="currentColor" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.95-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`;
    case 'homepage':
    default:
      return `<svg ${common}><path fill="currentColor" d="M12 3.172 3.172 12H5.5v7.5a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V12h2.328L12 3.172z"/></svg>`;
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
    case 'sv':
      return 'Sachverständiger';
    default:
      return icon || 'Profile';
  }
}

function renderSocialIconLink({ href, label, icon }) {
  const safeHref = href || '#';
  const safeIcon = icon || 'homepage';
  const sourceLabel = SOCIAL_SOURCE_TIP_BY_ICON[safeIcon] || '';
  const tipClass = sourceLabel ? ' has-source-tip' : '';
  const tip = sourceLabel ? sourceTipAttrs(sourceLabel) : ` title="${escapeHtml(label)}"`;
  return `<a class="detail-social-link${tipClass}" href="${escapeHtml(safeHref)}" data-social-preview data-social-icon="${escapeHtml(safeIcon)}" data-social-label="${escapeHtml(label)}" target="_blank" rel="noopener noreferrer"${tip} aria-label="${escapeHtml(label)}">${socialIconSvg(safeIcon)}<span class="detail-social-sr">${escapeHtml(label)}</span></a>`;
}

const SV_TOOLTIP_MAIN = 'Allgemein beeideter und gerichtlich zertifizierter Sachverständiger';
const SV_TOOLTIP_SOURCE = 'Quelle: Bundesministerium für Justiz (BMJ)';
const SV_TOOLTIP = `${SV_TOOLTIP_MAIN}\n${SV_TOOLTIP_SOURCE}`;
/** Official JustizOnline Sachverständigenliste (BMJ). */
const SV_LIST_URL = 'https://justizonline.gv.at/jop/web/sachverstaendigensuche';

/** Clickable circular SV mark → right-hand preview pane (like other profile icons). */
function renderSvProfileBadge() {
  const tip = escapeHtml(SV_TOOLTIP);
  const label = escapeHtml(SV_TOOLTIP_MAIN);
  return `<a class="detail-sv-badge has-source-tip" href="${escapeHtml(SV_LIST_URL)}" data-social-preview data-social-icon="sv" data-social-label="${label}" target="_blank" rel="noopener noreferrer" title="${tip}" data-tip="${tip}" aria-label="${label}"><img class="detail-sv-badge-img" src="/assets/sv-logo.png" alt="SV" width="128" height="128" /><span class="detail-social-sr">SV</span></a>`;
}

function truncateUrlLabel(value, max = 30) {
  const full = text(value);
  if (full.length <= max) return full;
  return `${full.slice(0, max)}...`;
}

function renderHomepageRow({ href, display }) {
  const safeHref = href || '#';
  const fullLabel = text(display) || safeHref;
  const shortLabel = truncateUrlLabel(fullLabel, 30);
  const longClass = fullLabel.length > 30 ? ' detail-link-long' : '';
  // Visible text is truncated; href + title keep the full URL for click/tooltip.
  return `<div class="detail-homepage"><dt>${socialIconSvg('homepage')}<span class="detail-social-sr">Homepage</span></dt><dd><a href="${escapeHtml(safeHref)}" title="${escapeHtml(fullLabel)}" data-tip="${escapeHtml(fullLabel)}" data-social-preview data-social-icon="homepage" data-social-label="Homepage" target="_blank" rel="noopener noreferrer" class="detail-homepage-url${longClass}">${escapeHtml(shortLabel)}</a></dd></div>`;
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

/** Friendly labels for leftover API keys shown in the detail pane. */
function labelForExtraField(key) {
  const k = text(key).toLocaleLowerCase('en-US');
  if (k === 'workstation' || k === 'dienstort') return 'DIENSTORT';
  return text(key);
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
  applyOptionalFields();
}

function selectFocusZusatzfach() {
  state.focusOnly = true;
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

  const selectedPresence = getSelectedPresenceFilters();
  if (selectedPresence.length > 0) {
    // OR across selected presence signals; AND with other filters above.
    if (!selectedPresence.some((key) => doctorHasPresence(doc, key))) return false;
  }

  return true;
}

function getSelectedPresenceFilters() {
  return el
    .presenceChecks()
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function fieldNonEmpty(doc, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(doc, key)) continue;
    const raw = text(doc[key]).trim();
    if (raw) return raw;
  }
  return '';
}

/** Presence for Weitere Filter — uses API fields; LinkedIn/RG also via URL host scan. */
function doctorHasPresence(doc, kind) {
  switch (kind) {
    case 'facebook': {
      const v = fieldNonEmpty(doc, ['facebook', 'Facebook']);
      if (v && socialIconFromUrl(v) !== 'linkedin') return true;
      return doctorUrlMentions(doc, ['facebook.com', 'fb.com', 'fb.me']);
    }
    case 'x': {
      const v = fieldNonEmpty(doc, ['x', 'X', 'twitter', 'Twitter']);
      if (v) return true;
      return doctorUrlMentions(doc, ['x.com', 'twitter.com']);
    }
    case 'linkedin': {
      const v = fieldNonEmpty(doc, ['linkedin', 'LinkedIn', 'linkedIn']);
      if (v) return true;
      return doctorUrlMentions(doc, ['linkedin.com']);
    }
    case 'researchgate': {
      const v = fieldNonEmpty(doc, ['researchgate', 'ResearchGate', 'researchGate']);
      if (v) return true;
      return doctorUrlMentions(doc, ['researchgate.net']);
    }
    case 'orcid': {
      const v = fieldNonEmpty(doc, ['orcid', 'ORCID', 'Orcid']);
      if (v) return true;
      return doctorUrlMentions(doc, ['orcid.org']);
    }
    case 'openalex': {
      const v = fieldNonEmpty(doc, ['openalexid', 'openAlexId', 'OpenAlexId', 'openalex']);
      if (v) return true;
      return doctorUrlMentions(doc, ['openalex.org']);
    }
    case 'kasse': {
      const raw = fieldNonEmpty(doc, ['kasse', 'Kasse']);
      if (!raw) return false;
      const n = raw.toLocaleLowerCase('de-AT');
      return ['yes', 'y', 'true', '1', 'ja', 'j'].includes(n);
    }
    case 'sv': {
      // DataMatcher: expertwitness Yes/No — court-sworn expert witness (Sachverständiger).
      const raw = fieldNonEmpty(doc, ['expertwitness', 'expertWitness', 'ExpertWitness', 'sv', 'SV']);
      if (!raw) return false;
      const n = raw.toLocaleLowerCase('de-AT');
      return ['yes', 'y', 'true', '1', 'ja', 'j'].includes(n);
    }
    case 'hindex': {
      const raw = fieldNonEmpty(doc, ['hindex', 'hIndex', 'HIndex', 'h_index']);
      if (!raw) return false;
      const n = Number(String(raw).replace(',', '.'));
      return Number.isFinite(n) && n > 0;
    }
    default:
      return false;
  }
}

function doctorUrlMentions(doc, needles) {
  const blob = [
    doc.facebook,
    doc.homepage,
    doc.linkedin,
    doc.researchgate,
    doc.x,
    doc.twitter,
    doc.orcid,
    doc.openalexid,
    doc.openalex,
    doc.externalphoto,
  ]
    .map((v) => text(v).toLocaleLowerCase('en-US'))
    .join(' ');
  return needles.some((n) => blob.includes(n));
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

function hindexNumber(doc) {
  const raw = fieldNonEmpty(doc, ['hindex', 'hIndex', 'HIndex', 'h_index']);
  if (!raw) return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function isHindexFilterActive() {
  return getSelectedPresenceFilters().includes('hindex');
}

function syncHindexColumnMode() {
  const active = isHindexFilterActive();
  if (el.thZusatzfach) el.thZusatzfach.hidden = active;
  if (el.thCity) el.thCity.hidden = active;
  if (el.thHindex) el.thHindex.hidden = !active;

  if (active) {
    // Entering h-Index mode: remember prior sort and switch to numeric desc once.
    if (!state.sortBeforeHindex) {
      state.sortBeforeHindex = { sortKey: state.sortKey, sortDir: state.sortDir };
      state.sortKey = 'hindex';
      state.sortDir = 'desc';
    }
  } else if (state.sortBeforeHindex) {
    state.sortKey = state.sortBeforeHindex.sortKey;
    state.sortDir = state.sortBeforeHindex.sortDir;
    state.sortBeforeHindex = null;
  }
  updateSortHeaders();
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
    } else if (sortKey === 'hindex') {
      const na = hindexNumber(a);
      const nb = hindexNumber(b);
      if (na == null && nb == null) cmp = 0;
      else if (na == null) cmp = 1;
      else if (nb == null) cmp = -1;
      else cmp = na - nb;
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

function rankCities(list) {
  const counts = new Map();
  for (const d of list) {
    const s = text(d.city).trim() || '(ohne Angabe)';
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || compareDe(a[0], b[0]));
}

/** Draw HCP counts at the end of each horizontal bar. */
const hcpCountLabelsPlugin = {
  id: 'hcpCountLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data) return;
    ctx.save();
    const expanded = chart.canvas?.closest?.('.chart-wrap')?.classList.contains('is-expanded');
    const fontSize = expanded ? 13 : 10;
    ctx.fillStyle = '#063d3c';
    ctx.font = `600 ${fontSize}px "DM Sans", "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';
    meta.data.forEach((bar, i) => {
      const value = chart.data.datasets[0].data[i];
      if (value == null) return;
      const label = String(value);
      const x = Math.min(bar.x + 6, chart.chartArea.right - ctx.measureText(label).width - 2);
      ctx.textAlign = 'left';
      ctx.fillText(label, x, bar.y);
    });
    ctx.restore();
  },
};

function chartPixelHeight(rowCount, expanded) {
  if (!expanded) return 72;
  const rows = Math.max(rowCount, 1);
  return Math.max(220, rows * 30 + 20);
}

function applyChartCanvasHeight(rowCount) {
  if (!el.chart) return;
  const h = chartPixelHeight(rowCount, state.chartExpanded);
  el.chart.style.height = `${h}px`;
  el.chart.height = h;
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
    return {
      barPercentage: 0.88,
      categoryPercentage: 0.9,
      maxBarThickness: 42,
      tickFont: 13,
      valuePadRight: 28,
      labelMax: 32,
    };
  }
  return {
    barPercentage: 0.45,
    categoryPercentage: 0.65,
    maxBarThickness: 8,
    tickFont: 10,
    valuePadRight: 22,
    labelMax: 22,
  };
}

function applyChartExpandedUi() {
  const expanded = Boolean(state.chartExpanded);
  if (el.chartWrap) el.chartWrap.classList.toggle('is-expanded', expanded);
  if (el.chartToggle) el.chartToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (el.chartToggleHint) el.chartToggleHint.textContent = expanded ? 'Zuklappen' : 'Aufklappen';
}

function applyChartScaleFonts(metrics) {
  if (!state.chart?.options?.scales) return;
  const max = metrics.labelMax;
  state.chart.options.layout.padding.right = metrics.valuePadRight;
  state.chart.options.scales.x.ticks.font = { size: metrics.tickFont };
  state.chart.options.scales.y.ticks.font = { size: metrics.tickFont };
  state.chart.options.scales.y.ticks.callback = function truncatedLabel(value) {
    const label = this.getLabelForValue(value);
    return label.length > max ? `${label.slice(0, max - 1)}…` : label;
  };
}

function syncChartBarMetrics() {
  if (!state.chart) return;
  const metrics = chartBarMetrics(state.chartExpanded);
  const ds = state.chart.data.datasets[0];
  ds.barPercentage = metrics.barPercentage;
  ds.categoryPercentage = metrics.categoryPercentage;
  ds.maxBarThickness = metrics.maxBarThickness;
  state.chart.options.maintainAspectRatio = false;
  applyChartScaleFonts(metrics);
  const rowCount = state.chart.data.labels?.length || 0;
  applyChartCanvasHeight(rowCount);
  state.chart.update();
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
  const ranked = rankCities(list);
  const labels = ranked.map(([name]) => name);
  const values = ranked.map(([, count]) => count);

  const metrics = chartBarMetrics(state.chartExpanded);
  applyChartExpandedUi();
  applyChartCanvasHeight(labels.length);

  if (state.chart) {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = values;
    state.chart.data.datasets[0].barPercentage = metrics.barPercentage;
    state.chart.data.datasets[0].categoryPercentage = metrics.categoryPercentage;
    state.chart.data.datasets[0].maxBarThickness = metrics.maxBarThickness;
    state.chart.options.maintainAspectRatio = false;
    applyChartScaleFonts(metrics);
    state.chart.update();
    requestAnimationFrame(() => {
      if (state.chart) state.chart.resize();
    });
    return;
  }

  if (typeof Chart === 'undefined' || !el.chart) return;

  state.chart = new Chart(el.chart, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'HCPs',
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
      maintainAspectRatio: false,
      layout: {
        padding: { top: 4, right: metrics.valuePadRight, bottom: 4, left: 0 },
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
            label(item) {
              const n = item.parsed?.x ?? item.raw;
              return `${n} HCP${n === 1 ? '' : 's'}`;
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
          ticks: { precision: 0, font: { size: metrics.tickFont } },
          grid: { color: '#dce8e6' },
        },
        y: {
          ticks: {
            autoSkip: false,
            font: { size: metrics.tickFont },
            callback(value) {
              const label = this.getLabelForValue(value);
              const max = metrics.labelMax;
              return label.length > max ? `${label.slice(0, max - 1)}…` : label;
            },
          },
          grid: { display: false },
        },
      },
    },
    plugins: [hcpCountLabelsPlugin],
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
      DIENSTORT: text(d.workstation),
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

/** Allow only http(s) URLs for rendered href/src (blocks javascript:/data:/etc.). */
function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hrefForField(kind, value) {
  const raw = text(value).trim();
  if (!raw) return '';
  if (kind === 'openalex') {
    if (/^https?:\/\//i.test(raw)) return isHttpUrl(raw) ? raw : '';
    const built = `https://openalex.org/${encodeURIComponent(raw)}`;
    return isHttpUrl(built) ? built : '';
  }
  if (kind === 'link') {
    if (/^https?:\/\//i.test(raw)) return isHttpUrl(raw) ? raw : '';
    if (/^www\./i.test(raw)) {
      const built = `https://${raw}`;
      return isHttpUrl(built) ? built : '';
    }
    if (raw.includes('@') && !raw.includes(' ') && !/^https?:/i.test(raw)) {
      return `mailto:${raw}`;
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) {
      const built = `https://${raw}`;
      return isHttpUrl(built) ? built : '';
    }
    if (/^orcid\.org\//i.test(raw)) {
      const built = `https://${raw}`;
      return isHttpUrl(built) ? built : '';
    }
    if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(raw)) {
      return `https://orcid.org/${raw}`;
    }
  }
  return isHttpUrl(raw) ? raw : '';
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
    el.socialPreviewIcon.innerHTML =
      kind === 'sv'
        ? `<img class="social-preview-sv-img" src="/assets/sv-logo.png" alt="SV" width="128" height="128" />`
        : socialIconSvg(kind);
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
    const photoHost = hostFromHref(photoUrl);
    if (photoHost) {
      const tip = sourceTipText(photoHost);
      el.doctorDetailPhoto.classList.add('has-source-tip');
      el.doctorDetailPhoto.title = tip;
      el.doctorDetailPhoto.setAttribute('data-tip', tip);
    } else {
      el.doctorDetailPhoto.classList.remove('has-source-tip');
      el.doctorDetailPhoto.removeAttribute('title');
      el.doctorDetailPhoto.removeAttribute('data-tip');
    }
    // Broken / 404 photos: hide container entirely (no alt-text stub / no tip).
    const img = el.doctorDetailPhoto.querySelector('img');
    if (img) {
      const hideBrokenPhoto = () => {
        el.doctorDetailPhoto.hidden = true;
        el.doctorDetailPhoto.removeAttribute('href');
        el.doctorDetailPhoto.classList.remove('has-source-tip');
        el.doctorDetailPhoto.removeAttribute('title');
        el.doctorDetailPhoto.removeAttribute('data-tip');
        el.doctorDetailPhoto.innerHTML = '';
      };
      img.addEventListener('error', hideBrokenPhoto, { once: true });
      if (img.complete && img.naturalWidth === 0) hideBrokenPhoto();
    }
  } else if (el.doctorDetailPhoto) {
    el.doctorDetailPhoto.hidden = true;
    el.doctorDetailPhoto.removeAttribute('href');
    el.doctorDetailPhoto.classList.remove('has-source-tip');
    el.doctorDetailPhoto.removeAttribute('title');
    el.doctorDetailPhoto.removeAttribute('data-tip');
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
    const classes = [];
    if (def.compact) classes.push('detail-evoid');
    if (def.sourceTip) classes.push('has-source-tip');
    const rowClass = classes.length ? ` class="${classes.join(' ')}"` : '';
    const tip = def.sourceTip ? sourceTipAttrs(def.sourceTip) : '';
    rows.push(`<div${rowClass}${tip}><dt>${escapeHtml(def.label)}</dt><dd>${valueHtml}</dd></div>`);
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
    rows.push(
      `<div><dt>${escapeHtml(labelForExtraField(key))}</dt><dd>${escapeHtml(display)}</dd></div>`
    );
  }

  const isSv = doctorHasPresence(doc, 'sv');
  if (socialLinks.length || isSv) {
    const icons = [
      ...socialLinks.map((s) => renderSocialIconLink(s)),
      ...(isSv ? [renderSvProfileBadge()] : []),
    ].join('');
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

  const hindexMode = isHindexFilterActive();
  const colCount = 5 + (hindexMode ? 1 : 2) + (state.fields.postalCode ? 1 : 0);

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
      ];
      if (hindexMode) {
        const hi = hindexNumber(d);
        cells.push(
          `<td class="cell-hindex">${hi == null ? '–' : `<strong>${escapeHtml(String(hi))}</strong>`}</td>`
        );
      } else {
        cells.push(`<td class="cell-specialty">${escapeHtml(text(d.additionalspecialization))}</td>`);
        cells.push(`<td>${escapeHtml(text(d.city))}</td>`);
      }
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
  syncHindexColumnMode();
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
    // Server always pulls live from DataMatcher (no response cache).
    const url = '/api/doctors';
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
          : `${state.doctors.length} Ärztinnen und Ärzte geladen · ${focusCount} mit „${FOCUS_LABEL}“.`,
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
  el.presenceChecks().forEach((input) => {
    input.checked = false;
  });
  setMoreFiltersExpanded(false);
  selectFocusZusatzfach();
  state.sortBeforeHindex = null;
  state.sortKey = 'title';
  state.sortDir = 'asc';
  state.page = 1;
  updateSortHeaders();
  refreshView();
}

function setMoreFiltersExpanded(expanded) {
  const open = Boolean(expanded);
  if (el.moreFiltersToggle) el.moreFiltersToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (el.moreFiltersPanel) el.moreFiltersPanel.hidden = !open;
  if (el.moreFiltersHint) el.moreFiltersHint.textContent = open ? 'Zuklappen' : 'Aufklappen';
}

function bindEvents() {
  applyChartExpandedUi();
  if (el.chartToggle) {
    el.chartToggle.addEventListener('click', () => {
      toggleChartExpanded();
    });
  }

  if (el.moreFiltersToggle) {
    setMoreFiltersExpanded(false);
    el.moreFiltersToggle.addEventListener('click', () => {
      const open = el.moreFiltersToggle.getAttribute('aria-expanded') === 'true';
      setMoreFiltersExpanded(!open);
    });
  }

  const onFilterChange = () => {
    state.page = 1;
    refreshView();
  };

  el.presenceChecks().forEach((input) => {
    input.addEventListener('change', onFilterChange);
  });

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

  el.btnReset.addEventListener('click', resetFiltersToFocus);
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
      if (th.hidden) return;
      const key = th.getAttribute('data-sort');
      if (key === 'postal' && !state.fields.postalCode) return;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        // h-Index defaults to highest first; other columns to A→Z / asc.
        state.sortDir = key === 'hindex' ? 'desc' : 'asc';
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
