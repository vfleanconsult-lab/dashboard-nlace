// Cliente de escritura. NO usa service_role: delega en /api/db-write, que valida
// la sesión de Clerk en el servidor. Misma forma que supabase-js ({ error }) para
// no tocar la lógica de las páginas de carga.

type Result = { error: { message: string; code?: string } | null }

async function call(body: Record<string, unknown>): Promise<Result> {
  try {
    const clerk = (window as { Clerk?: { session?: { getToken: () => Promise<string | null> } } }).Clerk
    const token = await clerk?.session?.getToken()
    if (!token) return { error: { message: 'Sesión expirada, vuelve a iniciar sesión' } }
    const res = await fetch('/api/db-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (res.ok) return { error: null }
    const data = await res.json().catch(() => ({}))
    const d = data as { error?: string; code?: string }
    return { error: { message: d.error || `Error ${res.status}`, code: d.code } }
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : 'Error de red' } }
  }
}

export const supabaseAdmin = {
  from: (table: string) => ({
    insert: (row: Record<string, unknown>) => call({ op: 'insert', table, row }),
    update: (values: Record<string, unknown>) => ({
      eq: (_col: 'id', id: string | number) => call({ op: 'update', table, values, id }),
    }),
  }),
}
