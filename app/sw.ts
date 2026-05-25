import { defaultCache } from '@serwist/next/worker'
import { NetworkFirst, ExpirationPlugin, Serwist } from 'serwist'

const serwist = new Serwist({
  precacheEntries: (self as unknown as { __SW_MANIFEST: Array<{ url: string; revision: string } | string> }).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: /\.(?:js)$/i,
      handler: new NetworkFirst({
        cacheName: 'static-js-assets',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60,
            maxAgeFrom: 'last-used',
          }),
        ],
        networkTimeoutSeconds: 5,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      { url: '/offline', matcher: ({ request }) => request.mode === 'navigate' },
    ],
  },
})

serwist.addEventListeners()
