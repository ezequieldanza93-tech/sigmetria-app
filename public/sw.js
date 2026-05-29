// Service Worker kill switch.
// Purges all caches, unregisters itself, and force-reloads open tabs.
// After this runs once per browser, there is no SW left for this origin.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
      await self.registration.unregister()
      const clientList = await self.clients.matchAll({ type: 'window' })
      for (const client of clientList) {
        try {
          await client.navigate(client.url)
        } catch {
          // ignore — some clients (cross-origin) cannot be navigated
        }
      }
    })(),
  )
})

self.addEventListener('fetch', () => {
  // no-op — let the browser handle every request normally
})
