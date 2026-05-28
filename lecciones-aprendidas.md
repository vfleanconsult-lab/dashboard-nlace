# Lecciones Aprendidas — Desarrollo con Claude Code

## Contexto

Proyecto: Dashboard financiero NLACE  
Stack: Vite 6 + React 18 + TypeScript + Tailwind CSS v4 + Supabase  
Modalidad: Claude Code en la web (sesiones remotas sin acceso a terminal local)

---

## 1. Cómo preparar el prompt inicial para una nueva funcionalidad

### Lo que funciona
- **Reglas de negocio numeradas** con casos borde explícitos
- **Ejemplos concretos del input real** — no describir el formato, adjuntar 3-5 filas reales del archivo
- **Decirle explícitamente qué módulo existente debe leer y replicar**: "lee ActualizarCostos.tsx y repite la misma lógica para este módulo nuevo, con estas reglas de negocio adicionales"
- **Adjuntar tablas de datos reales** que se usarán (catálogos, aliases, mapeos de estado)

### Lo que falla
- Confiar en que Claude infiera el patrón correcto leyendo el CLAUDE.md — el CLAUDE.md describe arquitectura, no detalles de implementación
- Asumir que Claude va a revisar el código existente por iniciativa propia — hay que pedirlo explícitamente
- Dejar datos críticos implícitos ("hay una tabla en algún lado") en lugar de pegarlos directamente en el prompt

### Plantilla recomendada para nuevas funcionalidades

```
Antes de implementar, lee [módulo de referencia].tsx y replica su estructura.

Objetivo: [qué hace este módulo]

Diferencias respecto al módulo de referencia:
- [diferencia 1]
- [diferencia 2]

Reglas de negocio:
1. [regla con ejemplo concreto]
2. ...

Datos de referencia:
[pegar tabla, catálogo o muestra del archivo real]

Muestra del archivo de entrada:
[pegar 3-5 filas reales]
```

---

## 2. Cuidado con prompts reescritos por otro modelo

**Problema vivido:** El prompt original tenía la tabla de aliases pegada directamente. Claude.ai reescribió el prompt mejorando el formato pero convirtió "aquí te dejo la tabla" en "existe un catálogo en Supabase" — perdiendo el dato concreto y creando una dependencia que no existía.

**Regla:** Cuando un modelo reescribe un prompt, revisar que los **datos concretos** (tablas, ejemplos, muestras) sobrevivieron intactos. El formato puede mejorar; los datos no pueden cambiar de significado.

---

## 3. Supabase — gotchas conocidos

| Problema | Causa | Fix |
|----------|-------|-----|
| Comparación de montos siempre falla | PostgREST devuelve `NUMERIC` como string | `Number(r.monto_bruto)` al leer; `Math.round(Number(...))` al comparar |
| Columna no encontrada en objeto JS | Nombre con mayúsculas/tildes (`"RUT"`, `DESCRIPCIÓN/MOVIMIENTO`) | Acceder con `a['RUT']` y tener fallbacks múltiples |
| Fetch falla silenciosamente | `catch {}` vacío oculta el error | Para datos críticos: hardcodear fallback + DB como fuente aditiva |
| Items "ya procesados" aparecen como sin coincidencia | Solo se consultan filas `Emitida`, no `Pagada` | Consultar también `Pagada/Pagada_parcial` y manejar como caso separado |

---

## 4. Datos bancarios — normalización incompleta

**Problema vivido:** Banco Santander entrega RUTs en dos formatos distintos en la misma cartola:
- Normalizado: `0776774340` (leading zero, sin puntos ni guión)
- Con formato: `77.719.165-9` (puntos y guión)

**Regla:** Siempre revisar una muestra real de la cartola antes de implementar el parseo. No asumir que el banco normaliza consistentemente.

**Fix implementado:**
```typescript
function extractRutFromDesc(desc: string): string {
  const m1 = desc.match(/^(\d{8,12})\s+Transf\.?(\s|$)/i)
  if (m1) return m1[1]
  const m2 = desc.match(/^(\d{1,2}\.\d{3}\.\d{3}-[\dkK])\s+Transf\.?(\s|$)/i)
  if (m2) return m2[1]
  return ''
}
```

---

## 5. Algoritmo de matching con fases — orden importa

Cuando hay un algoritmo de matching por fases (exacto → doble → parcial), cada fase debe **consumir el abono** antes de pasar a la siguiente. Si no, una factura ya pagada puede generar un falso match parcial en Phase 3.

**Patrón correcto:**
```typescript
if (match encontrado en Phase N) {
  usedAbo.add(abono._idx)  // ← consumir siempre
  continue                  // ← no caer a siguiente fase
}
```

---

## 6. Datos críticos pequeños: hardcodear > depender de BD

Si un catálogo es:
- Pequeño (< 20 filas)
- Estable (cambia raramente)
- Crítico para el funcionamiento del módulo

→ **Hardcodearlo en el código** y usar la BD como fuente aditiva opcional. Así funciona aunque el fetch falle.

```typescript
const ALIAS_CATALOG: AliasEntry[] = [
  { rut: '76477884-7', cliente: 'AGROINTEGRAL SPA', desc_mov: '0765500818 Transf. Chipax SpA' },
  // ...
]

// DB suma, no reemplaza
let aliases = [...ALIAS_CATALOG]
const { data } = await supabase.from('Catalogo_Clientes').select('*')
aliases = [...aliases, ...fromDB.filter(notAlreadyIn(aliases))]
```

---

## 7. Memoria entre sesiones — cómo maximizarla

### Problema
Cada sesión de Claude Code en la web comienza sin memoria de sesiones anteriores. El contexto compartido es solo lo que está en el repositorio.

### Lo que ayuda
- **CLAUDE.md bien documentado**: no solo arquitectura, sino reglas de negocio, gotchas conocidos, decisiones de diseño y el porqué
- **Commits descriptivos**: el historial de git es memoria — un buen mensaje de commit explica por qué, no solo qué
- **Decirle a Claude qué leer**: "lee el módulo X y replica su patrón" es más efectivo que asumir que lo hará solo

### Lo que ayudaría más (pendiente)
- Trabajar desde terminal local con proyecto abierto en Claude Code desktop → el contexto persiste entre chats dentro del proyecto
- Crear un archivo `PATRONES.md` o similar con los patrones de implementación recurrentes (parseo de cartola, verificación de duplicados, etc.) para que cada nueva sesión empiece desde ahí

---

## 8. UX — separar resultados por tipo

Mezclar resultados de distinta naturaleza en una sola tabla genera confusión. Cuando hay categorías claras, usar secciones visuales separadas:

- ✅ Verde: ya procesado, no requiere acción
- ⚠️ Ámbar: requiere revisión manual
- Lista principal: items accionables con checkbox

Los controles de acción (checkbox, modo prueba/producción) deben mostrarse solo cuando hay items accionables — si todo está en verde/ámbar, esconder los controles evita confusión.

---

## 9. Reflexión sobre el flujo de trabajo

El costo de una sesión sin contexto compartido se paga en:
- Ciclos de corrección evitables
- Tokens gastados en redescubrir terreno conocido
- Frustración cuando algo "debería funcionar" y no funciona

La inversión en documentación (CLAUDE.md, commits descriptivos, este archivo) no es overhead — es lo que hace que la próxima sesión empiece desde un nivel más alto.

---

*Documento generado en sesión del 28/05/2026 — Dashboard NLACE*
