# Agente de Cobranza NLACE

Agente que se activa manualmente desde Claude Code con `/cobranza`. Identifica facturas vencidas en Supabase, busca los PDFs, redacta correos con el nivel de escalada correcto, y crea borradores en Gmail. Nunca envía directo.

## Setup (una sola vez)

### 1. Ejecutar migración en Supabase

Copiar el contenido de `migration.sql` y ejecutarlo en la consola SQL de Supabase:
https://supabase.com/dashboard/project/orjufhwfepojfiqejhfc/sql

### 2. Agregar service key al .env.local

Editar `/Users/victor/Developer/dashboard-nlace/.env.local` y agregar:
```
VITE_SUPABASE_SERVICE_KEY=eyJ...  # la key legacy en formato eyJ, no sb_secret_
```

La service key se obtiene en Supabase → Project Settings → API → service_role.
Usar la key en formato `eyJ...` (legacy), no la nueva `sb_secret_...`.

### 3. Instalar skill en Claude Code

```bash
ln -sf /Users/victor/Developer/dashboard-nlace/agents/cobranza/SKILL.md \
       /Users/victor/Claude/skills/user/cobranza/SKILL.md
```

O copiar manualmente el SKILL.md al directorio de skills de Claude.

## Uso

En Claude Code, escribir:
```
/cobranza
```

El agente se ejecuta en la sesión actual. Toma ~2-5 minutos dependiendo de cuántos clientes tengan facturas vencidas.

## Lo que hace el agente

1. Consulta Supabase por facturas con `estado = Emitida` y `fecha_vencimiento < hoy`
2. Agrupa por cliente (rut_cliente)
3. Revisa `cobranza_historial` para calibrar nivel de escalada (1/2/3)
4. Busca PDFs en `/Users/victor/cowork os/nlace/Clientes/{Cliente}/Facturas/`
5. Redacta correo siguiendo la skill nlace-cobranza (tono y estilo de Víctor)
6. Crea borrador en Gmail con CC estándar (cristian@, gestion@)
7. Registra el contacto en `cobranza_historial`
8. Muestra resumen: borradores creados + alertas de PDFs no encontrados

## Lo que NO hace (restricciones explícitas)

- **Nunca envía correos** — solo crea borradores
- Si no encuentra un PDF, alerta pero no omite al cliente
- No adivina emails de destinatarios — el campo `to` queda vacío

## Después de ejecutar

En Gmail:
1. Completar campo "Para:" con el email del contacto de cada cliente
2. Adjuntar manualmente los PDFs que el agente no pudo encontrar (si hubo alertas)
3. Revisar tono y datos
4. Enviar

## Actualizar la lógica del agente

El SKILL.md en este directorio es la fuente canónica. Editar aquí y actualizar también `~/Claude/skills/user/cobranza/SKILL.md` (o re-ejecutar el symlink del paso 3).
