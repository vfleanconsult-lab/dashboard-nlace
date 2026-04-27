/**

- NLACE Financial Dashboard — Charts Layer
- Wrappers reutilizables sobre Chart.js con el sistema de diseño NLACE.
- Todas las páginas importan desde aquí.
  */

(function (global) {
‘use strict’;

// ── Paleta de colores (sincronizada con CSS) ─────────────────────────────
const COLORS = {
green:     ‘#00e5a0’,
blue:      ‘#3b82f6’,
amber:     ‘#f59e0b’,
red:       ‘#ef4444’,
purple:    ‘#a78bfa’,
cyan:      ‘#22d3ee’,
pink:      ‘#f472b6’,
orange:    ‘#fb923c’,

```
greenDim:  'rgba(0, 229, 160, 0.15)',
blueDim:   'rgba(59, 130, 246, 0.15)',
amberDim:  'rgba(245, 158, 11, 0.15)',
redDim:    'rgba(239, 68, 68, 0.15)',

grid:      'rgba(255, 255, 255, 0.05)',
text:      '#8a9bb0',
textDim:   '#4a5568',
```

};

// Paleta multi-serie para donut/pie
const PALETTE = [
COLORS.green, COLORS.blue, COLORS.amber,
COLORS.purple, COLORS.cyan, COLORS.pink,
COLORS.orange, COLORS.red
];

// ── Defaults globales de Chart.js ────────────────────────────────────────
function applyGlobalDefaults() {
Chart.defaults.color = COLORS.text;
Chart.defaults.font.family = “‘DM Mono’, monospace”;
Chart.defaults.font.size = 10;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = ‘#1c2028’;
Chart.defaults.plugins.tooltip.borderColor = ‘rgba(255,255,255,0.1)’;
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = ‘#f0f2f5’;
Chart.defaults.plugins.tooltip.bodyColor = ‘#8a9bb0’;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.titleFont = { family: “‘Syne’, sans-serif”, weight: ‘700’, size: 12 };
Chart.defaults.plugins.tooltip.bodyFont = { family: “‘DM Mono’, monospace”, size: 11 };
}

// ── Helpers de eje ───────────────────────────────────────────────────────
function makeScales(opts = {}) {
const base = {
x: {
grid: { color: COLORS.grid, drawBorder: false },
ticks: { color: COLORS.text },
border: { display: false }
},
y: {
grid: { color: COLORS.grid, drawBorder: false },
ticks: {
color: COLORS.text,
callback: opts.ytick || (v => NLaceData.formatCLP(v, true))
},
border: { display: false }
}
};

```
if (opts.stacked) {
  base.x.stacked = true;
  base.y.stacked = true;
}

if (opts.yRight) {
  base.y1 = {
    type: 'linear',
    position: 'right',
    grid: { drawOnChartArea: false },
    ticks: {
      color: opts.yRight.color || COLORS.green,
      callback: opts.yRight.tick || (v => v.toFixed(1) + '%')
    },
    border: { display: false }
  };
}

return base;
```

}

// ── Gradiente de fondo ───────────────────────────────────────────────────
function makeGradient(ctx, color, alpha1 = 0.3, alpha2 = 0) {
const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
gradient.addColorStop(0, color.replace(’)’, `, ${alpha1})`).replace(‘rgb’, ‘rgba’));
gradient.addColorStop(1, color.replace(’)’, `, ${alpha2})`).replace(‘rgb’, ‘rgba’));
return gradient;
}

// Para colores hex → rgba
function hexToRgba(hex, alpha) {
const r = parseInt(hex.slice(1, 3), 16);
const g = parseInt(hex.slice(3, 5), 16);
const b = parseInt(hex.slice(5, 7), 16);
return `rgba(${r},${g},${b},${alpha})`;
}

// ── Destruir chart existente en canvas ───────────────────────────────────
function destroyChart(canvasId) {
const existing = Chart.getChart(canvasId);
if (existing) existing.destroy();
}

// ── CHART: Barras + Línea dual-axis (Resumen ejecutivo) ─────────────────
function renderBarLine(canvasId, labels, barData, lineData, opts = {}) {
destroyChart(canvasId);
const ctx = document.getElementById(canvasId);
if (!ctx) return;

```
return new Chart(ctx, {
  type: 'bar',
  data: {
    labels,
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
        yAxisID: 'y',
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
        yAxisID: 'y1',
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
          label: ctx => {
            const v = ctx.parsed.y;
            if (ctx.datasetIndex === 0) return ` ${opts.barLabel || 'Ventas'}: ${NLaceData.formatCLP(v)}`;
            return ` ${opts.lineLabel || 'Margen'}: ${v.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      ...makeScales(),
      y1: {
        type: 'linear',
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { color: COLORS.amber, callback: v => v.toFixed(0) + '%' },
        border: { display: false }
      }
    }
  }
});
```

}

// ── CHART: Barras simples ────────────────────────────────────────────────
function renderBar(canvasId, labels, data, opts = {}) {
destroyChart(canvasId);
const ctx = document.getElementById(canvasId);
if (!ctx) return;

```
const color = opts.color || COLORS.green;

