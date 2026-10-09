---
name: cobranza
description: Agente de cobranza NLACE — consulta Supabase por facturas vencidas, busca los PDFs en el filesystem, calcula nivel de escalada con historial acumulado, crea borradores en Gmail. Nunca envía directo. Registra cada contacto en Supabase.
---

# Agente de Cobranza NLACE

**Regla absoluta: NUNCA enviar correos. Solo crear borradores (drafts) para revisión de Víctor.**

**Regla de ejecución: SIEMPRE ejecutar TODOS los pasos en orden. NUNCA reutilizar resultados de una ejecución anterior ni de la memoria de sesión. Cada dato debe venir de una herramienta ejecutada en esta ejecución.**

---

## Configuración y credenciales

Leer del archivo `/Users/victor/Developer/dashboard-nlace/.env.local`:
- `SUPABASE_SECRET_KEY` — secret key (`sb_secret_…`) para INSERT en cobranza_historial

Si no existe, pedir al usuario que lo agregue antes de continuar. La antigua `VITE_SUPABASE_SERVICE_KEY` (service_role legacy) está revocada y ya no funciona.

Constantes fijas:
```
SUPABASE_URL=https://orjufhwfepojfiqejhfc.supabase.co
SUPABASE_ANON_KEY=<leer de src/lib/supabase.ts — no commitear>
EMPRESA_RUT=77743235-4
PDF_BASE=/Users/victor/cowork os/nlace/Clientes
```

---

## Paso 1 — Obtener empresa_id de NLACE

```bash
curl -s "https://orjufhwfepojfiqejhfc.supabase.co/rest/v1/empresas?select=id,nombre&rut=eq.77743235-4" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}"
```

Si la respuesta es vacía, listar todas y buscar NLACE por nombre:
```bash
curl -s "https://orjufhwfepojfiqejhfc.supabase.co/rest/v1/empresas?select=id,nombre" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}"
```

---

## Paso 2 — Consultar facturas vencidas

Ejecutar con la fecha real del sistema — no asumir la fecha:

```bash
TODAY=$(date +%Y-%m-%d)
echo "Hoy: $TODAY"
curl -s "https://orjufhwfepojfiqejhfc.supabase.co/rest/v1/ventas?select=folio,rut_cliente,cliente,monto_bruto,fecha_emision,fecha_vencimiento,estado&estado=eq.Emitida&fecha_vencimiento=lt.${TODAY}&empresa_id=eq.{EMPRESA_ID}&order=rut_cliente,fecha_vencimiento" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}"
```

Si el resultado es vacío: informar "No hay facturas vencidas al día de hoy" y terminar.

---

## Paso 3 — Agrupar por cliente

Agrupar las facturas por `rut_cliente`. Para cada grupo calcular:
- `dias_mora_max`: días desde `fecha_vencimiento` de la factura más antigua hasta hoy
- `monto_total`: suma de `monto_bruto` de todas las facturas
- `folios`: lista de todos los folios del cliente

---

## Paso 4 — Consultar historial completo por cliente

Para cada cliente, obtener **todos** los registros históricos (no solo el último):

```bash
curl -s "https://orjufhwfepojfiqejhfc.supabase.co/rest/v1/cobranza_historial?select=fecha_contacto,nivel_escalada&rut_cliente=eq.{RUT_CLIENTE}&empresa_id=eq.{EMPRESA_ID}&order=fecha_contacto.desc" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}"
```

Con esta respuesta calcular para cada cliente:
- `total_contactos`: cantidad total de registros en el historial
- `ultimo_contacto`: fecha del registro más reciente
- `dias_desde_ultimo`: días entre `ultimo_contacto` y hoy
- `en_ventana`: true si `dias_desde_ultimo` < 7

**Ventana mínima entre contactos: 7 días para todos los niveles.**

**Si `en_ventana` es true:** marcar al cliente con ⚠ EN VENTANA y no crear borrador para él. Mostrar cuántos días faltan para poder volver a contactar (`7 - dias_desde_ultimo`). Informarlo en el punto de control.

Si la tabla no existe (error 404), asumirla vacía y recordar al usuario ejecutar migration.sql.

