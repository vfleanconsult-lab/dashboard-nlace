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

---

## Sesión 01/06/2026

### Lo que se construyó

**Módulo Ingreso Manual de Partidas** (`/ingreso-manual`)

Wizard de 3 pasos para registrar partidas contables directamente en Supabase, sin necesidad de importar un archivo:

1. **Paso 1 — Selección de tabla**: ventas / costos / gastos / remuneraciones, con tarjetas visuales coloreadas
2. **Paso 2 — Cuenta contable**: query dinámica `SELECT DISTINCT cuenta_cble, descripcion_cta` desde Supabase — se adapta automáticamente si las cuentas cambian
3. **Paso 3 — Formulario**: campos según la tabla seleccionada (ventas incluye folio/rut/cliente; gastos incluye clasificacion_gasto/tipo_cuenta; los selects de valores como clasificacion_cto se cargan dinámicamente desde la BD)

Características:
- `mes_economico` se auto-deriva de `fecha_emision` al escribir la fecha
- Modo prueba (JSON preview sin insertar) / Modo producción (INSERT real)
- Validación de campos requeridos antes de enviar
- Breadcrumb navegable entre pasos
- Pantalla de éxito con opción "nueva partida misma cuenta" o "nuevo ingreso"
- Tarjeta "Ingreso Manual" añadida al hub `/actualizar` (grid ampliado a 3 columnas)

---

### Entorno local — herramientas instaladas

En esta sesión se configuró el Mac mini con todas las herramientas necesarias para que Claude Code opere de forma autónoma en el flujo git + GitHub:

| Herramienta | Ruta | Uso |
|-------------|------|-----|
| Homebrew | `/opt/homebrew/bin/brew` | Gestor de paquetes base |
| GitHub CLI (`gh`) | `/opt/homebrew/bin/gh` | PR, merge, ramas — autenticado como `vfleanconsult-lab` |
| jq | `/usr/bin/jq` | Procesamiento JSON en terminal |
| Playwright + Chromium | `/opt/homebrew/bin/playwright` | Verificaciones visuales del dashboard |

**Regla importante:** usar siempre rutas absolutas `/opt/homebrew/bin/gh` etc. porque el PATH de las sesiones de Claude Code no incluye `/opt/homebrew/bin` por defecto.

---

### 10. Flujo git completo desde Claude Code (con gh CLI)

Con `gh` instalado y autenticado, Claude Code puede ejecutar el ciclo completo sin intervención:

```bash
git checkout -b feat/nombre-rama
# ... hacer cambios ...
git add <archivos específicos>
git commit -m "feat: descripción"
git push -u origin feat/nombre-rama     # requiere gh auth para HTTPS
gh pr create --title "..." --body "..."
gh pr merge --merge --delete-branch
```

**Antes** (sin gh): el usuario tenía que hacer push y crear/mergear el PR manualmente porque el remote HTTPS pedía credenciales que no funcionan con login de Google.

**Ahora**: Claude Code hace todo el flujo excepto lo que requiere `sudo`.

---

### 11. Login con Google en GitHub — cómo autenticar la terminal

Si el usuario usa Google OAuth para entrar a GitHub (no tiene password de GitHub), la autenticación en terminal se hace así:

```bash
# Opción 1 — gh CLI (recomendado, soporta Google via browser)
gh auth login
# → GitHub.com → HTTPS → Login with a web browser

# Opción 2 — Personal Access Token
# github.com/settings/tokens/new → scope: repo → usar token como password en git push
```

**No usar**: `git push` con usuario/password — falla con Google OAuth porque no hay password de GitHub.

---

### 12. Limpieza de ramas mergeadas

Después de cada sprint o al acumular ramas, limpiar con:

```bash
# Ver todas las ramas remotas
/opt/homebrew/bin/gh api repos/OWNER/REPO/branches --paginate --jq '.[].name'

# Verificar que no hay PRs abiertos
/opt/homebrew/bin/gh api repos/OWNER/REPO/pulls --jq '.[].head.ref'

# Eliminar rama remota
/opt/homebrew/bin/gh api -X DELETE repos/OWNER/REPO/git/refs/heads/RAMA

# Sincronizar y limpiar local
git checkout main && git pull origin main
git branch -D nombre-rama
```

