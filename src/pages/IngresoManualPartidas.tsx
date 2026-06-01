import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  CheckCircle, AlertCircle, RotateCcw, ChevronRight,
  TrendingUp, Package, Receipt, Users, Loader2, type LucideIcon,
} from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://orjufhwfepojfiqejhfc.supabase.co'
const SERVICE_KEY  = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
const supabaseAdmin = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : supabase

const EMPRESA_ID = '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a'

const ESTADOS = ['Emitida', 'Pagada', 'Pagada_parcial', 'Anulada']

type Tabla = 'ventas' | 'costos' | 'gastos' | 'remuneraciones'
type Step = 1 | 2 | 3 | 'done'

type CuentaOption = { cuenta_cble: string; descripcion_cta: string }

type DynamicOpts = {
  clasificacion_gasto: string[]
  tipo_cuenta: string[]
  clasificacion_cto: string[]
}

type FormValues = Record<string, string>

type InsertResult = { ok: boolean; error?: string }

// ── TABLA META ─────────────────────────────────────────────────────────────────
const TABLE_META: Record<Tabla, {
  label: string
  description: string
  Icon: LucideIcon
  color: string
  iconColor: string
}> = {
  ventas: {
    label: 'Ventas',
    description: 'Facturas e ingresos de clientes',
    Icon: TrendingUp,
    color: 'bg-green-50 text-nl-success-dark border-green-200 hover:border-green-400/50',
    iconColor: 'text-nl-success-dark',
  },
  costos: {
    label: 'Costos',
    description: 'Costos de operación y equipo',
    Icon: Package,
    color: 'bg-nl-primary-10 text-nl-primary border-nl-primary/20 hover:border-nl-primary/50',
    iconColor: 'text-nl-primary',
  },
  gastos: {
    label: 'Gastos',
    description: 'Gastos operacionales',
    Icon: Receipt,
    color: 'bg-orange-50 text-nl-accent border-orange-200 hover:border-nl-accent/50',
    iconColor: 'text-nl-accent',
  },
  remuneraciones: {
    label: 'Remuneraciones',
    description: 'Remuneración de directores',
    Icon: Users,
    color: 'bg-violet-50 text-violet-600 border-violet-200 hover:border-violet-400/50',
    iconColor: 'text-violet-600',
  },
}

// ── FIELD DEFINITIONS PER TABLE ────────────────────────────────────────────────
type FieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'month' | 'select' | 'textarea'
  required: boolean
  staticOptions?: string[]
  dynamicKey?: keyof DynamicOpts
  placeholder?: string
  hint?: string
}

const COMMON_FIELDS: FieldDef[] = [
  { key: 'fecha_emision',     label: 'Fecha emisión',    type: 'date',   required: true },
  { key: 'fecha_pago',        label: 'Fecha pago',       type: 'date',   required: false },
  { key: 'fecha_vencimiento', label: 'Fecha vencimiento',type: 'date',   required: false },
  { key: 'monto_bruto',       label: 'Monto bruto ($)',  type: 'number', required: true, placeholder: '0', hint: 'Ingresar siempre positivo' },
  { key: 'estado',            label: 'Estado',           type: 'select', required: true, staticOptions: ESTADOS },
  { key: 'mes_economico',     label: 'Mes económico',    type: 'month',  required: true, hint: 'Se derivará automáticamente de fecha emisión si se deja vacío' },
]

