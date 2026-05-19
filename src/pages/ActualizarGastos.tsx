import { useState, useCallback, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, RotateCcw, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://orjufhwfepojfiqejhfc.supabase.co'
const SERVICE_KEY  = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
const supabaseAdmin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : supabase

// ── CATÁLOGO GASTOS (consolidado por Clasificacion_Gasto) ─────────────────────
// Orden importa: categorías específicas antes que genéricas
const CATALOG_GASTOS = [
  {
    clasificacion_gasto: 'Honorarios', tipo_cuenta: 'Gasto_Adm',
    cuenta_cble: '4201-02', descripcion_cta: 'HONORARIOS PROFESIONALES',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: [
      'OLGA', 'RAMIREZ', '0064909304', '6490930', '64909304',
      'VICTOR FIGUEROA', 'VICTOR FIGUERO', '12497902', '00124979021', '124979021', '0124979021',
    ],
  },
  {
    clasificacion_gasto: 'ERP', tipo_cuenta: 'Gasto_ERP',
    cuenta_cble: '4201-37', descripcion_cta: 'SERVICIOS COMPUTACIONALES',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: ['TOKU', 'NUBOX PAY', 'HAULMER'],
  },
  {
    clasificacion_gasto: 'Marketing', tipo_cuenta: 'Gasto_Mkg',
    cuenta_cble: '4301-03', descripcion_cta: 'PUBLICIDAD',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: ['FACEBK', 'FACEBOOK', 'META'],
  },
  {
    clasificacion_gasto: 'Cobranza', tipo_cuenta: 'Gasto_Cobranza',
    cuenta_cble: '4301-02', descripcion_cta: 'GASTOS COBRANZA',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: ['NP PAYU', 'PAYU'],
  },
  {
    clasificacion_gasto: 'Abogados', tipo_cuenta: 'Gasto_Legl',
    cuenta_cble: '4201-12', descripcion_cta: 'LEGALES Y NOTARIALES',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: ['76.229.620-9', '76229620-9', '0762296209', 'FLORES ACEVEDO', 'NOTARIA', 'JUAN FACU'],
  },
  {
    clasificacion_gasto: 'Banco', tipo_cuenta: 'Gasto_Adm',
    cuenta_cble: '4201-10', descripcion_cta: 'GASTOS BANCARIOS',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: ['COM.MANTENCION', 'MANTENCION PLAN', 'AMORTIZACION', 'AMORTIZACIÓN', 'LCA N°', 'INTERESES LINEA', 'SOBREGIRO'],
  },
  {
    clasificacion_gasto: 'Bencina', tipo_cuenta: 'Gasto_Benc',
    cuenta_cble: '4201-26', descripcion_cta: 'LOCOMOCION Y COLACION',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: ['COMERCIAL F Y H LI', 'SHELL', 'EL NOGAL SPA', 'ARAMCO', 'COMBUSTIBLE', 'BENCINA', 'GASOLINA'],
  },
  {
    // Restorant antes que Movilizacion para que UBER EATS clasifique aquí
    clasificacion_gasto: 'Restorant', tipo_cuenta: 'Gasto_Rest',
    cuenta_cble: '4201-09', descripcion_cta: 'REPRESENTACION Y VIATICOS',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: [
      'DUEMINT', 'VIRTUAL DUEMINT',
      'STARBUCKS', 'JUAN VALDEZ', 'CAFE RITUAL', 'WORK CAFE', 'LA COMPANIA', 'DONDE CAMILO',
      'LA CABRERA', 'COFFEEBOT', 'SEMILLA', 'GLOBAL BREKKIE', 'PROCHIS FOODS', 'WENBIN LAI',
      'HARUKO', 'ARCO Y BALENO', 'TIRAMISU', 'LOS TRES ANTONIOS', 'AROMAS DE CAFE', 'BOULANGERIE',
      'DOMO GASTRO', 'DOMANI', 'PHILIA', 'TIP Y TAP', 'MARGO', 'RISHTEDAR', 'MARIBERICO',
      'UBER EATS', 'JUSTO', 'FUENTE SUIZA', 'LA FUENTE', 'MAMAKUNA', 'TERRITORIA', 'LE BISTROT',
      'CAFE MAGN', 'DACARROW', 'SPID MUT', 'RESTAURANT', 'CAFETERIA', 'OPERADORA GASTRONO',
      'CAFE', 'FUDO', 'KHIPU',
    ],
  },
  {
    clasificacion_gasto: 'Estacionamiento', tipo_cuenta: 'Gasto_Mov',
    cuenta_cble: '4201-26', descripcion_cta: 'LOCOMOCION Y COLACION',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: [
      'SABA ', 'SAAB', 'ESTACIONAMIENTO', 'EDIFICIO NUEVA MAN', 'AKIPARK',
      'NET PARKING', 'SIMPLEPARK', 'APOQUINDO 4700', 'PARKING', 'PARK',
    ],
  },
  {
    clasificacion_gasto: 'Movilizacion', tipo_cuenta: 'Gasto_Mov',
    cuenta_cble: '4201-26', descripcion_cta: 'LOCOMOCION Y COLACION',
    empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a',
    keywords: ['CABIFY', 'UBER', 'SMARTYCAR'],
  },
] as const

// ── TYPES ─────────────────────────────────────────────────────────────────────
type CatalogEntry = (typeof CATALOG_GASTOS)[number]
type GastosRow = {
  _idx: number
  glosa: string
  fecha: string
  monto_cartola: number
  monto_bd: number
  clasificacion_gasto: string
  tipo_cuenta: string
  cuenta_cble: string
  descripcion_cta: string
  empresa_id: string
  mes_economico: string
  ano_eco: number
  mes: number
}
type TableResult = { inserted: number; skipped: number; errors: { glosa: string; error: string }[] }

// ── MATCHING ──────────────────────────────────────────────────────────────────
// Normaliza acentos para que "LÍNEA" == "LINEA", "CRÉDITO" == "CREDITO", etc.
function norm(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Glosas que nunca deben registrarse en gastos (ej: amortización de crédito)
function isExcluded(glosa: string): boolean {
  const u = norm(glosa)
  return u.includes('LCA') && u.includes('AMORTIZACION PERIODICA')
}

function matchGasto(glosa: string): CatalogEntry | null {
  if (isExcluded(glosa)) return null
  const u = norm(glosa)
  for (const e of CATALOG_GASTOS) {
    for (const kw of e.keywords) {
      if (u.includes(norm(kw))) return e
    }
  }
  return null
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function parseDate(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') {
    const p = v.split('/')
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
    return v
  }
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v)
}

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function ActualizarGastos() {
  const [step, setStep]           = useState<'upload' | 'preview' | 'uploading' | 'done'>('upload')
  const [dragging, setDragging]   = useState(false)
  const [fileName, setFileName]   = useState('')
  const [catRows, setCatRows]     = useState<GastosRow[]>([])
  const [uncat, setUncat]         = useState<GastosRow[]>([])
  const [selected, setSelected]   = useState<Record<number, boolean>>({})
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set())
  const [checkingDupes, setCheckingDupes] = useState(false)
  const [mode, setMode]           = useState<'prueba' | 'produccion'>('prueba')
  const [jsonPreview, setJsonPreview] = useState<object[] | null>(null)
  const [jsonOpen, setJsonOpen]   = useState(false)
  const [result, setResult]       = useState<TableResult | null>(null)
  const jsonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (jsonPreview && jsonRef.current) {
      jsonRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [jsonPreview])

  useEffect(() => {
    if (catRows.length === 0) return
    const fechas = catRows.map(r => r.fecha).filter(Boolean)
    if (!fechas.length) return
    const fechaMin = fechas.reduce((a, b) => a < b ? a : b)
    const fechaMax = fechas.reduce((a, b) => a > b ? a : b)
    setCheckingDupes(true)
    ;(async () => {
      const fp = new Set<string>()
      const { data } = await supabase
        .from('gastos')
        .select('fecha_pago, monto_bruto, descripcion_glosa')
        .gte('fecha_pago', fechaMin)
        .lte('fecha_pago', fechaMax)
      ;(data ?? []).forEach((r: { fecha_pago: string; monto_bruto: number; descripcion_glosa: string }) =>
        fp.add(`${r.fecha_pago}|${r.monto_bruto}|${r.descripcion_glosa}`)
      )
      setDuplicateIds(fp)
      if (fp.size > 0) {
        setSelected(prev => {
          const n = { ...prev }
          catRows.forEach(r => { if (fp.has(`${r.fecha}|${r.monto_bd}|${r.glosa}`)) n[r._idx] = false })
          return n
        })
      }
      setCheckingDupes(false)
    })()
  }, [catRows])

  const processFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb  = XLSX.read(e.target!.result as ArrayBuffer, { type: 'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
      const cats: GastosRow[] = [], uncats: GastosRow[] = []
      let idx = 0
      for (const r of raw.slice(16)) {
        const row = r as unknown[]
        if (!row) continue
        if (typeof row[0] === 'string' && row[0].toLowerCase().includes('resumen comisiones')) break
        if (typeof row[0] !== 'number') continue
        const monto = row[0] as number
        if (monto >= 0) continue
        const glosa = (row[1] as string) || ''
        const fecha = parseDate(row[3])
        const monto_bd = Math.abs(monto)
        const match = matchGasto(glosa)
        const d = fecha ? new Date(fecha + 'T00:00:00') : null
        const mes = d ? d.getMonth() + 1 : 0
        const ano_eco = d ? d.getFullYear() : 0
        const parsed: GastosRow = {
          _idx: idx++, glosa, fecha, monto_cartola: monto, monto_bd,
          clasificacion_gasto: match?.clasificacion_gasto ?? '',
          tipo_cuenta:         match?.tipo_cuenta         ?? '',
          cuenta_cble:         match?.cuenta_cble         ?? '',
          descripcion_cta:     match?.descripcion_cta     ?? '',
          empresa_id:          match?.empresa_id          ?? '',
          mes_economico: d ? `${ano_eco}-${String(mes).padStart(2, '0')}` : '',
          ano_eco, mes,
        }
        if (match) cats.push(parsed)
        else uncats.push(parsed)
      }
      setCatRows(cats)
      setUncat(uncats)
      const sel: Record<number, boolean> = {}
      cats.forEach(r => { sel[r._idx] = true })
      setSelected(sel)
      setStep('preview')
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0])
  }, [processFile])

  const toggleRow = (idx: number) => setSelected(p => ({ ...p, [idx]: !p[idx] }))
  const toggleAll = (rows: GastosRow[]) => {
    const allOn = rows.every(r => selected[r._idx])
    setSelected(p => { const n = { ...p }; rows.forEach(r => { n[r._idx] = !allOn }); return n })
  }

  const selRows = catRows.filter(r => selected[r._idx])

  const buildRow = (r: GastosRow) => ({
    empresa_id:          r.empresa_id,
    cuenta_cble:         r.cuenta_cble,
    descripcion_cta:     r.descripcion_cta,
    clasificacion_gasto: r.clasificacion_gasto,
    tipo_cuenta:         r.tipo_cuenta,
    monto_bruto:         r.monto_bd,
    fecha_emision:       r.fecha,
    fecha_pago:          r.fecha,
    mes_economico:       r.mes_economico,
    ano_eco:             r.ano_eco,
    estado:              'Pagada',
    descripcion_glosa:   r.glosa,
  })

  const handleUpload = async () => {
    if (mode === 'prueba') {
      setJsonPreview(selRows.map(buildRow))
      setJsonOpen(true)
      return
    }
    setStep('uploading')
    const res: TableResult = { inserted: 0, skipped: 0, errors: [] }
    for (const row of selRows) {
      const { error } = await supabaseAdmin.from('gastos').insert(buildRow(row))
      if (error) {
        if (error.code === '23505') res.skipped++
        else res.errors.push({ glosa: row.glosa, error: error.message })
      } else res.inserted++
    }
    setResult(res)
    setStep('done')
  }

  const reset = () => {
    setStep('upload'); setFileName(''); setCatRows([]); setUncat([])
    setSelected({}); setDuplicateIds(new Set()); setCheckingDupes(false)
    setJsonPreview(null); setResult(null); setJsonOpen(false)
  }

  const isDupe = (r: GastosRow) => duplicateIds.has(`${r.fecha}|${r.monto_bd}|${r.glosa}`)
  const dupeCount = catRows.filter(isDupe).length
  const allOn = catRows.length > 0 && catRows.every(r => selected[r._idx])

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-[22px] font-bold text-nl-text tracking-tight">Actualizar Gastos</h1>
        <p className="mt-1 text-[13px] font-body text-nl-500">
          Importa la cartola bancaria (.xlsx Banco Santander) y registra los gastos operacionales en Supabase.
        </p>
      </div>

      {/* ── UPLOAD ── */}
      {step === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('gi-file')?.click()}
          className={`border-2 border-dashed rounded-card p-16 text-center cursor-pointer transition-all duration-200 ${
            dragging ? 'border-nl-primary bg-nl-primary-10/30' : 'border-nl-border-ui bg-nl-white hover:border-nl-primary/50 hover:bg-nl-primary-10/10'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${dragging ? 'bg-nl-primary text-white' : 'bg-nl-bg text-nl-400'}`}>
              <Upload size={26} />
            </div>
            <div>
              <p className={`text-[15px] font-semibold font-body transition-colors ${dragging ? 'text-nl-primary' : 'text-nl-text'}`}>
                {dragging ? 'Suelta aquí el archivo' : 'Arrastra la cartola .xlsx'}
              </p>
              <p className="text-[12px] text-nl-400 mt-1">Banco Santander · datos desde fila 17</p>
            </div>
            <div className="mt-2 px-4 py-2 bg-nl-accent text-white text-[12px] font-semibold rounded-input">
              Seleccionar archivo
            </div>
          </div>
          <input
            id="gi-file" type="file" className="hidden"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
            onClick={e => e.stopPropagation()}
            onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]) }}
          />
        </div>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && (
        <>
          {/* File bar */}
          <div className="flex items-center justify-between gap-4 p-4 bg-nl-white rounded-card border border-nl-border-soft">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={18} className="text-nl-accent shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-nl-text">{fileName}</p>
                <p className="text-[11px] font-mono text-nl-400 mt-0.5">
                  {catRows.length} identificados · {uncat.length} sin categorizar
                  {checkingDupes && <span className="ml-2 text-nl-primary animate-pulse">· verificando duplicados…</span>}
                  {!checkingDupes && dupeCount > 0 && <span className="ml-2 text-nl-danger">· {dupeCount} ya existen en BD</span>}
                </p>
              </div>
            </div>
            <button onClick={reset} className="flex items-center gap-1.5 text-[12px] text-nl-500 hover:text-nl-text transition-colors">
              <RotateCcw size={13} /> Nueva cartola
            </button>
          </div>

          {/* Conversion banner */}
          <div className="flex items-center gap-2 text-[11px] font-mono p-3 bg-nl-white rounded-card border border-nl-border-soft">
            <span className="px-2 py-0.5 rounded bg-nl-danger/10 text-nl-danger font-semibold">CARTOLA negativo</span>
            <span className="text-nl-400 text-[14px]">→</span>
            <span className="px-2 py-0.5 rounded bg-nl-success/10 text-nl-success-dark font-semibold">SUPABASE positivo ✓</span>
            <span className="text-nl-400 ml-1">conversión aplicada</span>
          </div>

          {/* Table */}
          {catRows.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-nl-accent">→ gastos</span>
                <span className="text-[10px] font-mono text-nl-400">{selRows.length}/{catRows.length} seleccionados</span>
                {dupeCount > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-nl-danger bg-nl-danger/8 px-2 py-0.5 rounded-pill">
                    <ShieldAlert size={10} />{dupeCount} ya existen en BD
                  </span>
                )}
              </div>
              <div className="rounded-card border border-nl-border-soft overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-nl-bg border-b border-nl-border-soft">
                      <th className="px-3 py-2.5 text-left w-8">
                        <button onClick={() => toggleAll(catRows)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allOn ? 'bg-nl-primary border-nl-primary' : 'border-nl-border-ui bg-nl-white'}`}>
                          {allOn && <span className="text-[8px] text-white font-bold">✓</span>}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Fecha</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Categoría</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Glosa banco</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Cuenta</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Cartola (−)</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Supabase (+)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catRows.map((r, i) => {
                      const dupe = isDupe(r)
                      return (
                        <tr key={r._idx} onClick={() => toggleRow(r._idx)}
                          className={`cursor-pointer border-b border-nl-border-soft last:border-0 transition-opacity ${selected[r._idx] ? 'opacity-100' : 'opacity-35'} ${dupe ? 'bg-nl-danger/4' : i % 2 === 0 ? 'bg-nl-white' : 'bg-nl-bg/40'} hover:bg-nl-primary-10/40`}>
                          <td className="px-3 py-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected[r._idx] ? 'bg-nl-primary border-nl-primary' : 'border-nl-border-ui bg-nl-white'}`}>
                              {selected[r._idx] && <span className="text-[8px] text-white font-bold">✓</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-nl-500">{r.fecha}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-nl-text">{r.clasificacion_gasto}</span>
                              {dupe && (
                                <span className="flex items-center gap-0.5 text-[9px] font-mono font-semibold text-nl-danger bg-nl-danger/10 px-1.5 py-0.5 rounded">
                                  <ShieldAlert size={9} />YA EXISTE
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] font-mono text-nl-400 mt-0.5">{r.tipo_cuenta}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-nl-500 block max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap" title={r.glosa}>
                              {r.glosa}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-mono text-[10px] bg-nl-accent/10 text-nl-accent px-1.5 py-0.5 rounded">{r.cuenta_cble}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-nl-danger">{fmtCLP(r.monto_cartola)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-nl-success-dark">{fmtCLP(r.monto_bd)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sin categorizar */}
          {uncat.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-nl-400">Sin categorizar</span>
                <span className="text-[10px] font-mono text-nl-400">{uncat.length} filas — revisar manualmente</span>
              </div>
              <div className="rounded-card border border-nl-border-soft overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead><tr className="bg-nl-bg border-b border-nl-border-soft">
                    <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Fecha</th>
                    <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Glosa banco</th>
                    <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Monto cartola</th>
                  </tr></thead>
                  <tbody>
                    {uncat.map((r, i) => (
                      <tr key={r._idx} className={`border-b border-nl-border-soft last:border-0 ${i % 2 === 0 ? 'bg-nl-white' : 'bg-nl-bg/40'}`}>
                        <td className="px-3 py-2 font-mono text-nl-500">{r.fecha}</td>
                        <td className="px-3 py-2 text-nl-500">{r.glosa}</td>
                        <td className="px-3 py-2 text-right font-mono text-nl-danger">{fmtCLP(r.monto_cartola)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 pt-2 flex-wrap">
            <div className="flex items-center bg-nl-bg rounded-pill border border-nl-border-soft p-0.5">
              <button onClick={() => { setMode('prueba'); setJsonPreview(null) }}
                className={`px-4 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${mode === 'prueba' ? 'bg-nl-white text-nl-primary shadow-card' : 'text-nl-500 hover:text-nl-text'}`}>
                Modo prueba
              </button>
              <button onClick={() => { setMode('produccion'); setJsonPreview(null) }}
                className={`px-4 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${mode === 'produccion' ? 'bg-nl-white text-nl-accent shadow-card' : 'text-nl-500 hover:text-nl-text'}`}>
                Modo producción
              </button>
            </div>
            <button onClick={handleUpload} disabled={selRows.length === 0 || checkingDupes}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-input text-[13px] font-semibold transition-all ${
                selRows.length === 0 || checkingDupes
                  ? 'bg-nl-border-ui text-nl-400 cursor-not-allowed'
                  : mode === 'produccion' ? 'bg-nl-accent text-white hover:opacity-90' : 'bg-nl-primary text-white hover:opacity-90'
              }`}>
              {mode === 'prueba' ? 'Ver JSON' : 'Subir a Supabase'}
              <span className="font-mono text-[11px] opacity-80">({selRows.length} filas)</span>
            </button>
          </div>

          {/* JSON preview */}
          {jsonPreview && (
            <div ref={jsonRef} className="rounded-card border border-nl-border-soft overflow-hidden">
              <button onClick={() => setJsonOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-nl-bg hover:bg-nl-primary-10/30 transition-colors">
                <span className="text-[12px] font-mono font-semibold text-nl-primary">JSON preview — {selRows.length} registros</span>
                {jsonOpen ? <ChevronUp size={14} className="text-nl-400" /> : <ChevronDown size={14} className="text-nl-400" />}
              </button>
              {jsonOpen && (
                <pre className="p-4 text-[11px] font-mono text-nl-500 bg-nl-white overflow-x-auto max-h-96">
                  {JSON.stringify(jsonPreview, null, 2)}
                </pre>
              )}
            </div>
          )}
        </>
      )}

      {/* ── UPLOADING ── */}
      {step === 'uploading' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-nl-accent/20 border-t-nl-accent rounded-full animate-spin" />
          <p className="text-[13px] font-body text-nl-500">Insertando registros en Supabase…</p>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && result && (
        <>
          <div className={`rounded-card border p-6 ${result.errors.length > 0 ? 'border-nl-danger/30 bg-nl-danger/5' : 'border-nl-success/30 bg-nl-success/5'}`}>
            <div className="flex items-center gap-2 mb-1">
              {result.errors.length > 0 ? <AlertCircle size={16} className="text-nl-danger" /> : <CheckCircle size={16} className="text-nl-success-dark" />}
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-nl-500">→ gastos</span>
            </div>
            <p className="text-[28px] font-body font-bold tabular-nums text-nl-text">{result.inserted}</p>
            <p className="text-[12px] text-nl-500">registros insertados</p>
            {result.skipped > 0 && <p className="text-[11px] font-mono text-nl-400 mt-1">{result.skipped} omitidos (ya existían)</p>}
            {result.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-[11px] font-mono text-nl-danger">
                    <span className="opacity-60 truncate block">{e.glosa.slice(0, 40)}</span>
                    <span>{e.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 bg-nl-accent text-white rounded-input text-[13px] font-semibold hover:opacity-90 transition-opacity">
            <RotateCcw size={14} /> Nueva cartola
          </button>
        </>
      )}
    </div>
  )
}
