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
  fetchedAt: null,
  focus: FOCUS_ZUSATZFACH,
};

const el = {
  banner: document.getElementById('banner'),
  statTotal: document.getElementById('stat-total'),
  statFocus: document.getElementById('stat-focus'),
  statCities: document.getElementById('stat-cities'),
  statFiltered: document.getElementById('stat-filtered'),
  chart: document.getElementById('city-chart'),
  filterName: document.getElementById('filter-name'),
  filterEvoid: document.getElementById('filter-evoid'),
  filterPostal: document.getElementById('filter-postal'),
  filterGender: document.getElementById('filter-gender'),
  filterCity: document.getElementById('filter-city'),
  filterSpec: document.getElementById('filter-spec'),
  filterAddSpec: document.getElementById('filter-addspec'),
  fieldPostal: document.getElementById('field-postal'),
  fieldGender: document.getElementById('field-gender'),
  thPostal: document.getElementById('th-postal'),
  btnFocus: document.getElementById('btn-focus'),
  btnAllSpecs: document.getElementById('btn-all-specs'),
  btnReset: document.getElementById('btn-reset'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnLogout: document.getElementById('btn-logout'),
  lastUpdated: document.getElementById('last-updated'),
  resultsSummary: document.getElementById('results-summary'),
  pageSize: document.getElementById('page-size'),
  tbody: document.getElementById('doctors-body'),
  pagePrev: document.getElementById('page-prev'),
  pageNext: document.getElementById('page-next'),
  pageInfo: document.getElementById('page-info'),
};

function showBanner(message, type = 'warn') {
  if (!message) {
    el.banner.hidden = true;
    el.banner.textContent = '';
    el.banner.className = 'banner';
    return;
  }
  el.banner.hidden = false;
  el.banner.textContent = message;
  el.banner.className = `banner ${type === 'error' ? 'error' : type === 'info' ? 'info' : ''}`;
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
  fillSelect(el.filterSpec, uniqueSorted(state.doctors.map((d) => d.specialization)));

  const addSpecs = uniqueSorted(state.doctors.map((d) => d.additionalspecialization));
  // Ensure focus label is present even if spelling variants differ in data
  if (!addSpecs.includes(FOCUS_ZUSATZFACH)) {
    // Prefer exact match variants already in data; otherwise inject focus string for UX
    const focusNorm = normalize(FOCUS_ZUSATZFACH);
    const existing = addSpecs.find((s) => normalize(s) === focusNorm || normalize(s).includes(focusNorm));
    if (!existing) addSpecs.unshift(FOCUS_ZUSATZFACH);
  }

  const prefer = applyFocusDefault ? [FOCUS_ZUSATZFACH] : undefined;
  fillSelect(el.filterAddSpec, addSpecs, {
    keepSelection: !applyFocusDefault,
    preferSelected: prefer || [],
  });

  // If focus string was injected but data uses a close variant, select that variant too
  if (applyFocusDefault) {
    selectFocusZusatzfach();
  }

  applyOptionalFields();
}

function selectFocusZusatzfach() {
  const aliases = focusAliasNorms();
  let matched = false;
  Array.from(el.filterAddSpec.options).forEach((o) => {
    const n = normalize(o.value);
    // Prefer exact / contains-focus match; never select short unrelated values.
    const isFocus = aliases.some((focus) => n === focus || n.includes(focus));
    o.selected = isFocus;
    if (isFocus) matched = true;
  });
  if (!matched) {
    Array.from(el.filterAddSpec.options).forEach((o) => {
      o.selected = o.value === FOCUS_ZUSATZFACH;
    });
  }
}

function clearAddSpecSelection() {
  Array.from(el.filterAddSpec.options).forEach((o) => {
    o.selected = false;
  });
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
    } else if (!city.includes(cityQ)) {
      return false;
    }
  }

  const specs = selectedValues(el.filterSpec);
  if (specs.length && !specs.includes(text(doc.specialization).trim())) return false;

  const addSpecs = selectedValues(el.filterAddSpec);
  if (addSpecs.length) {
    const docAdd = text(doc.additionalspecialization).trim();
    const parts = docAdd
      ? docAdd.split(',').map((p) => p.trim())
      : [docAdd];
    const hit = addSpecs.some((sel) => parts.includes(sel) || docAdd === sel);
    if (!hit) return false;
  }

  return true;
}