const FIELDS_BY_TABLE: Record<Tabla, FieldDef[]> = {
  ventas: [
    { key: 'folio',       label: 'Folio',      type: 'text',   required: true,  placeholder: 'Ej. 1234' },
    { key: 'rut_cliente', label: 'RUT cliente',type: 'text',   required: true,  placeholder: 'Ej. 76.123.456-7' },
    { key: 'cliente',     label: 'Cliente',    type: 'text',   required: true,  placeholder: 'Nombre empresa' },
    ...COMMON_FIELDS,
  ],
  costos: [
    ...COMMON_FIELDS,
    { key: 'descripcion_glosa', label: 'Glosa / descripción', type: 'text', required: false, placeholder: 'Descripción del cargo' },
    { key: 'clasificacion_cto', label: 'Clasificación costo', type: 'select', required: false, dynamicKey: 'clasificacion_cto' },
    { key: 'tipo_cuenta',       label: 'Tipo cuenta',         type: 'select', required: false, dynamicKey: 'tipo_cuenta' },
  ],
  gastos: [
    ...COMMON_FIELDS,
    { key: 'descripcion_glosa',  label: 'Glosa / descripción',  type: 'text',   required: false, placeholder: 'Descripción del cargo' },
    { key: 'clasificacion_gasto',label: 'Clasificación gasto',  type: 'select', required: true,  dynamicKey: 'clasificacion_gasto' },
    { key: 'tipo_cuenta',        label: 'Tipo cuenta',          type: 'select', required: true,  dynamicKey: 'tipo_cuenta' },
  ],
  remuneraciones: [
    ...COMMON_FIELDS,
  ],
}

// ── HELPERS ────────────────────────────────────────────────────────────────────
function deriveMonthFromDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m] = dateStr.split('-')
  if (!y || !m) return ''
  return `${y}-${m}`
}

