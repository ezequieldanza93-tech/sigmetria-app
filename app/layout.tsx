import type { Metadata } from 'next'
import { Poppins, Montserrat } from 'next/font/google'
import { DevErrorBoundary } from '@/components/dev-error-boundary'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/components/query-provider'
import { ErrorCapture } from '@/components/error-capture'
import { PWARegister } from '@/components/pwa-register'
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

export const metadata: Metadata = {
  title: 'Sigmetría HyS',
  description: 'Plataforma de Higiene y Seguridad laboral',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Sigmetría HyS',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" data-theme="light" className={`${poppins.variable} ${montserrat.variable}`}>
      <body className="bg-surface-base text-text-primary antialiased font-body">
        <QueryProvider>
          <ThemeProvider>
            <DevErrorBoundary>{children}</DevErrorBoundary>
          </ThemeProvider>
        </QueryProvider>
        <PWARegister />
        <ErrorCapture />
      </body>
    </html>
  )
}
