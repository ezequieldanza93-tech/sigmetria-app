# Mobile Migration Plan — Sigmetría HyS

## Camino Recomendado: Capacitor (Ionic)

### ¿Por qué Capacitor y no PWA o React Native?

| Criterio | PWA | Capacitor | React Native |
|----------|-----|-----------|--------------|
| Esfuerzo | Bajo | Medio | Muy Alto |
| APK distribution | No (solo browser) | Sí | Sí |
| Rendimiento | Bueno | Bueno (WebView) | Nativo |
| Compartir código | 100% | 100% | ~40% (reescritura) |
| iOS limitations | Push limitado, sin badges | Sin límites | Sin límites |
| Offline | Sí (SW) | Sí (SW + plugins) | Sí (AsyncStorage) |
| B2B IT deployment | No viable | Sí (MDM, APK) | Sí |

**Decisión**: Capacitor. Este proyecto es B2B. Los clientes (consultoras HyS) necesitan distribuir la app a sus equipos via APK o MDM. Una PWA no es instalable programáticamente en dispositivos corporativos. React Native implicaría reescribir 31 server actions + 20+ componentes sin beneficio de performance justificable para una app de formularios y tablas.

El plan tiene 4 fases progresivas. Cada fase es autónoma, reversible, y entrega valor por sí misma.

---

## Fase 1 — Responsive CSS Foundation (3-4 semanas)

### Objetivo
Toda la app se ve y funciona en viewports de 360px-768px sin romper el layout desktop.

### Pasos

| # | Tarea | Esfuerzo | Componentes afectados |
|---|-------|----------|----------------------|
| 1.1 | Agregar meta viewport + responsive container | S | `app/layout.tsx` |
| 1.2 | Convertir `max-w-*` a `w-full max-w-* px-4 sm:px-6` | S | Todas las page.tsx (15 archivos) |
| 1.3 | Sidebar: `fixed` → slide-over en mobile (<1024px) | M | `sidebar.tsx`, `sidebar-wrapper.tsx`, `globals.css` |
| 1.4 | Header: reducir padding, ocultar breadcrumb en mobile | S | `app-header.tsx` |
| 1.5 | Form grids: `grid-cols-1 sm:grid-cols-2` | S | `empresa-form.tsx`, `establecimiento-form.tsx`, etc. |
| 1.6 | Tablas → card layout en mobile (<640px) | M | `empresas/page.tsx`, `personas/page.tsx`, `productos/page.tsx` |
| 1.7 | EstablecimientoTabs: scroll horizontal + dropdown | M | `establecimiento-tabs.tsx` |
| 1.8 | Botones: min-h-11 (44px touch target) | S | `components/ui/button.tsx` |
| 1.9 | Modales: `max-w-full m-4` en mobile | S | `components/ui/modal.tsx` |
| 1.10 | Filter bar: stacked layout en mobile | S | `dashboard-filter-bar.tsx` |

### Testing
- `DevicePreviewPanel` (se entrega junto con este plan)
- Chrome DevTools device emulation (todos los presets)
- Test en dispositivo físico Android + iOS al final de la fase

### Rollback
Cada cambio es un archivo. Revertir por componente si algo se rompe. Sin feature flags — los cambios CSS no afectan lógica.

---

## Fase 2 — Touch & Interaction Layer (2 semanas)

### Objetivo
Reemplazar interacciones hover-only por equivalentes touch-friendly. Sin cambios de layout.

### Pasos

| # | Tarea | Esfuerzo | Componentes afectados |
|---|-------|----------|----------------------|
| 2.1 | Sidebar hover tooltips → `click-to-expand` en mobile | S | `sidebar.tsx` |
| 2.2 | Dropdown menus hover → `click + portal` | M | `app-header.tsx` (user menu) |
| 2.3 | Agregar `touch-action: manipulation` en botones | S | `globals.css` |
| 2.4 | Pull-to-refresh en listas | M | `empresas/page.tsx`, `personas/page.tsx` |
| 2.5 | Aumentar gap en touch targets (min 8px entre botones) | S | `components/ui/` |
| 2.6 | Modal: bottom sheet style en mobile | M | `components/ui/modal.tsx` (responsive variant) |
| 2.7 | Date inputs: usar `type="date"` nativo en mobile | S | `components/ui/input.tsx` |

