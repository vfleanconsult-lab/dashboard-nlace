import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
  || 'https://orjufhwfepojfiqejhfc.supabase.co'

const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yanVmaHdmZXBvamZpcWVqaGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTQwOTUsImV4cCI6MjA5MzU3MDA5NX0.kdZh2IWOE3S17SECphPwmP42NJwq-CJpAQ4iARJtvwA'

export const supabase = createClient(url, key)

// RUT de la empresa activa — en el futuro vendrá del contexto de sesión
export const EMPRESA_RUT = '77743235-4'
