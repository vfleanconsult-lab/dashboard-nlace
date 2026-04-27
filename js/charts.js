(function (global) {
'use strict';

var COLORS = {
green:    '#00e5a0',
blue:     '#3b82f6',
amber:    '#f59e0b',
red:      '#ef4444',
purple:   '#a78bfa',
cyan:     '#22d3ee',
pink:     '#f472b6',
orange:   '#fb923c',
grid:     'rgba(255,255,255,0.05)',
text:     '#8a9bb0'
};

var PALETTE = [
'#00e5a0','#3b82f6','#f59e0b',
'#a78bfa','#22d3ee','#f472b6',
'#fb923c','#ef4444'
];

function hexToRgba(hex, alpha) {
var r = parseInt(hex.slice(1,3),16);
var g = parseInt(hex.slice(3,5),16);
var b = parseInt(hex.slice(5,7),16);
return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function applyGlobalDefaults() {
Chart.defaults.color = COLORS.text;
Chart.defaults.font.family = “'DM Mono', monospace”;
Chart.defaults.font.size = 10;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#1c2028';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = '#f0f2f5';
Chart.defaults.plugins.tooltip.bodyColor = '#8a9bb0';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

function destroyChart(canvasId) {
var existing = Chart.getChart(canvasId);
if (existing) existing.destroy();
}

function makeScales(opts) {
opts = opts || {};
var scales = {
x: {
grid: { color: COLORS.grid, drawBorder: false },
ticks: { color: COLORS.text },
border: { display: false }
},
y: {
grid: { color: COLORS.grid, drawBorder: false },
ticks: {
color: COLORS.text,
callback: opts.ytick || function(v) { return NLaceData.formatCLP(v, true); }
},
border: { display: false }
}
};
if (opts.stacked) { scales.x.stacked = true; scales.y.stacked = true; }
return scales;
}

function renderBarLine(canvasId, labels, barData, lineData, opts) {
opts = opts || {};
destroyChart(canvasId);
var ctx = document.getElementById(canvasId);
if (!ctx) return;
return new Chart(ctx, {
type: 'bar',
data: {
labels: labels,
datasets: [
{
type: 'bar',
label: opts.barLabel || 'Ventas',
data: barData,
backgroundColor: hexToRgba(COLORS.green, 0.7),
borderColor: COLORS.green,
borderWidth: 1,
borderRadius: 4,
borderSkipped: false,
yAxisID: 'y'
},
{
type: 'line',
label: opts.lineLabel || 'Margen Op.',
data: lineData,
borderColor: COLORS.amber,
backgroundColor: 'transparent',
pointBackgroundColor: COLORS.amber,
pointRadius: 3,
pointHoverRadius: 5,
tension: 0.35,
yAxisID: 'y1'
}
]
},
options: {
responsive: true,
maintainAspectRatio: false,
interaction: { mode: 'index', intersect: false },
plugins: {
tooltip: {
callbacks: {
label: function(ctx) {
var v = ctx.parsed.y;
if (ctx.datasetIndex === 0) return ' ' + (opts.barLabel||'Ventas') + ': ' + NLaceData.formatCLP(v);
return ' ' + (opts.lineLabel||'Margen') + ': ' + v.toFixed(1) + '%';
}
}
}
},
scales: {
x: { grid: { color: COLORS.grid, drawBorder: false }, ticks: { color: COLORS.text }, border: { display: false } },
y: { grid: { color: COLORS.grid, drawBorder: false }, ticks: { color: COLORS.text, callback: function(v){ return NLaceData.formatCLP(v,true); } }, border: { display: false } },
y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: COLORS.amber, callback: function(v){ return v.toFixed(0)+'%'; } }, border: { display: false } }
}
}
});
}

function renderBar(canvasId, labels, data, opts) {
opts = opts || {};
destroyChart(canvasId);
var ctx = document.getElementById(canvasId);
if (!ctx) return;
var color = opts.color || COLORS.green;
return new Chart(ctx, {
type: 'bar',
data: {
labels: labels,
datasets: [{
label: opts.label || 'Monto',
data: data,
backgroundColor: hexToRgba(color, 0.7),
borderColor: color,
borderWidth: 1,
borderRadius: 4,
borderSkipped: false
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
interaction: { mode: 'index', intersect: false },
plugins: {
tooltip: {
callbacks: {
label: function(ctx) { return ' ' + (opts.label||'Monto') + ': ' + NLaceData.formatCLP(ctx.parsed.y); }
}
}
},
scales: makeScales(opts.scaleOpts || {})
}
});
}

function renderStackedBar(canvasId, labels, datasets, opts) {
opts = opts || {};
destroyChart(canvasId);
var ctx = document.getElementById(canvasId);
if (!ctx) return;
return new Chart(ctx, {
type: 'bar',
data: {
labels: labels,
datasets: datasets.map(function(ds, i) {
return {
label: ds.label,
data: ds.data,
backgroundColor: hexToRgba(ds.color || PALETTE[i], 0.75),
borderColor: ds.color || PALETTE[i],
borderWidth: 1,
borderRadius: 0,
borderSkipped: false,
stack: 'stack0'
};
})
},
options: {
responsive: true,
maintainAspectRatio: false,
interaction: { mode: 'index', intersect: false },
plugins: {
legend: {
display: true,
position: 'top',
labels: { color: COLORS.text, font: { family: “'DM Mono', monospace”, size: 10 }, boxWidth: 10, boxHeight: 10 }
},
tooltip: {
callbacks: {
label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + NLaceData.formatCLP(ctx.parsed.y); }
}
}
},
scales: makeScales({ stacked: true })
}
});
}

function renderDonut(canvasId, labels, data, opts) {
opts = opts || {};
destroyChart(canvasId);
var ctx = document.getElementById(canvasId);
if (!ctx) return;
var colors = labels.map(function(_, i) { return PALETTE[i % PALETTE.length]; });
return new Chart(ctx, {
type: 'doughnut',
data: {
labels: labels,
datasets: [{
data: data,
backgroundColor: colors.map(function(c) { return hexToRgba(c, 0.8); }),
borderColor: colors,
borderWidth: 1,
hoverOffset: 6
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
cutout: opts.cutout || '68%',
plugins: {
legend: {
display: true,
position: 'right',
labels: { color: COLORS.text, font: { family: “'DM Mono', monospace”, size: 10 }, boxWidth: 8, padding: 10 }
},
tooltip: {
callbacks: {
label: function(ctx) {
var total = ctx.dataset.data.reduce(function(a,b){ return a+b; }, 0);
var pct = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : 0;
return ' ' + ctx.label + ': ' + NLaceData.formatCLP(ctx.parsed, true) + ' (' + pct + '%)';
}
}
}
}
}
});
}

function renderLine(canvasId, labels, datasets, opts) {
opts = opts || {};
destroyChart(canvasId);
var ctx = document.getElementById(canvasId);
if (!ctx) return;
return new Chart(ctx, {
type: 'line',
data: {
labels: labels,
datasets: datasets.map(function(ds, i) {
return {
label: ds.label,
data: ds.data,
borderColor: ds.color || PALETTE[i],
backgroundColor: hexToRgba(ds.color || PALETTE[i], 0.08),
fill: ds.fill !== undefined ? ds.fill : true,
pointBackgroundColor: ds.color || PALETTE[i],
pointRadius: 3,
pointHoverRadius: 5,
tension: 0.35
};
})
},
options: {
responsive: true,
maintainAspectRatio: false,
interaction: { mode: 'index', intersect: false },
plugins: {
legend: { display: datasets.length > 1 },
tooltip: {
callbacks: {
label: function(ctx) {
var v = ctx.parsed.y;
if (opts.isPct) return ' ' + ctx.dataset.label + ': ' + v.toFixed(1) + '%';
return ' ' + ctx.dataset.label + ': ' + NLaceData.formatCLP(v);
}
}
}
},
scales: {
x: { grid: { color: COLORS.grid, drawBorder: false }, ticks: { color: COLORS.text }, border: { display: false } },
y: {
grid: { color: COLORS.grid, drawBorder: false },
ticks: { color: COLORS.text, callback: opts.isPct ? function(v){ return v+'d'; } : function(v){ return NLaceData.formatCLP(v,true); } },
border: { display: false }
}
}
}
});
}

function renderHBar(canvasId, labels, data, opts) {
opts = opts || {};
destroyChart(canvasId);
var ctx = document.getElementById(canvasId);
if (!ctx) return;
return new Chart(ctx, {
type: 'bar',
data: {
labels: labels,
datasets: [{
label: opts.label || 'Total',
data: data,
backgroundColor: labels.map(function(*, i) { return hexToRgba(PALETTE[i % PALETTE.length], 0.7); }),
borderColor: labels.map(function(*, i) { return PALETTE[i % PALETTE.length]; }),
borderWidth: 1,
borderRadius: 3,
borderSkipped: false
}]
},
options: {
indexAxis: 'y',
responsive: true,
maintainAspectRatio: false,
plugins: {
tooltip: {
callbacks: {
label: function(ctx) { return ' ' + (opts.label||'Total') + ': ' + NLaceData.formatCLP(ctx.parsed.x); }
}
}
},
scales: {
x: { grid: { color: COLORS.grid, drawBorder: false }, ticks: { color: COLORS.text, callback: function(v){ return NLaceData.formatCLP(v,true); } }, border: { display: false } },
y: { grid: { display: false }, ticks: { color: COLORS.text }, border: { display: false } }
}
}
});
}

global.NLaceCharts = {
applyGlobalDefaults: applyGlobalDefaults,
COLORS: COLORS,
PALETTE: PALETTE,
hexToRgba: hexToRgba,
destroyChart: destroyChart,
renderBarLine: renderBarLine,
renderBar: renderBar,
renderStackedBar: renderStackedBar,
renderDonut: renderDonut,
renderLine: renderLine,
renderHBar: renderHBar
};

})(window);
