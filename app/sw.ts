import { defaultCache } from '@serwist/next/worker'
import { Serwist, NetworkOnly } from 'serwist'

// HTML and RSC must NEVER come from cache. A stale HTML payload after a deploy +
// fresh RSC = React #418 (hydration mismatch). Serwist's defaultCache uses
// NetworkFirst for "pages", which still serves stale HTML when the network is
// slow — unacceptable. NetworkOnly forces every navigation to the network;
// offline fallback is handled by `fallbacks.entries` below.
const navigationNetworkOnly = {
  matcher: ({ request, sameOrigin, url: { pathname } }: { request: Request; sameOrigin: boolean; url: URL }) =>
    sameOrigin &&
    !pathname.startsWith('/api/') &&
    (request.mode === 'navigate' || request.headers.get('RSC') === '1'),
  handler: new NetworkOnly(),
}

const serwist = new Serwist({
  precacheEntries: (self as unknown as { __SW_MANIFEST: Array<{ url: string; revision: string } | string> }).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    navigationNetworkOnly,
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
