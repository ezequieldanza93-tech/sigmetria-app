import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verificación en dos pasos — Sigmetría HyS',
  robots: { index: false, follow: false },
}

export default function MfaLayout({ children }: { children: React.ReactNode }) {
  return children
}
