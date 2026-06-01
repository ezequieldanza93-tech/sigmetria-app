import type { Metadata, Viewport } from 'next'
import { Poppins, Montserrat } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { DevErrorBoundary } from '@/components/dev-error-boundary'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/components/query-provider'
import { NetworkStatusBanner } from '@/components/network-status'
import { ErrorCapture } from '@/components/error-capture'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-body',
  display: 'swap',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-heading',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hys-app-sig.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Sigmetría HyS',
    template: '%s · Sigmetría HyS',
  },
  description:
    'Plataforma SaaS para gestión de Higiene y Seguridad laboral en Argentina: capacitaciones, IPERC, mediciones, vencimientos y trazabilidad.',
  applicationName: 'Sigmetría HyS',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Sigmetría HyS',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Sigmetría HyS',
    description: 'Plataforma de Higiene y Seguridad laboral',
    url: SITE_URL,
    siteName: 'Sigmetría HyS',
    locale: 'es_AR',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1115' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// Anti-flicker: aplica el tema desde localStorage o prefers-color-scheme antes del primer paint.
// Evita el flash blanco al cargar en dark mode.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('sigmetria.theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = stored === 'dark' || ((stored === 'system' || !stored) && prefersDark) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  } catch (e) {}
})();
`.trim()

// SW cleanup: a previous Serwist config cached HTML/JS chunks, causing React #418
// (hydration mismatch) after deploys. Any browser that still has a SW registered
// must be cleaned up. This runs before any React code; if a SW is found, it is
// unregistered, caches are purged, the captured-errors log is cleared, and the
// page is reloaded fresh.
const SW_CLEANUP_SCRIPT = `
(function() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    if (!regs || regs.length === 0) return;
    Promise.all(regs.map(function(r) { return r.unregister(); }))
      .then(function() { return caches && caches.keys ? caches.keys() : []; })
      .then(function(names) { return Promise.all((names || []).map(function(n) { return caches.delete(n); })); })
      .then(function() {
        try { localStorage.removeItem('__sig_errors__'); } catch (e) {}
        location.reload();
      })
      .catch(function() { location.reload(); });
  }).catch(function() {});
})();
`.trim()

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale} className={`${poppins.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: SW_CLEANUP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="bg-surface-base text-text-primary antialiased font-body">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-brand-primary focus:px-3 focus:py-2 focus:text-white focus:shadow-lg"
          >
            Saltar al contenido
          </a>
          <QueryProvider>
            <ThemeProvider>
              <NetworkStatusBanner />
              <DevErrorBoundary>{children}</DevErrorBoundary>
            </ThemeProvider>
          </QueryProvider>
          <ErrorCapture />
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
