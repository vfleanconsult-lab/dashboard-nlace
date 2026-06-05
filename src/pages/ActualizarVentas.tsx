import { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, FileText, RotateCcw, ChevronDown, ChevronUp, ShieldAlert, Info } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://orjufhwfepojfiqejhfc.supabase.co'
const SERVICE_KEY  = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
const supabaseAdmin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : supabase

const EMPRESA_ID     = '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a'
const CUENTA_CBLE    = '5101-01'
const DESCRIPCION_CTA = 'VENTAS'

const _now = new Date()
const NOW_MONTH = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`

// ── TYPES ──────────────────────────────────────────────────────────────────────
type VentaRow = {
  _idx: number
  fecha_emision: string       // YYYY-MM-DD
  folio: string
  rut_cliente: string
  cliente: string
  monto_bruto: number
  estado: string
  fecha_vencimiento: string   // YYYY-MM-DD or ''
  tipo_doc: string            // FAC-EL | FAC-EXPE | N/C-EL | ...
  mes_economico: string       // YYYY-MM
  ano_eco: number
  isNcAnterior: boolean
  isAutoExcluded: boolean
}

type TableResult = { inserted: number; skipped: number; errors: { folio: string; error: string }[] }

// ── CSV HELPERS ────────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ';' && !inQuotes) { cells.push(current.trim()); current = '' }
    else { current += ch }
  }
  cells.push(current.trim())
  return cells
}

function parseDateCL(s: string): string {
  if (!s) return ''
  const t = s.trim()
  const p = t.split(/[\/\-]/)
  if (p.length === 3 && p[2].length === 4) {
    return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
  }
  if (p.length === 3 && p[0].length === 4) return t
  return t
}

function parseMonto(s: string): number {
  const clean = s.replace(/[$\s ]/g, '').trim()
  return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
}

function mapEstado(s: string): string {
  const u = s.trim().toUpperCase()
  if (u === 'EMITIDO') return 'Emitida'
  if (u === 'PAGADO') return 'Pagada'
  if (u === 'PAGADO PARCIAL') return 'Pagada_parcial'
  if (u === 'ANULADO') return 'Anulada'
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// Normaliza RUT para comparación: elimina puntos, trim, uppercase
// "76.229.620-9" == "76229620-9" == "76229620-9 "
const normRut = (s: string) => (s ?? '').replace(/\./g, '').trim().toUpperCase()
const normFolio = (s: string) => (s ?? '').trim()
const fpKey = (folio: string, fecha: string, rut: string) =>
  `${normFolio(folio)}|${fecha}|${normRut(rut)}`

function shortMonthLabel(yyyyMM: string): string {
  if (!yyyyMM) return ''
  const [y, m] = yyyyMM.split('-')
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${names[parseInt(m) - 1] ?? m}-${y.slice(2)}`
}

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

