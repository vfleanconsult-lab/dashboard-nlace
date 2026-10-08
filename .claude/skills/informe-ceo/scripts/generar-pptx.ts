/**
 * Genera el .pptx de 6 slides con identidad NLACE a partir de los JSON de
 * datos (fetch-datos.ts) y narrativa (escrita por el agente).
 *
 * Uso:
 *   npx tsx .claude/skills/informe-ceo/scripts/generar-pptx.ts \
 *     --datos output/datos-YYYY-MM.json \
 *     --narrativa output/narrativa-YYYY-MM.json \
 *     --out "output/Informe-CEO-NLACE-YYYY-MM.pptx"
 */
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
// pptxgenjs no publica tipos ESM limpios bajo NodeNext; el default export
// funciona en runtime con tsx (CJS interop).
// eslint-disable-next-line @typescript-eslint/no-var-requires
import pptxgen from 'pptxgenjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------- CLI args ----------
function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

const datosPath = getArg('datos')
const narrativaPath = getArg('narrativa')
const outPath = getArg('out')

if (!datosPath || !narrativaPath || !outPath) {
  console.error('Uso: generar-pptx.ts --datos <json> --narrativa <json> --out <pptx>')
  process.exit(1)
}

// ---------- marca NLACE ----------
const BRAND = {
  bg: 'EFEFEF',
  text: '0F1011',
  azul: '5869F7',
  acento: 'FC624B',
  verde: '2EA862',
  amarillo: 'E8A13C',
  rojo: 'D64545',
  blanco: 'FFFFFF',
  grisClaro: 'D8D8D8',
}
const FONT_HEAD = 'Space Grotesk'
const FONT_BODY = 'Inter'
const SEMAFORO_LABEL: Record<string, string> = {
  verde: 'Saludable (margen EBITDA ≥ 5%)',
  amarillo: 'Ajustado (margen EBITDA entre 0% y 5%)',
  rojo: 'En rojo (EBITDA negativo)',
}

function fmtCLP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—'
  return (n * 100).toFixed(digits) + '%'
}

function signed(s: string, n: number): string {
  return (n >= 0 ? '+' : '') + s
}

