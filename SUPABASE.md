# SUPABASE.md — Fuente de datos

**Proyecto:** `https://orjufhwfepojfiqejhfc.supabase.co`

Los datos se leen desde la vista `registros_contables` filtrada siempre por `empresa_id`.
Cliente en `src/lib/supabase.ts`. Empresa activa definida por `EMPRESA_RUT`.

## Tablas

| Tabla | Contenido |
|-------|-----------|
| `empresas` | Tabla maestra de clientes SaaS |
| `ventas` | Facturas e ingresos (`Tipo = Ingreso`) |
| `costos` | Costos de operación (`Tipo = Costo`) |
| `gastos` | Gastos operacionales (`Tipo = Gasto`) |
| `remuneraciones` | Remuneración directores (`Tipo = Remun`) |

`registros_contables` — UNION ALL de las 4 tablas con columna `tipo` sintética, `security_invoker = on`.

## Schema de columnas

**Todas las tablas (base):**
```
empresa_id, cuenta_cble, descripcion_cta, clasificacion_gasto,
clasificacion_cto, tipo_cuenta, estado, mes_economico, ano_eco,
monto_bruto (NUMERIC), fecha_emision (DATE), fecha_pago (DATE),
fecha_vencimiento (DATE), cliente, creado_en
```

**Columnas adicionales:**
- `ventas`: `rut_cliente` (TEXT), `folio` (TEXT)
- `costos` y `gastos`: `descripcion_glosa` (TEXT)

## RLS y variables de entorno

- SELECT: `anon` y `authenticated` pueden leer
- INSERT/UPDATE: requiere `service_role`, usada **solo en servidor** por `api/db-write.ts` (el navegador nunca la tiene)

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto (tiene fallback hardcodeado) |
| `VITE_SUPABASE_ANON_KEY` | Clave pública para lectura (tiene fallback hardcodeado) |
| `SUPABASE_SERVICE_KEY` | service_role, **solo servidor** (env de Vercel, sin prefijo `VITE_`) |
| `CLERK_SECRET_KEY` | Secret Key de Clerk, solo servidor: `api/db-write.ts` valida la sesión y el dominio `@nlace.com` |

> **Nunca** poner `service_role` en una variable `VITE_*`: Vite la publica en el bundle. Escritura desde el front = `src/lib/supabaseAdmin.ts` → `POST /api/db-write` (tablas ventas/costos/gastos/remuneraciones; update solo `ventas.estado/fecha_pago/monto_bruto`). Los skills locales (cobranza/reconciliar) leen la clave de `.env.local`.

## Tabla de cobranza

| Tabla | Contenido |
|-------|-----------|
| `cobranza_historial` | Registro de contactos del agente de cobranza — usado para calibrar nivel de escalada |

**Schema `cobranza_historial`:**
```
empresa_id, rut_cliente, cliente, fecha_contacto (DATE), nivel_escalada (1/2/3),
folios (TEXT[]), monto_total (NUMERIC), gmail_draft_id (TEXT), creado_en
```
- SELECT: `anon` y `authenticated` pueden leer
- INSERT: requiere `service_role` vía `VITE_SUPABASE_SERVICE_KEY`
- Skill que la usa: `.claude/commands/cobranza.md`

---

## Mapper y columnas clave

`supabaseToRow()` en `data.ts` convierte snake_case de Supabase a nombres del CSV original.

**Columnas clave en el modelo JS:**
`Tipo` (Ingreso/Costo/Gasto/Remun) · `Cuenta_Cble` · `Descripcion Cta.` · `Clasificacion_Gasto` · `Clasificacion_Cto` · `Tipo_Cuenta` · `Estado` · `Mes_economico` (YYYY-MM) · `Ano_eco` (YYYY) · `monto_bruto` · `Fecha_emision` · `Fecha_Pago`

**Valores de `Estado`** (lista completa en `ESTADOS` de `IngresoManualPartidas.tsx`):

| Estado | Significado | Devengado (`isPagado()`) | Caja (Cashflow) |
|---|---|:---:|:---:|
| `Emitida` | Factura emitida, pago aún no recibido | Sí | No |
| `Pagada` | Pago total recibido | Sí | Sí |
| `Pagada_parcial` | Pago parcial recibido | Sí | Sí |
| `No Pagada` | Provisión/factura pendiente (no es lo mismo que `Emitida`) | No | No |
| `Anulada` | Factura anulada (mapeada desde `ANULADO` del SII) — excluida de todo cálculo | No | No |
| `Anticipo` | Anticipo de cliente, dinero recibido sin factura formal (sin `folio`) | No | Sí |

`isPagado()` (`data.ts:151`) = `Emitida` ∨ `Pagada` ∨ `Pagada_parcial` — usado en vistas de devengado (Estado de Resultado).
Cashflow (`Cashflow.tsx:111`) = `Pagada` ∨ `Pagada_parcial` ∨ `Anticipo` — base caja, solo estados con movimiento real de dinero.
`ActualizarVentas.tsx` mapea automáticamente el CSV del SII: `EMITIDO → Emitida`, `PAGADO → Pagada`, `PAGADO PARCIAL → Pagada_parcial`, `ANULADO → Anulada`.

## Reglas de negocio en `data.ts` — no tocar

- Ventas: `Tipo === "Ingreso" && Cuenta_Cble === "5101-01"`
- Costos: `Tipo === "Costo"`
- Gastos: `Tipo === "Gasto"` excluyendo retiro de directores
- `isPagado(row)`: evalúa `Estado ∈ { "Emitida", "Pagada", "Pagada_parcial" }` — usado en vistas de devengado
