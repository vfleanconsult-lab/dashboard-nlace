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
- INSERT/UPDATE: requiere `service_role` vía `VITE_SUPABASE_SERVICE_KEY`

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto (tiene fallback hardcodeado) |
| `VITE_SUPABASE_ANON_KEY` | Clave pública para lectura (tiene fallback hardcodeado) |
| `VITE_SUPABASE_SERVICE_KEY` | Clave service_role legacy `eyJ...` para INSERTs/UPDATEs |

> `VITE_SUPABASE_SERVICE_KEY` debe ser la key **legacy** en formato `eyJ...`. La nueva `sb_secret_...` está bloqueada en browser.

## Mapper y columnas clave

`supabaseToRow()` en `data.ts` convierte snake_case de Supabase a nombres del CSV original.

**Columnas clave en el modelo JS:**
`Tipo` (Ingreso/Costo/Gasto/Remun) · `Cuenta_Cble` · `Descripcion Cta.` · `Clasificacion_Gasto` · `Clasificacion_Cto` · `Tipo_Cuenta` · `Estado` · `Mes_economico` (YYYY-MM) · `Ano_eco` (YYYY) · `monto_bruto` · `Fecha_emision` · `Fecha_Pago`

**Valores de `Estado`:**
- `"Emitida"` — factura emitida, aún no pagada
- `"Pagada"` — pago total recibido
- `"Pagada_parcial"` — pago parcial recibido

## Reglas de negocio en `data.ts` — no tocar

- Ventas: `Tipo === "Ingreso" && Cuenta_Cble === "5101-01"`
- Costos: `Tipo === "Costo"`
- Gastos: `Tipo === "Gasto"` excluyendo retiro de directores
- `isPagado(row)`: evalúa `Estado ∈ { "Emitida", "Pagada", "Pagada_parcial" }` — usado en vistas de devengado