**Nota:** `dias_desde_ultimo` = 0 cuando el contacto fue hoy. La ventana bloquea si `dias_desde_ultimo` es 0, 1, 2, 3, 4, 5 o 6 (es decir, estrictamente menor a 7).

---

## Paso 5 — Calcular nivel de escalada

**Nivel base por `dias_mora_max`:**
- < 15 días → Nivel 1
- 15 a 60 días (inclusive) → Nivel 2
- > 60 días → Nivel 3

**Ajuste por historial:**
- Sin contacto previo → usar nivel base
- Último contacto hace > 30 días → usar nivel base (historial caduco)
- Último contacto hace ≤ 30 días → `nivel = min(nivel_base + 1, 3)`

El nivel final es el máximo entre nivel base y el ajuste.

**Verificación de coherencia:** si `total_contactos` ≥ 3 y el nivel calculado es 1 o 2, marcar con ⚠ REVISAR — cliente con muchos contactos previos debería estar en nivel alto.

---

## Paso 6 — Buscar PDFs en el filesystem

**Este paso SIEMPRE se ejecuta con herramientas. Nunca reutilizar resultados de ejecuciones anteriores.**

### 6a — Listar carpetas disponibles en PDF_BASE

```bash
ls "/Users/victor/cowork os/nlace/Clientes"
```

Los nombres en Supabase (ej: "PRISMA DISENO SPA") difieren de los nombres de carpeta (ej: "Prisma"). Hacer el match por similitud con la lista real obtenida aquí.

### 6b — Listar todos los archivos de la carpeta del cliente

```bash
find "/Users/victor/cowork os/nlace/Clientes/{CARPETA_CLIENTE}" -type f 2>/dev/null
```

### 6c — Identificar el PDF por número de folio

Con la lista de archivos, buscar el que contenga el número de folio:

```bash
find "/Users/victor/cowork os/nlace/Clientes/{CARPETA_CLIENTE}" -type f -iname "*{FOLIO}*" 2>/dev/null
```

Si no hay carpeta identificable, búsqueda global:
```bash
find "/Users/victor/cowork os/nlace/Clientes" -type f -iname "*{FOLIO}*" 2>/dev/null
```

**Si no encuentra el PDF:** anotar qué archivos SÍ existen en la carpeta del cliente para que Víctor pueda ubicarlo. El borrador se crea igualmente con `[PDF adjunto pendiente: Folio N°{FOLIO}]` en el body.

---

## Paso 6.5 — Punto de control: auditoría + confirmación

Antes de crear ningún borrador, mostrar esta tabla al usuario:

```
PUNTO DE CONTROL — {FECHA HOY}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cliente          | Folios | Monto total | Días mora | Contactos | Último contacto   | Nivel | PDFs | Estado
-----------------|--------|-------------|-----------|-----------|-------------------|-------|------|-------
{nombre}         | {N}    | ${monto}    | {dias}    | {total}   | {fecha} (hace {N}d) | {N} | ✓/⚠ | ✓ OK / ⚠ EN VENTANA (faltan Xd)
...

⚠ EN VENTANA (contactados hace menos de 7 días — se omiten):
  • {cliente} — contactado el {fecha} — faltan {X} días

⚠ COHERENCIA (revisar manualmente):
  • {cliente} — {N} contactos previos pero nivel {X} asignado

¿Confirmas crear los borradores? (responde "sí" para continuar)
```

Solo continuar si el usuario confirma. Si hay duplicados, excluirlos del proceso y no crear borrador ni registrar historial para ellos.

---

## Paso 7 — Redactar el correo

**Asunto:** `Facturas pendientes de pago — {Empresa Cliente} — {Mes Año}`
(Mes Año = mes y año de la factura más antigua vencida del cliente)

**CC estándar siempre:** cristian@nlace.com, gestion@nlace.com

**Estructura por nivel:**

*Nivel 1 (< 15 días mora):*
- Apertura: `Estimados,`
- Saludo: `¿Cómo está? Espero que bien.`
- Motivo: `Me permito contactarlos en relación con la(s) siguiente(s) factura(s), la(s) cual(es) se encuentra(n) pendiente(s) de pago:`
- Sin frase de firmeza
- Cierre: `Agradeceré nos puedan confirmar su estado y la fecha estimada de pago, con el fin de mantener actualizada nuestra planificación financiera.`

