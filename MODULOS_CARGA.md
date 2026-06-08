# MODULOS_CARGA.md — Módulos de carga de datos

Hub de navegación: `ActualizarDatos.tsx` (`/actualizar`) — 5 tarjetas en grid 3 columnas.
Ningún módulo de carga usa `useData()`, `useFilter()` ni `PageHeader`.

| Módulo | Ruta | Color |
|--------|------|-------|
| Costos | `/actualizar-costos` | `nl-primary` (azul) |
| Gastos | `/actualizar-gastos` | `nl-accent` (naranja) |
| Ingresos | `/actualizar-ventas` | `nl-success` (verde) |
| Estado Facturas | `/actualizar-estado-facturas` | `violet` |
| Ingreso Manual | `/ingreso-manual` | `slate` |

Al añadir un módulo, agregar color en `colorMap` e `iconColorMap` de `ActualizarDatos.tsx`.

---

## Reglas comunes — cartola Santander (Costos y Gastos)

- Archivo `.xlsx`, librería `xlsx` (SheetJS)
- Datos desde **fila 17** (índice 16): `[0]=MONTO | [1]=DESCRIPCIÓN | [3]=FECHA`
- Solo filas donde `monto < 0` (cargos). Se detiene en `"Resumen comisiones"`.
- `monto_bd = Math.abs(monto_cartola)` — Supabase siempre recibe positivo.

**Flujo:** Upload → Verificación duplicados → Preview con checkboxes → Modo prueba/producción → Resultado

**Mes económico editable:** cada fila tiene `<input type="month">` para `mes_economico`. Por defecto = mes de `fecha_pago`. Al modificar se resalta y `ano_eco` se recalcula.

**Cliente Supabase para escritura:** `supabaseAdmin` con `VITE_SUPABASE_SERVICE_KEY`. Si no está definida, cae al cliente `anon` (fallará por RLS).

**Detección de duplicados:** huella `fecha_pago|monto_bruto|descripcion_glosa`. Badge **YA EXISTE**, desmarcadas por defecto.

---

## ActualizarCostos

### Catálogos

**`CATALOG_SOFTWARE`** (24 proveedores) — keywords en glosa (case insensitive, `includes`)
→ tabla `costos`, cuenta `4101-09`, clasificacion `Costo_Gto_Explot`

**`CATALOG_EQUIPO`** (11 personas) — `id_norm` al inicio de la glosa (`startsWith`)
→ 10 personas: tabla `costos`, cuenta `4101-01`, clasificacion `Costo_Vta`
→ Cristian Labarca: tabla `remuneraciones`, cuenta `4401-02`, `clasificacion_gasto: "Retiros"`, `tipo_cuenta: "Gasto_Retiro"`

### Campos insertados

**`costos`:** `empresa_id · cuenta_cble · descripcion_cta · clasificacion_cto · clasificacion_gasto · tipo_cuenta · monto_bruto · fecha_emision · fecha_pago · mes_economico · ano_eco · estado · descripcion_glosa`

**`remuneraciones`** (sin `descripcion_glosa`): mismos campos base. `estado` siempre `"Pagada"`.

---

## ActualizarGastos

### Catálogo (11 categorías, orden importa — específicas antes que genéricas)

