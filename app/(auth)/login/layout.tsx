import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ingresar',
  description: 'Accedé a tu cuenta de Sigmetría HyS para gestionar capacitaciones, IPERC y cumplimiento.',
  robots: {
    index: true,
    follow: true,
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
