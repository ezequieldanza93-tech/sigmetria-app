import { defaultCache } from '@serwist/next/worker'
import { Serwist } from 'serwist'

const serwist = new Serwist({
  precacheEntries: (self as unknown as { __SW_MANIFEST: Array<{ url: string; revision: string } | string> }).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
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