function sortValue(doc, key) {
  if (key === 'postal') return getPostal(doc);
  return doc[key];
}

function sortDoctors(list) {
  const { sortKey, sortDir } = state;
  const dir = sortDir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    let cmp = compareDe(sortValue(a, sortKey), sortValue(b, sortKey));
    if (cmp === 0 && sortKey === 'lastname') {
      cmp = compareDe(a.firstname, b.firstname);
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

function renderChart(list) {
  const top = topCities(list, 10);
  const labels = top.map(([name]) => name);
  const values = top.map(([, count]) => count);

  const cities = new Set(list.map((d) => text(d.city).trim()).filter(Boolean));
  el.statCities.textContent = String(cities.size);

  if (state.chart) {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = values;
    state.chart.update();
    return;
  }

  if (typeof Chart === 'undefined') return;

  state.chart = new Chart(el.chart, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Anzahl',
          data: values,
          backgroundColor: '#0a5c5a',
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
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
          ticks: { precision: 0 },
          grid: { color: '#dce8e6' },
        },
        y: {
          ticks: {
            autoSkip: false,
            callback(value) {
              const label = this.getLabelForValue(value);
              return label.length > 42 ? `${label.slice(0, 40)}…` : label;
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
      const cells = [
        `<td class="cell-evoid">${escapeHtml(text(d.evoid))}</td>`,
        `<td>${escapeHtml(text(d.title))}</td>`,
        `<td>${escapeHtml(text(d.firstname))}</td>`,
        `<td class="cell-lastname">${escapeHtml(text(d.lastname))}</td>`,
        `<td>${escapeHtml(text(d.specialization))}</td>`,
        `<td>${escapeHtml(text(d.additionalspecialization))}</td>`,
        `<td>${escapeHtml(text(d.city))}</td>`,
      ];
      if (state.fields.postalCode) {
        cells.push(`<td>${escapeHtml(text(getPostal(d)))}</td>`);
      }
      return `<tr>${cells.join('')}</tr>`;
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
  showBanner(refresh ? 'Daten werden aktualisiert…' : 'Daten werden geladen…');
  el.tbody.innerHTML = `<tr><td colspan="7" class="empty">Daten werden geladen…</td></tr>`;

  try {
    const url = refresh ? '/api/doctors?refresh=1' : '/api/doctors';
    const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const data = await res.json();

    if (!data.success && (!data.doctors || data.doctors.length === 0)) {
      state.doctors = [];
      state.filtered = [];
      computeBaseStats();
      el.statFiltered.textContent = '0';
      el.statCities.textContent = '0';
      showBanner(data.error || 'Daten konnten nicht geladen werden.', 'error');
      el.tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(data.error || 'Keine Daten')}</td></tr>`;
      el.lastUpdated.textContent = formatUpdated(null);
      return;
    }

    state.doctors = Array.isArray(data.doctors) ? data.doctors : [];
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
      setTimeout(() => showBanner(''), 4000);
    }
  } catch {
    showBanner('Netzwerkfehler beim Laden der Daten.', 'error');
    el.tbody.innerHTML = `<tr><td colspan="7" class="empty">Netzwerkfehler</td></tr>`;
  }
}

function resetFiltersToFocus() {
  el.filterName.value = '';
  el.filterEvoid.value = '';
  el.filterPostal.value = '';
  el.filterGender.value = '';
  el.filterCity.value = '';
  Array.from(el.filterSpec.options).forEach((o) => {
    o.selected = false;
  });
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
    el.filterCity.addEventListener(evt, onFilterChange);
    el.filterSpec.addEventListener(evt, onFilterChange);
    el.filterAddSpec.addEventListener(evt, onFilterChange);
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
}

bindEvents();
loadDoctors();
