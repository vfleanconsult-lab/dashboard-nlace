import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

// RUT de la empresa activa — en el futuro vendrá del contexto de sesión
export const EMPRESA_RUT = '77743235-4'