En esta sesión se eliminaron 9 ramas mergeadas dejando solo `main`.

---

*Sesión del 01/06/2026 — Dashboard NLACE*

---

## Sesión 08/06/2026

### Lo que se construyó

**1. Optimización de CLAUDE.md**

El archivo había crecido a 909 líneas mezclando arquitectura, implementación e historial. Se redujo a 616 líneas (-32%) eliminando:
- Sección "Entorno de desarrollo" (ya en memoria del proyecto)
- Conteos de filas de migración de mayo 2025 (datos obsoletos)
- Cuerpos completos de funciones TypeScript (`norm()`, `isExcluded()`, `extractRutFromDesc()`) — están en el código
- Snippets de código que solo ilustraban prosa ya escrita en texto
- Referencias a números de PR (historial de git, no documentación)

Todo el contenido crítico se conservó: reglas de negocio, invariantes de fechas, esquemas de campos, catálogos de matching, lógica de duplicados.

**2. Autenticación con Clerk.com**

Integración completa de login con restricción de dominio `@nlace.com` (configurada en panel de Clerk, no en código):

- `src/main.tsx` — `ClerkProvider` envuelve toda la app, lee `VITE_CLERK_PUBLISHABLE_KEY`
- `src/pages/LoginPage.tsx` — página de login con `NlaceLogo` + componente `<SignIn />` de Clerk
- `src/components/ProtectedRoute.tsx` — redirige a `/login` si no hay sesión activa; spinner mientras Clerk carga
- `src/App.tsx` — ruta `/login/*` pública; todas las rutas del dashboard envueltas en `<ProtectedRoute>`
- `src/components/Sidebar.tsx` — botón "Cerrar sesión" con `useClerk().signOut({ redirectUrl: '/login' })`

---

### 13. Dónde documentar cada tipo de información

Aclaración importante sobre dónde va cada cosa, para sesiones futuras:

| Tipo de contenido | Dónde va |
|-------------------|----------|
| Arquitectura, reglas de negocio, esquemas de BD | `CLAUDE.md` |
| Lecciones aprendidas, log de sesiones, patrones | `lecciones-aprendidas.md` (este archivo) |
| Decisiones de contexto rápido entre sesiones | Memoria del proyecto (`.claude/memory/`) |
| Historial de cambios con autor y fecha | `git log` (commits descriptivos) |

**Regla:** `CLAUDE.md` es para lo que Claude necesita saber *siempre*. `lecciones-aprendidas.md` es para lo que el equipo necesita recordar entre sesiones. No mezclarlos.

---

### 14. Clerk en Vite — variable de entorno y dominio

**Solo se necesita `VITE_CLERK_PUBLISHABLE_KEY`** — este proyecto es SPA puro sin backend. `CLERK_SECRET_KEY` es para servidores Node.js/Next.js y no aplica.

**Pantalla en blanco en producción = error de runtime en browser**, no en Vercel. Los runtime logs de Vercel no capturan errores de SPAs estáticos. Para diagnosticar: abrir DevTools → Console en el browser.

**Causa raíz del problema:** la variable en Vercel tenía un valor incorrecto. Solución: borrarla y recrearla con el valor exacto de la Publishable Key.

**Si vuelve a pasar:** verificar primero el valor de `VITE_CLERK_PUBLISHABLE_KEY` en Vercel → Settings → Environment Variables antes de buscar causas en el código.

---

*Sesión del 08/06/2026 — Dashboard NLACE*

---

## Sesión 01/08/2026 — Cuadre de ingresos en la reconciliación

### 15. Cuadrar el flujo de caja contra los saldos del banco

La reconciliación mensual (`/reconciliar`) por defecto solo cuadra egresos. Cuando el flujo de caja no coincide con el saldo del banco, el problema está en los **ingresos** (abonos no registrados como ventas cobradas).

