import type { Metadata, Viewport } from 'next'
import { Poppins, Montserrat } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { DevErrorBoundary } from '@/components/dev-error-boundary'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/components/query-provider'
import { NetworkStatusBanner } from '@/components/network-status'
import { OfflineIndicator } from '@/components/offline-indicator'
import { ErrorCapture } from '@/components/error-capture'
import { Toaster } from '@/components/ui/toaster'
import 'flag-icons/css/flag-icons.min.css'
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

// Registro del Service Worker (PWA). El SW (public/sw.js) usa network-first para las
// NAVEGACIONES (nunca cachea HTML → no reintroduce el React #418 que tenía el Serwist
// viejo) y cache-first solo para /_next/static (assets inmutables con hash). Su activate
// purga las cachés viejas, así que los browsers que tenían el SW kill-switch quedan limpios.
const SW_REGISTER_SCRIPT = `
(function() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  });
})();
`.trim()

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale} className={`${poppins.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }} />
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
          <OfflineIndicator />
          <ErrorCapture />
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