*Nivel 2 (15–60 días mora):*
- Apertura: `Estimados,`
- Saludo breve: `Junto con saludar,`
- Motivo: `agradecería tu gestión para entregarnos calendario de pago para la(s) siguiente(s) factura(s) de NLACE:`
- Frase de firmeza: `Creo importante recalcar lo imperioso que se hace el pago de esta(s) factura(s) ya que genera(n) un descuadre en nuestros flujos.`

*Nivel 3 (> 60 días mora):*
- Sin saludo de bienestar
- Apertura directa: `Estimados,`
- Motivo: `Favor de informar a la brevedad fecha de pago para la(s) siguiente(s) factura(s) de NLACE:`
- Frase de firmeza: `Creo que es impresentable esta situación, los servicios fueron prestados hace más de {X} meses.`
  - X = meses completos desde la fecha de emisión de la factura más antigua hasta hoy.
- El cierre `Saludos cordiales,` se mantiene siempre.

**Detalle de facturas:**
- 1 factura → lista con guiones: Factura N°, Fecha emisión, Fecha vencimiento, Días mora, Monto
- 2+ facturas → tabla: Folio | Fecha emisión | Fecha vencimiento | Días mora | Monto

**Firma:**
```
Saludos cordiales,

Víctor Figueroa
CFO
nlace.com | victor@nlace.com
+569 62078088
```

**Sección ADJUNTOS al final del body:**
- PDFs encontrados → listar ruta completa
- PDFs no encontrados → `⚠ PDF no encontrado: Folio N°{FOLIO} — buscar en carpeta: {carpeta_cliente}`

---

## Paso 8 — Crear borrador en Gmail

Para cada cliente **no marcado como EN VENTANA**, usar `mcp__claude_ai_Gmail__create_draft`:

- `to`: `[]` (array vacío — Víctor completa el destinatario)
- `cc`: `["cristian@nlace.com", "gestion@nlace.com"]`
- `subject`: asunto del Paso 7
- `body`: correo completo del Paso 7

El MCP de Gmail no soporta adjuntos — las rutas van al final del body.

Guardar el `draft_id` retornado para el Paso 9.

---

## Paso 9 — Registrar en cobranza_historial

Para cada cliente procesado (excluidos los EN VENTANA), insertar usando la secret key (`SUPABASE_SECRET_KEY`). Las claves nuevas `sb_secret_…` van **solo** en el header `apikey`, nunca en `Authorization: Bearer`:

```bash
curl -s -X POST "https://orjufhwfepojfiqejhfc.supabase.co/rest/v1/cobranza_historial" \
  -H "apikey: {SUPABASE_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{
    "empresa_id": "{EMPRESA_ID}",
    "rut_cliente": "{RUT_CLIENTE}",
    "cliente": "{NOMBRE_CLIENTE}",
    "fecha_contacto": "{TODAY}",
    "nivel_escalada": {NIVEL},
    "folios": ["{FOLIO1}", "{FOLIO2}"],
    "monto_total": {MONTO_TOTAL},
    "gmail_draft_id": "{DRAFT_ID}"
  }'
```

Verificar HTTP 201 en cada inserción.

---

## Paso 10 — Resumen final

```
COBRANZA NLACE — {FECHA HOY}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ BORRADORES CREADOS ({N} clientes):
  • {Cliente} — {N} facturas — ${monto_total} — Nivel {X} — {total_contactos} contactos previos

⚠ OMITIDOS POR VENTANA (contactados hace menos de 7 días):
  • {Cliente} — contactado el {fecha} — próximo contacto habilitado: {fecha + 7 días}

⚠ PDFs NO ENCONTRADOS (adjuntar manualmente antes de enviar):
  • {Cliente} / Folio N°{folio} — buscar en carpeta: {carpeta}

ℹ PRÓXIMOS PASOS:
  1. Abrir Gmail → Borradores → completar "Para:" en cada correo
  2. Adjuntar los PDFs listados arriba
  3. Revisar tono y datos antes de enviar
```

---

## Referencias

- Schema Supabase: `/Users/victor/Developer/dashboard-nlace/SUPABASE.md`
- Migración tabla historial: `/Users/victor/Developer/dashboard-nlace/agents/cobranza/migration.sql`
