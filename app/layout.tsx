import type { Metadata } from 'next'
import { DevErrorBoundary } from '@/components/dev-error-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sigmetría HyS',
  description: 'Plataforma de Higiene y Seguridad',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <DevErrorBoundary>{children}</DevErrorBoundary>
      </body>
    </html>
  )
}
