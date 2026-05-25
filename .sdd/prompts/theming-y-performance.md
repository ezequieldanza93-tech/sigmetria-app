# Theming Consistente (Light/Dark) + Optimización de Performance (Lighthouse >90)

## Objetivo
Dos cosas atadas en un mismo prompt porque se tocan en los mismos archivos:

1. **Theming**: auditar TODA la app y dejar el modo light/dark 100% consistente. Eliminar colores hardcoded (`bg-white`, `text-black`, `bg-gray-100`, etc.) reemplazándolos por los tokens semánticos ya configurados (`bg-surface-base`, `text-text-primary`, `bg-brand-primary`, etc.). Que el toggle funcione sin flicker en SSR. Que los gráficos de Recharts respeten el tema.

2. **Performance**: llegar a **Lighthouse >90 en las 4 categorías** (Performance, Accessibility, Best Practices, SEO) en las rutas críticas: `/login`, `/dashboard`, `/dashboard/empresas`, `/dashboard/cursos`.

## Stack
- Next.js 15 App Router + React 19 (con React Compiler activado en build)
- Tailwind CSS 3 con tokens semánticos (`tailwind.config.ts`) — strategy `class` para dark mode
- next/font (ya en uso) + next/image (puede no estar usado consistentemente)
- @next/bundle-analyzer (verificar si está; si no, agregar)
- Lighthouse CI (`@lhci/cli`) para medir baseline y target
- Recharts (necesita wrapper para tema)

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Lib de theming | **No instalar `next-themes`**. Usar el sistema actual (clase en `<html>` + localStorage) pero arreglar el SSR-flicker con script inline en `<head>`. |
| Estrategia de tokens | Usar EXCLUSIVAMENTE los tokens semánticos ya existentes en `tailwind.config.ts`. Si falta un token, agregarlo, no usar literal de Tailwind. |
| Colores en Recharts | Wrapper que lee CSS vars vía `getComputedStyle(document.documentElement).getPropertyValue('--token-name')` y re-renderea al cambiar tema |
| React Query devtools | Deshabilitar en `production` (gran ganancia de bundle) |
| Bundle analyzer | Agregar si no está. Correr `ANALYZE=true npm run build` antes y después para medir |
| Lighthouse threshold | Performance ≥90, Accessibility ≥90, Best Practices ≥90, SEO ≥90 — en mobile (más exigente). Desktop debería estar todo en 95+ |
| Rutas a auditar | `/login`, `/dashboard`, `/dashboard/empresas`, `/dashboard/cursos` (más adelante extender) |
| Lazy loading | Recharts, leaflet, jsPDF, html2canvas, anthropic SDK → todos con dynamic import donde se usen |
| Imágenes | next/image en TODAS las imágenes locales. Para uploads (logos, portadas, etc.) que vienen de Supabase storage, usar next/image con loader custom |
| Fuentes | next/font (verificar que está). display: swap. Subset latin-ext. |
| Anti-flicker | Script inline en `<head>` que setea `data-theme` antes de hidratar |
| Service worker | Verificar que no esté sirviendo HTML stale (issue ya conocido del commit 77b2726) |

## Parte 1: Theming consistente

### 1.1 Auditoría de colores hardcoded

Correr grep en el codebase y reemplazar:

| Patrón hardcoded | Reemplazo con token semántico |
|------------------|-------------------------------|
| `bg-white`, `bg-gray-50`, `bg-gray-100` | `bg-surface-base`, `bg-surface-elevated`, `bg-surface-sunken` (según el contexto) |
| `bg-black`, `bg-gray-900`, `bg-gray-800` | `bg-surface-base` con dark mode automático (los tokens ya lo manejan) |
| `text-black`, `text-gray-900` | `text-text-primary` |
| `text-gray-500`, `text-gray-600` | `text-text-secondary` |
| `text-gray-400`, `text-gray-300` | `text-text-tertiary` |
| `border-gray-200`, `border-gray-300` | `border-border-subtle`, `border-border-default` |
| `bg-blue-500`, `bg-blue-600` | `bg-brand-primary`, `bg-brand-hover` |
| `bg-red-500`, `text-red-600` | `bg-danger`, `text-danger` (o `bg-danger-bg`) |
| `bg-green-500`, `text-green-600` | `bg-success`, `text-success` |
| `bg-yellow-500`, `text-yellow-600` | `bg-warning`, `text-warning` |
| `bg-blue-100`, `bg-indigo-100` | `bg-info-bg`, `bg-brand-muted` |

