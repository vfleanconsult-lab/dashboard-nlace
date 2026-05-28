import { useState, useCallback, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload, CheckCircle, AlertCircle, FileSpreadsheet, RotateCcw,
  ChevronDown, ChevronUp, ShieldAlert, AlertTriangle, Scissors,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://orjufhwfepojfiqejhfc.supabase.co'
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
const supabaseAdmin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : supabase
const EMPRESA_ID = '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a'

// ── TYPES ───────────────────────────────────────────────────────────────────
type AbonoBanco = {
  _idx: number
  fecha: string       // YYYY-MM-DD
  descripcion: string
  monto: number       // positive
  rutBanco: string    // digits as in description
  rutNorm: string     // normalized (no leading zeros)
  mes: string         // YYYY-MM
}

type FacturaEmitida = {
  id: string
  folio: string
  rut_cliente: string
  rutNorm: string
  cliente: string
  monto_bruto: number
  fecha_emision: string
  mes_economico: string
  ano_eco: number
  fecha_pago: string | null
  fecha_vencimiento: string | null
  cuenta_cble: string
  descripcion_cta: string
}

type AliasEntry = {
  rut: string
  cliente: string
  desc_mov: string
}

type MatchSimple = { kind: 'simple'; abono: AbonoBanco; factura: FacturaEmitida; _sel: boolean }
type MatchDoble  = { kind: 'doble';  abono1: AbonoBanco; abono2: AbonoBanco; factura: FacturaEmitida; _sel: boolean }
type MatchParcial= { kind: 'parcial'; abono: AbonoBanco; factura: FacturaEmitida; remainder: number; _sel: boolean }
type Match = MatchSimple | MatchDoble | MatchParcial

type AlertItem = { abono: AbonoBanco; motivo: string }

type ApplyResult = { updated: number; inserted: number; errors: string[] }

// ── HELPERS ─────────────────────────────────────────────────────────────────
const normRut = (s: string) =>
  (s ?? '').replace(/[.\-\s]/g, '').replace(/^0+/, '') || '0'

function extractRutFromDesc(desc: string): string {
  const m = desc.match(/^(\d{8,12})\s+Transf\.?\s/i)
  return m ? m[1] : ''
}

function parseXlsxDate(v: unknown): string {
  if (!v) return ''
  if (v instanceof Date) {
    const y = v.getFullYear()
    const mo = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  if (typeof v === 'string') {
    const t = v.trim()
    const p = t.split(/[\/\-]/)
    if (p.length === 3 && p[0].length <= 2 && p[2].length === 4)
      return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
    if (p.length === 3 && p[0].length === 4) return t
    return t
  }
  if (typeof v === 'number') {
    try {
      const d = (XLSX.SSF as unknown as { parse_date_code: (n: number) => { y: number; m: number; d: number } | null })
        .parse_date_code(v)
      if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
    } catch { /* ignore */ }
  }
  return ''
}

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

// ── XLSX PARSER ──────────────────────────────────────────────────────────────
function parseCartola(fileName: string, raw: unknown[][]): AbonoBanco[] {
  const name = fileName.toLowerCase()
  const isProvisoria = name.includes('cartolaprovisoria')

  // Header row index (0-based): HistCtaCte=15 (row 16), Provisoria=12 (row 13)
  const headerIdx = isProvisoria ? 12 : 15
  const headerRow = (raw[headerIdx] ?? []) as unknown[]

  const findCol = (keywords: string[]) =>
    headerRow.findIndex(h => {
      if (!h) return false
      const s = String(h).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      return keywords.some(k => s.includes(k.toUpperCase()))
    })

  let colMonto = findCol(['MONTO', 'IMPORTE'])
  let colDescB = findCol(['DESCRIPCION', 'GLOSA', 'MOVIMIENTO'])
  let colFecha = findCol(['FECHA'])
  let colCA    = findCol(['CARGO/ABONO', 'CARGO ABONO', 'TIPO'])

  // Known fixed positions for HistCtaCte (same layout as ActualizarCostos)
  if (!isProvisoria) {
    if (colMonto < 0) colMonto = 0
    if (colDescB < 0) colDescB = 1
    if (colFecha < 0) colFecha = 3
    if (colCA    < 0) colCA    = 7
  }

  const abonos: AbonoBanco[] = []
  let idx = 0

  for (const r of raw.slice(headerIdx + 1)) {
    const row = r as unknown[]
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue

    const anyText = row.map(c => String(c ?? '').toLowerCase()).join(' ')
    if (anyText.includes('resumen comisiones')) break

    const montoRaw = colMonto >= 0 ? (row[colMonto] ?? 0) : 0
    const monto = typeof montoRaw === 'number' ? montoRaw
      : parseFloat(String(montoRaw).replace(/[.$\s]/g, '').replace(',', '.')) || 0

    const caVal = colCA >= 0 ? String(row[colCA] ?? '').trim().toUpperCase() : ''
    const isAbono = caVal === 'A' || (caVal === '' && monto > 0)
    if (!isAbono || Math.abs(monto) < 1) continue

    const descB = colDescB >= 0 ? String(row[colDescB] ?? '') : ''
    const descC = colDescB >= 0 && colDescB + 1 < row.length
      ? String(row[colDescB + 1] ?? '') : ''
    const descripcion = [descB, descC].filter(Boolean).join(' ').trim()

    const fechaRaw = colFecha >= 0 ? row[colFecha] : null
    const fecha = parseXlsxDate(fechaRaw)
    if (!fecha) continue

    const montoAbs = Math.abs(monto)
    const rutBanco = extractRutFromDesc(descripcion)
    const rutNorm  = normRut(rutBanco)
    const mes = fecha.slice(0, 7)

    abonos.push({ _idx: idx++, fecha, descripcion, monto: montoAbs, rutBanco, rutNorm, mes })
  }

  return abonos
}

// ── MATCHING ─────────────────────────────────────────────────────────────────
function runMatching(
  abonos: AbonoBanco[],
  facturas: FacturaEmitida[],
  aliases: AliasEntry[]
): { matches: Match[]; alerts: AlertItem[] } {
  const matches: Match[] = []
  const alerts: AlertItem[] = []
  const usedFac = new Set<string>()
  const usedAbo = new Set<number>()

  function resolveRuts(abono: AbonoBanco): string[] {
    const aliasHits = aliases.filter(a => {
      const desc = abono.descripcion.toUpperCase()
      const kw = a.desc_mov.toUpperCase()
      return kw.length > 3 && desc.includes(kw)
    })
    const aliasRuts = aliasHits.map(a => normRut(a.rut)).filter(r => r !== '0')
    if (abono.rutNorm && abono.rutNorm !== '0')
      return [...new Set([...aliasRuts, abono.rutNorm])]
    return [...new Set(aliasRuts)]
  }

  // Phase 1: exact match by RUT + monto
  for (const abono of abonos) {
    if (usedAbo.has(abono._idx)) continue
    const ruts = resolveRuts(abono)
    if (ruts.length === 0) {
      alerts.push({ abono, motivo: 'No se identificó RUT del pagador en la descripción' })
      usedAbo.add(abono._idx)
      continue
    }
    const candidates = facturas.filter(f =>
      !usedFac.has(f.id) && ruts.includes(f.rutNorm) && f.monto_bruto === abono.monto
    )
    if (candidates.length >= 1) {
      matches.push({ kind: 'simple', abono, factura: candidates[0], _sel: true })
      usedFac.add(candidates[0].id)
      usedAbo.add(abono._idx)
    }
  }

  // Phase 2: two payments in same month summing to one invoice
  const unmatched1 = abonos.filter(a => !usedAbo.has(a._idx))
  type Group = { abonos: AbonoBanco[]; rutNorm: string }
  const groups: Record<string, Group> = {}
  for (const a of unmatched1) {
    const ruts = resolveRuts(a)
    for (const rut of ruts) {
      const key = `${rut}|${a.mes}`
      if (!groups[key]) groups[key] = { abonos: [], rutNorm: rut }
      groups[key].abonos.push(a)
    }
  }
  for (const { abonos: grp, rutNorm: rutKey } of Object.values(groups)) {
    for (let i = 0; i < grp.length; i++) {
      for (let j = i + 1; j < grp.length; j++) {
        const a1 = grp[i], a2 = grp[j]
        if (usedAbo.has(a1._idx) || usedAbo.has(a2._idx)) continue
        const sum = a1.monto + a2.monto
        const fac = facturas.find(f =>
          !usedFac.has(f.id) && f.rutNorm === rutKey && f.monto_bruto === sum
        )
        if (!fac) continue
        const [first, second] = a1.fecha <= a2.fecha ? [a1, a2] : [a2, a1]
        matches.push({ kind: 'doble', abono1: first, abono2: second, factura: fac, _sel: true })
        usedFac.add(fac.id)
        usedAbo.add(a1._idx)
        usedAbo.add(a2._idx)
      }
    }
  }

  // Phase 3: partial payment (monto < monto_bruto)
  for (const abono of abonos) {
    if (usedAbo.has(abono._idx)) continue
    const ruts = resolveRuts(abono)
    if (ruts.length === 0) {
      if (!alerts.some(a => a.abono._idx === abono._idx))
        alerts.push({ abono, motivo: 'Sin coincidencia — RUT no identificado' })
      usedAbo.add(abono._idx)
      continue
    }
    const partials = facturas.filter(f =>
      !usedFac.has(f.id) && ruts.includes(f.rutNorm) && f.monto_bruto > abono.monto
    )
    if (partials.length === 1) {
      matches.push({ kind: 'parcial', abono, factura: partials[0], remainder: partials[0].monto_bruto - abono.monto, _sel: true })
      usedFac.add(partials[0].id)
      usedAbo.add(abono._idx)
    } else if (partials.length > 1) {
      alerts.push({ abono, motivo: `Pago parcial ambiguo: ${partials.length} facturas posibles para mismo RUT` })
      usedAbo.add(abono._idx)
    } else {
      alerts.push({ abono, motivo: `Sin coincidencia exacta (${fmtCLP(abono.monto)})` })
      usedAbo.add(abono._idx)
    }
  }

  return { matches, alerts }
}

// ── COMPONENT ────────────────────────────────────────────────────────────────
export default function ActualizarEstadoFacturas() {
  const [step, setStep] = useState<'upload'|'matching'|'preview'|'uploading'|'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [mode, setMode] = useState<'prueba'|'produccion'>('prueba')
  const [jsonPreview, setJsonPreview] = useState<object | null>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [result, setResult] = useState<ApplyResult | null>(null)
  const jsonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (jsonPreview && jsonRef.current)
      jsonRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [jsonPreview])

  const toggleMatch = (i: number) =>
    setMatches(prev => prev.map((m, idx) => idx === i ? { ...m, _sel: !m._sel } : m))
  const toggleAll = () => {
    const allOn = matches.every(m => m._sel)
    setMatches(prev => prev.map(m => ({ ...m, _sel: !allOn })))
  }

  const processFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = async (e) => {
      setStep('matching')
      const wb = XLSX.read(e.target!.result as ArrayBuffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
      const abonos = parseCartola(file.name, raw)

      // Fetch Emitida facturas from Supabase
      const { data: ventasData } = await supabase
        .from('ventas')
        .select('id, folio, rut_cliente, cliente, monto_bruto, fecha_emision, mes_economico, ano_eco, fecha_pago, fecha_vencimiento, cuenta_cble, descripcion_cta')
        .eq('empresa_id', EMPRESA_ID)
        .eq('estado', 'Emitida')

      const facturas: FacturaEmitida[] = (ventasData ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        folio: (r.folio as string) ?? '',
        rut_cliente: (r.rut_cliente as string) ?? '',
        rutNorm: normRut((r.rut_cliente as string) ?? ''),
        cliente: (r.cliente as string) ?? '',
        monto_bruto: r.monto_bruto as number,
        fecha_emision: (r.fecha_emision as string) ?? '',
        mes_economico: (r.mes_economico as string) ?? '',
        ano_eco: r.ano_eco as number,
        fecha_pago: (r.fecha_pago as string) ?? null,
        fecha_vencimiento: (r.fecha_vencimiento as string) ?? null,
        cuenta_cble: (r.cuenta_cble as string) ?? '5101-01',
        descripcion_cta: (r.descripcion_cta as string) ?? 'VENTAS',
      }))

      // Fetch alias catalog (may not exist)
      let aliases: AliasEntry[] = []
      try {
        const { data: aliasData } = await supabase
          .from('Catalogo_Clientes')
          .select('rut, cliente, descripcion_movimiento')
        aliases = (aliasData ?? []).map((a: Record<string, unknown>) => ({
          rut: (a.rut as string) ?? '',
          cliente: (a.cliente as string) ?? '',
          desc_mov: ((a.descripcion_movimiento ?? a.descripcion ?? a.desc_movimiento) as string) ?? '',
        }))
      } catch { /* table may not exist yet */ }

      const { matches: m, alerts: al } = runMatching(abonos, facturas, aliases)
      setMatches(m)
      setAlerts(al)
      setStep('preview')
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0])
  }, [processFile])

  function buildOperations(selMatches: Match[]) {
    const updates: object[] = []
    const inserts: object[] = []
    for (const m of selMatches) {
      if (m.kind === 'simple') {
        updates.push({ id: m.factura.id, folio: m.factura.folio, cliente: m.factura.cliente, estado: 'Pagada', fecha_pago: m.abono.fecha })
      } else if (m.kind === 'doble') {
        updates.push({ id: m.factura.id, folio: m.factura.folio, cliente: m.factura.cliente, estado: 'Pagada', fecha_pago: m.abono2.fecha, nota: `Dos pagos: ${m.abono1.fecha} + ${m.abono2.fecha}` })
      } else {
        updates.push({ id: m.factura.id, folio: m.factura.folio, cliente: m.factura.cliente, estado: 'Pagada_parcial', fecha_pago: m.abono.fecha, monto_bruto: m.abono.monto })
        inserts.push({ folio: m.factura.folio, cliente: m.factura.cliente, estado: 'Emitida', monto_bruto: m.remainder, mes_economico: m.factura.mes_economico, nota: 'Saldo pendiente cross-mes' })
      }
    }
    return { updates, inserts }
  }

  const handleApply = async () => {
    const selMatches = matches.filter(m => m._sel)
    if (mode === 'prueba') {
      setJsonPreview(buildOperations(selMatches))
      setJsonOpen(true)
      return
    }

    setStep('uploading')
    const res: ApplyResult = { updated: 0, inserted: 0, errors: [] }

    for (const m of selMatches) {
      try {
        if (m.kind === 'simple') {
          const { error } = await supabaseAdmin
            .from('ventas').update({ estado: 'Pagada', fecha_pago: m.abono.fecha }).eq('id', m.factura.id)
          if (error) res.errors.push(`Folio ${m.factura.folio}: ${error.message}`)
          else res.updated++

        } else if (m.kind === 'doble') {
          const { error } = await supabaseAdmin
            .from('ventas').update({ estado: 'Pagada', fecha_pago: m.abono2.fecha }).eq('id', m.factura.id)
          if (error) res.errors.push(`Folio ${m.factura.folio}: ${error.message}`)
          else res.updated++

        } else {
          // Pagada_parcial: update original + insert remainder
          const { error: e1 } = await supabaseAdmin
            .from('ventas').update({ estado: 'Pagada_parcial', fecha_pago: m.abono.fecha, monto_bruto: m.abono.monto }).eq('id', m.factura.id)
          if (e1) { res.errors.push(`Folio ${m.factura.folio} (parcial): ${e1.message}`); continue }
          res.updated++

          const { error: e2 } = await supabaseAdmin.from('ventas').insert({
            empresa_id: EMPRESA_ID,
            cuenta_cble: m.factura.cuenta_cble,
            descripcion_cta: m.factura.descripcion_cta,
            folio: m.factura.folio,
            rut_cliente: m.factura.rut_cliente,
            cliente: m.factura.cliente,
            monto_bruto: m.remainder,
            fecha_emision: m.factura.fecha_emision,
            fecha_vencimiento: m.factura.fecha_vencimiento || null,
            estado: 'Emitida',
            mes_economico: m.factura.mes_economico,
            ano_eco: m.factura.ano_eco,
          })
          if (e2) res.errors.push(`Folio ${m.factura.folio} (saldo): ${e2.message}`)
          else res.inserted++
        }
      } catch (ex: unknown) {
        res.errors.push(`Folio ${(m as MatchSimple).factura.folio}: ${String(ex)}`)
      }
    }

    setResult(res)
    setStep('done')
  }

  const reset = () => {
    setStep('upload'); setFileName(''); setMatches([]); setAlerts([])
    setMode('prueba'); setJsonPreview(null); setResult(null); setJsonOpen(false)
  }

  const selMatches = matches.filter(m => m._sel)
  const allOn = matches.length > 0 && matches.every(m => m._sel)

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-bold text-nl-text tracking-tight">Cambio de Estado de Facturas</h1>
        <p className="mt-1 text-[13px] font-body text-nl-500">
          Importa la cartola bancaria (.xlsx Santander) y actualiza el estado de las facturas emitidas que ya fueron pagadas.
        </p>
      </div>

      {/* ── UPLOAD ── */}
      {step === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('ef-file')?.click()}
          className={`border-2 border-dashed rounded-card p-16 text-center cursor-pointer transition-all duration-200 ${
            dragging
              ? 'border-violet-500 bg-violet-50/30'
              : 'border-nl-border-ui bg-nl-white hover:border-violet-400/50 hover:bg-violet-50/10'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              dragging ? 'bg-violet-500 text-white' : 'bg-nl-bg text-nl-400'
            }`}>
              <Upload size={26} />
            </div>
            <div>
              <p className={`text-[15px] font-semibold font-body transition-colors ${dragging ? 'text-violet-600' : 'text-nl-text'}`}>
                {dragging ? 'Suelta aquí el archivo' : 'Arrastra la cartola .xlsx de Santander'}
              </p>
              <p className="text-[12px] text-nl-400 mt-1">
                CartolaHistCtaCte (datos fila 17) · CartolaProvisoria (datos fila 14)
              </p>
            </div>
            <div className="mt-2 px-4 py-2 bg-violet-600 text-white text-[12px] font-semibold rounded-input">
              Seleccionar archivo
            </div>
          </div>
          <input
            id="ef-file" type="file" accept=".xlsx" className="hidden"
            onClick={e => e.stopPropagation()}
            onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]) }}
          />
        </div>
      )}

      {/* ── MATCHING (loading) ── */}
      {step === 'matching' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-[13px] font-body text-nl-500">Leyendo cartola y buscando coincidencias en Supabase…</p>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && (
        <>
          {/* File bar */}
          <div className="flex items-center justify-between gap-4 p-4 bg-nl-white rounded-card border border-nl-border-soft flex-wrap">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={18} className="text-violet-600 shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-nl-text">{fileName}</p>
                <p className="text-[11px] font-mono text-nl-400 mt-0.5">
                  {matches.length} coincidencias encontradas
                  {alerts.length > 0 && (
                    <span className="ml-2 text-amber-600">· {alerts.length} sin coincidencia</span>
                  )}
                </p>
              </div>
            </div>
            <button onClick={reset} className="flex items-center gap-1.5 text-[12px] text-nl-500 hover:text-nl-text transition-colors">
              <RotateCcw size={13} /> Nueva cartola
            </button>
          </div>

          {/* No matches */}
          {matches.length === 0 && alerts.length === 0 && (
            <div className="p-8 text-center rounded-card border border-nl-border-soft bg-nl-white">
              <p className="text-[14px] font-body text-nl-500">No se encontraron abonos en esta cartola.</p>
            </div>
          )}

          {/* Matches table */}
          {matches.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-violet-600">
                  → ventas · cambio de estado
                </span>
                <span className="text-[10px] font-mono text-nl-400">{selMatches.length}/{matches.length} seleccionados</span>
              </div>
              <div className="rounded-card border border-nl-border-soft overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-nl-bg border-b border-nl-border-soft">
                      <th className="px-3 py-2.5 text-left w-8">
                        <button
                          onClick={toggleAll}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            allOn ? 'bg-violet-600 border-violet-600' : 'border-nl-border-ui bg-nl-white'
                          }`}
                        >
                          {allOn && <span className="text-[8px] text-white font-bold">✓</span>}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Tipo</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Abono cartola</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Factura matcheada</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Monto</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m, i) => (
                      <tr
                        key={i}
                        onClick={() => toggleMatch(i)}
                        className={`cursor-pointer border-b border-nl-border-soft last:border-0 transition-opacity ${
                          m._sel ? 'opacity-100' : 'opacity-35'
                        } ${i % 2 === 0 ? 'bg-nl-white' : 'bg-nl-bg/40'} hover:bg-violet-50/30`}
                      >
                        <td className="px-3 py-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            m._sel ? 'bg-violet-600 border-violet-600' : 'border-nl-border-ui bg-nl-white'
                          }`}>
                            {m._sel && <span className="text-[8px] text-white font-bold">✓</span>}
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          {m.kind === 'simple' && (
                            <span className="font-mono text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">Pagada</span>
                          )}
                          {m.kind === 'doble' && (
                            <span className="font-mono text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">2 pagos</span>
                          )}
                          {m.kind === 'parcial' && (
                            <span className="flex items-center gap-0.5 font-mono text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded w-fit">
                              <Scissors size={9} />Parcial
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2">
                          {m.kind === 'simple' && (
                            <>
                              <p className="font-mono text-nl-500">{m.abono.fecha}</p>
                              <p className="text-nl-400 text-[11px] max-w-[200px] truncate" title={m.abono.descripcion}>
                                {m.abono.descripcion}
                              </p>
                            </>
                          )}
                          {m.kind === 'doble' && (
                            <>
                              <p className="font-mono text-nl-500">{m.abono1.fecha} + {m.abono2.fecha}</p>
                              <p className="text-nl-400 text-[11px] max-w-[200px] truncate" title={m.abono1.descripcion}>
                                {m.abono1.descripcion}
                              </p>
                            </>
                          )}
                          {m.kind === 'parcial' && (
                            <>
                              <p className="font-mono text-nl-500">{m.abono.fecha}</p>
                              <p className="text-nl-400 text-[11px] max-w-[200px] truncate" title={m.abono.descripcion}>
                                {m.abono.descripcion}
                              </p>
                            </>
                          )}
                        </td>

                        <td className="px-3 py-2">
                          <p className="font-medium text-nl-text">{m.factura.cliente}</p>
                          <p className="font-mono text-[11px] text-nl-400">Folio {m.factura.folio}</p>
                        </td>

                        <td className="px-3 py-2 text-right font-mono font-semibold text-violet-600">
                          {m.kind === 'simple'  && fmtCLP(m.abono.monto)}
                          {m.kind === 'doble'   && fmtCLP(m.abono1.monto + m.abono2.monto)}
                          {m.kind === 'parcial' && (
                            <span>
                              {fmtCLP(m.abono.monto)}
                              <span className="block text-[10px] text-nl-400 font-normal">saldo: {fmtCLP(m.remainder)}</span>
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2">
                          {m.kind === 'simple' && (
                            <span className="text-[11px] font-mono text-violet-600">
                              Emitida → Pagada
                              <span className="block text-nl-400">{m.abono.fecha}</span>
                            </span>
                          )}
                          {m.kind === 'doble' && (
                            <span className="text-[11px] font-mono text-blue-600">
                              Emitida → Pagada
                              <span className="block text-nl-400">fecha_pago: {m.abono2.fecha}</span>
                            </span>
                          )}
                          {m.kind === 'parcial' && (
                            <span className="text-[11px] font-mono text-amber-600">
                              → Pagada_parcial + nueva Emitida
                              <span className="block text-nl-400">{fmtCLP(m.abono.monto)} + {fmtCLP(m.remainder)}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-600">
                  Sin coincidencia — revisión manual
                </span>
                <span className="text-[10px] font-mono text-nl-400">{alerts.length} abonos</span>
              </div>
              <div className="rounded-card border border-amber-200 overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-200">
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-amber-700 uppercase tracking-[0.1em]">Fecha</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-amber-700 uppercase tracking-[0.1em]">Descripción</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] text-amber-700 uppercase tracking-[0.1em]">Monto</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-amber-700 uppercase tracking-[0.1em]">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((al, i) => (
                      <tr key={i} className={`border-b border-amber-100 last:border-0 ${i % 2 === 0 ? 'bg-nl-white' : 'bg-amber-50/40'}`}>
                        <td className="px-3 py-2 font-mono text-nl-500">{al.abono.fecha}</td>
                        <td className="px-3 py-2 text-nl-500 max-w-[240px] truncate" title={al.abono.descripcion}>{al.abono.descripcion}</td>
                        <td className="px-3 py-2 text-right font-mono text-nl-text">{fmtCLP(al.abono.monto)}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1 text-[11px] text-amber-700">
                            <AlertTriangle size={11} />{al.motivo}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          {matches.length > 0 && (
            <div className="flex items-center gap-4 pt-2 flex-wrap">
              <div className="flex items-center bg-nl-bg rounded-pill border border-nl-border-soft p-0.5">
                <button
                  onClick={() => { setMode('prueba'); setJsonPreview(null) }}
                  className={`px-4 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${
                    mode === 'prueba' ? 'bg-nl-white text-violet-600 shadow-card' : 'text-nl-500 hover:text-nl-text'
                  }`}
                >
                  Modo prueba
                </button>
                <button
                  onClick={() => { setMode('produccion'); setJsonPreview(null) }}
                  className={`px-4 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${
                    mode === 'produccion' ? 'bg-nl-white text-nl-accent shadow-card' : 'text-nl-500 hover:text-nl-text'
                  }`}
                >
                  Modo producción
                </button>
              </div>
              <button
                onClick={handleApply}
                disabled={selMatches.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-input text-[13px] font-semibold transition-all ${
                  selMatches.length === 0
                    ? 'bg-nl-border-ui text-nl-400 cursor-not-allowed'
                    : mode === 'produccion'
                      ? 'bg-nl-accent text-white hover:opacity-90'
                      : 'bg-violet-600 text-white hover:opacity-90'
                }`}
              >
                {mode === 'prueba' ? 'Ver JSON' : 'Aplicar cambios en Supabase'}
                <span className="font-mono text-[11px] opacity-80">({selMatches.length} facturas)</span>
              </button>
            </div>
          )}

          {/* JSON preview */}
          {jsonPreview && (
            <div ref={jsonRef} className="rounded-card border border-nl-border-soft overflow-hidden">
              <button
                onClick={() => setJsonOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-nl-bg hover:bg-violet-50/30 transition-colors"
              >
                <span className="text-[12px] font-mono font-semibold text-violet-600">
                  JSON preview — {selMatches.length} facturas a modificar
                </span>
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
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-[13px] font-body text-nl-500">Aplicando cambios en Supabase…</p>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && result && (
        <>
          <div className={`rounded-card border p-6 ${result.errors.length > 0 ? 'border-nl-danger/30 bg-nl-danger/5' : 'border-violet-200 bg-violet-50/40'}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.errors.length > 0
                ? <AlertCircle size={16} className="text-nl-danger" />
                : <CheckCircle size={16} className="text-violet-600" />}
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-nl-500">resultado</span>
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-[28px] font-body font-bold tabular-nums text-nl-text">{result.updated}</p>
                <p className="text-[12px] text-nl-500">facturas actualizadas</p>
              </div>
              {result.inserted > 0 && (
                <div>
                  <p className="text-[28px] font-body font-bold tabular-nums text-nl-text">{result.inserted}</p>
                  <p className="text-[12px] text-nl-500">filas nuevas insertadas (saldos)</p>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-[11px] font-mono text-nl-danger">
                    <ShieldAlert size={10} className="inline mr-1" />{e}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-input text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            <RotateCcw size={14} /> Nueva cartola
          </button>
        </>
      )}
    </div>
  )
}
