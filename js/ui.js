(function (global) {
'use strict';

var NAV_ITEMS = [
{ href: 'index.html',     label: 'Resumen Ejecutivo', icon: 'grid' },
{ href: 'ingresos.html',  label: 'Ingresos',          icon: 'trending-up' },
{ href: 'costos.html',    label: 'Costos',            icon: 'package' },
{ href: 'gastos.html',    label: 'Gastos',            icon: 'credit-card' },
{ href: 'cobranzas.html', label: 'Cobranzas',         icon: 'clock' }
];

var ICONS = {
'grid':         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
'trending-up':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
'package':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
'credit-card':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
'clock':        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
};

function currentPage() {
var path = window.location.pathname.split('/').pop() || 'index.html';
return path;
}

function renderSidebar() {
var active = currentPage();
var items = NAV_ITEMS.map(function(item) {
var isActive = item.href === active;
return '<a href="' + item.href + '" class="' + (isActive ? 'active' : '') + '">' +
'<span class="nav-icon">' + ICONS[item.icon] + '</span>' +
item.label + '</a>';
}).join('');

```
return '<nav class="sidebar">' +
  '<div class="sidebar-logo">' +
    '<div class="brand">NL<span>ace</span></div>' +
    '<div class="tagline">Financial Intelligence</div>' +
  '</div>' +
  '<div class="sidebar-year-badge">' +
    '<span class="label">Periodo</span>' +
    '<span class="year" id="sidebar-active-year">-</span>' +
  '</div>' +
  '<div class="sidebar-section-label">Vistas</div>' +
  '<div class="sidebar-nav">' + items + '</div>' +
  '<div class="sidebar-footer">' +
    '<div class="data-status">' +
      '<span class="status-dot loading" id="status-dot"></span>' +
      '<span id="status-text">Cargando datos...</span>' +
    '</div>' +
  '</div>' +
'</nav>';
```

}

function renderPageHeader(title, subtitle) {
return '<header class="page-header">' +
'<div class="page-header-left">' +
'<h1 class="page-title">' + title + '</h1>' +
'<span class="page-subtitle">' + subtitle + '</span>' +
'</div>' +
'<div class="header-controls">' +
'<div class="year-filter">' +
'<label>Ano</label>' +
'<select id="year-select" onchange="NLaceUI.onYearChange(this.value)">' +
'<option value="all">Todos</option>' +
'</select>' +
'</div>' +
'<span class="last-updated" id="last-updated"></span>' +
'</div>' +
'</header>';
}

function setDataStatus(state, text) {
var dot  = document.getElementById('status-dot');
var span = document.getElementById('status-text');
if (!dot || !span) return;
dot.className = 'status-dot ' + state;
span.textContent = text;
}

function populateYearSelector(years) {
var sel = document.getElementById('year-select');
if (!sel) return;
years.forEach(function(y) {
var opt = document.createElement('option');
opt.value = y;
opt.textContent = y;
sel.appendChild(opt);
});
if (years.length > 0) sel.value = years[0];
}

function setActiveYear(year) {
var badge = document.getElementById('sidebar-active-year');
if (badge) badge.textContent = year || '-';
var sel = document.getElementById('year-select');
if (sel && year) sel.value = String(year);
}

function setLastUpdated(date) {
var el = document.getElementById('last-updated');
if (!el || !date) return;
var fmt = date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
el.textContent = 'Act. ' + fmt;
}

function showLoading(containerId) {
var el = document.getElementById(containerId);
if (!el) return;
el.innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div><div class="loading-text">Procesando datos…</div></div>';
}

function showError(containerId, msg) {
var el = document.getElementById(containerId);
if (!el) return;
el.innerHTML = '<div class="error-card"><h3>Error al cargar datos</h3><p>' + (msg || 'No se pudo conectar con la fuente de datos.') + '</p></div>';
}

function kpiCard(opts) {
return '<div class="kpi-card">' +
'<div class="kpi-label">' +
'<span class="kpi-dot" style="background:' + (opts.dotColor || 'var(--text-muted)') + '"></span>' +
opts.label +
'</div>' +
'<div class="kpi-value ' + (opts.color || 'white') + '">' + opts.value + '</div>' +
(opts.sub ? '<div class="kpi-sub">' + opts.sub + '</div>' : '') +
'</div>';
}

function tableRow(cells, opts) {
opts = opts || {};
var tds = cells.map(function(c, i) {
var cls = [];
if (i === 0) cls.push('primary');
return '<td class="' + cls.join(' ') + '">' + c + '</td>';
}).join('');
return '<tr>' + tds + '</tr>';
}

global.NLaceUI = {
renderSidebar: renderSidebar,
renderPageHeader: renderPageHeader,
setDataStatus: setDataStatus,
populateYearSelector: populateYearSelector,
setActiveYear: setActiveYear,
setLastUpdated: setLastUpdated,
showLoading: showLoading,
showError: showError,
kpiCard: kpiCard,
tableRow: tableRow,
onYearChange: function() {}
};

})(window);