function buildInsertRow(tabla: Tabla, form: FormValues, cuenta: CuentaOption): Record<string, unknown> {
  const mes = form.mes_economico || deriveMonthFromDate(form.fecha_emision)
  const ano = mes ? parseInt(mes.split('-')[0]) : null

  const base: Record<string, unknown> = {
    empresa_id:    EMPRESA_ID,
    cuenta_cble:   cuenta.cuenta_cble,
    descripcion_cta: cuenta.descripcion_cta,
    monto_bruto:   parseFloat(form.monto_bruto) || 0,
    fecha_emision: form.fecha_emision || null,
    fecha_pago:    form.fecha_pago    || null,
    fecha_vencimiento: form.fecha_vencimiento || null,
    estado:        form.estado || 'Emitida',
    mes_economico: mes || null,
    ano_eco:       ano,
  }

  if (tabla === 'ventas') {
    base.folio       = form.folio       || null
    base.rut_cliente = form.rut_cliente || null
    base.cliente     = form.cliente     || null
  }

  if (tabla === 'costos') {
    base.descripcion_glosa  = form.descripcion_glosa  || null
    base.clasificacion_cto  = form.clasificacion_cto  || null
    base.clasificacion_gasto = null
    base.tipo_cuenta         = form.tipo_cuenta         || null
  }

  if (tabla === 'gastos') {
    base.descripcion_glosa  = form.descripcion_glosa   || null
    base.clasificacion_gasto = form.clasificacion_gasto || null
    base.tipo_cuenta         = form.tipo_cuenta         || null
    base.clasificacion_cto   = null
  }

  if (tabla === 'remuneraciones') {
    base.clasificacion_gasto = 'Retiros'
    base.tipo_cuenta         = 'Gasto_Retiro'
  }

  return base
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────
export default function IngresoManualPartidas() {
  const [step, setStep]         = useState<Step>(1)
  const [tabla, setTabla]       = useState<Tabla | null>(null)
  const [cuentas, setCuentas]   = useState<CuentaOption[]>([])
  const [loadingCuentas, setLoadingCuentas] = useState(false)
  const [cuenta, setCuenta]     = useState<CuentaOption | null>(null)
  const [dynOpts, setDynOpts]   = useState<DynamicOpts>({ clasificacion_gasto: [], tipo_cuenta: [], clasificacion_cto: [] })
  const [loadingDyn, setLoadingDyn] = useState(false)
  const [form, setForm]         = useState<FormValues>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]     = useState<InsertResult | null>(null)
  const [mode, setMode]         = useState<'prueba' | 'produccion'>('prueba')
  const [jsonPreview, setJsonPreview] = useState<Record<string, unknown> | null>(null)

  // Load distinct cuenta_cble when tabla is selected
  useEffect(() => {
    if (!tabla) return
    setLoadingCuentas(true)
    setCuentas([])
    setCuenta(null)
    ;(async () => {
      const { data } = await supabase
        .from(tabla)
        .select('cuenta_cble, descripcion_cta')
        .eq('empresa_id', EMPRESA_ID)
        .order('cuenta_cble')

      const seen = new Set<string>()
      const unique: CuentaOption[] = []
      for (const row of (data ?? [])) {
        const key = `${row.cuenta_cble}|${row.descripcion_cta}`
        if (!seen.has(key)) {
          seen.add(key)
          unique.push({ cuenta_cble: row.cuenta_cble, descripcion_cta: row.descripcion_cta })
        }
      }
      setCuentas(unique)
      setLoadingCuentas(false)
    })()
  }, [tabla])

  // Load dynamic select options when entering step 3
  useEffect(() => {
    if (step !== 3 || !tabla) return
    setLoadingDyn(true)
    ;(async () => {
      const cols: Array<keyof DynamicOpts> = ['clasificacion_gasto', 'tipo_cuenta', 'clasificacion_cto']
      const results: DynamicOpts = { clasificacion_gasto: [], tipo_cuenta: [], clasificacion_cto: [] }

      await Promise.all(cols.map(async (col) => {
        const { data } = await supabase
          .from(tabla)
          .select(col)
          .eq('empresa_id', EMPRESA_ID)
          .not(col, 'is', null)
        const vals = [...new Set((data ?? []).map((r: Record<string, string>) => r[col]).filter(Boolean))].sort()
        results[col] = vals
      }))

      setDynOpts(results)
      setLoadingDyn(false)
    })()
  }, [step, tabla])

  const selectTabla = (t: Tabla) => {
    setTabla(t)
    setForm({})
    setJsonPreview(null)
    setResult(null)
    setStep(2)
  }

  const selectCuenta = (c: CuentaOption) => {
    setCuenta(c)
    setForm({ estado: 'Emitida' })
    setStep(3)
  }

  const setField = (key: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Auto-derive mes_economico from fecha_emision if not manually set
      if (key === 'fecha_emision' && !prev._mes_manual) {
        next.mes_economico = deriveMonthFromDate(value)
      }
      if (key === 'mes_economico') {
        next._mes_manual = value ? '1' : ''
      }
      return next
    })
  }

  const validate = (): string | null => {
    if (!tabla || !cuenta) return 'Faltan datos de contexto'
    const fields = FIELDS_BY_TABLE[tabla]
    for (const f of fields) {
      if (f.required && !form[f.key]) return `Campo requerido: ${f.label}`
    }
    if (!form.monto_bruto || isNaN(parseFloat(form.monto_bruto))) return 'Monto bruto inválido'
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setResult({ ok: false, error: err }); return }

    const row = buildInsertRow(tabla!, form, cuenta!)

    if (mode === 'prueba') {
      setJsonPreview(row)
      return
    }

    setSubmitting(true)
    const { error } = await supabaseAdmin.from(tabla!).insert(row)
    setSubmitting(false)

    if (error) {
      setResult({ ok: false, error: error.message })
    } else {
      setResult({ ok: true })
      setStep('done')
    }
  }

  const reset = () => {
    setStep(1)
    setTabla(null)
    setCuenta(null)
    setCuentas([])
    setForm({})
    setResult(null)
    setJsonPreview(null)
    setMode('prueba')
  }

  // ── BREADCRUMB ─────────────────────────────────────────────────────────────
  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-[11px] font-mono text-nl-400">
      <button
        onClick={() => { setStep(1); setTabla(null); setCuenta(null); setForm({}) }}
        className={step === 1 ? 'text-nl-text font-semibold' : 'hover:text-nl-text transition-colors'}
      >
        1 · Tabla
      </button>
      <ChevronRight size={10} className="shrink-0" />
      <button
        onClick={() => { if (tabla) { setStep(2); setCuenta(null) } }}
        className={step === 2 ? 'text-nl-text font-semibold' : tabla ? 'hover:text-nl-text transition-colors' : 'opacity-40 cursor-default'}
      >
        2 · Cuenta
      </button>
      <ChevronRight size={10} className="shrink-0" />
      <span className={step === 3 ? 'text-nl-text font-semibold' : 'opacity-40'}>
        3 · Datos
      </span>
    </div>
  )

  // ── FIELD RENDERER ─────────────────────────────────────────────────────────
  const renderField = (f: FieldDef) => {
    const opts = f.dynamicKey ? dynOpts[f.dynamicKey] : f.staticOptions ?? []
    const val  = form[f.key] ?? ''

    const labelEl = (
      <label className="block text-[11px] font-mono font-medium text-nl-500 uppercase tracking-[0.08em] mb-1">
        {f.label}
        {f.required && <span className="text-nl-accent ml-1">*</span>}
        {f.hint && <span className="ml-2 text-nl-400 normal-case tracking-normal font-body font-normal">{f.hint}</span>}
      </label>
    )

    const inputClass = `
      w-full px-3 py-2 rounded-input border border-nl-border-ui bg-nl-white
      text-[13px] font-body text-nl-text placeholder:text-nl-400
      focus:outline-none focus:ring-2 focus:ring-nl-primary/30 focus:border-nl-primary
      transition-colors
    `

    if (f.type === 'select') {
      const loading = f.dynamicKey && loadingDyn
      return (
        <div key={f.key}>
          {labelEl}
          <select
            value={val}
            onChange={e => setField(f.key, e.target.value)}
            disabled={!!loading}
            className={inputClass + ' cursor-pointer disabled:opacity-50'}
          >
            <option value="">— seleccionar —</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )
    }

    return (
      <div key={f.key}>
        {labelEl}
        <input
          type={f.type}
          value={val}
          placeholder={f.placeholder}
          onChange={e => setField(f.key, e.target.value)}
          className={inputClass}
        />
      </div>
    )
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-bold text-nl-text tracking-tight">
          Ingreso Manual de Partidas
        </h1>
        <p className="mt-1 text-[13px] font-body text-nl-500">
          Registra un asiento contable directamente en Supabase.
        </p>
      </div>

      {/* Breadcrumb */}
      {step !== 'done' && (
        <div className="p-3 bg-nl-white rounded-card border border-nl-border-soft">
          <Breadcrumb />
        </div>
      )}

      {/* ── STEP 1: TABLA ── */}
      {step === 1 && (
        <div className="grid grid-cols-2 gap-4">
          {(Object.entries(TABLE_META) as [Tabla, typeof TABLE_META[Tabla]][]).map(([key, meta]) => {
            const { Icon } = meta
            return (
              <button
                key={key}
                onClick={() => selectTabla(key)}
                className={`rounded-2xl border p-5 transition-all duration-200 text-left ${meta.color}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white/70 shrink-0">
                    <Icon size={20} strokeWidth={1.75} className={meta.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-display font-semibold text-[14px] ${meta.iconColor}`}>{meta.label}</p>
                    <p className="mt-0.5 text-[11px] font-body text-nl-500 leading-snug">{meta.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── STEP 2: CUENTA CONTABLE ── */}
      {step === 2 && tabla && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-nl-400 uppercase tracking-[0.1em]">
              Tabla: <span className="text-nl-text font-semibold">{tabla}</span>
            </span>
          </div>

          {loadingCuentas ? (
            <div className="flex items-center gap-2 py-8 justify-center text-nl-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[13px] font-body">Cargando cuentas contables…</span>
            </div>
          ) : cuentas.length === 0 ? (
            <div className="py-8 text-center text-[13px] font-body text-nl-400">
              No hay cuentas registradas en esta tabla.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] font-body text-nl-500">
                Selecciona la cuenta contable destino ({cuentas.length} disponibles):
              </p>
              <div className="rounded-card border border-nl-border-soft overflow-hidden divide-y divide-nl-border-soft">
                {cuentas.map(c => (
                  <button
                    key={`${c.cuenta_cble}|${c.descripcion_cta}`}
                    onClick={() => selectCuenta(c)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-nl-primary-10/40 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] bg-nl-bg px-2 py-0.5 rounded text-nl-primary font-semibold">
                        {c.cuenta_cble}
                      </span>
                      <span className="text-[13px] font-body text-nl-text">{c.descripcion_cta}</span>
                    </div>
                    <ChevronRight size={14} className="text-nl-400 group-hover:text-nl-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: FORM ── */}
      {step === 3 && tabla && cuenta && (
        <div className="space-y-5">
          {/* Selected context pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-nl-400">Tabla:</span>
            <span className="font-mono text-[11px] bg-nl-bg px-2 py-0.5 rounded text-nl-text font-semibold border border-nl-border-soft">
              {tabla}
            </span>
            <span className="text-[11px] font-mono text-nl-400 ml-1">Cuenta:</span>
            <span className="font-mono text-[11px] bg-nl-primary-10 px-2 py-0.5 rounded text-nl-primary font-semibold">
              {cuenta.cuenta_cble}
            </span>
            <span className="text-[12px] font-body text-nl-500">{cuenta.descripcion_cta}</span>
          </div>

          {/* Form grid */}
          <div className="grid grid-cols-2 gap-4">
            {FIELDS_BY_TABLE[tabla].filter(f => f.key !== '_mes_manual').map(f => (
              <div key={f.key} className={
                ['descripcion_glosa', 'cliente'].includes(f.key) ? 'col-span-2' : ''
              }>
                {renderField(f)}
              </div>
            ))}
          </div>

          {/* Validation error */}
          {result && !result.ok && (
            <div className="flex items-start gap-2 p-3 rounded-card bg-nl-danger/5 border border-nl-danger/20">
              <AlertCircle size={15} className="text-nl-danger shrink-0 mt-0.5" />
              <p className="text-[12px] font-body text-nl-danger">{result.error}</p>
            </div>
          )}

          {/* JSON preview (prueba mode) */}
          {jsonPreview && (
            <div className="rounded-card border border-nl-border-soft overflow-hidden">
              <div className="px-4 py-2.5 bg-nl-bg flex items-center justify-between">
                <span className="text-[11px] font-mono font-semibold text-nl-primary">
                  JSON preview — modo prueba
                </span>
                <span className="text-[10px] font-mono text-nl-400">no se insertará nada</span>
              </div>
              <pre className="p-4 text-[11px] font-mono text-nl-500 bg-nl-white overflow-x-auto max-h-72">
                {JSON.stringify(jsonPreview, null, 2)}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 flex-wrap pt-1">
            {/* Mode toggle */}
            <div className="flex items-center bg-nl-bg rounded-pill border border-nl-border-soft p-0.5">
              <button
                onClick={() => { setMode('prueba'); setJsonPreview(null); setResult(null) }}
                className={`px-4 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${
                  mode === 'prueba' ? 'bg-nl-white text-nl-primary shadow-card' : 'text-nl-500 hover:text-nl-text'
                }`}
              >
                Modo prueba
              </button>
              <button
                onClick={() => { setMode('produccion'); setJsonPreview(null); setResult(null) }}
                className={`px-4 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${
                  mode === 'produccion' ? 'bg-nl-white text-nl-accent shadow-card' : 'text-nl-500 hover:text-nl-text'
                }`}
              >
                Modo producción
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-input text-[13px] font-semibold transition-all ${
                submitting
                  ? 'bg-nl-border-ui text-nl-400 cursor-not-allowed'
                  : mode === 'produccion'
                    ? 'bg-nl-accent text-white hover:opacity-90'
                    : 'bg-nl-primary text-white hover:opacity-90'
              }`}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {mode === 'prueba' ? 'Ver JSON' : 'Insertar en Supabase'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === 'done' && result?.ok && (
        <div className="space-y-5">
          <div className="rounded-card border border-nl-success/30 bg-nl-success/5 p-6 flex items-start gap-3">
            <CheckCircle size={20} className="text-nl-success-dark shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-semibold text-[16px] text-nl-text">Registro insertado correctamente</p>
              <p className="mt-1 text-[12px] font-body text-nl-500">
                Tabla <span className="font-mono font-semibold">{tabla}</span> ·
                Cuenta <span className="font-mono font-semibold">{cuenta?.cuenta_cble}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep(3); setResult(null); setForm({ estado: 'Emitida' }); setJsonPreview(null) }}
              className="px-5 py-2.5 rounded-input text-[13px] font-semibold border border-nl-border-ui text-nl-text hover:bg-nl-bg transition-colors"
            >
              Nueva partida — misma cuenta
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-2.5 bg-nl-primary text-white rounded-input text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
              <RotateCcw size={14} />
              Nuevo ingreso
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
