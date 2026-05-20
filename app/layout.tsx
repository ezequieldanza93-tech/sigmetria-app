import type { Metadata } from 'next'
import { DevErrorBoundary } from '@/components/dev-error-boundary'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/components/query-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sigmetría HyS',
  description: 'Plataforma de Higiene y Seguridad',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700&family=Poppins:wght@300;400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="bg-surface-base text-text-primary antialiased"
        style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}
      >
        <QueryProvider>
          <ThemeProvider>
            <DevErrorBoundary>{children}</DevErrorBoundary>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
