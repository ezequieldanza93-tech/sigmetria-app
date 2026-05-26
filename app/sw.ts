import { defaultCache } from '@serwist/next/worker'
import { Serwist, NetworkOnly } from 'serwist'

// RSC requests must never be served from cache — a stale RSC payload after a deploy
// causes React error #418 (hydration mismatch). NetworkOnly ensures every RSC fetch
// goes to the network, matching the HTML the server just rendered.
const rscNetworkOnly = {
  matcher: ({ request }: { request: Request }) => request.headers.get('RSC') === '1',
  handler: new NetworkOnly(),
}

const serwist = new Serwist({
  precacheEntries: (self as unknown as { __SW_MANIFEST: Array<{ url: string; revision: string } | string> }).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    rscNetworkOnly,
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      { url: '/offline', matcher: ({ request }) => request.mode === 'navigate' },
    ],
  },
})

// On SW activation, purge ALL runtime caches (not precache) so old content
// never causes hydration mismatches after a deploy.
// The precache caches are managed automatically by serwist.
self.addEventListener('activate', (event) => {
  ;(event as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(
    (async () => {
      const allCaches = await caches.keys()
      await Promise.all(
        allCaches
          .filter((name) => !name.startsWith('serwist-precache'))
          .map((name) => caches.delete(name)),
      )
    })(),
  )
})

serwist.addEventListeners()