| # | Categoría | Tipo_Cuenta | Cuenta | Keywords clave |
|---|-----------|-------------|--------|----------------|
| 1 | Honorarios | Gasto_Adm | 4201-02 | OLGA, RAMIREZ, VICTOR FIGUEROA, RUTs |
| 2 | ERP | Gasto_ERP | 4201-37 | TOKU, NUBOX PAY, HAULMER |
| 3 | Marketing | Gasto_Mkg | 4301-03 | FACEBK, FACEBOOK, META |
| 4 | Cobranza | Gasto_Cobranza | 4301-02 | NP PAYU, PAYU |
| 5 | Abogados | Gasto_Legl | 4201-12 | RUT 76.229.620-9, FLORES ACEVEDO, NOTARIA |
| 6 | Banco | Gasto_Adm | 4201-10 | COM.MANTENCION, LCA N°, INTERESES LINEA, SOBREGIRO |
| 7 | Otros | Gasto_Otros | 4301-05 | PENTA HIPOTECARIO, MERPAGO*MELIMAS |
| 8 | Bencina | Gasto_Benc | 4201-26 | SHELL, ARAMCO, COMBUSTIBLE, BENCINA |
| 9 | Restorant | Gasto_Rest | 4201-09 | STARBUCKS, SBX ROSARIO, UBER EATS, KHIPU, CAFE, RESTAURANT, NUNOA, LUNKAI, MERCADOPAGO *LAFR, EL TOLDO AZUL, POINT 24H… |
| 10 | Estacionamiento | Gasto_Mov | 4201-26 | SABA, PARKING, SIMPLEPARK, AKIPARK, SUCURSAL PARQUE, VIDA PARQUE, CONCESA, ROSARIO NORTE… |
| 11 | Movilizacion | Gasto_Mov | 4201-26 | CABIFY, UBER, SMARTYCAR |

> **Restorant va antes de Movilizacion** — "UBER EATS" debe clasificar como restaurante, no taxi.

`norm()`: uppercase + NFD + elimina diacríticos. Se aplica a glosa y keywords.

**Exclusión:** glosas con `LCA` + `AMORTIZACION PERIODICA` → cuotas de crédito bancario, se excluyen.

### Campos insertados (`gastos`)

`empresa_id · cuenta_cble · descripcion_cta · clasificacion_gasto · tipo_cuenta · monto_bruto · fecha_emision · fecha_pago · mes_economico · ano_eco · estado · descripcion_glosa`

No lleva `clasificacion_cto` (NULL para todos los gastos operacionales).

---

## ActualizarVentas

Archivo: `.csv` Nubox, separador `;`, encoding UTF-8 con fallback ISO-8859-1.

| Aspecto | Valor |
|---------|-------|
| Columnas CSV | `Fecha`, `Folio`, `Rut Cliente`, `Cliente`, `Monto total`, `Estado`, `Fecha vencimiento`, `Documento` |
| Fechas | `DD/MM/YYYY` → `YYYY-MM-DD` |
| Montos | `"1.234.567,00"` → float |
| `Documento` | Solo clasificación interna — no se guarda en Supabase |

**Mapeo de estado:** `Emitido→Emitida` · `Pagado→Pagada` · `Pagado Parcial→Pagada_parcial` · `Anulado→Anulada`

### Detección de duplicados
- Huella: `folio|fecha_emision|rut_cliente`
- `normRut`: elimina `.` — `"76.229.620-9"` == `"76229620-9"`
- Rango de consulta: `YYYY-MM-01` → `new Date(y, m, 0).getDate()` — **no usar `-31` fijo** (meses <31 días generan error Postgres 22008 que silencia la detección)
- Duplicados: checkbox bloqueado en rojo, excluidos de `selRows` y `toggleAll`

### Lógica de notas de crédito (N/C-EL)
1. N/C se empareja con la FAC de **menor folio** del mismo cliente y monto → esa FAC es la anulada
2. Par N/C + FAC anulada: `isAutoExcluded = true` → sección "Excluidas automáticamente"
3. FAC de folio más alto queda disponible para cargar
4. N/C sin par → `isNcAnterior = true`, badge **"factura mes anterior"**, seleccionada por defecto

### Campos insertados (`ventas`)

`empresa_id · cuenta_cble · descripcion_cta · folio · rut_cliente · cliente · monto_bruto · fecha_emision · fecha_vencimiento · estado · mes_economico · ano_eco`

Valores fijos: `cuenta_cble = '5101-01'` · `descripcion_cta = 'VENTAS'` · `empresa_id = '02832e85-f5d9-43d6-a911-0bdf3e3e1a4a'`

---

