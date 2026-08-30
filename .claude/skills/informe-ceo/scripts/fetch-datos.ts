/**
 * Extrae y agrega los datos financieros de un mes (N) y el mes anterior (N-1)
 * desde Supabase, reutilizando toda la lógica de src/lib/data.ts.
 *
 * Uso:
 *   npx tsx .claude/skills/informe-ceo/scripts/fetch-datos.ts [--mes YYYY-MM] --out output/datos-YYYY-MM.json
 *
 * Si no se pasa --mes, se elige el último mes con datos de ventas Y gastos.
 * Si ese mes resulta ser el mes calendario en curso, se retrocede uno (datos
 * probablemente incompletos).
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import * as D from '../../../../src/lib/data'

// ---------- CLI args ----------
function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

const mesArg = getArg('mes')
const outArg = getArg('out')

// ---------- helpers ----------
function shiftMonth(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Replica exacta de calcValues() en src/pages/EstadoResultado.tsx:45-67 —
// fuente de verdad del P&L del dashboard.
interface EstadoResultado {
  ingresos: number
  costoVenta: number
  otrosCostos: number
  costos: number
  margenBruto: number
  gastos: number
  resultadoOp: number
  remDirectores: number
  ebitda: number
}

function calcEstadoResultado(rows: D.Row[]): EstadoResultado {
  const ingresos = D.sumMonto(rows.filter(r => D.getCuenta(r) === '5101-01' && D.isPagado(r)))
  const costoVenta = D.sumMonto(rows.filter(r => D.getCuenta(r) === '4101-01'))
  const otrosCostos = D.sumMonto(rows.filter(r => D.getCuenta(r) === '4101-09'))
  const costos = costoVenta + otrosCostos
  const margenBruto = ingresos - costos
  const gastos = D.sumMonto(rows.filter(D.isGasto))
  const resultadoOp = margenBruto - gastos
  const remDirectores = D.sumMonto(rows.filter(D.isRemDirectores))
  const ebitda = resultadoOp - remDirectores
  return { ingresos, costoVenta, otrosCostos, costos, margenBruto, gastos, resultadoOp, remDirectores, ebitda }
}

function variacion(actual: number, anterior: number) {
  const abs = actual - anterior
  const pct = anterior !== 0 ? abs / Math.abs(anterior) : null
  return { abs, pct }
}

type Semaforo = 'verde' | 'amarillo' | 'rojo'

function calcIndicadores(er: EstadoResultado) {
  const margenOpPct = er.ingresos > 0 ? (er.ingresos - er.costos) / er.ingresos : 0
  const resultadoOpPct = er.ingresos > 0 ? (er.margenBruto - er.gastos) / er.ingresos : 0
  const margenEbitdaPct = er.ingresos > 0 ? er.ebitda / er.ingresos : 0
  let semaforo: Semaforo = 'rojo'
  if (margenEbitdaPct >= 0.05) semaforo = 'verde'
  else if (margenEbitdaPct >= 0) semaforo = 'amarillo'
  return { margenOpPct, resultadoOpPct, margenEbitdaPct, semaforo }
}

function buildClasifMap(rows: D.Row[]): Record<string, number> {
  return D.groupGastosByClasif(rows)
}

async function main() {
  process.stderr.write('Conectando a Supabase y descargando registros...\n')
  const rows: D.Row[] = await new Promise((resolve, reject) => {
    D.loadData((r) => resolve(r), (err) => reject(err))
  })
  process.stderr.write(`Descargados ${rows.length} registros.\n`)

  // Meses con datos de ventas y gastos (ambos, para asegurar un mes "completo")
  const ventasByMonth = D.groupByMonth(rows, D.isVenta)
  const gastosByMonth = D.groupByMonth(rows, D.isGasto)
  const mesesConVentas = new Set(Object.keys(ventasByMonth))
  const mesesConGastos = new Set(Object.keys(gastosByMonth))
  const mesesCompletos = [...mesesConVentas].filter(m => mesesConGastos.has(m)).sort()

  process.stderr.write(`Meses con datos de ventas y gastos: ${mesesCompletos.join(', ') || '(ninguno)'}\n`)

  let mes: string
  if (mesArg) {
    mes = mesArg
    if (!mesesCompletos.includes(mes)) {
      process.stderr.write(`Aviso: el mes ${mes} no tiene datos de ventas y gastos simultáneos. Se generará igual con lo disponible.\n`)
    }
  } else {
    if (mesesCompletos.length === 0) {
      process.stderr.write('Error: no hay ningún mes con datos de ventas y gastos.\n')
      process.exitCode = 1
      return
    }
    let ultimo = mesesCompletos[mesesCompletos.length - 1]
    if (ultimo === currentMonth() && mesesCompletos.length > 1) {
      process.stderr.write(`El último mes con datos (${ultimo}) es el mes en curso — probablemente incompleto. Se usa el mes anterior.\n`)
      ultimo = mesesCompletos[mesesCompletos.length - 2]
    }
    mes = ultimo
  }

  const mesAnterior = shiftMonth(mes, -1)
  process.stderr.write(`Mes del informe: ${mes} · Mes de comparación: ${mesAnterior}\n`)

  const rowsN = D.filterByMonth(rows, mes)
  const rowsN1 = D.filterByMonth(rows, mesAnterior)
  process.stderr.write(`Filas en ${mes}: ${rowsN.length} · Filas en ${mesAnterior}: ${rowsN1.length}\n`)

  const erN = calcEstadoResultado(rowsN)
  const erN1 = calcEstadoResultado(rowsN1)
  const indN = calcIndicadores(erN)
  const indN1 = calcIndicadores(erN1)

  const mapN = buildClasifMap(rowsN)
  const mapN1 = buildClasifMap(rowsN1)
  const clasifs = [...new Set([...Object.keys(mapN), ...Object.keys(mapN1)])]
  const gastosPorClasif = clasifs
    .map(c => {
      const actual = mapN[c] ?? 0
      const anterior = mapN1[c] ?? 0
      const variacionPct = anterior > 0 ? (actual - anterior) / anterior : null
      return { clasificacion: c, actual, anterior, variacionPct }
    })
    .sort((a, b) => b.actual - a.actual)

  // Cobranza: sobre TODAS las filas, como Cobranzas.tsx
  const dso = D.calcDSO(rows)
  const facturasImpagas = D.calcFacturasImpagas(rows)
  const montoPendiente = facturasImpagas.reduce((a, f) => a + f.monto, 0)
  const ventasTotal = D.sumMonto(rows.filter(D.isVenta))
  const tasaPagoPct = ventasTotal > 0 ? (ventasTotal - montoPendiente) / ventasTotal : null
  const totalVencido = facturasImpagas.filter(f => f.diasVencida < 0).reduce((a, f) => a + f.monto, 0)
  const topVencidas = facturasImpagas
    .filter(f => f.diasVencida < 0)
    .slice(0, 10)
    .map(f => ({
      cliente: f.cliente,
      fechaVencimiento: f.fechaVencimiento,
      diasVencidos: Math.abs(f.diasVencida),
      monto: f.monto,
    }))

  // YTD del año de `mes`, hasta `mes` inclusive
  const anio = mes.substring(0, 4)
  const rowsYTD = rows.filter(r => D.getYear(r) === anio && (D.getMonth(r) ?? '') <= mes)
  const erYTD = calcEstadoResultado(rowsYTD)
  const mesesDelAnioHastaN = D.getMonthsForYear(rows, anio).filter(m => m <= mes)
  const ingresosByMonth = D.groupByMonth(rows, r => D.getCuenta(r) === '5101-01' && D.isPagado(r))
  const ingresosMensuales = mesesDelAnioHastaN.map(m => ({
    mes: m,
    label: D.monthLabel(m),
    monto: ingresosByMonth[m] ?? 0,
  }))

  const out = {
    empresa: 'NLACE',
    rut: '77743235-4',
    generadoEl: new Date().toISOString(),
    mes,
    mesLabel: `${D.monthLabel(mes)} ${anio}`,
    mesAnterior,
    mesAnteriorLabel: `${D.monthLabel(mesAnterior)} ${mesAnterior.substring(0, 4)}`,
    estadoResultado: {
      actual: erN,
      anterior: erN1,
      variacion: {
        ingresos: variacion(erN.ingresos, erN1.ingresos),
        margenBruto: variacion(erN.margenBruto, erN1.margenBruto),
        gastos: variacion(erN.gastos, erN1.gastos),
        ebitda: variacion(erN.ebitda, erN1.ebitda),
      },
    },
    indicadores: { actual: indN, anterior: indN1 },
    gastosPorClasif,
    cobranza: { montoPendiente, dso, tasaPagoPct, totalVencido, topVencidas },
    ytd: {
      ingresos: erYTD.ingresos,
      gastos: erYTD.gastos,
      ebitda: erYTD.ebitda,
      ingresosMensuales,
    },
  }

  const outPath = outArg || `output/datos-${mes}.json`
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8')
  process.stderr.write(`Escrito: ${outPath}\n`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exitCode = 1
})
