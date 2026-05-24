# Modo Offline Básico para Zonas sin Internet (PWA)

## Objetivo
Implementar funcionalidad offline básica que permita usar la app sin conexión: instalación como PWA, caching de assets estáticos y app shell, persistencia de queries recientes, indicador de conectividad, y cola de operaciones pendientes para reconexión.

## Stack
- Next.js 15 App Router
- Supabase PostgreSQL
- TanStack React Query 5
- IndexedDB (via `idb` — lightweight wrapper)
- `@serwist/next` (PWA toolkit para Next.js, sucesor de next-pwa)

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Estrategia de caching | Static assets: **Cache-First**. App shell/Navigation: **Network-First con fallback a cache**. API/Server Actions: **Network-Only** (los datos mutables no se cachean) |
| Persistencia de queries | IndexedDB via `idb` + `@tanstack/query-persist-client-core` para restaurar caché de TanStack Query al reconectar |
| Offline fallback | Página estática de "Sin conexión" con datos cacheados |
| Flujo de instalación | Botón "Instalar app" en AppHeader + `beforeinstallprompt` listener |
| Cola offline | Operaciones de escritura (Server Actions) encoladas en IndexedDB para replay al reconectar |
| Feature flag | `modo_offline` habilitado por plan (ya existe en catálogo) |

## Estado actual (NO repetir)

### Ya existe
- `public/manifest.json` — con name, short_name, icons 192+512, display standalone
- `app/layout.tsx` — metadata con `manifest`, `appleWebApp`, `themeColor`
- `app/service-worker/route.ts` — Route Handler que genera SW (passthrough, sin caching)
- `components/pwa-register.tsx` — `PWARegister` que registra el SW (renderizado en root layout)
- `middleware.ts` — excluye `/manifest.json`, `/service-worker`, `/sw.js`, `/icons/` del auth
- `public/icons/icon-192.png`, `public/icons/icon-512.png`
- `lib/plan-features.ts` — feature key `modo_offline` ya existe en el catálogo
- 3 usos de `localStorage` (theme, column widths, error capture) — NO migrar, coexistirán

### Lo que NO existe
- Service worker con caching real (el actual es passthrough y **destruye todas las caches en activate**)
- `@serwist/next` o cualquier librería PWA
- `idb` o IndexedDB
- `@tanstack/query-persist-client-core`
- `beforeinstallprompt` handler
- Botón de instalación
- Indicador de conectividad (online/offline)
- Página de fallback offline
- Cola de operaciones pendientes

## Arquitectura offline

```
Service Worker (Serwist)
├── Precache: JS/CSS/Assets de build (navigation preload)
├── Cache-First: _next/static/*, /icons/*
├── Network-First: / (app shell), /dashboard/* (navegación)
├── Network-Only: /api/*, /_next/data/* (datos mutables)
└── Offline Fallback: /offline (página estática)

Client
├── TanStack Query → persistQueryClient → IndexedDB
├── NetworkStatus hook → online/offline events → banner UI
├── InstallPrompt → beforeinstallprompt → botón instalación
└── OfflineQueue → IndexedDB → replay on reconnect
```

## Base de datos — Migraciones

No se requieren migraciones de esquema. Toda la persistencia offline es client-side.

## Dependencias

```json
{
  "@serwist/next": "^9.0.0",
  "@serwist/sw": "^9.0.0",
  "idb": "^8.0.0",
  "@tanstack/query-persist-client-core": "^5.50.0",
  "idb-keyval": "^6.2.0"
}
```

## Configuración

### `next.config.ts` — Serwist PWA

```typescript
import withSerwist from '@serwist/next'

const config = {
  // ... existing config ...
}

export default withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  reloadOnOnline: true,
})(config)
```

### Service Worker (`app/sw.ts`)

```typescript
import { defaultCache } from '@serwist/next/worker'
import { PrecacheEntry, Serwist, type PrecacheFallbackEntry } from 'serwist'

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[]
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache, // usa las defaults de Serwist para apps Next.js
  fallbacks: {
    entries: [
      { url: '/offline', matcher: ({ request }) => request.mode === 'navigate' }
    ] as PrecacheFallbackEntry[],
  },
})

serwist.addEventListeners()
```

**Importante**: Eliminar o reemplazar el Route Handler `app/service-worker/route.ts` existente y el `components/pwa-register.tsx`. Serwist maneja la generación y registro del SW automáticamente.

## Frontend — Componentes nuevos

### `components/network-status.tsx` — Indicador de conectividad

- Hook personalizado que escucha eventos `online`/`offline` en `window`
- Banner fijo arriba cuando está offline: "Sin conexión — algunos datos pueden no estar disponibles"
- Opcional: toast en vez de banner
- No mostrar en la página `/offline`

```typescript
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  // ...
}
```

### `components/install-pwa.tsx` — Botón de instalación

- Escucha `beforeinstallprompt` event
- Guarda el evento (prevenir default)
- Muestra botón "Instalar app" en AppHeader (solo si el evento existe y no está ya instalada)
- Al hacer click, dispara `prompt()` del evento guardado
- Escucha `appinstalled` para ocultar el botón después de instalar

### `app/offline/page.tsx` — Página de fallback offline

- Mensaje amigable: "Te quedaste sin conexión"
- Datos cacheados de sesión (última consultora visitada, último dashboard)
- Botón "Reintentar" → `window.location.reload()`
- Información de contacto de la consultora si está cacheada

## TanStack Query — Persistencia Offline

### `components/query-provider.tsx` — Modificar el existente

