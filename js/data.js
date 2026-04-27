/**

- NLACE Financial Dashboard — Data Layer
- Módulo central: carga, parseo, limpieza y acceso a datos de Data_Comb.
- Todas las páginas importan desde aquí. No duplicar lógica.
  */

(function (global) {
‘use strict’;

// ── Config ──────────────────────────────────────────────────────────────
const CSV_URL =
‘https://docs.google.com/spreadsheets/d/1bkKIE2dD_HCBevKrunZa–mQH9rfUCZV26OKug7QJPM/export?format=csv&gid=1320604970’;

// Cache buster: refresca cada 15 minutos
function buildUrl() {
const ts = Math.floor(Date.now() / (15 * 60 * 1000));
return `${CSV_URL}&_cb=${ts}`;
}

// ── Estado global ────────────────────────────────────────────────────────
const state = {
rows:       [],
years:      [],
loaded:     false,
error:      null,
loadedAt:   null,
};

// ── Accessors tipados ────────────────────────────────────────────────────
function getTipo(row)    { return (row[‘Tipo’] || ‘’).trim(); }
function getCuenta(row)  { return (row[‘Cuenta_Cble’] || ‘’).trim(); }
function getDesc(row)    { return (row[‘Descripcion Cta.’] || row[‘Descripcion Cta’] || ‘’).trim(); }
function getClasGasto(row) { return (row[‘Clasificacion_Gasto’] || ‘’).trim(); }
function getClasifCto(row) { return (row[‘Clasificacion_Cto’] || ‘’).trim(); }
function getTipoCuenta(row){ return (row[‘Tipo_Cuenta’] || ‘’).trim(); }
function getEstado(row)  { return (row[‘Estado’] || ‘’).trim(); }

function getMonto(row) {
const raw = row[‘monto_bruto’] || ‘0’;
// Limpiar separadores de miles: puede venir como “1.234.567” o “1,234,567”
const cleaned = String(raw)
.replace(/./g, ‘’)    // quitar puntos (miles estilo ES)
.replace(/,/g, ‘.’)    // coma decimal → punto
.replace(/[^0-9.-]/g, ‘’);
const n = parseFloat(cleaned);
return isNaN(n) ? 0 : n;
}

function getMesEco(row)  { return (row[‘Mes_economico’] || ‘’).trim(); } // YYYY-MM
function getAnoEco(row)  { return (row[‘Ano_eco’] || ‘’).trim(); }

function getYear(row) {
const ano = getAnoEco(row);
if (ano && /^\d{4}$/.test(ano)) return ano;
const mes = getMesEco(row);
if (mes && mes.length >= 4) return mes.substring(0, 4);
return null;
}

function getMonth(row) {
const mes = getMesEco(row);
if (!mes) return null;
// YYYY-MM → ‘YYYY-MM’
return mes.length >= 7 ? mes.substring(0, 7) : null;
}

function getFechaEmision(row) { return (row[‘Fecha_emision’] || ‘’).trim(); }
function getFechaPago(row)    { return (row[‘Fecha_Pago’] || ‘’).trim(); }

// ── Reglas de negocio ────────────────────────────────────────────────────
function isVenta(row) {
return getTipo(row) === ‘Ingreso’ && getCuenta(row) === ‘5101-01’;
}

function isOtroIngreso(row) {
return getTipo(row) === ‘Ingreso’ && getCuenta(row) !== ‘5101-01’;
}

function isCosto(row) {
return getTipo(row) === ‘Costo’;
}

function isRetiroDirectores(row) {
const desc  = getDesc(row).toLowerCase();
const clas  = getClasGasto(row).toLowerCase();
const cuenta = getCuenta(row).toLowerCase();
return (
desc.includes(‘retiro director’) ||
clas.includes(‘retiro director’) ||
cuenta.includes(‘retiro director’)
);
}

function isGasto(row) {
return getTipo(row) === ‘Gasto’ && !isRetiroDirectores(row);
}

// ── Filtros de año ───────────────────────────────────────────────────────
function filterByYear(rows, year) {
if (!year || year === ‘all’) return rows;
return rows.filter(r => getYear(r) === String(year));
}

function filterByMonth(rows, month) {
// month: ‘YYYY-MM’
return rows.filter(r => getMonth(r) === month);
}

// ── Agregaciones ─────────────────────────────────────────────────────────
function sumMonto(rows) {
return rows.reduce((acc, r) => acc + getMonto(r), 0);
}

function groupByMonth(rows, filterFn) {
const map = {};
rows.filter(filterFn).forEach(r => {
const m = getMonth(r);
if (!m) return;
map[m] = (map[m] || 0) + getMonto(r);
});
return map; // { ‘YYYY-MM’: total }
}

// Devuelve array de meses únicos ordenados dentro del año dado
function getMonthsForYear(rows, year) {
const yr = String(year);
const set = new Set();
rows.forEach(r => {
if (getYear(r) === yr) {
const m = getMonth(r);
if (m) set.add(m);
}
});
return Array.from(set).sort();
}

// Etiqueta corta de mes para gráficos: ‘YYYY-MM’ → ‘Ene’, ‘Feb’, …
const MONTH_LABELS = [‘Ene’,‘Feb’,‘Mar’,‘Abr’,‘May’,‘Jun’,‘Jul’,‘Ago’,‘Sep’,‘Oct’,‘Nov’,‘Dic’];
function monthLabel(yyyyMM) {
const parts = yyyyMM.split(’-’);
if (parts.length < 2) return yyyyMM;
const idx = parseInt(parts[1], 10) - 1;
return MONTH_LABELS[idx] || yyyyMM;
}

// ── Formateo ─────────────────────────────────────────────────────────────
function formatCLP(n, compact) {
const abs = Math.abs(n);
if (compact) {
if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
if (abs >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
if (abs >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
}
return ‘$’ + Math.round(n).toLocaleString(‘es-CL’);
}

function formatPct(n) {
return (n * 100).toFixed(1) + ‘%’;
}

function formatDays(n) {
return Math.round(n) + ’ días’;
}

// ── Carga de datos ───────────────────────────────────────────────────────
function loadData(onSuccess, onError) {
if (state.loaded) {
onSuccess(state.rows, state.years);
return;
}

```
Papa.parse(buildUrl(), {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function (result) {
    if (result.errors && result.errors.length > 0) {
      console.warn('[NLACE Data] Parse warnings:', result.errors.slice(0, 3));
    }

    state.rows = result.data.filter(r => {
      // Filtrar filas completamente vacías
      const tipo = getTipo(r);
      return tipo === 'Ingreso' || tipo === 'Costo' || tipo === 'Gasto';
    });

    // Extraer años disponibles
    const yearSet = new Set();
    state.rows.forEach(r => {
      const y = getYear(r);
      if (y) yearSet.add(y);
    });
    state.years = Array.from(yearSet).sort().reverse();
    state.loaded = true;
    state.loadedAt = new Date();

    console.log(`[NLACE Data] Loaded ${state.rows.length} rows. Years: ${state.years.join(', ')}`);
    onSuccess(state.rows, state.years);
  },
  error: function (err) {
    state.error = err;
    console.error('[NLACE Data] Load error:', err);
    onError(err);
  }
});
```

}

// Invalidar caché manualmente
function invalidateCache() {
state.rows = [];
state.years = [];
state.loaded = false;
state.error = null;
}

// ── Cálculos financieros ─────────────────────────────────────────────────
function calcKPIs(rows) {
const ventas       = sumMonto(rows.filter(isVenta));
const otrosIngresos= sumMonto(rows.filter(isOtroIngreso));
const costos       = sumMonto(rows.filter(isCosto));
const gastos       = sumMonto(rows.filter(isGasto));
const utilBruta    = ventas - costos;
const utilOp       = utilBruta - gastos;
const margenOp     = ventas > 0 ? utilOp / ventas : 0;
const margenBruto  = ventas > 0 ? utilBruta / ventas : 0;

```
return { ventas, otrosIngresos, costos, gastos, utilBruta, utilOp, margenOp, margenBruto };
```

}

// DSO: Días promedio de cobro — solo ventas (ingresos con Fecha_emision y Fecha_Pago)
function calcDSO(rows) {
const ventasConFecha = rows.filter(r => {
if (!isVenta(r)) return false;
return getFechaEmision(r) && getFechaPago(r);
});

```
if (ventasConFecha.length === 0) return null;

let totalDays = 0;
let count = 0;

ventasConFecha.forEach(r => {
  const emi = parseDateCL(getFechaEmision(r));
  const pago = parseDateCL(getFechaPago(r));
  if (emi && pago && pago >= emi) {
    const diff = (pago - emi) / (1000 * 60 * 60 * 24);
    totalDays += diff;
    count++;
  }
});

return count > 0 ? totalDays / count : null;
```

}

// DSO por cliente (Descripcion Cta.) — ranking
function calcDSOByCliente(rows) {
const map = {};
rows.filter(r => {
if (!isVenta(r)) return false;
return getFechaEmision(r) && getFechaPago(r);
}).forEach(r => {
const cliente = getDesc(r) || getCuenta(r);
const emi  = parseDateCL(getFechaEmision(r));
const pago = parseDateCL(getFechaPago(r));
if (!emi || !pago || pago < emi) return;
const diff = (pago - emi) / (1000 * 60 * 60 * 24);
if (!map[cliente]) map[cliente] = { dias: 0, count: 0, monto: 0 };
map[cliente].dias  += diff;
map[cliente].count += 1;
map[cliente].monto += getMonto(r);
});

```
return Object.entries(map)
  .map(([cliente, d]) => ({
    cliente,
    dsoDias: d.count > 0 ? d.dias / d.count : 0,
    transacciones: d.count,
    monto: d.monto
  }))
  .sort((a, b) => b.dsoDias - a.dsoDias);
```

}

// Parsear fechas en formato DD-MM-YYYY o YYYY-MM-DD
function parseDateCL(str) {
if (!str) return null;
const s = str.trim();
// DD-MM-YYYY
if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
const [d, m, y] = s.split(’-’);
return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}
// YYYY-MM-DD
if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
return new Date(s.substring(0, 10));
}
// DD/MM/YYYY
if (/^\d{2}/\d{2}/\d{4}$/.test(s)) {
const [d, m, y] = s.split(’/’);
return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}
// Intentar nativo como fallback
const dt = new Date(s);
return isNaN(dt.getTime()) ? null : dt;
}

// ── Clasificación de costos ──────────────────────────────────────────────
function groupCostosByClasif(rows) {
const map = {};
rows.filter(isCosto).forEach(r => {
const clas = getClasifCto(r) || getClasGasto(r) || ‘Sin clasificar’;
map[clas] = (map[clas] || 0) + getMonto(r);
});
return map;
}

function groupGastosByClasif(rows) {
const map = {};
rows.filter(isGasto).forEach(r => {
const clas = getClasGasto(r) || getClasifCto(r) || ‘Sin clasificar’;
map[clas] = (map[clas] || 0) + getMonto(r);
});
return map;
}

// ── Exportar API pública ─────────────────────────────────────────────────
global.NLaceData = {
// Carga
loadData,
invalidateCache,
getState: () => ({ …state }),

```
// Accessors de campo
getTipo, getCuenta, getDesc, getClasGasto, getClasifCto,
getTipoCuenta, getEstado, getMonto, getMesEco, getAnoEco,
getYear, getMonth, getFechaEmision, getFechaPago,

// Filtros de tipo
isVenta, isOtroIngreso, isCosto, isGasto, isRetiroDirectores,

// Filtros de periodo
filterByYear, filterByMonth,

// Agregaciones
sumMonto, groupByMonth, getMonthsForYear, monthLabel,

// Formateo
formatCLP, formatPct, formatDays,

// KPIs y cálculos
calcKPIs, calcDSO, calcDSOByCliente,
groupCostosByClasif, groupGastosByClasif,

// Helpers de fecha
parseDateCL,

MONTH_LABELS
```

};

})(window);