**Verificación definitiva:** la cartola BCI trae su propio resumen de saldos (filas 8-10: `SALDO INICIAL | ... | OTROS ABONOS | ... | OTROS CARGOS | ... | SALDO FINAL`). El flujo cuadra cuando:

```
Σ ventas(fecha_pago) − Σ egresos(fecha_pago)  ==  saldo_final − saldo_inicial
```

**Patrones aplicados (todos documentados en detalle en `.claude/commands/reconciliar.md` → Lecciones agosto 2026):**

- **Pago parcial → split en dos líneas**: modificar la factura original a `Pagada_parcial` con el monto cobrado + `fecha_pago`; crear una línea nueva `Emitida` con el saldo pendiente. Preservar `mes_economico` (devengado) — solo cambian `estado` y `fecha_pago`.
- **Reverso no-WebPay**: un abono que calza exacto con un cargo previo del mismo proveedor (ej. Khipu) es un reverso → eliminar el cargo, no registrar el abono como ingreso.
- **Cruzar ingresos por RUT**, no solo por monto: el pagador puede ser un representante con RUT distinto (una persona pagó por una sociedad).

Estas reglas son específicas de la reconciliación y viven en el skill para cargarse en cada corrida; aquí queda solo el índice de proceso.

---

*Sesión del 01/08/2026 — Dashboard NLACE*

---

## Sesión 30/08/2026 — Skill informe-ceo (informe .pptx mensual)

### 16. Reutilizar `src/lib/data.ts` desde scripts Node (fuera del bundle web)

`src/lib/data.ts` importa `./supabase`, y `supabase.ts` leía `import.meta.env.*` directamente — bajo Node/tsx `import.meta.env` es `undefined` y el módulo crashea al evaluarse. Se parcheó con un fallback a `globalThis.process?.env` (con cast, sin requerir `@types/node` en el build web) para que el mismo archivo sirva tanto al bundle de Vite como a scripts Node. Patrón reutilizable: cualquier módulo de `src/lib/` que se quiera compartir con scripts de skills debe evitar acceder a `import.meta.env` sin ese guard.

### 17. pptxgenjs + SVG: preferir PNG rasterizado

pptxgenjs acepta rutas `.svg` en `addImage`, pero en este sandbox no había herramienta de rasterización disponible (`rsvg-convert`, `inkscape`, `magick` ausentes; `soffice --headless --convert-to png` falló incluso con archivos triviales — limitación del entorno, no del SVG). Se instaló `sharp` de forma temporal (fuera de `package.json`, solo en `/tmp`) para generar `assets/nlace-black.png` una vez y se descartó la dependencia. El generador (`generar-pptx.ts`) prefiere el PNG si existe y cae a SVG si no — dejar ambos versionados en `assets/` evita depender de herramientas de conversión en cada ejecución.

### 18. Fuentes de marca no se embeben en .pptx

Space Grotesk e Inter no viajan dentro del archivo .pptx — si la máquina donde se abre no las tiene instaladas, PowerPoint sustituye por una fuente del sistema. Es una limitación conocida y aceptada (no bloqueante); se documentó en el `SKILL.md` para que el CFO lo tenga presente al presentar.

### 19. LibreOffice headless no disponible para QA visual en este sandbox

`soffice --headless --convert-to pdf` falla con "source file could not be loaded" incluso en archivos triviales (`.txt`) — no es un problema del .pptx generado. La verificación de un .pptx generado en este tipo de entorno se hace de forma estructural: `unzip -l` para confirmar las 6 slides y los medios embebidos, `python3 -c "import xml.dom.minidom as m; m.parse(...)"` para XML bien formado de cada slide, y `grep` sobre `<a:t>` para confirmar que el texto y los colores de marca (`srgbClr val="..."`) quedaron inyectados correctamente. La inspección visual final queda para el usuario al abrir el archivo.

---

*Sesión del 30/08/2026 — Dashboard NLACE*