**Comando para encontrar candidatos**:
```bash
# Buscar colores hardcoded en componentes
grep -rn --include='*.tsx' --include='*.ts' -E 'bg-(white|black|gray|slate|zinc|red|green|yellow|blue|indigo|pink|purple|orange)-?[0-9]*' app/ components/
grep -rn --include='*.tsx' --include='*.ts' -E 'text-(white|black|gray|slate|zinc|red|green|yellow|blue|indigo|pink|purple|orange)-?[0-9]*' app/ components/
grep -rn --include='*.tsx' --include='*.ts' -E 'border-(white|black|gray|slate|zinc|red|green|yellow|blue|indigo|pink|purple|orange)-?[0-9]*' app/ components/
```

**Excepciones permitidas** (NO reemplazar):
- En componentes que dibujan colores de SEMÁFORO (badges de NPS: rojo/amarillo/verde por categoría)
- En componentes que NECESITAN un color literal porque representan un dato (gráfico con colores semánticos, riesgo IPERC con escala roja/amarilla/verde)
- En SVG inline que ya está en grey por diseño icónico

Si hay alguna excepción, comentarla con `// no-themed: <razón>` para que futuros greps no se confundan.

### 1.2 Verificación de tokens en `tailwind.config.ts`

Asegurarse que existan tokens completos para light y dark. La definición CSS debe estar en `app/globals.css`:

```css
@layer base {
  :root {
    --surface-base: 255 255 255;
    --surface-elevated: 249 250 251;
    --surface-sunken: 243 244 246;
    --text-primary: 17 24 39;
    --text-secondary: 75 85 99;
    --text-tertiary: 156 163 175;
    --border-subtle: 229 231 235;
    --border-default: 209 213 219;
    --brand-primary: 37 99 235;
    --brand-hover: 29 78 216;
    --brand-muted: 219 234 254;
    --success: 16 185 129;
    --success-bg: 209 250 229;
    --warning: 245 158 11;
    --warning-bg: 254 243 199;
    --danger: 239 68 68;
    --danger-bg: 254 226 226;
    --info: 59 130 246;
    --info-bg: 219 234 254;
    /* Charts: paleta de N colores para Recharts */
    --chart-1: 37 99 235;
    --chart-2: 16 185 129;
    --chart-3: 245 158 11;
    --chart-4: 239 68 68;
    --chart-5: 168 85 247;
  }
  .dark {
    --surface-base: 17 24 39;
    --surface-elevated: 31 41 55;
    --surface-sunken: 11 15 25;
    --text-primary: 243 244 246;
    --text-secondary: 209 213 219;
    --text-tertiary: 156 163 175;
    --border-subtle: 55 65 81;
    --border-default: 75 85 99;
    --brand-primary: 96 165 250;
    --brand-hover: 147 197 253;
    --brand-muted: 30 58 138;
    --success: 52 211 153;
    --success-bg: 6 78 59;
    --warning: 251 191 36;
    --warning-bg: 113 63 18;
    --danger: 248 113 113;
    --danger-bg: 127 29 29;
    --info: 96 165 250;
    --info-bg: 30 58 138;
    --chart-1: 96 165 250;
    --chart-2: 52 211 153;
    --chart-3: 251 191 36;
    --chart-4: 248 113 113;
    --chart-5: 192 132 252;
  }
}
```

Verificar (y arreglar si falta) que el `tailwind.config.ts` mapee estos vars como `rgb(var(--xxx) / <alpha-value>)`:
```ts
colors: {
  surface: {
    base: 'rgb(var(--surface-base) / <alpha-value>)',
    elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
    sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
  },
  // ... resto idem
}
```

### 1.3 Anti-flicker en SSR

Agregar en `app/layout.tsx` antes de los `<children>`:

