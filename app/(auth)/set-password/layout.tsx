import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Definí tu contraseña — Sigmetría HyS',
  robots: { index: false, follow: false },
}

export default function SetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
