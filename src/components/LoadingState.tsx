import { Spinner } from '@nlace/ui-kit'

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Spinner size="md" />
      <p className="text-[12px] font-mono text-nl-400 tracking-[0.05em]">Cargando datos financieros…</p>
    </div>
  )
}

export function ErrorState({ error }: { error?: unknown }) {
  const msg = error instanceof Error ? error.message : error ? String(error) : null
  return (
    <div className="m-8 p-6 rounded-card bg-nl-danger-8 border border-nl-danger/20 text-center">
      <h3 className="font-display font-bold text-nl-danger mb-2">No se pudieron cargar los datos</h3>
      <p className="text-[12px] font-mono text-nl-500">
        Error al conectar con Supabase. Verifica la configuración.
      </p>
      {msg && (
        <pre className="mt-3 text-left text-[11px] font-mono text-nl-danger bg-nl-danger-4 rounded p-3 overflow-auto max-h-32">
          {msg}
        </pre>
      )}
    </div>
  )
}