```typescript
import { persistQueryClient } from '@tanstack/react-query-persist-client-core'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
// alternativa: createAsyncStoragePersister con idb-keyval para mayor capacidad
```

Wrapper sobre el provider actual que:
1. Usa `createSyncStoragePersister` con `localStorage` para queries pequeñas (`gcTime > 0` las que ya expiraron no se persisten)
2. O `createAsyncStoragePersister` con `idb-keyval` para soportar más datos
3. Opciones: `maxAge: 24 * 60 * 60 * 1000` (24hs), `buster` para invalidar en deploy
4. Solo persistir queries marcadas con `meta: { persist: true }` en el queryKey

### Uso en queries específicas

Marcar queries que deben estar disponibles offline:

```typescript
export function useEmpresa(id: string | undefined) {
  return useQuery({
    queryKey: ['empresa', id],
    queryFn: ...,
    meta: { persist: true }, // ← disponible offline
  })
}
```

Queries recomendadas para persistir:
- Datos de consultora actual
- Menú/navegación
- Establecimientos recientes
- Datos del usuario/perfil

## Offline Queue — Operaciones pendientes (opcional para "básico")

### `lib/offline-queue.ts`

Cola de operaciones de escritura que fallaron por falta de conexión:

```typescript
interface QueuedOperation {
  id: string
  type: 'server-action' | 'api-call'
  endpoint: string
  payload: unknown
  createdAt: string
  retries: number
}
```

```typescript
import { openDB } from 'idb'

const db = await openDB('sigmetria-offline', 1, {
  upgrade(db) {
    db.createObjectStore('operations', { keyPath: 'id' })
    db.createObjectStore('cache', { keyPath: 'key' })
  },
})

export async function enqueueOperation(op: Omit<QueuedOperation, 'id' | 'createdAt'>) {
  // Guardar en IndexedDB
}

export async function processQueue() {
  // Replay todas las operaciones pendientes cuando se reconecta
  // Para "básico": solo mostrar al usuario que hay operaciones pendientes
  // No intentar replay automático (riesgo de duplicados/conflictos)
}
```

## Service Worker — Estrategia de Caching Detallada

### Static Assets (Cache-First)
```
// _next/static/**
// /icons/**
// /favicon*
// /manifest.json
```
Cache agresivo: caché → red (nunca falla porque son inmutables)

### App Shell / Navigation (Network-First)
```
// dashboard/**
// / (home)
```
Red primero, fallback a caché. Esto asegura datos frescos cuando hay conexión, pero permite navegar offline.

### Data / API (Network-Only)
```
// /api/**
// /_next/data/**
```
Siempre red. No cachear datos mutables. La persistencia offline se maneja via TanStack Query.

### Offline Fallback
Cuando una navegación falla (offline), servir `/offline` page.

## Indicador de conectividad — UI

### App Header integration
- Icono de señal/WiFi en el header
- Verde = online, Rojo/ambar = offline
- Tooltip: "Sin conexión" / "Conectado"

### Mejor aún: Banner global
```tsx
// en app/layout.tsx
<NetworkStatusBanner />
<Header />
<main>{children}</main>
```

## Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `app/sw.ts` | Service worker source (Serwist) |
| `components/network-status.tsx` | Hook + banner de conectividad |
| `components/install-pwa.tsx` | Botón de instalación PWA |
| `components/install-pwa-button.tsx` | Botón "Instalar app" (render condicional) |
| `app/offline/page.tsx` | Página de fallback offline |
| `lib/offline-queue.ts` | Cola de operaciones offline (básico) |
| `lib/hooks/use-network-status.ts` | Hook de estado de red |
| `lib/hooks/use-offline-queue.ts` | Hook para la cola offline |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `next.config.ts` | Agregar `withSerwist` |
| `components/query-provider.tsx` | Agregar `persistQueryClient` |
| `components/app-header.tsx` | Agregar icono de conectividad + botón instalar |
| `app/layout.tsx` | Agregar `NetworkStatusBanner` |
| `package.json` | Agregar dependencias |
| `app/service-worker/route.ts` | **Eliminar** (Serwist genera el SW) |
| `components/pwa-register.tsx` | **Eliminar** (Serwist maneja registro) |

## Lo que NO incluye "básico"

- **Background sync** de operaciones offline (solo cola visible al usuario)
- **Cache de RSC payloads** de React Server Components (requiere análisis más profundo)
- **Sincronización bidireccional** con Supabase cuando se reconecta
- **Conflicto de datos** en writes offline
- **Cache de imágenes subidas a Storage**
- **Multi-tab sync** via BroadcastChannel

## Patrones a seguir

- **Serwist + Next.js 15**: Usar `@serwist/next` y `@serwist/sw` en vez de `next-pwa` (obsoleto) o workbox manual
- **idb sobre localStorage**: IndexedDB via `idb` para persistencia de queries (localStorage tiene límite de 5MB)
- **Graceful degradation**: Si IndexedDB no está disponible, fallback a `in-memory` (no persistir)
- **Feature-gated**: El componente InstallPWA solo se muestra si el plan del usuario tiene `modo_offline` habilitado

## Archivos existentes relevantes

- `public/manifest.json` — Manifest a mantener
- `app/layout.tsx` — Agregar banner de conectividad
- `components/query-provider.tsx` — Modificar para persistencia offline
- `components/app-header.tsx` — Agregar botón instalar + indicador
- `middleware.ts` — Ya excluye rutas PWA del auth
- `lib/plan-features.ts` — Feature key `modo_offline` ya existe
