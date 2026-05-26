import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'
import withBundleAnalyzer from '@next/bundle-analyzer'

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org",
  "connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org https://api.open-meteo.com",
  "font-src 'self'",
  "frame-src 'self' https://www.openstreetmap.org",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp-report",
  "report-to csp-endpoint",
]

const csp = cspDirectives.join('; ')

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  reloadOnOnline: true,
})

const nextConfig: NextConfig = {
  transpilePackages: ['recharts'],
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    optimizePackageImports: [
      'lucide-react',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'recharts',
      'date-fns',
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
    formats: ['image/avif', 'image/webp'],
  },
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
      {
        // RSC payloads must never be cached — stale RSC after a deploy causes React #418.
        source: '/:path*',
        has: [{ type: 'header', key: 'RSC', value: '1' }],
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

const bundleAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })

export default bundleAnalyzer(withSerwist(nextConfig))
