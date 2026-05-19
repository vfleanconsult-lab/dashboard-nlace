import { useState, useCallback, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, RotateCcw, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Cliente con service_role para INSERTs (bypassa RLS)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://orjufhwfepojfiqejhfc.supabase.co'
const SERVICE_KEY  = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : supabase

// ── CATÁLOGO SOFTWARE ─────────────────────────────────────────────────────────
const CATALOG_SOFTWARE = [
  { proveedor: 'TYPEFORM',     keywords: ['TYPEFORM'],                                     cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null as null, tipo_cuenta: null as null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'CANVA',        keywords: ['CANVA'],                                         cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'LOVABLE',      keywords: ['LOVABLE'],                                       cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'KLINGAI',      keywords: ['KLINGAI.COM', 'KLINGAI'],                        cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'FREEPIK',      keywords: ['FREEPIK PRE', 'FREEPIK PREMI', 'FREEPIK'],       cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'ELEVENLABS',   keywords: ['ELEVENLABS'],                                    cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Google',       keywords: ['GOOGLE *WORKSPACE', 'GOOGLE *CLOUD', 'GOOGLE'],  cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'READ Meeting', keywords: ['READ - MEETING', 'READ MEETING'],                cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Midjourney',   keywords: ['MIDJOURNEY'],                                    cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'HETZNER',      keywords: ['HETZNER'],                                       cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'METRICOOL',    keywords: ['METRICOOL'],                                     cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'OPENAI',       keywords: ['OPENAI'],                                        cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'ANTHROPIC',    keywords: ['ANTHROPIC', 'CLAUDE.AI SUBSCRI', 'CLAUDE.AI'],   cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'DATABOX INC.', keywords: ['DATABOX'],                                       cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'HUBSPOT',      keywords: ['HUBSPOT'],                                       cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'VERCEL',       keywords: ['VERCEL'],                                        cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'FIGMA',        keywords: ['FIGMA'],                                         cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'GODADDY',      keywords: ['GODADDY', 'DNH*GODADDY'],                        cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'CAPSO',        keywords: ['KAPSO', 'CAPSO'],                                cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'CAPCUT',       keywords: ['CAPCUT', 'CUPCUT'],                              cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'FIRECRAWL',    keywords: ['FIRECRAWL'],                                     cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'CLOUDFLARE',   keywords: ['CLOUDFLARE'],                                    cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'SUPABASE',     keywords: ['SUPABASE'],                                      cuenta_cble: '4101-09', descripcion_cta: 'OTROS GASTOS DE EXPLOTACION', clasificacion_cto: 'Costo_Gto_Explot', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
] as const

// ── CATÁLOGO EQUIPO ───────────────────────────────────────────────────────────
const CATALOG_EQUIPO = [
  { proveedor: 'Claudia Barriga',  id_norm: '0160140062', tipo_rel: 'Permanente', cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta' as string | null, clasificacion_gasto: null as string | null, tipo_cuenta: null as string | null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Marcelo Aguila',   id_norm: '016353388K', tipo_rel: 'Permanente', cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Dalila Becerra',   id_norm: '0185226816', tipo_rel: 'Permanente', cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Javiera Loyola',   id_norm: '0199198998', tipo_rel: 'Permanente', cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Felipe Anabalo',   id_norm: '0168008880', tipo_rel: 'Permanente', cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Eduardo Aguayo',   id_norm: '0155895683', tipo_rel: 'Permanente', cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Emy Salazar',      id_norm: '0204963908', tipo_rel: 'Proyecto',   cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Jesus Alfonso',    id_norm: '0266294344', tipo_rel: 'Proyecto',   cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Flamenco Digital', id_norm: '0774478612', tipo_rel: 'Proyecto',   cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Ignacio Cuevas',   id_norm: '0201568757', tipo_rel: 'Proyecto',   cuenta_cble: '4101-01', descripcion_cta: 'COSTO DE VENTA', clasificacion_cto: 'Costo_Vta', clasificacion_gasto: null, tipo_cuenta: null, empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'costos' },
  { proveedor: 'Cristian Labarca', id_norm: '0141742183', tipo_rel: 'Permanente', cuenta_cble: '4401-02', descripcion_cta: 'REMUNERACIONES DIRECTORES', clasificacion_cto: null, clasificacion_gasto: 'Retiros', tipo_cuenta: 'Gasto_Retiro', empresa_id: '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a', tabla: 'remuneraciones' },
]

// ── TYPES ─────────────────────────────────────────────────────────────────────
type CatalogEntry = {
  proveedor: string
  cuenta_cble: string
  descripcion_cta: string
  clasificacion_cto: string | null
  clasificacion_gasto: string | null
  tipo_cuenta: string | null
  empresa_id: string
  tabla: string
}

type ParsedRow = {
  _idx: number
  glosa: string
  fecha: string
  monto_cartola: number
  monto_bd: number
  proveedor: string
  cuenta_cble: string
  descripcion_cta: string
  clasificacion_cto: string | null
  clasificacion_gasto: string | null
  tipo_cuenta: string | null
  empresa_id: string
  tabla: string
  id_modelo: string
  mes_economico: string
  ano_eco: number
  mes: number
}

type UploadTableResult = {
  inserted: number
  skipped: number
  errors: { glosa: string; error: string }[]
}

type UploadResults = {
  costos: UploadTableResult
  remuneraciones: UploadTableResult
}

// ── MATCHING ──────────────────────────────────────────────────────────────────
function matchSoftware(glosa: string): (typeof CATALOG_SOFTWARE)[number] | null {
  const u = glosa.toUpperCase()
  for (const e of CATALOG_SOFTWARE) {
    for (const kw of e.keywords) {
      if (u.includes(kw.toUpperCase())) return e
    }
  }
  return null
}

function matchEquipo(glosa: string): (typeof CATALOG_EQUIPO)[number] | null {
  const u = glosa.toUpperCase().trim()
  for (const e of CATALOG_EQUIPO) {
    if (u.startsWith(e.id_norm.toUpperCase())) return e
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

function buildId(clasificacion_cto: string | null, fecha: string, monto: number, glosa: string): string {
  const d = fecha ? fecha.replace(/-/g, '') : '00000000'
  const m = Math.round(monto)
  const g = glosa.toUpperCase().trim().slice(0, 15)
  return `${clasificacion_cto ?? 'NULL'}_${d}_${m}_${g}`
}

const fmtCLP = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ActualizarCostos() {
  const [step, setStep] = useState<'upload' | 'preview' | 'uploading' | 'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [catRows, setCatRows] = useState<ParsedRow[]>([])
  const [uncat, setUncat] = useState<ParsedRow[]>([])
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set())
  const [checkingDupes, setCheckingDupes] = useState(false)
  const [mode, setMode] = useState<'prueba' | 'produccion'>('prueba')
  const [jsonPreview, setJsonPreview] = useState<Record<string, object[]> | null>(null)
  const [uploadResults, setUploadResults] = useState<UploadResults | null>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const jsonRef = useRef<HTMLDivElement>(null)

  // Scroll al JSON cuando aparece
  useEffect(() => {
    if (jsonPreview && jsonRef.current) {
      jsonRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [jsonPreview])

  // Verificar duplicados en Supabase después de parsear
  useEffect(() => {
    if (catRows.length === 0) return
    const ids = catRows.map(r => r.id_modelo).filter(Boolean)
    if (ids.length === 0) return
    setCheckingDupes(true)
    ;(async () => {
      const existingSet = new Set<string>()
      // Solo costos tiene id_modelo; remuneraciones no tiene ese campo
      const { data } = await supabase.from('costos').select('id_modelo').in('id_modelo', ids)
      ;(data ?? []).forEach((r: { id_modelo: string }) => existingSet.add(r.id_modelo))
      setDuplicateIds(existingSet)
      if (existingSet.size > 0) {
        setSelected(prev => {
          const n = { ...prev }
          catRows.forEach(r => { if (existingSet.has(r.id_modelo)) n[r._idx] = false })
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
      const wb = XLSX.read(e.target!.result as ArrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

      const cats: ParsedRow[] = []
      const uncats: ParsedRow[] = []
      let idx = 0

      for (const r of raw.slice(16)) {
        const row = r as unknown[]
        if (!row || typeof row[0] !== 'number') continue
        if (typeof row[1] === 'string' && row[1].toLowerCase().includes('resumen')) break
        const monto = row[0] as number
        if (monto >= 0) continue
        const glosa = (row[1] as string) || ''
        const fecha = parseDate(row[3])
        const monto_bd = Math.abs(monto)

        const match: CatalogEntry | null = matchSoftware(glosa) ?? matchEquipo(glosa)

        const d = fecha ? new Date(fecha + 'T00:00:00') : null
        const mes = d ? d.getMonth() + 1 : 0
        const ano_eco = d ? d.getFullYear() : 0
        const mes_economico = d ? `${ano_eco}-${String(mes).padStart(2, '0')}` : ''

        const parsed: ParsedRow = {
          _idx: idx++,
          glosa, fecha, monto_cartola: monto, monto_bd,
          proveedor:        match?.proveedor        ?? '',
          cuenta_cble:      match?.cuenta_cble      ?? '',
          descripcion_cta:  match?.descripcion_cta  ?? '',
          clasificacion_cto:  match?.clasificacion_cto  ?? null,
          clasificacion_gasto: match?.clasificacion_gasto ?? null,
          tipo_cuenta:      match?.tipo_cuenta      ?? null,
          empresa_id:       match?.empresa_id        ?? '',
          tabla:            match?.tabla             ?? '',
          id_modelo:        match ? buildId(match.clasificacion_cto, fecha, monto_bd, glosa) : '',
          mes_economico, ano_eco, mes,
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
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0])
  }, [processFile])

  const toggleRow = (idx: number) => setSelected(p => ({ ...p, [idx]: !p[idx] }))
  const toggleSection = (rows: ParsedRow[]) => {
    const allOn = rows.every(r => selected[r._idx])
    setSelected(p => {
      const n = { ...p }
      rows.forEach(r => { n[r._idx] = !allOn })
      return n
    })
  }

  const selRows = catRows.filter(r => selected[r._idx])
  const costosRows = catRows.filter(r => r.tabla === 'costos')
  const remunRows = catRows.filter(r => r.tabla === 'remuneraciones')

  function buildSupabaseRow(r: ParsedRow) {
    const base = {
      empresa_id:          r.empresa_id,
      cuenta_cble:         r.cuenta_cble,
      descripcion_cta:     r.descripcion_cta,
      clasificacion_cto:   r.clasificacion_cto,
      clasificacion_gasto: r.clasificacion_gasto,
      tipo_cuenta:         r.tipo_cuenta,
      monto_bruto:         r.monto_bd,
      fecha_emision:       r.fecha,
      fecha_pago:          r.fecha,
      mes_economico:       r.mes_economico,
      ano_eco:             r.ano_eco,
      estado:              'Pagada',
    }
    if (r.tabla === 'costos') {
      return { ...base, descripcion_glosa: r.glosa }
    }
    return base
  }

  const handleUpload = async () => {
    const tables = ['costos', 'remuneraciones'] as const

    if (mode === 'prueba') {
      const preview: Record<string, object[]> = {}
      for (const tabla of tables) {
        preview[tabla] = selRows.filter(r => r.tabla === tabla).map(buildSupabaseRow)
      }
      setJsonPreview(preview)
      setJsonOpen(true)
      return
    }

    setStep('uploading')
    const results: UploadResults = {
      costos:        { inserted: 0, skipped: 0, errors: [] },
      remuneraciones: { inserted: 0, skipped: 0, errors: [] },
    }

    for (const tabla of tables) {
      const rows = selRows.filter(r => r.tabla === tabla)
      for (const row of rows) {
        const { error } = await supabaseAdmin.from(tabla).insert(buildSupabaseRow(row))
        if (error) {
          // Duplicate key error from Supabase — count as skipped, not as error
          if (error.code === '23505') {
            results[tabla].skipped++
          } else {
            results[tabla].errors.push({ glosa: row.glosa, error: error.message })
          }
        } else {
          results[tabla].inserted++
        }
      }
    }

    setUploadResults(results)
    setStep('done')
  }

  const reset = () => {
    setStep('upload')
    setFileName('')
    setCatRows([])
    setUncat([])
    setSelected({})
    setDuplicateIds(new Set())
    setCheckingDupes(false)
    setJsonPreview(null)
    setUploadResults(null)
    setJsonOpen(false)
  }

  // ── TABLE SECTION ──────────────────────────────────────────────────────────
  const SectionTable = ({ rows, title, color }: { rows: ParsedRow[]; title: string; color: string }) => {
    const allOn = rows.length > 0 && rows.every(r => selected[r._idx])
    const selCount = rows.filter(r => selected[r._idx]).length
    const dupeCount = rows.filter(r => duplicateIds.has(r.id_modelo)).length
    if (rows.length === 0) return null
    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color }}>
            → {title}
          </span>
          <span className="text-[10px] font-mono text-nl-400">
            {selCount}/{rows.length} seleccionados
          </span>
          {dupeCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-nl-danger bg-nl-danger/8 px-2 py-0.5 rounded-pill">
              <ShieldAlert size={10} />
              {dupeCount} ya existen en BD
            </span>
          )}
        </div>
        <div className="rounded-card border border-nl-border-soft overflow-hidden">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-nl-bg border-b border-nl-border-soft">
                <th className="px-3 py-2.5 text-left w-8">
                  <button
                    onClick={() => toggleSection(rows)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      allOn ? 'bg-nl-primary border-nl-primary' : 'border-nl-border-ui bg-nl-white'
                    }`}
                  >
                    {allOn && <span className="text-[8px] text-white font-bold">✓</span>}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Fecha</th>
                <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Proveedor</th>
                <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Glosa banco</th>
                <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Cuenta</th>
                <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Cartola (−)</th>
                <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Supabase (+)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
              const isDupe = duplicateIds.has(r.id_modelo)
              return (
                <tr
                  key={r._idx}
                  onClick={() => toggleRow(r._idx)}
                  className={`cursor-pointer border-b border-nl-border-soft last:border-0 transition-opacity ${
                    selected[r._idx] ? 'opacity-100' : 'opacity-35'
                  } ${isDupe ? 'bg-nl-danger/4' : i % 2 === 0 ? 'bg-nl-white' : 'bg-nl-bg/40'} hover:bg-nl-primary-10/40`}
                >
                  <td className="px-3 py-2">
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selected[r._idx] ? 'bg-nl-primary border-nl-primary' : 'border-nl-border-ui bg-nl-white'
                      }`}
                    >
                      {selected[r._idx] && <span className="text-[8px] text-white font-bold">✓</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-nl-500">{r.fecha}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-nl-text">{r.proveedor}</span>
                      {isDupe && (
                        <span className="flex items-center gap-0.5 text-[9px] font-mono font-semibold text-nl-danger bg-nl-danger/10 px-1.5 py-0.5 rounded">
                          <ShieldAlert size={9} />
                          YA EXISTE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="text-nl-500 block max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap"
                      title={r.glosa}
                    >
                      {r.glosa}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-[10px] bg-nl-primary-10 text-nl-primary px-1.5 py-0.5 rounded">
                      {r.cuenta_cble}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-nl-danger">{fmtCLP(r.monto_cartola)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-nl-success-dark">{fmtCLP(r.monto_bd)}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-bold text-nl-text tracking-tight">
          Actualizar Costos
        </h1>
        <p className="mt-1 text-[13px] font-body text-nl-500">
          Importa la cartola bancaria (.xlsx Banco de Chile) y registra los cargos en Supabase.
        </p>
      </div>

      {/* ── STEP: UPLOAD ── */}
      {step === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
          className={`
            border-2 border-dashed rounded-card p-16 text-center cursor-pointer transition-all duration-200
            ${dragging
              ? 'border-nl-primary bg-nl-primary-10/30'
              : 'border-nl-border-ui bg-nl-white hover:border-nl-primary/50 hover:bg-nl-primary-10/10'}
          `}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              dragging ? 'bg-nl-primary text-white' : 'bg-nl-bg text-nl-400'
            }`}>
              <Upload size={26} />
            </div>
            <div>
              <p className={`text-[15px] font-semibold font-body transition-colors ${dragging ? 'text-nl-primary' : 'text-nl-text'}`}>
                {dragging ? 'Suelta aquí el archivo' : 'Arrastra la cartola .xlsx'}
              </p>
              <p className="text-[12px] text-nl-400 mt-1">Banco de Chile · datos desde fila 17</p>
            </div>
            <div className="mt-2 px-4 py-2 bg-nl-primary text-white text-[12px] font-semibold rounded-input">
              Seleccionar archivo
            </div>
          </div>
          <input
            id="file-input"
            type="file"
            accept=".xlsx"
            className="hidden"
            onClick={e => e.stopPropagation()}
            onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]) }}
          />
        </div>
      )}

      {/* ── STEP: PREVIEW ── */}
      {step === 'preview' && (
        <>
          {/* File bar */}
          <div className="flex items-center justify-between gap-4 p-4 bg-nl-white rounded-card border border-nl-border-soft">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={18} className="text-nl-primary shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-nl-text">{fileName}</p>
                <p className="text-[11px] font-mono text-nl-400 mt-0.5">
                  {catRows.length} identificados · {uncat.length} sin categorizar
                  {checkingDupes && <span className="ml-2 text-nl-primary animate-pulse">· verificando duplicados…</span>}
                  {!checkingDupes && duplicateIds.size > 0 && <span className="ml-2 text-nl-danger">· {duplicateIds.size} ya existen en BD</span>}
                </p>
              </div>
            </div>
            <button onClick={reset} className="flex items-center gap-1.5 text-[12px] text-nl-500 hover:text-nl-text transition-colors">
              <RotateCcw size={13} />
              Nueva cartola
            </button>
          </div>

          {/* Conversion banner */}
          <div className="flex items-center gap-2 text-[11px] font-mono p-3 bg-nl-white rounded-card border border-nl-border-soft">
            <span className="px-2 py-0.5 rounded bg-nl-danger/10 text-nl-danger font-semibold">CARTOLA negativo</span>
            <span className="text-nl-400 text-[14px]">→</span>
            <span className="px-2 py-0.5 rounded bg-nl-success/10 text-nl-success-dark font-semibold">SUPABASE positivo ✓</span>
            <span className="text-nl-400 ml-1">conversión aplicada</span>
          </div>

          {/* Tables */}
          <SectionTable rows={costosRows}  title="costos"          color="#5869f7" />
          <SectionTable rows={remunRows}   title="remuneraciones"  color="#f59e0b" />

          {/* Sin categorizar */}
          {uncat.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-nl-400">Sin categorizar</span>
                <span className="text-[10px] font-mono text-nl-400">{uncat.length} filas — revisar manualmente</span>
              </div>
              <div className="rounded-card border border-nl-border-soft overflow-hidden">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-nl-bg border-b border-nl-border-soft">
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Fecha</th>
                      <th className="px-3 py-2.5 text-left font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Glosa banco</th>
                      <th className="px-3 py-2.5 text-right font-mono text-[10px] text-nl-400 uppercase tracking-[0.1em]">Monto cartola</th>
                    </tr>
                  </thead>
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
            {/* Mode toggle */}
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
                    : 'bg-nl-primary text-white hover:opacity-90'
              }`}
            >
              {mode === 'prueba' ? 'Ver JSON' : 'Subir a Supabase'}
              <span className="font-mono text-[11px] opacity-80">({selRows.length} filas)</span>
            </button>
          </div>

          {/* JSON preview (prueba mode) */}
          {jsonPreview && (
            <div ref={jsonRef} className="rounded-card border border-nl-border-soft overflow-hidden">
              <button
                onClick={() => setJsonOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-nl-bg hover:bg-nl-primary-10/30 transition-colors"
              >
                <span className="text-[12px] font-mono font-semibold text-nl-primary">
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

      {/* ── STEP: UPLOADING ── */}
      {step === 'uploading' && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-nl-primary/20 border-t-nl-primary rounded-full animate-spin" />
          <p className="text-[13px] font-body text-nl-500">Insertando registros en Supabase…</p>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === 'done' && uploadResults && (
        <>
          <div className="grid grid-cols-2 gap-4">
            {(['costos', 'remuneraciones'] as const).map(tabla => {
              const r = uploadResults[tabla]
              const hasErrors = r.errors.length > 0
              return (
                <div key={tabla} className={`rounded-card border p-5 ${hasErrors ? 'border-nl-danger/30 bg-nl-danger/5' : 'border-nl-success/30 bg-nl-success/5'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {hasErrors
                      ? <AlertCircle size={16} className="text-nl-danger" />
                      : <CheckCircle size={16} className="text-nl-success-dark" />}
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-nl-500">→ {tabla}</span>
                  </div>
                  <p className="text-[22px] font-body font-bold tabular-nums text-nl-text">{r.inserted}</p>
                  <p className="text-[12px] text-nl-500">registros insertados</p>
                  {r.skipped > 0 && (
                    <p className="text-[11px] font-mono text-nl-400 mt-1">{r.skipped} omitidos (ya existían)</p>
                  )}
                  {hasErrors && (
                    <div className="mt-3 space-y-1">
                      {r.errors.map((e, i) => (
                        <div key={i} className="text-[11px] font-mono text-nl-danger">
                          <span className="opacity-60 truncate block">{e.glosa.slice(0, 30)}</span>
                          <span>{e.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 bg-nl-primary text-white rounded-input text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            <RotateCcw size={14} />
            Nueva cartola
          </button>
        </>
      )}
    </div>
  )
}
