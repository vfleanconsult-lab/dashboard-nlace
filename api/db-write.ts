// Único punto de escritura a Supabase con service_role.
// La clave vive solo en el entorno del servidor (SUPABASE_SERVICE_KEY, sin prefijo VITE_)
// y nunca llega al bundle del navegador. Exige sesión de Clerk con correo @nlace.com.
import { createClient } from '@supabase/supabase-js'
import { createClerkClient, verifyToken } from '@clerk/backend'

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type Res = { status: (code: number) => Res; json: (body: unknown) => void }

const EMPRESA_ID = '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a'
const ALLOWED_DOMAIN = '@nlace.com'
const INSERT_TABLES = new Set(['ventas', 'costos', 'gastos', 'remuneraciones'])
const UPDATE_COLUMNS = new Set(['estado', 'fecha_pago', 'monto_bruto'])

type Payload =
  | { op: 'insert'; table: string; row: Record<string, unknown> }
  | { op: 'update'; table: string; values: Record<string, unknown>; id: string | number }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

async function authorize(req: Req): Promise<string | null> {
  const header = req.headers.authorization
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : ''
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!token || !secretKey) return null
  try {
    const claims = await verifyToken(token, { secretKey })
    const user = await createClerkClient({ secretKey }).users.getUser(claims.sub)
    const ok = user.emailAddresses.some(
      e => e.verification?.status === 'verified' && e.emailAddress.toLowerCase().endsWith(ALLOWED_DOMAIN),
    )
    return ok ? claims.sub : null
  } catch {
    return null
  }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!(await authorize(req))) return res.status(401).json({ error: 'No autorizado' })

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey) return res.status(500).json({ error: 'Servidor sin configurar' })

  const body = req.body as Partial<Payload> | undefined
  if (!isObj(body) || typeof body.table !== 'string' || !INSERT_TABLES.has(body.table)) {
    return res.status(400).json({ error: 'Tabla no permitida' })
  }
  const db = createClient(url, serviceKey)

  if (body.op === 'insert') {
    const row = (body as { row?: unknown }).row
    if (!isObj(row)) return res.status(400).json({ error: 'Fila inválida' })
    if (row.empresa_id !== undefined && row.empresa_id !== EMPRESA_ID) {
      return res.status(400).json({ error: 'empresa_id no permitido' })
    }
    const { error } = await db.from(body.table).insert(row)
    return error ? res.status(400).json({ error: error.message, code: error.code }) : res.status(200).json({ ok: true })
  }

  if (body.op === 'update') {
    const { values, id } = body as { values?: unknown; id?: unknown }
    if (body.table !== 'ventas') return res.status(400).json({ error: 'Update solo permitido en ventas' })
    if (!isObj(values) || (typeof id !== 'string' && typeof id !== 'number')) {
      return res.status(400).json({ error: 'Update inválido' })
    }
    if (!Object.keys(values).every(k => UPDATE_COLUMNS.has(k))) {
      return res.status(400).json({ error: 'Columna no permitida' })
    }
    const { error } = await db.from('ventas').update(values).eq('id', id).eq('empresa_id', EMPRESA_ID)
    return error ? res.status(400).json({ error: error.message, code: error.code }) : res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'Operación no permitida' })
}
