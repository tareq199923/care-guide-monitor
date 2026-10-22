const REFRESH_MS = 30000;

const severityFilter = document.getElementById('severityFilter');
const apiNameFilter = document.getElementById('apiNameFilter');
const applyFilters = document.getElementById('applyFilters');
const refreshBtn = document.getElementById('refreshBtn');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const emptyEl = document.getElementById('empty');
const tableEl = document.getElementById('alertsTable');
const tbody = document.getElementById('alertsBody');

let refreshTimer = null;

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function buildQuery() {
  const params = new URLSearchParams();
  if (severityFilter.value) params.set('severity', severityFilter.value);
  if (apiNameFilter.value.trim()) params.set('api_name', apiNameFilter.value.trim());
  const qs = params.toString();
  return qs ? `/alerts?${qs}` : '/alerts';
}

async function loadAlerts() {
  hide(errorEl);
  show(loadingEl);
  hide(emptyEl);
  hide(tableEl);
  statusEl.textContent = '';

  try {
    const res = await fetch(buildQuery());
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    const data = await res.json();
    const alerts = data.alerts || [];

    hide(loadingEl);
    if (alerts.length === 0) {
      show(emptyEl);
      return;
    }
    show(tableEl);
    renderRows(alerts);
    statusEl.textContent = `${data.count ?? alerts.length} active alert(s)`;
  } catch (err) {
    hide(loadingEl);
    errorEl.textContent = `Failed to load alerts: ${err.message}`;
    show(errorEl);
  }
}

function renderRows(alerts) {
  tbody.innerHTML = '';
  for (const a of alerts) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(a.api_name)}</td>
      <td>${escapeHtml(a.type)}</td>
      <td><span class="badge ${escapeHtml(a.severity)}">${escapeHtml(a.severity)}</span></td>
      <td>${escapeHtml(a.message)}</td>
      <td class="occ">${a.occurrences ?? 1}</td>
      <td>${formatDate(a.lastSeenAt || a.createdAt)}</td>
      <td><button class="resolve-btn" data-id="${escapeHtml(a._id)}">Resolve</button></td>
    `;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('.resolve-btn').forEach((btn) => {
    btn.addEventListener('click', () => resolveAlert(btn.dataset.id, btn));
  });
}

async function resolveAlert(id, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const res = await fetch(`/alerts/${encodeURIComponent(id)}/resolve`, { method: 'PATCH' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Resolve failed (${res.status})`);
    }
    await loadAlerts();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Resolve';
    errorEl.textContent = `Failed to resolve alert: ${err.message}`;
    show(errorEl);
  }
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

applyFilters.addEventListener('click', loadAlerts);
refreshBtn.addEventListener('click', loadAlerts);
severityFilter.addEventListener('change', loadAlerts);
apiNameFilter.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadAlerts();
});

loadAlerts();
refreshTimer = setInterval(loadAlerts, REFRESH_MS);
window.addEventListener('beforeunload', () => {
  if (refreshTimer) clearInterval(refreshTimer);
});
