import { useEffect, useState } from 'react'
import { supabase, EMPRESA_RUT } from '../lib/supabase'
import { formatCLP } from '../lib/data'
import DataTable from '../components/DataTable'
import SectionLabel from '../components/SectionLabel'
import { LoadingState, ErrorState } from '../components/LoadingState'

interface PendingRow {
  fecha_emision: string
  glosa: string
  clasificacion: string
  monto: number
}

async function fetchPending(
  table: 'costos' | 'gastos',
  empresaId: string,
): Promise<PendingRow[]> {
  const clasCol = table === 'costos' ? 'clasificacion_cto' : 'clasificacion_gasto'
  const { data, error } = await supabase
    .from(table)
    .select(`fecha_emision,descripcion_glosa,${clasCol},monto_bruto`)
    .eq('empresa_id', empresaId)
    .ilike('estado', 'no pagada')
    .order('fecha_emision', { ascending: true })

  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => ({
    fecha_emision: (r.fecha_emision as string) || '—',
    glosa:         (r.descripcion_glosa as string) || '—',
    clasificacion: (r[clasCol] as string) || '—',
    monto:         Number(r.monto_bruto) || 0,
  }))
}

function TotalBar({ label, total }: { label: string; total: number }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-nl-bg border-t border-nl-border-soft rounded-b-card">
      <span className="text-[11px] font-mono text-nl-400 uppercase tracking-[0.08em]">{label}</span>
      <span className="font-mono font-semibold text-[13px] text-nl-text">{formatCLP(total)}</span>
    </div>
  )
}

const COLUMNS_COSTOS = [
  {
    header: 'Fecha Emisión',
    accessor: (r: PendingRow) => <span className="font-mono text-[12px] text-nl-400">{r.fecha_emision}</span>,
  },
  {
    header: 'Glosa',
    accessor: (r: PendingRow) => <span className="text-nl-text">{r.glosa}</span>,
  },
  {
    header: 'Clasificación',
    accessor: (r: PendingRow) => <span className="font-mono text-[11px] text-nl-400">{r.clasificacion}</span>,
  },
  {
    header: 'Monto', align: 'right' as const,
    accessor: (r: PendingRow) => <span className="font-mono text-[12px] text-nl-700">{formatCLP(r.monto)}</span>,
  },
]

const COLUMNS_GASTOS = COLUMNS_COSTOS

export default function CuentasPorPagar() {
  const [costos, setCostos]   = useState<PendingRow[]>([])
  const [gastos, setGastos]   = useState<PendingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: emp, error: empErr } = await supabase
          .from('empresas')
          .select('id')
          .eq('rut', EMPRESA_RUT)
          .single()

        if (empErr) throw empErr

        const [c, g] = await Promise.all([
          fetchPending('costos', emp.id),
          fetchPending('gastos', emp.id),
        ])
        setCostos(c)
        setGastos(g)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingState />
  if (error)   return <ErrorState error={error} />

  const totalCostos = costos.reduce((s, r) => s + r.monto, 0)
  const totalGastos = gastos.reduce((s, r) => s + r.monto, 0)
  const totalGlobal = totalCostos + totalGastos

  return (
    <>
      <header className="sticky top-0 z-40 h-[60px] flex items-center justify-between px-8 bg-nl-white/90 backdrop-blur-md border-b border-nl-border-soft">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[16px] font-display font-bold text-nl-text tracking-tight">Cuentas por Pagar</h1>
          <span className="text-[11px] font-mono text-nl-400">Costos y gastos con estado No Pagada</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-card bg-nl-danger/8 border border-nl-danger/20">
          <span className="text-[11px] font-mono text-nl-400">Total pendiente</span>
          <span className="font-mono font-bold text-[14px] text-nl-danger">{formatCLP(totalGlobal)}</span>
        </div>
      </header>

      <div className="p-8 space-y-8">

        <div>
          <SectionLabel>Costos pendientes · {costos.length} líneas</SectionLabel>
          <div className="rounded-card overflow-hidden border border-nl-border-soft shadow-card">
            <DataTable
              title="Costos No Pagados"
              badge={`${costos.length} registros`}
              columns={COLUMNS_COSTOS}
              rows={costos}
              keyFn={(_r, i) => `c-${i}`}
              emptyText="Sin costos pendientes de pago"
            />
            <TotalBar label={`Total costos · ${costos.length} líneas`} total={totalCostos} />
          </div>
        </div>

        <div>
          <SectionLabel>Gastos pendientes · {gastos.length} líneas</SectionLabel>
          <div className="rounded-card overflow-hidden border border-nl-border-soft shadow-card">
            <DataTable
              title="Gastos No Pagados"
              badge={`${gastos.length} registros`}
              columns={COLUMNS_GASTOS}
              rows={gastos}
              keyFn={(_r, i) => `g-${i}`}
              emptyText="Sin gastos pendientes de pago"
            />
            <TotalBar label={`Total gastos · ${gastos.length} líneas`} total={totalGastos} />
          </div>
        </div>

      </div>
    </>
  )
}
