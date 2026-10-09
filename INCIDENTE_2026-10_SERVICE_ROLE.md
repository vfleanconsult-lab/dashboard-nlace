# Incidente: clave `service_role` de Supabase publicada (8–9 oct 2026)

Resumen para quien llegue sin contexto. Estado final: **cerrado**. Lo no verificado está marcado.

## Qué pasó
- La clave maestra `service_role` de Supabase estaba en la variable `VITE_SUPABASE_SERVICE_KEY`. Vite incrusta en el JavaScript público toda variable `VITE_*` que el código use, así que cualquiera que abriera lucas.nlace.com podía copiarla.
- Cinco páginas de carga (`ActualizarCostos`, `ActualizarGastos`, `ActualizarVentas`, `ActualizarEstadoFacturas`, `IngresoManualPartidas`) creaban un cliente de Supabase con esa clave **en el navegador**.
- La `service_role` salta el RLS: permitía leer, escribir y borrar toda la base.

## Qué se cambió
| Cambio | Dónde |
|--------|-------|
| Las escrituras pasan por una función de servidor que valida la sesión de Clerk, exige correo `@nlace.com` verificado y limita tablas/columnas | `api/db-write.ts` |
| El navegador llama a esa función en vez de usar la clave | `src/lib/supabaseAdmin.ts` |
| La clave de lectura del front es la publishable `sb_publishable_…` (antes la `anon` JWT legacy) | `src/lib/supabase.ts` |
| La clave de servidor es una secret `sb_secret_…` en `SUPABASE_SERVICE_KEY` (Vercel, Production y Preview, Sensitive) | Vercel |
| Skills locales leen `SUPABASE_SECRET_KEY` de `.env.local` | `.claude/commands/cobranza.md`, `reconciliar.md` |

PRs: #88 (corrección), #89 (publishable), #90 (docs de skills y claves).

## Cierre de acceso (lo que hizo falta de verdad)
1. Migración a claves nuevas de Supabase (publishable y secret).
2. Desactivación de las claves legacy `anon` y `service_role`.
3. **Revocación del secreto JWT legacy** (JWT Signing Keys: migrar, rotar, revocar). Sin este paso la `service_role` vieja seguía valiendo como `Authorization: Bearer`.

Verificado el 9-oct: la `service_role` vieja da 401 como `apikey` y como `Bearer`; antes de revocar leía 10 filas de `st_cuentas` y 62 de `st_movimientos` (tablas que `anon` no lee).

## Verificaciones hechas
- Bundle de producción sin JWTs (solo la publishable). Verificado.
- `/api/db-write` responde 401 sin sesión. Verificado.
- Escrituras reales en preview y producción: filas aparecieron en la base. Verificado.
- Dashboard con login cargando cifras después de revocar: **confirmado por Víctor, no visto por Claude**.
- Escritura después de revocar el secreto JWT: **no probada**.
- Corrida completa de cobranza con la secret nueva: **no probada** (la clave sí se probó en solo lectura).

## Configuración de Vercel/Clerk que importa
- `VITE_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY` deben ser de la **misma instancia de Clerk por entorno**. Preview: `pk_test`/`sk_test` (instancia de desarrollo `concrete-unicorn-15`). Production: `pk_live`/`sk_live` (clerk.nlace.com).
- En Clerk de producción, `lucas.nlace.com` debe estar en los subdominios permitidos.
- Las variables `VITE_*` no pueden ser Sensitive y nunca deben contener un secreto.
- `VITE_SUPABASE_SERVICE_KEY` y `VITE_SUPABASE_ANON_KEY` se borraron de Vercel.

## Qué quedó abierto
- **Datos legibles sin login.** `anon`/publishable puede hacer SELECT en ventas, costos, gastos, remuneraciones y la vista `registros_contables`. El login de Clerk protege las pantallas, no las consultas directas a la API. Es anterior al incidente. Cerrarlo exige leer por servidor o RLS por usuario.
- **Auditoría imposible más allá de ~11 h.** Los logs de Supabase solo conservan ese tiempo. Se revisaron: no hay escrituras ajenas en la ventana; todas coinciden con cargas y pruebas conocidas. No se puede decir nada de las semanas en que la clave estuvo pública.
- **Lecturas sin identificar:** peticiones `GET registros_contables?select=*` con `Python-urllib` desde IPs de Google (EE. UU.) cada pocas horas. Solo datos legibles por `anon`. Probablemente un agente propio; se pidió confirmarlo a Cristian.
- **Agentes de terceros** que usaran la clave vieja dejaron de funcionar. Deben usar la publishable (lectura) o una secret propia (escritura).

## Cobranza en otro computador
`cobranza.md` tiene rutas fijas de la Mac de Víctor (`/Users/victor/Developer/dashboard-nlace/.env.local` y `/Users/victor/cowork os/nlace/Clientes`). Para correrlo en otro equipo hay que adaptarlas y crear allí un `.env.local` con una `SUPABASE_SECRET_KEY` propia (Supabase → Settings → API Keys → Secret keys).

## Errores de proceso (para no repetirlos)
- Se indicó borrar `VITE_SUPABASE_SERVICE_KEY` de Vercel **antes** del merge; `main` aún la usaba y la escritura en producción quedó rota unas horas.
- Un 200 sobre una tabla pública no prueba que una clave haya dejado de tener privilegios; hay que probar con una tabla que `anon` no lee.
- Un redeploy de `main` no reconstruye el PR; el hash del JS publicado revela si el build cambió.

Ver también `SUPABASE.md` (claves y RLS), `lecciones-aprendidas.md` (lecciones de proceso) y `MODULOS_CARGA.md`.
