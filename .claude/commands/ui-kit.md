# NLACE UI-Kit — Referencia de diseño

Repositorio: https://github.com/NLACE-COM/ui-kit  
Paquete npm: `@nlace/ui-kit`

---

## Instalación

```bash
npm install @nlace/ui-kit
# o
pnpm add @nlace/ui-kit
```

## Integración con Tailwind v4 (este proyecto)

```css
/* src/index.css */
@import "@nlace/ui-kit/tailwind-v4";
@source "../../node_modules/@nlace/ui-kit/dist";
```

---

## Paleta de colores

| Token | Hex | Uso |
|-------|-----|-----|
| `nl-primary` | `#5869f7` | Azul eléctrico — acción principal, ventas |
| `nl-primary-dark` | `#2d3bc4` | Stop de gradiente |
| `nl-accent` | `#fc624b` | Rojo-naranja — CTA secundario, costos, margen |
| `nl-accent-warm` | `#ff8c42` | Gradiente cálido |
| `nl-success` | `#42cf8a` | Positivo |
| `nl-success-dark` | `#2ba36a` | Positivo oscuro |
| `nl-danger` | `#dc2626` | Negativo, gastos, errores |
| `nl-bg` | `#efefef` | Canvas global — nunca `#ffffff` |
| `nl-border-soft` | `#dbdcd7` | Bordes sutiles |
| `nl-border-ui` | `#c6c7c2` | Bordes de UI |
| `nl-text` | `#0f1011` | Texto principal |
| Secondary pink | `#f76dee` | Uso limitado |
| Secondary magenta | `#b717af` | Uso limitado |
| Cyan | `#a5f3fc` | Uso muy limitado |

## Gradientes

- **Hero:** azul → magenta → rosa (135deg)
- **Primary:** `#5869f7` → `#2d3bc4`
- **Accent:** `#fc624b` → rosa
- **Brand text-gradient:** azul → rojo-naranja (90deg, solo marketing)

---

## Tipografía

| Clase | Fuente | Uso |
|-------|--------|-----|
| `font-display` | Space Grotesk | Solo títulos (H1–H3). **Nunca en números** |
| `font-body` | Inter | Texto general, etiquetas, botones |
| `font-mono tabular-nums` | JetBrains Mono | Números, cifras, labels técnicos |

**Reglas:**
- H1: `clamp(40px, 5vw, 64px)` · weight 700 · tracking `-0.03em`
- Body mínimo: 16px
- Sentence case en UI. ALL-CAPS solo en eyebrows/labels
- Tracking negativo en todos los títulos

---

## Componentes

### Button
```tsx
<Button variant="primary" size="md">Acción</Button>
```
**Variantes:** `primary` | `accent` | `secondary` | `success` | `danger` | `outlineLight`  
**Tamaños:** `sm` | `md` | `lg`  
Siempre pill-shaped. Hover: `translateY(-2px)` + shadow elevation, 220ms.

### Card
```tsx
<Card accent={false} hoverable>contenido</Card>
```
Fondo blanco + borde suave + sombra sutil. Variante `accent` usa color de marca de fondo.  
`--nl-radius-card: 20px` | `--nl-shadow-card: 2px 12px, 8% opacidad`

### Badge
```tsx
<Badge variant="primary">Etiqueta</Badge>
```
**Variantes tonal:** `primary` | `accent` | `success` | `danger` | `neutral`  
También variante `solid`. Siempre pill-shaped.

### Input
```tsx
<Input label="Nombre" error="Campo requerido" helperText="Ingresa tu nombre" />
```
Altura mínima 44px · radio 10px · focus ring al 20% de opacidad.  
Estados: default, error, success.

### Alert
```tsx
<Alert variant="success">Cambios guardados</Alert>
```
**Variantes:** `info` | `success` | `warning` | `error`  
Borde izquierdo de acento. Iconos Unicode: ℹ ✓ ⚠ ✕

### Otros
- `<Spinner />` — indicador de carga
- `<Skeleton />` — placeholder loader
- `<NlaceLogo variant="dark" />` — `dark` para fondos claros · `light` para fondos oscuros
- `<NlaceAvatar />` — avatar de usuario

---

## Design tokens CSS

```css
/* Radios */
--nl-radius-input: 10px;
--nl-radius-card: 20px;
--nl-radius-pill: 9999px;

/* Sombras */
--nl-shadow-card: 2px 12px rgba(0,0,0,0.08);
--nl-shadow-hover: 10px 28px rgba(0,0,0,0.14);

/* Motion */
--nl-dur-ui: 220ms;
--nl-dur-reveal: 480ms;
/* easing: cubic-bezier(0.22, 1, 0.36, 1) */
```

---

## Assets

**Logos SVG** (vía GitHub raw CDN):
- `assets/nlace-black.svg` — wordmark oscuro (fondos claros)
- `assets/nlace-white.svg` — wordmark claro (fondos oscuros/hero)

**Fotos de equipo:** 14 imágenes en `assets/photos/`  
**Imagery AI:** 34 imágenes `ai-01.png` → `ai-34.png` en `assets/imagery/`

Overlay en fotos: `rgba(15,16,17, 0.45–0.65)`. Nunca overlay sobre personas.

---

## Anti-patrones — NO hacer

- Fondo blanco `#ffffff` como canvas (usar `#efefef`)
- `font-display` (Space Grotesk) en texto body o números
- Iconos rellenos — usar solo Lucide stroke
- Glassmorphism
- Sombras o brillos en texto coloreado
- ALL-CAPS en títulos principales
- Filtros diagonales en imágenes
- Emojis como iconos de UI
- Gradientes en barras de gráficos (colores planos siempre)

---

## Voz y tono

- Español latinoamericano, registro informal (`tú`)
- Sentence case
- Voz directa y funcional
- Sin lenguaje de marketing ni exclamaciones
- Sin emojis en UI de producto