## ActualizarEstadoFacturas

Lee cartola Santander (.xlsx), filtra **abonos** (monto positivo). Operación: UPDATE `ventas` de `Emitida → Pagada`.

- **CartolaHistCtaCte**: header fila 16, datos desde fila 17
- **CartolaProvisoria**: header fila 13, datos desde fila 14

### Extracción de RUT del pagador

Descripción del banco: `{RUT} Transf.? {nombre}`. Dos formatos:
- Dígitos con leading zero: patrón `^\d{8,12}\s+Transf`
- Con puntos y guión: patrón `^\d{1,2}\.\d{3}\.\d{3}-[\dkK]\s+Transf`

Normalización para comparación: elimina `.`, `-`, espacios y leading zeros.

### Catálogo de aliases (`ALIAS_CATALOG`)

Clientes que pagan vía terceros — hardcodeado como fuente de verdad; `Catalogo_Clientes` en Supabase suma de forma aditiva.

| desc_mov (keyword) | RUT cliente | Cliente |
|-------------------|-------------|---------|
| `0765817307 PAGO PROVEEDOR PODCAST` | 76581730-7 | NOISE SPA |
| `0765500818 Transf. Chipax SpA` | 76477884-7 | AGROINTEGRAL SPA |
| `0765500818 Transf. Chipax SpA` | 76389181-K | VENTA DE INSUMOS AGRICOLAS MATHIAS QUIROZ AHUMADA E.I.R.L. |

`Catalogo_Clientes` en Supabase: columnas `"RUT"` (TEXT, quoted uppercase), `cliente`, `descripcion_movimiento`.

### Algoritmo de matching — 3 fases

**Phase 1 — Exacto (RUT + monto):** busca en `ventas.Emitida`, `monto_bruto` exacto con `Number()` (NUMERIC viene como string de PostgREST)

**Phase 1b — YA EXISTE:** match en `Pagada/Pagada_parcial` → alerta verde "Ya procesada", consume el abono

**Phase 2 — Doble pago mismo mes:** par de abonos del mismo RUT + mes que sumen el `monto_bruto` de una Emitida

**Phase 3 — Parcial cross-mes:** abono < `monto_bruto` → UPDATE original (Pagada_parcial) + INSERT nueva fila (Emitida, monto = remainder)

### Campos actualizados

Match simple/doble: `estado = 'Pagada'`, `fecha_pago = YYYY-MM-DD`

Match parcial: fila original `estado = 'Pagada_parcial'`, `monto_bruto = abono`; nueva fila INSERT con `estado = 'Emitida'`, `monto_bruto = remainder`

---

## IngresoManualPartidas

Wizard 3 pasos — INSERT de una sola fila. No usa `useData()`, `useFilter()` ni `PageHeader`.

**Paso 1:** Elige tabla (`ventas` / `costos` / `gastos` / `remuneraciones`)

**Paso 2:** `SELECT DISTINCT cuenta_cble, descripcion_cta FROM {tabla}` — dinámico, sin hardcodeo

**Paso 3:** Campos comunes: `fecha_emision` (req.) · `fecha_pago` · `fecha_vencimiento` · `monto_bruto` (req.) · `estado` (default Emitida) · `mes_economico` (auto desde `fecha_emision`, sobreescribible)

Campos adicionales por tabla:
- **ventas**: `folio`, `rut_cliente`, `cliente` (todos req.)
- **costos**: `descripcion_glosa` · `clasificacion_cto` · `tipo_cuenta` (selects dinámicos)
- **gastos**: `descripcion_glosa` · `clasificacion_gasto` (req.) · `tipo_cuenta` (req.)
- **remuneraciones**: solo comunes (`clasificacion_gasto = 'Retiros'`, `tipo_cuenta = 'Gasto_Retiro'` fijos)

`mes_economico` sigue a `fecha_emision` hasta edición manual (`_mes_manual = '1'`). `ano_eco` siempre derivado de `mes_economico`.