// ── COMPONENT ──────────────────────────────────────────────────────────────────
export default function ActualizarVentas() {
  const [step, setStep]           = useState<'upload' | 'preview' | 'uploading' | 'done'>('upload')
  const [dragging, setDragging]   = useState(false)
  const [fileName, setFileName]   = useState('')
  // allParsed: todos los registros del CSV (sin filtro de mes)
  const [allParsed, setAllParsed] = useState<VentaRow[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState(NOW_MONTH)
  // mainRows/excRows: derivados de allParsed filtrado por selectedMonth
  const [mainRows, setMainRows]   = useState<VentaRow[]>([])
  const [excRows, setExcRows]     = useState<VentaRow[]>([])
  const [otherCount, setOtherCount] = useState(0)
  const [selected, setSelected]   = useState<Record<number, boolean>>({})
  const [dupeKeys, setDupeKeys]   = useState<Set<string>>(new Set())
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

  // Recalcular filas visibles cuando cambia el mes seleccionado
  useEffect(() => {
    if (allParsed.length === 0) return

    const filtered = allParsed
      .filter(r => r.mes_economico === selectedMonth)
      .map(r => ({ ...r, isNcAnterior: false, isAutoExcluded: false }))

    setOtherCount(allParsed.length - filtered.length)

    // Lógica N/C: par N/C ↔ FAC mismo mes/cliente/monto → excluir ambos
    const autoExcludeSet = new Set<number>()
    const ncList = filtered.filter(r => r.tipo_doc === 'N/C-EL')
    const facList = filtered.filter(r => r.tipo_doc !== 'N/C-EL')

    for (const nc of ncList) {
      // Todas las FAC con mismo cliente y monto (puede haber varias si una fue anulada y reemitida)
      const candidates = facList.filter(f =>
        !autoExcludeSet.has(f._idx) &&
        f.cliente === nc.cliente &&
        Math.round(Math.abs(f.monto_bruto)) === Math.round(Math.abs(nc.monto_bruto))
      )
      if (candidates.length > 0) {
        // La N/C cancela la FAC de MENOR folio (la original anulada).
        // La FAC de mayor folio es la de reemplazo y debe quedar para cargar.
        const parseF = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0
        const cancelled = candidates.reduce((min, f) =>
          parseF(f.folio) < parseF(min.folio) ? f : min
        )
        autoExcludeSet.add(nc._idx)
        autoExcludeSet.add(cancelled._idx)
      } else {
        nc.isNcAnterior = true
      }
    }

    filtered.forEach(r => { if (autoExcludeSet.has(r._idx)) r.isAutoExcluded = true })

    const main = filtered.filter(r => !r.isAutoExcluded)
    const excl = filtered.filter(r => r.isAutoExcluded)

    setMainRows(main)
    setExcRows(excl)
    // Reset estado de selección y duplicados al cambiar el mes
    const sel: Record<number, boolean> = {}
    main.forEach(r => { sel[r._idx] = true })
    setSelected(sel)
    setDupeKeys(new Set())
    setCheckingDupes(false)
    setJsonPreview(null)
  }, [allParsed, selectedMonth])

  // Verificar duplicados en Supabase — huella normalizada: folio|fecha_emision|rut_cliente
  // Consulta el mes completo (no solo el rango del CSV) para no perder registros
  // cargados con fecha diferente. Normaliza RUT para tolerar diferencias de formato.
  useEffect(() => {
    if (mainRows.length === 0) return
    setCheckingDupes(true)
    const [y, m] = selectedMonth.split('-').map(Number)
    const fechaMin = `${selectedMonth}-01`
    const fechaMax = `${selectedMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    ;(async () => {
      const { data } = await supabase
        .from('ventas')
        .select('folio, fecha_emision, rut_cliente')
        .gte('fecha_emision', fechaMin)
        .lte('fecha_emision', fechaMax)
      const fp = new Set<string>(
        (data ?? []).map((r: { folio: string; fecha_emision: string; rut_cliente: string }) =>
          fpKey(r.folio, r.fecha_emision, r.rut_cliente)
        )
      )
      setDupeKeys(fp)
      if (fp.size > 0) {
        setSelected(prev => {
          const n = { ...prev }
          mainRows.forEach(r => {
            if (fp.has(fpKey(r.folio, r.fecha_emision, r.rut_cliente))) n[r._idx] = false
          })
          return n
        })
      }
      setCheckingDupes(false)
    })()
  }, [mainRows, selectedMonth])

  const processFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target!.result as ArrayBuffer
      let text: string
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      } catch {
        text = new TextDecoder('iso-8859-1').decode(buffer)
      }
      const content = text.replace(/^﻿/, '')
      const lines = content.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) return

      const headers = parseCSVLine(lines[0]).map(h => h.trim())
      const normH = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')
      const col = (name: string) => headers.findIndex(h => normH(h) === normH(name))

      const iF   = col('fecha')
      const iFol = col('folio')
      const iRut = col('rut cliente')
      const iCli = col('cliente')
      const iMon = col('monto total')
      const iEst = col('estado')
      const iFve = col('fecha vencimiento')
      const iDoc = col('documento')

      const parsed: VentaRow[] = []
      let idx = 0

      for (const line of lines.slice(1)) {
        const cells = parseCSVLine(line)
        if (!cells.some(c => c)) continue

        const fechaEmision = parseDateCL(iF >= 0 ? cells[iF] ?? '' : '')
        if (!fechaEmision) continue

        const folio        = iFol >= 0 ? cells[iFol] ?? '' : ''
        const rutCliente   = iRut >= 0 ? cells[iRut] ?? '' : ''
        const cliente      = iCli >= 0 ? cells[iCli] ?? '' : ''
        const monto_bruto  = iMon >= 0 ? Math.abs(parseMonto(cells[iMon] ?? '')) : 0
        const estado       = mapEstado(iEst >= 0 ? cells[iEst] ?? '' : '')
        const fechaVenc    = parseDateCL(iFve >= 0 ? cells[iFve] ?? '' : '')
        const tipoDoc      = iDoc >= 0 ? cells[iDoc] ?? '' : ''

        const d = new Date(fechaEmision + 'T00:00:00')
        const anoEco = d.getFullYear()
        const mes    = d.getMonth() + 1
        const mesEconomico = `${anoEco}-${String(mes).padStart(2, '0')}`

        parsed.push({
          _idx: idx++,
          fecha_emision: fechaEmision,
          folio, rut_cliente: rutCliente, cliente,
          monto_bruto, estado,
          fecha_vencimiento: fechaVenc,
          tipo_doc: tipoDoc,
          mes_economico: mesEconomico,
          ano_eco: anoEco,
          isNcAnterior: false,
          isAutoExcluded: false,
        })
      }

      // Meses disponibles en el archivo, orden descendente
      const months = [...new Set(parsed.map(r => r.mes_economico))].filter(Boolean).sort().reverse()
      // Por defecto: mes actual si hay datos, si no el más reciente
      const defaultMonth = months.includes(NOW_MONTH) ? NOW_MONTH : months[0] ?? NOW_MONTH

      setAllParsed(parsed)
      setAvailableMonths(months)
      setSelectedMonth(defaultMonth)
      setStep('preview')
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0])
  }, [processFile])

  const toggleRow = (idx: number) => setSelected(p => ({ ...p, [idx]: !p[idx] }))
  const isDupe    = (r: VentaRow) => dupeKeys.has(fpKey(r.folio, r.fecha_emision, r.rut_cliente))

  const toggleAll = () => {
    const selectableRows = mainRows.filter(r => !isDupe(r))
    const allOn = selectableRows.every(r => selected[r._idx])
    setSelected(p => { const n = { ...p }; selectableRows.forEach(r => { n[r._idx] = !allOn }); return n })
  }

  const selRows   = mainRows.filter(r => selected[r._idx] && !isDupe(r))
  const dupeCount = mainRows.filter(isDupe).length
  const allOn     = mainRows.filter(r => !isDupe(r)).length > 0 && mainRows.filter(r => !isDupe(r)).every(r => selected[r._idx])
  const ncAntCount = mainRows.filter(r => r.isNcAnterior).length

  function buildRow(r: VentaRow) {
    return {
      empresa_id:        EMPRESA_ID,
      cuenta_cble:       CUENTA_CBLE,
      descripcion_cta:   DESCRIPCION_CTA,
      folio:             r.folio,
      rut_cliente:       r.rut_cliente,
      cliente:           r.cliente,
      monto_bruto:       r.monto_bruto,
      fecha_emision:     r.fecha_emision,
      fecha_vencimiento: r.fecha_vencimiento || null,
      estado:            r.estado,
      mes_economico:     r.mes_economico,
      ano_eco:           r.ano_eco,
    }
  }

  const handleUpload = async () => {
    if (mode === 'prueba') {
      setJsonPreview(selRows.map(buildRow))
      setJsonOpen(true)
      return
    }
    setStep('uploading')
    const res: TableResult = { inserted: 0, skipped: 0, errors: [] }
    for (const row of selRows) {
      const { error } = await supabaseAdmin.from('ventas').insert(buildRow(row))
      if (error) {
        if (error.code === '23505') res.skipped++
        else res.errors.push({ folio: row.folio, error: error.message })
      } else res.inserted++
    }
    setResult(res)
    setStep('done')
  }

  const reset = () => {
    setStep('upload'); setFileName('')
    setAllParsed([]); setAvailableMonths([]); setSelectedMonth(NOW_MONTH)
    setMainRows([]); setExcRows([]); setOtherCount(0)
    setSelected({}); setDupeKeys(new Set()); setCheckingDupes(false)
    setJsonPreview(null); setResult(null); setJsonOpen(false)
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-bold text-nl-text tracking-tight">Cargar Ventas</h1>
        <p className="mt-1 text-[13px] font-body text-nl-500">
          Importa el reporte de ventas (.csv Nubox) y registra las facturas del mes seleccionado en Supabase.
        </p>
      </div>

      {/* ── UPLOAD ── */}
      {step === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('vi-file')?.click()}
          className={`border-2 border-dashed rounded-card p-16 text-center cursor-pointer transition-all duration-200 ${
            dragging
              ? 'border-nl-success-dark bg-green-50/30'
              : 'border-nl-border-ui bg-nl-white hover:border-nl-success-dark/50 hover:bg-green-50/10'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              dragging ? 'bg-nl-success-dark text-white' : 'bg-nl-bg text-nl-400'
            }`}>
              <Upload size={26} />
            </div>
            <div>
              <p className={`text-[15px] font-semibold font-body transition-colors ${dragging ? 'text-nl-success-dark' : 'text-nl-text'}`}>
                {dragging ? 'Suelta aquí el archivo' : 'Arrastra el reporte .csv de Nubox'}
              </p>
              <p className="text-[12px] text-nl-400 mt-1">
                Separador punto y coma (;) · trae toda la historia · se filtra por mes
              </p>
            </div>
            <div className="mt-2 px-4 py-2 bg-nl-success-dark text-white text-[12px] font-semibold rounded-input">
              Seleccionar archivo
            </div>
          </div>
          <input
            id="vi-file" type="file" className="hidden"
            accept=".csv,text/csv"
            onClick={e => e.stopPropagation()}
            onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]) }}
          />
        </div>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && (
        <>
          {/* File bar */}
          <div className="flex items-center justify-between gap-4 p-4 bg-nl-white rounded-card border border-nl-border-soft flex-wrap">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-nl-success-dark shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-nl-text">{fileName}</p>
                <p className="text-[11px] font-mono text-nl-400 mt-0.5">
                  {allParsed.length} registros en el archivo
                  {otherCount > 0 && <span> · {otherCount} de otros meses descartados</span>}
                  {checkingDupes && <span className="ml-2 text-nl-success-dark animate-pulse">· verificando duplicados…</span>}
                  {!checkingDupes && dupeCount > 0 && <span className="ml-2 text-nl-danger"> · {dupeCount} ya existen en BD</span>}
                </p>
              </div>
            </div>

            {/* Selector de mes */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-nl-500">Mes a cargar:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="font-mono text-[12px] border border-nl-border-ui rounded px-2 py-1 bg-nl-white text-nl-text focus:outline-none focus:ring-1 focus:ring-nl-success-dark"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {shortMonthLabel(m)}{m === NOW_MONTH ? ' (mes actual)' : ''}
                  </option>
                ))}
              </select>
              <button onClick={reset} className="flex items-center gap-1.5 text-[12px] text-nl-500 hover:text-nl-text transition-colors ml-2">
                <RotateCcw size={13} /> Nuevo archivo
              </button>
            </div>
          </div>

          {/* Badges de contexto */}
          {(excRows.length > 0 || ncAntCount > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              {excRows.length > 0 && (
                <span className="text-[11px] font-mono text-nl-400 bg-nl-bg px-3 py-1 rounded-pill border border-nl-border-soft">
                  {Math.floor(excRows.length / 2)} par{Math.floor(excRows.length / 2) !== 1 ? 'es' : ''} N/C ↔ FAC excluidos automáticamente
                </span>
              )}
              {ncAntCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-amber-700 bg-amber-100 px-3 py-1 rounded-pill">
                  <Info size={11} />{ncAntCount} nota{ncAntCount !== 1 ? 's' : ''} de crédito — factura mes anterior
                </span>
              )}
            </div>
          )}

          {/* Sin registros para el mes */}
          {mainRows.length === 0 && excRows.length === 0 && (
            <div className="p-8 text-center rounded-card border border-nl-border-soft bg-nl-white">
              <p className="text-[14px] font-body text-nl-500">
                No hay registros para <span className="font-semibold text-nl-text">{shortMonthLabel(selectedMonth)}</span> en este archivo.
              </p>
              <p className="text-[12px] text-nl-400 mt-1">Selecciona otro mes en el selector superior.</p>
            </div>
          )}

          {/* Tabla principal */}
          {mainRows.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-nl-success-dark">
                  → ventas · {shortMonthLabel(selectedMonth)}
                </span>
                <span className="text-[10px] font-mono text-nl-400">{selRows.length}/{mainRows.length} seleccionados</span>
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
                        <button
                          onClick={toggleAll}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            allOn ? 'bg-nl-success-dark border-nl-success-dark' : 'border-nl-border-ui bg-nl-white'
                          }`}
                        >
                          {allOn && <span className="text-[8px] text-white font-bold">✓</span>}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Fecha emisión</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Folio</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Tipo</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Cliente</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Estado</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainRows.map((r, i) => {
                      const dupe = isDupe(r)
                      return (
                        <tr
                          key={r._idx}
                          onClick={() => { if (!dupe) toggleRow(r._idx) }}
                          className={`border-b border-nl-border-soft last:border-0 transition-opacity ${
                            dupe ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                          } ${
                            selected[r._idx] && !dupe ? 'opacity-100' : dupe ? '' : 'opacity-35'
                          } ${
                            dupe           ? 'bg-nl-danger/8' :
                            r.isNcAnterior ? 'bg-amber-50/60' :
                            i % 2 === 0    ? 'bg-nl-white' : 'bg-nl-bg/40'
                          } ${!dupe ? 'hover:bg-green-50/40' : ''}`}
                        >
                          <td className="px-3 py-2">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              dupe
                                ? 'border-nl-danger/40 bg-nl-danger/10 cursor-not-allowed'
                                : selected[r._idx] ? 'bg-nl-success-dark border-nl-success-dark' : 'border-nl-border-ui bg-nl-white'
                            }`}>
                              {selected[r._idx] && !dupe && <span className="text-[8px] text-white font-bold">✓</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-nl-500">{r.fecha_emision}</td>
                          <td className="px-3 py-2 font-mono text-nl-500">{r.folio}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                r.tipo_doc === 'N/C-EL'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-50 text-nl-success-dark'
                              }`}>
                                {r.tipo_doc || '—'}
                              </span>
                              {r.isNcAnterior && (
                                <span className="flex items-center gap-0.5 text-[9px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                  <Info size={9} />factura mes anterior
                                </span>
                              )}
                              {dupe && (
                                <span className="flex items-center gap-0.5 text-[9px] font-mono font-semibold text-nl-danger bg-nl-danger/10 px-1.5 py-0.5 rounded">
                                  <ShieldAlert size={9} />YA EXISTE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-nl-text block max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap" title={r.cliente}>
                              {r.cliente}
                            </span>
                            <span className="text-[10px] font-mono text-nl-400">{r.rut_cliente}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                              r.estado === 'Pagada'  ? 'bg-green-50 text-nl-success-dark' :
                              r.estado === 'Emitida' ? 'bg-nl-primary-10 text-nl-primary' :
                                                       'bg-nl-bg text-nl-500'
                            }`}>
                              {r.estado}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-nl-success-dark">{fmtCLP(r.monto_bruto)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pares auto-excluidos */}
          {excRows.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-nl-400">Excluidas automáticamente</span>
                <span className="text-[10px] font-mono text-nl-400">
                  {Math.floor(excRows.length / 2)} par{Math.floor(excRows.length / 2) !== 1 ? 'es' : ''} N/C ↔ FAC · mismo cliente y monto en {shortMonthLabel(selectedMonth)}
                </span>
              </div>
              <div className="rounded-card border border-nl-border-soft overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-nl-bg border-b border-nl-border-soft">
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Fecha emisión</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Folio</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Tipo</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Cliente</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excRows.map((r, i) => (
                      <tr key={r._idx} className={`border-b border-nl-border-soft last:border-0 opacity-50 ${i % 2 === 0 ? 'bg-nl-white' : 'bg-nl-bg/40'}`}>
                        <td className="px-3 py-2 font-mono text-nl-500">{r.fecha_emision}</td>
                        <td className="px-3 py-2 font-mono text-nl-500">{r.folio}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-[10px] bg-nl-bg text-nl-400 px-1.5 py-0.5 rounded">{r.tipo_doc || '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-nl-500 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{r.cliente}</td>
                        <td className="px-3 py-2 text-right font-mono text-nl-400">{fmtCLP(r.monto_bruto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          {mainRows.length > 0 && (
            <div className="flex items-center gap-4 pt-2 flex-wrap">
              <div className="flex items-center bg-nl-bg rounded-pill border border-nl-border-soft p-0.5">
                <button
                  onClick={() => { setMode('prueba'); setJsonPreview(null) }}
                  className={`px-4 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${
                    mode === 'prueba' ? 'bg-nl-white text-nl-primary shadow-card' : 'text-nl-500 hover:text-nl-text'
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
                onClick={handleUpload}
                disabled={selRows.length === 0 || checkingDupes}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-input text-[13px] font-semibold transition-all ${
                  selRows.length === 0 || checkingDupes
                    ? 'bg-nl-border-ui text-nl-400 cursor-not-allowed'
                    : mode === 'produccion'
                      ? 'bg-nl-accent text-white hover:opacity-90'
                      : 'bg-nl-success-dark text-white hover:opacity-90'
                }`}
              >
                {mode === 'prueba' ? 'Ver JSON' : 'Subir a Supabase'}
                <span className="font-mono text-[11px] opacity-80">({selRows.length} filas)</span>
              </button>
            </div>
          )}

          {/* JSON preview (modo prueba) */}
          {jsonPreview && (
            <div ref={jsonRef} className="rounded-card border border-nl-border-soft overflow-hidden">
              <button
                onClick={() => setJsonOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-nl-bg hover:bg-green-50/30 transition-colors"
              >
                <span className="text-[12px] font-mono font-semibold text-nl-success-dark">
                  JSON preview — {selRows.length} registros
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
          <div className="w-10 h-10 border-4 border-nl-success-dark/20 border-t-nl-success-dark rounded-full animate-spin" />
          <p className="text-[13px] font-body text-nl-500">Insertando registros en Supabase…</p>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && result && (
        <>
          <div className={`rounded-card border p-6 ${result.errors.length > 0 ? 'border-nl-danger/30 bg-nl-danger/5' : 'border-nl-success/30 bg-nl-success/5'}`}>
            <div className="flex items-center gap-2 mb-1">
              {result.errors.length > 0
                ? <AlertCircle size={16} className="text-nl-danger" />
                : <CheckCircle size={16} className="text-nl-success-dark" />}
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-nl-500">
                → ventas · {shortMonthLabel(selectedMonth)}
              </span>
            </div>
            <p className="text-[28px] font-body font-bold tabular-nums text-nl-text">{result.inserted}</p>
            <p className="text-[12px] text-nl-500">registros insertados</p>
            {result.skipped > 0 && (
              <p className="text-[11px] font-mono text-nl-400 mt-1">{result.skipped} omitidos (ya existían)</p>
            )}
            {result.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-[11px] font-mono text-nl-danger">
                    <span className="opacity-60 truncate block">Folio {e.folio}</span>
                    <span>{e.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 bg-nl-success-dark text-white rounded-input text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            <RotateCcw size={14} /> Nuevo archivo
          </button>
        </>
      )}
    </div>
  )
}
