// Service Worker — PWA de Sigmetría HyS.
//
// Estrategia ANTI React #418 (la causa por la que el SW estuvo deshabilitado):
// el problema era cachear el HTML de las navegaciones → tras un deploy se servía
// HTML viejo que no matcheaba el JS nuevo → mismatch de hidratación (#418).
//
// Fix de raíz:
//   • NAVEGACIONES (documentos HTML): SIEMPRE a la red (network-first). Nunca se
//     cachea ni se sirve HTML viejo. Solo si NO hay red, se muestra /offline.
//   • Assets inmutables de /_next/static (vienen con hash de contenido en la URL):
//     cache-first. Es seguro: cada deploy genera hashes nuevos = URLs nuevas, así
//     que un asset cacheado NUNCA puede quedar "viejo" (el hash garantiza el match).
//   • /api, /auth y todo lo dinámico: NUNCA se cachea.

const VERSION = 'v1'
const STATIC_CACHE = 'sig-static-' + VERSION
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE)
        await cache.add(OFFLINE_URL) // precache de la página offline
      } catch (e) {
        // si /offline no está disponible al instalar, no rompemos la instalación
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Purga cachés de versiones viejas (incluye el Serwist anterior).
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n !== STATIC_CACHE).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch (e) {
    return
  }
  if (url.origin !== self.location.origin) return // solo same-origin

  // ── NAVEGACIONES: network-first SIEMPRE (sin cachear HTML → sin #418) ──────────
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req)
        } catch (e) {
          const cache = await caches.open(STATIC_CACHE)
          const offline = await cache.match(OFFLINE_URL)
          return (
            offline ||
            new Response('Sin conexión', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          )
        }
      })(),
    )
    return
  }

  // ── Nunca cachear dinámico ────────────────────────────────────────────────────
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/_next/data')
  ) {
    return
  }

  // ── Assets inmutables (content-hashed): cache-first ───────────────────────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const hit = await cache.match(req)
        if (hit) return hit
        try {
          const res = await fetch(req)
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone())
          return res
        } catch (e) {
          return hit || Response.error()
        }
      })(),
    )
    return
  }

  // ── Resto: comportamiento normal del navegador (sin respondWith) ──────────────
})