### Testing
- Dispositivo físico (validar touch targets con Lighthouse audit)
- `DevicePreviewPanel` con interacciones táctiles simuladas

---

## Fase 3 — PWA Wrapper (1 semana)

### Objetivo
App installable desde el browser. Sirve como step intermedio antes de Capacitor y como fallback para usuarios que no quieren instalar APK.

### Pasos

| # | Tarea | Esfuerzo |
|---|-------|----------|
| 3.1 | Generar `manifest.json` con icons en múltiples resoluciones | S |
| 3.2 | Crear service worker con estrategia `stale-while-revalidate` | M |
| 3.3 | Agregar meta tags iOS (apple-mobile-web-app-capable) | S |
| 3.4 | Agregar splash screen + theme-color meta | S |
| 3.5 | Testing: Lighthouse PWA audit, install prompt en Chrome | S |

### Assets necesarios
- Icon 192x192, 512x512 (PNG)
- Favicon
- Apple touch icon 180x180

---

## Fase 4 — Capacitor Native Wrapper (2 semanas)

### Objetivo
APK para distribución B2B. Sin modificar el código existente de la app.

### Pasos

| # | Tarea | Esfuerzo |
|---|-------|----------|
| 4.1 | `npm install @capacitor/core @capacitor/cli` | S |
| 4.2 | `npx cap init` + `npx cap add android` | S |
| 4.3 | Configurar `capacitor.config.ts` (server.url para dev) | S |
| 4.4 | Build Next.js + sync: `next build && npx cap sync` | S |
| 4.5 | Handle Android back button (hardware) → `App.addListener('backButton')` | S |
| 4.6 | Keyboard handling: `@capacitor/keyboard` plugin for WebView resize | S |
| 4.7 | Status bar: `@capacitor/status-bar` plugin (light/dark matching) | S |
| 4.8 | Build APK: `npx cap open android` → build signed APK | M |
| 4.9 | Testing: WebView rendering, form inputs, camera (photo reports), PDF export | M |

### Plugins Capacitor necesarios

| Plugin | Propósito |
|--------|-----------|
| `@capacitor/core` | Runtime core |
| `@capacitor/keyboard` | Keyboard avoidance (esencial para forms) |
| `@capacitor/status-bar` | Status bar styling |
| `@capacitor/splash-screen` | Splash screen (opcional) |

### NO necesarios (la app web ya los maneja)
- `@capacitor/camera` — la app usa input file + URL.createObjectURL
- `@capacitor/filesystem` — los PDFs se descargan via browser
- `@capacitor/share` — no hay funcionalidad de share

### Archivo `capacitor.config.ts` esperado

```ts
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sigmetria.app',
  appName: 'Sigmetría HyS',
  webDir: '.next',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0F1115',
    },
  },
}

export default config
```

---

## Resumen de Esfuerzo

| Fase | Semanas | Dependencias | Riesgo | Reversible |
|------|---------|-------------|--------|------------|
| 1 — Responsive CSS | 3-4 | Ninguna | Bajo | ✅ Sí (cambios CSS) |
| 2 — Touch Layer | 2 | Fase 1 | Bajo | ✅ Sí |
| 3 — PWA | 1 | Fase 1 | Bajo | ✅ Sí (solo archivos nuevos) |
| 4 — Capacitor | 2 | Fase 1,2,3 | Medio | ✅ Sí (proyecto Android independiente) |
| **Total** | **8-9** | | | |

La Fase 1 es el cuello de botella. Una vez que el CSS responsive está en su lugar, las fases 2-4 son mecánicas y pueden ejecutarse en paralelo.
