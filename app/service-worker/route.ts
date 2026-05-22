const swCode = `
self.addEventListener('install', () => {
  self.skipWaiting()
  self.registration.unregister()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  )
})
`

export function GET() {
  return new Response(swCode.trim(), {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
