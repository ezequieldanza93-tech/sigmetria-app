import type { Metadata, Viewport } from 'next'
import { Poppins, Montserrat } from 'next/font/google'
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
    apple: '/icons/icon-192.png',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${poppins.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="bg-surface-base text-text-primary antialiased font-body">
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
      </body>
    </html>
  )
}