```tsx
<head>
  {/* eslint-disable-next-line @next/next/no-sync-scripts */}
  <script
    dangerouslySetInnerHTML={{
      __html: `
        (function() {
          try {
            var theme = localStorage.getItem('theme');
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            var resolved = theme === 'dark' || (!theme && prefersDark) ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', resolved === 'dark');
            document.documentElement.setAttribute('data-theme', resolved);
            document.documentElement.style.colorScheme = resolved;
          } catch (e) {}
        })();
      `,
    }}
  />
</head>
```

Después, el toggle del header solo hace `localStorage.setItem('theme', next)` + `document.documentElement.classList.toggle('dark')`. Sin cambios en re-renders, sin flicker.

### 1.4 Wrapper de Recharts para colores dinámicos

Crear `components/ui/themed-chart.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

export function useChartColors(count = 5) {
  const [colors, setColors] = useState<string[]>([])
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement)
      const arr = []
      for (let i = 1; i <= count; i++) {
        const v = cs.getPropertyValue(`--chart-${i}`).trim()
        if (v) arr.push(`rgb(${v})`)
      }
      const textPrimary = cs.getPropertyValue('--text-primary').trim()
      const gridColor = cs.getPropertyValue('--border-subtle').trim()
      setColors(arr)
      return { colors: arr, textPrimary: `rgb(${textPrimary})`, gridColor: `rgb(${gridColor})` }
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => observer.disconnect()
  }, [count])
  return colors
}
```

Usar este hook en cada chart de Recharts (Line, Bar, Pie, etc.) para los colores de series + el `stroke` de los axes + grid color.

### 1.5 Auditoría visual

- Inspeccionar manualmente cada ruta principal en light/dark:
  - `/login`, `/dashboard`, `/dashboard/empresas`, `/dashboard/empresas/[id]`, `/dashboard/incidentes`, `/dashboard/denuncias`, `/dashboard/billing`, `/dashboard/configuracion`, `/dashboard/admin/planes`, `/dashboard/cursos`, `/dashboard/cursos/admin`
- Para cada una, verificar:
  - Contraste de texto (WCAG AA mínimo, 4.5:1 normal text, 3:1 large)
  - Inputs, selects, textareas: borders, placeholders, focus state
  - Modales: backdrop, sombra
  - Badges: contraste de texto sobre fondo
  - Tablas: hover state, zebra striping si aplica
  - Skeletons: visibles en dark
  - Tooltips
  - Iconos (lucide-react usa `currentColor` por default — debería estar bien si el text-* está correcto)

### 1.6 Test E2E de regresión visual

Agregar a `e2e/specs/theming/visual.spec.ts`:

```ts
test('todas las páginas críticas se ven bien en light y dark', async ({ page }) => {
  const routes = ['/dashboard', '/dashboard/empresas', '/dashboard/cursos']
  for (const route of routes) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => {
        document.documentElement.classList.toggle('dark', t === 'dark')
        localStorage.setItem('theme', t)
      }, theme)
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot(`${route.replace(/\//g, '-')}-${theme}.png`, {
        maxDiffPixelRatio: 0.01,
      })
    }
  }
})
```

## Parte 2: Performance — Lighthouse >90

### 2.1 Baseline

Antes de cualquier cambio, correr Lighthouse contra prod y guardar resultado:

```bash
npx @lhci/cli autorun --collect.url=https://hys-app-sig.vercel.app/login \
  --collect.url=https://hys-app-sig.vercel.app/dashboard \
  --collect.settings.preset=desktop
```

Idealmente correr en mobile preset también. Documentar el score baseline para cada categoría/ruta.

### 2.2 Quick wins (Performance)

#### React Query Devtools en producción
En `app/providers.tsx` (o donde esté QueryProvider):
```tsx
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? lazy(() => import('@tanstack/react-query-devtools').then(m => ({ default: m.ReactQueryDevtools })))
  : () => null