return new Chart(ctx, {
  type: 'bar',
  data: {
    labels,
    datasets: [{
      label: opts.label || 'Monto',
      data,
      backgroundColor: hexToRgba(color, 0.7),
      borderColor: color,
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      tooltip: {
        callbacks: {
          label: ctx => ` ${opts.label || 'Monto'}: ${NLaceData.formatCLP(ctx.parsed.y)}`
        }
      }
    },
    scales: makeScales(opts.scaleOpts || {})
  }
});
```

}

// ── CHART: Barras apiladas ───────────────────────────────────────────────
function renderStackedBar(canvasId, labels, datasets, opts = {}) {
// datasets: [{label, data, color}]
destroyChart(canvasId);
const ctx = document.getElementById(canvasId);
if (!ctx) return;

```
return new Chart(ctx, {
  type: 'bar',
  data: {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: hexToRgba(ds.color || PALETTE[i], 0.75),
      borderColor: ds.color || PALETTE[i],
      borderWidth: 1,
      borderRadius: i === datasets.length - 1 ? { topLeft: 4, topRight: 4 } : 0,
      borderSkipped: false,
      stack: 'stack0'
    }))
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: COLORS.text,
          font: { family: "'DM Mono', monospace", size: 10 },
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: 'rectRounded'
        }
      },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${NLaceData.formatCLP(ctx.parsed.y)}`
        }
      }
    },
    scales: makeScales({ stacked: true })
  }
});
```

}

// ── CHART: Donut ─────────────────────────────────────────────────────────
function renderDonut(canvasId, labels, data, opts = {}) {
destroyChart(canvasId);
const ctx = document.getElementById(canvasId);
if (!ctx) return;

```
const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

return new Chart(ctx, {
  type: 'doughnut',
  data: {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.map(c => hexToRgba(c, 0.8)),
      borderColor: colors,
      borderWidth: 1,
      hoverOffset: 6,
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
        labels: {
          color: COLORS.text,
          font: { family: "'DM Mono', monospace", size: 10 },
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 10
        }
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${NLaceData.formatCLP(ctx.parsed, true)} (${pct}%)`;
          }
        }
      }
    }
  }
});
```

}

// ── CHART: Línea ─────────────────────────────────────────────────────────
function renderLine(canvasId, labels, datasets, opts = {}) {
destroyChart(canvasId);
const ctx = document.getElementById(canvasId);
if (!ctx) return;

```
return new Chart(ctx, {
  type: 'line',
  data: {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color || PALETTE[i],
      backgroundColor: hexToRgba(ds.color || PALETTE[i], 0.08),
      fill: ds.fill !== undefined ? ds.fill : true,
      pointBackgroundColor: ds.color || PALETTE[i],
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.35,
    }))
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: datasets.length > 1,
        position: 'top',
        labels: {
          color: COLORS.text,
          font: { family: "'DM Mono', monospace", size: 10 },
          boxWidth: 10, usePointStyle: true, pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y;
            if (opts.isPct) return ` ${ctx.dataset.label}: ${v.toFixed(1)}%`;
            return ` ${ctx.dataset.label}: ${NLaceData.formatCLP(v)}`;
          }
        }
      }
    },
    scales: makeScales(opts.scaleOpts || {})
  }
});
```

}

// ── CHART: Horizontal Bar (ranking) ─────────────────────────────────────
function renderHBar(canvasId, labels, data, opts = {}) {
destroyChart(canvasId);
const ctx = document.getElementById(canvasId);
if (!ctx) return;

```
return new Chart(ctx, {
  type: 'bar',
  data: {
    labels,
    datasets: [{
      label: opts.label || 'Total',
      data,
      backgroundColor: labels.map((_, i) => hexToRgba(PALETTE[i % PALETTE.length], 0.7)),
      borderColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
      borderWidth: 1,
      borderRadius: 3,
      borderSkipped: false,
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: ctx => ` ${opts.label || 'Total'}: ${NLaceData.formatCLP(ctx.parsed.x)}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: COLORS.grid, drawBorder: false },
        ticks: { color: COLORS.text, callback: v => NLaceData.formatCLP(v, true) },
        border: { display: false }
      },
      y: {
        grid: { display: false },
        ticks: { color: COLORS.text },
        border: { display: false }
      }
    }
  }
});
```

}

// ── Exportar ─────────────────────────────────────────────────────────────
global.NLaceCharts = {
applyGlobalDefaults,
COLORS,
PALETTE,
destroyChart,
hexToRgba,
renderBarLine,
renderBar,
renderStackedBar,
renderDonut,
renderLine,
renderHBar,
};

})(window);
