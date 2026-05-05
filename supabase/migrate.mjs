/**
 * Script de migración: Google Sheets → Supabase
 * Ejecutar desde la raíz del proyecto: node supabase/migrate.mjs
 */

// ── Configuración ───────────────────────────────────────────
// Las credenciales se leen del archivo .env o de variables de entorno.
// Ejecutar: node supabase/migrate.mjs
// (el script carga .env automáticamente)

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env')
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv()

const SUPABASE_URL    = process.env.VITE_SUPABASE_URL    || ''
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY  || ''
const NLACE_RUT       = '77743235-4'
const NLACE_NOMBRE    = 'NLACE'
const CSV_URL         = 'https://docs.google.com/spreadsheets/d/1bkKIE2dD_HCBevKrunZa--mQH9rfUCZV26OKug7QJPM/export?format=csv&gid=1320604970'
const BATCH_SIZE      = 500

if (!SUPABASE_URL || !SUPABASE_SECRET) {
  console.error('Error: faltan VITE_SUPABASE_URL o SUPABASE_SECRET_KEY en .env')
  process.exit(1)
}

const HEADERS = {
  'apikey':        SUPABASE_SECRET,
  'Authorization': `Bearer ${SUPABASE_SECRET}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=minimal',
}

// ── Helpers ─────────────────────────────────────────────────

function parseFecha(str) {
  if (!str || !str.trim()) return null
  const s = str.trim()
  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  // DD-MM-YYYY
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  return null
}

function parseMonto(str) {
  if (!str) return null
  const cleaned = String(str).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseCSV(text) {
  const lines = text.split('\n')
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // Simple CSV split que maneja comillas
    const values = []
    let cur = '', inQuotes = false
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { values.push(cur); cur = '' }
      else { cur += ch }
    }
    values.push(cur)
    const row = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim() })
    rows.push(row)
  }
  return rows
}

function rowToRecord(row, empresaId) {
  return {
    empresa_id:          empresaId,
    cuenta_cble:         row['Cuenta_Cble']          || null,
    descripcion_cta:     row['Descripcion Cta.'] || row['Descripcion Cta'] || null,
    clasificacion_gasto: row['Clasificacion_Gasto']   || null,
    clasificacion_cto:   row['Clasificacion_Cto']     || null,
    tipo_cuenta:         row['Tipo_Cuenta']            || null,
    estado:              row['Estado']                 || null,
    mes_economico:       row['Mes_economico']          || null,
    ano_eco:             row['Ano_eco']                || null,
    monto_bruto:         parseMonto(row['monto_bruto']),
    fecha_emision:       parseFecha(row['Fecha_emision']),
    fecha_pago:          parseFecha(row['Fecha_Pago']),
    fecha_vencimiento:   parseFecha(row['Fecha_Vencimiento']),
    cliente:             row['Cliente']                || null,
  }
}

async function supabasePost(table, records) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(records),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Error insertando en ${table}: ${res.status} — ${err}`)
  }
}

async function insertBatches(table, records) {
  let inserted = 0
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    await supabasePost(table, batch)
    inserted += batch.length
    process.stdout.write(`  ${table}: ${inserted}/${records.length} filas\r`)
  }
  console.log(`  ${table}: ${inserted} filas insertadas ✓`)
  return inserted
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Migración NLACE: Google Sheets → Supabase')
  console.log('═══════════════════════════════════════════\n')

  // 1. Insertar NLACE en empresas
  console.log('1. Insertando empresa NLACE...')
  let empresaId
  try {
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/empresas?rut=eq.${NLACE_RUT}&select=id`, {
      headers: { 'apikey': SUPABASE_SECRET, 'Authorization': `Bearer ${SUPABASE_SECRET}` }
    })
    const existing = await checkRes.json()
    if (existing.length > 0) {
      empresaId = existing[0].id
      console.log(`   NLACE ya existe → empresa_id: ${empresaId}`)
    } else {
      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/empresas`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify({ nombre: NLACE_NOMBRE, rut: NLACE_RUT, plan: 'starter' }),
      })
      if (!insRes.ok) throw new Error(await insRes.text())
      const [emp] = await insRes.json()
      empresaId = emp.id
      console.log(`   NLACE insertada → empresa_id: ${empresaId}`)
    }
  } catch (e) {
    console.error('   Error con empresas:', e.message)
    process.exit(1)
  }

  // 2. Descargar CSV
  console.log('\n2. Descargando datos desde Google Sheets...')
  let csvText
  try {
    const res = await fetch(CSV_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    csvText = await res.text()
    console.log(`   CSV descargado (${(csvText.length / 1024).toFixed(0)} KB)`)
  } catch (e) {
    console.error('   Error descargando CSV:', e.message)
    process.exit(1)
  }

  // 3. Parsear y separar por tipo
  console.log('\n3. Procesando filas...')
  const allRows = parseCSV(csvText)
  const tiposValidos = ['Ingreso', 'Costo', 'Gasto', 'Remun']
  const filtered = allRows.filter(r => tiposValidos.includes((r['Tipo'] || '').trim()))

  const ventas         = filtered.filter(r => r['Tipo'].trim() === 'Ingreso').map(r => rowToRecord(r, empresaId))
  const costos         = filtered.filter(r => r['Tipo'].trim() === 'Costo').map(r => rowToRecord(r, empresaId))
  const gastos         = filtered.filter(r => r['Tipo'].trim() === 'Gasto').map(r => rowToRecord(r, empresaId))
  const remuneraciones = filtered.filter(r => r['Tipo'].trim() === 'Remun').map(r => rowToRecord(r, empresaId))

  console.log(`   Total filas válidas: ${filtered.length}`)
  console.log(`   • Ventas (Ingreso):       ${ventas.length}`)
  console.log(`   • Costos:                 ${costos.length}`)
  console.log(`   • Gastos:                 ${gastos.length}`)
  console.log(`   • Remuneraciones (Remun): ${remuneraciones.length}`)

  // 4. Insertar en Supabase
  console.log('\n4. Insertando en Supabase...')
  try {
    if (ventas.length > 0)         await insertBatches('ventas',         ventas)
    if (costos.length > 0)         await insertBatches('costos',         costos)
    if (gastos.length > 0)         await insertBatches('gastos',         gastos)
    if (remuneraciones.length > 0) await insertBatches('remuneraciones', remuneraciones)
  } catch (e) {
    console.error('\n   Error en inserción:', e.message)
    process.exit(1)
  }

  const total = ventas.length + costos.length + gastos.length + remuneraciones.length
  console.log(`\n═══════════════════════════════════════════`)
  console.log(`  Migración completa: ${total} filas migradas`)
  console.log(`  empresa_id NLACE: ${empresaId}`)
  console.log(`═══════════════════════════════════════════`)
}

main()
