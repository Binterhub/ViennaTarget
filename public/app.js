'use strict';

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
};

const el = {
  banner: document.getElementById('banner'),
  statTotal: document.getElementById('stat-total'),
  statSpecs: document.getElementById('stat-specs'),
  statAdditional: document.getElementById('stat-additional'),
  statFiltered: document.getElementById('stat-filtered'),
  chart: document.getElementById('spec-chart'),
  filterName: document.getElementById('filter-name'),
  filterEvoid: document.getElementById('filter-evoid'),
  filterPostal: document.getElementById('filter-postal'),
  filterGender: document.getElementById('filter-gender'),
  filterSpec: document.getElementById('filter-spec'),
  filterAddSpec: document.getElementById('filter-addspec'),
  fieldPostal: document.getElementById('field-postal'),
  fieldGender: document.getElementById('field-gender'),
  thPostal: document.getElementById('th-postal'),
  btnReset: document.getElementById('btn-reset'),
  btnRefresh: document.getElementById('btn-refresh'),
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

function fillSelect(select, options, { keepSelection = true } = {}) {
  const previous = keepSelection
    ? new Set(Array.from(select.selectedOptions).map((o) => o.value))
    : new Set();
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

function applyOptionalFields() {
  const showPostal = Boolean(state.fields.postalCode);
  const showGender = Boolean(state.fields.gender);
  el.fieldPostal.hidden = !showPostal;
  el.thPostal.hidden = !showPostal;
  el.fieldGender.hidden = !showGender;

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
  }
}

function populateFilterOptions() {
  fillSelect(
    el.filterSpec,
    uniqueSorted(state.doctors.map((d) => d.specialization))
  );
  fillSelect(
    el.filterAddSpec,
    uniqueSorted(state.doctors.map((d) => d.additionalspecialization))
  );
  applyOptionalFields();
}

function matchesFilters(doc) {
  const nameQ = normalize(el.filterName.value);
  if (nameQ) {
    const full = `${normalize(doc.firstname)} ${normalize(doc.lastname)}`;
    const reverse = `${normalize(doc.lastname)} ${normalize(doc.firstname)}`;
    if (!full.includes(nameQ) && !reverse.includes(nameQ) && !normalize(doc.firstname).includes(nameQ) && !normalize(doc.lastname).includes(nameQ)) {
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

  const specs = selectedValues(el.filterSpec);
  if (specs.length && !specs.includes(text(doc.specialization).trim())) return false;

  const addSpecs = selectedValues(el.filterAddSpec);
  if (addSpecs.length && !addSpecs.includes(text(doc.additionalspecialization).trim())) {
    return false;
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
  const specs = new Set();
  let withAdditional = 0;
  for (const d of state.doctors) {
    const s = text(d.specialization).trim();
    if (s) specs.add(s);
    if (text(d.additionalspecialization).trim()) withAdditional += 1;
  }
  el.statTotal.textContent = String(state.doctors.length);
  el.statSpecs.textContent = String(specs.size);
  el.statAdditional.textContent = String(withAdditional);
}

function topSpecializations(list, n = 10) {
  const counts = new Map();
  for (const d of list) {
    const s = text(d.specialization).trim() || '(ohne Angabe)';
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || compareDe(a[0], b[0]))
    .slice(0, n);
}

function renderChart(list) {
  const top = topSpecializations(list, 10);
  const labels = top.map(([name]) => name);
  const values = top.map(([, count]) => count);

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
          backgroundColor: '#0b3d6e',
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return items[0]?.label || '';
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: '#e4ebf3' },
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
        text(d.evoid),
        text(d.title),
        text(d.firstname),
        text(d.lastname),
        text(d.specialization),
        text(d.additionalspecialization),
        text(d.city),
      ];
      if (state.fields.postalCode) cells.push(text(getPostal(d)));
      return `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`;
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

async function loadDoctors({ refresh = false } = {}) {
  showBanner(refresh ? 'Daten werden aktualisiert…' : 'Daten werden geladen…');
  el.tbody.innerHTML = `<tr><td colspan="7" class="empty">Daten werden geladen…</td></tr>`;

  try {
    const url = refresh ? '/api/doctors?refresh=1' : '/api/doctors';
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();

    if (!data.success && (!data.doctors || data.doctors.length === 0)) {
      state.doctors = [];
      state.filtered = [];
      computeBaseStats();
      el.statFiltered.textContent = '0';
      showBanner(data.error || 'Daten konnten nicht geladen werden.', 'error');
      el.tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(data.error || 'Keine Daten')}</td></tr>`;
      el.lastUpdated.textContent = formatUpdated(null);
      return;
    }

    state.doctors = Array.isArray(data.doctors) ? data.doctors : [];
    state.fields = data.fields || state.fields;
    state.fetchedAt = data.fetchedAt;
    state.page = 1;

    populateFilterOptions();
    computeBaseStats();
    refreshView();
    updateSortHeaders();
    el.lastUpdated.textContent = formatUpdated(data.fetchedAt);

    if (data.warning) {
      showBanner(data.warning, 'warn');
    } else if (data.stale) {
      showBanner('Zwischengespeicherte Daten werden angezeigt.', 'warn');
    } else if (state.doctors.length === 0) {
      showBanner('Keine Ärztedaten für Wien gefunden.', 'warn');
    } else {
      showBanner(
        data.fromCache
          ? `Daten aus dem Cache (${state.doctors.length} Einträge).`
          : `${state.doctors.length} Ärztinnen und Ärzte geladen.`,
        'info'
      );
      setTimeout(() => showBanner(''), 3500);
    }
  } catch {
    showBanner('Netzwerkfehler beim Laden der Daten.', 'error');
    el.tbody.innerHTML = `<tr><td colspan="7" class="empty">Netzwerkfehler</td></tr>`;
  }
}

function resetFilters() {
  el.filterName.value = '';
  el.filterEvoid.value = '';
  el.filterPostal.value = '';
  el.filterGender.value = '';
  Array.from(el.filterSpec.options).forEach((o) => {
    o.selected = false;
  });
  Array.from(el.filterAddSpec.options).forEach((o) => {
    o.selected = false;
  });
  state.page = 1;
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
    el.filterSpec.addEventListener(evt, onFilterChange);
    el.filterAddSpec.addEventListener(evt, onFilterChange);
  });

  el.btnReset.addEventListener('click', resetFilters);
  el.btnRefresh.addEventListener('click', () => loadDoctors({ refresh: true }));

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
