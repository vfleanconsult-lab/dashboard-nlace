---
name: informe-ceo
description: Genera el informe ejecutivo mensual .pptx (6 slides) para la reunión CFO→CEO de NLACE, con datos financieros reales desde Supabase e identidad visual de marca. Usar cuando pidan "informe CEO", "informe mensual", "presentación para el CEO", "informe ejecutivo" o el reporte del mes para la reunión de finanzas.
---

# Informe CEO — NLACE

Genera un informe ejecutivo mensual en PowerPoint (.pptx) para que el CFO lo lleve a la reunión de finanzas con el CEO. Combina datos reales extraídos de Supabase con una narrativa ejecutiva que tú (el agente) escribes.

No hay llamada a la API de Claude — tú mismo redactas la narrativa en el paso 3, con el contexto que ya tienes disponible en la conversación.

## Flujo

### 1. Determinar el mes a analizar

Si el usuario especifica un mes (ej. "el informe de junio"), úsalo como `YYYY-MM`.

Si no especifica mes, no pases `--mes` — el script elige automáticamente el último mes con datos de ventas y gastos, y si ese mes es el mes calendario en curso, retrocede uno (los datos del mes en curso suelen estar incompletos). El script imprime por stderr su decisión y los meses disponibles: revisa ese log antes de continuar, y si el volumen de datos del mes elegido se ve bajo o incompleto, confírmalo con el usuario o pide que fuerce un mes anterior con `--mes`.

### 2. Extraer los datos

```bash
npx tsx .claude/skills/informe-ceo/scripts/fetch-datos.ts [--mes YYYY-MM] --out output/datos-YYYY-MM.json
```

Esto consulta Supabase (misma fuente que el dashboard), calcula el Estado de Resultado, los indicadores con semáforo, gastos por clasificación, cobranza y contexto YTD para el mes elegido (N) y el mes anterior (N-1). Revisa el JSON generado.

### 3. Escribir la narrativa ejecutiva

Lee `output/datos-YYYY-MM.json` y escribe (con la herramienta Write) `output/narrativa-YYYY-MM.json` siguiendo exactamente este schema:

```jsonc
{
  "titular": "Frase corta que resume el mes (ej: 'Mes de crecimiento sostenido con presión en gastos administrativos')",
  "resumenEjecutivo": [
    "Párrafo 1 — panorama general: ingresos, margen, resultado vs mes anterior.",
    "Párrafo 2 — lo más relevante en gastos o cobranza.",
    "Párrafo 3 (opcional) — riesgos o focos de atención para el CEO."
  ],
  "comentarioIngresos": "1-2 frases sobre ingresos y margen operacional vs mes anterior.",
  "comentarioGastos": "1-2 frases sobre la variación de gastos por clasificación más relevante.",
  "comentarioCobranza": "1-2 frases sobre DSO, monto pendiente y riesgo de cobranza.",
  "comentarioIndicadores": "1-2 frases explicando el resultado del semáforo (por qué está verde/amarillo/rojo)."
}
```

Guía de estilo:
- Tono ejecutivo, directo, español de Chile.
- Cifras en formato `$12.345.678` (usa los montos ya calculados en el JSON de datos, no los recalcules).
- `resumenEjecutivo`: 2 a 4 párrafos, informe completo en menos de ~120 palabras.
- Prioriza variaciones vs el mes anterior sobre valores absolutos.
- Si el DSO es alto o hay facturas fuertemente vencidas, menciónalo como riesgo — no lo omitas.
- Sin adjetivos vacíos ("excelente", "increíble"); deja que las cifras hablen.

### 4. Generar el .pptx

```bash
npx tsx .claude/skills/informe-ceo/scripts/generar-pptx.ts \
  --datos output/datos-YYYY-MM.json \
  --narrativa output/narrativa-YYYY-MM.json \
  --out "output/Informe-CEO-NLACE-YYYY-MM.pptx"
```

El script valida que la narrativa tenga todos los campos requeridos y falla con un mensaje claro si falta alguno.

### 5. Reportar al usuario

Indica la ruta del archivo generado, un resumen de las cifras clave (ingresos, EBITDA, DSO) y el color del semáforo. Recuérdale que las fuentes Space Grotesk e Inter deben estar instaladas en la máquina donde abra el .pptx para verse con la tipografía de marca — si no lo están, PowerPoint usará una fuente de reemplazo del sistema (aceptable, no bloqueante).

## Slides generadas

1. Portada — logo NLACE, mes/año, título.
2. Resumen ejecutivo — narrativa + cifras destacadas.
3. Ingresos y Margen Operacional vs mes anterior (gráfico de barras + serie YTD).
4. Gastos por clasificación (gráfico comparativo + tabla con variación %).
5. Estado de cobranza CxC (DSO, monto pendiente, tasa de pago, top facturas vencidas).
6. Indicadores de resultado: Margen Operacional %, Resultado Operacional % y EBITDA, con semáforo (verde ≥5% margen EBITDA, amarillo 0–5%, rojo <0%).

## Notas técnicas

- Los scripts reutilizan `src/lib/data.ts` del dashboard (misma lógica de cálculo que usa la web — `EstadoResultado.tsx`, `Cobranzas.tsx`, `Gastos.tsx`), así que las cifras del informe siempre coinciden con lo que muestra el dashboard.
- Usan la Supabase anon key de solo lectura ya presente en el repo — no requieren credenciales adicionales.
- `output/` está en `.gitignore`: los JSON intermedios y el .pptx no se versionan.