```

#### Dynamic import de libs pesadas
Convertir imports estáticos a dinámicos en:
- `recharts` → cualquier componente que use charts: `const Chart = dynamic(() => import('./Chart'), { ssr: false })`
- `react-leaflet` + `leaflet` → solo en `/dashboard/mapas`: ya debería estar lazy, verificar
- `jspdf` + `html2canvas` → solo cuando generás certificado: `await import('jspdf')` dentro de la función que lo usa
- `@anthropic-ai/sdk` y `langchain/*` → ya están en API routes (server-only), verificar que no entren al bundle del cliente
- `marked`/`remark`/`react-pdf` si están: dinámicos

#### Next/Image en todas las imágenes locales
Buscar `<img src=` y reemplazar por `<Image src=` con width/height definidos o `fill`. Si la imagen viene de Supabase:
```tsx
<Image
  src={portadaUrl}
  alt={titulo}
  width={400}
  height={225}
  className="..."
  unoptimized={portadaUrl.startsWith('https://lslzhgmoaxgkcjeweqaz.supabase.co')}  // o configurar loader
/>
```

O mejor: agregar `images.remotePatterns` en `next.config.ts`:
```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'lslzhgmoaxgkcjeweqaz.supabase.co', pathname: '/storage/v1/object/**' },
  ],
  formats: ['image/avif', 'image/webp'],
}
```

#### Next/Font
Verificar que las fuentes (Montserrat para heading, Poppins para body) estén cargadas via `next/font/google` con `display: 'swap'` y `preload: true` en `app/layout.tsx`:

```tsx
import { Montserrat, Poppins } from 'next/font/google'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

<html className={`${montserrat.variable} ${poppins.variable}`}>
```

#### Server Components donde se pueda
Auditar `'use client'`. Cada vez que veas uno en una página, preguntate si REALMENTE necesita interactividad. Si solo es para mostrar datos → Server Component. Si tiene estado / event handlers → mantener.

Pattern: la página principal es Server Component que hace fetch, le pasa data a un componente cliente que maneja interactividad. Esto reduce JS del cliente significativamente.

#### Suspense + streaming
Las rutas pesadas pueden envolver secciones en `<Suspense fallback={<Skeleton />}>` para que el shell se renderice rápido y los datos lleguen después.

### 2.3 Accessibility

- **Aria labels en botones icon-only**:
  - Buscar `<button>` y `<IconButton>` que solo contienen un icon — agregar `aria-label="..."`.
- **Form labels**:
  - Cada `<input>` debe tener un `<label>` asociado (htmlFor + id, o anidado).
  - Donde haya FieldErrors, asegurar `aria-describedby` apuntando al span del error.
- **Skip links**: agregar al inicio del `app/(dashboard)/layout.tsx`:
  ```tsx
  <a href="#main" className="sr-only focus:not-sr-only">Saltar al contenido</a>
  <main id="main" tabIndex={-1}>{children}</main>
  ```
- **Color contrast**: validar que todos los tokens cumplen WCAG AA. El tester de Lighthouse lo marca.
- **Heading hierarchy**: cada página debe tener un solo `<h1>` y la jerarquía debe ser monotónica (no saltar de h1 a h3).
- **Alt en imágenes**: todo `<Image>` debe tener `alt`. Si es decorativa, `alt=""`.

### 2.4 Best Practices

- **No `console.*` en producción**:
  - Verificar `next.config.ts` para `compiler.removeConsole = { exclude: ['error', 'warn'] }`
- **No mixed content**: todas las URLs https. La CSP ya está bloqueando esto.
- **No third-party cookies** innecesarias: revisar si hay analytics/tracking que no son esenciales.
- **No deprecated APIs**: actualizar imports si zen detecta warnings al hacer build.

### 2.5 SEO

- **Meta tags por ruta**:
  - Cada `page.tsx` debe exportar `export const metadata: Metadata = { title, description }` o `generateMetadata` para dynamic.
  - El `app/layout.tsx` provee defaults (title template, description global, Open Graph image).
- **sitemap.xml**:
  - Crear `app/sitemap.ts` con las rutas públicas (login, /, /verificar-certificado/[codigo] base):
    ```ts
    export default function sitemap(): MetadataRoute.Sitemap {
      return [
        { url: 'https://hys-app-sig.vercel.app/', changeFrequency: 'monthly', priority: 1 },
        { url: 'https://hys-app-sig.vercel.app/login', changeFrequency: 'yearly', priority: 0.5 },
      ]
    }
    ```
- **robots.txt**:
  - Crear `app/robots.ts`:
    ```ts
    export default function robots(): MetadataRoute.Robots {
      return {
        rules: { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/', '/admin/'] },
        sitemap: 'https://hys-app-sig.vercel.app/sitemap.xml',
      }
    }
    ```
- **Canonical URLs**: en metadata, `alternates: { canonical: '...' }` cuando aplique.

### 2.6 Bundle analysis

```bash
ANALYZE=true npm run build
```

Si no está configurado, agregar a `next.config.ts`:
```ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: process.env.ANALYZE === 'true' })
module.exports = withBundleAnalyzer(nextConfig)
```

Targets a buscar en el output:
- Bundle de page > 250 KB First Load JS → buscar imports pesados
- Chunks duplicados → unificar
- Polyfills innecesarios

## Migración SQL
**No aplica**. Este feature no requiere cambios en DB.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `app/globals.css` | Definir/completar tokens semánticos para light + dark |
| `tailwind.config.ts` | Confirmar mapping de tokens; agregar tokens de charts si faltan |
| `app/layout.tsx` | Script anti-flicker en `<head>`; setup de next/font; metadata default |
| `app/providers.tsx` (o donde esté) | Lazy load de ReactQueryDevtools en dev |
| `next.config.ts` | `images.remotePatterns`, `compiler.removeConsole`, bundle analyzer |
| `components/app-header.tsx` | Toggle de theme simplificado (sin re-render extra) |
| `components/**` con colores hardcoded | Reemplazar por tokens semánticos |
| `app/**` con colores hardcoded | Idem |
| Componentes con Recharts | Usar `useChartColors()` |
| `app/**/page.tsx` con imágenes | Reemplazar `<img>` por next/image |
| Páginas críticas | Agregar `export const metadata` |

## Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `app/sitemap.ts` | Sitemap dinámico |
| `app/robots.ts` | Robots policy |
| `components/ui/themed-chart.tsx` | Hook `useChartColors` + wrappers para Recharts |
| `e2e/specs/theming/visual.spec.ts` | Tests visuales de regresión light/dark |
| `lighthouserc.js` | Config de Lighthouse CI con targets |

## Archivos existentes relevantes (LEER antes de implementar)

- `tailwind.config.ts` — config actual y tokens existentes
- `app/globals.css` — definición actual de CSS vars
- `app/layout.tsx` — layout raíz
- `app/providers.tsx` (o similar) — providers root (QueryClient, ThemeProvider, etc.)
- `components/app-header.tsx` — theme toggle actual
- `next.config.ts` — config actual (headers de seguridad, imports, etc.)
- `package.json` — verificar deps existentes (bundle-analyzer, lhci, etc.)
- Cualquier componente con Recharts (buscar `from 'recharts'`)

## Casos edge

1. **Usuario con `prefers-color-scheme: dark` pero sin localStorage**: el script inline lo detecta correctamente con `matchMedia`.
2. **Theme cambia mientras se está renderizando un chart**: el `MutationObserver` en `useChartColors` re-renderea con nuevos colores.
3. **next/image con URL de Supabase storage privado (signed URL)**: signed URL expira en 1 año; next/image cachea por tiempo razonable. Si la imagen vence mientras estaba cacheada, mostrar fallback (alt visible).
4. **Lighthouse en mobile vs desktop**: mobile siempre es más exigente. Si en desktop sale 95 pero en mobile sale 75, atacar mobile.
5. **Página con MUCHO contenido (compliance dashboard, listado largo)**: usar paginación server-side, no traer todo. Si ya está paginado, verificar `range()` o `.limit()`.
6. **Map de Leaflet**: bloqueante para Performance score. Lazy load + Suspense fallback. Si `/dashboard/mapas` no es crítico, no se prioriza esa ruta para >90.

## Tests sugeridos

- E2E visual regression en light + dark (Playwright snapshot)
- Lighthouse CI corriendo en cada PR — guardar config en `lighthouserc.js`:
  ```js
  module.exports = {
    ci: {
      collect: {
        url: ['https://hys-app-sig.vercel.app/login', 'https://hys-app-sig.vercel.app/dashboard'],
        numberOfRuns: 3,
        settings: { preset: 'desktop' },
      },
      assert: {
        assertions: {
          'categories:performance': ['error', { minScore: 0.9 }],
          'categories:accessibility': ['error', { minScore: 0.9 }],
          'categories:best-practices': ['error', { minScore: 0.9 }],
          'categories:seo': ['error', { minScore: 0.9 }],
        },
      },
    },
  }
  ```
- Unit: el hook `useChartColors` retorna array de longitud `count` con strings RGB válidos

## Checklist de implementación

- [ ] Tokens semánticos completos (light + dark) en `app/globals.css`
- [ ] `tailwind.config.ts` referencia todos los tokens
- [ ] Script anti-flicker en `app/layout.tsx`
- [ ] Theme toggle simplificado en AppHeader
- [ ] `useChartColors` hook + aplicado a TODOS los Recharts
- [ ] Colores hardcoded reemplazados en toda la app (grep limpio, salvo excepciones documentadas)
- [ ] React Query devtools lazy-loaded solo en dev
- [ ] Dynamic imports para Recharts, jsPDF, html2canvas en sus call sites
- [ ] next/image en imágenes locales + remotePatterns en config
- [ ] next/font con display swap
- [ ] `app/sitemap.ts` + `app/robots.ts` creados
- [ ] Metadata por ruta en páginas críticas
- [ ] Skip link en dashboard layout
- [ ] aria-labels en icon-only buttons
- [ ] `compiler.removeConsole` configurado en `next.config.ts`
- [ ] `@next/bundle-analyzer` instalado y configurado
- [ ] Lighthouse CI config en `lighthouserc.js`
- [ ] Baseline + final scores documentados en el reporte
- [ ] E2E visual de regresión light/dark pasando
- [ ] `npm run type-check` sin errores
- [ ] `npm run lint` sin errores

---

## Workflow al terminar (NO PREGUNTAR — EJECUTAR)

Esta es la **regla nueva estándar** para todo lo que implementes desde ahora:

1. Implementá TODO lo descrito arriba. Si algo te frena, fijate si podés resolverlo solo antes de pedir ayuda.
2. Corré `npm run type-check` y `npm run lint`. Arreglá errores hasta que pasen ambos.
3. Si hay tests E2E nuevos, corré `npm run test:e2e` localmente (o al menos los nuevos).
4. `git add` con los archivos modificados/creados (no incluyas trabajo en progreso de OTROS prompts si lo hay).
5. `git commit` con mensaje **conventional commits**, en español o inglés según convención del repo. **NO Co-Authored-By, NO AI attribution.** Ejemplo: `feat: consistent light/dark theming + lighthouse >90 optimizations`.
6. `git push` a la branch actual (`master` u otra).
7. Esperar al deploy de Vercel (auto-trigger por push). Si tenés Vercel CLI:
   ```bash
   vercel --version
   vercel inspect <deployment-url>  # o vercel ls
   ```
   Si no, usar `gh` para mirar el commit status o curl al endpoint health.
8. Si el deploy falla:
   - Leer los logs (`vercel logs <url>` o `gh run view --log-failed`)
   - Arreglar los errores
   - Commit + push de nuevo
   - Repetir hasta que el deploy esté verde
9. Este prompt **no necesita migración Supabase** — no aplica nada en DB.
10. Reportá al final del run:
    - **"Está ready"** si todo verde — incluyendo el URL final del deploy y un screenshot/score de Lighthouse si lo corriste.
    - O **lista de errores que encontraste y cómo los arreglaste** (cada uno, brevemente).
    - O **lista de cosas que NO pudiste hacer y por qué** — incluyendo qué permiso/credencial/decisión necesitás del usuario para destrabarlas.

**Si necesitás permisos del usuario** (ej. `SUPABASE_ACCESS_TOKEN` para futuras migraciones, credenciales nuevas, decisiones de UX que no pude anticipar): pedilas EN EL MISMO MENSAJE donde reportás el progreso. No frenes el resto del trabajo esperando — implementá lo que podés y dejá explícito lo que falta y por qué.
