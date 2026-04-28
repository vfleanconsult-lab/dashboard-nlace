import { Spinner } from '@nlace/ui-kit'

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Spinner size="md" />
      <p className="text-[12px] font-mono text-nl-400 tracking-[0.05em]">Cargando datos financieros…</p>
    </div>
  )
}

export function ErrorState() {
  return (
    <div className="m-8 p-6 rounded-card bg-nl-danger-8 border border-nl-danger/20 text-center">
      <h3 className="font-display font-bold text-nl-danger mb-2">No se pudieron cargar los datos</h3>
      <p className="text-[12px] font-mono text-nl-500">
        Verifica que el Google Sheet sea público y el link de exportación esté activo.
      </p>
    </div>
  )
}
