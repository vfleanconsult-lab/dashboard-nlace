import { createClient } from '@supabase/supabase-js'

// import.meta.env solo existe bajo Vite; en Node (scripts ejecutados con tsx)
// cae a process.env para permitir reutilizar este módulo fuera del bundle web.
// Se usa globalThis + cast para no requerir @types/node en el build web.
const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
const env: Record<string, string | undefined> =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env)
  || nodeProcess?.env
  || {}

const url = env.VITE_SUPABASE_URL
  || 'https://orjufhwfepojfiqejhfc.supabase.co'

const key = env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_4rQ_tBCCmn8hYn97FUd4nA_Y7He_0RP'

export const supabase = createClient(url, key)

// RUT de la empresa activa — en el futuro vendrá del contexto de sesión
export const EMPRESA_RUT = '77743235-4'