// ---------- validación de entrada ----------
function readJSON<T>(path: string, label: string): T {
  if (!existsSync(path)) {
    console.error(`Error: no se encontró el archivo de ${label}: ${path}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

interface Datos {
  empresa: string
  mesLabel: string
  mesAnteriorLabel: string
  generadoEl: string
  estadoResultado: {
    actual: { ingresos: number; costos: number; margenBruto: number; gastos: number; resultadoOp: number; remDirectores: number; ebitda: number }
    anterior: { ingresos: number; costos: number; margenBruto: number; gastos: number; resultadoOp: number; remDirectores: number; ebitda: number }
    variacion: { ingresos: { abs: number; pct: number | null }; margenBruto: { abs: number; pct: number | null }; gastos: { abs: number; pct: number | null }; ebitda: { abs: number; pct: number | null } }
  }
  indicadores: {
    actual: { margenOpPct: number; resultadoOpPct: number; margenEbitdaPct: number; semaforo: 'verde' | 'amarillo' | 'rojo' }
    anterior: { margenOpPct: number; resultadoOpPct: number; margenEbitdaPct: number; semaforo: 'verde' | 'amarillo' | 'rojo' }
  }
  gastosPorClasif: { clasificacion: string; actual: number; anterior: number; variacionPct: number | null }[]
  cobranza: {
    montoPendiente: number
    dso: number | null
    tasaPagoPct: number | null
    totalVencido: number
    topVencidas: { cliente: string; fechaVencimiento: string; diasVencidos: number; monto: number }[]
  }
  ytd: { ingresos: number; gastos: number; ebitda: number; ingresosMensuales: { mes: string; label: string; monto: number }[] }
}

interface Narrativa {
  titular: string
  resumenEjecutivo: string[]
  comentarioIngresos: string
  comentarioGastos: string
  comentarioCobranza: string
  comentarioIndicadores: string
}

const REQUIRED_NARRATIVA_FIELDS: (keyof Narrativa)[] = [
  'titular', 'resumenEjecutivo', 'comentarioIngresos', 'comentarioGastos', 'comentarioCobranza', 'comentarioIndicadores',
]

const datos = readJSON<Datos>(datosPath!, 'datos')
const narrativa = readJSON<Narrativa>(narrativaPath!, 'narrativa')

for (const field of REQUIRED_NARRATIVA_FIELDS) {
  if (!narrativa[field] || (Array.isArray(narrativa[field]) && (narrativa[field] as unknown[]).length === 0)) {
    console.error(`Error: falta el campo "${field}" en el JSON de narrativa (${narrativaPath}).`)
    process.exit(1)
  }
}

// ---------- pptx ----------
const pptx = new pptxgen()
pptx.defineLayout({ name: 'NLACE_WIDE', width: 13.33, height: 7.5 })
pptx.layout = 'NLACE_WIDE'

const LOGO_PNG = resolve(__dirname, '../assets/nlace-black.png')
const LOGO_SVG = resolve(__dirname, '../assets/nlace-black.svg')
const LOGO_PATH = existsSync(LOGO_PNG) ? LOGO_PNG : LOGO_SVG

function newSlide() {
  const slide = pptx.addSlide()
  slide.background = { color: BRAND.bg }
  slide.slideNumber = { x: 12.55, y: 7.1, fontFace: FONT_BODY, fontSize: 10, color: BRAND.text }
  return slide
}

function addTitleBlock(slide: pptxgen.Slide, titulo: string, subtitulo?: string) {
  slide.addText(titulo, {
    x: 0.6, y: 0.5, w: 5.0, h: 0.7,
    fontFace: FONT_HEAD, fontSize: 24, bold: true, color: BRAND.text,
  })
  if (subtitulo) {
    slide.addText(subtitulo, {
      x: 0.6, y: 1.15, w: 5.0, h: 0.4,
      fontFace: FONT_BODY, fontSize: 13, color: BRAND.azul,
    })
  }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 1.55, w: 0.6, h: 0.05, fill: { color: BRAND.acento }, line: { type: 'none' },
  })
}

// ---------- Slide 1: Portada ----------
{
  const slide = newSlide()
  const logoW = 2.6
  const logoH = logoW * (125 / 464) // aspect ratio real del SVG (464x125)
  slide.addImage({ path: LOGO_PATH, x: 0.7, y: 0.6, w: logoW, h: logoH })

  slide.addText('Informe Ejecutivo Mensual', {
    x: 0.7, y: 2.9, w: 11.9, h: 1.0,
    fontFace: FONT_HEAD, fontSize: 40, bold: true, color: BRAND.text,
  })
  slide.addText(datos.mesLabel, {
    x: 0.7, y: 3.85, w: 11.9, h: 0.7,
    fontFace: FONT_HEAD, fontSize: 24, bold: true, color: BRAND.azul,
  })
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.72, y: 4.55, w: 1.2, h: 0.08, fill: { color: BRAND.acento }, line: { type: 'none' },
  })
  const fecha = new Date(datos.generadoEl)
  slide.addText(`Generado el ${fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}`, {
    x: 0.7, y: 6.7, w: 8, h: 0.4,
    fontFace: FONT_BODY, fontSize: 11, color: BRAND.text,
  })
}

// ---------- Slide 2: Resumen ejecutivo ----------
{
  const slide = newSlide()
  addTitleBlock(slide, 'Resumen Ejecutivo', narrativa.titular)

  const parrafos = narrativa.resumenEjecutivo
    .map((p, i) => ({ text: p, options: { fontFace: FONT_BODY, fontSize: 13, color: BRAND.text, paraSpaceAfter: 12, breakLine: i < narrativa.resumenEjecutivo.length - 1 } }))
  slide.addText(parrafos, { x: 0.6, y: 1.9, w: 7.0, h: 4.8, valign: 'top' })

  const er = datos.estadoResultado.actual
  const ind = datos.indicadores.actual
  const cifras: { label: string; valor: string; color: string }[] = [
    { label: 'Ingresos del mes', valor: fmtCLP(er.ingresos), color: BRAND.azul },
    { label: 'EBITDA', valor: fmtCLP(er.ebitda), color: er.ebitda >= 0 ? BRAND.verde : BRAND.rojo },
    { label: 'DSO', valor: datos.cobranza.dso != null ? `${Math.round(datos.cobranza.dso)} días` : '—', color: BRAND.text },
    { label: 'Estado general', valor: SEMAFORO_LABEL[ind.semaforo].split(' (')[0], color: BRAND[ind.semaforo] },
  ]
  let y = 1.9
  cifras.forEach(c => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 8.1, y, w: 4.6, h: 1.05, rectRadius: 0.08,
      fill: { color: BRAND.blanco }, line: { color: BRAND.grisClaro, width: 1 },
    })
    slide.addText(c.label.toUpperCase(), { x: 8.4, y: y + 0.1, w: 4.0, h: 0.3, fontFace: FONT_BODY, fontSize: 10, color: BRAND.text, charSpacing: 1 })
    slide.addText(c.valor, { x: 8.4, y: y + 0.4, w: 4.0, h: 0.55, fontFace: FONT_HEAD, fontSize: 20, bold: true, color: c.color })
    y += 1.25
  })
}

// ---------- Slide 3: Ingresos y Margen Operacional ----------
{
  const slide = newSlide()
  addTitleBlock(slide, 'Ingresos y Margen Operacional', `${datos.mesLabel} vs ${datos.mesAnteriorLabel}`)
  slide.addText(narrativa.comentarioIngresos, {
    x: 0.6, y: 1.9, w: 5.0, h: 2.2, fontFace: FONT_BODY, fontSize: 13, color: BRAND.text, valign: 'top',
  })

  const erA = datos.estadoResultado.actual
  const erP = datos.estadoResultado.anterior
  slide.addChart(
    pptx.ChartType.bar,
    [
      {
        name: datos.mesAnteriorLabel,
        labels: ['Ingresos', 'Margen Bruto', 'EBITDA'],
        values: [erP.ingresos, erP.margenBruto, erP.ebitda],
      },
      {
        name: datos.mesLabel,
        labels: ['Ingresos', 'Margen Bruto', 'EBITDA'],
        values: [erA.ingresos, erA.margenBruto, erA.ebitda],
      },
    ],
    {
      x: 5.9, y: 1.7, w: 6.9, h: 2.6,
      barDir: 'col', chartColors: [BRAND.grisClaro, BRAND.azul],
      showLegend: true, legendPos: 'b', legendFontFace: FONT_BODY, legendFontSize: 10,
      catAxisLabelFontFace: FONT_BODY, valAxisLabelFontFace: FONT_BODY,
      dataLabelFormatCode: '#,##0,"K"',
    },
  )

  if (datos.ytd.ingresosMensuales.length > 1) {
    slide.addText('Ingresos mensuales (YTD)', { x: 0.6, y: 4.3, w: 5, h: 0.35, fontFace: FONT_BODY, fontSize: 11, bold: true, color: BRAND.text })
    slide.addChart(
      pptx.ChartType.line,
      [{
        name: 'Ingresos',
        labels: datos.ytd.ingresosMensuales.map(m => m.label),
        values: datos.ytd.ingresosMensuales.map(m => m.monto),
      }],
      {
        x: 0.6, y: 4.65, w: 12.1, h: 2.0,
        chartColors: [BRAND.acento], showLegend: false,
        catAxisLabelFontFace: FONT_BODY, valAxisLabelFontFace: FONT_BODY,
        lineDataSymbol: 'circle', lineSize: 2,
      },
    )
  }
}

// ---------- Slide 4: Gastos por clasificación ----------
{
  const slide = newSlide()
  addTitleBlock(slide, 'Gastos por Clasificación', `${datos.mesLabel} vs ${datos.mesAnteriorLabel}`)
  slide.addText(narrativa.comentarioGastos, {
    x: 0.6, y: 1.9, w: 12.1, h: 0.8, fontFace: FONT_BODY, fontSize: 13, color: BRAND.text, valign: 'top',
  })

  const top = datos.gastosPorClasif.slice(0, 8)
  if (top.length > 0) {
    slide.addChart(
      pptx.ChartType.bar,
      [
        { name: datos.mesAnteriorLabel, labels: top.map(g => g.clasificacion), values: top.map(g => g.anterior) },
        { name: datos.mesLabel, labels: top.map(g => g.clasificacion), values: top.map(g => g.actual) },
      ],
      {
        x: 0.6, y: 2.75, w: 6.1, h: 4.1,
        barDir: 'bar', chartColors: [BRAND.grisClaro, BRAND.acento],
        showLegend: true, legendPos: 'b', legendFontFace: FONT_BODY, legendFontSize: 9,
        catAxisLabelFontFace: FONT_BODY, catAxisLabelFontSize: 9, valAxisLabelFontFace: FONT_BODY,
      },
    )
  }

  const tableRows: pptxgen.TableRow[] = [
    [
      { text: 'Clasificación', options: { bold: true, fill: { color: BRAND.text }, color: BRAND.blanco } },
      { text: datos.mesAnteriorLabel, options: { bold: true, fill: { color: BRAND.text }, color: BRAND.blanco, align: 'right' } },
      { text: datos.mesLabel, options: { bold: true, fill: { color: BRAND.text }, color: BRAND.blanco, align: 'right' } },
      { text: 'Var. %', options: { bold: true, fill: { color: BRAND.text }, color: BRAND.blanco, align: 'right' } },
    ],
    ...top.map((g, i) => [
      { text: g.clasificacion, options: { fill: { color: i % 2 === 0 ? BRAND.blanco : 'F6F6F6' } } },
      { text: fmtCLP(g.anterior), options: { align: 'right' as const, fill: { color: i % 2 === 0 ? BRAND.blanco : 'F6F6F6' } } },
      { text: fmtCLP(g.actual), options: { align: 'right' as const, fill: { color: i % 2 === 0 ? BRAND.blanco : 'F6F6F6' } } },
      {
        text: g.variacionPct == null ? '—' : signed(fmtPct(g.variacionPct), g.variacionPct),
        options: { align: 'right' as const, color: g.variacionPct != null && g.variacionPct > 0 ? BRAND.rojo : BRAND.verde, fill: { color: i % 2 === 0 ? BRAND.blanco : 'F6F6F6' } },
      },
    ]),
  ]
  slide.addTable(tableRows, {
    x: 7.0, y: 2.75, w: 5.7, h: 4.1,
    fontFace: FONT_BODY, fontSize: 10, border: { type: 'solid', color: BRAND.grisClaro, pt: 0.5 },
    autoPage: false,
  })
}

// ---------- Slide 5: Estado de cobranza (CxC) ----------
{
  const slide = newSlide()
  addTitleBlock(slide, 'Estado de Cobranza (CxC)')
  slide.addText(narrativa.comentarioCobranza, {
    x: 0.6, y: 1.9, w: 12.1, h: 0.8, fontFace: FONT_BODY, fontSize: 13, color: BRAND.text, valign: 'top',
  })

  const kpis = [
    { label: 'Monto pendiente', valor: fmtCLP(datos.cobranza.montoPendiente) },
    { label: 'DSO', valor: datos.cobranza.dso != null ? `${Math.round(datos.cobranza.dso)} días` : '—' },
    { label: 'Tasa de pago', valor: fmtPct(datos.cobranza.tasaPagoPct) },
  ]
  kpis.forEach((k, i) => {
    const x = 0.6 + i * 4.15
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 2.85, w: 3.9, h: 1.2, rectRadius: 0.08,
      fill: { color: BRAND.blanco }, line: { color: BRAND.grisClaro, width: 1 },
    })
    slide.addText(k.label.toUpperCase(), { x: x + 0.25, y: 3.0, w: 3.4, h: 0.3, fontFace: FONT_BODY, fontSize: 10, color: BRAND.text })
    slide.addText(k.valor, { x: x + 0.25, y: 3.35, w: 3.4, h: 0.6, fontFace: FONT_HEAD, fontSize: 24, bold: true, color: BRAND.azul })
  })

  slide.addText('Top facturas vencidas', { x: 0.6, y: 4.3, w: 5, h: 0.35, fontFace: FONT_BODY, fontSize: 11, bold: true, color: BRAND.text })
  const vencRows: pptxgen.TableRow[] = [
    [
      { text: 'Cliente', options: { bold: true, fill: { color: BRAND.text }, color: BRAND.blanco } },
      { text: 'Vencimiento', options: { bold: true, fill: { color: BRAND.text }, color: BRAND.blanco } },
      { text: 'Días vencido', options: { bold: true, fill: { color: BRAND.text }, color: BRAND.blanco, align: 'right' } },
      { text: 'Monto', options: { bold: true, fill: { color: BRAND.text }, color: BRAND.blanco, align: 'right' } },
    ],
    ...datos.cobranza.topVencidas.slice(0, 8).map((f, i) => [
      { text: f.cliente, options: { fill: { color: i % 2 === 0 ? BRAND.blanco : 'F6F6F6' } } },
      { text: f.fechaVencimiento, options: { fill: { color: i % 2 === 0 ? BRAND.blanco : 'F6F6F6' } } },
      { text: String(f.diasVencidos), options: { align: 'right' as const, color: BRAND.rojo, fill: { color: i % 2 === 0 ? BRAND.blanco : 'F6F6F6' } } },
      { text: fmtCLP(f.monto), options: { align: 'right' as const, fill: { color: i % 2 === 0 ? BRAND.blanco : 'F6F6F6' } } },
    ]),
  ]
  if (datos.cobranza.topVencidas.length === 0) {
    slide.addText('Sin facturas vencidas.', { x: 0.6, y: 4.7, w: 6, h: 0.4, fontFace: FONT_BODY, fontSize: 12, color: BRAND.text })
  } else {
    slide.addTable(vencRows, {
      x: 0.6, y: 4.7, w: 12.1, h: 2.2,
      fontFace: FONT_BODY, fontSize: 10, border: { type: 'solid', color: BRAND.grisClaro, pt: 0.5 },
      autoPage: false,
    })
  }
}

// ---------- Slide 6: Indicadores de resultado ----------
{
  const slide = newSlide()
  addTitleBlock(slide, 'Indicadores de Resultado')
  slide.addText(narrativa.comentarioIndicadores, {
    x: 0.6, y: 1.9, w: 5.2, h: 3.5, fontFace: FONT_BODY, fontSize: 13, color: BRAND.text, valign: 'top',
  })

  const ind = datos.indicadores.actual
  const indP = datos.indicadores.anterior
  const er = datos.estadoResultado.actual

  const bloques = [
    { label: 'Margen Operacional', valor: fmtPct(ind.margenOpPct), anterior: fmtPct(indP.margenOpPct) },
    { label: 'Resultado Operacional', valor: fmtPct(ind.resultadoOpPct), anterior: fmtPct(indP.resultadoOpPct) },
    { label: 'EBITDA', valor: `${fmtCLP(er.ebitda)}  (${fmtPct(ind.margenEbitdaPct)})`, anterior: fmtPct(indP.margenEbitdaPct) },
  ]
  let y = 1.9
  bloques.forEach(b => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 6.1, y, w: 6.6, h: 1.15, rectRadius: 0.08,
      fill: { color: BRAND.blanco }, line: { color: BRAND.grisClaro, width: 1 },
    })
    slide.addText(b.label.toUpperCase(), { x: 6.35, y: y + 0.12, w: 5, h: 0.3, fontFace: FONT_BODY, fontSize: 10, color: BRAND.text })
    slide.addText(b.valor, { x: 6.35, y: y + 0.42, w: 4, h: 0.6, fontFace: FONT_HEAD, fontSize: 22, bold: true, color: BRAND.text })
    slide.addText(`Mes anterior: ${b.anterior}`, { x: 10.5, y: y + 0.55, w: 2.1, h: 0.4, fontFace: FONT_BODY, fontSize: 9, color: BRAND.text, align: 'right' })
    y += 1.35
  })

  // Semáforo
  const semColor = BRAND[ind.semaforo]
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 0.9, y: 5.6, w: 1.0, h: 1.0, fill: { color: semColor }, line: { type: 'none' },
  })
  slide.addText(SEMAFORO_LABEL[ind.semaforo], {
    x: 2.1, y: 5.85, w: 3.9, h: 0.6, fontFace: FONT_BODY, fontSize: 11, color: BRAND.text, valign: 'middle',
  })
  slide.addText('Criterio: verde ≥5% · amarillo 0–5% · rojo <0%', {
    x: 0.6, y: 6.75, w: 5.5, h: 0.3, fontFace: FONT_BODY, fontSize: 9, italic: true, color: BRAND.text,
  })
}

// ---------- escribir archivo ----------
mkdirSync(dirname(outPath!), { recursive: true })
await pptx.writeFile({ fileName: outPath! })
console.log(`Informe generado: ${resolve(outPath!)}`)
